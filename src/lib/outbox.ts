"use client";

import { publishMutation } from "./realtime";

/**
 * Writes that failed because the device was offline. They are replayed in order
 * when the connection returns, so an edit made on a train is not lost.
 */
type Queued = {
  url: string;
  method: string;
  body: string;
  queuedAt: number;
};

const KEY = "square-outbox";

function read(): Queued[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Queued[]) : [];
  } catch {
    return [];
  }
}

function write(entries: Queued[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked — the edit stays in memory for this session only.
  }
}

export function queueRequest(url: string, method: string, body: string) {
  if (typeof window === "undefined") return;
  write([...read(), { url, method, body, queuedAt: Date.now() }]);
}

export async function flushOutbox() {
  if (typeof window === "undefined") return;

  const entries = read();
  if (entries.length === 0) return;

  const remaining: Queued[] = [];
  for (const entry of entries) {
    try {
      const response = await fetch(entry.url, {
        method: entry.method,
        headers: { "Content-Type": "application/json" },
        body: entry.body,
      });
      // A 4xx means the request will never succeed; drop it rather than loop.
      if (!response.ok && response.status < 500) continue;
      if (!response.ok) remaining.push(entry);
      else publishMutation(entry.url);
    } catch {
      remaining.push(entry);
    }
  }

  write(remaining);
}

export function startOutbox() {
  if (typeof window === "undefined") return () => {};

  const onOnline = () => void flushOutbox();
  window.addEventListener("online", onOnline);
  void flushOutbox();

  return () => window.removeEventListener("online", onOnline);
}

export function outboxSize() {
  return typeof window === "undefined" ? 0 : read().length;
}
