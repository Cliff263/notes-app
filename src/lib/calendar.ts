import type { CalendarEvent } from "./types";
import { startOfDay } from "./utils";

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

export const CALENDAR_VIEWS = ["month", "week", "day", "agenda"] as const;
export type CalendarViewKind = (typeof CALENDAR_VIEWS)[number];

export function isCalendarView(value: string | null): value is CalendarViewKind {
  return Boolean(value) && (CALENDAR_VIEWS as readonly string[]).includes(value!);
}

/** Sunday of the week the date falls in. */
export function startOfWeek(date: Date) {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * The window a view is showing, and what to call it. Everything else — which
 * occurrences to expand, what the heading says, how far the arrows step — is
 * derived from this one function, so a new view is a new case rather than a new
 * set of rules scattered around the component.
 */
export function rangeFor(view: CalendarViewKind, cursor: Date) {
  if (view === "week") {
    const from = startOfWeek(cursor);
    const to = addDays(from, 7);
    const sameMonth = from.getMonth() === addDays(to, -1).getMonth();

    return {
      from,
      to,
      days: Array.from({ length: 7 }, (_, index) => addDays(from, index)),
      title: sameMonth
        ? `${from.toLocaleDateString("en-US", { month: "long" })} ${from.getDate()}–${addDays(to, -1).getDate()}, ${from.getFullYear()}`
        : `${from.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${addDays(
            to,
            -1,
          ).toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${from.getFullYear()}`,
    };
  }

  if (view === "day") {
    const from = startOfDay(cursor);
    return {
      from,
      to: addDays(from, 1),
      days: [from],
      title: from.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
    };
  }

  if (view === "agenda") {
    const from = startOfDay(cursor);
    const to = addDays(from, 30);
    return { from, to, days: [], title: "The next 30 days" };
  }

  // Month, padded to the whole grid so an event on a leading or trailing day
  // is expanded too.
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const from = startOfWeek(first);
  return {
    from,
    to: addDays(from, 42),
    days: [],
    title: `${cursor.toLocaleDateString("en-US", { month: "long" })} ${cursor.getFullYear()}`,
  };
}

/** One step forward or back, in whatever unit the current view counts in. */
export function stepCursor(view: CalendarViewKind, cursor: Date, step: 1 | -1) {
  const next = new Date(cursor);

  if (view === "week") next.setDate(next.getDate() + step * 7);
  else if (view === "day") next.setDate(next.getDate() + step);
  else if (view === "agenda") next.setDate(next.getDate() + step * 30);
  else next.setMonth(next.getMonth() + step, 1);

  return next;
}

/** Where an event sits in a day column, as fractions of the day. */
export function dayPosition(event: CalendarEvent, day: Date) {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + 86_400_000;

  const start = Math.max(new Date(event.startsAt).getTime(), dayStart);
  const end = Math.min(new Date(event.endsAt).getTime(), dayEnd);

  const top = (start - dayStart) / 86_400_000;
  // Never thinner than a couple of minutes, or a short event would vanish.
  const height = Math.max((end - start) / 86_400_000, 0.015);

  return { top, height: Math.min(height, 1 - top) };
}

/**
 * Overlapping events, arranged into columns so neither hides the other. Simple
 * and good enough: events are grouped into runs that overlap, and each run is
 * shared out between as many columns as its busiest moment needs.
 */
export function layOutDay(events: CalendarEvent[]) {
  const sorted = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const placed: Array<{ event: CalendarEvent; column: number; columns: number }> = [];

  let run: CalendarEvent[] = [];
  let runEnd = 0;

  const flush = () => {
    const columnEnds: number[] = [];
    const assignments = run.map((event) => {
      const start = new Date(event.startsAt).getTime();
      let column = columnEnds.findIndex((end) => end <= start);
      if (column === -1) column = columnEnds.length;
      columnEnds[column] = new Date(event.endsAt).getTime();
      return { event, column };
    });

    for (const item of assignments) {
      placed.push({ ...item, columns: columnEnds.length });
    }
    run = [];
  };

  for (const event of sorted) {
    const start = new Date(event.startsAt).getTime();
    if (run.length && start >= runEnd) flush();

    run.push(event);
    runEnd = Math.max(runEnd, new Date(event.endsAt).getTime());
  }
  if (run.length) flush();

  return placed;
}
