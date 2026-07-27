import { parseIcsDate, toIcsDate } from "./recurrence";
import type { CalendarEvent, EventColor } from "./types";
import { EVENT_COLORS } from "./types";

/**
 * iCalendar, hand-rolled for the part of RFC 5545 this app actually writes and
 * reads: VEVENTs with a summary, description, location, start, end and an
 * optional RRULE. A full parser is a large dependency for a format we only use
 * two corners of, and the corners we use are exactly the ones already modelled
 * in `lib/recurrence.ts`.
 */

const CRLF = "\r\n";

/** Commas, semicolons and newlines carry meaning in a property value. */
function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function unescapeText(value: string) {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/**
 * Lines are limited to 75 octets, continued by a space on the next line. Folding
 * counts bytes rather than characters, so a multi-byte character is never split
 * down the middle.
 */
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const out: string[] = [];
  let start = 0;

  while (start < bytes.length) {
    // 75 on the first line, 74 after, to leave room for the leading space.
    let end = Math.min(start + (out.length ? 74 : 75), bytes.length);
    // Back off if the cut landed inside a UTF-8 sequence.
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end -= 1;
    out.push(bytes.subarray(start, end).toString("utf8"));
    start = end;
  }

  return out.join(`${CRLF} `);
}

function allDayStamp(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

export function toIcs(events: CalendarEvent[], calendarName = "Square Notes") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Square Notes//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const event of events) {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@square-notes`);
    lines.push(`DTSTAMP:${toIcsDate(new Date(event.createdAt))}`);

    if (event.allDay) {
      // An all-day DTEND is exclusive, so it points at the following morning.
      const exclusiveEnd = new Date(end);
      exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${allDayStamp(start)}`);
      lines.push(`DTEND;VALUE=DATE:${allDayStamp(exclusiveEnd)}`);
    } else {
      lines.push(`DTSTART:${toIcsDate(start)}`);
      lines.push(`DTEND:${toIcsDate(end)}`);
    }

    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    if (event.recurrence) lines.push(`RRULE:${event.recurrence}`);
    // Colour is ours, not the spec's, so it travels as an X- property and is
    // ignored by every other calendar.
    lines.push(`X-SQUARE-COLOR:${event.color}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join(CRLF)}${CRLF}`;
}

export type ImportedEvent = {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color: EventColor;
  recurrence: string | null;
};

/** Reverses the fold: a line beginning with a space continues the one before. */
function unfold(text: string) {
  const lines: string[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && lines.length) {
      lines[lines.length - 1] += raw.slice(1);
    } else {
      lines.push(raw);
    }
  }
  return lines;
}

/** `DTSTART;VALUE=DATE:20260731` → name, parameters, value. */
function splitProperty(line: string) {
  const colon = line.indexOf(":");
  if (colon === -1) return null;

  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...params] = head.split(";");

  return {
    name: name.trim().toUpperCase(),
    params: params.map((param) => param.trim().toUpperCase()),
    value,
  };
}

/**
 * Every VEVENT a file contains, as drafts ready to be inserted. Anything
 * without a summary and a start is skipped rather than guessed at.
 */
export function parseIcs(text: string): ImportedEvent[] {
  const out: ImportedEvent[] = [];
  let current: Partial<ImportedEvent> & { dtEnd?: Date; dtStart?: Date } = {};
  let inEvent = false;

  for (const line of unfold(text)) {
    const property = splitProperty(line);
    if (!property) continue;

    if (property.name === "BEGIN" && property.value.toUpperCase() === "VEVENT") {
      inEvent = true;
      current = {};
      continue;
    }

    if (property.name === "END" && property.value.toUpperCase() === "VEVENT") {
      inEvent = false;

      if (current.title && current.dtStart) {
        const start = current.dtStart;
        const end = current.dtEnd ?? new Date(start.getTime() + 3_600_000);

        out.push({
          title: current.title,
          description: current.description ?? "",
          location: current.location ?? "",
          startsAt: start.toISOString(),
          // An all-day DTEND is exclusive; ours is the last moment shown.
          endsAt: (current.allDay
            ? new Date(end.getTime() - 86_400_000)
            : end
          ).toISOString(),
          allDay: Boolean(current.allDay),
          color: current.color ?? "violet",
          recurrence: current.recurrence ?? null,
        });
      }

      current = {};
      continue;
    }

    if (!inEvent) continue;

    switch (property.name) {
      case "SUMMARY":
        current.title = unescapeText(property.value).trim();
        break;
      case "DESCRIPTION":
        current.description = unescapeText(property.value);
        break;
      case "LOCATION":
        current.location = unescapeText(property.value);
        break;
      case "DTSTART":
        current.dtStart = parseIcsDate(property.value);
        current.allDay = property.params.includes("VALUE=DATE");
        break;
      case "DTEND":
        current.dtEnd = parseIcsDate(property.value);
        break;
      case "RRULE":
        current.recurrence = property.value.trim();
        break;
      case "X-SQUARE-COLOR": {
        const colour = property.value.trim().toLowerCase();
        if ((EVENT_COLORS as readonly string[]).includes(colour)) {
          current.color = colour as EventColor;
        }
        break;
      }
    }
  }

  return out;
}
