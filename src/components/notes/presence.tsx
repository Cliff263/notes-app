"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Users, WifiOff } from "lucide-react";
import type { CollabStatus } from "@/lib/collab";
import type { Peer } from "@/hooks/use-collab";
import { cn } from "@/lib/utils";

/**
 * Who else is in this note. Deliberately quiet: an empty room shows nothing at
 * all, so the only time this takes up space is when it is telling you something
 * — that someone arrived, or that the connection could not be made.
 */
export function Presence({
  status,
  peers,
  className,
}: {
  status: CollabStatus;
  peers: Peer[];
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (status === "off") return null;

  // Someone is here even though signalling never answered — another tab in this
  // same browser, which y-webrtc reaches without one. Showing them is the truth.
  if (status === "failed" && peers.length === 0) {
    return (
      <span
        className={cn(
          "flex items-center gap-1.5 text-[11px] text-muted-2",
          className,
        )}
        title="Nobody could be introduced to this page, so edits will not appear live elsewhere. They are still saved."
      >
        <WifiOff className="size-3" />
        Editing on your own
      </span>
    );
  }

  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <AnimatePresence initial={false}>
        {peers.map((peer) => (
          <motion.span
            key={peer.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            title={`${peer.name} is here`}
            className="flex size-5 items-center justify-center rounded-full text-[9px] font-semibold uppercase text-black"
            style={{ background: peer.color }}
          >
            {peer.name.slice(0, 2)}
          </motion.span>
        ))}
      </AnimatePresence>

      <span className="flex items-center gap-1 text-[11px] text-muted-2">
        <Users className="size-3" />
        {peers.length === 0
          ? status === "connecting"
            ? "Connecting…"
            : "Just you"
          : `${peers.length + 1} editing`}
      </span>
    </span>
  );
}
