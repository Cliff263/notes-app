import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attachments } from "@/db/schema";
import {
  attachmentKind,
  attachmentMime,
  isInlinePreviewMime,
} from "@/lib/attachments";
import { deleteObject, getObject } from "@/lib/object-storage";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getUserId } from "@/lib/session";
import { resolveShare } from "@/lib/share";

type Params = { params: Promise<{ id: string }> };

/**
 * Serves an attachment's bytes to whoever is entitled to them: its owner, or
 * anyone holding a share link for the note it belongs to. A shared note that
 * embeds an image has to be able to show it, and the token is the only thing a
 * signed-out reader has.
 */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  const search = new URL(request.url).searchParams;
  const token = search.get("token");

  const [row] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  if (!row) return new Response("Not found", { status: 404 });

  const userId = await getUserId();
  let allowed = userId === row.userId;

  if (!allowed && token) {
    // Public reads are throttled; a leaked link should not become a CDN.
    const limit = rateLimit(`attachment:${clientIp(request)}`, LIMITS.share);
    if (!limit.ok) return tooManyRequests(limit);

    const share = await resolveShare(token);
    allowed = share?.note.id === row.noteId;
  }

  if (!allowed) return new Response("Not found", { status: 404 });

  // Older uploads and some browsers report a generic binary MIME. Recover the
  // safe allowlisted type from the extension so the same original file can be
  // rendered without re-uploading it.
  const mime = attachmentMime(row.mime, row.filename);

  if (search.get("meta") === "1") {
    return Response.json({
      id: row.id,
      filename: row.filename,
      mime,
      size: row.size,
      kind: attachmentKind(mime, row.filename),
      previewable: isInlinePreviewMime(mime),
    });
  }

  const data = row.storageKey
    ? await getObject(row.storageKey)
    : row.data;
  if (!data) return new Response("Attachment data is missing", { status: 404 });

  // Only explicitly previewable formats may render in-origin. Everything else
  // remains a download, and nosniff prevents a renamed file becoming active.
  const disposition = search.get("inline") === "1" && isInlinePreviewMime(mime)
    ? `inline; filename="${encodeURIComponent(row.filename)}"`
    : `attachment; filename="${encodeURIComponent(row.filename)}"`;

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(row.size),
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const userId = await getUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const [row] = await db
    .delete(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.userId, userId)))
    .returning({
      storageKey: attachments.storageKey,
    });

  if (!row) {
    return Response.json({ error: "Attachment not found" }, { status: 404 });
  }
  if (row.storageKey) await deleteObject(row.storageKey).catch(console.error);
  return Response.json({ ok: true });
}
