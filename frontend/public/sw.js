const CACHE_NAME = 'agente-inspector-v2';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/sulvy_logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // NUNCA interceptar ni cachear peticiones a la API, assets de Next.js (_next), HMR ni peticiones no GET
  if (
    event.request.method !== 'GET' ||
    url.includes('/api/') ||
    url.includes('/_next/') ||
    url.includes('turbopack') ||
    url.includes('webpack') ||
    url.includes('localhost:8000')
  ) {
    return;
  }

  // Estrategia Network-First con fallback a Caché para páginas HTML estáticas
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/');
          }
        });
      })
  );
});
