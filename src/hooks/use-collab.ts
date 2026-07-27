"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  diffText,
  peerColor,
  shiftCaret,
  signalingServers,
  type CollabStatus,
} from "@/lib/collab";

export type Peer = { id: number; name: string; color: string };

type Options = {
  /** The share token, which is also the room. Null means do not connect. */
  token: string | null;
  /** Who we are, for the presence list. */
  name: string;
  /** Only the owner seeds the document; see below. */
  seed?: string;
  /** Called when someone else's edit arrives. */
  onRemoteText: (text: string, caret: (current: number) => number) => void;
};

/**
 * Joins the room for a shared note and keeps a `Y.Text` in step with the
 * textarea.
 *
 * The room is the share token, never the note's id: a token is already the
 * capability that lets someone read the note, and using it means no internal
 * identifier is ever broadcast to a signalling server.
 *
 * Everything here is best-effort. Yjs is imported only when a room is actually
 * joined, so nobody pays for it otherwise, and if signalling never answers the
 * status settles on "failed" and the editor carries on saving through the API
 * exactly as it did before.
 */
export function useCollab({ token, name, seed, onRemoteText }: Options) {
  /*
   * Only the connection's own progress is state; "off" is derived, because
   * whether there is a room to join is something render already knows.
   */
  const [connection, setConnection] = useState<Exclude<CollabStatus, "off">>(
    "connecting",
  );
  const [peers, setPeers] = useState<Peer[]>([]);

  // Changing note, or gaining a share link, starts the connection over. React
  // asks for this to happen during render rather than in an effect.
  const [lastToken, setLastToken] = useState(token);
  if (token !== lastToken) {
    setLastToken(token);
    setConnection("connecting");
    setPeers([]);
  }

  const status: CollabStatus = token ? connection : "off";

  /*
   * The callback changes on every render of the editor. Holding it in a ref
   * keeps the effect below from tearing the connection down and rebuilding it
   * between keystrokes.
   */
  const onRemoteRef = useRef(onRemoteText);
  useEffect(() => {
    onRemoteRef.current = onRemoteText;
  });

  const seedRef = useRef(seed);
  useEffect(() => {
    seedRef.current = seed;
  });

  const textRef = useRef<{ toString: () => string } | null>(null);
  const applyRef = useRef<((next: string) => void) | null>(null);

  useEffect(() => {
    if (!token) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      // Loaded here rather than imported at the top: this is ~100 KB that only
      // matters to the handful of notes that are being shared for editing.
      const [{ Doc }, { WebrtcProvider }] = await Promise.all([
        import("yjs"),
        import("y-webrtc"),
      ]);
      if (disposed) return;

      const doc = new Doc();
      const text = doc.getText("content");
      textRef.current = text;

      const provider = new WebrtcProvider(`square-notes-${token}`, doc, {
        signaling: signalingServers(),
      });

      provider.awareness.setLocalStateField("user", {
        name,
        color: peerColor(`${name}-${provider.awareness.clientID}`),
      });

      /** Local edit → document, as the smallest change that explains it. */
      applyRef.current = (next: string) => {
        const edit = diffText(text.toString(), next);
        if (!edit) return;

        doc.transact(() => {
          if (edit.remove) text.delete(edit.at, edit.remove);
          if (edit.insert) text.insert(edit.at, edit.insert);
        }, "local");
      };

      /** Document → local, but only for changes that came from someone else. */
      const onTextChange = (event: { delta: unknown[] }, transaction: { origin: unknown }) => {
        if (transaction.origin === "local") return;

        // The delta is enough to know where the change landed, which is what
        // the caret needs; the full string is what the textarea needs.
        let at = 0;
        let remove = 0;
        let insert = "";

        for (const part of event.delta as Array<Record<string, unknown>>) {
          if (typeof part.retain === "number") at += part.retain;
          else if (typeof part.delete === "number") remove += part.delete;
          else if (typeof part.insert === "string") insert += part.insert;
        }

        const edit = { at, remove, insert };
        onRemoteRef.current(text.toString(), (caret) => shiftCaret(caret, edit));
      };

      text.observe(onTextChange);

      const onAwareness = () => {
        const states = provider.awareness.getStates();
        const others: Peer[] = [];

        for (const [id, state] of states) {
          if (id === provider.awareness.clientID) continue;
          const user = (state as { user?: { name?: string; color?: string } }).user;
          if (user) {
            others.push({
              id,
              name: user.name ?? "Someone",
              color: user.color ?? "#8b5cf6",
            });
          }
        }
        setPeers(others);
      };

      provider.awareness.on("change", onAwareness);

      const onStatus = ({ connected }: { connected: boolean }) => {
        setConnection(connected ? "connected" : "connecting");
      };
      provider.on("status", onStatus);

      /*
       * Only the owner puts the note's text into a fresh document. A guest
       * waits to be synced instead, because two peers seeding the same text
       * into an empty CRDT would merge into two copies of it.
       */
      const seedTimer = setTimeout(() => {
        const initial = seedRef.current;
        if (initial && text.length === 0) {
          doc.transact(() => text.insert(0, initial), "local");
        }
      }, 800);

      /*
       * "Connected" from the provider is not enough on its own: y-webrtc also
       * talks to other tabs in this browser over a BroadcastChannel, and will
       * happily report itself connected while no signalling server has ever
       * answered. Reaching anyone on another device needs one of those, so
       * that is what is actually checked.
       */
      const giveUp = setTimeout(() => {
        const signalling = (
          provider as unknown as { signalingConns?: Array<{ connected: boolean }> }
        ).signalingConns;

        const introduced = signalling?.some((conn) => conn.connected) ?? false;
        if (!introduced) setConnection("failed");
      }, 8000);

      cleanup = () => {
        clearTimeout(seedTimer);
        clearTimeout(giveUp);
        text.unobserve(onTextChange);
        provider.awareness.off("change", onAwareness);
        provider.off("status", onStatus);
        provider.destroy();
        doc.destroy();
        textRef.current = null;
        applyRef.current = null;
      };
    })().catch(() => {
      if (!disposed) setConnection("failed");
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [token, name]);

  /** Publishes a local edit. A no-op when there is no room. */
  const publish = useCallback((next: string) => {
    applyRef.current?.(next);
  }, []);

  return { status, peers, publish };
}
