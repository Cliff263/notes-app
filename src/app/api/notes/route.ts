import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notes } from "@/db/schema";
import { serializeNote } from "@/lib/serialize";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";

export async function GET() {
  try {
    const userId = await requireUserId();
    const rows = await db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.updatedAt));

    return Response.json(rows.map(serializeNote));
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
