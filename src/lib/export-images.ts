import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { attachments } from "@/db/schema";
import { attachmentIdFrom, attachmentSrc, isImageMime } from "./attachments";
import type { ImageBundle } from "./export";
import { parseInline, parseMarkdown } from "./markdown";
import type { Note } from "./types";

/**
 * Loads the bytes of every attached image a set of notes refers to, so an
 * export can embed pictures without any of the export code touching the
 * database — or the network. Only `/api/attachments/…` sources are resolved:
 * an arbitrary URL in a note is left as its alt text rather than fetched.
 */
export async function loadExportImages(
  notes: Note[],
  userId: string,
): Promise<ImageBundle> {
  const ids = new Set<string>();

  for (const note of notes) {
    for (const block of parseMarkdown(note.content)) {
      if (block.type === "code" || block.type === "rule") continue;
      const content =
        block.type === "table"
          ? [...block.headers, ...block.rows.flat()].flatMap(parseInline)
          : block.content;
      for (const node of content) {
        if (node.type !== "image") continue;
        const id = attachmentIdFrom(node.src);
        if (id) ids.add(id);
      }
    }
  }

  const bundle: ImageBundle = new Map();
  if (!ids.size) return bundle;

  const rows = await db
    .select({
      id: attachments.id,
      mime: attachments.mime,
      data: attachments.data,
    })
    .from(attachments)
    .where(and(eq(attachments.userId, userId), inArray(attachments.id, [...ids])));

  for (const row of rows) {
    if (isImageMime(row.mime)) {
      bundle.set(attachmentSrc(row.id), { data: row.data, mime: row.mime });
    }
  }

  return bundle;
}
