"use client";

import { create } from "zustand";
import type { Note, NoteFilter, SortKey, ViewMode } from "@/lib/types";

type NotesState = {
  notes: Note[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  selectedId: string | null;
  search: string;
  sort: SortKey;
  view: ViewMode;
  /** Desktop: the sidebar column is collapsible. */
  sidebarOpen: boolean;
  /** Below lg the sidebar is an overlay drawer instead. */
  drawerOpen: boolean;

  load: () => Promise<void>;
  select: (id: string | null) => void;
  setSearch: (value: string) => void;
  setSort: (sort: SortKey) => void;
  setView: (view: ViewMode) => void;
  toggleSidebar: () => void;
  setDrawerOpen: (open: boolean) => void;

  createNote: (category?: string, tags?: string[]) => Promise<string | null>;
  updateNote: (id: string, patch: Partial<Note>) => void;
  duplicateNote: (id: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
};

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Coalesces keystrokes into one PATCH per note. */
function scheduleSync(id: string, patch: Partial<Note>, delay = 500) {
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);

  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      void fetch(`/api/notes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    }, delay),
  );
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  status: "idle",
  error: null,

  selectedId: null,
  search: "",
  sort: "updated",
  view: "list",
  sidebarOpen: true,
  drawerOpen: false,

  async load() {
    set({ status: "loading" });
    try {
      const response = await fetch("/api/notes");
      if (!response.ok) throw new Error("Could not load notes");
      const notes: Note[] = await response.json();
      set((state) => ({
        notes,
        status: "ready",
        error: null,
        selectedId:
          state.selectedId && notes.some((note) => note.id === state.selectedId)
            ? state.selectedId
            : null,
      }));
    } catch (error) {
      set({ status: "error", error: (error as Error).message });
    }
  },

  select: (selectedId) => set({ selectedId }),
  setSearch: (search) => set({ search }),
  setSort: (sort) => set({ sort }),
  setView: (view) => set({ view }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setDrawerOpen: (drawerOpen) => set({ drawerOpen }),

  /** Seeds the new note with whatever the current route implies. */
  async createNote(category = "Personal", tags = []) {
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled note", content: "", category, tags }),
    });
    if (!response.ok) return null;

    const note: Note = await response.json();
    set((state) => ({ notes: [note, ...state.notes], selectedId: note.id }));
    return note.id;
  },

  updateNote(id, patch) {
    const now = new Date().toISOString();
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === id ? { ...note, ...patch, updatedAt: now } : note,
      ),
    }));
    scheduleSync(id, patch);
  },

  async duplicateNote(id) {
    const source = get().notes.find((note) => note.id === id);
    if (!source) return;

    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${source.title} (copy)`,
        content: source.content,
        category: source.category,
        tags: source.tags,
      }),
    });
    if (!response.ok) return;

    const note: Note = await response.json();
    set((state) => ({ notes: [note, ...state.notes], selectedId: note.id }));
  },

  async deleteNote(id) {
    const previous = get().notes;
    set((state) => ({
      notes: state.notes.filter((note) => note.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    }));

    const response = await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (!response.ok) set({ notes: previous });
  },
}));

/**
 * The route decides which notes are on screen, so filtering is a plain function
 * rather than store state.
 */
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

export function selectAllTags(state: NotesState) {
  const tags = new Set<string>();
  for (const note of state.notes) {
    if (!note.archived && !note.deletedAt) {
      for (const tag of note.tags) tags.add(tag);
    }
  }
  return [...tags].sort();
}

/** Tag name -> how many live notes carry it. */
export function selectTagCounts(state: NotesState) {
  const counts: Record<string, number> = {};
  for (const note of state.notes) {
    if (note.archived || note.deletedAt) continue;
    for (const tag of note.tags) counts[tag] = (counts[tag] ?? 0) + 1;
  }
  return counts;
}

export function selectCategoryCounts(state: NotesState) {
  const counts: Record<string, number> = {};
  for (const note of state.notes) {
    if (note.archived || note.deletedAt) continue;
    counts[note.category] = (counts[note.category] ?? 0) + 1;
  }
  return counts;
}

export function selectArchivedCount(state: NotesState) {
  return state.notes.filter((note) => note.archived && !note.deletedAt).length;
}

export function selectFavoriteCount(state: NotesState) {
  return state.notes.filter(
    (note) => note.favorite && !note.archived && !note.deletedAt,
  ).length;
}

export function selectPinnedCount(state: NotesState) {
  return state.notes.filter(
    (note) => note.pinned && !note.archived && !note.deletedAt,
  ).length;
}
