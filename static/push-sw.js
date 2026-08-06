// Push-only service worker. Deliberately no caching: registering the Workbox
// worker in static/pwa-sw.js would switch on app-wide asset caching for the first
// time as a side effect of shipping notifications, which is a change to every
// page and deserves its own iteration.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Happie", body: event.data.text(), tag: "happie" };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Happie", {
      body: payload.body ?? "",
      // Per-to-do tag: keeps separate to-dos separate (so each is individually
      // actionable) while a re-send for the same to-do replaces rather than
      // stacking. A shared tag would collapse them all into one.
      tag: payload.tag ?? "happie",
      data: { url: payload.url ?? "/todos" },
      icon: "/web-app-manifest-192x192.png",
      badge: "/favicon-96x96.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/todos";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
