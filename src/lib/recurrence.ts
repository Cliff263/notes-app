import type { CalendarEvent } from "./types";

/**
 * A deliberately small subset of RFC 5545's RRULE: a frequency, an interval,
 * and an end condition. That covers "every weekday standup", "every other
 * Tuesday" and "my birthday" without dragging in a recurrence library, and it
 * is expressed as an RRULE string so an exported .ics needs no translation.
 *
 * What is missing, and knowingly so: BYDAY and friends, and per-occurrence
 * exceptions. Editing a repeating event edits the whole series.
 */
export const FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export type Recurrence = {
  freq: Frequency;
  /** Every n-th day/week/month/year. At least 1. */
  interval: number;
  /** Repeats stop after this instant, if set. */
  until: Date | null;
  /** Total number of occurrences, if set. */
  count: number | null;
};

/** No range expansion will ever produce more than this for one event. */
const MAX_OCCURRENCES = 400;

export function parseRecurrence(rule: string | null | undefined): Recurrence | null {
  if (!rule) return null;

  const parts = new Map<string, string>();
  for (const piece of rule.replace(/^RRULE:/i, "").split(";")) {
    const [key, value] = piece.split("=");
    if (key && value) parts.set(key.trim().toUpperCase(), value.trim());
  }

  const freq = parts.get("FREQ")?.toUpperCase();
  if (!freq || !FREQUENCIES.includes(freq as Frequency)) return null;

  const interval = Number(parts.get("INTERVAL") ?? 1);
  const count = parts.has("COUNT") ? Number(parts.get("COUNT")) : null;
  const until = parts.has("UNTIL") ? parseIcsDate(parts.get("UNTIL")!) : null;

  return {
    freq: freq as Frequency,
    interval: Number.isFinite(interval) && interval > 0 ? Math.floor(interval) : 1,
    count: count && Number.isFinite(count) && count > 0 ? Math.floor(count) : null,
    until: until && !Number.isNaN(until.getTime()) ? until : null,
  };
}

export function formatRecurrence(rule: Recurrence): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.count) parts.push(`COUNT=${rule.count}`);
  else if (rule.until) parts.push(`UNTIL=${toIcsDate(rule.until)}`);
  return parts.join(";");
}

/** `20260731T090000Z` and `20260731`, the two forms an .ics actually uses. */
export function parseIcsDate(value: string): Date {
  const utc = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!utc) return new Date(value);

  const [, year, month, day, hour = "0", minute = "0", second = "0", zulu] = utc;
  const parts = [
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ] as const;

  // Without a trailing Z the time is local to whoever wrote the file, and
  // reading it as local time is the closest we can get to their intent.
  return zulu ? new Date(Date.UTC(...parts)) : new Date(...parts);
}

export function toIcsDate(date: Date) {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/** "Every 2 weeks, 10 times" — what the editor shows under the picker. */
export function describeRecurrence(rule: Recurrence | null): string {
  if (!rule) return "Does not repeat";

  const unit = { DAILY: "day", WEEKLY: "week", MONTHLY: "month", YEARLY: "year" }[
    rule.freq
  ];
  const every =
    rule.interval === 1 ? `Every ${unit}` : `Every ${rule.interval} ${unit}s`;

  if (rule.count) return `${every}, ${rule.count} times`;
  if (rule.until) {
    return `${every}, until ${rule.until.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`;
  }
  return every;
}

function advance(date: Date, rule: Recurrence, steps: number) {
  const next = new Date(date);
  const amount = rule.interval * steps;

  if (rule.freq === "DAILY") next.setDate(next.getDate() + amount);
  else if (rule.freq === "WEEKLY") next.setDate(next.getDate() + amount * 7);
  else if (rule.freq === "MONTHLY") next.setMonth(next.getMonth() + amount);
  else next.setFullYear(next.getFullYear() + amount);

  return next;
}

/**
 * The occurrences of one event that fall inside a window.
 *
 * Rows stay single: an event that repeats is stored once, and every view asks
 * for the slice of time it is showing. Each occurrence carries a synthetic id
 * of `<id>@<start>` so React has a stable key, with `seriesId` pointing back at
 * the row that anyone editing it should actually edit.
 */
export function expandEvent(
  event: CalendarEvent,
  from: Date,
  to: Date,
): CalendarEvent[] {
  const rule = parseRecurrence(event.recurrence);
  const start = new Date(event.startsAt);
  const duration = new Date(event.endsAt).getTime() - start.getTime();

  if (!rule) {
    // A one-off is in range if it overlaps the window at all.
    return start.getTime() <= to.getTime() &&
      start.getTime() + duration >= from.getTime()
      ? [event]
      : [];
  }

  const out: CalendarEvent[] = [];

  for (let index = 0; index < MAX_OCCURRENCES; index += 1) {
    if (rule.count && index >= rule.count) break;

    const occurrenceStart = advance(start, rule, index);
    if (rule.until && occurrenceStart.getTime() > rule.until.getTime()) break;
    if (occurrenceStart.getTime() > to.getTime()) break;

    const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
    if (occurrenceEnd.getTime() < from.getTime()) continue;

    out.push({
      ...event,
      id: index === 0 ? event.id : `${event.id}@${occurrenceStart.toISOString()}`,
      seriesId: event.id,
      startsAt: occurrenceStart.toISOString(),
      endsAt: occurrenceEnd.toISOString(),
    });
  }

  return out;
}

/** Every event's occurrences inside a window, in start order. */
export function expandEvents(events: CalendarEvent[], from: Date, to: Date) {
  return events
    .flatMap((event) => expandEvent(event, from, to))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** Whatever a request sent, reduced to the rule we can honour, or null. */
export function normaliseRecurrence(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const rule = parseRecurrence(value);
  return rule ? formatRecurrence(rule) : null;
}

/** The row to edit when an occurrence is clicked. */
export function seriesIdOf(event: CalendarEvent) {
  return event.seriesId ?? event.id;
}
