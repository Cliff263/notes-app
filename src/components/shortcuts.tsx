"use client";

import { AnimatePresence, motion } from "framer-motion";
import { SHORTCUTS } from "@/lib/shortcuts";

/** Just the help sheet — the key handling lives in AppChrome. */
export function ShortcutsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
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
