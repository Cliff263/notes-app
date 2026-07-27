import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attachments } from "@/db/schema";
import { isImageMime } from "@/lib/attachments";
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
  const token = new URL(request.url).searchParams.get("token");

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

  /*
   * Everything is served as an attachment unless it is an image, so a file
   * uploaded as text/html-adjacent content can never be rendered as a page in
   * this origin. Images are the only thing that needs to display inline.
   */
  const disposition = isImageMime(row.mime)
    ? `inline; filename="${encodeURIComponent(row.filename)}"`
    : `attachment; filename="${encodeURIComponent(row.filename)}"`;

  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(row.size),
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
