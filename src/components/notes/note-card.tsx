"use client";

import { motion } from "framer-motion";
import { CalendarClock, Check, Pin, RotateCcw, Star } from "lucide-react";
import type { Note } from "@/lib/types";
import { cn, readingTime, relativeTime, shortDate, stripMarkdown } from "@/lib/utils";
import { useNoteActions } from "@/hooks/use-notes";
import { useNotesStore } from "@/store/notes-store";

export function NoteCard({ note, selected }: { note: Note; selected: boolean }) {
  const select = useNotesStore((state) => state.select);
  const { updateNote, restoreNote } = useNoteActions();
  const selectMode = useNotesStore((state) => state.selectMode);
  const toggleSelected = useNotesStore((state) => state.toggleSelected);
  const checked = useNotesStore((state) => state.selectedIds.has(note.id));

  const excerpt = stripMarkdown(note.content);
  const minutes = readingTime(note.content);
  const trashed = Boolean(note.deletedAt);

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={() => (selectMode ? toggleSelected(note.id) : select(note.id))}
      className={cn(
        "group cursor-pointer rounded-xl border bg-card p-4 transition-colors",
        selectMode && checked && "ring-1 ring-[var(--glow-1)]",
        selected
          ? "border-[color-mix(in_srgb,var(--foreground)_38%,transparent)] bg-card-hover"
          : "border-line hover:border-line-strong hover:bg-card-hover",
      )}
    >
      <div className="flex items-start gap-2">
        {selectMode ? (
          <span
            className={cn(
              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition",
              checked
                ? "border-transparent bg-btn text-btn-foreground"
                : "border-line-strong",
            )}
          >
            {checked && <Check className="size-3" />}
          </span>
        ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            updateNote(note.id, { pinned: !note.pinned });
          }}
          aria-label={note.pinned ? "Unpin note" : "Pin note"}
          className={cn(
            "mt-0.5 shrink-0 transition",
            note.pinned
              ? "text-foreground"
              : "hover-reveal text-muted-2 hover:text-foreground",
          )}
        >
          <Pin className={cn("size-3.5", note.pinned && "fill-current")} />
        </button>
        )}

        <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">
          {note.title || "Untitled note"}
        </h3>

        {trashed && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              restoreNote(note.id);
            }}
            className="flex shrink-0 items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted transition hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            Restore
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[22px]">
        <span className="inline-flex rounded-md border border-line bg-panel px-1.5 py-0.5 text-[10px] text-muted">
          {note.category}
        </span>

        {note.dueAt && (
          <span className="inline-flex items-center gap-1 rounded-md border border-line bg-panel px-1.5 py-0.5 text-[10px] text-glow-2">
            <CalendarClock className="size-2.5" />
            {shortDate(note.dueAt)}
          </span>
        )}
      </div>

      {excerpt && (
        <p className="clamp-2 mt-2.5 pl-[22px] text-[12px] leading-[1.6] text-muted">
          {excerpt}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2 pl-[22px]">
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {note.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-panel px-1.5 py-0.5 text-[10px] text-muted-2"
            >
              #{tag}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="text-[10px] text-muted-2">+{note.tags.length - 3}</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              updateNote(note.id, { favorite: !note.favorite });
            }}
            aria-label={note.favorite ? "Remove from favorites" : "Add to favorites"}
            className={cn(
              "transition",
              note.favorite
                ? "text-accent"
                : "hover-reveal text-muted-2 hover:text-foreground",
            )}
          >
            <Star className={cn("size-3", note.favorite && "fill-accent")} />
          </button>

          <span
            className="text-[10px] text-muted-2"
            title={`${minutes} min read`}
          >
            {relativeTime(note.updatedAt)}
          </span>
        </div>
      </div>
    </motion.article>
  );
}
