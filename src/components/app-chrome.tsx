"use client";

import { useSession } from "next-auth/react";
import { CommandPalette } from "./command-palette";
import { Shortcuts } from "./shortcuts";

/**
 * Palette and shortcuts only make sense once signed in — they act on notes, so
 * they stay out of the auth screens entirely.
 */
export function AppChrome() {
  const { status } = useSession();
  if (status !== "authenticated") return null;

  return (
    <>
      <CommandPalette />
      <Shortcuts />
    </>
  );
}
