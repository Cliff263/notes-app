"use client";

import { motion } from "framer-motion";
import { CalendarDays, Hash, NotebookText, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useNotesStore } from "@/store/notes-store";

const NOTE_ROUTES = ["/", "/favorites", "/pinned", "/archive", "/trash"];

/** The bottom tab bar. Only below lg — desktop keeps the sidebar. */
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const createNote = useNotesStore((state) => state.createNote);
  const select = useNotesStore((state) => state.select);

  const onNotes =
    NOTE_ROUTES.includes(pathname) || pathname.startsWith("/category/");
  const onTags = pathname === ROUTES.tags || pathname.startsWith("/tags/");

  async function handleCreate() {
    const categoryMatch = /^\/category\/(.+)$/.exec(pathname);
    const tagMatch = /^\/tags\/(.+)$/.exec(pathname);

    const category = categoryMatch
      ? (CATEGORIES.find(
          (item) => item.toLowerCase() === decodeURIComponent(categoryMatch[1]),
        ) ?? "Personal")
      : "Personal";
    const tags = tagMatch ? [decodeURIComponent(tagMatch[1])] : [];

    const id = await createNote(category, tags);
    if (!id) return;
    if (!onNotes && !tagMatch) router.push(ROUTES.all);
    select(id);
  }

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-line bg-panel/95 backdrop-blur-md lg:hidden">
      <Tab
        href={ROUTES.all}
        icon={NotebookText}
        label="Notes"
        active={onNotes}
      />
      <Tab href={ROUTES.tags} icon={Hash} label="Tags" active={onTags} />

      <div className="relative w-16 shrink-0">
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={handleCreate}
          aria-label="New note"
          className="absolute -top-5 left-1/2 flex size-12 -translate-x-1/2 items-center justify-center rounded-full bg-btn text-btn-foreground shadow-lg shadow-black/30"
        >
          <Plus className="size-5" />
        </motion.button>
      </div>

      <Tab
        href={ROUTES.calendar}
        icon={CalendarDays}
        label="Calendar"
        active={pathname.startsWith(ROUTES.calendar)}
      />
      <Tab
        href={ROUTES.settings}
        icon={Settings}
        label="Settings"
        active={pathname.startsWith(ROUTES.settings)}
      />
    </nav>
  );
}

function Tab({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] transition",
        active ? "text-foreground" : "text-muted-2",
      )}
    >
      {active && (
        <motion.span
          layoutId="tab-indicator"
          className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-glow-1 to-transparent"
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
        />
      )}
      <Icon className="size-[18px]" />
      {label}
    </Link>
  );
}
