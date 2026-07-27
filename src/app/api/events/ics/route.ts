import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { toIcs } from "@/lib/ics";
import { normaliseRecurrence } from "@/lib/recurrence";
import { serializeEvent } from "@/lib/serialize";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";
import { parseIcs } from "@/lib/ics";

/** The whole calendar as an .ics file, repeats included as RRULEs. */
export async function GET() {
  try {
    const userId = await requireUserId();

    const rows = await db
      .select()
      .from(events)
      .where(eq(events.userId, userId))
      .orderBy(asc(events.startsAt));

    const stamp = new Date().toISOString().slice(0, 10);

    return new Response(toIcs(rows.map(serializeEvent)), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="nexora-${stamp}.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}

/** How many events one upload may add. */
const MAX_IMPORT = 500;

/**
 * Imports an .ics. Everything in the file is added; nothing existing is touched,
 * because matching on UID would mean trusting another calendar's idea of
 * identity, and a duplicate is easier to delete than a lost event is to recover.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId();

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    const text =
      file instanceof File ? await file.text() : typeof file === "string" ? file : null;

    if (!text) return Response.json({ error: "No calendar was uploaded" }, { status: 400 });

    const parsed = parseIcs(text);
    if (!parsed.length) {
      return Response.json(
        { error: "No events were found in that file" },
        { status: 422 },
      );
    }

    const rows = parsed.slice(0, MAX_IMPORT).map((event) => ({
      userId,
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: new Date(event.startsAt),
      endsAt: new Date(event.endsAt),
      allDay: event.allDay,
      color: event.color,
      recurrence: normaliseRecurrence(event.recurrence),
    }));

    const inserted = await db.insert(events).values(rows).returning();

    return Response.json({
      imported: inserted.length,
      skipped: Math.max(parsed.length - inserted.length, 0),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
