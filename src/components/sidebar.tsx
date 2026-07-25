"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  BookOpen,
  Briefcase,
  CalendarDays,
  ChevronDown,
  FileText,
  Hash,
  Lightbulb,
  LogOut,
  NotebookText,
  Pin,
  Plus,
  Settings,
  Star,
  User,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ComponentType } from "react";
import { useShallow } from "zustand/react/shallow";
import { ROUTES } from "@/lib/routes";
import { CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  selectAllTags,
  selectArchivedCount,
  selectCategoryCounts,
  selectFavoriteCount,
  selectPinnedCount,
  useNotesStore,
} from "@/store/notes-store";

const CATEGORY_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Personal: User,
  Work: Briefcase,
  Ideas: Lightbulb,
  Journal: BookOpen,
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const createNote = useNotesStore((state) => state.createNote);
  const setDrawerOpen = useNotesStore((state) => state.setDrawerOpen);
  // These selectors build a fresh array/object, so they need a shallow compare
  // to keep useSyncExternalStore from looping.
  const tags = useNotesStore(useShallow(selectAllTags));
  const counts = useNotesStore(useShallow(selectCategoryCounts));
  const favoriteCount = useNotesStore(selectFavoriteCount);
  const pinnedCount = useNotesStore(selectPinnedCount);
  const archivedCount = useNotesStore(selectArchivedCount);

  /** Navigating from the drawer should also dismiss it. */
  const closeDrawer = () => setDrawerOpen(false);

  /** A new note inherits the category or tag of the view you're in. */
  async function handleNewNote() {
    closeDrawer();
    const categoryMatch = /^\/category\/(.+)$/.exec(pathname);
    const tagMatch = /^\/tags\/(.+)$/.exec(pathname);

    const category = categoryMatch
      ? (CATEGORIES.find(
          (item) => item.toLowerCase() === decodeURIComponent(categoryMatch[1]),
        ) ?? "Personal")
      : "Personal";
    const noteTags = tagMatch ? [decodeURIComponent(tagMatch[1])] : [];

    const id = await createNote(category, noteTags);
    if (id && (pathname === ROUTES.archive || pathname === ROUTES.tags)) {
      router.push(ROUTES.all);
    }
  }

  const user = session?.user;
  const displayName = user?.name || user?.email?.split("@")[0] || "Signed in";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside
      /*
       * Any link inside dismisses the drawer, so navigation from the overlay
       * behaves the way it does in a native app without wiring a handler to
       * every single row.
       */
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) closeDrawer();
      }}
      className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-panel"
    >
      <Link href={ROUTES.all} className="flex items-center gap-2 px-4 pt-4 pb-3">
        <span className="flex size-7 items-center justify-center rounded-md border border-line bg-card">
          <FileText className="size-3.5 text-foreground" />
        </span>
        <span className="text-[13px] font-semibold tracking-tight">Square Notes</span>
      </Link>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={handleNewNote}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-btn px-3 py-2 text-[13px] font-medium text-btn-foreground transition hover:opacity-90 active:scale-[0.99]"
        >
          <Plus className="size-4" />
          New Note
        </button>
      </div>

      <nav className="space-y-0.5 px-3">
        <NavLink
          href={ROUTES.all}
          icon={NotebookText}
          label="All Notes"
          active={pathname === ROUTES.all}
        />
        <NavLink
          href={ROUTES.favorites}
          icon={Star}
          label="Favorites"
          count={favoriteCount}
          active={pathname === ROUTES.favorites}
        />
        <NavLink
          href={ROUTES.pinned}
          icon={Pin}
          label="Pinned"
          count={pinnedCount}
          active={pathname === ROUTES.pinned}
        />
        <NavLink
          href={ROUTES.calendar}
          icon={CalendarDays}
          label="Calendar"
          active={pathname.startsWith(ROUTES.calendar)}
        />
      </nav>

      <div className="mt-5 px-3">
        <button
          type="button"
          onClick={() => setCategoriesOpen((open) => !open)}
          className="flex w-full items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2 transition hover:text-muted"
        >
          <motion.span
            animate={{ rotate: categoriesOpen ? 0 : -90 }}
            transition={{ duration: 0.18 }}
            className="flex"
          >
            <ChevronDown className="size-3" />
          </motion.span>
          Categories
        </button>

        <AnimatePresence initial={false}>
          {categoriesOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="space-y-0.5 pt-1">
                {CATEGORIES.filter((category) => category !== "Archive").map(
                  (category) => (
                    <NavLink
                      key={category}
                      href={ROUTES.category(category)}
                      icon={CATEGORY_ICONS[category] ?? FileText}
                      label={category}
                      count={counts[category]}
                      active={pathname === ROUTES.category(category)}
                    />
                  ),
                )}
                <NavLink
                  href={ROUTES.archive}
                  icon={Archive}
                  label="Archive"
                  count={archivedCount}
                  active={pathname === ROUTES.archive}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-5 scroll-thin">
        <Link
          href={ROUTES.tags}
          className="flex items-center gap-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2 transition hover:text-muted"
        >
          <Hash className="size-2.5" />
          Tags
        </Link>

        <div className="flex flex-wrap gap-1.5 pb-4">
          <TagChip
            href={ROUTES.tags}
            label="All tags"
            active={pathname === ROUTES.tags}
          />
          {tags.map((tag) => (
            <TagChip
              key={tag}
              href={ROUTES.tag(tag)}
              label={`#${tag}`}
              active={pathname === ROUTES.tag(tag)}
            />
          ))}
        </div>
      </div>

      <div className="relative border-t border-line p-3">
        <AnimatePresence>
          {userMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-[68px] left-3 right-3 z-20 overflow-hidden rounded-lg border border-line bg-card shadow-xl"
            >
              <Link
                href={ROUTES.settings}
                onClick={() => setUserMenuOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-muted transition hover:bg-card-hover hover:text-foreground"
              >
                <Settings className="size-3.5" />
                Settings
              </Link>
              <button
                type="button"
                onClick={() => signOut({ redirectTo: ROUTES.all })}
                className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-muted transition hover:bg-card-hover hover:text-danger"
              >
                <LogOut className="size-3.5" />
                Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setUserMenuOpen((open) => !open)}
          className="flex w-full items-center gap-2 rounded-lg border border-line bg-card px-2 py-2 text-left transition hover:bg-card-hover"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-glow-1 to-glow-2 text-[11px] font-semibold text-white">
            {initial}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-medium">{displayName}</span>
            <span className="block truncate text-[11px] text-muted-2">
              {user?.email ?? ""}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-2 transition",
              userMenuOpen && "rotate-180",
            )}
          />
        </button>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  count,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition",
        active
          ? "bg-card text-foreground"
          : "text-muted hover:bg-card-hover hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {typeof count === "number" && count > 0 && (
        <span className="text-[11px] text-muted-2">{count}</span>
      )}
    </Link>
  );
}

function TagChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-2 py-1 text-[11px] transition",
        active
          ? "bg-btn text-btn-foreground"
          : "bg-card text-muted hover:bg-card-hover hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
}
