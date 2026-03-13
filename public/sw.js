const CACHE_NAME = 'stylevault-v2';
const URLS_TO_CACHE = [
    '/',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
  ];

// Install: cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(
          caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS_TO_CACHE))
        );
    self.skipWaiting();
});

// Activate: clean old caches and take control
self.addEventListener('activate', (event) => {
    event.waitUntil(
          caches.keys().then((keys) =>
                  Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
                                 )
        );
    self.clients.claim();
});

// Fetch: network-first for all requests
self.addEventListener('fetch', (event) => {
    event.respondWith(
          fetch(event.request)
            .then((response) => {
                      // Cache successful GET responses
                          if (event.request.method === 'GET' && response.status === 200) {
                                      const responseClone = response.clone();
                                      caches.open(CACHE_NAME).then((cache) => {
                                                    cache.put(event.request, responseClone);
                                      });
                          }
                      return response;
            })
            .catch(() => {
                      // Fallback to cache
                           return caches.match(event.request).then((cached) => {
                                       return cached || caches.match('/');
                           });
            })
        );
});
