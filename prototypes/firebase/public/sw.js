// THROWAWAY: show pushed notifications while the app is closed.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : { title: "Happie-prototype" };
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    tag: data.tag,
    data: { url: data.url },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url ?? "/"));
});
