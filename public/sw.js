self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
      await self.registration.unregister();

      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(
        clientsList.map((client) => {
          if ('navigate' in client) {
            return client.navigate(client.url);
          }
          return Promise.resolve();
        })
      );
    })()
  );
});
