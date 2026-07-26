import type { CalendarEvent } from "./types";

/** Stable per-day key for grouping, independent of timezone formatting. */
export function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function eventsByDay(events: CalendarEvent[]) {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = dayKey(new Date(event.startsAt));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(event);
    else byDay.set(key, [event]);
  }
  return byDay;
}

export function upcomingEvents(events: CalendarEvent[], from = Date.now(), limit = 8) {
  return events
    .filter((event) => new Date(event.endsAt).getTime() >= from)
    .slice(0, limit);
}
