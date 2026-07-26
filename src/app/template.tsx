"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

/**
 * `template.tsx` remounts on every navigation (unlike `layout.tsx`), which is
 * what makes a per-route enter animation possible. Kept small — a fade and a
 * few pixels of lift — so navigation feels continuous rather than staged.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
