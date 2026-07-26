"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { CalendarView } from "@/components/calendar/calendar-view";
import {
  EventModal,
  type EventModalState,
} from "@/components/calendar/event-modal";
import { UpcomingPanel } from "@/components/calendar/upcoming-panel";
import { MobileNav } from "@/components/mobile-nav";
import { MobileTopBar } from "@/components/mobile-top-bar";
import { Sidebar } from "@/components/sidebar";
import { SidebarDrawer } from "@/components/sidebar-drawer";
import { useEvents } from "@/hooks/use-events";
import { useNotesStore } from "@/store/notes-store";

export default function CalendarPage() {
  const { data: events = [] } = useEvents();
  const sidebarOpen = useNotesStore((state) => state.sidebarOpen);

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [modal, setModal] = useState<EventModalState>({ mode: "closed" });

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
       * Desktop puts the month and the upcoming list side by side. Below lg they
       * stack into one scrolling column so neither gets squeezed out.
       */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden scroll-thin">
        <MobileTopBar title="Calendar" />

        <CalendarView
          events={events}
          cursor={cursor}
          onCursorChange={setCursor}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onCreateOn={(day) => setModal({ mode: "create", day })}
          onOpenEvent={(event) => setModal({ mode: "edit", event })}
        />

        <UpcomingPanel
          events={events}
          selectedDay={selectedDay}
          onOpenEvent={(event) => setModal({ mode: "edit", event })}
          onCreateOn={(day) => setModal({ mode: "create", day })}
        />
      </div>

      <MobileNav />
      <EventModal state={modal} onClose={() => setModal({ mode: "closed" })} />
    </main>
  );
}
