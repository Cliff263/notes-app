"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Repeat, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { EVENT_COLORS, type CalendarEvent, type EventColor } from "@/lib/types";
import {
  describeRecurrence,
  formatRecurrence,
  parseRecurrence,
  type Recurrence,
} from "@/lib/recurrence";
import { cn, EVENT_COLOR_VALUES, toLocalInputValue } from "@/lib/utils";
import { useEventActions, type EventDraft } from "@/hooks/use-events";

export type EventModalState =
  | { mode: "closed" }
  | { mode: "create"; day: Date }
  | { mode: "edit"; event: CalendarEvent };

export function EventModal({
  state,
  onClose,
}: {
  state: EventModalState;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {state.mode !== "closed" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
          >
            <EventForm state={state} onClose={onClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EventForm({
  state,
  onClose,
}: {
  state: Exclude<EventModalState, { mode: "closed" }>;
  onClose: () => void;
}) {
  const { createEvent, updateEvent, deleteEvent } = useEventActions();

  const [draft, setDraft] = useState<EventDraft>(() => initialDraft(state));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function patch(next: Partial<EventDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (!draft.title.trim()) {
      setError("Give the event a title");
      return;
    }
    if (new Date(draft.endsAt) < new Date(draft.startsAt)) {
      setError("The end time is before the start time");
      return;
    }

    setSaving(true);
    const payload: EventDraft = {
      ...draft,
      startsAt: new Date(draft.startsAt).toISOString(),
      endsAt: new Date(draft.endsAt).toISOString(),
    };

    const ok =
      state.mode === "edit"
        ? await updateEvent(state.event.id, payload)
        : await createEvent(payload);

    setSaving(false);
    if (ok) onClose();
    else setError("Could not save the event. Please try again.");
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[14px] font-semibold tracking-tight">
          {state.mode === "edit" ? "Edit event" : "New event"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-7 items-center justify-center rounded-lg text-muted-2 transition hover:bg-card-hover hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="space-y-3.5 px-4 py-4">
        <input
          autoFocus
          value={draft.title}
          onChange={(event) => patch({ title: event.target.value })}
          placeholder="Event title"
          className="h-10 w-full rounded-lg border border-line field bg-input px-3 font-medium transition focus:border-line-strong"
        />

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] text-muted-2">Starts</span>
            <input
              type="datetime-local"
              value={draft.startsAt}
              onChange={(event) => {
                const startsAt = event.target.value;
                const duration =
                  new Date(draft.endsAt).getTime() - new Date(draft.startsAt).getTime();
                const endsAt = toLocalInputValue(
                  new Date(new Date(startsAt).getTime() + Math.max(duration, 0)),
                );
                patch({ startsAt, endsAt });
              }}
              className="h-9 w-full rounded-lg border border-line field-sm bg-input px-2.5 transition focus:border-line-strong"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] text-muted-2">Ends</span>
            <input
              type="datetime-local"
              value={draft.endsAt}
              onChange={(event) => patch({ endsAt: event.target.value })}
              className="h-9 w-full rounded-lg border border-line field-sm bg-input px-2.5 transition focus:border-line-strong"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-[12px] text-muted">
          <input
            type="checkbox"
            checked={draft.allDay}
            onChange={(event) => patch({ allDay: event.target.checked })}
            className="size-3.5 accent-[var(--glow-1)]"
          />
          All day
        </label>

        <RepeatPicker
          value={draft.recurrence}
          onChange={(recurrence) => patch({ recurrence })}
        />

        <input
          value={draft.location}
          onChange={(event) => patch({ location: event.target.value })}
          placeholder="Location (optional)"
          className="h-9 w-full rounded-lg border border-line field-sm bg-input px-3 transition focus:border-line-strong"
        />

        <textarea
          value={draft.description}
          onChange={(event) => patch({ description: event.target.value })}
          placeholder="Notes (optional)"
          rows={3}
          className="w-full resize-none rounded-lg border border-line field-sm bg-input px-3 py-2 leading-relaxed transition focus:border-line-strong scroll-thin"
        />

        <div>
          <span className="mb-2 block text-[11px] text-muted-2">Colour</span>
          <div className="flex gap-2">
            {EVENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={color}
                onClick={() => patch({ color })}
                className={cn(
                  "size-6 rounded-full transition",
                  draft.color === color
                    ? "ring-2 ring-offset-2 ring-offset-[var(--surface)]"
                    : "opacity-60 hover:opacity-100",
                )}
                style={{
                  background: EVENT_COLOR_VALUES[color],
                  boxShadow:
                    draft.color === color
                      ? `0 0 12px ${EVENT_COLOR_VALUES[color]}88`
                      : undefined,
                  ...(draft.color === color
                    ? { ["--tw-ring-color" as string]: EVENT_COLOR_VALUES[color] }
                    : {}),
                }}
              />
            ))}
          </div>
        </div>

        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>

      <div className="flex items-center gap-2 border-t border-line px-4 py-3">
        {state.mode === "edit" && (
          <button
            type="button"
            onClick={() => {
              void deleteEvent(state.event.id);
              onClose();
            }}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-muted-2 transition hover:bg-card-hover hover:text-danger"
          >
            <Trash2 className="size-3.5" />
            Delete
          </button>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line px-3 py-1.5 text-[12px] text-muted transition hover:bg-card-hover hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-btn px-3 py-1.5 text-[12px] font-medium text-btn-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          {state.mode === "edit" ? "Save changes" : "Create event"}
        </button>
      </div>
    </form>
  );
}

/**
 * Repeats, offered as the four rules the app can actually expand. "Custom"
 * exposes the interval and an end condition; anything more elaborate belongs in
 * a calendar app, not a notes app.
 */
function RepeatPicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (next: string | null) => void;
}) {
  const rule = parseRecurrence(value);
  const [open, setOpen] = useState(Boolean(rule && rule.interval > 1));

  const presets: Array<{ label: string; rule: string | null }> = [
    { label: "Never", rule: null },
    { label: "Daily", rule: "FREQ=DAILY" },
    { label: "Weekly", rule: "FREQ=WEEKLY" },
    { label: "Monthly", rule: "FREQ=MONTHLY" },
    { label: "Yearly", rule: "FREQ=YEARLY" },
  ];

  const update = (patch: Partial<Recurrence>) => {
    const base: Recurrence = rule ?? {
      freq: "WEEKLY",
      interval: 1,
      until: null,
      count: null,
    };
    onChange(formatRecurrence({ ...base, ...patch }));
  };

  return (
    <div className="rounded-lg border border-line p-2.5">
      <div className="flex items-center gap-2">
        <Repeat className="size-3.5 text-muted-2" />
        <span className="flex-1 text-[11px] text-muted-2">Repeats</span>
        {rule && (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="text-[11px] text-muted transition hover:text-foreground"
          >
            {open ? "Hide options" : "Options"}
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {presets.map((preset) => {
          const active = preset.rule
            ? rule?.freq === parseRecurrence(preset.rule)?.freq
            : !rule;

          return (
            <button
              key={preset.label}
              type="button"
              onClick={() =>
                preset.rule ? update({ freq: parseRecurrence(preset.rule)!.freq }) : onChange(null)
              }
              className={cn(
                "rounded-md border px-2 py-1 text-[11px] transition",
                active
                  ? "border-transparent bg-btn text-btn-foreground"
                  : "border-line text-muted hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {rule && open && (
        <div className="mt-2.5 space-y-2 border-t border-line pt-2.5">
          <label className="flex items-center gap-2 text-[11px] text-muted-2">
            Every
            <input
              type="number"
              min={1}
              max={99}
              value={rule.interval}
              onChange={(event) =>
                update({ interval: Math.max(1, Number(event.target.value) || 1) })
              }
              className="h-7 w-14 rounded-md border border-line field-sm bg-input px-2 text-foreground"
            />
            {{ DAILY: "days", WEEKLY: "weeks", MONTHLY: "months", YEARLY: "years" }[rule.freq]}
          </label>

          <label className="flex items-center gap-2 text-[11px] text-muted-2">
            Until
            <input
              type="date"
              value={rule.until ? toLocalInputValue(rule.until).slice(0, 10) : ""}
              onChange={(event) =>
                update({
                  until: event.target.value ? new Date(`${event.target.value}T23:59`) : null,
                  count: null,
                })
              }
              className="h-7 rounded-md border border-line field-sm bg-input px-2 text-foreground"
            />
            {rule.until && (
              <button
                type="button"
                onClick={() => update({ until: null })}
                className="text-muted-2 transition hover:text-foreground"
              >
                clear
              </button>
            )}
          </label>

          <p className="text-[11px] text-muted-2">{describeRecurrence(rule)}</p>
        </div>
      )}
    </div>
  );
}

function initialDraft(
  state: Exclude<EventModalState, { mode: "closed" }>,
): EventDraft {
  if (state.mode === "edit") {
    const { event } = state;
    return {
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: toLocalInputValue(event.startsAt),
      endsAt: toLocalInputValue(event.endsAt),
      allDay: event.allDay,
      color: event.color,
      recurrence: event.recurrence,
    };
  }

  const start = new Date(state.day);
  const now = new Date();
  start.setHours(now.getHours() + 1, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);

  return {
    title: "",
    description: "",
    location: "",
    startsAt: toLocalInputValue(start),
    endsAt: toLocalInputValue(end),
    allDay: false,
    color: "violet" satisfies EventColor,
    recurrence: null,
  };
}
