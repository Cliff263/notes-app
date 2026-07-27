import type { QueryKey } from "@tanstack/react-query";
import type { Note, SortKey } from "@/lib/types";

export type NoteListDescriptor = {
  kind: string;
  value: string | null;
  search: string;
  sort: SortKey;
};

export function noteListDescriptor(key: QueryKey): NoteListDescriptor | null {
  if (key[0] !== "notes" || key[1] !== "list") return null;
  return {
    kind: String(key[2] ?? "all"),
    value: typeof key[3] === "string" ? key[3] : null,
    search: String(key[4] ?? "").trim().toLowerCase(),
    sort: (key[5] ?? "updated") as SortKey,
  };
}

/** Mirrors the list membership rules enforced by the notes API. */
export function noteMatchesList(note: Note, list: NoteListDescriptor) {
  const live = !note.deletedAt;
  const unarchived = live && !note.archived;

  const inFilter =
    list.kind === "favorites"
      ? unarchived && note.favorite
      : list.kind === "pinned"
        ? unarchived && note.pinned
        : list.kind === "archive"
          ? live && note.archived
          : list.kind === "trash"
            ? !live
            : list.kind === "due"
              ? unarchived && Boolean(note.dueAt)
              : list.kind === "category"
                ? unarchived && note.category === list.value
                : list.kind === "tag"
                  ? unarchived && Boolean(list.value && note.tags.includes(list.value))
                  : unarchived;

  if (!inFilter || !list.search) return inFilter;

  const haystack = `${note.title} ${note.content} ${note.tags.join(" ")}`.toLowerCase();
  const terms = list.search.match(/[\p{L}\p{N}]+/gu) ?? [list.search];
  return terms.every((term) => haystack.includes(term));
}

export function sortNotesForList(notes: Note[], list: NoteListDescriptor) {
  return [...notes].sort((a, b) => {
    if (list.kind !== "trash" && a.pinned !== b.pinned) return a.pinned ? -1 : 1;

    if (list.sort === "title") {
      return a.title.localeCompare(b.title) || b.id.localeCompare(a.id);
    }
    if (list.sort === "length") {
      return b.content.length - a.content.length || b.id.localeCompare(a.id);
    }

    const field = list.sort === "created" ? "createdAt" : "updatedAt";
    return b[field].localeCompare(a[field]) || b.id.localeCompare(a.id);
  });
}
