"use client";

import { create } from "zustand";
import type { SortKey, ViewMode } from "@/lib/types";

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
