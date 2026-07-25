"use client";

import { create } from "zustand";
import type { Note, NoteFilter, ViewMode } from "@/lib/types";

type NotesState = {
  notes: Note[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  selectedId: string | null;
  search: string;
  filter: NoteFilter;
  activeTag: string | null;
  view: ViewMode;
  sidebarOpen: boolean;
  listOpen: boolean;

  load: () => Promise<void>;
  select: (id: string | null) => void;
  setSearch: (value: string) => void;
  setFilter: (filter: NoteFilter) => void;
  setActiveTag: (tag: string | null) => void;
  setView: (view: ViewMode) => void;
  toggleSidebar: () => void;
  toggleList: () => void;

  createNote: () => Promise<void>;
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
  filter: { kind: "all" },
  activeTag: null,
  view: "list",
  sidebarOpen: true,
  listOpen: true,

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
            : (notes.find((note) => !note.archived)?.id ?? null),
      }));
    } catch (error) {
      set({ status: "error", error: (error as Error).message });
    }
  },

  select: (selectedId) => set({ selectedId }),
  setSearch: (search) => set({ search }),
  setFilter: (filter) => set({ filter, activeTag: null }),
  setActiveTag: (activeTag) => set({ activeTag }),
  setView: (view) => set({ view }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleList: () => set((state) => ({ listOpen: !state.listOpen })),

  async createNote() {
    const { filter } = get();
    const category = filter.kind === "category" ? filter.value : "Personal";
    const draft = { title: "Untitled note", content: "", category, tags: [] as string[] };

    const response = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!response.ok) return;

    const note: Note = await response.json();
    set((state) => ({ notes: [note, ...state.notes], selectedId: note.id }));
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

/** Notes after search, filter and tag are applied, pinned first. */
export function selectVisibleNotes(state: NotesState) {
  const query = state.search.trim().toLowerCase();

  return state.notes
    .filter((note) => {
      switch (state.filter.kind) {
        case "favorites":
          if (!note.favorite || note.archived) return false;
          break;
        case "pinned":
          if (!note.pinned || note.archived) return false;
          break;
        case "category":
          if (note.category !== state.filter.value) return false;
          break;
        default:
          if (note.archived) return false;
      }

      if (state.activeTag && !note.tags.includes(state.activeTag)) return false;

      if (query) {
        const haystack = [note.title, note.content, note.tags.join(" ")]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

export function selectAllTags(state: NotesState) {
  const tags = new Set<string>();
  for (const note of state.notes) for (const tag of note.tags) tags.add(tag);
  return [...tags].sort();
}

export function selectCategoryCounts(state: NotesState) {
  const counts: Record<string, number> = {};
  for (const note of state.notes) {
    counts[note.category] = (counts[note.category] ?? 0) + 1;
  }
  return counts;
}
