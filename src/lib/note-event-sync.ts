import { stripMarkdown } from "./utils";

/** Note-owned text as it appears on a linked calendar event. */
export function linkedEventTitle(title: string) {
  return title.trim() || "Untitled note";
}

export function linkedEventDescription(content: string) {
  return stripMarkdown(content).slice(0, 240);
}

/**
 * Move an event to the note's new due date without changing how long it lasts.
 */
export function moveLinkedEvent(
  event: { startsAt: Date; endsAt: Date },
  dueAt: Date,
) {
  return {
    startsAt: dueAt,
    endsAt: new Date(
      dueAt.getTime() + (event.endsAt.getTime() - event.startsAt.getTime()),
    ),
  };
}
