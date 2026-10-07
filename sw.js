/* Ne pas remettre de cache ici. Ce fichier désinscrit l'ancien service worker. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    await Promise.all(clients.map((c) => c.navigate(c.url)));
  })());
});
