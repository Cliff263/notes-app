import { describe, expect, it } from "vitest";
import {
  describeRecurrence,
  expandEvent,
  formatRecurrence,
  parseIcsDate,
  parseRecurrence,
  toIcsDate,
} from "./recurrence";
import type { CalendarEvent } from "./types";

const event: CalendarEvent = {
  id: "e1",
  title: "Standup",
  description: "",
  location: "",
  startsAt: "2026-03-02T09:00:00.000Z",
  endsAt: "2026-03-02T09:15:00.000Z",
  allDay: false,
  color: "violet",
  noteId: null,
  createdAt: "2026-03-01T09:00:00.000Z",
  recurrence: null,
};

const starts = (events: CalendarEvent[]) =>
  events.map((occurrence) => occurrence.startsAt.slice(0, 10));

describe("parseRecurrence", () => {
  it("reads the parts it knows", () => {
    expect(parseRecurrence("FREQ=WEEKLY;INTERVAL=2;COUNT=5")).toMatchObject({
      freq: "WEEKLY",
      interval: 2,
      count: 5,
    });
  });

  it("tolerates the RRULE: prefix and odd casing", () => {
    expect(parseRecurrence("RRULE:freq=daily")).toMatchObject({
      freq: "DAILY",
      interval: 1,
    });
  });

  it("is null for anything it could not honour", () => {
    expect(parseRecurrence(null)).toBeNull();
    expect(parseRecurrence("")).toBeNull();
    expect(parseRecurrence("FREQ=HOURLY")).toBeNull();
    expect(parseRecurrence("INTERVAL=2")).toBeNull();
  });

  it("refuses a nonsense interval rather than repeating forever in place", () => {
    expect(parseRecurrence("FREQ=DAILY;INTERVAL=0")).toMatchObject({ interval: 1 });
    expect(parseRecurrence("FREQ=DAILY;INTERVAL=-3")).toMatchObject({ interval: 1 });
    expect(parseRecurrence("FREQ=DAILY;INTERVAL=abc")).toMatchObject({ interval: 1 });
  });

  it("round-trips through the RRULE it formats", () => {
    const rule = parseRecurrence("FREQ=MONTHLY;INTERVAL=3;COUNT=4")!;
    expect(parseRecurrence(formatRecurrence(rule))).toEqual(rule);
  });
});

describe("expandEvent", () => {
  const march = new Date("2026-03-01T00:00:00.000Z");
  const april = new Date("2026-04-01T00:00:00.000Z");

  it("returns a one-off only when it falls inside the window", () => {
    expect(expandEvent(event, march, april)).toHaveLength(1);
    expect(
      expandEvent(event, new Date("2026-05-01"), new Date("2026-06-01")),
    ).toHaveLength(0);
  });

  it("repeats weekly", () => {
    const weekly = { ...event, recurrence: "FREQ=WEEKLY" };
    expect(starts(expandEvent(weekly, march, april))).toEqual([
      "2026-03-02",
      "2026-03-09",
      "2026-03-16",
      "2026-03-23",
      "2026-03-30",
    ]);
  });

  it("honours an interval", () => {
    const fortnightly = { ...event, recurrence: "FREQ=WEEKLY;INTERVAL=2" };
    expect(starts(expandEvent(fortnightly, march, april))).toEqual([
      "2026-03-02",
      "2026-03-16",
      "2026-03-30",
    ]);
  });

  it("stops at COUNT and at UNTIL", () => {
    expect(
      expandEvent({ ...event, recurrence: "FREQ=WEEKLY;COUNT=2" }, march, april),
    ).toHaveLength(2);

    expect(
      expandEvent(
        { ...event, recurrence: "FREQ=WEEKLY;UNTIL=20260317T000000Z" },
        march,
        april,
      ),
    ).toHaveLength(3);
  });

  it("only returns the occurrences the window asked for", () => {
    const weekly = { ...event, recurrence: "FREQ=WEEKLY" };
    const occurrences = expandEvent(
      weekly,
      new Date("2026-03-15T00:00:00.000Z"),
      new Date("2026-03-24T00:00:00.000Z"),
    );

    expect(starts(occurrences)).toEqual(["2026-03-16", "2026-03-23"]);
  });

  it("keeps the first occurrence's own id and points the rest at the series", () => {
    const occurrences = expandEvent({ ...event, recurrence: "FREQ=DAILY" }, march, april);

    expect(occurrences[0].id).toBe("e1");
    expect(occurrences[1].id).toContain("e1@");
    expect(occurrences.every((occurrence) => occurrence.seriesId === "e1")).toBe(true);
  });

  it("keeps every occurrence the same length as the original", () => {
    const occurrences = expandEvent({ ...event, recurrence: "FREQ=DAILY" }, march, april);

    for (const occurrence of occurrences) {
      const minutes =
        (new Date(occurrence.endsAt).getTime() - new Date(occurrence.startsAt).getTime()) /
        60_000;
      expect(minutes).toBe(15);
    }
  });

  it("does not run away on an open-ended daily rule over a decade", () => {
    const occurrences = expandEvent(
      { ...event, recurrence: "FREQ=DAILY" },
      march,
      new Date("2036-03-01T00:00:00.000Z"),
    );
    expect(occurrences.length).toBeLessThanOrEqual(400);
  });
});

describe("ICS dates", () => {
  it("reads a UTC stamp", () => {
    expect(parseIcsDate("20260302T091500Z").toISOString()).toBe(
      "2026-03-02T09:15:00.000Z",
    );
  });

  it("reads a bare date", () => {
    const date = parseIcsDate("20260302");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(2);
    expect(date.getDate()).toBe(2);
  });

  it("writes what it can read", () => {
    const stamp = toIcsDate(new Date("2026-03-02T09:15:00.000Z"));
    expect(stamp).toBe("20260302T091500Z");
    expect(parseIcsDate(stamp).toISOString()).toBe("2026-03-02T09:15:00.000Z");
  });
});

describe("describeRecurrence", () => {
  it("says it in words", () => {
    expect(describeRecurrence(null)).toBe("Does not repeat");
    expect(describeRecurrence(parseRecurrence("FREQ=WEEKLY"))).toBe("Every week");
    expect(describeRecurrence(parseRecurrence("FREQ=WEEKLY;INTERVAL=2"))).toBe(
      "Every 2 weeks",
    );
    expect(describeRecurrence(parseRecurrence("FREQ=DAILY;COUNT=3"))).toBe(
      "Every day, 3 times",
    );
  });
});
