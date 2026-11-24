/**
 * @file sw.js
 * @description Service Worker liviano de TrustLink para habilitar la instalación nativa PWA
 * con estrategia network-first para activos del shell, excluyendo explícitamente llamadas
 * a `/api/*` y orígenes externos para no comprometer validaciones QR ni datos en tiempo real.
 * @location /trustlink-web/public/sw.js
 */

// Versión actual de caché del shell PWA y recursos mínimos precacheados al instalar.
const CACHE_NAME = 'trustlink-shell-v1';
const SHELL_ASSETS = ['/manifest.webmanifest', '/trustlink-icon.svg'];

/**
 * Fase `install`: precarga los activos esenciales del shell PWA y fuerza la activación
 * inmediata (`skipWaiting`) sin esperar al cierre de pestañas previas.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

/**
 * Fase `activate`: elimina cachés de versiones obsoletas y reclama el control de los
 * clientes abiertos (`clients.claim`) para aplicar esta versión de inmediato.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Fase `fetch`: aplica estrategia network-first con fallback a caché local solo para
 * peticiones GET del mismo origen. Las llamadas a `/api/*`, métodos mutables y recursos
 * externos se dejan pasar directo a la red (bypass total).
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Bypass explícito: nunca cacheamos endpoints de API ni recursos de otros orígenes.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // Estrategia network-first: prioriza la red y recurre a caché únicamente si falla la conexión.
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
