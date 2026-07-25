"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useNotesStore } from "@/store/notes-store";
import { Sidebar } from "./sidebar";

/**
 * Below lg the sidebar is an overlay rather than a column, so the note list
 * keeps the full width of the screen.
 */
export function SidebarDrawer() {
  const drawerOpen = useNotesStore((state) => state.drawerOpen);
  const setDrawerOpen = useNotesStore((state) => state.setDrawerOpen);

  return (
    <AnimatePresence>
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.button
            type="button"
            aria-label="Close menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.4, right: 0 }}
            onDragEnd={(_event, info) => {
              // A short flick to the left closes it, like a native drawer.
              if (info.offset.x < -60 || info.velocity.x < -400) setDrawerOpen(false);
            }}
            className="absolute inset-y-0 left-0 flex w-[264px] max-w-[85vw] flex-col shadow-2xl"
          >
            <Sidebar />

            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-2 top-3 flex size-8 items-center justify-center rounded-lg text-muted-2 transition hover:bg-card-hover hover:text-foreground lg:hidden"
            >
              <X className="size-4" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
