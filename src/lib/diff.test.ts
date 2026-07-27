import { describe, expect, it } from "vitest";
import { diffLines, diffSummary, movedSubstantially } from "./diff";

const render = (rows: ReturnType<typeof diffLines>) =>
  rows.map((row) => `${row.type === "add" ? "+" : row.type === "remove" ? "-" : " "}${row.text}`);

describe("diffLines", () => {
  it("marks nothing when nothing changed", () => {
    const rows = diffLines("one\ntwo", "one\ntwo");
    expect(rows.every((row) => row.type === "same")).toBe(true);
  });

  it("shows an inserted line without disturbing its neighbours", () => {
    expect(render(diffLines("one\nthree", "one\ntwo\nthree"))).toEqual([
      " one",
      "+two",
      " three",
    ]);
  });

  it("shows a removed line", () => {
    expect(render(diffLines("one\ntwo\nthree", "one\nthree"))).toEqual([
      " one",
      "-two",
      " three",
    ]);
  });

  it("shows a changed line as a removal and an addition", () => {
    expect(render(diffLines("hello there", "hello world"))).toEqual([
      "-hello there",
      "+hello world",
    ]);
  });

  it("keeps the common head and tail out of the comparison", () => {
    const before = "a\nb\nSOMETHING\ny\nz";
    const after = "a\nb\nELSE\ny\nz";
    expect(render(diffLines(before, after))).toEqual([
      " a",
      " b",
      "-SOMETHING",
      "+ELSE",
      " y",
      " z",
    ]);
  });

  it("handles one side being empty", () => {
    expect(render(diffLines("", "new"))).toEqual(["-", "+new"]);
    expect(diffSummary(diffLines("gone", ""))).toEqual({ added: 1, removed: 1 });
  });

  it("stays cheap on a document far past the LCS cut-off", () => {
    const before = Array.from({ length: 4000 }, (_, i) => `line ${i}`).join("\n");
    const after = Array.from({ length: 4000 }, (_, i) => `changed ${i}`).join("\n");

    const started = Date.now();
    const rows = diffLines(before, after);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(diffSummary(rows)).toEqual({ added: 4000, removed: 4000 });
  });
});

describe("movedSubstantially", () => {
  it("is false while someone is typing a sentence", () => {
    const before = "a".repeat(2000);
    expect(movedSubstantially(before, `${before} and a few more words`)).toBe(false);
  });

  it("is true for a paste or a big deletion", () => {
    expect(movedSubstantially("short note", "short note".repeat(40))).toBe(true);
    expect(movedSubstantially("a".repeat(1000), "")).toBe(true);
  });
});
