"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, List, PanelLeft, Search, X } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { selectVisibleNotes, useNotesStore } from "@/store/notes-store";
import { NoteCard } from "./note-card";

export function NotesPanel() {
  const notes = useNotesStore(useShallow(selectVisibleNotes));
  const status = useNotesStore((state) => state.status);
  const search = useNotesStore((state) => state.search);
  const setSearch = useNotesStore((state) => state.setSearch);
  const view = useNotesStore((state) => state.view);
  const setView = useNotesStore((state) => state.setView);
  const selectedId = useNotesStore((state) => state.selectedId);
  const toggleSidebar = useNotesStore((state) => state.toggleSidebar);
  const activeTag = useNotesStore((state) => state.activeTag);
  const setActiveTag = useNotesStore((state) => state.setActiveTag);

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col border-r border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-card-hover hover:text-foreground"
        >
          <PanelLeft className="size-4" />
        </button>

        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-2" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notes..."
            className="h-9 w-full rounded-lg border border-line bg-input pl-9 pr-3 text-[13px] text-foreground transition focus:border-line-strong"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-line p-0.5">
          <ViewButton
            active={view === "grid"}
            onClick={() => setView("grid")}
            label="Grid view"
          >
            <LayoutGrid className="size-3.5" />
          </ViewButton>
          <ViewButton
            active={view === "list"}
            onClick={() => setView("list")}
            label="List view"
          >
            <List className="size-3.5" />
          </ViewButton>
        </div>

        <ThemeToggle className="shrink-0" />
      </header>

      {activeTag && (
        <div className="flex items-center gap-2 border-b border-line px-4 py-2">
          <span className="text-[11px] text-muted-2">Filtered by</span>
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className="flex items-center gap-1 rounded-md bg-card px-2 py-0.5 text-[11px] text-foreground transition hover:bg-card-hover"
          >
            #{activeTag}
            <X className="size-3" />
          </button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3 scroll-thin">
        {status === "loading" && notes.length === 0 ? (
          <SkeletonList />
        ) : notes.length === 0 ? (
          <EmptyState search={search} />
        ) : (
          <motion.div
            layout
            className={cn(
              view === "grid"
                ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2"
                : "flex flex-col gap-3",
            )}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {notes.map((note) => (
                <NoteCard key={note.id} note={note} selected={note.id === selectedId} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </section>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex size-7 items-center justify-center rounded-md transition",
        active ? "bg-card text-foreground" : "text-muted-2 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function SkeletonList() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          className="animate-pulse rounded-xl border border-line bg-card p-4"
          style={{ animationDelay: `${index * 80}ms` }}
        >
          <div className="h-3 w-2/5 rounded bg-card-hover" />
          <div className="mt-3 h-2 w-16 rounded bg-card-hover" />
          <div className="mt-3 h-2 w-full rounded bg-card-hover" />
          <div className="mt-2 h-2 w-4/5 rounded bg-card-hover" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  const createNote = useNotesStore((state) => state.createNote);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center"
    >
      <p className="text-[13px] font-medium">
        {search ? "No notes match that search" : "Nothing here yet"}
      </p>
      <p className="max-w-[260px] text-[12px] text-muted-2">
        {search
          ? "Try a different word, or clear the search to see everything again."
          : "Create your first note and it will show up right here."}
      </p>
      {!search && (
        <button
          type="button"
          onClick={() => void createNote()}
          className="mt-2 rounded-lg bg-btn px-3 py-1.5 text-[12px] font-medium text-btn-foreground transition hover:opacity-90"
        >
          New Note
        </button>
      )}
    </motion.div>
  );
}
