/**
 * A small markdown parser shared by the editor preview and the PDF/Word
 * exporters, so a note reads the same everywhere and no syntax leaks into an
 * exported document. Deliberately limited to what the editor's toolbar can
 * produce: headings, lists, quotes, fenced code, rules and inline emphasis.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; value: string; href: string }
  /** `[[Another note]]`, or `[[Another note|as this]]`. */
  | { type: "wikilink"; value: string; target: string };

export type Block =
  | { type: "heading"; level: 1 | 2 | 3; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | { type: "bullet"; content: Inline[]; ordered: false }
  | { type: "bullet"; content: Inline[]; ordered: true; marker: string }
  /** A checklist item. `line` is its index in the source, so it can be ticked. */
  | { type: "task"; content: Inline[]; checked: boolean; line: number }
  | { type: "quote"; content: Inline[] }
  | { type: "code"; value: string }
  | { type: "rule" };

// The wikilink alternative goes first: `[[a]]` must not be read as the start of
// a `[label](href)` link.
const INLINE_PATTERN =
  /(\[\[[^\]\n]+\]\])|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*)|(`[^`\n]+`)|(\[[^\]\n]+\]\([^)\s]+\))/;

/** `- [ ] something` / `- [x] something`, in any list marker. */
const TASK_PATTERN = /^(\s*)([-*+])\s+\[([ xX])\]\s?(.*)$/;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let rest = text;

  while (rest) {
    const match = INLINE_PATTERN.exec(rest);
    if (!match || match.index === undefined) break;

    if (match.index > 0) {
      out.push({ type: "text", value: rest.slice(0, match.index) });
    }

    const token = match[0];
    if (token.startsWith("[[")) {
      const [target, label] = token.slice(2, -2).split("|");
      out.push({
        type: "wikilink",
        target: target.trim(),
        value: (label ?? target).trim(),
      });
    } else if (token.startsWith("**")) {
      out.push({ type: "bold", value: token.slice(2, -2) });
    } else if (token.startsWith("`")) {
      out.push({ type: "code", value: token.slice(1, -1) });
    } else if (token.startsWith("[")) {
      const [, label, href] = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(token) ?? [];
      out.push({ type: "link", value: label ?? token, href: href ?? "" });
    } else {
      out.push({ type: "italic", value: token.slice(1, -1) });
    }

    rest = rest.slice(match.index + token.length);
  }

  if (rest) out.push({ type: "text", value: rest });
  return out.length ? out : [{ type: "text", value: text }];
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.split("\n");
  const blocks: Block[] = [];

  let paragraph: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", content: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    // Fenced code runs verbatim until the closing fence.
    if (line.trimStart().startsWith("```")) {
      if (code) {
        blocks.push({ type: "code", value: code.join("\n") });
        code = null;
      } else {
        flushParagraph();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        content: parseInline(heading[2]),
      });
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[\s\S]*$/.test(line.trim()) && line.trim().length >= 3) {
      flushParagraph();
      blocks.push({ type: "rule" });
      continue;
    }

    // Checked before the plain bullet, which would otherwise swallow it and
    // leave the "[ ]" sitting in the text.
    const task = TASK_PATTERN.exec(line);
    if (task) {
      flushParagraph();
      blocks.push({
        type: "task",
        checked: task[3] !== " ",
        line: index,
        content: parseInline(task[4]),
      });
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      blocks.push({ type: "bullet", ordered: false, content: parseInline(bullet[1]) });
      continue;
    }

    const ordered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      flushParagraph();
      blocks.push({
        type: "bullet",
        ordered: true,
        marker: `${ordered[1]}.`,
        content: parseInline(ordered[2]),
      });
      continue;
    }

    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      flushParagraph();
      blocks.push({ type: "quote", content: parseInline(quote[1]) });
      continue;
    }

    paragraph.push(line.trim());
  }

  if (code) blocks.push({ type: "code", value: code.join("\n") });
  flushParagraph();

  return blocks;
}

/** Inline nodes flattened back to plain text, for PDF drawing. */
export function inlineToText(content: Inline[]) {
  return content.map((node) => node.value).join("");
}

/**
 * What a new line should start with when Enter is pressed inside a list, so
 * lists keep going the way they do in every other editor. Returns null when the
 * line is not a list item, and "" when an empty item should end the list.
 */
export function continuationFor(line: string): string | null {
  // A checklist continues as a checklist, and always unchecked.
  const task = TASK_PATTERN.exec(line);
  if (task) return task[4].trim() ? `${task[1]}${task[2]} [ ] ` : "";

  const bullet = /^(\s*)([-*+])\s+(.*)$/.exec(line);
  if (bullet) return bullet[3].trim() ? `${bullet[1]}${bullet[2]} ` : "";

  const ordered = /^(\s*)(\d+)([.)])\s+(.*)$/.exec(line);
  if (ordered) {
    return ordered[4].trim()
      ? `${ordered[1]}${Number(ordered[2]) + 1}${ordered[3]} `
      : "";
  }

  return null;
}

/**
 * Flips one checklist item, addressed by its source line. The preview knows the
 * line because the parser hands it over, so ticking a box edits the markdown
 * the note is actually made of — there is no second copy of the state.
 */
export function toggleTask(source: string, line: number): string {
  const lines = source.split("\n");
  const target = lines[line];
  if (target === undefined) return source;

  const task = TASK_PATTERN.exec(target);
  if (!task) return source;

  lines[line] = target.replace(/\[([ xX])\]/, task[3] === " " ? "[x]" : "[ ]");
  return lines.join("\n");
}

/**
 * The half-written `[[` link the caret is sitting inside, if any — what the
 * editor's completion menu filters on. Returns null as soon as the link is
 * closed or the line ends, so the menu appears and disappears on its own.
 */
export function wikiLinkQueryAt(
  value: string,
  caret: number,
): { query: string; start: number } | null {
  const before = value.slice(0, caret);
  const start = before.lastIndexOf("[[");
  if (start === -1) return null;

  const fragment = before.slice(start + 2);
  if (/[[\]\n]/.test(fragment)) return null;

  return { query: fragment, start };
}

/** How much of a note's checklist is done, or null if it has no checklist. */
export function taskProgress(source: string): { done: number; total: number } | null {
  let done = 0;
  let total = 0;

  for (const line of source.split("\n")) {
    const task = TASK_PATTERN.exec(line);
    if (!task) continue;
    total += 1;
    if (task[3] !== " ") done += 1;
  }

  return total ? { done, total } : null;
}
