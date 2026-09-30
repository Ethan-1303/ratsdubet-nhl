
const CACHE = 'betzone-v1';
const ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/auth.js', '/forum.js', '/config.js', '/logo.png', '/manifest.webmanifest'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // network first for API
  if (u.pathname.startsWith('/odds') || u.pathname.startsWith('/api') || u.pathname.startsWith('/kombos') || u.hostname.includes('supabase')) {
    e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      if (res.ok && (u.origin === location.origin)) caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(()=>caches.match('/')))
  );
});
