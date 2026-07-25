"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared clock. `getSnapshot` returns a cached timestamp that only changes on
 * a tick, which keeps render pure — reading `Date.now()` during render would
 * produce a different value on every re-render.
 */
let current = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

const TICK_MS = 30_000;

function subscribe(listener: () => void) {
  listeners.add(listener);

  if (!timer) {
    timer = setInterval(() => {
      current = Date.now();
      for (const notify of listeners) notify();
    }, TICK_MS);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  return current;
}

export function useNow() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
