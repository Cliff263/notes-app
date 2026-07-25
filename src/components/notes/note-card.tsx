"use client";

import { motion } from "framer-motion";
import { Pin, Star } from "lucide-react";
import type { Note } from "@/lib/types";
import { cn, shortDate } from "@/lib/utils";
import { useNotesStore } from "@/store/notes-store";

export function NoteCard({ note, selected }: { note: Note; selected: boolean }) {
  const select = useNotesStore((state) => state.select);
  const updateNote = useNotesStore((state) => state.updateNote);

  const excerpt = note.content.replace(/\s+/g, " ").trim();

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={() => select(note.id)}
      className={cn(
        "group cursor-pointer rounded-xl border bg-card p-4 transition-colors",
        selected
          ? "border-[color-mix(in_srgb,var(--foreground)_38%,transparent)] bg-card-hover"
          : "border-line hover:border-line-strong hover:bg-card-hover",
      )}
    >
      <div className="flex items-start gap-2">
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
              : "text-muted-2 opacity-0 group-hover:opacity-100 hover:text-foreground",
          )}
        >
          <Pin className={cn("size-3.5", note.pinned && "fill-current")} />
        </button>

        <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight">
          {note.title || "Untitled note"}
        </h3>
      </div>

      <div className="mt-2 pl-[22px]">
        <span className="inline-flex rounded-md border border-line bg-panel px-1.5 py-0.5 text-[10px] text-muted">
          {note.category}
        </span>
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
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {note.favorite && (
            <Star className="size-3 fill-accent text-accent" aria-label="Favorite" />
          )}
          <span className="text-[10px] text-muted-2">{shortDate(note.updatedAt)}</span>
        </div>
      </div>
    </motion.article>
  );
}
