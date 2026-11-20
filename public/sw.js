// Elementra service worker.
// - Pages: network first, so updates arrive immediately; the last good copy is
//   served offline (or the home page, which can show any route).
// - /assets/: cache first; file names change on every build, so they never go stale.
const CACHE = 'elementra-v2'
const SHELL = ['/', '/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function save(req, res) {
  if (res.ok && res.type === 'basic') {
    const copy = res.clone()
    caches.open(CACHE).then(cache => cache.put(req, copy))
  }
  return res
}

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Only handle this site's own files; never touch ads or third-party APIs.
  if (url.origin !== self.location.origin || url.pathname === '/ad-frame.html') return

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => save(req, res))))
    return
  }

  if (req.mode === 'navigate') {
    const key = new Request(url.origin + url.pathname)
    event.respondWith(
      fetch(req)
        .then(res => save(key, res))
        .catch(() => caches.match(key).then(hit => hit || caches.match('/'))),
    )
    return
  }

  event.respondWith(fetch(req).then(res => save(req, res)).catch(() => caches.match(req)))
})
