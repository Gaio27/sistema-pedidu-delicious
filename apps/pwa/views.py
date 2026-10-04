import json
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.cache import cache_control

@cache_control(max_age=3600, must_revalidate=True)
def manifest_json(request):
    manifest = {
        "name": "Celvass Resto & Bar - Dine In PWA",
        "short_name": "Celvass",
        "description": "Progressive Web Application for Restaurant Dine-In Ordering with Cashier Verification",
        "id": "/",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "background_color": "#0f172a",
        "theme_color": "#f97316",
        "orientation": "portrait-primary",
        "icons": [
            {
                "src": "/static/icons/icon-192.png",
                "sizes": "192x192",
                "type": "image/png",
                "purpose": "any maskable"
            },
            {
                "src": "/static/icons/icon-512.png",
                "sizes": "512x512",
                "type": "image/png",
                "purpose": "any maskable"
            }
        ]
    }
    return JsonResponse(manifest)

@cache_control(no_cache=True, no_store=True, must_revalidate=True)
def service_worker(request):
    sw_code = """
const CACHE_NAME = 'celvass-pwa-v3';
const STATIC_ASSETS = [
    '/',
    '/offline/',
    '/static/css/style.css',
    '/static/js/i18n.js',
    '/static/js/api.js',
    '/static/js/sound.js',
    '/static/js/websocket.js',
    '/static/js/customer.js',
    '/static/js/pwa.js',
    '/static/icons/default-food.png',
    '/static/icons/icon-192.png',
    '/static/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('PWA Asset cache skip:', err);
            });
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // API calls & Mutations: Network-only, do not cache POST/PUT/DELETE
    if (request.method !== 'GET' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) {
        return;
    }

    // Static assets & Navigation: Network-first with Cache fallback
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                }
                return response;
            })
            .catch(() => {
                return caches.match(request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    if (request.mode === 'navigate') {
                        return caches.match('/offline/');
                    }
                });
            })
    );
});
"""
    response = HttpResponse(sw_code, content_type='application/javascript')
    response['Service-Worker-Allowed'] = '/'
    return response

def offline_view(request):
    return render(request, 'customer/offline.html')
