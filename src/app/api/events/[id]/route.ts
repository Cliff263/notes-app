import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { serializeEvent } from "@/lib/serialize";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const patch: Record<string, unknown> = {};
    if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
    if (typeof body.description === "string") patch.description = body.description;
    if (typeof body.location === "string") patch.location = body.location;
    if (typeof body.color === "string") patch.color = body.color;
    if (typeof body.allDay === "boolean") patch.allDay = body.allDay;

    for (const key of ["startsAt", "endsAt"] as const) {
      if (body[key]) {
        const date = new Date(body[key]);
        if (Number.isNaN(date.getTime())) {
          return Response.json({ error: `Invalid ${key}` }, { status: 400 });
        }
        patch[key] = date;
      }
    }

    const [row] = await db
      .update(events)
      .set(patch)
      .where(and(eq(events.id, id), eq(events.userId, userId)))
      .returning();

    if (!row) return Response.json({ error: "Event not found" }, { status: 404 });
    return Response.json(serializeEvent(row));
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
      .delete(events)
      .where(and(eq(events.id, id), eq(events.userId, userId)))
      .returning({ id: events.id });

    if (!row) return Response.json({ error: "Event not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
