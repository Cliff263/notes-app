"use client";

import { create } from "zustand";
import type { Note, NoteFilter, SortKey, ViewMode } from "@/lib/types";

/**
 * Client state only — what this tab is looking at and doing. Anything that came
 * from the server lives in the React Query cache (`src/hooks/use-notes.ts`),
 * so there is exactly one copy of a note in memory.
 */
type NotesState = {
  selectedId: string | null;
  search: string;
  sort: SortKey;
  view: ViewMode;
  /** Desktop: the sidebar column is collapsible. */
  sidebarOpen: boolean;
  /** Below lg the sidebar is an overlay drawer instead. */
  drawerOpen: boolean;
  /** Multi-select for bulk actions. */
  selectMode: boolean;
  selectedIds: Set<string>;

  select: (id: string | null) => void;
  setSearch: (value: string) => void;
  setSort: (sort: SortKey) => void;
  setView: (view: ViewMode) => void;
  toggleSidebar: () => void;
  setDrawerOpen: (open: boolean) => void;

  toggleSelected: (id: string) => void;
  setSelectedIds: (ids: Set<string>) => void;
  clearSelection: () => void;
  setSelectMode: (enabled: boolean) => void;
};

export type BulkAction =
  | "archive"
  | "unarchive"
  | "favorite"
  | "unfavorite"
  | "pin"
  | "unpin"
  | "trash"
  | "restore"
  | "purge"
  | "emptyTrash";

export const useNotesStore = create<NotesState>((set) => ({
  selectedId: null,
  search: "",
  sort: "updated",
  view: "list",
  sidebarOpen: true,
  drawerOpen: false,
  selectMode: false,
  selectedIds: new Set<string>(),

  select: (selectedId) => set({ selectedId }),
  setSearch: (search) => set({ search }),
  setSort: (sort) => set({ sort }),
  setView: (view) => set({ view }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),

  toggleSelected: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),

  setSelectedIds: (selectedIds) => set({ selectedIds }),
  clearSelection: () => set({ selectedIds: new Set(), selectMode: false }),
  setSelectMode: (selectMode) =>
    set(selectMode ? { selectMode } : { selectMode, selectedIds: new Set() }),
}));

/* -------------------------------------------------------------------------- */
/*  Derivations over the notes the cache handed back                          */
/* -------------------------------------------------------------------------- */

/** The route decides which notes are on screen, so filtering is a pure function. */
export function filterNotes(
  notes: Note[],
  filter: NoteFilter,
  search: string,
  sort: SortKey = "updated",
) {
  const query = search.trim().toLowerCase();

  return notes
    .filter((note) => {
      // Trashed notes only ever appear in the trash.
      if (filter.kind === "trash") {
        if (!note.deletedAt) return false;
      } else if (note.deletedAt) {
        return false;
      }

      switch (filter.kind) {
        case "favorites":
          if (!note.favorite || note.archived) return false;
          break;
        case "pinned":
          if (!note.pinned || note.archived) return false;
          break;
        case "archive":
          if (!note.archived) return false;
          break;
        case "trash":
          break;
        case "category":
          if (note.category !== filter.value || note.archived) return false;
          break;
        case "tag":
          if (!note.tags.includes(filter.value) || note.archived) return false;
          break;
        default:
          if (note.archived) return false;
      }

      if (query) {
        const haystack = [note.title, note.content, note.tags.join(" ")]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Pinned notes stay on top of every ordering except the trash.
      if (filter.kind !== "trash" && a.pinned !== b.pinned) return a.pinned ? -1 : 1;

      switch (sort) {
        case "created":
          return b.createdAt.localeCompare(a.createdAt);
        case "title":
          return (a.title || "Untitled note").localeCompare(b.title || "Untitled note");
        case "length":
          return b.content.length - a.content.length;
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });
}

const live = (note: Note) => !note.archived && !note.deletedAt;

export function allTags(notes: Note[]) {
  const tags = new Set<string>();
  for (const note of notes) {
    if (live(note)) for (const tag of note.tags) tags.add(tag);
  }
  return [...tags].sort();
}

export function tagCounts(notes: Note[]) {
  const counts: Record<string, number> = {};
  for (const note of notes) {
    if (!live(note)) continue;
    for (const tag of note.tags) counts[tag] = (counts[tag] ?? 0) + 1;
  }
  return counts;
}

export function categoryCounts(notes: Note[]) {
  const counts: Record<string, number> = {};
  for (const note of notes) {
    if (!live(note)) continue;
    counts[note.category] = (counts[note.category] ?? 0) + 1;
  }
  return counts;
}

export function countBy(notes: Note[], kind: "archived" | "favorite" | "pinned" | "trashed") {
  return notes.filter((note) => {
    switch (kind) {
      case "archived":
        return note.archived && !note.deletedAt;
      case "favorite":
        return note.favorite && live(note);
      case "pinned":
        return note.pinned && live(note);
      default:
        return Boolean(note.deletedAt);
    }
  }).length;
}
