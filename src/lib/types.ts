export const CATEGORIES = [
  "Personal",
  "Work",
  "Ideas",
  "Journal",
  "Archive",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Note = {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export const EVENT_COLORS = [
  "violet",
  "cyan",
  "emerald",
  "amber",
  "rose",
] as const;

export type EventColor = (typeof EVENT_COLORS)[number];

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  color: EventColor;
  createdAt: string;
};

/** Values the sidebar can filter the note list down to. */
export type NoteFilter =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "pinned" }
  | { kind: "category"; value: string };

export type ViewMode = "grid" | "list";
