"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { NoteEditor } from "@/components/notes/note-editor";
import { NotesPanel } from "@/components/notes/notes-panel";
import { Sidebar } from "@/components/sidebar";
import { useNotesStore } from "@/store/notes-store";

export default function NotesPage() {
  const load = useNotesStore((state) => state.load);
  const sidebarOpen = useNotesStore((state) => state.sidebarOpen);

  useEffect(() => {
    void load();
  }, [load]);

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
            <Sidebar section="notes" />
          </motion.div>
        )}
      </AnimatePresence>

      <NotesPanel />
      <NoteEditor />
    </main>
  );
}
