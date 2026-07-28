import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attachments, events, notes, users } from "@/db/schema";
import { deleteObjects } from "@/lib/object-storage";
import { requireUserId, UnauthorizedError, unauthorized } from "@/lib/session";

export async function GET() {
  try {
    const userId = await requireUserId();

    const [user] = await db
      .select({
        name: users.name,
        email: users.email,
        createdAt: users.createdAt,
        hasPassword: users.passwordHash,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) return Response.json({ error: "Account not found" }, { status: 404 });

    const noteRows = await db
      .select({ id: notes.id })
      .from(notes)
      .where(eq(notes.userId, userId));
    const eventRows = await db
      .select({ id: events.id })
      .from(events)
      .where(eq(events.userId, userId));

    return Response.json({
      name: user.name,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      hasPassword: Boolean(user.hasPassword),
      noteCount: noteRows.length,
      eventCount: eventRows.length,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json().catch(() => ({}));

    const name = String(body.name ?? "").trim();
    if (!name) return Response.json({ error: "Name cannot be empty" }, { status: 400 });

    await db.update(users).set({ name }).where(eq(users.id, userId));
    return Response.json({ ok: true, name });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}

export async function DELETE() {
  try {
    const userId = await requireUserId();
    const stored = await db
      .select({ storageKey: attachments.storageKey })
      .from(attachments)
      .where(eq(attachments.userId, userId));
    // Notes, events, accounts and sessions all cascade from the user row.
    await db.delete(users).where(eq(users.id, userId));
    await deleteObjects(stored.map((item) => item.storageKey));
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorized();
    throw error;
  }
}
