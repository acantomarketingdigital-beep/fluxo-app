const CACHE_NAME = 'fluxo-beta-v4'
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/brand/favicon.png',
  '/brand/app-icon-192.png',
  '/brand/app-icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return
  }

  const requestUrl = new URL(event.request.url)

  if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api/')) {
    return
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirst(event.request, '/'))
    return
  }

  event.respondWith(cacheFirst(event.request))
})

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request)

    if (isCacheableResponse(response)) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(request, response.clone())
    }

    return response
  } catch {
    return (
      (await caches.match(request)) ||
      (await caches.match(fallbackUrl)) ||
      new Response('Fluxo offline.', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        status: 503,
      })
    )
  }
}

async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)

  if (cachedResponse) {
    return cachedResponse
  }

  const response = await fetch(request)

  if (isCacheableResponse(response)) {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(request, response.clone())
  }

  return response
}

function isCacheableResponse(response) {
  return response && response.status === 200 && response.type !== 'opaque'
}
