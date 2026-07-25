"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { CalendarEvent } from "@/lib/types";
import {
  cn,
  EVENT_COLOR_VALUES,
  isSameDay,
  monthGrid,
  timeLabel,
} from "@/lib/utils";
import { dayKey, selectEventsByDay } from "@/store/events-store";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({
  events,
  cursor,
  onCursorChange,
  selectedDay,
  onSelectDay,
  onCreateOn,
  onOpenEvent,
}: {
  events: CalendarEvent[];
  cursor: Date;
  onCursorChange: (next: Date) => void;
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  onCreateOn: (day: Date) => void;
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  const [direction, setDirection] = useState<1 | -1>(1);
  const today = new Date();

  const cells = useMemo(
    () => monthGrid(cursor.getFullYear(), cursor.getMonth()),
    [cursor],
  );
  const byDay = useMemo(() => selectEventsByDay(events), [events]);

  function move(step: 1 | -1) {
    setDirection(step);
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + step, 1);
    onCursorChange(next);
  }

  function goToday() {
    const now = new Date();
    setDirection(now > cursor ? 1 : -1);
    onCursorChange(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelectDay(now);
  }

  const monthEventCount = events.filter((event) => {
    const date = new Date(event.startsAt);
    return (
      date.getMonth() === cursor.getMonth() &&
      date.getFullYear() === cursor.getFullYear()
    );
  }).length;

  return (
    <section className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-surface">
      <div className="pointer-events-none absolute inset-0 aurora opacity-60" />
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />

      <header className="relative flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0 flex-1">
          <h1 className="glow-text text-[22px] font-semibold tracking-tight">
            {cursor.toLocaleDateString("en-US", { month: "long" })}{" "}
            {cursor.getFullYear()}
          </h1>
          <p className="mt-0.5 text-[11px] text-muted-2">
            {monthEventCount === 0
              ? "Nothing scheduled this month"
              : `${monthEventCount} ${monthEventCount === 1 ? "event" : "events"} scheduled`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <NavButton label="Previous month" onClick={() => move(-1)}>
            <ChevronLeft className="size-4" />
          </NavButton>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition hover:bg-card-hover hover:text-foreground"
          >
            Today
          </button>
          <NavButton label="Next month" onClick={() => move(1)}>
            <ChevronRight className="size-4" />
          </NavButton>
        </div>

        <button
          type="button"
          onClick={() => onCreateOn(selectedDay)}
          className="flex items-center gap-1.5 rounded-lg bg-btn px-3 py-1.5 text-[12px] font-medium text-btn-foreground transition hover:opacity-90"
        >
          <Plus className="size-3.5" />
          New event
        </button>
      </header>

      <div className="relative grid grid-cols-7 border-b border-line px-3 py-2">
        {WEEKDAYS.map((day) => (
          <span
            key={day}
            className="text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2"
          >
            {day}
          </span>
        ))}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden p-3">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={`${cursor.getFullYear()}-${cursor.getMonth()}`}
            custom={direction}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="grid h-full grid-cols-7 grid-rows-6 gap-1.5"
          >
            {cells.map((day, index) => {
              const dayEvents = byDay.get(dayKey(day)) ?? [];
              const inMonth = day.getMonth() === cursor.getMonth();
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selectedDay);

              return (
                <motion.button
                  type="button"
                  key={day.toISOString()}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.18, delay: Math.min(index, 20) * 0.006 }}
                  onClick={() => onSelectDay(day)}
                  onDoubleClick={() => onCreateOn(day)}
                  className={cn(
                    "group relative flex min-h-0 flex-col overflow-hidden rounded-lg border p-1.5 text-left transition",
                    inMonth
                      ? "border-line bg-card/70 backdrop-blur-sm"
                      : "border-transparent bg-transparent",
                    isSelected && !isToday && "border-line-strong bg-card-hover",
                    isToday && "today-glow border-transparent",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-[11px] tabular-nums",
                        isToday
                          ? "font-semibold text-foreground"
                          : inMonth
                            ? "text-muted"
                            : "text-muted-2/50",
                      )}
                    >
                      {day.getDate()}
                    </span>

                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label="Add event"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onCreateOn(day);
                      }}
                      className="hover-reveal flex size-4 items-center justify-center rounded text-muted-2 transition hover:text-foreground"
                    >
                      <Plus className="size-3" />
                    </span>
                  </span>

                  <span className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        role="button"
                        tabIndex={-1}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          onOpenEvent(event);
                        }}
                        className="flex items-center gap-1 truncate rounded px-1 py-[3px] text-[10px] transition hover:brightness-125"
                        style={{
                          background: `color-mix(in srgb, ${EVENT_COLOR_VALUES[event.color]} 16%, transparent)`,
                          color: EVENT_COLOR_VALUES[event.color],
                        }}
                      >
                        <span
                          className="event-dot size-1 shrink-0 rounded-full"
                          style={{ background: EVENT_COLOR_VALUES[event.color] }}
                        />
                        <span className="truncate">
                          {!event.allDay && (
                            <span className="opacity-70">{timeLabel(event.startsAt)} </span>
                          )}
                          {event.title}
                        </span>
                      </span>
                    ))}

                    {dayEvents.length > 3 && (
                      <span className="px-1 text-[10px] text-muted-2">
                        +{dayEvents.length - 3} more
                      </span>
                    )}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-8 items-center justify-center rounded-lg border border-line text-muted transition hover:bg-card-hover hover:text-foreground"
    >
      {children}
    </button>
  );
}
