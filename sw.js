const CACHE = 'betzone-v3';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin) return;
  if (u.pathname.startsWith('/odds') || u.pathname.startsWith('/api') || u.pathname.startsWith('/kombos') || u.pathname.startsWith('/stripe')) return;
  // Network first: un vieux cache ne doit plus figer la page.
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && (u.pathname.endsWith('.js') || u.pathname.endsWith('.css') || u.pathname.endsWith('.png') || u.pathname.endsWith('.webmanifest'))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
      }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('/index.html')))
  );
});
