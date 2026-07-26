"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ROUTES } from "@/lib/routes";
import { useNotes, useNoteActions } from "@/hooks/use-notes";
import { useNotesStore } from "@/store/notes-store";

export const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: "⌘K / Ctrl K", description: "Open the command palette" },
  { keys: "N", description: "New note" },
  { keys: "/", description: "Focus search" },
  { keys: "E", description: "Favorite the open note" },
  { keys: "P", description: "Pin the open note" },
  { keys: "A", description: "Archive the open note" },
  { keys: "G then C", description: "Go to the calendar" },
  { keys: "G then T", description: "Go to tags" },
  { keys: "?", description: "Show this list" },
  { keys: "Esc", description: "Close the note, sheet or dialog" },
];

/** Global keyboard handling. Typing in a field always wins. */
export function Shortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  const { data: notes = [] } = useNotes();
  const actions = useNoteActions();

  /*
   * The keydown listener is registered once, so it reads the latest notes and
   * mutations through a ref rather than re-subscribing on every cache update.
   */
  const latest = useRef({ notes, actions });
  useEffect(() => {
    latest.current = { notes, actions };
  }, [notes, actions]);

  useEffect(() => {
    let awaitingGo = false;
    let goTimer: ReturnType<typeof setTimeout> | null = null;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const store = useNotesStore.getState();
      const { notes: current, actions: act } = latest.current;
      const note = current.find((item) => item.id === store.selectedId);

      if (event.key === "Escape") {
        if (helpOpen) setHelpOpen(false);
        else if (store.drawerOpen) store.setDrawerOpen(false);
        else if (store.selectedId) store.select(null);
        return;
      }

      if (typing) return;

      // "g" starts a two-key sequence, the way Gmail and GitHub do it.
      if (awaitingGo) {
        awaitingGo = false;
        if (goTimer) clearTimeout(goTimer);

        const destination: Record<string, string> = {
          c: ROUTES.calendar,
          t: ROUTES.tags,
          a: ROUTES.all,
          f: ROUTES.favorites,
          p: ROUTES.pinned,
          s: ROUTES.settings,
        };
        const path = destination[event.key.toLowerCase()];
        if (path) {
          event.preventDefault();
          router.push(path);
        }
        return;
      }

      switch (event.key.toLowerCase()) {
        case "g":
          awaitingGo = true;
          goTimer = setTimeout(() => {
            awaitingGo = false;
          }, 1200);
          break;
        case "n":
          event.preventDefault();
          void act.createNote();
          break;
        case "/": {
          event.preventDefault();
          const search = document.querySelector<HTMLInputElement>("[data-search-input]");
          search?.focus();
          break;
        }
        case "e":
          if (note) act.updateNote(note.id, { favorite: !note.favorite });
          break;
        case "p":
          if (note) act.updateNote(note.id, { pinned: !note.pinned });
          break;
        case "a":
          if (note) act.updateNote(note.id, { archived: !note.archived });
          break;
        case "?":
          setHelpOpen(true);
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (goTimer) clearTimeout(goTimer);
    };
  }, [router, helpOpen]);

  return (
    <AnimatePresence>
      {helpOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setHelpOpen(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
          >
            <h2 className="border-b border-line px-4 py-3 text-[14px] font-semibold tracking-tight">
              Keyboard shortcuts
            </h2>
            <div className="p-2">
              {SHORTCUTS.map((shortcut) => (
                <div
                  key={shortcut.keys}
                  className="flex items-center justify-between px-2 py-1.5 text-[12px]"
                >
                  <span className="text-muted">{shortcut.description}</span>
                  <kbd className="rounded border border-line bg-panel px-1.5 py-0.5 font-mono text-[11px] text-muted-2">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
