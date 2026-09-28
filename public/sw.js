// The Resilience Hub — push notification service worker.
// Notification payloads may include a target screen and an optional URL.
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Locale packs are public and contain only interface copy. Retain a cached
  // copy so switching languages remains dependable during a brief outage.
  if (event.request.method !== "GET" || !url.pathname.startsWith("/locales/") || !url.pathname.endsWith(".json")) return;
  event.respondWith(caches.open("rh-locales-v1").then(async (cache) => {
    const cached = await cache.match(event.request);
    const network = fetch(event.request).then((response) => {
      if (response && response.ok) cache.put(event.request, response.clone());
      return response;
    }).catch(() => cached);
    // Go to the network first so a future deployment can correct a translation;
    // the cached copy remains a resilient fallback for a temporary outage.
    return network;
  }));
});

self.addEventListener("push", (event) => {
  let data = { title: "The Resilience Hub", body: "You have a new notification." };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}
  const options = {
    body: data.body || "",
    icon: "/resilience-hub-logo.png",
    badge: "/resilience-hub-logo.png",
    data: { url: data.url || "/", target: data.target || null },
    tag: data.tag || "rh-notification",
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.target || null;
  const url = data.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (!("focus" in client)) continue;
        if (target) {
          try { client.postMessage({ type: "rh-deep-link", target }); } catch {}
        }
        if ("focus" in client) client.focus();
        if ("navigate" in client) return client.navigate(url).catch(() => {});
        return;
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
