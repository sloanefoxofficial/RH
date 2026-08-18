// The Resilience Hub — push notification service worker.
// This runs in the background, separate from the app itself, which is the
// only reason a notification can show up even when the app is fully closed.

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", (event) => {
  let data = { title: "The Resilience Hub", body: "You have a new notification." };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/", target: data.target || null },
    tag: data.tag || "rh-notification",
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Tapping the notification focuses an already-open tab if there is one,
// otherwise opens a new one. Also tells the app WHICH screen to jump to —
// via postMessage if a tab's already open (no reload, just routes there),
// or via the URL's ?open= param on a fresh launch (the app reads that on load).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.target || null;
  const url = data.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          if (target) client.postMessage({ type: "rh-deep-link", target });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
