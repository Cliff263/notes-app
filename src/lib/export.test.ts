import { describe, expect, it } from "vitest";
import { slugify, toDocx, toMarkdown, toPdf, toPlainText } from "./export";
import type { Note } from "./types";

const note: Note = {
  id: "n1",
  title: "Meeting Notes",
  content: "## Agenda\n- first item\n- second **item**\n\nA closing paragraph.",
  category: "Work",
  tags: ["meeting", "product"],
  pinned: false,
  favorite: true,
  archived: false,
  createdAt: "2026-07-20T09:00:00.000Z",
  updatedAt: "2026-07-26T09:00:00.000Z",
  deletedAt: null,
  dueAt: null,
};

describe("slugify", () => {
  it("makes a title safe for a filename", () => {
    expect(slugify("Meeting Notes: Q3 / Launch!")).toBe("meeting-notes-q3-launch");
  });

  it("falls back when a title has nothing usable", () => {
    expect(slugify("***")).toBe("note");
  });
});

describe("toMarkdown", () => {
  it("keeps the body verbatim and adds the metadata", () => {
    const out = toMarkdown([note]);
    expect(out).toContain("# Meeting Notes");
    expect(out).toContain("**Category:** Work");
    expect(out).toContain("#meeting #product");
    expect(out).toContain("- second **item**");
  });

  it("separates several notes with a rule", () => {
    expect(toMarkdown([note, { ...note, id: "n2" }])).toContain("\n---\n");
  });
});

describe("toPlainText", () => {
  it("strips markdown so nothing leaks into a .txt file", () => {
    const out = toPlainText([note]);
    expect(out).toContain("AGENDA");
    expect(out).not.toContain("## Agenda");
    expect(out).not.toContain("**item**");
    expect(out).toContain("second item");
  });
});

const checklist: Note = {
  ...note,
  id: "n3",
  title: "Launch",
  content: "- [x] book the room\n- [ ] send the invite\n\nSee [[Meeting Notes|the agenda]].",
};

describe("toPlainText with a checklist", () => {
  it("keeps the boxes and shows the link's label", () => {
    const out = toPlainText([checklist]);
    expect(out).toContain("[x] book the room");
    expect(out).toContain("[ ] send the invite");
    expect(out).toContain("See the agenda.");
    expect(out).not.toContain("[[");
  });
});

describe("binary exports", () => {
  it("writes a real PDF", async () => {
    const pdf = await toPdf([note]);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(500);
  });

  it("writes a real docx (a zip container)", async () => {
    const docx = await toDocx([note], "Export");
    expect(docx.subarray(0, 2).toString()).toBe("PK");
    expect(docx.length).toBeGreaterThan(500);
  });

  /*
   * Helvetica is WinAnsi-encoded, so a checkbox glyph would throw rather than
   * render. This is the guard against that coming back.
   */
  it("draws a checklist without tripping over the PDF font's encoding", async () => {
    const pdf = await toPdf([checklist]);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("puts a checklist into Word", async () => {
    const docx = await toDocx([checklist], "Export");
    expect(docx.subarray(0, 2).toString()).toBe("PK");
  });
});

describe("attached images", () => {
  const illustrated: Note = {
    ...note,
    id: "n4",
    content: "Look at this:\n\n![the chart](/api/attachments/a1)\n\nThat is all.",
  };

  /* A 1×1 red PNG — the smallest thing pdf-lib and docx will both accept. */
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const bundle = new Map([["/api/attachments/a1", { data: pixel, mime: "image/png" }]]);

  it("embeds the picture in a PDF instead of writing out its alt text", async () => {
    const withImage = await toPdf([illustrated], bundle);
    const withoutImage = await toPdf([illustrated]);

    expect(withImage.subarray(0, 5).toString()).toBe("%PDF-");
    // The embedded stream has to make the file bigger than the text alone.
    expect(withImage.length).toBeGreaterThan(withoutImage.length);
  });

  it("embeds the picture in Word", async () => {
    const withImage = await toDocx([illustrated], "Export", bundle);
    const withoutImage = await toDocx([illustrated], "Export");

    expect(withImage.subarray(0, 2).toString()).toBe("PK");
    expect(withImage.length).toBeGreaterThan(withoutImage.length);
  });

  it("falls back to the alt text when the bytes are not to hand", async () => {
    const out = toPlainText([illustrated]);
    expect(out).toContain("[image: the chart]");
  });
});
