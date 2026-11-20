import { useEffect, useRef, type CSSProperties } from 'react'
import { CATEGORY_META, ELEMENTS, type Element } from '../data/elements'
import { elementPath } from '../config/site'
import { useDialog, useSwipe } from '../hooks/useUi'
import { ElementDetails, ElementHeroContent } from './ElementDetails'
import { Icon } from './Icon'
import { Link } from './Link'

export { HighlightedName } from './ElementDetails'

/** Quick-view sheet used while browsing; the same content as the element page. */
export function ElementSheet({ el, learned, inCompare, onToggleLearned, onToggleCompare, onNavigate, onClose }: {
  el: Element
  learned: boolean
  inCompare: boolean
  onToggleLearned: () => void
  onToggleCompare: () => void
  onNavigate: (el: Element) => void
  onClose: () => void
}) {
  const m = CATEGORY_META[el.categoryKey]
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const bodyRef = useRef<HTMLDivElement>(null)
  const dragStart = useRef<number | null>(null)
  const dragY = useRef(0)

  const index = el.atomicNumber - 1
  const prev = index > 0 ? ELEMENTS[index - 1] : null
  const next = index < ELEMENTS.length - 1 ? ELEMENTS[index + 1] : null
  const swipe = useSwipe(() => next && onNavigate(next), () => prev && onNavigate(prev))

  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }) }, [el.atomicNumber])

  // Arrow keys move through the table while the sheet is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowRight' && next) { e.preventDefault(); onNavigate(next) }
      if (e.key === 'ArrowLeft' && prev) { e.preventDefault(); onNavigate(prev) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onNavigate])

  // Drag the hero down to dismiss on touch screens. The transform is applied
  // directly to avoid re-rendering the whole sheet on every touch move.
  const setSheetOffset = (y: number, animate: boolean) => {
    const sheet = dialogRef.current
    if (!sheet) return
    sheet.style.transition = animate ? 'transform .3s var(--ease-out)' : 'none'
    sheet.style.transform = y ? `translateY(${y}px)` : ''
  }
  const onHeroTouchStart = (e: React.TouchEvent) => { dragStart.current = e.touches[0].clientY; dragY.current = 0; swipe.onTouchStart(e) }
  const onHeroTouchMove = (e: React.TouchEvent) => {
    if (dragStart.current == null) return
    dragY.current = Math.max(0, e.touches[0].clientY - dragStart.current)
    setSheetOffset(dragY.current, false)
  }
  const onHeroTouchEnd = (e: React.TouchEvent) => {
    dragStart.current = null
    if (dragY.current > 110) { onClose(); return }
    setSheetOffset(0, true)
    if (dragY.current < 24) swipe.onTouchEnd(e)
  }

  return (
    <div className="overlay">
      <div className="backdrop" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="el-title"
        tabIndex={-1}
        className="sheet"
        style={{ '--c': m.color } as CSSProperties}
      >
        {/* ── Hero ── */}
        <header className="hero shrink-0 px-5 pb-5 pt-16 sm:px-8 sm:pb-7 sm:pt-8"
          onTouchStart={onHeroTouchStart} onTouchMove={onHeroTouchMove} onTouchEnd={onHeroTouchEnd}>
          <span className="sheet-handle" aria-hidden="true" />
          <div className="absolute right-3 top-3 z-[2] flex gap-2 sm:right-5 sm:top-5">
            <button type="button" className="hero-btn" onClick={() => prev && onNavigate(prev)} disabled={!prev} aria-label={prev ? `Previous: ${prev.name}` : 'Previous element'}>
              <Icon name="chevronLeft" />
            </button>
            <button type="button" className="hero-btn" onClick={() => next && onNavigate(next)} disabled={!next} aria-label={next ? `Next: ${next.name}` : 'Next element'}>
              <Icon name="chevronRight" />
            </button>
            <button type="button" className="hero-btn" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          </div>
          <ElementHeroContent el={el} titleId="el-title" />
        </header>

        {/* ── Body ── */}
        <div ref={bodyRef} className="sheet-body flex-1" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
          <ElementDetails el={el} learned={learned} inCompare={inCompare} onToggleLearned={onToggleLearned} onToggleCompare={onToggleCompare}
            className="p-5 sm:p-7" />
          <div className="border-t border-[var(--border)] px-5 py-4 sm:px-7">
            <Link href={elementPath(el)} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[var(--accent-text)] hover:underline">
              Open the full {el.name} page — quick answers and related elements<Icon name="arrowRight" size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
