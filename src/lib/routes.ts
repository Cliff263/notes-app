import {
  Archive,
  BookOpen,
  Briefcase,
  Hash,
  Lightbulb,
  NotebookText,
  Pin,
  Star,
  Trash2,
  User,
  type LucideIcon,
} from "lucide-react";
import type { NoteFilter } from "./types";

/** Where each slice of the workspace lives, in one place. */
export const ROUTES = {
  all: "/",
  favorites: "/favorites",
  pinned: "/pinned",
  archive: "/archive",
  trash: "/trash",
  tags: "/tags",
  calendar: "/calendar",
  settings: "/settings",
  category: (category: string) => `/category/${encodeURIComponent(category.toLowerCase())}`,
  tag: (tag: string) => `/tags/${encodeURIComponent(tag)}`,
} as const;

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Personal: User,
  Work: Briefcase,
  Ideas: Lightbulb,
  Journal: BookOpen,
};

export type ViewCopy = {
  title: string;
  description: string;
  empty: string;
  icon: LucideIcon;
  /** Drives the header wash and icon tint. */
  accent: string;
};

/** The heading, blurb, icon and accent each view shows above its note list. */
export function describeFilter(filter: NoteFilter): ViewCopy {
  switch (filter.kind) {
    case "favorites":
      return {
        title: "Favorites",
        description: "Notes you starred, newest first.",
        empty: "Star a note and it will show up here.",
        icon: Star,
        accent: "var(--accent)",
      };
    case "pinned":
      return {
        title: "Pinned",
        description: "Notes you pinned to the top of the list.",
        empty: "Pin a note to keep it within reach.",
        icon: Pin,
        accent: "var(--glow-1)",
      };
    case "archive":
      return {
        title: "Archive",
        description: "Notes you have put away. Nothing here is deleted.",
        empty: "Nothing archived yet.",
        icon: Archive,
        accent: "var(--muted)",
      };
    case "trash":
      return {
        title: "Trash",
        description: "Deleted notes are kept for 30 days.",
        empty: "Trash is empty.",
        icon: Trash2,
        accent: "var(--danger)",
      };
    case "category":
      return {
        title: filter.value,
        description: `Everything filed under ${filter.value}.`,
        empty: `No notes in ${filter.value} yet.`,
        icon: CATEGORY_ICONS[filter.value] ?? NotebookText,
        accent: "var(--glow-2)",
      };
    case "tag":
      return {
        title: `#${filter.value}`,
        description: `Notes tagged #${filter.value}.`,
        empty: `Nothing tagged #${filter.value} right now.`,
        icon: Hash,
        accent: "var(--glow-2)",
      };
    default:
      return {
        title: "All Notes",
        description: "Everything except the archive.",
        empty: "Create your first note and it will show up right here.",
        icon: NotebookText,
        accent: "var(--glow-1)",
      };
  }
}
