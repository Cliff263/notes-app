import { and, arrayContains, desc, eq, ilike, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { notes } from "@/db/schema";
import { serializeNote } from "@/lib/serialize";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";
import type { SortKey } from "@/lib/types";

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;

/**
 * Filtering and ordering happen in SQL so a page is a page: without that, a
 * filtered view would only ever show the matches that happened to fall inside
 * the first slice.
 */
function filterCondition(userId: string, kind: string, value: string | null) {
  const mine = eq(notes.userId, userId);
  const live = isNull(notes.deletedAt);

  switch (kind) {
    case "favorites":
      return and(mine, live, eq(notes.favorite, true), eq(notes.archived, false));
    case "pinned":
      return and(mine, live, eq(notes.pinned, true), eq(notes.archived, false));
    case "archive":
      return and(mine, live, eq(notes.archived, true));
    case "trash":
      return and(mine, isNotNull(notes.deletedAt));
    case "due":
      return and(mine, live, eq(notes.archived, false), isNotNull(notes.dueAt));
    case "category":
      return and(mine, live, eq(notes.archived, false), eq(notes.category, value ?? ""));
    case "tag":
      return and(mine, live, eq(notes.archived, false), arrayContains(notes.tags, [value ?? ""]));
    default:
      return and(mine, live, eq(notes.archived, false));
  }
}

export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const params = new URL(request.url).searchParams;

    const kind = params.get("filter") ?? "all";
    const value = params.get("value");
    const search = (params.get("q") ?? "").trim();
    const sort = (params.get("sort") ?? "updated") as SortKey;
    const limit = Math.min(
      Math.max(Number(params.get("limit")) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const cursor = params.get("cursor");

    const conditions = [filterCondition(userId, kind, value)];

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          ilike(notes.title, pattern),
          ilike(notes.content, pattern),
          sql`array_to_string(${notes.tags}, ' ') ilike ${pattern}`,
        )!,
      );
    }

    /*
     * Pinned notes float to the top of every view except the trash, and the id
     * breaks ties so the order is total — which is what makes the cursor safe.
     */
    const pinnedFirst = kind !== "trash";
    const orderBy =
      kind === "due"
        ? [sql`${notes.dueAt} asc`, desc(notes.id)]
        : sort === "created"
        ? [desc(notes.createdAt), desc(notes.id)]
        : sort === "title"
          ? [sql`lower(${notes.title})`, desc(notes.id)]
          : sort === "length"
            ? [desc(sql`length(${notes.content})`), desc(notes.id)]
            : [desc(notes.updatedAt), desc(notes.id)];

    // Keyset paging for the time-ordered views; the others fall back to an
    // offset, which is honest at this scale and keeps the cursor simple.
    const timeOrdered = sort === "updated" || sort === "created";
    let offset = 0;

    if (cursor) {
      if (timeOrdered) {
        const [stamp, id] = Buffer.from(cursor, "base64url").toString().split("|");
        const column = sort === "created" ? notes.createdAt : notes.updatedAt;
        conditions.push(
          or(lt(column, new Date(stamp)), and(eq(column, new Date(stamp)), lt(notes.id, id)))!,
        );
      } else {
        offset = Number(Buffer.from(cursor, "base64url").toString()) || 0;
      }
    }

    const rows = await db
      .select()
      .from(notes)
      .where(and(...conditions))
      .orderBy(...(pinnedFirst ? [desc(notes.pinned), ...orderBy] : orderBy))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);

    const nextCursor =
      hasMore && last
        ? timeOrdered
          ? Buffer.from(
              `${(sort === "created" ? last.createdAt : last.updatedAt).toISOString()}|${last.id}`,
            ).toString("base64url")
          : Buffer.from(String(offset + limit)).toString("base64url")
        : null;

    return Response.json({ notes: page.map(serializeNote), nextCursor });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json().catch(() => ({}));

    const [row] = await db
      .insert(notes)
      .values({
        userId,
        title: typeof body.title === "string" ? body.title : "Untitled note",
        content: typeof body.content === "string" ? body.content : "",
        category: typeof body.category === "string" ? body.category : "Personal",
        tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
        pinned: Boolean(body.pinned),
        favorite: Boolean(body.favorite),
        archived: Boolean(body.archived),
      })
      .returning();

    return Response.json(serializeNote(row), { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
