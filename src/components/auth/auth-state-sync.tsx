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
  const synchronizedStatus = useAuthStore((state) => state.status);
  const synchronizedUserId = useAuthStore((state) => state.user?.id ?? null);
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    useAuthStore.getState().syncSession(session, status);
  }, [session, status]);

  useEffect(() => {
    if (synchronizedStatus === "loading") return;

    if (
      previousUserId.current !== undefined &&
      previousUserId.current !== synchronizedUserId
    ) {
      queryClient.clear();
      useNotesStore.getState().reset();
    }
    previousUserId.current = synchronizedUserId;
  }, [queryClient, synchronizedStatus, synchronizedUserId]);

  useEffect(() => {
    if (synchronizedStatus !== "unauthenticated") return;
    if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) return;

    const callbackUrl = `${pathname}${window.location.search}`;
    router.replace(
      `/login?reason=session_expired&callbackUrl=${encodeURIComponent(callbackUrl)}`,
    );
  }, [pathname, router, synchronizedStatus]);

  return null;
}
