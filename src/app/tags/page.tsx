"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Hash, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MobileNav } from "@/components/mobile-nav";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { Sidebar } from "@/components/sidebar";
import { SidebarDrawer } from "@/components/sidebar-drawer";
import { ThemeToggle } from "@/components/theme-toggle";
import { AnimatedNumber, Stagger, StaggerItem, TextReveal } from "@/components/motion";
import { ROUTES } from "@/lib/routes";
import { useSummary } from "@/hooks/use-notes";
import { useNotesStore } from "@/store/notes-store";

export default function TagsPage() {
  const sidebarOpen = useNotesStore((state) => state.sidebarOpen);
  const { data: summary } = useSummary();
  const [query, setQuery] = useState("");

  // The counts and example titles are aggregated in SQL, so they stay right
  // however much of the note list happens to be loaded.
  const tags = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/^#/, "");
    return (summary?.tags ?? []).filter((entry) => entry.tag.includes(needle));
  }, [summary, query]);

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
              <h1 className="glow-text text-[26px] font-semibold tracking-tight">
                <TextReveal text="Tags" />
              </h1>
              <p className="mt-1 text-[13px] text-muted">
                <AnimatedNumber value={tags.length} />{" "}
                {tags.length === 1 ? "tag" : "tags"} across{" "}
                <AnimatedNumber value={totalTagged} /> tagged{" "}
                {totalTagged === 1 ? "note" : "notes"}.
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
            <Stagger className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tags.map((entry) => (
                <StaggerItem key={entry.tag}>
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
                </StaggerItem>
              ))}
            </Stagger>
          )}
        </div>
      </section>

      <MobileNav />
    </main>
  );
}
