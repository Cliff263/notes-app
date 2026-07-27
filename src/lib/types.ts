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
  /**
   * The matching passage, with the matched words wrapped in markers. Only ever
   * set on a search response — it describes this result, not the note, so it is
   * never stored and disappears the next time the note is fetched.
   */
  searchSnippet?: string;
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
  /** An RRULE subset — see `lib/recurrence.ts`. Null for a one-off. */
  recurrence: string | null;
  /**
   * On an expanded occurrence, the id of the row it came from. Absent on the
   * stored event itself, which is its own series.
   */
  seriesId?: string;
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

/**
 * How long a share link lasts. Lives here rather than beside the sharing code
 * because the dialog that offers these choices runs in the browser, and
 * `lib/share.ts` reaches for the database.
 */
export const SHARE_DURATIONS = [
  { value: "forever", label: "No expiry", ms: null },
  { value: "day", label: "24 hours", ms: 24 * 60 * 60_000 },
  { value: "week", label: "7 days", ms: 7 * 24 * 60 * 60_000 },
  { value: "month", label: "30 days", ms: 30 * 24 * 60 * 60_000 },
] as const;

export type ShareDuration = (typeof SHARE_DURATIONS)[number]["value"];

export const EXPORT_FORMATS = ["pdf", "docx", "md", "txt"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export type ViewMode = "grid" | "list";
