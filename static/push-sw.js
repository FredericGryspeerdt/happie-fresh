// Push-only service worker. Deliberately no caching: switching on app-wide
// asset caching as a side effect of shipping notifications would be a change
// to every page and deserves its own iteration — tracked as issue #74 in the
// PWA roadmap (docs/superpowers/specs/2026-08-08-pwa-roadmap-design.md).

// Badge failures must never prevent a visible push notification. Fetch the
// current count instead of incrementing: pushes can be delayed or repeated.
let badgeGeneration = 0;
async function refreshAppBadge() {
  if (typeof self.navigator.setAppBadge !== "function") return;
  const generation = ++badgeGeneration;
  try {
    const now = new Date();
    const before = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const query = new URLSearchParams({ before: before.toISOString() });
    const response = await fetch(`/api/todos/badge?${query}`, {
      credentials: "same-origin",
      cache: "no-store",
    });
    // An expired session is not an empty backlog. Keep the last known badge.
    if (!response.ok) return;
    const { count } = await response.json();
    if (
      generation !== badgeGeneration || !Number.isSafeInteger(count) ||
      count < 0
    ) return;
    if (count === 0) await self.navigator.clearAppBadge();
    else await self.navigator.setAppBadge(count);
  } catch {
    /* offline, unsupported or permission denied: keep notification delivery */
  }
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "refresh-app-badge") {
    event.ports?.[0]?.postMessage("app-badge-ready");
    event.waitUntil(refreshAppBadge());
    return;
  }
  if (event.data?.type !== "clear-app-badge") return;
  badgeGeneration++;
  event.waitUntil((async () => {
    try {
      await self.navigator.clearAppBadge?.();
    } catch { /* best effort */ }
  })());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Happie", body: event.data.text(), tag: "happie" };
  }

  event.waitUntil(
    Promise.allSettled([
      refreshAppBadge(),
      self.registration.showNotification(payload.title ?? "Happie", {
        body: payload.body ?? "",
        // Per-to-do tag: keeps separate to-dos separate (so each is individually
        // actionable) while a re-send for the same to-do replaces rather than
        // stacking. A shared tag would collapse them all into one.
        tag: payload.tag ?? "happie",
        data: { url: payload.url ?? "/todos" },
        icon: "/happie-icon-192.png",
        badge: "/favicon-96x96.png",
      }),
    ]),
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
