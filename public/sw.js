// Elementra service worker: network-first for the app page so updates arrive
// immediately, with the last good copy served when offline.
const CACHE = 'elementra-v1'
const SHELL = ['./', './index.html', './icon.svg', './manifest.webmanifest']

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

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Only handle this site's own pages and icons; never touch ads or APIs.
  if (url.origin !== self.location.origin || url.pathname.endsWith('ad-frame.html')) return

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok && (req.mode === 'navigate' || SHELL.some(p => url.pathname.endsWith(p.replace('./', '/'))))) {
          const copy = res.clone()
          caches.open(CACHE).then(cache => cache.put(req.mode === 'navigate' ? './' : req, copy))
        }
        return res
      })
      .catch(() => caches.match(req.mode === 'navigate' ? './' : req).then(hit => hit || caches.match('./'))),
  )
})
