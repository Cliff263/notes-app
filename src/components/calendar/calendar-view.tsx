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
import { useBreakpoint } from "@/lib/use-media-query";
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
  // Phones get a dot grid; the day's detail lives in the panel underneath.
  const { isPhone: compact } = useBreakpoint();

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

  const todayCount = events.filter((event) =>
    isSameDay(new Date(event.startsAt), today),
  ).length;

  const weekAhead = new Date(today);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekCount = events.filter((event) => {
    const date = new Date(event.startsAt);
    return date >= today && date <= weekAhead;
  }).length;

  return (
    <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-surface max-lg:min-h-[70vh] lg:h-full">
      <div className="pointer-events-none absolute inset-0 aurora opacity-60" />
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />

      <header className="relative flex flex-col gap-3 border-b border-line px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
        <div className="min-w-0 sm:flex-1">
          <h1 className="glow-text text-[20px] font-semibold tracking-tight sm:text-[22px]">
            {cursor.toLocaleDateString("en-US", { month: "long" })}{" "}
            {cursor.getFullYear()}
          </h1>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip
              label={`${monthEventCount} this month`}
              tone={monthEventCount ? "var(--glow-1)" : undefined}
            />
            <Chip label={`${todayCount} today`} tone={todayCount ? "var(--glow-2)" : undefined} />
            <Chip label={`${weekCount} next 7 days`} />
          </div>
        </div>

        <div className="flex items-center gap-1 max-sm:order-3">
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
          className="flex items-center justify-center gap-1.5 rounded-lg bg-btn px-3 py-2 text-[12px] font-medium text-btn-foreground transition hover:opacity-90 max-sm:order-4 max-sm:flex-1 sm:py-1.5"
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

      <div className="relative min-h-0 flex-1 overflow-hidden p-2 sm:p-3">
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
                  <span
                    className={cn(
                      "flex items-center justify-between",
                      compact && "justify-center",
                    )}
                  >
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
                      hidden={compact}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onCreateOn(day);
                      }}
                      className="hover-reveal flex size-4 items-center justify-center rounded text-muted-2 transition hover:text-foreground"
                    >
                      <Plus className="size-3" />
                    </span>
                  </span>

                  {/*
                   * A phone cell is too narrow for titles, so it shows a row of
                   * dots and the day's agenda lives in the panel below.
                   */}
                  {compact ? (
                    <span className="mt-auto flex flex-wrap justify-center gap-[3px] pb-0.5">
                      {dayEvents.slice(0, 4).map((event) => (
                        <span
                          key={event.id}
                          className="event-dot size-1.5 rounded-full"
                          style={{
                            background: EVENT_COLOR_VALUES[event.color],
                            color: EVENT_COLOR_VALUES[event.color],
                          }}
                        />
                      ))}
                    </span>
                  ) : (
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
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

function Chip({ label, tone }: { label: string; tone?: string }) {
  return (
    <span
      className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-muted-2"
      style={
        tone
          ? {
              color: tone,
              borderColor: `color-mix(in srgb, ${tone} 40%, transparent)`,
              background: `color-mix(in srgb, ${tone} 10%, transparent)`,
            }
          : undefined
      }
    >
      {label}
    </span>
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
