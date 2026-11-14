// Retires the service worker that used to cache the app at the site root.
// The app now lives in /app/ with its own worker; this one clears old caches and steps aside.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  // Only the caches the old root worker made (v1 to v8); the app's own caches are left alone.
  for (const k of await caches.keys()) if (/^pulsar-v[1-8]$/.test(k)) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));
