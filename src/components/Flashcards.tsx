import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { CATEGORY_META, formatNumber, type Element } from '../data/elements'
import { SYMBOL_STORIES, memoryHooks, type StudySet } from '../data/learning'
import { useDialog } from '../hooks/useUi'
import { HighlightedName } from './ElementSheet'
import { Icon } from './Icon'

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

type Front = 'symbol' | 'name'

export function FlashcardSession({ set, elements, learned, onLearned, onQuiz, onClose }: {
  set: StudySet
  elements: Element[]
  learned: Set<number>
  onLearned: (z: number) => void
  onQuiz: () => void
  onClose: () => void
}) {
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  // Unlearned cards first, so time goes where it is needed.
  const [queue, setQueue] = useState<Element[]>(() => [
    ...shuffle(elements.filter(e => !learned.has(e.atomicNumber))),
    ...shuffle(elements.filter(e => learned.has(e.atomicNumber))),
  ])
  const [total, setTotal] = useState(elements.length)
  const [flipped, setFlipped] = useState(false)
  const [front, setFront] = useState<Front>('symbol')
  const [known, setKnown] = useState<Set<number>>(new Set())
  const [missed, setMissed] = useState<Set<number>>(new Set())
  const [exit, setExit] = useState<'left' | 'right' | null>(null)
  const [drag, setDrag] = useState(0)
  const dragStart = useRef<{ x: number; id: number } | null>(null)
  const moved = useRef(false)

  const card = queue[0]
  const done = known.size

  const answer = useCallback((knewIt: boolean) => {
    if (!card || exit) return
    setExit(knewIt ? 'right' : 'left')
    window.setTimeout(() => {
      if (knewIt) {
        setKnown(k => new Set(k).add(card.atomicNumber))
        onLearned(card.atomicNumber)
        setQueue(q => q.slice(1))
      } else {
        setMissed(m => new Set(m).add(card.atomicNumber))
        setQueue(q => {
          const rest = q.slice(1)
          const at = Math.min(3, rest.length)
          return [...rest.slice(0, at), q[0], ...rest.slice(at)]
        })
      }
      setFlipped(false)
      setExit(null)
      setDrag(0)
    }, 260)
  }, [card, exit, onLearned])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped(f => !f) }
      if (e.key === 'ArrowRight') { e.preventDefault(); answer(true) }
      if (e.key === 'ArrowLeft') { e.preventDefault(); answer(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [card, answer])

  const restart = (onlyMissed: boolean) => {
    const pool = onlyMissed ? elements.filter(e => missed.has(e.atomicNumber)) : elements
    setQueue(shuffle(pool))
    setTotal(pool.length)
    setKnown(new Set())
    setMissed(new Set())
    setFlipped(false)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    dragStart.current = { x: e.clientX, id: e.pointerId }
    moved.current = false
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current || dragStart.current.id !== e.pointerId) return
    const dx = e.clientX - dragStart.current.x
    if (Math.abs(dx) > 6) moved.current = true
    setDrag(dx)
  }
  const onPointerUp = () => {
    if (!dragStart.current) return
    dragStart.current = null
    if (drag > 90) answer(true)
    else if (drag < -90) answer(false)
    else setDrag(0)
  }

  const m = card ? CATEGORY_META[card.categoryKey] : null
  const offset = exit === 'right' ? 520 : exit === 'left' ? -520 : drag
  const cardStyle = {
    '--c': m?.color,
    transform: `translateX(${offset}px) rotate(${offset / 22}deg)`,
    opacity: exit ? 0 : 1,
  } as CSSProperties

  return (
    <div className="overlay">
      <div className="backdrop" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="fc-title" tabIndex={-1}
        className="sheet !max-w-[560px] md:!max-h-[min(92dvh,820px)]">
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Flashcards</div>
            <h2 id="fc-title" className="truncate text-[18px] font-bold">{set.title}</h2>
          </div>
          <div className="segmented hidden min-[420px]:inline-flex" role="group" aria-label="Card front shows">
            <button type="button" aria-pressed={front === 'symbol'} onClick={() => { setFront('symbol'); setFlipped(false) }}>Symbol</button>
            <button type="button" aria-pressed={front === 'name'} onClick={() => { setFront('name'); setFlipped(false) }}>Name</button>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close flashcards"><Icon name="x" /></button>
        </header>

        <div className="px-5 pt-4">
          <div className="flex items-center justify-between text-[12.5px] font-semibold text-[var(--text-3)]">
            <span>{card ? `${done} of ${total} known` : 'Session complete'}</span>
            {missed.size > 0 && <span>{missed.size} to review</span>}
          </div>
          <div className="meter mt-2"><span style={{ width: `${(done / total) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-3))' }} /></div>
        </div>

        <div className="sheet-body flex-1 px-5 pb-5 pt-5">
          {card && m ? (
            <>
              <div
                className={`flip swipe-card mx-auto aspect-[4/4.6] w-full max-w-[380px] select-none ${flipped ? 'is-flipped' : ''} ${drag !== 0 && !exit ? 'is-dragging' : ''}`}
                style={cardStyle}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
              >
                <button type="button" className="flip-inner block text-left" aria-label={flipped ? 'Show front' : 'Reveal answer'}
                  onClick={() => { if (!moved.current) setFlipped(f => !f) }}>
                  {/* Front */}
                  <span className="flip-face hero items-center justify-center p-6 text-center" key={`f-${card.atomicNumber}`}>
                    <span className="absolute left-5 top-4 font-mono text-[14px] font-semibold opacity-80">{card.atomicNumber}</span>
                    {front === 'symbol' ? (
                      <span className="hero-sym text-[120px]">{card.symbol}</span>
                    ) : (
                      <span className="font-display text-[44px] font-extrabold leading-tight">{card.name}</span>
                    )}
                    <span className="absolute bottom-5 flex items-center gap-1.5 text-[13px] font-semibold opacity-85">
                      <Icon name="rotate" size={14} /> Tap to reveal the {front === 'symbol' ? 'name' : 'symbol'}
                    </span>
                  </span>
                  {/* Back */}
                  <span className="flip-face flip-back border border-[var(--border-2)] bg-[var(--surface-raised)] p-6">
                    <span className="flex items-center gap-3">
                      <span className="el-sym !h-14 !w-14 !text-[24px]">{card.symbol}</span>
                      <span className="min-w-0">
                        <span className="block font-display text-[26px] font-extrabold leading-tight">
                          <HighlightedName symbol={card.symbol} word={card.name} />
                        </span>
                        <span className="block text-[13px] text-[var(--text-3)]">#{card.atomicNumber} · {formatNumber(card.atomicMass, 3)} u</span>
                      </span>
                    </span>
                    <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-[12.5px] font-semibold"
                      style={{ background: `color-mix(in oklab, ${m.color} 16%, transparent)`, color: `color-mix(in oklab, ${m.color} var(--tile-ink-mix), var(--tile-ink-base))` }}>
                      {m.label} · {card.group ? `group ${card.group}` : 'f-block'} · period {card.period}
                    </span>
                    {SYMBOL_STORIES[card.symbol] && (
                      <span className="mt-3 block text-[14px] font-semibold">
                        <HighlightedName symbol={card.symbol} word={SYMBOL_STORIES[card.symbol].origin} /> <span className="font-normal text-[var(--text-3)]">({SYMBOL_STORIES[card.symbol].language})</span>
                      </span>
                    )}
                    <span className="mt-3 block space-y-2 overflow-hidden">
                      {memoryHooks(card).filter(h => !h.startsWith(`${card.symbol} comes from`)).slice(0, 2).map(h => (
                        <span key={h} className="flex gap-2 text-[13.5px] leading-snug text-[var(--text-2)]">
                          <Icon name="sparkles" size={14} className="mt-0.5 shrink-0 text-[var(--accent-text)]" />{h}
                        </span>
                      ))}
                    </span>
                    <span className="mt-auto block rounded-2xl bg-[var(--warning-soft)] p-3 text-[13px] leading-snug text-[var(--text-2)]">
                      <span className="mr-1" aria-hidden="true">💡</span>{card.funFact}
                    </span>
                  </span>
                </button>
              </div>

              <div className="mx-auto mt-5 grid max-w-[380px] grid-cols-[1fr_auto_1fr] gap-2">
                <button type="button" className="btn" onClick={() => answer(false)}
                  style={{ borderColor: 'var(--danger-border)', color: 'var(--danger)' }}>
                  <Icon name="rotate" size={16} />Again
                </button>
                <button type="button" className="icon-btn !h-[42px] !w-[42px]" onClick={() => setFlipped(f => !f)} aria-label="Flip card"><Icon name="swap" /></button>
                <button type="button" className="btn" onClick={() => answer(true)}
                  style={{ borderColor: 'var(--success-border)', color: 'var(--success)' }}>
                  <Icon name="check" size={16} />Know it
                </button>
              </div>
              <p className="mt-3 text-center text-[12px] text-[var(--text-4)]">
                <span className="hidden sm:inline">Keys: <span className="kbd">Space</span> flip · <span className="kbd">←</span> again · <span className="kbd">→</span> know it</span>
                <span className="sm:hidden">Swipe right if you knew it, left to see it again</span>
              </p>
            </>
          ) : (
            <div className="grid place-items-center gap-4 py-8 text-center animate-[fadeUp_.4s_var(--ease-out)_both]">
              <span className="grid h-20 w-20 place-items-center rounded-[26px] bg-[var(--success-soft)] text-[var(--success)] animate-[popIn_.5s_var(--ease-spring)_both]">
                <Icon name="trophy" size={38} />
              </span>
              <div>
                <h3 className="text-[24px] font-extrabold">Set complete!</h3>
                <p className="mt-1 text-[14.5px] text-[var(--text-2)]">
                  You worked through all {total} cards{missed.size ? ` — ${missed.size} needed a second look` : ' without a miss'}.
                </p>
              </div>
              <div className="flex w-full max-w-[360px] flex-col gap-2">
                <button type="button" className="btn btn-primary btn-lg" onClick={onQuiz}><Icon name="target" size={18} />Test yourself with a quiz</button>
                {missed.size > 0 && <button type="button" className="btn" onClick={() => restart(true)}><Icon name="rotate" size={16} />Review the {missed.size} tricky ones</button>}
                <button type="button" className="btn btn-ghost" onClick={() => restart(false)}>Go through the set again</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
