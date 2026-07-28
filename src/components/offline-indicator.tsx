"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CloudOff } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { startOutbox } from "@/lib/outbox";
import { useMediaQuery } from "@/lib/use-media-query";

/** Registers the service worker and shows a banner while the network is gone. */
export function OfflineIndicator() {
  const online = useOnline();
  // Only used to keep the banner clear of the bottom bar on small screens.
  const isDesktop = useMediaQuery("(min-width: 1024px)", true);

  useEffect(() => {
    const stopOutbox = startOutbox();

    // The worker is only registered for production builds; in dev it would
    // fight Turbopack's own asset handling.
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    }

    return stopOutbox;
  }, []);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          className={`fixed left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-[11px] text-muted shadow-lg ${
            isDesktop ? "bottom-4" : "bottom-24"
          }`}
        >
          <CloudOff className="size-3.5 text-accent" />
          Offline — showing your saved notes, changes will sync
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function subscribe(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
