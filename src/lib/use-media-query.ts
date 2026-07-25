"use client";

import { useSyncExternalStore } from "react";

/**
 * Media queries as an external store, so render stays pure — the same shape as
 * the clock in `use-now.ts`. Layout is CSS-first; this is only for the few
 * places where the markup itself has to differ (the compact calendar).
 */
const stores = new Map<
  string,
  { matches: boolean; subscribe: (listener: () => void) => () => void }
>();

function storeFor(query: string) {
  const existing = stores.get(query);
  if (existing) return existing;

  const listeners = new Set<() => void>();
  const store = {
    matches: false,
    subscribe(listener: () => void) {
      listeners.add(listener);

      const list = window.matchMedia(query);
      store.matches = list.matches;

      const onChange = (event: MediaQueryListEvent) => {
        store.matches = event.matches;
        for (const notify of listeners) notify();
      };
      list.addEventListener("change", onChange);

      return () => {
        listeners.delete(listener);
        list.removeEventListener("change", onChange);
      };
    },
  };

  stores.set(query, store);
  return store;
}

export function useMediaQuery(query: string, serverValue = false) {
  const store = storeFor(query);
  return useSyncExternalStore(
    store.subscribe,
    () => store.matches,
    () => serverValue,
  );
}

/** Tailwind's md and lg, as booleans. Server renders as desktop. */
export function useBreakpoint() {
  const isTabletUp = useMediaQuery("(min-width: 768px)", true);
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);

  return {
    isPhone: !isTabletUp,
    isTablet: isTabletUp && !isDesktop,
    isDesktop,
  };
}
