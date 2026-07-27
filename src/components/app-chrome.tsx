"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useNote, useNoteActions } from "@/hooks/use-notes";
import { ROUTES } from "@/lib/routes";
import { useNotesStore } from "@/store/notes-store";
import { useAuthStore } from "@/store/auth-store";

/*
 * The palette and the help sheet are only mounted once they are opened, so
 * their chunks are fetched on the keystroke that asks for them rather than at
 * first paint. The listener below is the only always-loaded part.
 */
const CommandPalette = dynamic(
  () => import("./command-palette").then((m) => m.CommandPalette),
  { ssr: false },
);
const ShortcutsSheet = dynamic(
  () => import("./shortcuts").then((m) => m.ShortcutsSheet),
  { ssr: false },
);
const OfflineIndicator = dynamic(
  () => import("./offline-indicator").then((m) => m.OfflineIndicator),
  { ssr: false },
);

export function AppChrome() {
  const status = useAuthStore((state) => state.status);
  if (status !== "authenticated") return null;
  return <Chrome />;
}

function Chrome() {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const selectedId = useNotesStore((state) => state.selectedId);
  const note = useNote(selectedId);
  const actions = useNoteActions();

  // The listener registers once and reads the latest data through a ref.
  const latest = useRef({ note, actions });
  useEffect(() => {
    latest.current = { note, actions };
  }, [note, actions]);

  useEffect(() => {
    let awaitingGo = false;
    let goTimer: ReturnType<typeof setTimeout> | null = null;

    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
        return;
      }

      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const store = useNotesStore.getState();
      const { note, actions: act } = latest.current;

      if (event.key === "Escape") {
        if (helpOpen) setHelpOpen(false);
        else if (paletteOpen) setPaletteOpen(false);
        else if (store.drawerOpen) store.setDrawerOpen(false);
        else if (store.selectedId) store.select(null);
        return;
      }

      if (typing) return;

      // "g" starts a two-key sequence, the way Gmail and GitHub do it.
      if (awaitingGo) {
        awaitingGo = false;
        if (goTimer) clearTimeout(goTimer);

        const destination: Record<string, string> = {
          c: ROUTES.calendar,
          t: ROUTES.tags,
          a: ROUTES.all,
          f: ROUTES.favorites,
          p: ROUTES.pinned,
          s: ROUTES.settings,
        };
        const path = destination[event.key.toLowerCase()];
        if (path) {
          event.preventDefault();
          router.push(path);
        }
        return;
      }

      switch (event.key.toLowerCase()) {
        case "g":
          awaitingGo = true;
          goTimer = setTimeout(() => {
            awaitingGo = false;
          }, 1200);
          break;
        case "n":
          event.preventDefault();
          void act.createNote();
          break;
        case "/": {
          event.preventDefault();
          document
            .querySelector<HTMLInputElement>("[data-search-input]")
            ?.focus();
          break;
        }
        case "e":
          if (note) act.updateNote(note.id, { favorite: !note.favorite });
          break;
        case "p":
          if (note) act.updateNote(note.id, { pinned: !note.pinned });
          break;
        case "a":
          if (note) act.updateNote(note.id, { archived: !note.archived });
          break;
        case "?":
          setHelpOpen(true);
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (goTimer) clearTimeout(goTimer);
    };
  }, [router, helpOpen, paletteOpen]);

  return (
    <>
      {paletteOpen && (
        <CommandPalette open onClose={() => setPaletteOpen(false)} />
      )}
      {helpOpen && <ShortcutsSheet open onClose={() => setHelpOpen(false)} />}
      <OfflineIndicator />
    </>
  );
}
