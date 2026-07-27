import { describe, expect, it } from "vitest";
import { diffText, peerColor, shiftCaret } from "./collab";

/** Applies an edit the way the CRDT would, so the tests check a round trip. */
function apply(text: string, edit: ReturnType<typeof diffText>) {
  if (!edit) return text;
  return text.slice(0, edit.at) + edit.insert + text.slice(edit.at + edit.remove);
}

describe("diffText", () => {
  it("is null when nothing changed", () => {
    expect(diffText("same", "same")).toBeNull();
  });

  it("finds a single inserted character in the middle", () => {
    expect(diffText("helo", "hello")).toEqual({ at: 3, remove: 0, insert: "l" });
  });

  it("finds a deletion", () => {
    expect(diffText("hello", "helo")).toEqual({ at: 3, remove: 1, insert: "" });
  });

  it("finds a replacement", () => {
    expect(diffText("the cat sat", "the dog sat")).toEqual({
      at: 4,
      remove: 3,
      insert: "dog",
    });
  });

  it("handles typing at the very start and the very end", () => {
    expect(diffText("bc", "abc")).toEqual({ at: 0, remove: 0, insert: "a" });
    expect(diffText("ab", "abc")).toEqual({ at: 2, remove: 0, insert: "c" });
  });

  it("handles emptying and filling", () => {
    expect(diffText("gone", "")).toEqual({ at: 0, remove: 4, insert: "" });
    expect(diffText("", "new")).toEqual({ at: 0, remove: 0, insert: "new" });
  });

  /*
   * The point of a minimal diff is that a keystroke stays a keystroke: sending
   * the whole document would make every edit collide with every other one.
   */
  it("does not resend text that did not change", () => {
    const before = `${"x".repeat(500)}end`;
    const edit = diffText(before, `${"x".repeat(500)}END`)!;
    expect(edit.insert.length).toBeLessThan(5);
  });

  it("round-trips whatever it produces", () => {
    const cases: Array<[string, string]> = [
      ["", "hello"],
      ["hello", ""],
      ["a b c", "a x c"],
      ["repeated repeated", "repeated"],
      ["line one\nline two", "line one\nline 2\nline three"],
      ["aaa", "aa"],
      ["aa", "aaa"],
    ];

    for (const [before, after] of cases) {
      expect(apply(before, diffText(before, after))).toBe(after);
    }
  });
});

describe("shiftCaret", () => {
  const insertAt5 = { at: 5, remove: 0, insert: "abc" };

  it("leaves a caret before the edit alone", () => {
    expect(shiftCaret(2, insertAt5)).toBe(2);
    expect(shiftCaret(5, insertAt5)).toBe(5);
  });

  it("pushes a caret after the edit along by the difference", () => {
    expect(shiftCaret(9, insertAt5)).toBe(12);
  });

  it("pulls a caret back when text was removed", () => {
    expect(shiftCaret(20, { at: 5, remove: 4, insert: "" })).toBe(16);
  });

  it("puts a caret that was inside the replaced run at the end of it", () => {
    expect(shiftCaret(7, { at: 5, remove: 5, insert: "xx" })).toBe(7);
    expect(shiftCaret(9, { at: 5, remove: 5, insert: "xx" })).toBe(7);
  });
});

describe("peerColor", () => {
  it("gives the same name the same colour every time", () => {
    expect(peerColor("Ada")).toBe(peerColor("Ada"));
  });

  it("always returns a colour from the palette", () => {
    for (const seed of ["", "a", "Owner-1", "Guest-99999"]) {
      expect(peerColor(seed)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
