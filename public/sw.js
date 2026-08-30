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
// otherwise opens a new one — and either way, actually navigates it to the
// right screen. postMessage alone isn't reliable here: if the app's tab was
// sitting frozen/suspended in the background (very common on Android when a
// tab isn't in focus), the message can arrive before the page's listeners
// are alive again and just gets silently dropped — which is exactly what
// "notification comes through but goes nowhere" looks like. Navigating the
// client directly doesn't depend on the page's JS already being awake.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const target = data.target || null;
  const url = data.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if (target) { try { client.postMessage({ type: "rh-deep-link", target }); } catch {} }
          client.focus();
          if ("navigate" in client) { return client.navigate(url).catch(() => {}); }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
