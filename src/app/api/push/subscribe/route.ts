import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { pushConfigured } from "@/lib/push";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";

/** Whether this device is registered, and whether the server can push at all. */
export async function GET(request: Request) {
  try {
    const userId = await requireUserId();
    const endpoint = new URL(request.url).searchParams.get("endpoint");

    if (!endpoint) return Response.json({ configured: pushConfigured, subscribed: false });

    const [row] = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      )
      .limit(1);

    return Response.json({ configured: pushConfigured, subscribed: Boolean(row) });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}

/**
 * Registers a browser's push endpoint. The same endpoint arriving again just
 * refreshes the keys, which is what happens when a browser rotates them.
 */
export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json().catch(() => ({}));

    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    const p256dh = body.keys?.p256dh;
    const auth = body.keys?.auth;

    if (!endpoint || typeof p256dh !== "string" || typeof auth !== "string") {
      return Response.json({ error: "Incomplete subscription" }, { status: 400 });
    }

    await db
      .insert(pushSubscriptions)
      .values({ userId, endpoint, p256dh, auth })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId, p256dh, auth },
      });

    return Response.json({ subscribed: true }, { status: 201 });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json().catch(() => ({}));
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";

    if (endpoint) {
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, userId),
            eq(pushSubscriptions.endpoint, endpoint),
          ),
        );
    }

    return Response.json({ subscribed: false });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
