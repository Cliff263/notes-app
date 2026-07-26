"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { noteQueryParams, queryKeys, type NoteQuery } from "@/lib/query-keys";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { Note } from "@/lib/types";
import { useNotesStore, type BulkAction } from "@/store/notes-store";

export type NotePage = { notes: Note[]; nextCursor: string | null };
type NoteFeed = InfiniteData<NotePage>;

export type Summary = {
  counts: {
    total: number;
    favorites: number;
    pinned: number;
    archived: number;
    trashed: number;
    words: number;
  };
  categories: Record<string, number>;
  tags: Array<{ tag: string; count: number; titles: string[] }>;
};

/**
 * One page of notes at a time, filtered and ordered in SQL. Paging in the
 * database is what keeps a filtered view honest — a client-side filter over
 * one page would silently hide matches further down.
 */
export function useNotesFeed(query: NoteQuery) {
  return useInfiniteQuery({
    queryKey: queryKeys.notes.list(query),
    queryFn: ({ pageParam }) => {
      const params = noteQueryParams(query);
      if (pageParam) params.set("cursor", pageParam as string);
      return api<NotePage>(`/api/notes?${params}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    // Keeps the previous view on screen while the next one loads.
    placeholderData: (previous) => previous,
  });
}

/** Workspace-wide counts and tags, which pagination can no longer derive. */
export function useSummary() {
  return useQuery({
    queryKey: queryKeys.notes.summary(),
    queryFn: () => api<Summary>("/api/notes/summary"),
  });
}

/** Every note currently cached, across all list variants. */
function cachedNotes(client: QueryClient) {
  const feeds = client.getQueriesData<NoteFeed>({ queryKey: queryKeys.notes.lists() });
  const seen = new Map<string, Note>();

  for (const [, feed] of feeds) {
    for (const page of feed?.pages ?? []) {
      for (const note of page.notes) if (!seen.has(note.id)) seen.set(note.id, note);
    }
  }
  return seen;
}

/**
 * The open note may not be in the loaded page — after a filter change, say —
 * so the cache is checked first and a detail request only fires if it misses.
 */
export function useNote(id: string | null) {
  const client = useQueryClient();
  const feeds = client.getQueriesData<NoteFeed>({ queryKey: queryKeys.notes.lists() });

  const fromFeed = useMemo(() => {
    if (!id) return null;
    for (const [, feed] of feeds) {
      for (const page of feed?.pages ?? []) {
        const found = page.notes.find((note) => note.id === id);
        if (found) return found;
      }
    }
    return null;
  }, [feeds, id]);

  const { data: detail } = useQuery({
    queryKey: id ? queryKeys.notes.detail(id) : ["notes", "detail", "none"],
    queryFn: () => api<Note>(`/api/notes/${id}`),
    enabled: Boolean(id) && !fromFeed,
  });

  return fromFeed ?? detail ?? null;
}

/** Applies an edit to every cached list and to the detail entry. */
function patchCaches(client: QueryClient, id: string, patch: Partial<Note>) {
  client.setQueriesData<NoteFeed>({ queryKey: queryKeys.notes.lists() }, (feed) =>
    feed
      ? {
          ...feed,
          pages: feed.pages.map((page) => ({
            ...page,
            notes: page.notes.map((note) =>
              note.id === id ? { ...note, ...patch } : note,
            ),
          })),
        }
      : feed,
  );

  client.setQueryData<Note>(queryKeys.notes.detail(id), (note) =>
    note ? { ...note, ...patch } : note,
  );
}

function removeFromCaches(client: QueryClient, ids: string[]) {
  const gone = new Set(ids);
  client.setQueriesData<NoteFeed>({ queryKey: queryKeys.notes.lists() }, (feed) =>
    feed
      ? {
          ...feed,
          pages: feed.pages.map((page) => ({
            ...page,
            notes: page.notes.filter((note) => !gone.has(note.id)),
          })),
        }
      : feed,
  );
}

/** Prepends a new note to the first page of every cached list. */
function prependToCaches(client: QueryClient, note: Note) {
  client.setQueriesData<NoteFeed>({ queryKey: queryKeys.notes.lists() }, (feed) =>
    feed
      ? {
          ...feed,
          pages: feed.pages.map((page, index) =>
            index === 0 ? { ...page, notes: [note, ...page.notes] } : page,
          ),
        }
      : feed,
  );
}

/**
 * All the write paths in one hook so components keep a single import. Each
 * mutation writes to the cache first and rolls back if the server disagrees,
 * then invalidates so membership of a filtered view is re-decided in SQL.
 */
export function useNoteActions() {
  const client = useQueryClient();
  const select = useNotesStore((state) => state.select);

  const snapshot = () =>
    client.getQueriesData<NoteFeed>({ queryKey: queryKeys.notes.lists() });

  const restore = (previous: ReturnType<typeof snapshot>) => {
    for (const [key, feed] of previous) client.setQueryData(key, feed);
  };

  const settle = () => {
    void client.invalidateQueries({ queryKey: queryKeys.notes.lists() });
    void client.invalidateQueries({ queryKey: queryKeys.notes.summary() });
    // A title change makes every `[[link]]` resolve differently.
    void client.invalidateQueries({ queryKey: queryKeys.notes.titles() });
  };

  const create = useMutation({
    mutationFn: (input: { category?: string; tags?: string[]; title?: string }) =>
      api<Note>("/api/notes", {
        method: "POST",
        body: JSON.stringify({
          title: input.title ?? "Untitled note",
          content: "",
          category: input.category ?? "Personal",
          tags: input.tags ?? [],
        }),
      }),
    onSuccess: (note) => {
      prependToCaches(client, note);
      client.setQueryData(queryKeys.notes.detail(note.id), note);
      select(note.id);
    },
    onSettled: settle,
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
      await client.cancelQueries({ queryKey: queryKeys.notes.lists() });
      const previous = snapshot();
      patchCaches(client, id, { ...patch, updatedAt: new Date().toISOString() });
      return { previous };
    },
    onError: (_error, _variables, context) => context && restore(context.previous),
    onSettled: settle,
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
      prependToCaches(client, note);
      select(note.id);
    },
    onSettled: settle,
  });

  const remove = useMutation({
    mutationFn: ({ id, permanent }: { id: string; permanent?: boolean }) =>
      api<Note | null>(`/api/notes/${id}${permanent ? "?permanent=true" : ""}`, {
        method: "DELETE",
      }),
    async onMutate({ id, permanent }) {
      await client.cancelQueries({ queryKey: queryKeys.notes.lists() });
      const previous = snapshot();

      if (permanent) removeFromCaches(client, [id]);
      else patchCaches(client, id, { deletedAt: new Date().toISOString() });

      if (useNotesStore.getState().selectedId === id) select(null);
      return { previous };
    },
    onError: (_error, _variables, context) => context && restore(context.previous),
    onSettled: settle,
  });

  const restoreNote = useMutation({
    mutationFn: (id: string) =>
      api<Note>(`/api/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ deletedAt: null }),
      }),
    async onMutate(id) {
      await client.cancelQueries({ queryKey: queryKeys.notes.lists() });
      const previous = snapshot();
      patchCaches(client, id, { deletedAt: null });
      return { previous };
    },
    onError: (_error, _id, context) => context && restore(context.previous),
    onSettled: settle,
  });

  const bulk = useMutation({
    mutationFn: ({ action, ids }: { action: BulkAction; ids: string[] }) =>
      api<Note[]>("/api/notes/bulk", {
        method: "POST",
        body: JSON.stringify({ action, ids }),
      }),
    async onMutate({ action, ids }) {
      await client.cancelQueries({ queryKey: queryKeys.notes.lists() });
      const previous = snapshot();

      const patch: Partial<Note> | null =
        action === "archive"
          ? { archived: true }
          : action === "unarchive"
            ? { archived: false }
            : action === "favorite"
              ? { favorite: true }
              : action === "unfavorite"
                ? { favorite: false }
                : action === "pin"
                  ? { pinned: true }
                  : action === "unpin"
                    ? { pinned: false }
                    : action === "trash"
                      ? { deletedAt: new Date().toISOString() }
                      : action === "restore"
                        ? { deletedAt: null }
                        : null;

      if (patch) for (const id of ids) patchCaches(client, id, patch);
      if (action === "purge") removeFromCaches(client, ids);
      if (action === "emptyTrash") {
        const trashed = [...cachedNotes(client).values()]
          .filter((note) => note.deletedAt)
          .map((note) => note.id);
        removeFromCaches(client, trashed);
      }

      useNotesStore.getState().clearSelection();
      return { previous };
    },
    onError: (_error, _variables, context) => context && restore(context.previous),
    onSettled: settle,
  });

  return useMemo(
    () => ({
      createNote: (category?: string, tags?: string[], title?: string) =>
        create.mutateAsync({ category, tags, title }).then((note) => note?.id ?? null),
      updateNote: (id: string, patch: Partial<Note>) => update.mutate({ id, patch }),
      duplicateNote: (source: Note) => duplicate.mutate(source),
      deleteNote: (id: string, permanent?: boolean) => remove.mutate({ id, permanent }),
      restoreNote: (id: string) => restoreNote.mutate(id),
      bulk: (action: BulkAction, ids: string[]) => bulk.mutate({ action, ids }),
    }),
    [create, update, duplicate, remove, restoreNote, bulk],
  );
}

/**
 * Typing writes to the cache on every keystroke but only reaches the server
 * once the user pauses.
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
      patchCaches(client, id, { ...patch, updatedAt: new Date().toISOString() });

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

/** Warms a note's detail entry before a click. */
export function usePrefetchNote() {
  const client = useQueryClient();
  return useCallback(
    (id: string) =>
      client.prefetchQuery({
        queryKey: queryKeys.notes.detail(id),
        queryFn: () => api<Note>(`/api/notes/${id}`),
        staleTime: 30_000,
      }),
    [client],
  );
}

/** Notes carrying a due date, for the calendar's side panel. */
export function useDueNotes() {
  return useQuery({
    queryKey: [...queryKeys.notes.all, "due"],
    queryFn: () => api<NotePage>("/api/notes?filter=due&limit=50"),
    select: (page) => page.notes,
  });
}

/**
 * Free-text search used by the command palette. Debounced, so a word typed at
 * speed is one ranked query rather than one per letter.
 */
export function useNoteSearch(term: string) {
  const search = useDebouncedValue(term.trim());
  return useQuery({
    queryKey: [...queryKeys.notes.all, "search", search],
    queryFn: () =>
      api<NotePage>(`/api/notes?q=${encodeURIComponent(search)}&limit=6`),
    select: (page) => page.notes,
    enabled: search.length > 1,
    placeholderData: (previous) => previous,
  });
}
