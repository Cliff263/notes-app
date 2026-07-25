import type { DbEvent, DbNote } from "@/db/schema";
import type { CalendarEvent, EventColor, Note } from "./types";

export function serializeNote(row: DbNote): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    tags: row.tags,
    pinned: row.pinned,
    favorite: row.favorite,
    archived: row.archived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    dueAt: row.dueAt?.toISOString() ?? null,
  };
}

export function serializeEvent(row: DbEvent): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    allDay: row.allDay,
    color: row.color as EventColor,
    noteId: row.noteId,
    createdAt: row.createdAt.toISOString(),
  };
}
