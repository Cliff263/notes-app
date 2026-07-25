"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CalendarView } from "@/components/calendar/calendar-view";
import {
  EventModal,
  type EventModalState,
} from "@/components/calendar/event-modal";
import { UpcomingPanel } from "@/components/calendar/upcoming-panel";
import { Sidebar } from "@/components/sidebar";
import { useEventsStore } from "@/store/events-store";
import { useNotesStore } from "@/store/notes-store";

export default function CalendarPage() {
  const loadEvents = useEventsStore((state) => state.load);
  const events = useEventsStore((state) => state.events);
  const loadNotes = useNotesStore((state) => state.load);
  const notesStatus = useNotesStore((state) => state.status);
  const sidebarOpen = useNotesStore((state) => state.sidebarOpen);

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [modal, setModal] = useState<EventModalState>({ mode: "closed" });

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // The sidebar shows categories and tags, so it needs the notes too.
  useEffect(() => {
    if (notesStatus === "idle") void loadNotes();
  }, [notesStatus, loadNotes]);

  return (
    <main className="flex h-dvh overflow-hidden bg-background">
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 248, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="h-full shrink-0 overflow-hidden"
          >
            <Sidebar />
          </motion.div>
        )}
      </AnimatePresence>

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

      <EventModal state={modal} onClose={() => setModal({ mode: "closed" })} />
    </main>
  );
}
