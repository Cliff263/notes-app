import { describe, expect, it } from "vitest";
import {
  linkedEventDescription,
  linkedEventTitle,
  moveLinkedEvent,
} from "./note-event-sync";

describe("linked note events", () => {
  it("uses the note title and a plain-text content excerpt", () => {
    expect(linkedEventTitle("  Project log  ")).toBe("Project log");
    expect(linkedEventTitle("   ")).toBe("Untitled note");
    expect(linkedEventDescription("## Update\n\n- [x] **Shipped** the first cut")).toBe(
      "Update Shipped the first cut",
    );
    expect(linkedEventDescription("x".repeat(300))).toHaveLength(240);
  });

  it("moves to a changed due date without changing the event duration", () => {
    const moved = moveLinkedEvent(
      {
        startsAt: new Date("2026-07-28T08:00:00.000Z"),
        endsAt: new Date("2026-07-28T09:30:00.000Z"),
      },
      new Date("2026-08-04T12:00:00.000Z"),
    );

    expect(moved.startsAt.toISOString()).toBe("2026-08-04T12:00:00.000Z");
    expect(moved.endsAt.toISOString()).toBe("2026-08-04T13:30:00.000Z");
  });
});
