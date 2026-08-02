const legacyCachePrefix = "looper-app-shell-";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((key) => key.startsWith(legacyCachePrefix))
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();
      const windowClients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: "window"
      });
      await Promise.allSettled(
        windowClients.map((client) => client.navigate(client.url))
      );
      await self.registration.unregister();
    })()
  );
});
