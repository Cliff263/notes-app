import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { noteShares, notes } from "@/db/schema";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";
import { createShareToken, expiryFor, shareUrl } from "@/lib/share";

type Params = { params: Promise<{ id: string }> };

function serialize(row: {
  token: string;
  expiresAt: Date | null;
  createdAt: Date;
  allowEdit: boolean;
}) {
  return {
    url: shareUrl(row.token),
    token: row.token,
    allowEdit: row.allowEdit,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Whether this note is currently shared, and where. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const [row] = await db
      .select()
      .from(noteShares)
      .where(and(eq(noteShares.noteId, id), eq(noteShares.userId, userId)))
      .limit(1);

    return Response.json({ share: row ? serialize(row) : null });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}

/**
 * Publishes the note. Sharing again replaces the link rather than adding a
 * second one, so changing the expiry cannot leave an older, longer-lived link
 * quietly working.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const [note] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);

    if (!note) return Response.json({ error: "Note not found" }, { status: 404 });

    await db
      .delete(noteShares)
      .where(and(eq(noteShares.noteId, id), eq(noteShares.userId, userId)));

    const [row] = await db
      .insert(noteShares)
      .values({
        noteId: id,
        userId,
        token: createShareToken(),
        allowEdit: Boolean(body.allowEdit),
        expiresAt: expiryFor(body.duration),
      })
      .returning();

    return Response.json({ share: serialize(row) }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}

/** Revoking deletes the row, so the link stops working immediately. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    await db
      .delete(noteShares)
      .where(and(eq(noteShares.noteId, id), eq(noteShares.userId, userId)));

    return Response.json({ share: null });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
