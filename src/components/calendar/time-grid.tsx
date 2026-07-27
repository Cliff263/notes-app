"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { dayPosition, layOutDay } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/types";
import { cn, EVENT_COLOR_VALUES, isSameDay, startOfDay, timeLabel } from "@/lib/utils";
import { useMounted, useNow } from "@/lib/use-now";

/** 56px an hour: an hour is comfortably tappable and a day still fits a screen. */
const HOUR = 56;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/**
 * The week and day views are the same grid with a different number of columns,
 * so they are one component. All-day events sit in a strip above it rather than
 * stretching the whole height of the day.
 */
export function TimeGrid({
  days,
  events,
  selectedDay,
  onSelectDay,
  onOpenEvent,
  onCreateOn,
}: {
  days: Date[];
  events: CalendarEvent[];
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onCreateOn: (day: Date) => void;
}) {
  const reduced = useReducedMotion();
  // A shared, cached clock: reading Date.now() during render would not be pure.
  const now = new Date(useNow());
  // The marker below is positioned to the minute, so the server's idea of "now"
  // would never match the browser's. It waits until there is only one clock.
  const mounted = useMounted();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open on the working day rather than at midnight.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTop = HOUR * 7.5;
  }, [days.length]);

  const allDay = events.filter((event) => event.allDay);
  const timed = events.filter((event) => !event.allDay);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {allDay.length > 0 && (
        <div
          className="grid shrink-0 gap-px border-b border-line bg-line pl-12"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {days.map((day) => (
            <div key={day.toISOString()} className="min-h-[34px] space-y-1 bg-surface p-1">
              {allDay
                .filter((event) => isSameDay(new Date(event.startsAt), day))
                .map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onOpenEvent(event)}
                    className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] transition hover:brightness-125"
                    style={{
                      background: `color-mix(in srgb, ${EVENT_COLOR_VALUES[event.color]} 20%, transparent)`,
                      color: EVENT_COLOR_VALUES[event.color],
                    }}
                  >
                    {event.title}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        <div className="relative flex">
          {/* The hour rail, which every column lines up against. */}
          <div className="sticky left-0 z-10 w-12 shrink-0 bg-surface">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="relative text-right"
                style={{ height: HOUR }}
              >
                <span className="absolute -top-1.5 right-1.5 text-[10px] tabular-nums text-muted-2">
                  {hour === 0 ? "" : `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "am" : "pm"}`}
                </span>
              </div>
            ))}
          </div>

          <div
            className="grid flex-1 gap-px bg-line"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {days.map((day) => {
              const dayEvents = timed.filter((event) =>
                isSameDay(new Date(event.startsAt), day),
              );

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => onSelectDay(day)}
                  onDoubleClick={(clickEvent) => {
                    // Create at the hour that was double-clicked, not midnight.
                    const bounds = clickEvent.currentTarget.getBoundingClientRect();
                    const hour = Math.floor(
                      ((clickEvent.clientY - bounds.top) / bounds.height) * 24,
                    );
                    const at = startOfDay(day);
                    at.setHours(Math.min(Math.max(hour, 0), 23));
                    onCreateOn(at);
                  }}
                  className={cn(
                    "relative bg-surface",
                    isSameDay(day, selectedDay) && "bg-card/40",
                  )}
                  style={{ height: HOUR * 24 }}
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-line/60"
                      style={{ height: HOUR }}
                    />
                  ))}

                  {/* Where we are now, on today's column only. */}
                  {mounted && isSameDay(day, now) && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                      style={{
                        top: `${((now.getHours() * 60 + now.getMinutes()) / 1440) * 100}%`,
                      }}
                    >
                      <span className="size-1.5 -translate-x-1/2 rounded-full bg-[var(--glow-2)]" />
                      <span className="h-px flex-1 bg-[var(--glow-2)]" />
                    </div>
                  )}

                  {layOutDay(dayEvents).map(({ event, column, columns }) => {
                    const { top, height } = dayPosition(event, day);
                    const width = 100 / columns;

                    return (
                      <motion.button
                        key={event.id}
                        type="button"
                        initial={reduced ? false : { opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          onOpenEvent(event);
                        }}
                        className="absolute overflow-hidden rounded-md border px-1.5 py-1 text-left transition hover:brightness-125"
                        style={{
                          top: `${top * 100}%`,
                          height: `${height * 100}%`,
                          left: `${column * width}%`,
                          width: `calc(${width}% - 2px)`,
                          background: `color-mix(in srgb, ${EVENT_COLOR_VALUES[event.color]} 18%, var(--surface))`,
                          borderColor: `color-mix(in srgb, ${EVENT_COLOR_VALUES[event.color]} 45%, transparent)`,
                          color: EVENT_COLOR_VALUES[event.color],
                        }}
                      >
                        <span className="block truncate text-[10.5px] font-medium leading-tight">
                          {event.title}
                        </span>
                        <span className="block truncate text-[9.5px] opacity-75">
                          {timeLabel(event.startsAt)}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The weekday strip above a week grid. */
export function TimeGridHeader({
  days,
  selectedDay,
  onSelectDay,
}: {
  days: Date[];
  selectedDay: Date;
  onSelectDay: (day: Date) => void;
}) {
  const now = new Date(useNow());

  return (
    <div
      className="grid shrink-0 border-b border-line pl-12"
      style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
    >
      {days.map((day) => {
        const isToday = isSameDay(day, now);
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelectDay(day)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 transition",
              isSameDay(day, selectedDay) ? "text-foreground" : "text-muted-2 hover:text-muted",
            )}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
              {day.toLocaleDateString("en-US", { weekday: "short" })}
            </span>
            <span
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-[12px] tabular-nums",
                isToday && "bg-btn font-semibold text-btn-foreground",
              )}
            >
              {day.getDate()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
