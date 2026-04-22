const CACHE_NAME = "optimabiz-v3";
const BASE_URL = self.registration.scope;

const urlsToCache = [
  `${BASE_URL}`,
  `${BASE_URL}index.html`,
  `${BASE_URL}offline.html`,
  `${BASE_URL}assets/style.css`,
  `${BASE_URL}manifest.json`,
  `${BASE_URL}icons/icon-192x192-A.png`,
  `${BASE_URL}icons/icon-512x512-B.png`,
];

// ── INSTALL ──────────────────────────────────────────────────
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.error("Cache gagal:", err))
  );
});

// ── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => key !== CACHE_NAME && caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

// ── FETCH ─────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.protocol.startsWith("chrome-extension")) return;
  if (request.method !== "GET") return;
  if (url.hostname === "api.anthropic.com") return;

  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(response =>
        response || fetch(request).catch(() => caches.match(`${BASE_URL}offline.html`))
      )
    );
  } else {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
  }
});

// ── PERIODIC BACKGROUND SYNC ──────────────────────────────────
self.addEventListener("periodicsync", event => {
  if (event.tag === "optimabiz-sync") {
    event.waitUntil(
      (async () => {
        // Sync data produk di background
        const clients = await self.clients.matchAll();
        clients.forEach(client =>
          client.postMessage({ type: "BACKGROUND_SYNC", tag: "optimabiz-sync" })
        );
      })()
    );
  }
});

// ── BACKGROUND SYNC ───────────────────────────────────────────
self.addEventListener("sync", event => {
  if (event.tag === "optimabiz-data-sync") {
    event.waitUntil(
      (async () => {
        const clients = await self.clients.matchAll();
        clients.forEach(client =>
          client.postMessage({ type: "SYNC_COMPLETE", tag: event.tag })
        );
      })()
    );
  }
});

// ── PUSH NOTIFICATIONS ────────────────────────────────────────
self.addEventListener("push", event => {
  let data = { title: "OptimaBiz", body: "Ada update untuk bisnismu!", icon: "icons/icon-192x192-A.png" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "icons/icon-192x192-A.png",
      badge: "icons/icon-192x192-A.png",
      vibrate: [200, 100, 200],
      data: { url: BASE_URL }
    })
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || BASE_URL)
  );
});

// ── MESSAGE HANDLER ───────────────────────────────────────────
self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "REGISTER_PERIODIC_SYNC") {
    self.registration.periodicSync?.register("optimabiz-sync", {
      minInterval: 24 * 60 * 60 * 1000
    }).catch(() => {});
  }
});
