"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Hash, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { MobileNav } from "@/components/mobile-nav";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { Sidebar } from "@/components/sidebar";
import { SidebarDrawer } from "@/components/sidebar-drawer";
import { ThemeToggle } from "@/components/theme-toggle";
import { ROUTES } from "@/lib/routes";
import { useNotesStore } from "@/store/notes-store";

export default function TagsPage() {
  const load = useNotesStore((state) => state.load);
  const status = useNotesStore((state) => state.status);
  const sidebarOpen = useNotesStore((state) => state.sidebarOpen);
  const notes = useNotesStore(useShallow((state) => state.notes));
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (status === "idle") void load();
  }, [status, load]);

  /** Every tag with its count and a couple of example notes. */
  const tags = useMemo(() => {
    const map = new Map<string, { count: number; titles: string[] }>();
    for (const note of notes) {
      if (note.archived) continue;
      for (const tag of note.tags) {
        const entry = map.get(tag) ?? { count: 0, titles: [] };
        entry.count += 1;
        if (entry.titles.length < 3) entry.titles.push(note.title);
        map.set(tag, entry);
      }
    }

    return [...map.entries()]
      .map(([tag, entry]) => ({ tag, ...entry }))
      .filter((entry) => entry.tag.includes(query.trim().toLowerCase().replace(/^#/, "")))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [notes, query]);

  const totalTagged = tags.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <main className="flex h-dvh overflow-hidden bg-background">
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

      <section className="relative min-w-0 flex-1 overflow-y-auto bg-surface scroll-thin">
        <MobileTopBar title="Tags" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-52 aurora opacity-50" />

        <div className="pb-navbar relative mx-auto w-full max-w-[860px] px-4 py-7 sm:px-6 sm:py-9">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glow-text text-[26px] font-semibold tracking-tight"
              >
                Tags
              </motion.h1>
              <p className="mt-1 text-[13px] text-muted">
                {tags.length} {tags.length === 1 ? "tag" : "tags"} across {totalTagged}{" "}
                tagged {totalTagged === 1 ? "note" : "notes"}.
              </p>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <div className="relative min-w-0 flex-1 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-2" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter tags..."
                  className="field h-9 w-full rounded-lg border border-line bg-input pl-9 pr-3 transition focus:border-line-strong sm:w-[190px]"
                />
              </div>
              <ThemeToggle className="hidden lg:flex" />
            </div>
          </div>

          {tags.length === 0 ? (
            <div className="mt-10 rounded-xl border border-dashed border-line py-14 text-center">
              <Hash className="mx-auto size-5 text-muted-2" />
              <p className="mt-2 text-[13px]">
                {query ? "No tags match that filter" : "No tags yet"}
              </p>
              <p className="mt-1 text-[12px] text-muted-2">
                {query
                  ? "Try a shorter word."
                  : "Add a tag from a note's editor and it will appear here."}
              </p>
            </div>
          ) : (
            <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tags.map((entry, index) => (
                <motion.div
                  key={entry.tag}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: Math.min(index, 12) * 0.03 }}
                >
                  <Link
                    href={ROUTES.tag(entry.tag)}
                    className="group flex h-full flex-col rounded-xl border border-line bg-card p-4 transition hover:border-line-strong hover:bg-card-hover"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Hash className="size-3.5 shrink-0 text-muted-2 transition group-hover:text-glow-1" />
                        <span className="truncate text-[13px] font-medium">
                          {entry.tag}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-md bg-panel px-1.5 py-0.5 text-[10px] tabular-nums text-muted-2">
                        {entry.count}
                      </span>
                    </span>

                    <span className="mt-2.5 space-y-1">
                      {entry.titles.map((title) => (
                        <span
                          key={title}
                          className="block truncate text-[11px] text-muted-2"
                        >
                          {title}
                        </span>
                      ))}
                    </span>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      <MobileNav />
    </main>
  );
}
