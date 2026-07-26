import { describe, expect, it } from "vitest";
import {
  continuationFor,
  inlineToText,
  parseInline,
  parseMarkdown,
  taskProgress,
  toggleTask,
  wikiLinkQueryAt,
} from "./markdown";

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

  it("reads checklist items instead of bullets, and remembers their line", () => {
    const blocks = parseMarkdown("intro\n\n- [ ] todo\n- [x] done\n- plain");

    expect(blocks.map((b) => b.type)).toEqual(["paragraph", "task", "task", "bullet"]);
    expect(blocks[1]).toMatchObject({ checked: false, line: 2 });
    expect(blocks[2]).toMatchObject({ checked: true, line: 3 });
    expect(inlineToText(blocks[1].type === "task" ? blocks[1].content : [])).toBe("todo");
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

  it("reads wiki links, with and without an alias", () => {
    const nodes = parseInline("see [[Project plan]] and [[Notes|these ones]]");

    expect(nodes.map((n) => n.type)).toEqual(["text", "wikilink", "text", "wikilink"]);
    expect(nodes[1]).toEqual({
      type: "wikilink",
      target: "Project plan",
      value: "Project plan",
    });
    expect(nodes[3]).toEqual({ type: "wikilink", target: "Notes", value: "these ones" });
  });

  it("does not mistake a wiki link for a markdown link", () => {
    const nodes = parseInline("[[Inbox]] then [label](https://x.dev)");
    expect(nodes.map((n) => n.type)).toEqual(["wikilink", "text", "link"]);
  });

  it("flattens a wiki link to the text it displays", () => {
    expect(inlineToText(parseInline("go to [[Notes|these ones]]"))).toBe(
      "go to these ones",
    );
  });
});

describe("toggleTask", () => {
  const source = "- [ ] one\n- [x] two\nnot a task";

  it("ticks and unticks the addressed line only", () => {
    expect(toggleTask(source, 0)).toBe("- [x] one\n- [x] two\nnot a task");
    expect(toggleTask(source, 1)).toBe("- [ ] one\n- [ ] two\nnot a task");
  });

  it("leaves the note alone when the line is not a task", () => {
    expect(toggleTask(source, 2)).toBe(source);
    expect(toggleTask(source, 99)).toBe(source);
  });
});

describe("taskProgress", () => {
  it("counts what is done out of what there is", () => {
    expect(taskProgress("- [x] a\n- [ ] b\n- [X] c")).toEqual({ done: 2, total: 3 });
  });

  it("is null when there is no checklist to report on", () => {
    expect(taskProgress("- a plain bullet\n\nsome prose")).toBeNull();
  });
});

describe("wikiLinkQueryAt", () => {
  it("finds the link being typed, and where it starts", () => {
    expect(wikiLinkQueryAt("see [[proj", 10)).toEqual({ query: "proj", start: 4 });
  });

  it("gives up once the link is closed or the line ends", () => {
    expect(wikiLinkQueryAt("see [[proj]]", 12)).toBeNull();
    expect(wikiLinkQueryAt("see [[proj\nnext", 15)).toBeNull();
    expect(wikiLinkQueryAt("nothing here", 12)).toBeNull();
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

  it("continues a checklist with a fresh, unticked box", () => {
    expect(continuationFor("- [ ] something")).toBe("- [ ] ");
    expect(continuationFor("  * [x] done")).toBe("  * [ ] ");
    expect(continuationFor("- [ ] ")).toBe("");
  });
});
