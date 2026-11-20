import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CATEGORY_META, ELEMENTS, formatNumber, type Element } from '../data/elements'
import { SYMBOL_STORIES, memoryHooks, symbolLetterIndices } from '../data/learning'
import { fetchElementDetails, fetchWikiImage, type ElementApiDetails } from '../utils/api'
import { formatDensity, formatDiscovery, formatTemperature, prettyConfig } from '../utils/format'
import { useDialog, useSwipe } from '../hooks/useUi'
import { Bohr, Radar } from './Charts'
import { Icon } from './Icon'

/** Name with the letters of its symbol emphasised: C·h·l·orine → Cl */
export function HighlightedName({ symbol, word, className = '' }: { symbol: string; word: string; className?: string }) {
  const marks = symbolLetterIndices(symbol, word)
  if (!marks) return <span className={className}>{word}</span>
  return (
    <span className={className}>
      {word.split('').map((ch, i) => (marks.includes(i) ? <span key={i} className="mark">{ch}</span> : <span key={i}>{ch}</span>))}
    </span>
  )
}

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
  const [api, setApi] = useState<ElementApiDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [img, setImg] = useState<{ name: string; src: string | null } | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const dragStart = useRef<number | null>(null)
  const dragY = useRef(0)

  const index = el.atomicNumber - 1
  const prev = index > 0 ? ELEMENTS[index - 1] : null
  const next = index < ELEMENTS.length - 1 ? ELEMENTS[index + 1] : null
  const swipe = useSwipe(() => next && onNavigate(next), () => prev && onNavigate(prev))

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
    const ctrl = new AbortController()
    setApi(null)
    setLoading(true)
    fetchElementDetails(el.atomicNumber, ctrl.signal)
      .then(setApi)
      .catch(() => setApi(null))
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false) })

    setImgLoaded(false)
    fetchWikiImage(el.name, ctrl.signal)
      .then(src => setImg({ name: el.name, src }))
      .catch(() => { if (!ctrl.signal.aborted) setImg({ name: el.name, src: null }) })
    return () => ctrl.abort()
  }, [el.atomicNumber, el.name])

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

  const hooks = memoryHooks(el)
  const story = SYMBOL_STORIES[el.symbol]
  const photo = img?.name === el.name ? img.src : undefined

  const facts: [string, string][] = [
    ['Atomic mass', `${formatNumber(el.atomicMass, 4)} u`],
    ['Electron shells', el.shells.join(' · ') || '—'],
    ['Phase at 25 °C', el.state],
    ['Melting point', formatTemperature(el.meltingPointK)],
    ['Boiling point', formatTemperature(el.boilingPointK)],
    ['Density', formatDensity(el.density)],
    ['Electronegativity', el.electronegativity != null ? formatNumber(el.electronegativity, 2) : '—'],
    ['1st ionization', el.ionizationEnergy != null ? `${formatNumber(el.ionizationEnergy, 1)} kJ/mol` : '—'],
    ['Atomic radius', el.atomicRadius != null ? `${el.atomicRadius} pm` : '—'],
    ['Valence electrons', el.valenceElectrons != null ? String(el.valenceElectrons) : '—'],
    ['Oxidation states', el.oxidationStates?.replace(/,/g, ', ') ?? '—'],
    ['Discovered', formatDiscovery(el.discoveryYear, el.discoveredBy)],
  ]

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

          <div className="relative flex items-end gap-4 sm:gap-6" key={el.atomicNumber}>
            <div className="hero-sym text-[72px] sm:text-[104px]">{el.symbol}</div>
            <div className="min-w-0 pb-1 animate-[fadeUp_.4s_var(--ease-out)_both]">
              <div className="font-mono text-[12px] font-semibold opacity-80">#{el.atomicNumber} · {formatNumber(el.atomicMass, 3)} u</div>
              <h2 id="el-title" className="mt-0.5 truncate font-display text-[26px] font-extrabold leading-tight !text-white sm:text-[34px]">{el.name}</h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="hero-pill">{m.label}</span>
                <span className="hero-pill">{el.group ? `Group ${el.group}` : 'f-block'} · Period {el.period}</span>
                <span className="hero-pill">{el.state}</span>
                {el.radioactive && <span className="hero-pill"><Icon name="radiation" size={12} /> Radioactive</span>}
              </div>
            </div>
          </div>
        </header>

        {/* ── Body ── */}
        <div ref={bodyRef} className="sheet-body flex-1" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
          <div className="flex flex-col gap-5 p-5 sm:p-7 md:grid md:grid-cols-[280px_1fr] md:gap-6">
            {/* Left column (on phones its pieces interleave with the right column via order) */}
            <div className="contents md:block md:space-y-4">
              <div className="panel relative order-1 grid h-[180px] place-items-center overflow-hidden">
                {photo === undefined && <div className="skeleton absolute inset-0" />}
                {photo && (
                  <img src={photo} alt={`A sample of ${el.name}`} loading="lazy" decoding="async"
                    onLoad={() => setImgLoaded(true)} onError={() => setImg({ name: el.name, src: null })}
                    className="absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700"
                    style={{ opacity: imgLoaded ? 1 : 0, transform: imgLoaded ? 'none' : 'scale(1.06)' }} />
                )}
                {photo === null && <Bohr shells={el.shells} color={m.color} size={170} />}
                {photo && imgLoaded && (
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] text-white/85">Photo: Wikipedia</span>
                )}
              </div>

              <div className="order-2 grid grid-cols-2 gap-2">
                <button type="button" className={`btn btn-sm ${learned ? 'btn-soft' : ''}`} onClick={onToggleLearned} aria-pressed={learned}>
                  <Icon name={learned ? 'check' : 'star'} size={15} />{learned ? 'Learned' : 'Mark learned'}
                </button>
                <button type="button" className="btn btn-sm" onClick={onToggleCompare} aria-pressed={inCompare}
                  style={inCompare ? { borderColor: 'var(--warning-border)', background: 'var(--warning-soft)', color: 'var(--warning)' } : undefined}>
                  <Icon name="scale" size={15} />{inCompare ? 'Comparing' : 'Compare'}
                </button>
              </div>

              {photo !== null && (
                <div className="panel order-6 grid place-items-center py-3">
                  <Bohr shells={el.shells} color={m.color} size={180} />
                </div>
              )}

              <div className="panel order-7 p-4">
                <div className="eyebrow mb-1.5">Electron configuration</div>
                <div className="font-mono text-[15px] font-semibold">{prettyConfig(el.electronConfigurationSemantic)}</div>
                <div className="mt-1 break-words font-mono text-[11.5px] leading-relaxed text-[var(--text-3)]">{prettyConfig(el.electronConfiguration)}</div>
              </div>
            </div>

            {/* Right column */}
            <div className="contents md:block md:min-w-0 md:space-y-6">
              <section className="order-3">
                <div className="eyebrow mb-2 flex items-center gap-2"><Icon name="bulb" size={14} />Remember it</div>
                <div className="space-y-2">
                  <div className="hook">
                    <span className="font-display text-[15px] font-bold text-[var(--text)]">
                      {story ? <><HighlightedName symbol={el.symbol} word={story.origin} /> <span className="font-sans text-[13px] font-medium text-[var(--text-3)]">→ {el.name}</span></>
                        : <HighlightedName symbol={el.symbol} word={el.name} />}
                    </span>
                  </div>
                  {hooks.map(h => (
                    <div key={h} className="hook !bg-transparent">
                      <Icon name="sparkles" size={16} className="mt-0.5 shrink-0 text-[var(--accent-text)]" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="order-4">
                <p className="text-[15px] leading-[1.75] text-[var(--text-2)]">{api?.description || el.summary}</p>
                <a href={el.source} target="_blank" rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--accent-text)] hover:underline">
                  Read more on Wikipedia <Icon name="external" size={13} />
                </a>
              </section>

              <section className="hook order-5" style={{ '--c': '#fbbf24' } as CSSProperties}>
                <span className="text-[18px] leading-none" aria-hidden="true">💡</span>
                <div>
                  <div className="eyebrow mb-1 !text-[var(--warning)]">Fun fact</div>
                  <p className="text-[14px] leading-relaxed text-[var(--text)]">{api?.fun_fact || el.funFact}</p>
                </div>
              </section>

              <section className="order-8">
                <div className="eyebrow mb-2.5">Key properties</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {facts.map(([label, value]) => (
                    <div key={label} className="stat">
                      <div className="stat-label">{label}</div>
                      <div className="stat-value">{value}</div>
                    </div>
                  ))}
                </div>
              </section>

              {api?.uses && (
                <section className="order-9 animate-[fadeUp_.4s_var(--ease-out)_both]">
                  <div className="eyebrow mb-2">Everyday uses</div>
                  <p className="text-[14.5px] leading-relaxed text-[var(--text-2)]">{api.uses}</p>
                </section>
              )}

              {api?.named_after && (
                <section className="order-9 animate-[fadeUp_.4s_var(--ease-out)_both]">
                  <div className="eyebrow mb-2">Where the name comes from</div>
                  <p className="text-[14.5px] leading-relaxed text-[var(--text-2)]">{api.named_after}</p>
                </section>
              )}

              {api?.isotopes && api.isotopes.length > 0 && (
                <section className="order-9 animate-[fadeUp_.4s_var(--ease-out)_both]">
                  <div className="eyebrow mb-2">Isotopes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {api.isotopes.slice(0, 12).map(iso => (
                      <span key={iso.mass_number} className="chip !h-7 !cursor-default" aria-pressed="false">
                        <b className="text-[var(--text)]">{el.symbol}-{iso.mass_number}</b>
                        {iso.abundance != null && <span>{(iso.abundance * 100).toFixed(1)}%</span>}
                        {!iso.stable && <Icon name="radiation" size={12} className="text-[var(--warning)]" />}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              <section className="panel order-10 p-4 sm:p-5">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="eyebrow">Property fingerprint</div>
                  <div className="flex items-center gap-3 text-[11px] text-[var(--text-3)]">
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: m.color }} />{el.symbol}</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[var(--text-4)]" />Average</span>
                  </div>
                </div>
                <Radar el={el} color={m.color} />
              </section>

              {loading && (
                <div role="status" className="order-11 flex items-center gap-2.5 text-[13px] text-[var(--text-3)]">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border-2)] border-t-[var(--accent)]" />
                  Loading extra details…
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
