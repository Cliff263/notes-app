import { describe, expect, it } from "vitest";
import { parseIcs, toIcs } from "./ics";
import type { CalendarEvent } from "./types";

const event: CalendarEvent = {
  id: "e1",
  title: "Standup, daily",
  description: "Line one\nLine two",
  location: "Room 2; upstairs",
  startsAt: "2026-03-02T09:00:00.000Z",
  endsAt: "2026-03-02T09:15:00.000Z",
  allDay: false,
  color: "cyan",
  noteId: null,
  createdAt: "2026-03-01T09:00:00.000Z",
  recurrence: "FREQ=WEEKLY;INTERVAL=2",
};

describe("toIcs", () => {
  it("writes a calendar a reader can find its way around", () => {
    const ics = toIcs([event]);

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20260302T090000Z");
    expect(ics).toContain("DTEND:20260302T091500Z");
    expect(ics).toContain("RRULE:FREQ=WEEKLY;INTERVAL=2");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("escapes the characters that carry meaning", () => {
    const ics = toIcs([event]);
    expect(ics).toContain("SUMMARY:Standup\\, daily");
    expect(ics).toContain("LOCATION:Room 2\\; upstairs");
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two");
  });

  it("uses CRLF, as the format requires", () => {
    expect(toIcs([event]).split("\r\n").length).toBeGreaterThan(5);
    expect(/[^\r]\n/.test(toIcs([event]))).toBe(false);
  });

  it("folds a long line and never splits a character down the middle", () => {
    const long = { ...event, title: "é".repeat(200) };
    const lines = toIcs([long]).split("\r\n");

    for (const line of lines) {
      expect(Buffer.from(line, "utf8").length).toBeLessThanOrEqual(76);
    }
    // Folding is only folding if it survives being read back.
    expect(parseIcs(toIcs([long]))[0].title).toBe("é".repeat(200));
  });
});

describe("parseIcs", () => {
  it("round-trips an event through the format", () => {
    const [parsed] = parseIcs(toIcs([event]));

    expect(parsed.title).toBe("Standup, daily");
    expect(parsed.description).toBe("Line one\nLine two");
    expect(parsed.location).toBe("Room 2; upstairs");
    expect(parsed.startsAt).toBe("2026-03-02T09:00:00.000Z");
    expect(parsed.recurrence).toBe("FREQ=WEEKLY;INTERVAL=2");
    expect(parsed.color).toBe("cyan");
  });

  it("reads an all-day event, whose end date is exclusive in the file", () => {
    const allDay = {
      ...event,
      allDay: true,
      startsAt: "2026-03-02T00:00:00.000Z",
      endsAt: "2026-03-02T23:59:00.000Z",
    };
    const [parsed] = parseIcs(toIcs([allDay]));

    expect(parsed.allDay).toBe(true);
    // Written as the 3rd, read back as the 2nd.
    expect(new Date(parsed.endsAt).getDate()).toBe(2);
  });

  it("reads a file written by something else", () => {
    const foreign = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:abc@example.test",
      "DTSTART;TZID=Europe/London:20260302T090000",
      "DTEND;TZID=Europe/London:20260302T100000",
      "SUMMARY:Someone else's meeting",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const [parsed] = parseIcs(foreign);
    expect(parsed.title).toBe("Someone else's meeting");
    expect(parsed.allDay).toBe(false);
    expect(parsed.recurrence).toBeNull();
  });

  it("skips an event with nothing to identify it rather than inventing one", () => {
    const broken = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "DTSTART:20260302T090000Z",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "SUMMARY:No start",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    expect(parseIcs(broken)).toHaveLength(0);
  });

  it("finds nothing in something that is not a calendar", () => {
    expect(parseIcs("just some text")).toEqual([]);
    expect(parseIcs("")).toEqual([]);
  });

  it("gives an event with no end a sensible one", () => {
    const noEnd = [
      "BEGIN:VEVENT",
      "DTSTART:20260302T090000Z",
      "SUMMARY:Open ended",
      "END:VEVENT",
    ].join("\r\n");

    const [parsed] = parseIcs(noEnd);
    const minutes =
      (new Date(parsed.endsAt).getTime() - new Date(parsed.startsAt).getTime()) / 60_000;
    expect(minutes).toBe(60);
  });
});
