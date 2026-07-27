"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type NoteVersion = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
};

export type NoteHistory = {
  current: { title: string; content: string; updatedAt: string };
  versions: NoteVersion[];
};

/** Snapshots of a note. Only fetched once the history sheet is opened. */
export function useNoteHistory(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notes.history(id ?? "none"),
    queryFn: () => api<NoteHistory>(`/api/notes/${id}/versions`),
    enabled: Boolean(id) && enabled,
  });
}

export type Share = {
  url: string;
  token: string;
  expiresAt: string | null;
  createdAt: string;
};

/** The public link for a note, if it has one. */
export function useShare(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notes.share(id ?? "none"),
    queryFn: () => api<{ share: Share | null }>(`/api/notes/${id}/share`),
    select: (data) => data.share,
    enabled: Boolean(id) && enabled,
  });
}

export function useShareActions(id: string) {
  const client = useQueryClient();

  const write = (share: Share | null) =>
    client.setQueryData(queryKeys.notes.share(id), { share });

  const create = useMutation({
    mutationFn: (duration: string) =>
      api<{ share: Share }>(`/api/notes/${id}/share`, {
        method: "POST",
        body: JSON.stringify({ duration }),
      }),
    onSuccess: (data) => write(data.share),
  });

  const revoke = useMutation({
    mutationFn: () => api<{ share: null }>(`/api/notes/${id}/share`, { method: "DELETE" }),
    onSuccess: () => write(null),
  });

  return {
    share: (duration: string) => create.mutate(duration),
    revoke: () => revoke.mutate(),
    working: create.isPending || revoke.isPending,
  };
}
