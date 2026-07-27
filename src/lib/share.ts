import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { noteShares, notes, type DbNote, type DbNoteShare } from "@/db/schema";
import { appUrl } from "./auth-tokens";
import { SHARE_DURATIONS } from "./types";

/** 32 bytes: not something anyone is going to arrive at by trying. */
export function createShareToken() {
  return randomBytes(32).toString("base64url");
}

export function shareUrl(token: string) {
  return `${appUrl()}/s/${token}`;
}

export type ResolvedShare = { share: DbNoteShare; note: DbNote };

/**
 * The note behind a public link, or null if the link is unknown, expired, or
 * points at a note that has since been deleted. One query, because this runs on
 * every request to a shared page.
 */
export async function resolveShare(token: string): Promise<ResolvedShare | null> {
  if (!token) return null;

  const [row] = await db
    .select({ share: noteShares, note: notes })
    .from(noteShares)
    .innerJoin(notes, eq(notes.id, noteShares.noteId))
    .where(and(eq(noteShares.token, token), isNull(notes.deletedAt)))
    .limit(1);

  if (!row) return null;
  if (row.share.expiresAt && row.share.expiresAt.getTime() < Date.now()) return null;

  return row;
}

export function expiryFor(duration: string | undefined): Date | null {
  const match = SHARE_DURATIONS.find((option) => option.value === duration);
  return match?.ms ? new Date(Date.now() + match.ms) : null;
}
