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
            // Mutations update the cache directly and other tabs broadcast
            // invalidations, so route changes can reuse data for five minutes
            // instead of turning every mount into another API request.
            staleTime: 5 * 60_000,
            gcTime: 30 * 60_000,
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
