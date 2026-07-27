"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
  type QueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import {
  noteListDescriptor,
  noteMatchesList,
  sortNotesForList,
} from "@/lib/note-cache";
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
    refetchInterval: 30_000,
    // Keeps the previous view on screen while the next one loads.
    placeholderData: (previous) => previous,
  });
}

/** Workspace-wide counts and tags, which pagination can no longer derive. */
export function useSummary() {
  return useQuery({
    queryKey: queryKeys.notes.summary(),
    queryFn: () => api<Summary>("/api/notes/summary"),
    refetchInterval: 30_000,
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
  const current =
    cachedNotes(client).get(id) ??
    client.getQueryData<Note>(queryKeys.notes.detail(id));
  if (!current) return;

  const next = { ...current, ...patch };
  transitionSummary(client, current, next);
  reconcileNoteCaches(client, next);
  client.setQueryData<Note>(queryKeys.notes.detail(id), next);
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
  client.setQueryData<NotePage>([...queryKeys.notes.all, "due"], (page) =>
    page
      ? { ...page, notes: page.notes.filter((note) => !gone.has(note.id)) }
      : page,
  );
  client.setQueriesData<NotePage>(
    { queryKey: [...queryKeys.notes.all, "search"] },
    (page) =>
      page
        ? { ...page, notes: page.notes.filter((note) => !gone.has(note.id)) }
        : page,
  );
  client.setQueryData<{ titles: Array<{ id: string; title: string }> }>(
    queryKeys.notes.titles(),
    (data) =>
      data
        ? { titles: data.titles.filter((note) => !gone.has(note.id)) }
        : data,
  );
  for (const id of ids) client.removeQueries({ queryKey: queryKeys.notes.detail(id) });
}

/** Adds, moves, updates, or removes a note in every cached filtered feed. */
function reconcileNoteCaches(client: QueryClient, note: Note) {
  const feeds = client.getQueriesData<NoteFeed>({ queryKey: queryKeys.notes.lists() });

  for (const [key, feed] of feeds) {
    if (!feed) continue;
    const list = noteListDescriptor(key);
    if (!list) continue;

    const existingPage = feed.pages.findIndex((page) =>
      page.notes.some((item) => item.id === note.id),
    );
    const pages = feed.pages.map((page) => ({
      ...page,
      notes: page.notes.filter((item) => item.id !== note.id),
    }));

    if (noteMatchesList(note, list) && pages.length > 0) {
      const targetPage = existingPage >= 0 ? existingPage : 0;
      pages[targetPage] = {
        ...pages[targetPage],
        notes: sortNotesForList([...pages[targetPage].notes, note], list),
      };
    }

    client.setQueryData<NoteFeed>(key, { ...feed, pages });
  }

  client.setQueryData<NotePage>([...queryKeys.notes.all, "due"], (page) => {
    if (!page) return page;
    const notes = page.notes.filter((item) => item.id !== note.id);
    if (!note.deletedAt && !note.archived && note.dueAt) notes.push(note);
    return {
      ...page,
      notes: notes.sort(
        (a, b) =>
          (a.dueAt ?? "").localeCompare(b.dueAt ?? "") ||
          b.id.localeCompare(a.id),
      ),
    };
  });

  const searches = client.getQueriesData<NotePage>({
    queryKey: [...queryKeys.notes.all, "search"],
  });
  for (const [key, page] of searches) {
    if (!page) continue;
    const search = String(key[2] ?? "");
    const list = { kind: "all", value: null, search, sort: "updated" as const };
    const notes = page.notes.filter((item) => item.id !== note.id);
    if (noteMatchesList(note, list)) notes.push(note);
    client.setQueryData<NotePage>(key, {
      ...page,
      notes: sortNotesForList(notes, list).slice(0, 6),
    });
  }

  client.setQueryData<{ titles: Array<{ id: string; title: string }> }>(
    queryKeys.notes.titles(),
    (data) => {
      if (!data) return data;
      const titles = data.titles.filter((item) => item.id !== note.id);
      if (!note.deletedAt) titles.unshift({ id: note.id, title: note.title });
      return { titles: titles.slice(0, 500) };
    },
  );
}

function noteContribution(note: Note | null) {
  const live = Boolean(note && !note.deletedAt);
  const active = Boolean(live && note && !note.archived);
  const words =
    active && note?.content.trim()
      ? note.content.trim().split(/\s+/).length
      : 0;

  return {
    total: active ? 1 : 0,
    favorites: active && note?.favorite ? 1 : 0,
    pinned: active && note?.pinned ? 1 : 0,
    archived: live && note?.archived ? 1 : 0,
    trashed: note?.deletedAt ? 1 : 0,
    words,
    category: active ? note?.category ?? null : null,
    tags: active ? note?.tags ?? [] : [],
  };
}

/** Keeps sidebar/header aggregates in lockstep with an optimistic note change. */
function transitionSummary(
  client: QueryClient,
  before: Note | null,
  after: Note | null,
) {
  const previous = noteContribution(before);
  const next = noteContribution(after);

  client.setQueryData<Summary>(queryKeys.notes.summary(), (summary) => {
    if (!summary) return summary;

    const categories = { ...summary.categories };
    if (previous.category) {
      categories[previous.category] = Math.max(
        0,
        (categories[previous.category] ?? 0) - 1,
      );
    }
    if (next.category) {
      categories[next.category] = (categories[next.category] ?? 0) + 1;
    }

    const tagCounts = new Map(
      summary.tags.map((entry) => [entry.tag, { ...entry, titles: [...entry.titles] }]),
    );
    for (const tag of previous.tags) {
      const entry = tagCounts.get(tag);
      if (entry) entry.count = Math.max(0, entry.count - 1);
    }
    for (const tag of next.tags) {
      const entry = tagCounts.get(tag);
      if (entry) entry.count += 1;
      else tagCounts.set(tag, { tag, count: 1, titles: after ? [after.title] : [] });
    }

    return {
      counts: {
        total: Math.max(0, summary.counts.total - previous.total + next.total),
        favorites: Math.max(
          0,
          summary.counts.favorites - previous.favorites + next.favorites,
        ),
        pinned: Math.max(0, summary.counts.pinned - previous.pinned + next.pinned),
        archived: Math.max(
          0,
          summary.counts.archived - previous.archived + next.archived,
        ),
        trashed: Math.max(
          0,
          summary.counts.trashed - previous.trashed + next.trashed,
        ),
        words: Math.max(0, summary.counts.words - previous.words + next.words),
      },
      categories,
      tags: [...tagCounts.values()]
        .filter((entry) => entry.count > 0)
        .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
    };
  });
}

/** Prepends a new note to the first page of every cached list. */
function prependToCaches(client: QueryClient, note: Note) {
  reconcileNoteCaches(client, note);
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
    client.getQueriesData({ queryKey: queryKeys.notes.all }) as Array<
      [QueryKey, unknown]
    >;

  const restore = (previous: ReturnType<typeof snapshot>) => {
    for (const [key, data] of previous) client.setQueryData(key, data);
  };

  const settle = () => {
    // Includes feeds, details, due notes, search, links, history and summaries.
    void client.invalidateQueries({ queryKey: queryKeys.notes.all });
    void client.invalidateQueries({ queryKey: queryKeys.account.all });
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
      transitionSummary(client, null, note);
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
      await client.cancelQueries({ queryKey: queryKeys.notes.all });
      const previous = snapshot();
      patchCaches(client, id, { ...patch, updatedAt: new Date().toISOString() });
      return { previous };
    },
    onError: (_error, _variables, context) => context && restore(context.previous),
    onSuccess: (note) => {
      reconcileNoteCaches(client, note);
      client.setQueryData(queryKeys.notes.detail(note.id), note);
    },
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
      transitionSummary(client, null, note);
      prependToCaches(client, note);
      client.setQueryData(queryKeys.notes.detail(note.id), note);
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
      await client.cancelQueries({ queryKey: queryKeys.notes.all });
      const previous = snapshot();
      const previousSelectedId = useNotesStore.getState().selectedId;
      const current = cachedNotes(client).get(id) ?? null;

      if (permanent) {
        transitionSummary(client, current, null);
        removeFromCaches(client, [id]);
      }
      else patchCaches(client, id, { deletedAt: new Date().toISOString() });

      if (useNotesStore.getState().selectedId === id) select(null);
      return { previous, previousSelectedId };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      restore(context.previous);
      select(context.previousSelectedId);
    },
    onSuccess: (note, { id, permanent }) => {
      if (permanent || !note) removeFromCaches(client, [id]);
      else reconcileNoteCaches(client, note);
    },
    onSettled: settle,
  });

  const restoreNote = useMutation({
    mutationFn: (id: string) =>
      api<Note>(`/api/notes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ deletedAt: null }),
      }),
    async onMutate(id) {
      await client.cancelQueries({ queryKey: queryKeys.notes.all });
      const previous = snapshot();
      patchCaches(client, id, { deletedAt: null });
      return { previous };
    },
    onError: (_error, _id, context) => context && restore(context.previous),
    onSuccess: (note) => {
      reconcileNoteCaches(client, note);
      client.setQueryData(queryKeys.notes.detail(note.id), note);
    },
    onSettled: settle,
  });

  const bulk = useMutation({
    mutationFn: ({ action, ids }: { action: BulkAction; ids: string[] }) =>
      api<Note[]>("/api/notes/bulk", {
        method: "POST",
        body: JSON.stringify({ action, ids }),
      }),
    async onMutate({ action, ids }) {
      await client.cancelQueries({ queryKey: queryKeys.notes.all });
      const previous = snapshot();
      const previousSelection = {
        selectMode: useNotesStore.getState().selectMode,
        selectedIds: new Set(useNotesStore.getState().selectedIds),
      };

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
      if (action === "purge") {
        const current = cachedNotes(client);
        for (const id of ids) transitionSummary(client, current.get(id) ?? null, null);
        removeFromCaches(client, ids);
      }
      if (action === "emptyTrash") {
        const current = cachedNotes(client);
        const trashed = [...current.values()]
          .filter((note) => note.deletedAt)
          .map((note) => note.id);
        for (const id of trashed) transitionSummary(client, current.get(id) ?? null, null);
        client.setQueryData<Summary>(queryKeys.notes.summary(), (summary) =>
          summary
            ? { ...summary, counts: { ...summary.counts, trashed: 0 } }
            : summary,
        );
        removeFromCaches(client, trashed);
      }

      useNotesStore.getState().clearSelection();
      return { previous, previousSelection };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      restore(context.previous);
      useNotesStore.setState(context.previousSelection);
    },
    onSuccess: (result) => {
      if (Array.isArray(result)) {
        for (const note of result) {
          reconcileNoteCaches(client, note);
          client.setQueryData(queryKeys.notes.detail(note.id), note);
        }
      }
    },
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
