import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { notes } from "@/db/schema";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";

/**
 * Counts and the tag cloud for the whole workspace.
 *
 * The note list is paginated, so the sidebar can no longer derive these by
 * counting what happens to be loaded — they are aggregated in SQL instead and
 * stay correct however little of the list is on screen.
 */
export async function GET() {
  try {
    const userId = await requireUserId();

    const [counts] = await db
      .select({
        total: sql<number>`count(*) filter (where ${notes.deletedAt} is null and ${notes.archived} = false)`,
        favorites: sql<number>`count(*) filter (where ${notes.deletedAt} is null and ${notes.archived} = false and ${notes.favorite})`,
        pinned: sql<number>`count(*) filter (where ${notes.deletedAt} is null and ${notes.archived} = false and ${notes.pinned})`,
        archived: sql<number>`count(*) filter (where ${notes.deletedAt} is null and ${notes.archived})`,
        trashed: sql<number>`count(*) filter (where ${notes.deletedAt} is not null)`,
        words: sql<number>`coalesce(sum(coalesce(array_length(regexp_split_to_array(nullif(trim(${notes.content}), ''), '\\s+'), 1), 0)) filter (where ${notes.deletedAt} is null and ${notes.archived} = false), 0)`,
      })
      .from(notes)
      .where(eq(notes.userId, userId));

    const categories = await db
      .select({ category: notes.category, count: sql<number>`count(*)` })
      .from(notes)
      .where(
        sql`${notes.userId} = ${userId} and ${notes.deletedAt} is null and ${notes.archived} = false`,
      )
      .groupBy(notes.category);

    // One row per tag, with a few example titles for the tags page.
    const tags = await db.execute<{
      tag: string;
      count: number;
      titles: string[];
    }>(sql`
      select tag,
             count(*)::int as count,
             (array_agg(title order by "updatedAt" desc))[1:3] as titles
      from ${notes}, unnest(${notes.tags}) as tag
      where ${notes.userId} = ${userId}
        and ${notes.deletedAt} is null
        and ${notes.archived} = false
      group by tag
      order by count desc, tag asc
    `);

    return Response.json({
      counts: {
        total: Number(counts?.total ?? 0),
        favorites: Number(counts?.favorites ?? 0),
        pinned: Number(counts?.pinned ?? 0),
        archived: Number(counts?.archived ?? 0),
        trashed: Number(counts?.trashed ?? 0),
        words: Number(counts?.words ?? 0),
      },
      categories: Object.fromEntries(
        categories.map((row) => [row.category, Number(row.count)]),
      ),
      // The Neon and node-postgres drivers disagree on the result shape.
      tags: (Array.isArray(tags) ? tags : (tags.rows ?? [])).map((row) => ({
        tag: row.tag,
        count: Number(row.count),
        titles: row.titles ?? [],
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
