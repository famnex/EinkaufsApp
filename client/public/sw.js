// Service Worker for PWA offline support
const CACHE_NAME = 'einkaufsapp-0.22.6'; // Bumped version to force cache refresh
const STATIC_ASSETS = [
    './',
    'index.html',
    'manifest.json',
    'icon-192x192.png',
    'icon-512x512.png',
    'pattern.svg'
];

// Install service worker and cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Caching static app shell');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate service worker and clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Removing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - balanced strategy
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests, API requests, and browser extensions
    if (!event.request.url.startsWith(self.location.origin) ||
        event.request.url.includes('/api/') ||
        event.request.url.includes('/system/') || // Explicitly exclude system settings
        event.request.url.includes('/uploads/') ||
        event.request.url.startsWith('chrome-extension:')) {
        return;
    }

    const { mode } = event.request;

    // 1. NETWORK FIRST for Navigation (index.html)
    // This ensures we always get the latest HTML/JS bundles when online
    if (mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // Update cache with latest homepage
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                })
                .catch(() => {
                    // Offline fallback: serve cached index.html
                    return caches.match('index.html');
                })
        );
        return;
    }

    // 2. CACHE FIRST for static assets with dynamic caching
    // Vite hashed assets (JS/CSS) don't change, so we can cache them forever
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).then((networkResponse) => {
                // If response is valid, clone it and put in cache
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Offline fallback (e.g. for image)
                return null;
            });
        })
    );
});
