"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useNotesStore } from "@/store/notes-store";

const PUBLIC_ROUTES = ["/login", "/signup", "/forgot", "/reset/", "/verify/", "/s/"];

/**
 * Bridges Auth.js into Zustand and clears account-scoped client state whenever
 * the active user changes. This prevents one account's cached workspace from
 * leaking into the next session.
 */
export function AuthStateSync() {
  const { data: session, status } = useSession();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    useAuthStore.getState().syncSession(session, status);

    if (status === "loading") return;

    const userId = session?.user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) {
      queryClient.clear();
      useNotesStore.getState().reset();
    }
    previousUserId.current = userId;
  }, [queryClient, session, status]);

  useEffect(() => {
    if (status !== "unauthenticated") return;
    if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) return;

    const callbackUrl = `${pathname}${window.location.search}`;
    router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }, [pathname, router, status]);

  return null;
}
