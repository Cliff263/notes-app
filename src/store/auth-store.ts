"use client";

import type { Session } from "next-auth";
import { getSession, signOut } from "next-auth/react";
import { create } from "zustand";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
export type AuthUser = Session["user"];

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
  lastSyncedAt: number | null;
  syncSession: (session: Session | null, status: AuthStatus) => void;
  setUserName: (name: string) => void;
  clear: () => void;
};

/**
 * A client-side view of the Auth.js session. It is deliberately not persisted:
 * the encrypted, HTTP-only Auth.js cookie remains the source of truth.
 */
export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,
  lastSyncedAt: null,

  syncSession: (session, status) =>
    set((current) => ({
      status,
      user: session?.user ?? (status === "loading" ? current.user : null),
      lastSyncedAt: status === "loading" ? current.lastSyncedAt : Date.now(),
    })),

  setUserName: (name) =>
    set((state) => ({
      user: state.user ? { ...state.user, name } : state.user,
    })),

  clear: () =>
    set({
      status: "unauthenticated",
      user: null,
      lastSyncedAt: Date.now(),
    }),
}));

let sessionRefresh: Promise<Session | null> | null = null;
let sessionLogout: Promise<void> | null = null;

/**
 * Revalidates the cookie with Auth.js and broadcasts the result to every
 * SessionProvider. Concurrent 401s share one check instead of each issuing a
 * separate session request.
 */
export async function refreshAuthSession() {
  if (!sessionRefresh) {
    sessionRefresh = getSession()
      .then((session) => {
        useAuthStore
          .getState()
          .syncSession(session, session ? "authenticated" : "unauthenticated");
        return session;
      })
      .finally(() => {
        sessionRefresh = null;
      });
  }

  return sessionRefresh;
}

/**
 * Ends a session that the API has rejected after revalidation. Clearing local
 * state happens synchronously so stale account data disappears immediately;
 * Auth.js then clears the HTTP-only cookie. The hard navigation is deliberately
 * kept as a fallback in case its provider and our client store have drifted.
 */
export function logoutInvalidSession() {
  useAuthStore.getState().clear();

  if (sessionLogout) return sessionLogout;

  const callbackUrl =
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname}${window.location.search}`;
  const loginUrl = `/login?reason=session_expired&callbackUrl=${encodeURIComponent(
    callbackUrl,
  )}`;

  sessionLogout = (async () => {
    try {
      await signOut({ redirect: false, redirectTo: loginUrl });
    } catch {
      // The redirect below still gets the user out of the stale workspace when
      // the Auth.js sign-out request itself cannot complete.
    } finally {
      if (typeof window !== "undefined") window.location.replace(loginUrl);
    }
  })();

  return sessionLogout;
}
