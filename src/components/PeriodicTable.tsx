import { memo, useCallback, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import {
  CATEGORY_META, ELEMENTS, ELEMENT_BY_Z, PROPERTY_META, formatNumber, getPropertyValue, heatColor,
  heatNeedsDarkText, normalizedProperty, stateAtTemperature, type Element, type PropertyKey,
} from '../data/elements'
import { memoryHooks } from '../data/learning'
import { prettyConfig } from '../utils/format'

export type TableView = 'standard' | 'heatmap' | 'phase'

export const PHASE_COLORS = {
  Solid: '#6d7cff',
  Liquid: '#22c7e6',
  Gas: '#fb7185',
  Unknown: '#94a3b8',
} as const

interface Visual { fill?: string; darkInk?: boolean; empty?: boolean; label: string }

export function tileVisual(el: Element, view: TableView, property: PropertyKey, tempK: number): Visual {
  if (view === 'heatmap') {
    const v = getPropertyValue(el, property)
    if (v == null) return { empty: true, label: 'no data' }
    const t = normalizedProperty(el, property)
    return { fill: heatColor(t), darkInk: heatNeedsDarkText(t), label: formatNumber(v, PROPERTY_META[property].digits) }
  }
  if (view === 'phase') {
    const st = stateAtTemperature(el, tempK)
    if (st === 'Unknown') return { empty: true, label: '?' }
    return { fill: PHASE_COLORS[st], darkInk: st !== 'Solid', label: st }
  }
  return { label: formatNumber(el.atomicMass, el.atomicMass > 200 ? 0 : 2) }
}

const Tile = memo(function Tile({ el, view, visual, dim, learned, compare }: {
  el: Element; view: TableView; visual: Visual; dim: boolean; learned: boolean; compare: boolean
}) {
  const style = {
    gridColumn: el.xpos + 1,
    gridRow: el.ypos + 1,
    '--c': CATEGORY_META[el.categoryKey].color,
    '--wave': el.xpos + el.ypos,
    ...(visual.fill ? { '--fill': visual.fill } : null),
  } as CSSProperties

  return (
    <button
      type="button"
      data-z={el.atomicNumber}
      className={`tile${dim ? ' is-dim' : ''}${compare ? ' is-compare' : ''}`}
      data-mode={view === 'standard' ? undefined : 'data'}
      data-ink={visual.darkInk ? 'dark' : undefined}
      data-empty={visual.empty ? '' : undefined}
      style={style}
      tabIndex={dim ? -1 : 0}
      aria-label={`${el.name}, ${el.symbol}, atomic number ${el.atomicNumber}${view !== 'standard' ? `, ${visual.label}` : ''}${learned ? ', learned' : ''}`}
    >
      <span className="tile-z">{el.atomicNumber}</span>
      <span className="tile-sym">{el.symbol}</span>
      <span className="tile-name">{el.name}</span>
      <span className="tile-val">{visual.label}</span>
      {(learned || compare) && <span className={`tile-badge${compare ? ' is-compare' : ''}`} aria-hidden="true" />}
    </button>
  )
})

const BY_POSITION = new Map(ELEMENTS.map(e => [`${e.xpos},${e.ypos}`, e]))

function neighbour(el: Element, key: string): Element | undefined {
  const step: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
  const [dx, dy] = step[key]
  let x = el.xpos
  let y = el.ypos
  for (let i = 0; i < 18; i++) {
    x += dx
    y += dy
    if (x < 1 || x > 18 || y < 1 || y > 10) return undefined
    const found = BY_POSITION.get(`${x},${y}`)
    if (found) return found
  }
  return undefined
}

export function PeriodicTable({ view, property, tempK, visible, learned, compare, fallback, onOpen }: {
  view: TableView
  property: PropertyKey
  tempK: number
  visible: Set<number> | null
  learned: Set<number>
  compare: Set<number>
  fallback: Element
  onOpen: (el: Element) => void
}) {
  const [hoverZ, setHoverZ] = useState<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const visuals = useMemo(
    () => ELEMENTS.map(el => tileVisual(el, view, property, tempK)),
    [view, property, tempK],
  )

  const zFromEvent = (target: EventTarget | null): number | null => {
    const tile = (target as HTMLElement | null)?.closest<HTMLElement>('[data-z]')
    return tile ? Number(tile.dataset.z) : null
  }

  const onPointerOver = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const z = zFromEvent(e.target)
    if (z) setHoverZ(z)
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    const z = zFromEvent(e.target)
    const el = z ? ELEMENT_BY_Z.get(z) : undefined
    if (!el) return
    e.preventDefault()
    let next = neighbour(el, e.key)
    while (next && visible && !visible.has(next.atomicNumber)) next = neighbour(next, e.key)
    if (next) gridRef.current?.querySelector<HTMLElement>(`[data-z="${next.atomicNumber}"]`)?.focus()
  }

  const preview = (hoverZ ? ELEMENT_BY_Z.get(hoverZ) : undefined) ?? fallback

  return (
    <div className="ptable-scroll">
      <div
        ref={gridRef}
        className="ptable"
        data-view={view}
        role="group"
        aria-label="Periodic table of the elements. Use arrow keys to move between elements."
        onPointerOver={onPointerOver}
        onFocus={e => { const z = zFromEvent(e.target); if (z) setHoverZ(z) }}
        onClick={e => { const z = zFromEvent(e.target); const el = z ? ELEMENT_BY_Z.get(z) : undefined; if (el) onOpen(el) }}
        onKeyDown={onKeyDown}
      >
        {/* Group numbers */}
        {Array.from({ length: 18 }, (_, i) => (
          <div key={`g${i}`} className={`axis-label${preview.group === i + 1 ? ' is-on' : ''}`} style={{ gridColumn: i + 2, gridRow: 1, height: 20 }} aria-hidden="true">
            {i + 1}
          </div>
        ))}
        {/* Period numbers */}
        {Array.from({ length: 7 }, (_, i) => (
          <div key={`p${i}`} className={`axis-label${preview.period === i + 1 && preview.group != null ? ' is-on' : ''}`} style={{ gridColumn: 1, gridRow: i + 2 }} aria-hidden="true">
            {i + 1}
          </div>
        ))}

        <TablePreview el={preview} view={view} property={property} tempK={tempK} />

        {ELEMENTS.map((el, i) => (
          <Tile
            key={el.atomicNumber}
            el={el}
            view={view}
            visual={visuals[i]}
            dim={visible ? !visible.has(el.atomicNumber) : false}
            learned={learned.has(el.atomicNumber)}
            compare={compare.has(el.atomicNumber)}
          />
        ))}

        {/* f-block placeholders and labels */}
        {([['lanthanide', 6, '57–71', 'La–Lu'], ['actinide', 7, '89–103', 'Ac–Lr']] as const).map(([key, row, range, syms]) => (
          <div key={key} className="tile-slot" aria-hidden="true"
            style={{ gridColumn: 4, gridRow: row + 1, '--c': CATEGORY_META[key].color } as CSSProperties}>
            <span>{range}</span>
            <span style={{ opacity: 0.7 }}>{syms}</span>
          </div>
        ))}
        <div className="series-label" style={{ gridColumn: '1 / 4', gridRow: 10 }} aria-hidden="true">Lanthanides</div>
        <div className="series-label" style={{ gridColumn: '1 / 4', gridRow: 11 }} aria-hidden="true">Actinides</div>
      </div>
    </div>
  )
}

function TablePreview({ el, view, property, tempK }: { el: Element; view: TableView; property: PropertyKey; tempK: number }) {
  const m = CATEGORY_META[el.categoryKey]
  const visual = tileVisual(el, view, property, tempK)
  const hook = memoryHooks(el)[0]
  const pm = PROPERTY_META[property]
  const isData = view !== 'standard'
  const tileStyle = {
    '--c': m.color,
    ...(isData && visual.fill ? { background: visual.fill, color: visual.darkInk ? '#0e1326' : '#fff', borderColor: 'transparent' } : null),
  } as CSSProperties

  return (
    <div className="preview" aria-live="polite" aria-atomic="true">
      <div className="preview-tile" style={tileStyle} key={el.atomicNumber}>
        <div className="flex items-start justify-between font-mono text-[12px] font-semibold opacity-80">
          <span>{el.atomicNumber}</span>
          <span className="hidden min-[1100px]:inline">{formatNumber(el.atomicMass, 3)}</span>
        </div>
        <div className="font-display font-extrabold leading-none tracking-[-0.04em] text-[clamp(30px,4vw,58px)] animate-[popIn_.35s_var(--ease-spring)_both]">
          {el.symbol}
        </div>
        <div className="truncate text-[12px] font-semibold opacity-85">{el.name}</div>
      </div>

      <div className="preview-info">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip !h-6 !px-2.5 !text-[11px]" aria-pressed="true" style={{ '--c': m.color } as CSSProperties}>
            <span className="dot" />{m.label}
          </span>
          <span className="hidden text-[12px] font-semibold text-[var(--text-3)] min-[900px]:inline">
            {el.group ? `Group ${el.group} · ` : ''}Period {el.period} · {el.block}-block
          </span>
        </div>

        {view === 'standard' && (
          <>
            <div className="font-display text-[clamp(16px,1.9vw,24px)] font-bold">{el.name}</div>
            <div className="font-mono text-[12.5px] text-[var(--text-2)]">{prettyConfig(el.electronConfigurationSemantic)}</div>
            {hook && <p className="hidden max-w-[46ch] text-[12.5px] leading-snug text-[var(--text-3)] min-[1000px]:line-clamp-2">{hook}</p>}
          </>
        )}

        {view === 'heatmap' && (
          <>
            <div className="text-[12px] font-semibold text-[var(--text-3)]">{pm.label}</div>
            <div className="font-display text-[clamp(18px,2.2vw,28px)] font-bold tabular-nums">
              {visual.empty ? 'No data' : `${visual.label}${pm.unit ? ` ${pm.unit}` : ''}`}
            </div>
            <p className="hidden max-w-[46ch] text-[12.5px] leading-snug text-[var(--text-3)] min-[1000px]:line-clamp-2">{pm.tip}</p>
          </>
        )}

        {view === 'phase' && (
          <>
            <div className="font-display text-[clamp(16px,2vw,24px)] font-bold">
              {visual.empty ? 'Unknown state' : <>A <span style={{ color: PHASE_COLORS[visual.label as keyof typeof PHASE_COLORS] }}>{visual.label.toLowerCase()}</span> at {tempK} K</>}
            </div>
            <div className="font-mono text-[12px] text-[var(--text-3)]">
              melts {el.meltingPointK != null ? `${formatNumber(el.meltingPointK, 0)} K` : '—'} · boils {el.boilingPointK != null ? `${formatNumber(el.boilingPointK, 0)} K` : '—'}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
