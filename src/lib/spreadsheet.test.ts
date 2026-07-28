import { describe, expect, it } from "vitest";
import { csvToMarkdown, parseCsv, tableToCsv } from "./spreadsheet";

describe("CSV spreadsheet import", () => {
  it("handles quoted commas, escaped quotes and line breaks", () => {
    expect(parseCsv('Name,Notes\nAda,"One, two"\nLinus,"Said ""hello"""')).toEqual([
      ["Name", "Notes"],
      ["Ada", "One, two"],
      ["Linus", 'Said "hello"'],
    ]);
  });

  it("turns the first row into editable Markdown table headers", () => {
    expect(csvToMarkdown("Name,Score\nAda,10\nGrace,12")).toBe(
      "| Name | Score |\n| --- | --- |\n| Ada | 10 |\n| Grace | 12 |",
    );
  });

  it("exports edited table cells as portable CSV", () => {
    expect(tableToCsv(["Name", "Notes"], [["Ada", 'One, "two"']])).toBe(
      'Name,Notes\r\nAda,"One, ""two"""',
    );
  });
});
