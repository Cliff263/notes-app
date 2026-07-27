"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

/** The VAPID public key, base64url as the browser wants it as bytes. */
function decodeKey(key: string) {
  const padded = key.padEnd(key.length + ((4 - (key.length % 4)) % 4), "=");
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export type PushState =
  | "unsupported"
  | "unconfigured"
  | "no-worker"
  | "denied"
  | "off"
  | "on"
  | "working";

/**
 * `serviceWorker.ready` never settles when nothing has been registered — which
 * is the case in development, where the worker is deliberately left out — so it
 * is raced against a timeout rather than left to hang the UI forever.
 */
async function waitForWorker() {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
  ]);
}

/**
 * Turning reminders on has three parties to satisfy: the browser (permission),
 * the push service (a subscription) and this app (a row to send to). This hook
 * keeps them in step and reports one state the UI can render.
 */
/**
 * Works out where things stand without touching state, so the effect below has
 * exactly one thing to do with the answer.
 */
async function readState(publicKey: string): Promise<PushState> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }
  if (!publicKey) return "unconfigured";
  if (Notification.permission === "denied") return "denied";

  const registration = await waitForWorker();
  if (!registration) return "no-worker";

  return (await registration.pushManager.getSubscription()) ? "on" : "off";
}

export function usePushToggle(publicKey: string) {
  const [state, setState] = useState<PushState>("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    readState(publicKey).then((next) => {
      if (!cancelled) setState(next);
    });

    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const enable = useCallback(async () => {
    setState("working");
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await waitForWorker();
      if (!registration) {
        setState("no-worker");
        return;
      }

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(publicKey),
        }));

      await api("/api/push/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      });
      setState("on");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not turn reminders on");
      setState("off");
    }
  }, [publicKey]);

  const disable = useCallback(async () => {
    setState("working");
    try {
      const registration = await waitForWorker();
      if (!registration) {
        setState("no-worker");
        return;
      }

      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await api("/api/push/subscribe", {
          method: "DELETE",
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not turn reminders off");
      setState("on");
    }
  }, []);

  return { state, error, enable, disable };
}
