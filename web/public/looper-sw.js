const cacheName = "looper-app-shell-v1";
const cachePrefix = "looper-app-shell-";

function cacheableShellUrl(rawValue) {
  try {
    const url = new URL(rawValue, self.location.origin);
    if (url.origin !== self.location.origin) return undefined;
    if (url.pathname === "/") {
      url.search = "";
      url.hash = "";
      return url.toString();
    }
    if (
      url.pathname.startsWith("/_next/") ||
      url.pathname === "/favicon.ico"
    ) {
      url.hash = "";
      return url.toString();
    }
  } catch {
    // Ignore malformed client messages.
  }
  return undefined;
}

async function cacheShellUrls(rawUrls) {
  if (!Array.isArray(rawUrls) || rawUrls.length > 500) return;
  const urls = [...new Set(rawUrls.map(cacheableShellUrl).filter(Boolean))];
  const cache = await caches.open(cacheName);
  await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(url, {
        cache: "no-cache",
        credentials: "same-origin"
      });
      if (response.ok) await cache.put(url, response);
    })
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(cacheShellUrls(["/"]));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith(cachePrefix) && key !== cacheName)
              .map((key) => caches.delete(key))
          )
        )
    ])
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "cache-app-shell") return;
  event.waitUntil(cacheShellUrls(event.data.urls));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && url.pathname === "/") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(cacheName);
            await cache.put("/", response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached =
            (await caches.match(request, { ignoreSearch: true })) ??
            (await caches.match("/"));
          if (cached) return cached;
          throw new Error("Looper is not available offline on this device yet.");
        })
    );
    return;
  }

  if (!url.pathname.startsWith("/_next/") && url.pathname !== "/favicon.ico") {
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(cacheName);
          await cache.put(request, response.clone());
        }
        return response;
      });
    })
  );
});
