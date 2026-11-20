import { useDeferredValue, useMemo, useState, type CSSProperties, type RefObject } from 'react'
import {
  CATEGORY_COUNTS, CATEGORY_META, CATEGORY_ORDER, ELEMENTS, PROPERTY_META, PROPERTY_ORDER, formatNumber,
  getPropertyExtremes, getPropertyRange, getPropertyValue, heatColor, isLogScaled, normalizedProperty,
  stateAtTemperature, type CategoryKey, type Element, type PropertyKey,
} from '../data/elements'
import { memoryHooks } from '../data/learning'
import { kelvinToCelsius, kelvinToFahrenheit } from '../utils/format'
import { AdSlot } from './AdSlot'
import { Ring, TrendLine } from './Charts'
import { Icon } from './Icon'
import { ElementLink, Link } from './Link'
import { PHASE_COLORS, PeriodicTable, tileVisual, type TableView } from './PeriodicTable'

export type Layout = 'table' | 'list'

export function useExploreState() {
  const [tableView, setTableView] = useState<TableView>('standard')
  const [property, setProperty] = useState<PropertyKey>('electronegativity')
  const [tempK, setTempK] = useState(298)
  const [layout, setLayout] = useState<Layout>('table')
  const [categories, setCategories] = useState<Set<CategoryKey>>(() => new Set(CATEGORY_ORDER))
  const [search, setSearch] = useState('')
  return { tableView, setTableView, property, setProperty, tempK, setTempK, layout, setLayout, categories, setCategories, search, setSearch }
}

export type ExploreState = ReturnType<typeof useExploreState>

export function searchElements(query: string): Element[] {
  const q = query.trim().toLowerCase()
  if (!q) return ELEMENTS
  const score = (e: Element): number => {
    if (String(e.atomicNumber) === q) return 100
    if (e.symbol.toLowerCase() === q) return 90
    if (e.name.toLowerCase().startsWith(q)) return 80
    if (e.name.toLowerCase().includes(q)) return 60
    if (q.length <= 2 && e.symbol.toLowerCase().startsWith(q)) return 50
    if (q.length >= 4 && e.category.toLowerCase().includes(q)) return 40
    if (e.latinName?.toLowerCase().startsWith(q)) return 30
    return 0
  }
  return ELEMENTS.map(e => [e, score(e)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).map(([e]) => e)
}

const TEMP_PRESETS = [
  { label: 'Absolute zero', short: '0 K', k: 1 },
  { label: 'Dry ice', short: '−78 °C', k: 195 },
  { label: 'Room', short: '25 °C', k: 298 },
  { label: 'Boiling water', short: '100 °C', k: 373 },
  { label: 'Lava', short: '1,200 °C', k: 1473 },
  { label: 'Sun’s surface', short: '5,500 °C', k: 5778 },
]

export function ExploreView({ state, searchRef, learned, compare, dayElement, learnedCount, streak, onOpen, onQuickQuiz }: {
  state: ExploreState
  searchRef: RefObject<HTMLInputElement | null>
  learned: Set<number>
  compare: Set<number>
  dayElement: Element
  learnedCount: number
  streak: number
  onOpen: (el: Element) => void
  onQuickQuiz: () => void
}) {
  const { tableView, setTableView, property, setProperty, tempK, setTempK, layout, setLayout, categories, setCategories, search, setSearch } = state
  const deferredTemp = useDeferredValue(tempK)
  const results = useMemo(() => searchElements(search), [search])

  const visible = useMemo(() => {
    const allCats = categories.size === CATEGORY_ORDER.length
    if (!search.trim() && allCats) return null
    return new Set(results.filter(e => categories.has(e.categoryKey)).map(e => e.atomicNumber))
  }, [results, categories, search])
  const visibleCount = visible ? visible.size : 118

  const toggleCategory = (k: CategoryKey) => setCategories(prev => {
    // First click on a full set focuses that one category, which is what people usually want.
    if (prev.size === CATEGORY_ORDER.length) return new Set([k])
    const next = new Set(prev)
    if (next.has(k)) next.delete(k); else next.add(k)
    return next.size === 0 ? new Set(CATEGORY_ORDER) : next
  })
  const resetFilters = () => { setCategories(new Set(CATEGORY_ORDER)); setSearch('') }

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const first = results.find(r => categories.has(r.categoryKey))
      if (first && search.trim()) onOpen(first)
    }
    if (e.key === 'Escape' && search) { e.stopPropagation(); setSearch('') }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <Hero dayElement={dayElement} learnedCount={learnedCount} streak={streak} onQuickQuiz={onQuickQuiz} />

      {/* ── Controls ── */}
      <section id="explore-table" className="card scroll-mt-20 p-3 sm:p-4" aria-label="Table controls">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="segmented grid grid-cols-3 lg:inline-flex" role="group" aria-label="Colour the table by">
            {([['standard', 'Categories', 'table'], ['heatmap', 'Trends', 'sparkles'], ['phase', 'States', 'thermometer']] as const).map(([k, label, icon]) => (
              <button key={k} type="button" className="justify-center !px-2 sm:!px-3.5" aria-pressed={tableView === k} onClick={() => setTableView(k)}>
                <Icon name={icon} size={15} className="hidden min-[360px]:block" />{label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 lg:ml-auto">
            <div className="relative min-w-0 flex-1 lg:w-[320px] lg:flex-none">
              <Icon name="search" size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
              <input
                ref={searchRef}
                className="field !h-11 pl-10 pr-[5.5rem]"
                type="search"
                inputMode="search"
                enterKeyHint="go"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={onSearchKey}
                placeholder="Name, symbol or number"
                aria-label="Search elements"
                maxLength={40}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                {search ? (
                  <button type="button" className="icon-btn !h-7 !w-7 !rounded-lg" onClick={() => setSearch('')} aria-label="Clear search"><Icon name="x" size={14} /></button>
                ) : (
                  <span className="hidden items-center gap-1 sm:flex" aria-hidden="true"><span className="kbd">/</span></span>
                )}
                <span className="font-mono text-[11px] font-semibold tabular-nums text-[var(--text-3)]" aria-live="polite">{visibleCount}/118</span>
              </div>
            </div>
            <div className="segmented shrink-0" role="group" aria-label="Layout">
              <button type="button" className="!px-2.5" aria-pressed={layout === 'table'} onClick={() => setLayout('table')} aria-label="Table layout" title="Table"><Icon name="table" size={17} /></button>
              <button type="button" className="!px-2.5" aria-pressed={layout === 'list'} onClick={() => setLayout('list')} aria-label="List layout" title="List"><Icon name="list" size={17} /></button>
            </div>
          </div>
        </div>

        {/* Mode-specific controls */}
        <div className="mt-3 border-t border-[var(--border)] pt-3" key={tableView}>
          {tableView === 'standard' && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 no-scrollbar sm:flex-wrap animate-[fadeIn_.3s_ease]">
              {CATEGORY_ORDER.map(k => (
                <button key={k} type="button" className="chip shrink-0" aria-pressed={categories.has(k)} onClick={() => toggleCategory(k)}
                  style={{ '--c': CATEGORY_META[k].color } as CSSProperties} title={CATEGORY_META[k].blurb}>
                  <span className="dot" />{CATEGORY_META[k].label}
                  <span className="font-mono text-[10.5px] opacity-60">{CATEGORY_COUNTS[k]}</span>
                </button>
              ))}
              {(categories.size < CATEGORY_ORDER.length || search) && (
                <button type="button" className="chip shrink-0" onClick={resetFilters}><Icon name="rotate" size={13} />Show all</button>
              )}
            </div>
          )}

          {tableView === 'heatmap' && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 no-scrollbar sm:flex-wrap animate-[fadeIn_.3s_ease]">
              {PROPERTY_ORDER.map(k => (
                <button key={k} type="button" className="chip shrink-0" aria-pressed={property === k} onClick={() => setProperty(k)}>
                  {PROPERTY_META[k].label}
                </button>
              ))}
            </div>
          )}

          {tableView === 'phase' && (
            <div className="space-y-3 animate-[fadeIn_.3s_ease]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label htmlFor="temp" className="sr-only">Temperature in kelvin</label>
                <input id="temp" type="range" className="range flex-1" min={1} max={6000} step={1} value={tempK}
                  onChange={e => setTempK(Number(e.target.value))}
                  aria-valuetext={`${tempK} kelvin, ${Math.round(kelvinToCelsius(tempK))} degrees Celsius`} />
                <div className="flex items-baseline gap-2 font-mono tabular-nums sm:w-[250px] sm:justify-end">
                  <span className="text-[20px] font-bold text-[var(--text)]">{tempK} K</span>
                  <span className="text-[13px] text-[var(--text-3)]">{Math.round(kelvinToCelsius(tempK))} °C · {Math.round(kelvinToFahrenheit(tempK))} °F</span>
                </div>
              </div>
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 no-scrollbar">
                {TEMP_PRESETS.map(p => (
                  <button key={p.k} type="button" className="chip shrink-0" aria-pressed={tempK === p.k} onClick={() => setTempK(p.k)}>
                    {p.label} <span className="font-mono text-[10.5px] opacity-60">{p.short}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tableView !== 'standard' && categories.size < CATEGORY_ORDER.length && (
            <button type="button" className="chip mt-2" onClick={() => setCategories(new Set(CATEGORY_ORDER))}>
              <Icon name="rotate" size={13} />Category filter is on · show all
            </button>
          )}
        </div>
      </section>

      {/* ── Table or list ── */}
      <section className="card relative overflow-hidden p-2.5 sm:p-5" aria-label="Elements">
        {visibleCount === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : layout === 'table' ? (
          <>
            <PeriodicTable view={tableView} property={property} tempK={deferredTemp} visible={visible}
              learned={learned} compare={compare} fallback={dayElement} onOpen={onOpen} />
            <p className="mt-2 flex items-center gap-1.5 px-1 text-[12px] text-[var(--text-3)] md:hidden">
              <Icon name="arrowRight" size={13} /> Swipe sideways to see the whole table. Tap an element to open it.
            </p>
          </>
        ) : (
          <ElementList view={tableView} property={property} tempK={deferredTemp} visible={visible} learned={learned} />
        )}
      </section>

      <Insights view={tableView} property={property} tempK={deferredTemp} onOpen={onOpen} />

      <AboutTable />

      <AdSlot placement="explore" />
    </div>
  )
}

/* ── Hero ── */
function Hero({ dayElement, learnedCount, streak, onQuickQuiz }: {
  dayElement: Element; learnedCount: number; streak: number; onQuickQuiz: () => void
}) {
  const m = CATEGORY_META[dayElement.categoryKey]
  const hook = memoryHooks(dayElement)[0] ?? dayElement.funFact

  return (
    <section className="grid gap-4 pt-2 sm:pt-4 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:gap-10">
      <div className="reveal flex flex-col justify-center py-2 lg:py-6">
        <div className="eyebrow mb-3 flex items-center gap-2">
          <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-ping rounded-full bg-[var(--accent)] opacity-60" /><span className="relative h-2 w-2 rounded-full bg-[var(--accent)]" /></span>
          Interactive periodic table · 118 elements
        </div>
        <h1 className="font-display text-[clamp(30px,5.4vw,60px)] font-extrabold leading-[1.04] tracking-[-0.045em]">
          The periodic table,<br /><span className="text-gradient">made memorable.</span>
        </h1>
        <p className="mt-4 max-w-[54ch] text-[15px] leading-relaxed text-[var(--text-2)] sm:text-[16.5px]">
          Explore all 118 elements, watch the trends come alive, then lock them in with mnemonics, flip cards and quick quizzes. Free, built for students and works offline.
        </p>
        <div className="mt-6 flex flex-wrap gap-2.5">
          <Link href="/practice" className="btn btn-primary btn-lg">
            <Icon name="book" size={18} />Start learning
          </Link>
          <button type="button" className="btn btn-lg" onClick={onQuickQuiz}>
            <Icon name="target" size={18} />Take a quiz
          </button>
        </div>
      </div>

      <div className="reveal grid gap-3 [animation-delay:120ms] sm:grid-cols-[1.4fr_1fr] lg:grid-cols-1">
        <ElementLink el={dayElement}
          className="card group relative flex items-center gap-4 overflow-hidden p-4 text-left transition-transform duration-300 hover:-translate-y-1"
          style={{ '--c': m.color } as CSSProperties}>
          <span className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-40 blur-3xl" style={{ background: m.color }} />
          <span className="el-sym !h-[84px] !w-[84px] !rounded-[20px] !text-[36px] shrink-0 animate-[float_5s_ease-in-out_infinite]">{dayElement.symbol}</span>
          <span className="relative min-w-0">
            <span className="eyebrow block !text-[var(--accent-text)]">Element of the day</span>
            <span className="mt-1 block font-display text-[22px] font-bold leading-tight">{dayElement.name}</span>
            <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-[var(--text-3)]">{hook}</span>
          </span>
          <Icon name="arrowRight" size={18} className="ml-auto shrink-0 text-[var(--text-3)] transition-transform group-hover:translate-x-1" />
        </ElementLink>

        <Link href="/practice" className="card flex items-center gap-4 p-4 text-left transition-transform duration-300 hover:-translate-y-1">
          <Ring value={learnedCount / 118} size={62} stroke={6}>
            <span className="font-mono text-[13px] font-bold">{learnedCount}</span>
          </Ring>
          <span className="min-w-0">
            <span className="eyebrow block">Your progress</span>
            <span className="mt-1 block text-[14px] font-semibold">{learnedCount === 0 ? 'Nothing learned yet' : `${learnedCount} of 118 learned`}</span>
            <span className="mt-0.5 flex items-center gap-1 text-[12.5px] text-[var(--text-3)]">
              <Icon name="flame" size={13} className={streak ? 'text-orange-400' : ''} />
              {streak ? `${streak}-day streak` : 'Start a streak today'}
            </span>
          </span>
        </Link>
      </div>
    </section>
  )
}

/* ── List layout ── */
function ElementList({ view, property, tempK, visible, learned }: {
  view: TableView; property: PropertyKey; tempK: number; visible: Set<number> | null; learned: Set<number>
}) {
  const items = useMemo(() => {
    const list = ELEMENTS.filter(e => !visible || visible.has(e.atomicNumber))
    if (view !== 'heatmap') return list
    return [...list].sort((a, b) => (getPropertyValue(b, property) ?? -Infinity) - (getPropertyValue(a, property) ?? -Infinity))
  }, [view, property, visible])

  return (
    <ul className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {items.map((el, i) => {
        const v = tileVisual(el, view, property, tempK)
        const color = view === 'standard' || !v.fill ? CATEGORY_META[el.categoryKey].color : v.fill
        const t = view === 'heatmap' && !v.empty ? normalizedProperty(el, property) : null
        return (
          <li key={el.atomicNumber}>
            <ElementLink el={el} className="el-card w-full"
              style={{ '--c': color, animationDelay: `${Math.min(i, 30) * 12}ms` } as CSSProperties}>
              <span className="el-sym">{el.symbol}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-display text-[15px] font-bold">{el.name}</span>
                  {learned.has(el.atomicNumber) && <Icon name="check" size={14} className="shrink-0 text-[var(--success)]" />}
                </span>
                <span className="block truncate text-[12px] text-[var(--text-3)]">
                  #{el.atomicNumber} · {view === 'standard' ? CATEGORY_META[el.categoryKey].label : view === 'phase' ? v.label : `${v.label}${!v.empty && PROPERTY_META[property].unit ? ` ${PROPERTY_META[property].unit}` : ''}`}
                </span>
                {t != null && <span className="meter mt-1.5 block"><span style={{ width: `${Math.max(4, t * 100)}%`, background: v.fill }} /></span>}
              </span>
              {view === 'heatmap' && <span className="font-mono text-[11px] font-semibold text-[var(--text-4)]">#{i + 1}</span>}
            </ElementLink>
          </li>
        )
      })}
    </ul>
  )
}

/* ── Insights under the table ── */
function Insights({ view, property, tempK, onOpen }: { view: TableView; property: PropertyKey; tempK: number; onOpen: (el: Element) => void }) {
  if (view === 'heatmap') return <TrendInsight property={property} onOpen={onOpen} />
  if (view === 'phase') return <PhaseInsight tempK={tempK} />
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {[
        { icon: 'eye' as const, title: 'Hover or tap', text: 'Point at any element to preview it in the big tile; tap to open the full profile.' },
        { icon: 'layers' as const, title: 'Rows & columns', text: 'Rows are periods (number of shells). Columns are groups — elements in a group behave alike.' },
        { icon: 'scale' as const, title: 'Compare', text: 'Open an element and press Compare to line up to three elements side by side.' },
      ].map(c => (
        <div key={c.title} className="card flex gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon name={c.icon} size={17} /></span>
          <div>
            <div className="text-[14px] font-semibold">{c.title}</div>
            <p className="mt-0.5 text-[13px] leading-snug text-[var(--text-3)]">{c.text}</p>
          </div>
        </div>
      ))}
    </section>
  )
}

const DIRECTION_TEXT = { increases: 'increases', decreases: 'decreases', varies: 'has no simple trend' }

function TrendInsight({ property, onOpen }: { property: PropertyKey; onOpen: (el: Element) => void }) {
  const pm = PROPERTY_META[property]
  const { min, max } = getPropertyRange(property)
  const { high, low } = getPropertyExtremes(property)
  const fmt = (v: number) => `${formatNumber(v, pm.digits)}${pm.unit ? ` ${pm.unit}` : ''}`

  return (
    <section className="grid gap-3 lg:grid-cols-[1.3fr_1fr]" key={property}>
      <div className="card p-4 sm:p-5 animate-[fadeUp_.4s_var(--ease-out)_both]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[18px] font-bold">{pm.label}</h3>
          {isLogScaled(property) && <span className="text-[11.5px] text-[var(--text-3)]">colour scale is logarithmic</span>}
        </div>
        <div className="mt-3 h-3 rounded-full" style={{ background: `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(heatColor).join(',')})` }} />
        <div className="mt-1.5 flex justify-between font-mono text-[11.5px] text-[var(--text-3)]">
          <span>{fmt(min)}</span><span>{fmt(max)}</span>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-2)]">{pm.tip}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="stat flex items-center gap-2.5">
            <Icon name="arrowRight" size={18} className="shrink-0 text-[var(--accent-text)]" />
            <div><div className="stat-label">Across a period →</div><div className="text-[13.5px] font-semibold">{DIRECTION_TEXT[pm.across]}</div></div>
          </div>
          <div className="stat flex items-center gap-2.5">
            <Icon name="arrowDown" size={18} className="shrink-0 text-[var(--accent-text)]" />
            <div><div className="stat-label">Down a group ↓</div><div className="text-[13.5px] font-semibold">{DIRECTION_TEXT[pm.down]}</div></div>
          </div>
        </div>
      </div>
      <div className="card p-4 sm:p-5 animate-[fadeUp_.4s_var(--ease-out)_.08s_both]">
        <div className="eyebrow mb-2">Across all 118 elements</div>
        <TrendLine property={property} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[['Highest', high], ['Lowest', low]].map(([label, el]) => (
            <button key={label as string} type="button" className="stat text-left transition-colors hover:border-[var(--accent-border)]" onClick={() => onOpen(el as Element)}>
              <div className="stat-label">{label as string}</div>
              <div className="text-[14px] font-semibold">{(el as Element).name}</div>
              <div className="font-mono text-[12px] text-[var(--text-3)]">{fmt(getPropertyValue(el as Element, property) ?? 0)}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function PhaseInsight({ tempK }: { tempK: number }) {
  const counts = useMemo(() => {
    const c = { Solid: 0, Liquid: 0, Gas: 0, Unknown: 0 }
    for (const e of ELEMENTS) c[stateAtTemperature(e, tempK)] += 1
    return c
  }, [tempK])

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-[17px] font-bold">At {tempK} K ({Math.round(kelvinToCelsius(tempK))} °C)</h3>
        <span className="text-[12px] text-[var(--text-3)]">Simplified model at about 1 atmosphere</span>
      </div>
      <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[var(--surface-3)]">
        {(['Solid', 'Liquid', 'Gas', 'Unknown'] as const).map(s => (
          <span key={s} style={{ width: `${(counts[s] / 118) * 100}%`, background: PHASE_COLORS[s], transition: 'width .5s var(--ease-out)' }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['Solid', 'Liquid', 'Gas', 'Unknown'] as const).map(s => (
          <div key={s} className="stat flex items-center gap-2.5">
            <span className="h-3 w-3 shrink-0 rounded" style={{ background: PHASE_COLORS[s] }} />
            <div>
              <div className="stat-label">{s === 'Unknown' ? 'No data' : `${s}s`}</div>
              <div className="font-mono text-[16px] font-bold tabular-nums">{counts[s]}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── A short explainer: useful for students and for search engines ── */
function AboutTable() {
  return (
    <section className="card p-5 sm:p-7" aria-labelledby="about-table">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr] lg:gap-10">
        <div>
          <div className="eyebrow mb-2">The basics</div>
          <h2 id="about-table" className="text-[22px] font-bold sm:text-[24px]">How the periodic table works</h2>
          <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed text-[var(--text-2)]">
            <p>
              The periodic table lists all 118 known chemical elements in order of <b className="text-[var(--text)]">atomic number</b> — the number of protons in one atom.
            </p>
            <p>
              Each <b className="text-[var(--text)]">row is a period</b>: moving down a row adds an electron shell. Each <b className="text-[var(--text)]">column is a group</b>: elements in a group have the same number of outer electrons, so they react in similar ways.
            </p>
            <p>
              Metals sit on the left and in the middle, nonmetals on the right, and the metalloids form a staircase between them.
            </p>
          </div>
          <Link href="/practice" className="btn btn-soft mt-5"><Icon name="book" size={16} />Learn it with mnemonics</Link>
        </div>
        <div>
          <h3 className="mb-3 text-[16px] font-bold">The ten element families</h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {CATEGORY_ORDER.map(k => (
              <li key={k} className="panel flex gap-3 p-3">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: CATEGORY_META[k].color }} />
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold">{CATEGORY_META[k].label.replace(/gas$/, 'gase')}s <span className="font-mono text-[11.5px] font-medium text-[var(--text-3)]">{CATEGORY_COUNTS[k]}</span></span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--text-3)]">{CATEGORY_META[k].blurb}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="grid place-items-center gap-3 px-6 py-16 text-center animate-[fadeUp_.3s_ease]">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--surface-2)] text-[var(--text-3)]"><Icon name="search" size={24} /></span>
      <div>
        <p className="text-[16px] font-semibold">No elements match</p>
        <p className="mt-1 text-[13.5px] text-[var(--text-3)]">Try another name, symbol or number, or clear the filters.</p>
      </div>
      <button type="button" className="btn btn-soft btn-sm" onClick={onReset}>Clear filters</button>
    </div>
  )
}
