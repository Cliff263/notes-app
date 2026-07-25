"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { MobileNav } from "@/components/mobile-nav";
import { NoteEditor } from "@/components/notes/note-editor";
import { NotesPanel } from "@/components/notes/notes-panel";
import { Sidebar } from "@/components/sidebar";
import { SidebarDrawer } from "@/components/sidebar-drawer";
import type { NoteFilter } from "@/lib/types";
import { useNotesStore } from "@/store/notes-store";

/**
 * The shell every note route renders. Desktop is three panes; below lg the
 * sidebar becomes a drawer, the tab bar appears, and the editor is a
 * full-screen sheet — all from the same component instances.
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
      {/* Desktop column */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 248, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="hidden h-full shrink-0 overflow-hidden lg:block"
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

      <SidebarDrawer />

      <NotesPanel filter={filter} />
      <NoteEditor />
      <MobileNav />
    </main>
  );
}
