import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attachments, events, notes } from "@/db/schema";
import {
  linkedEventDescription,
  linkedEventTitle,
  moveLinkedEvent,
} from "@/lib/note-event-sync";
import { serializeNote } from "@/lib/serialize";
import { deleteObjects } from "@/lib/object-storage";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";
import { recordVersion } from "@/lib/versions";

type Params = { params: Promise<{ id: string }> };

/** A single note, for when the open one isn't inside the loaded page. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const [row] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);

    if (!row) return Response.json({ error: "Note not found" }, { status: 404 });
    return Response.json(serializeNote(row));
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.title === "string") patch.title = body.title;
    if (typeof body.content === "string") patch.content = body.content;
    if (typeof body.category === "string") patch.category = body.category;
    if (Array.isArray(body.tags)) patch.tags = body.tags.map(String);
    if (typeof body.pinned === "boolean") patch.pinned = body.pinned;
    if (typeof body.favorite === "boolean") patch.favorite = body.favorite;
    if (typeof body.archived === "boolean") patch.archived = body.archived;

    // null restores from the trash; a string would be a client-set timestamp.
    if (body.deletedAt === null) patch.deletedAt = null;
    if (body.dueAt === null) patch.dueAt = null;
    else if (typeof body.dueAt === "string") {
      const due = new Date(body.dueAt);
      if (Number.isNaN(due.getTime())) {
        return Response.json({ error: "Invalid dueAt" }, { status: 400 });
      }
      patch.dueAt = due;
    }

    // Read before writing, so there is something to snapshot.
    const [before] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);

    if (!before) return Response.json({ error: "Note not found" }, { status: 404 });

    const [row] = await db
      .update(notes)
      .set(patch)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();

    if (!row) return Response.json({ error: "Note not found" }, { status: 404 });

    /*
     * A linked calendar event is a projection of the note, so note-owned
     * fields follow their source. Calendar-owned fields (location, colour,
     * recurrence and the event's duration) remain editable on the event.
     *
     * Moving a due date preserves each linked event's duration. Clearing a due
     * date only removes the note from "Notes due"; it does not silently delete
     * or unschedule an event the user explicitly added to their calendar.
     */
    const eventPatch: Record<string, unknown> = {};
    if (typeof body.title === "string") {
      eventPatch.title = linkedEventTitle(row.title);
    }
    if (typeof body.content === "string") {
      eventPatch.description = linkedEventDescription(row.content);
    }

    if (Object.keys(eventPatch).length > 0) {
      await db
        .update(events)
        .set(eventPatch)
        .where(and(eq(events.noteId, id), eq(events.userId, userId)));
    }

    if (body.dueAt !== undefined && row.dueAt) {
      const linked = await db
        .select({
          id: events.id,
          startsAt: events.startsAt,
          endsAt: events.endsAt,
        })
        .from(events)
        .where(and(eq(events.noteId, id), eq(events.userId, userId)));

      await Promise.all(
        linked.map((event) =>
          db
            .update(events)
            .set(moveLinkedEvent(event, row.dueAt!))
            .where(and(eq(events.id, event.id), eq(events.userId, userId))),
        ),
      );
    }

    // History is a nicety: losing a snapshot must never lose the edit.
    try {
      await recordVersion(before, { title: row.title, content: row.content });
    } catch (error) {
      console.error("Could not record a version for note", id, error);
    }

    return Response.json(serializeNote(row));
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}

/**
 * Deleting moves a note to the trash. `?permanent=true` is the only way to
 * remove a row for good, which is what "Empty trash" and "Delete forever" use.
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const permanent = new URL(request.url).searchParams.get("permanent") === "true";

    if (permanent) {
      const stored = await db
        .select({ storageKey: attachments.storageKey })
        .from(attachments)
        .where(
          and(eq(attachments.noteId, id), eq(attachments.userId, userId)),
        );
      const [row] = await db
        .delete(notes)
        .where(and(eq(notes.id, id), eq(notes.userId, userId)))
        .returning({ id: notes.id });

      if (!row) return Response.json({ error: "Note not found" }, { status: 404 });
      await deleteObjects(stored.map((item) => item.storageKey));
      return Response.json({ ok: true, permanent: true });
    }

    const [row] = await db
      .update(notes)
      .set({ deletedAt: new Date() })
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();

    if (!row) return Response.json({ error: "Note not found" }, { status: 404 });
    return Response.json(serializeNote(row));
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
