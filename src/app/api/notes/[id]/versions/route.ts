import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { noteVersions, notes } from "@/db/schema";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";
import { VERSION_LIMIT } from "@/lib/versions";

type Params = { params: Promise<{ id: string }> };

/**
 * Every kept snapshot of a note, newest first, with the note's current state at
 * the head of the list so the editor can diff any version against "now" without
 * a second request.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const [note] = await db
      .select({
        title: notes.title,
        content: notes.content,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);

    if (!note) return Response.json({ error: "Note not found" }, { status: 404 });

    const rows = await db
      .select({
        id: noteVersions.id,
        title: noteVersions.title,
        content: noteVersions.content,
        createdAt: noteVersions.createdAt,
      })
      .from(noteVersions)
      .where(and(eq(noteVersions.noteId, id), eq(noteVersions.userId, userId)))
      .orderBy(desc(noteVersions.createdAt))
      .limit(VERSION_LIMIT);

    return Response.json({
      current: {
        title: note.title,
        content: note.content,
        updatedAt: note.updatedAt.toISOString(),
      },
      versions: rows.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
