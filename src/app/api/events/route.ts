import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { serializeEvent } from "@/lib/serialize";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";

export async function GET() {
  try {
    const userId = await requireUserId();
    const rows = await db
      .select()
      .from(events)
      .where(eq(events.userId, userId))
      .orderBy(asc(events.startsAt));

    return Response.json(rows.map(serializeEvent));
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json().catch(() => ({}));

    const startsAt = new Date(body.startsAt ?? Date.now());
    const endsAt = new Date(body.endsAt ?? startsAt.getTime() + 3_600_000);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return Response.json({ error: "Invalid event dates" }, { status: 400 });
    }

    const title = String(body.title ?? "").trim();
    if (!title) return Response.json({ error: "Title is required" }, { status: 400 });

    const [row] = await db
      .insert(events)
      .values({
        userId,
        title,
        description: typeof body.description === "string" ? body.description : "",
        location: typeof body.location === "string" ? body.location : "",
        startsAt,
        endsAt,
        allDay: Boolean(body.allDay),
        color: typeof body.color === "string" ? body.color : "violet",
        noteId: typeof body.noteId === "string" ? body.noteId : null,
      })
      .returning();

    return Response.json(serializeEvent(row), { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
