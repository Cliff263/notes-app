import { and, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { notes } from "@/db/schema";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

const LIMIT = 20;

/** `%`, `_` and `\` are wildcards to LIKE; a note title is not. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/**
 * Which notes point at this one. Links are written by title rather than by id,
 * so this is a reverse lookup for `[[This note's title]]` — matched
 * case-insensitively, and tolerant of an alias (`[[Title|as this]]`).
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;

    const [note] = await db
      .select({ title: notes.title })
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId)))
      .limit(1);

    if (!note) return Response.json({ error: "Note not found" }, { status: 404 });
    if (!note.title.trim()) return Response.json({ backlinks: [] });

    const target = escapeLike(note.title.trim());

    const rows = await db
      .select({ id: notes.id, title: notes.title, archived: notes.archived })
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          isNull(notes.deletedAt),
          ne(notes.id, id),
          or(
            sql`${notes.content} ilike ${`%[[${target}]]%`} escape '\\'`,
            sql`${notes.content} ilike ${`%[[${target}|%`} escape '\\'`,
          )!,
        ),
      )
      .orderBy(desc(notes.updatedAt))
      .limit(LIMIT);

    return Response.json({ backlinks: rows });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
