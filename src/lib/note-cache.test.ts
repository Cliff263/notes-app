import { describe, expect, it } from "vitest";
import { noteListDescriptor, noteMatchesList, sortNotesForList } from "./note-cache";
import { queryKeys } from "./query-keys";
import type { Note } from "./types";

const note: Note = {
  id: "note-1",
  title: "Realtime systems",
  content: "An optimistic interface updates immediately.",
  category: "Ideas",
  tags: ["product", "realtime"],
  pinned: false,
  favorite: true,
  archived: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  deletedAt: null,
  dueAt: null,
};

function descriptor(kind: Parameters<typeof queryKeys.notes.list>[0]["filter"]) {
  return noteListDescriptor(
    queryKeys.notes.list({ filter: kind, search: "", sort: "updated" }),
  )!;
}

describe("optimistic note list membership", () => {
  it("removes a soft-deleted note from active views and adds it to trash", () => {
    const deleted = { ...note, deletedAt: "2026-01-03T00:00:00.000Z" };

    expect(noteMatchesList(deleted, descriptor({ kind: "all" }))).toBe(false);
    expect(noteMatchesList(deleted, descriptor({ kind: "favorites" }))).toBe(false);
    expect(noteMatchesList(deleted, descriptor({ kind: "trash" }))).toBe(true);
  });

  it("moves archived notes out of active category and favorite views", () => {
    const archived = { ...note, archived: true };

    expect(
      noteMatchesList(archived, descriptor({ kind: "category", value: "Ideas" })),
    ).toBe(false);
    expect(noteMatchesList(archived, descriptor({ kind: "favorites" }))).toBe(false);
    expect(noteMatchesList(archived, descriptor({ kind: "archive" }))).toBe(true);
  });

  it("reacts immediately to favorite and tag changes", () => {
    expect(noteMatchesList(note, descriptor({ kind: "favorites" }))).toBe(true);
    expect(
      noteMatchesList(note, descriptor({ kind: "tag", value: "realtime" })),
    ).toBe(true);
    expect(
      noteMatchesList(
        { ...note, favorite: false, tags: [] },
        descriptor({ kind: "favorites" }),
      ),
    ).toBe(false);
  });

  it("honours cached search membership", () => {
    const list = noteListDescriptor(
      queryKeys.notes.list({
        filter: { kind: "all" },
        search: "optimistic interface",
        sort: "updated",
      }),
    )!;

    expect(noteMatchesList(note, list)).toBe(true);
    expect(noteMatchesList({ ...note, content: "Unrelated" }, list)).toBe(false);
  });

  it("reorders updated notes while keeping pinned notes first", () => {
    const list = descriptor({ kind: "all" });
    const newer = {
      ...note,
      id: "note-2",
      updatedAt: "2026-01-04T00:00:00.000Z",
    };
    const pinned = {
      ...note,
      id: "note-3",
      pinned: true,
      updatedAt: "2025-01-01T00:00:00.000Z",
    };

    expect(sortNotesForList([note, pinned, newer], list).map((item) => item.id)).toEqual([
      "note-3",
      "note-2",
      "note-1",
    ]);
  });
});
