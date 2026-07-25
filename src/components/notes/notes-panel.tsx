"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  Check,
  CheckSquare,
  LayoutGrid,
  List,
  Menu,
  PanelLeft,
  Pin,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ThemeToggle } from "@/components/theme-toggle";
import { describeFilter } from "@/lib/routes";
import { SORT_OPTIONS, type NoteFilter } from "@/lib/types";
import { cn, wordCount } from "@/lib/utils";
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
  const sort = useNotesStore((state) => state.sort);
  const selectMode = useNotesStore((state) => state.selectMode);
  const setSelectMode = useNotesStore((state) => state.setSelectMode);
  const selectedIds = useNotesStore((state) => state.selectedIds);
  const setSelectedIds = useNotesStore((state) => state.setSelectedIds);
  const bulk = useNotesStore((state) => state.bulk);
  const createNote = useNotesStore((state) => state.createNote);
  const updateNote = useNotesStore((state) => state.updateNote);

  const notes = useMemo(
    () => filterNotes(allNotes, filter, search, sort),
    [allNotes, filter, search, sort],
  );
  const copy = describeFilter(filter);

  const archivedIds = notes.map((note) => note.id);
  const totalWords = useMemo(
    () => notes.reduce((sum, note) => sum + wordCount(note.content), 0),
    [notes],
  );

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
            className="field h-9 w-full rounded-lg border border-line bg-input pl-9 pr-14 text-foreground transition focus:border-line-strong"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted-2 lg:block">
            ⌘K
          </kbd>
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

      {/* The view hero: which slice you're looking at, and what you can do to it */}
      <div className="relative overflow-hidden border-b border-line px-4 py-3.5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            background: `radial-gradient(110% 130% at 0% 0%, ${copy.accent}, transparent 62%)`,
          }}
        />

        <div className="relative flex items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-card"
            style={{ color: copy.accent }}
          >
            <copy.icon className="size-4" />
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold tracking-tight">
              {copy.title}
            </h1>
            <p className="mt-0.5 truncate text-[11px] text-muted-2">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
              {totalWords > 0 && ` · ${totalWords.toLocaleString()} words`} ·{" "}
              {copy.description}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {filter.kind === "archive" && notes.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  for (const id of archivedIds) updateNote(id, { archived: false });
                }}
                className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-muted transition hover:bg-card-hover hover:text-foreground"
              >
                <ArchiveRestore className="size-3.5" />
                <span className="hidden sm:inline">Restore all</span>
              </button>
            )}

            {filter.kind === "trash" && notes.length > 0 && (
              <button
                type="button"
                onClick={() => void bulk("emptyTrash", [])}
                className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-danger transition hover:bg-card-hover"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">Empty trash</span>
              </button>
            )}

            {notes.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectMode(!selectMode)}
                aria-pressed={selectMode}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition",
                  selectMode
                    ? "border-line-strong bg-card text-foreground"
                    : "border-line text-muted hover:bg-card-hover hover:text-foreground",
                )}
              >
                <CheckSquare className="size-3.5" />
                <span className="hidden sm:inline">Select</span>
              </button>
            )}

            <SortMenu />
          </div>
        </div>
      </div>

      {/* Bulk action bar, only while selecting */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden border-b border-line bg-panel"
          >
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(
                    selectedIds.size === notes.length
                      ? new Set<string>()
                      : new Set(notes.map((note) => note.id)),
                  )
                }
                className="text-[11px] text-muted transition hover:text-foreground"
              >
                {selectedIds.size === notes.length ? "Clear" : "Select all"}
              </button>

              <span className="text-[11px] text-muted-2">
                {selectedIds.size} selected
              </span>

              <div className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
                {filter.kind === "trash" ? (
                  <>
                    <BulkButton
                      icon={ArchiveRestore}
                      label="Restore"
                      disabled={!selectedIds.size}
                      onClick={() => void bulk("restore", [...selectedIds])}
                    />
                    <BulkButton
                      icon={Trash2}
                      label="Delete forever"
                      danger
                      disabled={!selectedIds.size}
                      onClick={() => void bulk("purge", [...selectedIds])}
                    />
                  </>
                ) : (
                  <>
                    <BulkButton
                      icon={Star}
                      label="Favorite"
                      disabled={!selectedIds.size}
                      onClick={() => void bulk("favorite", [...selectedIds])}
                    />
                    <BulkButton
                      icon={Pin}
                      label="Pin"
                      disabled={!selectedIds.size}
                      onClick={() => void bulk("pin", [...selectedIds])}
                    />
                    <BulkButton
                      icon={filter.kind === "archive" ? ArchiveRestore : Archive}
                      label={filter.kind === "archive" ? "Restore" : "Archive"}
                      disabled={!selectedIds.size}
                      onClick={() =>
                        void bulk(
                          filter.kind === "archive" ? "unarchive" : "archive",
                          [...selectedIds],
                        )
                      }
                    />
                    <BulkButton
                      icon={Trash2}
                      label="Delete"
                      danger
                      disabled={!selectedIds.size}
                      onClick={() => void bulk("trash", [...selectedIds])}
                    />
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

function BulkButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] transition disabled:opacity-40",
        danger
          ? "text-muted hover:bg-card-hover hover:text-danger"
          : "text-muted hover:bg-card-hover hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

function SortMenu() {
  const sort = useNotesStore((state) => state.sort);
  const setSort = useNotesStore((state) => state.setSort);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const active = SORT_OPTIONS.find((option) => option.value === sort);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Sort notes"
        className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-muted transition hover:bg-card-hover hover:text-foreground"
      >
        <ArrowUpDown className="size-3.5" />
        <span className="hidden sm:inline">{active?.label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-9 z-30 w-40 overflow-hidden rounded-lg border border-line bg-card shadow-xl"
          >
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSort(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-[12px] transition hover:bg-card-hover",
                  option.value === sort ? "text-foreground" : "text-muted",
                )}
              >
                {option.label}
                {option.value === sort && <Check className="size-3.5" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
