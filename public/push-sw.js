/* global self, URL, fetch */
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
      data: { url: data.url || "/", action: data.action || null },
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // A Medication dose offers "Taken", marked without opening the app.
      actions: data.action ? [{ action: "post", title: data.action.title }] : [],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = event.notification.data && event.notification.data.action;
  if (event.action === "post" && action) {
    event.waitUntil(
      fetch(action.post, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: action.date, time: action.time }),
      }).catch(() => undefined),
    );
    return;
  }
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
