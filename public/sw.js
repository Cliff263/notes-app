/*
 * Square Notes service worker.
 *
 * Navigations are network-first so a signed-out visitor is always redirected
 * correctly; the app shell falls back to cache when the network is gone.
 * Note and event reads are stale-while-revalidate, which is what makes the
 * workspace readable offline.
 */

const VERSION = "square-notes-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const DATA_CACHE = `${VERSION}-data`;

const SHELL_ROUTES = ["/", "/favorites", "/pinned", "/archive", "/tags", "/calendar"];
const DATA_ROUTES = ["/api/notes", "/api/events"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ROUTES).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Auth must never be served from cache.
  if (url.pathname.startsWith("/api/auth")) return;

  if (DATA_ROUTES.some((route) => url.pathname === route)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  }
});

/*
 * Reminders. The payload is JSON from `lib/push.ts`; a push with no body still
 * shows something rather than nothing, because a silent push is a permission a
 * browser will eventually withdraw.
 */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Square Notes", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "Square Notes", {
      body: payload.body || "",
      // The tag is what collapses a repeat of the same reminder.
      tag: payload.tag || "square-notes",
      renotify: false,
      icon: "/icons/192",
      badge: "/icons/192",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus a tab that is already open rather than piling up new ones.
      for (const client of clients) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      if (clients.length && "navigate" in clients[0]) {
        return clients[0].navigate(target).then((client) => client && client.focus());
      }
      return self.clients.openWindow(target);
    }),
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached ?? network;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = (await cache.match(request)) ?? (await cache.match("/"));
    if (cached) return cached;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
