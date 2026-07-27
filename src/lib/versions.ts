import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { noteVersions, type DbNote } from "@/db/schema";
import { movedSubstantially } from "./diff";

/** A snapshot is kept for at most this many edits back. */
export const VERSION_LIMIT = 30;

/** How long a run of small edits collapses into a single snapshot. */
const QUIET_PERIOD_MS = 2 * 60_000;

/**
 * Records what a note looked like *before* an edit, if that is worth recording.
 *
 * Autosave fires every half second, so snapshotting every write would bury the
 * useful versions under hundreds of keystrokes. Instead a run of small edits
 * collapses into the one snapshot taken when the run began, and a large change
 * — a paste, a deletion — always earns its own regardless of timing.
 *
 * Called after the update has been applied, so a failure here costs a snapshot
 * rather than the edit itself.
 */
export async function recordVersion(before: DbNote, after: { title: string; content: string }) {
  const titleChanged = before.title !== after.title;
  const contentChanged = before.content !== after.content;
  if (!titleChanged && !contentChanged) return;

  const [latest] = await db
    .select({ createdAt: noteVersions.createdAt })
    .from(noteVersions)
    .where(eq(noteVersions.noteId, before.id))
    .orderBy(desc(noteVersions.createdAt))
    .limit(1);

  const recent =
    latest && Date.now() - latest.createdAt.getTime() < QUIET_PERIOD_MS;

  if (recent && !movedSubstantially(before.content, after.content)) return;

  await db.insert(noteVersions).values({
    noteId: before.id,
    userId: before.userId,
    title: before.title,
    content: before.content,
  });

  await pruneVersions(before.id);
}

/** Keeps the newest `VERSION_LIMIT` snapshots and drops the rest. */
async function pruneVersions(noteId: string) {
  const rows = await db
    .select({ id: noteVersions.id })
    .from(noteVersions)
    .where(eq(noteVersions.noteId, noteId))
    .orderBy(desc(noteVersions.createdAt))
    .offset(VERSION_LIMIT);

  if (rows.length) {
    await db.delete(noteVersions).where(
      and(
        eq(noteVersions.noteId, noteId),
        inArray(
          noteVersions.id,
          rows.map((row) => row.id),
        ),
      ),
    );
  }
}
