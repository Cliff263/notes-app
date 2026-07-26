"use client";

import { motion } from "framer-motion";
import { CalendarClock, Clock, FileText, MapPin } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import { useNotes } from "@/hooks/use-notes";
import { useNotesStore } from "@/store/notes-store";
import type { CalendarEvent } from "@/lib/types";
import {
  cn,
  EVENT_COLOR_VALUES,
  isSameDay,
  relativeDayLabel,
  timeLabel,
} from "@/lib/utils";
import { useNow } from "@/lib/use-now";

export function UpcomingPanel({
  events,
  selectedDay,
  onOpenEvent,
  onCreateOn,
}: {
  events: CalendarEvent[];
  selectedDay: Date;
  onOpenEvent: (event: CalendarEvent) => void;
  onCreateOn: (day: Date) => void;
}) {
  const now = useNow();
  const select = useNotesStore((state) => state.select);
  const { data: notes = [] } = useNotes();

  // Notes carrying a due date show alongside the schedule.
  const dueNotes = notes
    .filter((note) => note.dueAt && !note.deletedAt && !note.archived)
    .filter((note) => new Date(note.dueAt!).getTime() >= now - 86_400_000)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))
    .slice(0, 5);

  const dayEvents = events.filter((event) =>
    isSameDay(new Date(event.startsAt), selectedDay),
  );

  const upcoming = events
    .filter((event) => new Date(event.endsAt).getTime() >= now)
    .filter((event) => !isSameDay(new Date(event.startsAt), selectedDay))
    .slice(0, 6);

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-line bg-panel lg:h-full lg:w-[320px] lg:border-l lg:border-t-0">
      <header className="border-b border-line px-4 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">
          {relativeDayLabel(selectedDay)}
        </p>
        <h2 className="mt-1 text-[15px] font-semibold tracking-tight">
          {selectedDay.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h2>
      </header>

      <div className="pb-navbar px-4 py-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-4 scroll-thin">
        {dayEvents.length === 0 ? (
          <button
            type="button"
            onClick={() => onCreateOn(selectedDay)}
            className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-line py-6 text-center transition hover:border-line-strong hover:bg-card-hover"
          >
            <CalendarClock className="size-4 text-muted-2" />
            <span className="text-[12px] text-muted">Nothing scheduled</span>
            <span className="text-[11px] text-muted-2">Click to add an event</span>
          </button>
        ) : (
          <div className="space-y-2">
            {dayEvents.map((event, index) => (
              <EventRow
                key={event.id}
                event={event}
                index={index}
                onClick={() => onOpenEvent(event)}
              />
            ))}
          </div>
        )}

        {dueNotes.length > 0 && (
          <div className="mt-7">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">
              Notes due
            </p>
            <div className="space-y-1.5">
              {dueNotes.map((note) => (
                <Link
                  key={note.id}
                  href={ROUTES.all}
                  onClick={() => select(note.id)}
                  className="flex items-center gap-2 rounded-lg border border-line bg-card px-2.5 py-2 transition hover:bg-card-hover"
                >
                  <FileText className="size-3.5 shrink-0 text-glow-2" />
                  <span className="min-w-0 flex-1 truncate text-[12px]">
                    {note.title || "Untitled note"}
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-2">
                    {relativeDayLabel(note.dueAt!)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-7">
          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">
            Upcoming
          </p>

          {upcoming.length === 0 ? (
            <p className="text-[12px] text-muted-2">
              Nothing else on the horizon.
            </p>
          ) : (
            <div className="relative space-y-2 pl-4">
              <span className="absolute left-[5px] top-2 bottom-2 w-px bg-[var(--border)]" />
              {upcoming.map((event, index) => (
                <motion.button
                  type="button"
                  key={event.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.22, delay: index * 0.05 }}
                  onClick={() => onOpenEvent(event)}
                  className="group relative block w-full rounded-lg border border-transparent px-2 py-1.5 text-left transition hover:border-line hover:bg-card"
                >
                  <span
                    className="event-dot absolute -left-[13px] top-3 size-[7px] rounded-full"
                    style={{
                      background: EVENT_COLOR_VALUES[event.color],
                      color: EVENT_COLOR_VALUES[event.color],
                    }}
                  />
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[12px] font-medium">
                      {event.title}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-2">
                      {relativeDayLabel(event.startsAt)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted-2">
                    {event.allDay ? "All day" : timeLabel(event.startsAt)}
                    {event.location ? ` · ${event.location}` : ""}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function EventRow({
  event,
  index,
  onClick,
}: {
  event: CalendarEvent;
  index: number;
  onClick: () => void;
}) {
  const accent = EVENT_COLOR_VALUES[event.color];

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.05 }}
      onClick={onClick}
      className="block w-full overflow-hidden rounded-xl border border-line bg-card p-3 text-left transition hover:border-line-strong hover:bg-card-hover"
    >
      <span className="flex items-start gap-2.5">
        <span
          className="mt-1 h-8 w-[3px] shrink-0 rounded-full"
          style={{ background: accent, boxShadow: `0 0 10px ${accent}66` }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{event.title}</span>

          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-2">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {event.allDay
                ? "All day"
                : `${timeLabel(event.startsAt)} – ${timeLabel(event.endsAt)}`}
            </span>
            {event.location && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{event.location}</span>
              </span>
            )}
          </span>

          {event.description && (
            <span className={cn("clamp-2 mt-1.5 block text-[11px] leading-relaxed text-muted")}>
              {event.description}
            </span>
          )}
        </span>
      </span>
    </motion.button>
  );
}
