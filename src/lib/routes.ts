import type { NoteFilter } from "./types";

/** Where each slice of the workspace lives, in one place. */
export const ROUTES = {
  all: "/",
  favorites: "/favorites",
  pinned: "/pinned",
  archive: "/archive",
  tags: "/tags",
  calendar: "/calendar",
  settings: "/settings",
  category: (category: string) => `/category/${encodeURIComponent(category.toLowerCase())}`,
  tag: (tag: string) => `/tags/${encodeURIComponent(tag)}`,
} as const;

/** The heading and blurb each view shows above its note list. */
export function describeFilter(filter: NoteFilter) {
  switch (filter.kind) {
    case "favorites":
      return {
        title: "Favorites",
        description: "Notes you starred, newest first.",
        empty: "Star a note and it will show up here.",
      };
    case "pinned":
      return {
        title: "Pinned",
        description: "Notes you pinned to the top of the list.",
        empty: "Pin a note to keep it within reach.",
      };
    case "archive":
      return {
        title: "Archive",
        description: "Notes you have put away. Nothing here is deleted.",
        empty: "Nothing archived yet.",
      };
    case "category":
      return {
        title: filter.value,
        description: `Everything filed under ${filter.value}.`,
        empty: `No notes in ${filter.value} yet.`,
      };
    case "tag":
      return {
        title: `#${filter.value}`,
        description: `Notes tagged #${filter.value}.`,
        empty: `Nothing tagged #${filter.value} right now.`,
      };
    default:
      return {
        title: "All Notes",
        description: "Everything except the archive.",
        empty: "Create your first note and it will show up right here.",
      };
  }
}
