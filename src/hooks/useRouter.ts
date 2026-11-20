import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import { ELEMENTS, type Element } from '../data/elements'
import { PAGE_PATHS, elementSlug, type PageView } from '../config/site'
import { todayKey } from '../utils/format'

export type Route =
  | { view: PageView }
  | { view: 'element'; element: Element }
  | { view: 'notfound'; path: string }

const BY_SLUG = new Map(ELEMENTS.map(e => [elementSlug(e), e]))
const NAVIGATE_EVENT = 'elementra:navigate'

/** Lower-cased path without query, hash, trailing slash or .html suffix. */
export function normalizePath(input: string): string {
  let path = input.split(/[?#]/)[0] || '/'
  try { path = decodeURI(path) } catch { /* keep as is */ }
  path = path.replace(/\/index\.html$/i, '/').replace(/\.html$/i, '')
  if (path.length > 1) path = path.replace(/\/+$/, '')
  return path.toLowerCase() || '/'
}

export function parseRoute(input: string): Route {
  const path = normalizePath(input)
  for (const [view, p] of Object.entries(PAGE_PATHS) as [PageView, string][]) {
    if (path === p) return { view }
  }
  const match = /^\/element\/([a-z]+)$/.exec(path)
  const element = match ? BY_SLUG.get(match[1]) : undefined
  return element ? { view: 'element', element } : { view: 'notfound', path }
}

/** Maps the old hash URLs (#/learn, #/quiz, #/tools) to real paths. */
export function legacyHashPath(hash: string): string | null {
  const m = /^#\/?([a-z]*)/.exec(hash)
  if (!m || !hash.startsWith('#/')) return null
  if (m[1] === 'learn' || m[1] === 'quiz') return PAGE_PATHS.practice
  if (m[1] === 'tools') return PAGE_PATHS.tools
  return PAGE_PATHS.explore
}

/* ── Server rendering context: the URL and day being rendered ── */
export interface SsrInfo { path: string; day: string }
export const SsrContext = createContext<SsrInfo | null>(null)

/* ── History store ── */
function subscribe(cb: () => void) {
  window.addEventListener('popstate', cb)
  window.addEventListener(NAVIGATE_EVENT, cb)
  return () => {
    window.removeEventListener('popstate', cb)
    window.removeEventListener(NAVIGATE_EVENT, cb)
  }
}

interface OverlayState { elementraOverlay: true; base: string; z?: number }
export function overlayState(): OverlayState | null {
  const s = window.history.state as Partial<OverlayState> | null
  return s?.elementraOverlay && typeof s.base === 'string' ? (s as OverlayState) : null
}

// While an overlay is open the address bar may show an element URL, but the
// page underneath is still the one the overlay was opened from.
function readPath(): string {
  return normalizePath(overlayState()?.base ?? window.location.pathname)
}

export function navigateTo(path: string, replace = false) {
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
}

export function useRoute(): Route {
  const ssr = useContext(SsrContext)
  const path = useSyncExternalStore(subscribe, readPath, () => (ssr ? normalizePath(ssr.path) : readPath()))
  return useMemo(() => parseRoute(path), [path])
}

/* ── Today's date, matched to the pre-rendered HTML while hydrating ── */
const noopSubscribe = () => () => {}
function hydrationDay(): string {
  return document.getElementById('root')?.dataset.day || todayKey()
}

export function useToday(): string {
  const ssr = useContext(SsrContext)
  return useSyncExternalStore(noopSubscribe, () => todayKey(), () => ssr?.day ?? hydrationDay())
}

/** True after hydration; use it to render browser-only details. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

/** Opens same-site links without a page load; modified clicks keep browser behaviour. */
export function isPlainClick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.defaultPrevented
}
