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

/** Which slice of the workspace a route is showing. */
export type NoteFilter =
  | { kind: "all" }
  | { kind: "favorites" }
  | { kind: "pinned" }
  | { kind: "archive" }
  | { kind: "category"; value: string }
  | { kind: "tag"; value: string };

export const EXPORT_FORMATS = ["pdf", "docx", "md", "txt"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type ViewMode = "grid" | "list";
