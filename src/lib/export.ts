import {
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fitWithin, imageSize } from "./image-size";
import {
  inlineToText,
  parseInline,
  parseMarkdown,
  type Block,
  type Inline,
} from "./markdown";
import type { Note } from "./types";
import { longDateTime, wordCount } from "./utils";

/**
 * Attached images, keyed by the `src` they appear under in the markdown. The
 * route loads them from the database and hands them over; nothing in here
 * reaches out to the network, so an export can never be talked into fetching a
 * URL a note happens to contain.
 */
export type ImageBytes = { data: Buffer; mime: string; width?: number; height?: number };
export type ImageBundle = Map<string, ImageBytes>;

/**
 * An image that is about to be drawn does not also need its alt text written
 * out; one that cannot be embedded keeps it, so a reader still knows it exists.
 */
function stripEmbedded(block: Block, images: ImageBundle): Block {
  if (block.type === "code" || block.type === "rule" || block.type === "table") {
    return block;
  }
  return {
    ...block,
    content: block.content.filter(
      (node) => node.type !== "image" || !images.has(node.src),
    ),
  };
}

function imagesIn(blocks: Block[]) {
  const found: Array<Inline & { type: "image" }> = [];
  for (const block of blocks) {
    if (block.type === "code" || block.type === "rule") continue;
    const content =
      block.type === "table"
        ? [...block.headers, ...block.rows.flat()].flatMap(parseInline)
        : block.content;
    for (const node of content) if (node.type === "image") found.push(node);
  }
  return found;
}

function tableLines(block: Extract<Block, { type: "table" }>) {
  return [
    block.headers.join(" | "),
    ...block.rows.map((row) => row.join(" | ")),
  ];
}

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
      [
        note.title || "Untitled note",
        metaLine(note),
        "",
        // Plain text should not carry markdown markers.
        parseMarkdown(note.content)
          .map((block) => {
            switch (block.type) {
              case "heading":
                return `\n${inlineToText(block.content).toUpperCase()}`;
              case "bullet":
                return `  ${block.ordered ? block.marker : "-"} ${inlineToText(block.content)}`;
              case "task":
                return `  ${block.checked ? "[x]" : "[ ]"} ${inlineToText(block.content)}`;
              case "quote":
                return `  | ${inlineToText(block.content)}`;
              case "code":
                return block.value;
              case "rule":
                return "----------";
              case "table":
                return tableLines(block).join("\n");
              default:
                return inlineToText(block.content);
            }
          })
          .join("\n"),
      ].join("\n"),
    )
    .join("\n\n----------------------------------------\n\n");
}

/** Inline nodes as Word runs, so bold and italic survive the export. */
function inlineRuns(content: Inline[], size = 22) {
  return content.map((node) => {
    switch (node.type) {
      case "bold":
        return new TextRun({ text: node.value, size, bold: true });
      case "italic":
        return new TextRun({ text: node.value, size, italics: true });
      case "code":
        return new TextRun({ text: node.value, size, font: "Consolas" });
      case "link":
        return new TextRun({ text: node.value, size, style: "Hyperlink" });
      default:
        return new TextRun({ text: node.value, size });
    }
  });
}

/** Word can embed these; anything else falls back to its alt text. */
const DOCX_IMAGE_TYPES: Record<string, "png" | "jpg" | "gif"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
};

function imageParagraphs(block: Block, images: ImageBundle) {
  if (block.type === "code" || block.type === "rule" || block.type === "table") {
    return [];
  }

  const paragraphs: Paragraph[] = [];
  for (const node of block.content) {
    if (node.type !== "image") continue;

    const found = images.get(node.src);
    const type = found && DOCX_IMAGE_TYPES[found.mime];
    if (!found || !type) continue;

    const size = imageSize(found.data, found.mime);
    if (!size) continue;

    paragraphs.push(
      new Paragraph({
        children: [
          new ImageRun({
            type,
            data: found.data,
            transformation: fitWithin(size, 460, 620),
          }),
        ],
        spacing: { before: 120, after: 120 },
      }),
    );
  }
  return paragraphs;
}

function blockToParagraph(block: Block) {
  switch (block.type) {
    case "heading":
      return new Paragraph({
        children: inlineRuns(block.content, block.level === 1 ? 32 : 26),
        heading:
          block.level === 1
            ? HeadingLevel.HEADING_2
            : block.level === 2
              ? HeadingLevel.HEADING_3
              : HeadingLevel.HEADING_4,
        spacing: { before: 200, after: 100 },
      });
    case "bullet": {
      // Word owns the bullet glyph; numbered items keep their literal marker.
      const runs = block.ordered
        ? [new TextRun({ text: `${block.marker} `, size: 22 }), ...inlineRuns(block.content)]
        : inlineRuns(block.content);

      return new Paragraph({
        children: runs,
        bullet: block.ordered ? undefined : { level: 0 },
        indent: block.ordered ? { left: 360 } : undefined,
        spacing: { after: 60 },
      });
    }
    case "task":
      // Word is UTF-8, so the checklist keeps its boxes.
      return new Paragraph({
        children: [
          new TextRun({ text: `${block.checked ? "☑" : "☐"}  `, size: 22 }),
          ...inlineRuns(block.content),
        ],
        indent: { left: 360 },
        spacing: { after: 60 },
      });
    case "quote":
      return new Paragraph({
        children: inlineRuns(block.content),
        indent: { left: 360 },
        spacing: { after: 80 },
      });
    case "code":
      return new Paragraph({
        children: [new TextRun({ text: block.value, size: 20, font: "Consolas" })],
        shading: { fill: "F4F4F5" },
        spacing: { after: 120 },
      });
    case "rule":
      return new Paragraph({
        text: "",
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "D4D4D8" } },
      });
    case "table":
      return new Paragraph({
        children: [
          new TextRun({
            text: tableLines(block).join("\n"),
            size: 20,
            font: "Consolas",
          }),
        ],
        spacing: { after: 120 },
      });
    default:
      return new Paragraph({ children: inlineRuns(block.content), spacing: { after: 120 } });
  }
}

export async function toDocx(
  notes: Note[],
  documentTitle: string,
  images: ImageBundle = new Map(),
) {
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
      // Each block, followed by any images it referenced, so a picture lands
      // where it was written rather than at the end of the note.
      ...parseMarkdown(note.content).flatMap((block) => [
        blockToParagraph(stripEmbedded(block, images)),
        ...imageParagraphs(block, images),
      ]),
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

export async function toPdf(notes: Note[], images: ImageBundle = new Map()) {
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

  /** Draws an attached image at its own scale, paging if it will not fit. */
  const drawImage = async (src: string) => {
    const found = images.get(src);
    if (!found) return false;

    const embedded =
      found.mime === "image/png"
        ? await pdf.embedPng(found.data).catch(() => null)
        : found.mime === "image/jpeg"
          ? await pdf.embedJpg(found.data).catch(() => null)
          : null;

    if (!embedded) return false;

    const scale = Math.min(MAX_WIDTH / embedded.width, 1);
    const width = embedded.width * scale;
    const height = embedded.height * scale;

    if (y - height < MARGIN) newPage();
    // Taller than a whole page: shrink to what is left rather than clipping.
    const drawHeight = Math.min(height, PAGE.height - MARGIN * 2);
    const drawWidth = width * (drawHeight / height);

    page.drawImage(embedded, {
      x: MARGIN,
      y: y - drawHeight,
      width: drawWidth,
      height: drawHeight,
    });
    y -= drawHeight + 10;
    return true;
  };

  for (const [index, note] of notes.entries()) {
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

    // Same parsed blocks the preview uses, so the PDF matches what was written.
    for (const original of parseMarkdown(note.content)) {
      const block = stripEmbedded(original, images);

      switch (block.type) {
        case "heading":
          y -= 6;
          draw(inlineToText(block.content), {
            font: bold,
            size: block.level === 1 ? 15 : block.level === 2 ? 13 : 12,
            gap: 6,
          });
          break;
        case "bullet":
          draw(`${block.ordered ? block.marker : "•"}  ${inlineToText(block.content)}`, {
            size: 11,
            gap: 4,
          });
          break;
        case "task":
          // Helvetica is WinAnsi-encoded and cannot draw ☐/☑ at all, so the
          // PDF keeps the markdown's own brackets.
          draw(`${block.checked ? "[x]" : "[ ]"}  ${inlineToText(block.content)}`, {
            size: 11,
            gap: 4,
          });
          break;
        case "quote":
          draw(`“${inlineToText(block.content)}”`, {
            size: 11,
            gap: 5,
            color: rgb(0.35, 0.35, 0.4),
          });
          break;
        case "code":
          draw(block.value, { size: 10, gap: 3, color: rgb(0.25, 0.25, 0.3) });
          break;
        case "rule":
          if (y - 12 > MARGIN) {
            page.drawLine({
              start: { x: MARGIN, y: y - 4 },
              end: { x: PAGE.width - MARGIN, y: y - 4 },
              thickness: 0.6,
              color: rgb(0.88, 0.88, 0.9),
            });
            y -= 14;
          }
          break;
        case "table":
          for (const line of tableLines(block)) {
            draw(line, { size: 10, gap: 4 });
          }
          y -= 4;
          break;
        default:
          draw(inlineToText(block.content), { size: 11, gap: 5 });
          y -= 4;
      }

      // Whatever the block was, any image it referenced follows it.
      for (const node of imagesIn([original])) await drawImage(node.src);
    }
  }

  return Buffer.from(await pdf.save());
}

export async function buildExport(
  notes: Note[],
  format: string,
  documentTitle: string,
  images: ImageBundle = new Map(),
): Promise<{ body: Buffer | string; mime: string }> {
  switch (format) {
    case "pdf":
      return { body: await toPdf(notes, images), mime: EXPORT_MIME.pdf };
    case "docx":
      return { body: await toDocx(notes, documentTitle, images), mime: EXPORT_MIME.docx };
    case "txt":
      return { body: toPlainText(notes), mime: EXPORT_MIME.txt };
    default:
      return { body: toMarkdown(notes), mime: EXPORT_MIME.md };
  }
}
