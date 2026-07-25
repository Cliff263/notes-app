import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Note } from "./types";
import { longDateTime, wordCount } from "./utils";

export const EXPORT_MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};

/** A filename-safe version of a note title. */
export function slugify(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return slug || "note";
}

function metaLine(note: Note) {
  const tags = note.tags.length ? ` · ${note.tags.map((tag) => `#${tag}`).join(" ")}` : "";
  return `${note.category} · Updated ${longDateTime(note.updatedAt)} · ${wordCount(
    note.content,
  )} words${tags}`;
}

export function toMarkdown(notes: Note[]) {
  return notes
    .map((note) => {
      const tags = note.tags.map((tag) => `#${tag}`).join(" ");
      const front = [
        `# ${note.title || "Untitled note"}`,
        "",
        `**Category:** ${note.category}  `,
        `**Updated:** ${longDateTime(note.updatedAt)}  `,
        tags ? `**Tags:** ${tags}  ` : null,
        "",
        note.content,
      ]
        .filter((line) => line !== null)
        .join("\n");
      return front;
    })
    .join("\n\n---\n\n");
}

export function toPlainText(notes: Note[]) {
  return notes
    .map((note) =>
      [note.title || "Untitled note", metaLine(note), "", note.content].join("\n"),
    )
    .join("\n\n----------------------------------------\n\n");
}

export async function toDocx(notes: Note[], documentTitle: string) {
  const children = notes.flatMap((note, index) => {
    const blocks = [
      new Paragraph({
        text: note.title || "Untitled note",
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [new TextRun({ text: metaLine(note), size: 18, color: "6B6B76" })],
        spacing: { after: 240 },
      }),
      ...note.content.split("\n").map(
        (line) =>
          new Paragraph({
            children: [new TextRun({ text: line, size: 22 })],
            spacing: { after: 80 },
          }),
      ),
    ];

    // Page break between notes in a bulk export.
    if (index < notes.length - 1) {
      blocks.push(new Paragraph({ children: [], pageBreakBefore: true }));
    }
    return blocks;
  });

  const doc = new Document({
    title: documentTitle,
    sections: [{ properties: {}, children }],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export async function toPdf(notes: Note[]) {
  const pdf = await PDFDocument.create();
  const body = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PAGE = { width: 595.28, height: 841.89 };
  const MARGIN = 56;
  const MAX_WIDTH = PAGE.width - MARGIN * 2;

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const newPage = () => {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  };

  /** Greedy word wrap against the embedded font's metrics. */
  const wrap = (text: string, font: typeof body, size: number) => {
    const lines: string[] = [];
    for (const paragraph of text.split("\n")) {
      if (!paragraph.trim()) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) > MAX_WIDTH && line) {
          lines.push(line);
          line = word;
        } else {
          line = candidate;
        }
      }
      lines.push(line);
    }
    return lines;
  };

  const draw = (
    text: string,
    { font = body, size = 11, gap = 4, color = rgb(0.1, 0.1, 0.12) } = {},
  ) => {
    for (const line of wrap(text, font, size)) {
      if (y - size < MARGIN) newPage();
      if (line) {
        page.drawText(line, { x: MARGIN, y: y - size, size, font, color });
      }
      y -= size + gap;
    }
  };

  notes.forEach((note, index) => {
    if (index > 0) newPage();

    draw(note.title || "Untitled note", { font: bold, size: 20, gap: 8 });
    draw(metaLine(note), { size: 9, gap: 10, color: rgb(0.45, 0.45, 0.48) });

    // A rule under the header, matching the app's divider.
    if (y - 12 > MARGIN) {
      page.drawLine({
        start: { x: MARGIN, y: y - 2 },
        end: { x: PAGE.width - MARGIN, y: y - 2 },
        thickness: 0.7,
        color: rgb(0.85, 0.85, 0.87),
      });
      y -= 18;
    }

    draw(note.content, { size: 11, gap: 5 });
  });

  return Buffer.from(await pdf.save());
}

export async function buildExport(
  notes: Note[],
  format: string,
  documentTitle: string,
): Promise<{ body: Buffer | string; mime: string }> {
  switch (format) {
    case "pdf":
      return { body: await toPdf(notes), mime: EXPORT_MIME.pdf };
    case "docx":
      return { body: await toDocx(notes, documentTitle), mime: EXPORT_MIME.docx };
    case "txt":
      return { body: toPlainText(notes), mime: EXPORT_MIME.txt };
    default:
      return { body: toMarkdown(notes), mime: EXPORT_MIME.md };
  }
}
