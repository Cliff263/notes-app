/**
 * Live collaboration, peer to peer.
 *
 * Two people editing the same shared note connect directly over WebRTC and
 * merge their edits with a CRDT, so there is no server holding the document and
 * nothing new to host. Saving is separate and still goes through the API — that
 * way collaboration can fail entirely and writing still works.
 */

/**
 * Signalling only introduces peers to each other; no note content passes
 * through it. The public servers are the default, and a deployment that would
 * rather run its own points at it here.
 */
export function signalingServers() {
  const configured = process.env.NEXT_PUBLIC_YJS_SIGNALING;
  return (configured ?? "wss://y-webrtc-eu.fly.dev")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
}

export type CollabStatus = "off" | "connecting" | "connected" | "failed";

/** A colour per peer, picked from the palette the calendar already uses. */
export const PEER_COLORS = ["#8b5cf6", "#22d3ee", "#34d399", "#f59e0b", "#fb7185"];

export function peerColor(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }
  return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length];
}

export type TextEdit = { at: number; remove: number; insert: string };

/**
 * The smallest edit that turns one string into another, found by trimming the
 * matching head and tail.
 *
 * This is what keeps a keystroke a keystroke: replacing the whole document on
 * every change would make every edit conflict with every other, which is
 * exactly what the CRDT is there to avoid.
 */
export function diffText(before: string, after: string): TextEdit | null {
  if (before === after) return null;

  let start = 0;
  const shortest = Math.min(before.length, after.length);
  while (start < shortest && before[start] === after[start]) start += 1;

  let end = 0;
  while (
    end < shortest - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end += 1;
  }

  return {
    at: start,
    remove: before.length - start - end,
    insert: after.slice(start, after.length - end),
  };
}

/**
 * Where the caret ends up after someone else's edit lands.
 *
 * Without this the caret jumps to wherever the browser puts it when a
 * controlled value changes — usually the end — which makes typing alongside
 * someone else unusable.
 */
export function shiftCaret(caret: number, edit: TextEdit) {
  if (caret <= edit.at) return caret;

  const delta = edit.insert.length - edit.remove;
  // Inside the replaced run: the safest place is the end of what replaced it.
  if (caret <= edit.at + edit.remove) return edit.at + edit.insert.length;

  return caret + delta;
}
