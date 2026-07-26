import { describe, expect, it } from "vitest";
import { continuationFor, inlineToText, parseInline, parseMarkdown } from "./markdown";

describe("parseMarkdown", () => {
  it("reads headings at each level", () => {
    const blocks = parseMarkdown("# One\n## Two\n### Three");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "heading", "heading"]);
    expect(blocks.map((b) => (b.type === "heading" ? b.level : null))).toEqual([1, 2, 3]);
  });

  it("keeps bullets and numbered items apart", () => {
    const blocks = parseMarkdown("- first\n- second\n\n1. one\n2. two");
    const bullets = blocks.filter((b) => b.type === "bullet");
    expect(bullets).toHaveLength(4);
    expect(bullets.filter((b) => b.type === "bullet" && b.ordered)).toHaveLength(2);
  });

  it("joins wrapped lines into one paragraph", () => {
    const blocks = parseMarkdown("one line\nstill the same paragraph\n\nnew one");
    expect(blocks).toHaveLength(2);
    expect(inlineToText(blocks[0].type === "paragraph" ? blocks[0].content : [])).toBe(
      "one line still the same paragraph",
    );
  });

  it("passes fenced code through untouched", () => {
    const blocks = parseMarkdown("```\nconst x = 1;\n# not a heading\n```");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({ type: "code", value: "const x = 1;\n# not a heading" });
  });

  it("reads quotes and rules", () => {
    expect(parseMarkdown("> quoted")[0].type).toBe("quote");
    expect(parseMarkdown("---")[0].type).toBe("rule");
  });
});

describe("parseInline", () => {
  it("splits emphasis, code and links out of the surrounding text", () => {
    const nodes = parseInline("plain **bold** and *italic* and `code` and [label](https://x.dev)");
    expect(nodes.map((n) => n.type)).toEqual([
      "text",
      "bold",
      "text",
      "italic",
      "text",
      "code",
      "text",
      "link",
    ]);
    expect(nodes.find((n) => n.type === "link")).toMatchObject({
      value: "label",
      href: "https://x.dev",
    });
  });

  it("leaves text without markers alone", () => {
    expect(parseInline("nothing special")).toEqual([
      { type: "text", value: "nothing special" },
    ]);
  });
});

describe("continuationFor", () => {
  it("continues a bulleted list", () => {
    expect(continuationFor("- something")).toBe("- ");
    expect(continuationFor("  * indented")).toBe("  * ");
  });

  it("increments a numbered list", () => {
    expect(continuationFor("3. third")).toBe("4. ");
    expect(continuationFor("1) first")).toBe("2) ");
  });

  it("ends the list when the item is empty", () => {
    expect(continuationFor("- ")).toBe("");
    expect(continuationFor("2. ")).toBe("");
  });

  it("returns null outside a list, so Enter behaves normally", () => {
    expect(continuationFor("just a sentence")).toBeNull();
  });
});
