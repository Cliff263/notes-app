"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { CalendarEvent } from "@/lib/types";

const LIST_KEY = queryKeys.events.list();

export type EventDraft = {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color: string;
  noteId?: string | null;
  /** An RRULE subset, or null for a one-off. */
  recurrence?: string | null;
};

export function useEvents() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => api<CalendarEvent[]>("/api/events"),
    refetchInterval: 30_000,
  });
}

function sorted(events: CalendarEvent[]) {
  return [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function useEventActions() {
  const client = useQueryClient();

  const create = useMutation({
    mutationFn: (draft: EventDraft) =>
      api<CalendarEvent>("/api/events", {
        method: "POST",
        body: JSON.stringify(draft),
      }),
    async onMutate(draft) {
      await client.cancelQueries({ queryKey: LIST_KEY });
      const previous = client.getQueryData<CalendarEvent[]>(LIST_KEY);
      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      const optimistic: CalendarEvent = {
        ...draft,
        id: optimisticId,
        color: draft.color as CalendarEvent["color"],
        noteId: draft.noteId ?? null,
        recurrence: draft.recurrence ?? null,
        createdAt: new Date().toISOString(),
      };
      client.setQueryData<CalendarEvent[]>(LIST_KEY, (current) =>
        sorted([...(current ?? []), optimistic]),
      );
      return { previous, optimisticId };
    },
    onSuccess: (event, _draft, context) =>
      client.setQueryData<CalendarEvent[]>(LIST_KEY, (current) =>
        sorted([
          ...(current ?? []).filter((item) => item.id !== context?.optimisticId),
          event,
        ]),
      ),
    onError: (_error, _draft, context) =>
      client.setQueryData(LIST_KEY, context?.previous ?? []),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: LIST_KEY });
      void client.invalidateQueries({ queryKey: queryKeys.account.all });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: Partial<EventDraft> }) =>
      api<CalendarEvent>(`/api/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      }),
    async onMutate({ id, draft }) {
      await client.cancelQueries({ queryKey: LIST_KEY });
      const previous = client.getQueryData<CalendarEvent[]>(LIST_KEY);
      client.setQueryData<CalendarEvent[]>(LIST_KEY, (current) =>
        sorted(
          (current ?? []).map((event) =>
            event.id === id
              ? ({ ...event, ...draft } as CalendarEvent)
              : event,
          ),
        ),
      );
      return { previous };
    },
    onSuccess: (event) =>
      client.setQueryData<CalendarEvent[]>(LIST_KEY, (current) =>
        sorted((current ?? []).map((item) => (item.id === event.id ? event : item))),
      ),
    onError: (_error, _variables, context) =>
      client.setQueryData(LIST_KEY, context?.previous ?? []),
    onSettled: () => void client.invalidateQueries({ queryKey: LIST_KEY }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/events/${id}`, { method: "DELETE" }),
    async onMutate(id) {
      await client.cancelQueries({ queryKey: LIST_KEY });
      const previous = client.getQueryData<CalendarEvent[]>(LIST_KEY);
      client.setQueryData<CalendarEvent[]>(LIST_KEY, (current) =>
        (current ?? []).filter((event) => event.id !== id),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) client.setQueryData(LIST_KEY, context.previous);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: LIST_KEY });
      void client.invalidateQueries({ queryKey: queryKeys.account.all });
    },
  });

  return useMemo(
    () => ({
      createEvent: (draft: EventDraft) =>
        create.mutateAsync(draft).then(
          () => true,
          () => false,
        ),
      updateEvent: (id: string, draft: Partial<EventDraft>) =>
        update.mutateAsync({ id, draft }).then(
          () => true,
          () => false,
        ),
      deleteEvent: (id: string) => remove.mutate(id),
    }),
    [create, update, remove],
  );
}
