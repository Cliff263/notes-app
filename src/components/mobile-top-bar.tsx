"use client";

import { Menu } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useNotesStore } from "@/store/notes-store";

/**
 * The drawer handle for pages that aren't the note workspace (which has its own
 * header). Only below lg.
 */
export function MobileTopBar({ title }: { title: string }) {
  const setDrawerOpen = useNotesStore((state) => state.setDrawerOpen);

  return (
    <header className="safe-top sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface/90 px-3 py-2 backdrop-blur-md lg:hidden">
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open menu"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-card-hover hover:text-foreground"
      >
        <Menu className="size-5" />
      </button>
      <span className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-tight">
        {title}
      </span>
      <ThemeToggle />
    </header>
  );
}
