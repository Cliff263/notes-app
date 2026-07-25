"use client";

import { create } from "zustand";
import type { CalendarEvent } from "@/lib/types";

export type EventDraft = {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color: string;
};

type EventsState = {
  events: CalendarEvent[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  load: () => Promise<void>;
  createEvent: (draft: EventDraft) => Promise<boolean>;
  updateEvent: (id: string, draft: Partial<EventDraft>) => Promise<boolean>;
  deleteEvent: (id: string) => Promise<void>;
};

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  status: "idle",
  error: null,

  async load() {
    set({ status: "loading" });
    try {
      const response = await fetch("/api/events");
      if (!response.ok) throw new Error("Could not load events");
      const events: CalendarEvent[] = await response.json();
      set({ events, status: "ready", error: null });
    } catch (error) {
      set({ status: "error", error: (error as Error).message });
    }
  },

  async createEvent(draft) {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!response.ok) return false;

    const event: CalendarEvent = await response.json();
    set((state) => ({ events: sortEvents([...state.events, event]) }));
    return true;
  },

  async updateEvent(id, draft) {
    const response = await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (!response.ok) return false;

    const event: CalendarEvent = await response.json();
    set((state) => ({
      events: sortEvents(state.events.map((item) => (item.id === id ? event : item))),
    }));
    return true;
  },

  async deleteEvent(id) {
    const previous = get().events;
    set((state) => ({ events: state.events.filter((event) => event.id !== id) }));

    const response = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (!response.ok) set({ events: previous });
  },
}));

function sortEvents(events: CalendarEvent[]) {
  return [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function selectEventsByDay(events: CalendarEvent[]) {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = dayKey(new Date(event.startsAt));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(event);
    else byDay.set(key, [event]);
  }
  return byDay;
}

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function selectUpcoming(events: CalendarEvent[], limit = 8) {
  const now = Date.now();
  return events
    .filter((event) => new Date(event.endsAt).getTime() >= now)
    .slice(0, limit);
}
