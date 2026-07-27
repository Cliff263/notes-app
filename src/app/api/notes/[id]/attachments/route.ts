import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attachments, notes } from "@/db/schema";
import {
  isAllowedMime,
  MAX_ATTACHMENT_BYTES,
  formatBytes,
} from "@/lib/attachments";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

/** Uploads one file and attaches it to the note. */
export async function POST(request: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const [note] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);

    if (!note) return Response.json({ error: "Note not found" }, { status: 404 });

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "No file was uploaded" }, { status: 400 });
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      return Response.json(
        { error: `Files are limited to ${formatBytes(MAX_ATTACHMENT_BYTES)}` },
        { status: 413 },
      );
    }

    const mime = file.type || "application/octet-stream";
    if (!isAllowedMime(mime)) {
      return Response.json(
        { error: `${mime} files cannot be attached` },
        { status: 415 },
      );
    }

    const data = Buffer.from(await file.arrayBuffer());

    // The browser reports a size; the bytes are what actually arrived.
    if (data.byteLength > MAX_ATTACHMENT_BYTES) {
      return Response.json(
        { error: `Files are limited to ${formatBytes(MAX_ATTACHMENT_BYTES)}` },
        { status: 413 },
      );
    }

    const [row] = await db
      .insert(attachments)
      .values({
        noteId: id,
        userId,
        filename: file.name || "attachment",
        mime,
        size: data.byteLength,
        data,
      })
      .returning({
        id: attachments.id,
        filename: attachments.filename,
        mime: attachments.mime,
        size: attachments.size,
      });

    return Response.json(row, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}

/** What is attached to this note, without the bytes. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const rows = await db
      .select({
        id: attachments.id,
        filename: attachments.filename,
        mime: attachments.mime,
        size: attachments.size,
      })
      .from(attachments)
      .where(and(eq(attachments.noteId, id), eq(attachments.userId, userId)));

    return Response.json({ attachments: rows });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
