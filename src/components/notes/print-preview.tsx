"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Printer, X } from "lucide-react";
import { useEffect } from "react";
import type { Note } from "@/lib/types";
import { longDateTime, readingTime, wordCount } from "@/lib/utils";
import { MarkdownPreview } from "./markdown-preview";

export function PrintPreview({
  note,
  content,
  open,
  onClose,
}: {
  note: Note;
  content: string;
  open: boolean;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("print-preview-open");
    return () => document.documentElement.classList.remove("print-preview-open");
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-print-preview-shell
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[70] flex flex-col bg-black/70 backdrop-blur-sm"
        >
          <header
            data-print-hidden
            onClick={(event) => event.stopPropagation()}
            className="flex shrink-0 items-center gap-3 border-b border-line bg-surface px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[13px] font-semibold">Print preview</h2>
              <p className="truncate text-[11px] text-muted-2">
                {note.title || "Untitled note"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex h-9 items-center gap-2 rounded-lg bg-btn px-3 text-[12px] font-medium text-btn-foreground transition hover:opacity-90"
            >
              <Printer className="size-3.5" />
              Print
            </button>
            <button
              type="button"
              aria-label="Close print preview"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-lg text-muted transition hover:bg-card-hover hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </header>

          <div
            data-print-preview-shell
            className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8 scroll-thin"
          >
            <motion.main
              data-print-preview
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              onClick={(event) => event.stopPropagation()}
              className="print-preview-page mx-auto min-h-full w-full max-w-[816px] bg-white px-6 py-8 text-zinc-900 shadow-2xl sm:px-12 sm:py-12"
            >
              <header className="border-b border-zinc-200 pb-5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                  {note.category}
                </p>
                <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
                  {note.title || "Untitled note"}
                </h1>
                <p className="mt-2 text-[12px] text-zinc-500">
                  Updated {longDateTime(note.updatedAt)} · {wordCount(content)} words ·{" "}
                  {readingTime(content)} min read
                </p>
                {note.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {note.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </header>
              <article className="py-7">
                <MarkdownPreview source={content} />
              </article>
            </motion.main>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
