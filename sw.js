const CACHE_NAME = 'nucleus-static-v75';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './assets/favicon.ico',
  './assets/favicon-32.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './vendor/lucide.min.js',
  './vendor/three/three.module.js',
  './vendor/three/addons/controls/OrbitControls.js',
  './vendor/three/addons/renderers/CSS2DRenderer.js',
  './css/theme.css',
  './css/base.css',
  './css/nodes.css',
  './css/titulo.css',
  './css/features.css',
  './css/toolbar.css',
  './css/onboarding.css',
  './css/panels.css',
  './css/nucleus-hub.css',
  './css/mobile.css',
  './js/config.js',
  './js/state.js',
  './js/storage.js',
  './js/navigation.js',
  './js/viewport.js',
  './js/connections.js',
  './js/map-tree.js',
  './js/features-titulo.js',
  './js/nodes.js',
  './js/ui.js',
  './js/ui-toolbar.js',
  './js/features-onboarding.js',
  './js/features-daily-checklist.js',
  './js/features-search.js',
  './js/features-backup.js',
  './js/features-edit.js',
  './js/features-markers.js',
  './js/features-documents.js',
  './js/features-media.js',
  './js/features-capture.js',
  './js/features-focus.js',
  './js/features-shortcuts.js',
  './js/features-regions.js',
  './js/nucleus-connections.js',
  './js/features-nucleus-hub.js',
  './js/nucleus-core-3d.js',
  './js/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isAppScript(url) {
  return url.pathname.endsWith('.html') || url.pathname.includes('/js/') || url.pathname.includes('/css/') || url.pathname.includes('/vendor/');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (isAppScript(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
            return response;
          })
          .catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
