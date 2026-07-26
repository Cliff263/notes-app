import { describe, expect, it } from "vitest";
import {
  cn,
  isSameDay,
  monthGrid,
  readingTime,
  relativeTime,
  stripMarkdown,
  toLocalInputValue,
  wordCount,
} from "./utils";

describe("cn", () => {
  it("drops falsy values so conditional classes stay readable", () => {
    expect(cn("a", false, undefined, "b", null)).toBe("a b");
  });
});

describe("wordCount and readingTime", () => {
  it("counts words, not characters", () => {
    expect(wordCount("one two three")).toBe(3);
    expect(wordCount("   ")).toBe(0);
    expect(wordCount("spaced   out    words")).toBe(3);
  });

  it("never reports less than a minute", () => {
    expect(readingTime("short")).toBe(1);
    expect(readingTime(Array(400).fill("word").join(" "))).toBe(2);
  });
});

describe("stripMarkdown", () => {
  it("removes syntax so an excerpt reads as prose", () => {
    expect(stripMarkdown("## Heading\n- **bold** item\n> quote")).toBe(
      "Heading bold item quote",
    );
  });

  it("keeps link text and drops the target", () => {
    expect(stripMarkdown("see [the docs](https://example.test)")).toBe("see the docs");
  });

  it("drops fenced code entirely", () => {
    expect(stripMarkdown("before\n```\nconst x = 1\n```\nafter")).toBe("before after");
  });
});

describe("monthGrid", () => {
  it("always returns six whole weeks", () => {
    const cells = monthGrid(2026, 6);
    expect(cells).toHaveLength(42);
    expect(cells[0].getDay()).toBe(0);
  });

  it("starts on the Sunday on or before the first of the month", () => {
    // 1 July 2026 is a Wednesday, so the grid opens on 28 June.
    const [first] = monthGrid(2026, 6);
    expect(first.getMonth()).toBe(5);
    expect(first.getDate()).toBe(28);
  });
});

describe("date helpers", () => {
  it("compares calendar days, not timestamps", () => {
    expect(isSameDay(new Date("2026-07-26T01:00"), new Date("2026-07-26T23:00"))).toBe(true);
    expect(isSameDay(new Date("2026-07-26T23:00"), new Date("2026-07-27T00:30"))).toBe(false);
  });

  it("describes recent edits in relative terms", () => {
    expect(relativeTime(new Date(Date.now() - 30_000))).toBe("just now");
    expect(relativeTime(new Date(Date.now() - 5 * 60_000))).toBe("5m ago");
    expect(relativeTime(new Date(Date.now() - 3 * 3_600_000))).toBe("3h ago");
  });

  it("formats a local datetime-local value without shifting the zone", () => {
    const value = toLocalInputValue(new Date(2026, 6, 26, 9, 5));
    expect(value).toBe("2026-07-26T09:05");
  });
});
