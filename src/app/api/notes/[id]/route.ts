import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notes } from "@/db/schema";
import { serializeNote } from "@/lib/serialize";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

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

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const [row] = await db
      .delete(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .returning({ id: notes.id });

    if (!row) return Response.json({ error: "Note not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
