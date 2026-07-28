import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { attachments, notes } from "@/db/schema";
import { deleteObjects } from "@/lib/object-storage";
import { serializeNote } from "@/lib/serialize";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";

const ACTIONS = [
  "archive",
  "unarchive",
  "favorite",
  "unfavorite",
  "pin",
  "unpin",
  "trash",
  "restore",
  "purge",
  "emptyTrash",
] as const;

type Action = (typeof ACTIONS)[number];

/**
 * One request for an action across a selection. Every statement is scoped to
 * the session user, so a forged id can never touch someone else's row.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json().catch(() => ({}));

    const action = body.action as Action;
    if (!ACTIONS.includes(action)) {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }

    if (action === "emptyTrash") {
      const doomed = await db
        .select({ id: notes.id })
        .from(notes)
        .where(and(eq(notes.userId, userId), isNotNull(notes.deletedAt)));
      const doomedIds = doomed.map((note) => note.id);
      const stored = doomedIds.length
        ? await db
            .select({ storageKey: attachments.storageKey })
            .from(attachments)
            .where(
              and(
                eq(attachments.userId, userId),
                inArray(attachments.noteId, doomedIds),
              ),
            )
        : [];
      const removed = await db
        .delete(notes)
        .where(and(eq(notes.userId, userId), isNotNull(notes.deletedAt)))
        .returning({ id: notes.id });

      await deleteObjects(stored.map((item) => item.storageKey));
      return Response.json({ ok: true, removed: removed.map((row) => row.id) });
    }

    const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String) : [];
    if (ids.length === 0) {
      return Response.json({ error: "No notes selected" }, { status: 400 });
    }

    const scope = and(eq(notes.userId, userId), inArray(notes.id, ids));

    if (action === "purge") {
      const stored = await db
        .select({ storageKey: attachments.storageKey })
        .from(attachments)
        .where(
          and(
            eq(attachments.userId, userId),
            inArray(attachments.noteId, ids),
          ),
        );
      const removed = await db.delete(notes).where(scope).returning({ id: notes.id });
      await deleteObjects(stored.map((item) => item.storageKey));
      return Response.json({ ok: true, removed: removed.map((row) => row.id) });
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    switch (action) {
      case "archive":
        patch.archived = true;
        break;
      case "unarchive":
        patch.archived = false;
        break;
      case "favorite":
        patch.favorite = true;
        break;
      case "unfavorite":
        patch.favorite = false;
        break;
      case "pin":
        patch.pinned = true;
        break;
      case "unpin":
        patch.pinned = false;
        break;
      case "trash":
        patch.deletedAt = new Date();
        break;
      case "restore":
        patch.deletedAt = null;
        break;
    }

    const updated = await db.update(notes).set(patch).where(scope).returning();
    return Response.json(updated.map((row) => serializeNote(row)));
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
