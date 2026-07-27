"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { History, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { useNoteHistory, type NoteVersion } from "@/hooks/use-note-history";
import { diffLines, diffSummary } from "@/lib/diff";
import { cn, longDateTime, relativeTime, wordCount } from "@/lib/utils";

/**
 * Version history: the list of snapshots on the left, what changed between the
 * chosen one and the note as it stands on the right. Loaded on open — nobody
 * pays for this until they ask for it.
 */
export function HistorySheet({
  noteId,
  open,
  onClose,
  onRestore,
}: {
  noteId: string;
  open: boolean;
  onClose: () => void;
  onRestore: (version: NoteVersion) => void;
}) {
  const reduced = useReducedMotion();
  const { data, isPending } = useNoteHistory(noteId, open);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const versions = data?.versions ?? [];
  const selected =
    versions.find((version) => version.id === selectedId) ?? versions[0] ?? null;

  const rows = selected && data ? diffLines(selected.content, data.current.content) : [];
  const changed = diffSummary(rows);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
        >
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(event) => event.stopPropagation()}
            className="flex h-[85vh] w-full max-w-[880px] flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl sm:h-[76vh] sm:rounded-2xl"
          >
            <header className="flex items-center gap-2 border-b border-line px-4 py-3">
              <History className="size-4 text-muted-2" />
              <h2 className="flex-1 text-[13px] font-semibold tracking-tight">
                Version history
              </h2>
              <button
                type="button"
                aria-label="Close history"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-lg text-muted-2 transition hover:bg-card-hover hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <div className="max-h-[34%] shrink-0 overflow-y-auto border-b border-line scroll-thin sm:max-h-none sm:w-[240px] sm:border-b-0 sm:border-r">
                {isPending && (
                  <p className="px-4 py-6 text-[12px] text-muted-2">Loading…</p>
                )}

                {!isPending && versions.length === 0 && (
                  <p className="px-4 py-6 text-[12px] leading-relaxed text-muted-2">
                    No earlier versions yet. One is kept each time you come back
                    to a note and change it.
                  </p>
                )}

                {versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => setSelectedId(version.id)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 border-b border-line px-4 py-2.5 text-left transition",
                      version.id === selected?.id
                        ? "bg-card text-foreground"
                        : "text-muted hover:bg-card-hover",
                    )}
                  >
                    <span className="text-[12px] font-medium">
                      {relativeTime(version.createdAt)}
                    </span>
                    <span className="text-[10px] text-muted-2">
                      {longDateTime(version.createdAt)} · {wordCount(version.content)} words
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                {selected ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
                      <p className="flex-1 text-[11px] text-muted-2">
                        Compared with the note as it is now
                      </p>
                      <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                        <Plus className="size-3" />
                        {changed.added}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-rose-400">
                        <Minus className="size-3" />
                        {changed.removed}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRestore(selected)}
                        className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[11px] text-muted transition hover:bg-card-hover hover:text-foreground"
                      >
                        <RotateCcw className="size-3" />
                        Restore this version
                      </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-auto px-1 py-2 font-mono text-[11.5px] leading-[1.6] scroll-thin">
                      {rows.map((row, index) => (
                        <div
                          key={index}
                          className={cn(
                            "flex gap-2 whitespace-pre-wrap break-words px-3",
                            row.type === "add" &&
                              "bg-[color-mix(in_srgb,#34d399_14%,transparent)] text-emerald-300",
                            row.type === "remove" &&
                              "bg-[color-mix(in_srgb,#fb7185_14%,transparent)] text-rose-300",
                            row.type === "same" && "text-muted-2",
                          )}
                        >
                          <span className="select-none opacity-60">
                            {row.type === "add" ? "+" : row.type === "remove" ? "−" : " "}
                          </span>
                          <span className="min-w-0 flex-1">{row.text || " "}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-1 items-center justify-center px-8 text-center">
                    <p className="max-w-[280px] text-[12px] text-muted-2">
                      Pick a version to see what changed between it and the note
                      as it stands.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
