"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type NoteTitle = { id: string; title: string };
export type Backlink = { id: string; title: string; archived: boolean };

/**
 * Every note's id and title, so `[[Another note]]` can be resolved without a
 * round trip per link. Titles change rarely, so this sits in the cache for
 * minutes; creating or renaming a note invalidates it through `settle()`.
 */
export function useNoteTitles() {
  const query = useQuery({
    queryKey: queryKeys.notes.titles(),
    queryFn: () => api<{ titles: NoteTitle[] }>("/api/notes/titles"),
    select: (data) => data.titles,
    staleTime: 5 * 60_000,
  });

  const titles = useMemo(() => query.data ?? [], [query.data]);

  /** Lowercased title to id — links resolve however they were capitalised. */
  const byTitle = useMemo(() => {
    const map = new Map<string, NoteTitle>();
    for (const note of titles) {
      const key = note.title.trim().toLowerCase();
      if (key && !map.has(key)) map.set(key, note);
    }
    return map;
  }, [titles]);

  return { titles, byTitle };
}

/** The notes that link to this one. Only asked for once a note is open. */
export function useBacklinks(id: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.notes.backlinks(id ?? "none"),
    queryFn: () => api<{ backlinks: Backlink[] }>(`/api/notes/${id}/backlinks`),
    select: (data) => data.backlinks,
    enabled: Boolean(id) && enabled,
    staleTime: 5 * 60_000,
  });
}
