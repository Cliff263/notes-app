import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notes } from "@/db/schema";
import { serializeNote } from "@/lib/serialize";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";

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

    const [row] = await db
      .update(notes)
      .set(patch)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning();

    if (!row) return Response.json({ error: "Note not found" }, { status: 404 });
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
      const [row] = await db
        .delete(notes)
        .where(and(eq(notes.id, id), eq(notes.userId, userId)))
        .returning({ id: notes.id });

      if (!row) return Response.json({ error: "Note not found" }, { status: 404 });
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
