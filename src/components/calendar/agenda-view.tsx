"use client";

import { CalendarOff, Repeat } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { dayKey } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/types";
import {
  cn,
  EVENT_COLOR_VALUES,
  isSameDay,
  relativeDayLabel,
  timeLabel,
} from "@/lib/utils";
import { useNow } from "@/lib/use-now";

/**
 * Everything coming up, in order, grouped by day. The view for the question
 * "what is actually happening", which a grid answers slowly.
 */
export function AgendaView({
  events,
  onOpenEvent,
}: {
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  const now = new Date(useNow());

  const groups = new Map<string, { day: Date; events: CalendarEvent[] }>();
  for (const event of events) {
    const day = new Date(event.startsAt);
    const key = dayKey(day);
    const group = groups.get(key);
    if (group) group.events.push(event);
    else groups.set(key, { day, events: [event] });
  }

  if (!groups.size) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <CalendarOff className="size-6 text-muted-2" />
        <p className="text-[13px] font-medium">Nothing scheduled</p>
        <p className="max-w-[300px] text-[12px] text-muted-2">
          The next thirty days are clear. Add an event, or give a note a due date
          and it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 scroll-thin sm:px-5">
      <Stagger className="space-y-5">
        {[...groups.values()].map(({ day, events: dayEvents }) => (
          <StaggerItem key={dayKey(day)}>
            <div className="flex items-baseline gap-2">
              <h2
                className={cn(
                  "text-[13px] font-semibold tracking-tight",
                  isSameDay(day, now) && "text-glow-2",
                )}
              >
                {relativeDayLabel(day)}
              </h2>
              <span className="text-[11px] text-muted-2">
                {day.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>

            <div className="mt-2 space-y-1.5">
              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onOpenEvent(event)}
                  className="flex w-full items-start gap-3 rounded-lg border border-line bg-card p-2.5 text-left transition hover:border-line-strong hover:bg-card-hover"
                >
                  <span
                    className="mt-1 w-[62px] shrink-0 text-[11px] tabular-nums text-muted-2"
                  >
                    {event.allDay ? "All day" : timeLabel(event.startsAt)}
                  </span>

                  <span
                    className="mt-1.5 size-1.5 shrink-0 rounded-full event-dot"
                    style={{
                      background: EVENT_COLOR_VALUES[event.color],
                      color: EVENT_COLOR_VALUES[event.color],
                    }}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-medium">
                        {event.title}
                      </span>
                      {event.recurrence && (
                        <Repeat className="size-3 shrink-0 text-muted-2" />
                      )}
                    </span>
                    {event.location && (
                      <span className="mt-0.5 block truncate text-[11px] text-muted-2">
                        {event.location}
                      </span>
                    )}
                    {event.description && (
                      <span className="clamp-2 mt-0.5 block text-[11px] leading-[1.5] text-muted">
                        {event.description}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
