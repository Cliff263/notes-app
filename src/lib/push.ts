import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db/client";
import { pushSubscriptions, type DbPushSubscription } from "@/db/schema";
import { appUrl } from "./auth-tokens";

/**
 * Web Push, which is entirely optional: without VAPID keys the app behaves
 * exactly as it did before, the Settings toggle explains why it is unavailable,
 * and the sending route reports that it did nothing rather than failing.
 */
export const pushConfigured = Boolean(
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
);

let configured = false;

function ensureConfigured() {
  if (configured || !pushConfigured) return pushConfigured;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? `mailto:notifications@${new URL(appUrl()).hostname}`,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** Where clicking the notification should land. */
  url: string;
  /** Collapses repeats of the same thing on the device. */
  tag: string;
};

/**
 * Sends one payload to every device a user has registered.
 *
 * A subscription that answers 404 or 410 has been thrown away by the push
 * service — the browser was uninstalled, or permission was withdrawn — so the
 * row is deleted rather than retried forever.
 */
export async function sendToUser(
  subscriptions: DbPushSubscription[],
  payload: PushPayload,
) {
  if (!ensureConfigured() || !subscriptions.length) return { sent: 0, pruned: 0 };

  const body = JSON.stringify(payload);
  const gone: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(subscription.id);
        else console.error("Push failed for", subscription.endpoint, status);
      }
    }),
  );

  if (gone.length) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  }

  return { sent, pruned: gone.length };
}

export async function subscriptionsFor(userId: string) {
  return db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

/** "Standup starts in 20 minutes" — the wording the device shows. */
export function eventReminder(event: {
  title: string;
  startsAt: Date;
}): PushPayload {
  const minutes = Math.max(
    1,
    Math.round((event.startsAt.getTime() - Date.now()) / 60_000),
  );

  return {
    title: event.title,
    body: minutes < 60 ? `Starts in ${minutes} minutes` : "Starts soon",
    url: "/calendar",
    tag: `event-${event.title}-${event.startsAt.toISOString()}`,
  };
}

export function noteDueReminder(note: { id: string; title: string }): PushPayload {
  return {
    title: note.title || "Untitled note",
    body: "This note is due today",
    url: "/",
    tag: `note-${note.id}`,
  };
}
