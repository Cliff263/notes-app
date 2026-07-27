/**
 * A line-level diff, used by the version history to show what an edit actually
 * changed rather than two walls of text side by side.
 *
 * Longest common subsequence over lines, which is what `diff` itself does. The
 * quadratic table is fine here because the identical head and tail are trimmed
 * off first — most edits touch a handful of lines in the middle of a note — and
 * anything still enormous after that trim falls back to "this block was
 * replaced", which is honest and costs nothing.
 */

export type DiffRow = { type: "same" | "add" | "remove"; text: string };

/** Past this many lines on either side, the LCS table is not worth building. */
const MAX_LINES = 1200;

export function diffLines(before: string, after: string): DiffRow[] {
  const a = before.split("\n");
  const b = after.split("\n");

  // Identical head and tail, which no algorithm needs to look at.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;

  let tail = 0;
  while (
    tail < a.length - head &&
    tail < b.length - head &&
    a[a.length - 1 - tail] === b[b.length - 1 - tail]
  ) {
    tail += 1;
  }

  const middleA = a.slice(head, a.length - tail);
  const middleB = b.slice(head, b.length - tail);

  const rows: DiffRow[] = a.slice(0, head).map((text) => ({ type: "same", text }));
  rows.push(...diffMiddle(middleA, middleB));
  rows.push(
    ...a.slice(a.length - tail).map((text) => ({ type: "same" as const, text })),
  );

  return rows;
}

function diffMiddle(a: string[], b: string[]): DiffRow[] {
  if (!a.length && !b.length) return [];
  if (!a.length) return b.map((text) => ({ type: "add", text }));
  if (!b.length) return a.map((text) => ({ type: "remove", text }));

  if (a.length > MAX_LINES || b.length > MAX_LINES) {
    return [
      ...a.map((text) => ({ type: "remove" as const, text })),
      ...b.map((text) => ({ type: "add" as const, text })),
    ];
  }

  // lengths[i][j] = length of the LCS of a[i:] and b[j:]
  const lengths: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lengths[i][j] =
        a[i] === b[j]
          ? lengths[i + 1][j + 1] + 1
          : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ type: "same", text: a[i] });
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      rows.push({ type: "remove", text: a[i] });
      i += 1;
    } else {
      rows.push({ type: "add", text: b[j] });
      j += 1;
    }
  }

  while (i < a.length) rows.push({ type: "remove", text: a[i++] });
  while (j < b.length) rows.push({ type: "add", text: b[j++] });

  return rows;
}

/** How many lines an edit touched, for the one-line summary in the list. */
export function diffSummary(rows: DiffRow[]) {
  let added = 0;
  let removed = 0;
  for (const row of rows) {
    if (row.type === "add") added += 1;
    if (row.type === "remove") removed += 1;
  }
  return { added, removed };
}

/**
 * Whether an edit is different enough to be worth its own snapshot even though
 * the last one was taken moments ago — a paste or a delete, rather than the
 * next few words of a sentence.
 */
export function movedSubstantially(before: string, after: string) {
  const delta = Math.abs(after.length - before.length);
  return delta > 200 || delta > before.length * 0.25;
}
