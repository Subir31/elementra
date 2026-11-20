import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

/* ── Theme ── */
export type Theme = 'light' | 'dark'
const THEME_EVENT = 'elementra:theme'

// The theme is applied to <html> by an inline script before first paint, so
// the DOM attribute is the source of truth and React only mirrors it.
function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function subscribeTheme(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb)
  return () => window.removeEventListener(THEME_EVENT, cb)
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#070a14' : '#f6f7fb')
  try { localStorage.setItem('elementra-theme', theme) } catch { /* ignore */ }
  window.dispatchEvent(new Event(THEME_EVENT))
}

export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'dark' as Theme)
  const toggle = useCallback(() => applyTheme(readTheme() === 'dark' ? 'light' : 'dark'), [])
  return [theme, toggle]
}

/* ── Media queries ── */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((cb: () => void) => {
    const mq = window.matchMedia(query)
    mq.addEventListener('change', cb)
    return () => mq.removeEventListener('change', cb)
  }, [query])
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}

/* ── Modal dialogs: focus trap, scroll lock, Escape to close ── */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null)
  const cbRef = useRef(onClose)
  useEffect(() => { cbRef.current = onClose }, [onClose])

  useEffect(() => {
    const el = ref.current
    const prev = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const body = document.body
    const prevOverflow = body.style.overflow
    const prevPad = body.style.paddingRight
    const scrollbar = window.innerWidth - document.documentElement.clientWidth
    body.style.overflow = 'hidden'
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
    const frame = requestAnimationFrame(() => el?.focus({ preventScroll: true }))

    const onKey = (e: KeyboardEvent) => {
      // With stacked dialogs, only the one holding focus (the top one) reacts.
      if (!el || !el.contains(document.activeElement)) return
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cbRef.current(); return }
      if (e.key !== 'Tab') return
      const focusable = Array.from(el.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
      )).filter(n => n.offsetParent !== null)
      if (!focusable.length) { e.preventDefault(); el.focus(); return }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === el)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKey, true)
      body.style.overflow = prevOverflow
      body.style.paddingRight = prevPad
      prev?.focus({ preventScroll: true })
    }
  }, [])
  return ref
}

/* ── Reveal on scroll ── */
export function useInView<T extends Element>(rootMargin = '0px', once = true) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); if (once) io.disconnect() }
      else if (!once) setInView(false)
    }, { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin, once])
  return [ref, inView] as const
}

/* ── Horizontal swipe detection for touch ── */
export function useSwipe(onLeft: () => void, onRight: () => void, threshold = 60) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY, t: Date.now() }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const t = e.changedTouches[0]
      const dx = t.clientX - s.x
      const dy = t.clientY - s.y
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - s.t > 600) return
      if (dx < 0) onLeft(); else onRight()
    },
  }
}
