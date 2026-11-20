import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ADS, readyUnits, unitWidth, type AdUnit, type Placement } from '../config/ads'

const READY = readyUnits()
const SHOW_PLACEHOLDERS = import.meta.env.DEV && ADS.showPlaceholdersInDev
// Ads may open new tabs when clicked, but can never navigate or redirect this page.
const SANDBOX = ADS.strictIsolation
  ? 'allow-scripts allow-popups allow-popups-to-escape-sandbox'
  : 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'

function pickUnit(names: string[], width: number, pool: Record<string, AdUnit>): [string, AdUnit] | null {
  for (const name of names) {
    const unit = pool[name]
    if (unit && unitWidth(unit) <= width) return [name, unit]
  }
  return null
}

/**
 * A lazily loaded, fixed-size ad slot. It renders nothing unless ads are
 * enabled and configured, reserves its space up front so content never jumps,
 * and only loads when scrolled near.
 */
export function AdSlot({ placement, className = '' }: { placement: Placement; className?: string }) {
  const names = ADS.placements[placement] ?? []
  const pool = Object.keys(READY).length > 0 ? READY : SHOW_PLACEHOLDERS ? ADS.units : null
  const boxRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  const [inView, setInView] = useState(false)
  const [empty, setEmpty] = useState(false)

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el || !pool) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    ro.observe(el)
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); io.disconnect() }
    }, { rootMargin: '400px' })
    io.observe(el)
    return () => { ro.disconnect(); io.disconnect() }
  }, [pool])

  if (!pool || names.length === 0 || empty) return null
  const picked = width == null ? null : pickUnit(names, width, pool)

  return (
    <div ref={boxRef} className={`w-full ${className}`}>
      {picked && (
        <aside className="ad-slot" aria-label="Advertisement">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-4)]">Advertisement</span>
          <AdFrame name={picked[0]} unit={picked[1]} load={inView} placeholder={pool !== READY} onEmpty={() => setEmpty(true)} />
        </aside>
      )}
    </div>
  )
}

const MAX_NATIVE_HEIGHT = 640
const EMPTY_AFTER_MS = 10_000

/** True when the frame shows something visible besides its scripts. */
function frameHasAd(doc: Document): boolean {
  return [...doc.body.querySelectorAll('*')].some(el => el.tagName !== 'SCRIPT' && el.getBoundingClientRect().height > 0)
}

function AdFrame({ name, unit, load, placeholder, onEmpty }: {
  name: string; unit: AdUnit; load: boolean; placeholder: boolean; onEmpty: () => void
}) {
  const width = unit.type === 'banner' ? unit.width : '100%'
  const style = { width, height: unit.height, maxWidth: '100%' }
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [fitHeight, setFitHeight] = useState<number | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const emptyTimer = useRef<number | null>(null)
  useEffect(() => () => {
    observer.current?.disconnect()
    if (emptyTimer.current) window.clearTimeout(emptyTimer.current)
  }, [])

  // If nothing arrives (ad blocker, no ad to show), remove the slot rather
  // than leave an empty box on the page.
  const onFrameLoad = () => {
    if (unit.type === 'native') fitToContent()
    emptyTimer.current = window.setTimeout(() => {
      try {
        const doc = frameRef.current?.contentDocument
        if (doc?.body && !frameHasAd(doc)) onEmpty()
      } catch { /* cross-origin: cannot tell, keep the slot */ }
    }, EMPTY_AFTER_MS)
  }

  // Native widgets change height with the screen width (they stack on phones),
  // so the frame follows its content. Reading the frame needs same-origin
  // access; with strictIsolation the reserved height is kept instead.
  const fitToContent = () => {
    try {
      const doc = frameRef.current?.contentDocument
      if (!doc?.body) return
      const measure = () => {
        const h = Math.ceil(doc.body.scrollHeight)
        if (h > 0) setFitHeight(Math.min(h, MAX_NATIVE_HEIGHT))
      }
      observer.current?.disconnect()
      // Use the frame's own ResizeObserver so it follows the frame's rendering.
      const RO = (frameRef.current?.contentWindow as (Window & { ResizeObserver?: typeof ResizeObserver }) | null)?.ResizeObserver ?? ResizeObserver
      observer.current = new RO(measure)
      observer.current.observe(doc.body)
      measure()
    } catch { /* cross-origin: keep the reserved height */ }
  }

  if (placeholder) {
    return (
      <div className="ad-placeholder" style={style}>
        {unit.type === 'banner' ? `${unit.width}×${unit.height}` : 'Native'} ad · “{name}” (dev preview)
      </div>
    )
  }

  return (
    <div style={{ ...style, height: fitHeight ?? unit.height }}>
      {load && (
        <iframe
          ref={frameRef}
          onLoad={onFrameLoad}
          className="ad-frame"
          src={`/ad-frame.html?u=${encodeURIComponent(name)}`}
          title="Advertisement"
          width={unit.type === 'banner' ? unit.width : undefined}
          height={fitHeight ?? unit.height}
          style={{ width: '100%', height: fitHeight ?? unit.height }}
          sandbox={SANDBOX}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          scrolling="no"
        />
      )}
    </div>
  )
}
