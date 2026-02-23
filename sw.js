/**
 * Service Worker for My Tasks PWA
 * Provides offline caching and app-shell strategy
 */

const CACHE_NAME = 'mytasks-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon.svg'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: cache-first for static, network-first for others
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip non-GET and chrome-extension requests
    if (request.method !== 'GET' || request.url.startsWith('chrome-extension')) {
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                // Return cache, update in background
                const fetchPromise = fetch(request)
                    .then((response) => {
                        if (response && response.status === 200) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, clone);
                            });
                        }
                        return response;
                    })
                    .catch(() => cached);

                return cached;
            }

            return fetch(request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, clone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback for navigation requests
                    if (request.mode === 'navigate') {
                        return caches.match('/index.html');
                    }
                    return new Response('Offline', { status: 503 });
                });
        })
    );
});
