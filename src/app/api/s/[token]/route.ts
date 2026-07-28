import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events, notes } from "@/db/schema";
import {
  linkedEventDescription,
  linkedEventTitle,
} from "@/lib/note-event-sync";
import { clientIp, LIMITS, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { resolveShare } from "@/lib/share";
import { recordVersion } from "@/lib/versions";

type Params = { params: Promise<{ token: string }> };

/**
 * The one thing a guest can write.
 *
 * A share link created with editing enabled is a capability to change that
 * note's title and body — nothing else, and nothing about any other note. The
 * token stands in for a session, so this is rate limited like every other
 * public read.
 *
 * Live co-editing happens peer to peer; this is what makes it durable, and what
 * keeps a guest's edits from being lost when the peer connection cannot be
 * established at all.
 */
export async function PATCH(request: Request, { params }: Params) {
  const { token } = await params;

  const limit = rateLimit(`share-write:${clientIp(request)}`, LIMITS.share);
  if (!limit.ok) return tooManyRequests(limit);

  const found = await resolveShare(token);
  if (!found) return Response.json({ error: "This link is not valid" }, { status: 404 });

  if (!found.share.allowEdit) {
    return Response.json({ error: "This note is shared read-only" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const patch: { title?: string; content?: string; updatedAt: Date } = {
    updatedAt: new Date(),
  };

  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.content === "string") patch.content = body.content;

  if (patch.title === undefined && patch.content === undefined) {
    return Response.json({ error: "Nothing to change" }, { status: 400 });
  }

  const [row] = await db
    .update(notes)
    .set(patch)
    .where(and(eq(notes.id, found.note.id), eq(notes.userId, found.note.userId)))
    .returning();

  if (!row) return Response.json({ error: "Note not found" }, { status: 404 });

  const eventPatch: { title?: string; description?: string } = {};
  if (patch.title !== undefined) eventPatch.title = linkedEventTitle(row.title);
  if (patch.content !== undefined) {
    eventPatch.description = linkedEventDescription(row.content);
  }
  await db
    .update(events)
    .set(eventPatch)
    .where(and(eq(events.noteId, row.id), eq(events.userId, row.userId)));

  // A guest's edits go into the owner's history like anyone else's, so an
  // unwelcome change can be found and undone.
  try {
    await recordVersion(found.note, { title: row.title, content: row.content });
  } catch (error) {
    console.error("Could not record a version for a shared edit", error);
  }

  return Response.json({ ok: true, updatedAt: row.updatedAt.toISOString() });
}
