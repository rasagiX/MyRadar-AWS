/**
 * MyRadar Service Worker — offline app shell cache
 *
 * Strategy:
 *   • On install: pre-cache the app shell (HTML, JS chunks, CSS, map worker)
 *   • On fetch:   serve from cache first for navigation; network-first for API
 *
 * This ensures the app loads after Wi-Fi is turned off and the page is reloaded
 * (Step 3 of the offline-first test scenario).
 */

const CACHE_NAME  = 'myradar-shell-v1'
const API_PATTERN = /\/(api\/|_next\/webpack-hmr)/

// ── Install: cache app shell ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cache the root document. Next.js injects the JS/CSS automatically
      // as part of the same navigation response.
      cache.addAll([
        '/',
        '/manifest.json',
        '/maplibre-gl-worker.mjs',
      ]).catch(() => {
        // Non-fatal: some assets may not exist yet
      })
    )
  )
  // Take control immediately — don't wait for old SW to die
  self.skipWaiting()
})

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// ── Fetch: serve shell from cache; pass API calls through ────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests
  if (request.method !== 'GET') return
  if (url.origin !== self.location.origin) return

  // API routes and HMR: always network, never cache
  if (API_PATTERN.test(url.pathname)) return

  // Static Next.js assets (_next/static): cache-first (content-hashed, safe)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ?? fetch(request).then((response) => {
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
          }
          return response
        }).catch(() => cached ?? new Response('Offline', { status: 503 }))
      )
    )
    return
  }

  // Navigation requests (HTML pages): network-first, fall back to cached '/'
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Update cached shell on successful fetch
          if (response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
          }
          return response
        })
        .catch(() =>
          // Offline — serve the cached shell so the app still loads
          caches.match('/').then(
            (cached) => cached ?? new Response('<h1>MyRadar — Offline</h1>', {
              headers: { 'Content-Type': 'text/html' },
            })
          )
        )
    )
    return
  }

  // Everything else: network-first, cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request).then(
      (cached) => cached ?? new Response('', { status: 503 })
    ))
  )
})
