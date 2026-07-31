
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const n = payload.notification ?? {};
  const data = payload.data ?? {};
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (wins.some((w) => w.focused)) return;
      await self.registration.showNotification(n.title ?? "Safora", {
        body: n.body ?? "",
        ...(n.tag ? { tag: n.tag } : {}),
        icon: "/favicon.png",
        badge: "/favicon.png",
        data,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.type === "chat" ? "/chat" : "/";
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const win = wins[0];
      if (win) {
        if ("navigate" in win) await win.navigate(url).catch(() => {});
        return win.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
