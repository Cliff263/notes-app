"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  CalendarDays,
  CornerDownLeft,
  Download,
  FileText,
  Hash,
  Moon,
  NotebookText,
  Pin,
  Plus,
  Search,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTheme } from "@/components/theme-provider";
import { ROUTES } from "@/lib/routes";
import { cn, stripMarkdown } from "@/lib/utils";
import { useNotesStore } from "@/store/notes-store";

type Command = {
  id: string;
  label: string;
  hint?: string;
  group: "Navigation" | "Actions" | "Notes";
  icon: ComponentType<{ className?: string }>;
  run: () => void;
};

export function CommandPalette() {
  const router = useRouter();
  const { toggleTheme } = useTheme();
  const notes = useNotesStore(useShallow((state) => state.notes));
  const createNote = useNotesStore((state) => state.createNote);
  const select = useNotesStore((state) => state.select);
  const selectedId = useNotesStore((state) => state.selectedId);
  const updateNote = useNotesStore((state) => state.updateNote);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        setQuery("");
        setCursor(0);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const go = (path: string) => () => router.push(path);
    const selectedNote = notes.find((note) => note.id === selectedId);

    const base: Command[] = [
      { id: "all", label: "All Notes", group: "Navigation", icon: NotebookText, run: go(ROUTES.all) },
      { id: "favorites", label: "Favorites", group: "Navigation", icon: Star, run: go(ROUTES.favorites) },
      { id: "pinned", label: "Pinned", group: "Navigation", icon: Pin, run: go(ROUTES.pinned) },
      { id: "archive", label: "Archive", group: "Navigation", icon: Archive, run: go(ROUTES.archive) },
      { id: "trash", label: "Trash", group: "Navigation", icon: Trash2, run: go(ROUTES.trash) },
      { id: "tags", label: "Tags", group: "Navigation", icon: Hash, run: go(ROUTES.tags) },
      { id: "calendar", label: "Calendar", group: "Navigation", icon: CalendarDays, run: go(ROUTES.calendar) },
      { id: "settings", label: "Settings", group: "Navigation", icon: Settings, run: go(ROUTES.settings) },
      {
        id: "new",
        label: "New note",
        hint: "N",
        group: "Actions",
        icon: Plus,
        run: () => void createNote(),
      },
      {
        id: "theme",
        label: "Toggle theme",
        group: "Actions",
        icon: Moon,
        run: toggleTheme,
      },
    ];

    if (selectedNote) {
      base.push(
        {
          id: "favorite",
          label: selectedNote.favorite ? "Remove from favorites" : "Add to favorites",
          hint: "E",
          group: "Actions",
          icon: Star,
          run: () => updateNote(selectedNote.id, { favorite: !selectedNote.favorite }),
        },
        {
          id: "pin",
          label: selectedNote.pinned ? "Unpin note" : "Pin note",
          hint: "P",
          group: "Actions",
          icon: Pin,
          run: () => updateNote(selectedNote.id, { pinned: !selectedNote.pinned }),
        },
        {
          id: "export",
          label: "Export this note as PDF",
          group: "Actions",
          icon: Download,
          run: () => {
            window.location.href = `/api/notes/${selectedNote.id}/export?format=pdf`;
          },
        },
      );
    }

    return base;
  }, [router, createNote, toggleTheme, notes, selectedId, updateNote]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matchedCommands = commands.filter((command) =>
      needle ? command.label.toLowerCase().includes(needle) : true,
    );

    // Notes only join the list once there is something to match on.
    const matchedNotes: Command[] = needle
      ? notes
          .filter((note) => !note.deletedAt)
          .filter((note) =>
            [note.title, note.content, note.tags.join(" ")]
              .join(" ")
              .toLowerCase()
              .includes(needle),
          )
          .slice(0, 6)
          .map((note) => ({
            id: `note-${note.id}`,
            label: note.title || "Untitled note",
            hint: stripMarkdown(note.content).slice(0, 48),
            group: "Notes" as const,
            icon: FileText,
            run: () => {
              select(note.id);
              router.push(note.archived ? ROUTES.archive : ROUTES.all);
            },
          }))
      : [];

    return [...matchedCommands, ...matchedNotes];
  }, [commands, notes, query, router, select]);

  // Clamp during render rather than syncing in an effect.
  const activeIndex = Math.min(cursor, Math.max(results.length - 1, 0));

  function runAt(index: number) {
    const command = results[index];
    if (!command) return;
    setOpen(false);
    command.run();
  }

  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-muted-2" />
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCursor(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setCursor((value) => Math.min(value + 1, results.length - 1));
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setCursor((value) => Math.max(value - 1, 0));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    runAt(activeIndex);
                  } else if (event.key === "Escape") {
                    setOpen(false);
                  }
                }}
                placeholder="Search notes or jump to a view..."
                className="field h-12 w-full bg-transparent text-foreground"
              />
              <kbd className="hidden shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] text-muted-2 sm:block">
                Esc
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2 scroll-thin">
              {results.length === 0 && (
                <p className="px-4 py-6 text-center text-[12px] text-muted-2">
                  Nothing matches “{query}”.
                </p>
              )}

              {results.map((command, index) => {
                const showGroup = command.group !== lastGroup;
                lastGroup = command.group;

                return (
                  <div key={command.id}>
                    {showGroup && (
                      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">
                        {command.group}
                      </p>
                    )}

                    <button
                      type="button"
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => runAt(index)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] transition",
                        index === activeIndex
                          ? "bg-card text-foreground"
                          : "text-muted hover:bg-card-hover",
                      )}
                    >
                      <command.icon className="size-4 shrink-0 text-muted-2" />
                      <span className="min-w-0 flex-1 truncate">{command.label}</span>
                      {command.hint && (
                        <span className="hidden shrink-0 truncate text-[11px] text-muted-2 sm:block">
                          {command.hint}
                        </span>
                      )}
                      {index === activeIndex && (
                        <CornerDownLeft className="size-3.5 shrink-0 text-muted-2" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
