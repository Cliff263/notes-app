import { describe, expect, it } from "vitest";
import {
  buildTsQuery,
  highlightSegments,
  HIGHLIGHT_END,
  HIGHLIGHT_START,
} from "./search";

const mark = (text: string) => `${HIGHLIGHT_START}${text}${HIGHLIGHT_END}`;

describe("buildTsQuery", () => {
  it("ands the words together and lets the last one still be typed", () => {
    expect(buildTsQuery("project plan")).toBe("project & plan:*");
    expect(buildTsQuery("Notes")).toBe("notes:*");
  });

  /*
   * to_tsquery throws on malformed input, so nothing but letters and digits is
   * allowed to reach it — these are the cases that would otherwise 500.
   */
  it("drops every character that could be read as an operator", () => {
    expect(buildTsQuery("c++")).toBe("c:*");
    expect(buildTsQuery("a & b")).toBe("a & b:*");
    expect(buildTsQuery("'; drop table notes; --")).toBe("drop & table & notes:*");
    expect(buildTsQuery("(unbalanced")).toBe("unbalanced:*");
    expect(buildTsQuery("a|b")).toBe("a & b:*");
  });

  it("keeps letters that are not ASCII", () => {
    expect(buildTsQuery("café")).toBe("café:*");
  });

  it("is null when there is nothing to search for", () => {
    expect(buildTsQuery("")).toBeNull();
    expect(buildTsQuery("   ")).toBeNull();
    expect(buildTsQuery("#")).toBeNull();
    expect(buildTsQuery("!!!")).toBeNull();
  });

  it("stops at a sensible number of terms", () => {
    const terms = Array.from({ length: 30 }, (_, index) => `word${index}`).join(" ");
    expect(buildTsQuery(terms)!.split(" & ")).toHaveLength(12);
  });
});

describe("highlightSegments", () => {
  it("splits a headline into plain and matched runs", () => {
    expect(highlightSegments(`the ${mark("plan")} for today`)).toEqual([
      { text: "the ", match: false },
      { text: "plan", match: true },
      { text: " for today", match: false },
    ]);
  });

  it("handles a match at either end", () => {
    expect(highlightSegments(`${mark("plan")} first`)).toEqual([
      { text: "plan", match: true },
      { text: " first", match: false },
    ]);
    expect(highlightSegments(`last ${mark("plan")}`)).toEqual([
      { text: "last ", match: false },
      { text: "plan", match: true },
    ]);
  });

  it("passes an unmarked headline straight through", () => {
    expect(highlightSegments("nothing matched here")).toEqual([
      { text: "nothing matched here", match: false },
    ]);
  });
});
