/**
 * Every cache key in one place, so invalidation never has to guess at a string
 * shape. Keys are hierarchical: invalidating `notes.all` clears the list and
 * every individual note beneath it.
 */
export const queryKeys = {
  notes: {
    all: ["notes"] as const,
    list: () => [...queryKeys.notes.all, "list"] as const,
    detail: (id: string) => [...queryKeys.notes.all, "detail", id] as const,
    search: (query: string) => [...queryKeys.notes.all, "search", query] as const,
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
