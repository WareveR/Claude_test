/* global self, URL */
// Push handling, imported by the generated service worker (see vite.config.ts).
self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Family Calendar";
  event.waitUntil(
    self.registration.showNotification(title, {
      tag: data.tag,
      data: { url: data.url || "/" },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if ("navigate" in open) {
          try {
            await open.navigate(url);
            return;
          } catch {
            // fall through to opening a new window
          }
        } else {
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
