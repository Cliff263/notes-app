import { eq } from "drizzle-orm";
import { db } from "./client";
import { buildSeedRows } from "./seed-data";
import { events, notes, users } from "./schema";

/**
 * Fills a brand new workspace with starter notes and events so the app opens
 * with something to look at. Safe to call more than once — the `seededAt`
 * stamp on the user row makes it a no-op after the first run.
 */
export async function seedWorkspace(userId: string) {
  const [user] = await db
    .select({ seededAt: users.seededAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user || user.seededAt) return false;

  const { noteRows, eventRows } = buildSeedRows(userId);

  await db.insert(notes).values(noteRows);
  await db.insert(events).values(eventRows);
  await db.update(users).set({ seededAt: new Date() }).where(eq(users.id, userId));

  return true;
}
