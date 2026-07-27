"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { CalendarView } from "@/components/calendar/calendar-view";

// The modal is only reachable behind a click, so it stays out of first paint.
const EventModal = dynamic(
  () => import("@/components/calendar/event-modal").then((m) => m.EventModal),
  { ssr: false },
);
import type { EventModalState } from "@/components/calendar/event-modal";
import { UpcomingPanel } from "@/components/calendar/upcoming-panel";
import { MobileNav } from "@/components/mobile-nav";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { Sidebar } from "@/components/sidebar";
import { SidebarDrawer } from "@/components/sidebar-drawer";
import { useEvents } from "@/hooks/use-events";
import { isCalendarView, rangeFor, type CalendarViewKind } from "@/lib/calendar";
import { expandEvents, seriesIdOf } from "@/lib/recurrence";
import { useNotesStore } from "@/store/notes-store";

export default function CalendarPage() {
  return (
    // useSearchParams needs a boundary; the shell renders instantly either way.
    <Suspense fallback={<main className="h-dvh bg-background" />}>
      <Calendar />
    </Suspense>
  );
}

function Calendar() {
  const { data: events = [] } = useEvents();
  const sidebarOpen = useNotesStore((state) => state.sidebarOpen);

  const router = useRouter();
  const params = useSearchParams();

  /*
   * The view and the day live in the URL rather than in local state, so a
   * particular week is a link you can send someone, and a refresh comes back to
   * where you were.
   */
  const view: CalendarViewKind = isCalendarView(params.get("view"))
    ? (params.get("view") as CalendarViewKind)
    : "month";

  const dateParam = params.get("date");
  const cursor = useMemo(() => {
    const parsed = dateParam ? new Date(`${dateParam}T00:00:00`) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  }, [dateParam]);

  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [modal, setModal] = useState<EventModalState>({ mode: "closed" });

  function navigate(next: { view?: CalendarViewKind; cursor?: Date }) {
    const search = new URLSearchParams(params.toString());
    if (next.view) search.set("view", next.view);
    if (next.cursor) search.set("date", toDateParam(next.cursor));
    router.replace(`/calendar?${search}`, { scroll: false });
  }

  // One row per repeating event; the occurrences are worked out for whatever
  // window the current view is showing.
  const range = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  const occurrences = useMemo(
    () => expandEvents(events, range.from, range.to),
    [events, range.from, range.to],
  );

  /** Clicking an occurrence edits the series it belongs to. */
  function openEvent(occurrence: (typeof occurrences)[number]) {
    const stored = events.find((event) => event.id === seriesIdOf(occurrence));
    setModal({ mode: "edit", event: stored ?? occurrence });
  }

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

      {/*
       * Desktop puts the calendar and the upcoming list side by side. Below lg
       * they stack into one scrolling column so neither gets squeezed out.
       */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden scroll-thin">
        <MobileTopBar title="Calendar" />

        <CalendarView
          events={occurrences}
          view={view}
          onViewChange={(next) => navigate({ view: next })}
          cursor={cursor}
          onCursorChange={(next) => navigate({ cursor: next })}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onCreateOn={(day) => setModal({ mode: "create", day })}
          onOpenEvent={openEvent}
        />

        <UpcomingPanel
          events={occurrences}
          selectedDay={selectedDay}
          onOpenEvent={openEvent}
          onCreateOn={(day) => setModal({ mode: "create", day })}
        />
      </div>

      <MobileNav />
      <EventModal state={modal} onClose={() => setModal({ mode: "closed" })} />
    </main>
  );
}

function toDateParam(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
