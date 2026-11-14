// Retires the service worker that once cached the app at the site root (before it moved to /app/).
// It clears that worker's caches, lets every request go straight to the network, and removes itself.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('pulsar-') && !k.startsWith('pulsar-app-')) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));
self.addEventListener('fetch', () => { /* no respondWith: the network answers */ });
