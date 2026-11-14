/* Switch offline support. Same-origin GETs only; nothing leaves the device. */
const CACHE = 'switch-offline-v3';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

// The page tells us which files make up the app once it has fully loaded.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'precache') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(event.data.urls.map(async (url) => {
      try {
        if (new URL(url, self.location.origin).origin !== self.location.origin) return;
        if (!(await cache.match(url))) await cache.add(url);
      } catch { /* one missing file must not block the rest */ }
    }));
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // The owner's dashboard is never kept offline, and a standalone page must never replace the saved app shell.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/stats.html') return;

  if (request.mode === 'navigate') {
    // Network first so updates arrive; fall back to the saved app shell offline.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(request);
        if (fresh.ok && !/\.html$/i.test(url.pathname)) cache.put('/index.html', fresh.clone());
        return fresh;
      } catch {
        return (await cache.match("/index.html", { ignoreVary: true })) || Response.error();
      }
    })());
    return;
  }

  // Everything else: use the saved copy, refresh it in the background.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(request, { ignoreVary: true });
    const refresh = fetch(request).then((fresh) => {
      if (fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    });
    if (saved) { refresh.catch(() => {}); return saved; }
    return refresh;
  })());
});
