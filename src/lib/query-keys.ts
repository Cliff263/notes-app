import type { NoteFilter, SortKey } from "./types";

/** The parameters that make one note list different from another. */
export type NoteQuery = {
  filter: NoteFilter;
  search: string;
  sort: SortKey;
};

export function noteQueryParams({ filter, search, sort }: NoteQuery) {
  const params = new URLSearchParams({ filter: filter.kind, sort });
  if ("value" in filter) params.set("value", filter.value);
  if (search.trim()) params.set("q", search.trim());
  return params;
}

/**
 * Every cache key in one place, so invalidation never has to guess at a string
 * shape. Keys are hierarchical: invalidating `notes.all` clears every list,
 * detail and summary beneath it.
 */
export const queryKeys = {
  notes: {
    all: ["notes"] as const,
    lists: () => [...queryKeys.notes.all, "list"] as const,
    list: (query: NoteQuery) =>
      [
        ...queryKeys.notes.lists(),
        query.filter.kind,
        "value" in query.filter ? query.filter.value : null,
        query.search.trim(),
        query.sort,
      ] as const,
    detail: (id: string) => [...queryKeys.notes.all, "detail", id] as const,
    summary: () => [...queryKeys.notes.all, "summary"] as const,
    /** Id and title of every note, for resolving `[[wiki links]]`. */
    titles: () => [...queryKeys.notes.all, "titles"] as const,
    backlinks: (id: string) => [...queryKeys.notes.all, "backlinks", id] as const,
    history: (id: string) => [...queryKeys.notes.all, "history", id] as const,
    share: (id: string) => [...queryKeys.notes.all, "share", id] as const,
  },
  events: {
    all: ["events"] as const,
    list: () => [...queryKeys.events.all, "list"] as const,
  },
  account: {
    all: ["account"] as const,
    detail: () => [...queryKeys.account.all, "detail"] as const,
  },
} as const;
