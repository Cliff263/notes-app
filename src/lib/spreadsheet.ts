import { tableToMarkdown } from "./markdown";

/** RFC 4180-style CSV reader, including quoted commas, quotes and newlines. */
export function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((value) => value.length > 0));
}

export function csvToMarkdown(source: string) {
  const parsed = parseCsv(source);
  if (!parsed.length) return "";
  const width = Math.max(...parsed.map((row) => row.length));
  const headers = Array.from(
    { length: width },
    (_, index) => parsed[0][index] || `Column ${index + 1}`,
  );
  return tableToMarkdown(headers, parsed.slice(1));
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function tableToCsv(headers: string[], rows: string[][]) {
  return [headers, ...rows]
    .map((row) => row.map((cell) => csvCell(cell ?? "")).join(","))
    .join("\r\n");
}
