"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { shouldRetry } from "@/lib/api";

export function QueryProvider({ children }: { children: ReactNode }) {
  // Created in state so a Fast Refresh or a re-render never swaps the cache.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Notes and events change from this tab far more often than from
            // elsewhere, so a short stale window avoids refetching on every
            // navigation while still catching outside edits on focus.
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: shouldRetry,
          },
          mutations: { retry: shouldRetry },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
