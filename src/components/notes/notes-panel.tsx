"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArchiveRestore,
  LayoutGrid,
  List,
  Menu,
  PanelLeft,
  Search,
} from "lucide-react";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { ThemeToggle } from "@/components/theme-toggle";
import { describeFilter } from "@/lib/routes";
import type { NoteFilter } from "@/lib/types";
import { cn } from "@/lib/utils";
import { filterNotes, useNotesStore } from "@/store/notes-store";
import { NoteCard } from "./note-card";

export function NotesPanel({ filter }: { filter: NoteFilter }) {
  const allNotes = useNotesStore(useShallow((state) => state.notes));
  const status = useNotesStore((state) => state.status);
  const search = useNotesStore((state) => state.search);
  const setSearch = useNotesStore((state) => state.setSearch);
  const view = useNotesStore((state) => state.view);
  const setView = useNotesStore((state) => state.setView);
  const selectedId = useNotesStore((state) => state.selectedId);
  const toggleSidebar = useNotesStore((state) => state.toggleSidebar);
  const setDrawerOpen = useNotesStore((state) => state.setDrawerOpen);
  const createNote = useNotesStore((state) => state.createNote);
  const updateNote = useNotesStore((state) => state.updateNote);

  const notes = useMemo(
    () => filterNotes(allNotes, filter, search),
    [allNotes, filter, search],
  );
  const copy = describeFilter(filter);

  const archivedIds = notes.map((note) => note.id);

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col border-r border-line bg-surface">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        {/* Desktop collapses the column; below lg the same control opens the drawer. */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-card-hover hover:text-foreground lg:flex"
        >
          <PanelLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-card-hover hover:text-foreground lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-2" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notes..."
            data-search-input
            className="field h-9 w-full rounded-lg border border-line bg-input pl-9 pr-3 text-foreground transition focus:border-line-strong"
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

      {/* Which view you're in, so the list is never ambiguous */}
      <div className="flex items-end justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-semibold tracking-tight">
            {copy.title}
          </h1>
          <p className="mt-0.5 truncate text-[11px] text-muted-2">
            {notes.length} {notes.length === 1 ? "note" : "notes"} · {copy.description}
          </p>
        </div>

        {filter.kind === "archive" && notes.length > 0 && (
          <button
            type="button"
            onClick={() => {
              for (const id of archivedIds) {
                updateNote(id, { archived: false });
              }
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-muted transition hover:bg-card-hover hover:text-foreground"
          >
            <ArchiveRestore className="size-3.5" />
            Restore all
          </button>
        )}
      </div>

      <div className="pb-navbar min-h-0 flex-1 overflow-y-auto p-3 scroll-thin">
        {status === "loading" && allNotes.length === 0 ? (
          <SkeletonList />
        ) : notes.length === 0 ? (
          <EmptyState
            search={search}
            message={copy.empty}
            onCreate={
              filter.kind === "archive"
                ? undefined
                : () => {
                    void createNote(
                      filter.kind === "category" ? filter.value : "Personal",
                      filter.kind === "tag" ? [filter.value] : [],
                    );
                  }
            }
          />
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

function EmptyState({
  search,
  message,
  onCreate,
}: {
  search: string;
  message: string;
  onCreate?: () => void;
}) {
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
          : message}
      </p>
      {!search && onCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="mt-2 rounded-lg bg-btn px-3 py-1.5 text-[12px] font-medium text-btn-foreground transition hover:opacity-90"
        >
          New Note
        </button>
      )}
    </motion.div>
  );
}
