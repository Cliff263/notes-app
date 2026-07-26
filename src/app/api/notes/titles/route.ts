import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { notes } from "@/db/schema";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";

/** Enough to resolve every `[[link]]` in a workspace without paging. */
const LIMIT = 500;

/**
 * Two columns for every live note, which is what turns `[[Another note]]` into
 * a link. Deliberately not the note list: this is small enough to hold in the
 * client for minutes at a time, and it powers the `[[` completion menu too.
 */
export async function GET() {
  try {
    const userId = await requireUserId();

    const rows = await db
      .select({ id: notes.id, title: notes.title })
      .from(notes)
      .where(and(eq(notes.userId, userId), isNull(notes.deletedAt)))
      .orderBy(desc(notes.updatedAt))
      .limit(LIMIT);

    return Response.json({ titles: rows });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
