"use client";

import type { Session } from "next-auth";
import { getSession } from "next-auth/react";
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

/**
 * Revalidates the cookie with Auth.js and broadcasts the result to every
 * SessionProvider. API requests use this once after a 401 before giving up.
 */
export async function refreshAuthSession() {
  const session = await getSession();
  useAuthStore
    .getState()
    .syncSession(session, session ? "authenticated" : "unauthenticated");
  return session;
}
