import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { legacyHashPath, normalizePath, overlayState } from './hooks/useRouter'

// Old links used hash routes (#/learn); move them to the real pages.
const legacy = legacyHashPath(window.location.hash)
if (legacy) window.history.replaceState(null, '', legacy)
// A reload while a sheet was open starts fresh on the page in the address bar.
if (overlayState()) window.history.replaceState(null, '', window.location.pathname)

const root = document.getElementById('root')!
const app = <StrictMode><App /></StrictMode>

// Pages are pre-rendered at build time. Hydrate when the HTML matches this URL;
// otherwise (404 page, offline fallback, dev server) render from scratch.
const rendered = root.dataset.path
if (rendered && normalizePath(rendered) === normalizePath(window.location.pathname)) {
  hydrateRoot(root, app)
} else {
  root.textContent = ''
  createRoot(root).render(app)
}

// Offline support for students on patchy connections (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* offline mode is optional */ })
  })
}
