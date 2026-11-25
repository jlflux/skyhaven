// Offline support: the page itself is network-first (so updates arrive),
// everything else is cache-first once it has been loaded.
const CACHE = 'skyhaven-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const store = res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  };
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(store).catch(() => caches.match(req).then(m => m || caches.match('/'))));
    return;
  }
  e.respondWith(caches.match(req).then(m => m || fetch(req).then(store)));
});
