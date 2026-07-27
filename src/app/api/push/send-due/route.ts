import { and, eq, gte, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { events, notes, pushSubscriptions } from "@/db/schema";
import {
  eventReminder,
  noteDueReminder,
  pushConfigured,
  sendToUser,
} from "@/lib/push";
import { expandEvent } from "@/lib/recurrence";
import { serializeEvent } from "@/lib/serialize";

/** How far ahead to look, matching how often this is expected to run. */
const DEFAULT_WINDOW_MINUTES = 30;

/**
 * Sends the reminders that are due right now: events about to start, and notes
 * dated today. Meant to be called on a schedule — `vercel.json` sets one up —
 * and guarded by a shared secret rather than a session, because no user is
 * signed in when a cron fires.
 *
 * There is no per-event record of what has already been sent; instead each
 * notification carries a `tag`, which is how the browser collapses a repeat of
 * the same reminder into the one notification. Running this more often than the
 * window is therefore harmless.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json(
      { error: "CRON_SECRET is not set, so this endpoint is disabled" },
      { status: 503 },
    );
  }

  const offered =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-cron-secret");

  if (offered !== secret) {
    return Response.json({ error: "Not authorised" }, { status: 401 });
  }

  if (!pushConfigured) {
    return Response.json({ sent: 0, reason: "No VAPID keys configured" });
  }

  const windowMinutes =
    Number(new URL(request.url).searchParams.get("minutes")) || DEFAULT_WINDOW_MINUTES;

  const now = new Date();
  const horizon = new Date(now.getTime() + windowMinutes * 60_000);

  const subscriptions = await db.select().from(pushSubscriptions);
  if (!subscriptions.length) return Response.json({ sent: 0, reason: "Nobody subscribed" });

  const byUser = new Map<string, typeof subscriptions>();
  for (const subscription of subscriptions) {
    const list = byUser.get(subscription.userId) ?? [];
    list.push(subscription);
    byUser.set(subscription.userId, list);
  }

  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  let sent = 0;

  for (const [userId, devices] of byUser) {
    // Every event that could possibly touch the window, one-off or repeating.
    const rows = await db
      .select()
      .from(events)
      .where(eq(events.userId, userId));

    const starting = rows
      .flatMap((row) => expandEvent(serializeEvent(row), now, horizon))
      .filter((event) => {
        const start = new Date(event.startsAt).getTime();
        return start >= now.getTime() && start <= horizon.getTime();
      });

    for (const event of starting) {
      const result = await sendToUser(devices, {
        ...eventReminder({ title: event.title, startsAt: new Date(event.startsAt) }),
      });
      sent += result.sent;
    }

    // Notes due today, told about once as the day's list rather than each hour.
    const due = await db
      .select({ id: notes.id, title: notes.title })
      .from(notes)
      .where(
        and(
          eq(notes.userId, userId),
          isNotNull(notes.dueAt),
          gte(notes.dueAt, now),
          lt(notes.dueAt, horizon),
        ),
      );

    for (const note of due) {
      const result = await sendToUser(devices, noteDueReminder(note));
      sent += result.sent;
    }

    await db
      .update(pushSubscriptions)
      .set({ notifiedAt: now })
      .where(eq(pushSubscriptions.userId, userId));
  }

  return Response.json({ sent, users: byUser.size, windowMinutes });
}
