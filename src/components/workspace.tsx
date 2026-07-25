"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { NoteEditor } from "@/components/notes/note-editor";
import { NotesPanel } from "@/components/notes/notes-panel";
import { Sidebar } from "@/components/sidebar";
import type { NoteFilter } from "@/lib/types";
import { useNotesStore } from "@/store/notes-store";

/**
 * The three-pane shell every note route renders. The route supplies the filter,
 * so navigation — not click state — decides which notes are on screen.
 */
export function Workspace({ filter }: { filter: NoteFilter }) {
  const load = useNotesStore((state) => state.load);
  const status = useNotesStore((state) => state.status);
  const sidebarOpen = useNotesStore((state) => state.sidebarOpen);

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  return (
    <main className="flex h-dvh overflow-hidden bg-background">
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 248, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="h-full shrink-0 overflow-hidden"
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      <NotesPanel filter={filter} />
      <NoteEditor />
    </main>
  );
}
