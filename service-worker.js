const SHELL_CACHE = 'hitungin-v2';
const CDN_CACHE = 'hitungin-cdn-v1';
const KEEP = [SHELL_CACHE, CDN_CACHE, 'hitungin-model-v1'];
const SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/config.js',
  'js/engine.js',
  'js/app.js',
  'icons/logo.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

// Hanya hapus cache milik Hitungin. Aplikasi lain di domain yang sama (mis. Loyalin) punya cache sendiri.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('hitungin-') && !KEEP.includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(SHELL_CACHE).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
    );
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(CDN_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      })))
    );
  }
});
