"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/lib/query-keys";
import { subscribeToMutations } from "@/lib/realtime";

/** Refetches account-scoped data when another Nexora tab changes it. */
export function RealtimeSync() {
  const client = useQueryClient();

  useEffect(
    () =>
      subscribeToMutations((path) => {
        if (path.startsWith("/api/notes") || path.startsWith("/api/s/")) {
          void client.invalidateQueries({ queryKey: queryKeys.notes.all });
          void client.invalidateQueries({ queryKey: queryKeys.account.all });
          // Note edits can also update events linked from that note.
          void client.invalidateQueries({ queryKey: queryKeys.events.all });
        }
        if (path.startsWith("/api/events")) {
          void client.invalidateQueries({ queryKey: queryKeys.events.all });
          void client.invalidateQueries({ queryKey: queryKeys.account.all });
        }
        if (path.startsWith("/api/account")) {
          void client.invalidateQueries({ queryKey: queryKeys.account.all });
        }
      }),
    [client],
  );

  return null;
}
