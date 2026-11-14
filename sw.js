// Retires the service worker that used to cache the app at the site root.
// The app now lives in /app/ with its own worker; this one clears old caches and steps aside.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  const keep = 'pulsar-v9';
  for (const k of await caches.keys()) if (k.startsWith('pulsar-') && k !== keep) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));
