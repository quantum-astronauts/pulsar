// App-shell cache: Pulsar keeps working offline once loaded.
// Pages load network-first, so a new deploy shows straight away; the cache is only the offline fallback.
const CACHE = 'pulsar-app-v18';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const keep = (req, res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url), local = url.origin === location.origin;
  if (req.mode === 'navigate' || (local && /\.(html|webmanifest)$|\/$/.test(url.pathname))) {
    // Newest version when online; the last good copy when offline.
    // A navigation request can't be re-sent with options, so fetch its URL fresh instead.
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => keep(req, res))
      .catch(() => caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true }).then(hit => hit || c.match('index.html')))));
    return;
  }
  if (!local && !url.hostname.startsWith('fonts.g')) return;
  // Icons and fonts rarely change: cache first, fill on first use.
  e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => keep(req, res)))));
});
