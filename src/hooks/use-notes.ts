"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { Note } from "@/lib/types";
import { useNotesStore, type BulkAction } from "@/store/notes-store";

const LIST_KEY = queryKeys.notes.list();

/** Every note for the signed-in user. The cache is the single source of truth. */
export function useNotes() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => api<Note[]>("/api/notes"),
  });
}

/** Reads one note out of the list cache rather than issuing a second request. */
export function useNote(id: string | null) {
  const { data } = useNotes();
  return useMemo(
    () => (id ? (data?.find((note) => note.id === id) ?? null) : null),
    [data, id],
  );
}

function writeList(client: QueryClient, update: (notes: Note[]) => Note[]) {
  client.setQueryData<Note[]>(LIST_KEY, (current) => update(current ?? []));
}

/**
 * All the write paths in one hook so components keep a single import. Each
 * mutation writes to the cache first and rolls back if the server disagrees.
 */
export function useNoteActions() {
  const client = useQueryClient();
  const select = useNotesStore((state) => state.select);

  const create = useMutation({
    mutationFn: (input: { category?: string; tags?: string[] }) =>
      api<Note>("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          title: "Untitled note",
          content: "",
          category: input.category ?? "Personal",
          tags: input.tags ?? [],
        }),
      }),
    onSuccess: (note) => {
      writeList(client, (notes) => [note, ...notes]);
      select(note.id);
    },
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Note> }) =>
      api<Note>(`/api/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
        // Typing offline must not lose the edit.
        queueWhenOffline: true,
      }),
    async onMutate({ id, patch }) {
      await client.cancelQueries({ queryKey: LIST_KEY });
      const previous = client.getQueryData<Note[]>(LIST_KEY);
      const now = new Date().toISOString();

      writeList(client, (notes) =>
        notes.map((note) =>
          note.id === id ? { ...note, ...patch, updatedAt: now } : note,
        ),
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(LIST_KEY, context.previous);
    },
  });

  const duplicate = useMutation({
    mutationFn: (source: Note) =>
      api<Note>("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          title: `${source.title} (copy)`,
          content: source.content,
          category: source.category,
          tags: source.tags,
        }),
      }),
    onSuccess: (note) => {
      writeList(client, (notes) => [note, ...notes]);
      select(note.id);
    },
  });

  const remove = useMutation({
    mutationFn: ({ id, permanent }: { id: string; permanent?: boolean }) =>
      api<Note | null>(`/api/notes/${id}${permanent ? "?permanent=true" : ""}`, {
        method: "DELETE",
      }),
    async onMutate({ id, permanent }) {
      await client.cancelQueries({ queryKey: LIST_KEY });
      const previous = client.getQueryData<Note[]>(LIST_KEY);
      const deletedAt = new Date().toISOString();

      writeList(client, (notes) =>
        permanent
          ? notes.filter((note) => note.id !== id)
          : notes.map((note) => (note.id === id ? { ...note, deletedAt } : note)),
      );

      if (useNotesStore.getState().selectedId === id) select(null);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(LIST_KEY, context.previous);
    },
  });

  const restore = useMutation({
    mutationFn: (id: string) =>
      api<Note>(`/api/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ deletedAt: null }),
      }),
    async onMutate(id) {
      await client.cancelQueries({ queryKey: LIST_KEY });
      const previous = client.getQueryData<Note[]>(LIST_KEY);
      writeList(client, (notes) =>
        notes.map((note) => (note.id === id ? { ...note, deletedAt: null } : note)),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) client.setQueryData(LIST_KEY, context.previous);
    },
  });

  const bulk = useMutation({
    mutationFn: ({ action, ids }: { action: BulkAction; ids: string[] }) =>
      api<Note[]>("/api/notes/bulk", {
        method: "POST",
        body: JSON.stringify({ action, ids }),
      }),
    async onMutate({ action, ids }) {
      await client.cancelQueries({ queryKey: LIST_KEY });
      const previous = client.getQueryData<Note[]>(LIST_KEY);

      writeList(client, (notes) =>
        notes
          .map((note) => {
            if (action !== "emptyTrash" && !ids.includes(note.id)) return note;
            switch (action) {
              case "archive":
                return { ...note, archived: true };
              case "unarchive":
                return { ...note, archived: false };
              case "favorite":
                return { ...note, favorite: true };
              case "unfavorite":
                return { ...note, favorite: false };
              case "pin":
                return { ...note, pinned: true };
              case "unpin":
                return { ...note, pinned: false };
              case "trash":
                return { ...note, deletedAt: new Date().toISOString() };
              case "restore":
                return { ...note, deletedAt: null };
              default:
                return note;
            }
          })
          .filter((note) =>
            action === "purge"
              ? !ids.includes(note.id)
              : action === "emptyTrash"
                ? !note.deletedAt
                : true,
          ),
      );

      useNotesStore.getState().clearSelection();
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(LIST_KEY, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: queryKeys.notes.all }),
  });

  return useMemo(
    () => ({
      createNote: (category?: string, tags?: string[]) =>
        create.mutateAsync({ category, tags }).then((note) => note?.id ?? null),
      updateNote: (id: string, patch: Partial<Note>) => update.mutate({ id, patch }),
      duplicateNote: (source: Note) => duplicate.mutate(source),
      deleteNote: (id: string, permanent?: boolean) => remove.mutate({ id, permanent }),
      restoreNote: (id: string) => restore.mutate(id),
      bulk: (action: BulkAction, ids: string[]) => bulk.mutate({ action, ids }),
    }),
    [create, update, duplicate, remove, restore, bulk],
  );
}

/**
 * Typing writes to the cache on every keystroke but only reaches the server
 * once the user pauses, which is what the old store's `scheduleSync` did.
 */
export function useNoteAutosave() {
  const client = useQueryClient();
  const { updateNote } = useNoteActions();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
    };
  }, []);

  return useCallback(
    (id: string, patch: Partial<Note>, delay = 500) => {
      const now = new Date().toISOString();
      writeList(client, (notes) =>
        notes.map((note) =>
          note.id === id ? { ...note, ...patch, updatedAt: now } : note,
        ),
      );

      const existing = timers.current.get(id);
      if (existing) clearTimeout(existing);

      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          updateNote(id, patch);
        }, delay),
      );
    },
    [client, updateNote],
  );
}

/** Warms the cache before a click — used on card hover and touch-start. */
export function usePrefetchNotes() {
  const client = useQueryClient();
  return useCallback(
    () =>
      client.prefetchQuery({
        queryKey: LIST_KEY,
        queryFn: () => api<Note[]>("/api/notes"),
      }),
    [client],
  );
}
