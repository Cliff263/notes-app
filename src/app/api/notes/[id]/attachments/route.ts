import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attachments, notes } from "@/db/schema";
import {
  isAllowedMime,
  attachmentMime,
  MAX_ATTACHMENT_BYTES,
  MAX_DATABASE_ATTACHMENT_BYTES,
  formatBytes,
} from "@/lib/attachments";
import {
  attachmentObjectKey,
  deleteObject,
  isR2Configured,
  presignedPutUrl,
  putObject,
} from "@/lib/object-storage";
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

    if (request.headers.get("content-type")?.includes("application/json")) {
      if (!isR2Configured) return Response.json({ direct: false });
      const body = await request.json().catch(() => ({}));
      const filename = String(body.filename ?? "attachment").slice(0, 255);
      const mime = String(body.mime ?? "");
      const size = Number(body.size);

      if (!isAllowedMime(mime)) {
        return Response.json(
          { error: `${mime || "Unknown"} files cannot be attached` },
          { status: 415 },
        );
      }
      if (!Number.isFinite(size) || size <= 0 || size > MAX_ATTACHMENT_BYTES) {
        return Response.json(
          { error: `Files are limited to ${formatBytes(MAX_ATTACHMENT_BYTES)}` },
          { status: 413 },
        );
      }

      const storageKey = attachmentObjectKey(userId, id);
      const uploadUrl = await presignedPutUrl(storageKey, mime);
      const [row] = await db
        .insert(attachments)
        .values({
          noteId: id,
          userId,
          filename,
          mime,
          size,
          storageKey,
          data: null,
        })
        .returning({
          id: attachments.id,
          filename: attachments.filename,
          mime: attachments.mime,
          size: attachments.size,
        });

      return Response.json({
        direct: true,
        attachment: row,
        uploadUrl,
      });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "No file was uploaded" }, { status: 400 });
    }

    const activeLimit = isR2Configured
      ? MAX_ATTACHMENT_BYTES
      : MAX_DATABASE_ATTACHMENT_BYTES;
    if (file.size > activeLimit) {
      return Response.json(
        {
          error: isR2Configured
            ? `Files are limited to ${formatBytes(activeLimit)}`
            : `Database-backed files are limited to ${formatBytes(activeLimit)}; configure R2 for larger uploads`,
        },
        { status: 413 },
      );
    }

    const mime = attachmentMime(
      file.type || "application/octet-stream",
      file.name,
    );
    if (!isAllowedMime(mime)) {
      return Response.json(
        { error: `${mime} files cannot be attached` },
        { status: 415 },
      );
    }

    const data = Buffer.from(await file.arrayBuffer());

    // The browser reports a size; the bytes are what actually arrived.
    if (data.byteLength > activeLimit) {
      return Response.json(
        {
          error: isR2Configured
            ? `Files are limited to ${formatBytes(activeLimit)}`
            : `Database-backed files are limited to ${formatBytes(activeLimit)}; configure R2 for larger uploads`,
        },
        { status: 413 },
      );
    }

    const storageKey = isR2Configured
      ? attachmentObjectKey(userId, id)
      : null;
    if (storageKey) await putObject(storageKey, data, mime);

    let row;
    try {
      [row] = await db
        .insert(attachments)
        .values({
          noteId: id,
          userId,
          filename: file.name || "attachment",
          mime,
          size: data.byteLength,
          storageKey,
          data: storageKey ? null : data,
        })
        .returning({
          id: attachments.id,
          filename: attachments.filename,
          mime: attachments.mime,
          size: attachments.size,
        });
    } catch (error) {
      if (storageKey) await deleteObject(storageKey).catch(() => {});
      throw error;
    }

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
