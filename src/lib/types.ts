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
  /** Set when the note is in the trash. */
  deletedAt: string | null;
  /** Optional due date; surfaces in the calendar. */
  dueAt: string | null;
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
  /** Set when the event was created from a note. */
  noteId: string | null;
  createdAt: string;
};

/** Which slice of the workspace a route is showing. */
export type NoteFilter =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "pinned" }
  | { kind: "archive" }
  | { kind: "trash" }
  | { kind: "category"; value: string }
  | { kind: "tag"; value: string };

export const SORT_OPTIONS = [
  { value: "updated", label: "Last edited" },
  { value: "created", label: "Date created" },
  { value: "title", label: "Title" },
  { value: "length", label: "Length" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["value"];

export const EXPORT_FORMATS = ["pdf", "docx", "md", "txt"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type ViewMode = "grid" | "list";
