import type { CSSProperties } from 'react'
import { CATEGORY_META, PROPERTY_META, formatNumber, type Element, type PropertyKey } from '../data/elements'
import { useDialog } from '../hooks/useUi'
import { prettyConfig } from '../utils/format'
import { Icon } from './Icon'

export function CompareTray({ items, onOpen, onRemove, onClear }: {
  items: Element[]; onOpen: () => void; onRemove: (el: Element) => void; onClear: () => void
}) {
  if (items.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4 animate-[fadeUp_.35s_var(--ease-out)_both]"
      style={{ bottom: 'calc(var(--bottom-nav-h) + var(--safe-bottom) + 12px)' }}>
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-[var(--border-2)] bg-[var(--surface-raised)] p-2 shadow-[var(--shadow-lg)]">
        <div className="flex gap-1.5 pl-1">
          {items.map(el => (
            <button key={el.atomicNumber} type="button" onClick={() => onRemove(el)} aria-label={`Remove ${el.name} from comparison`}
              className="el-sym group relative !h-10 !w-10 !rounded-xl !text-[14px]" style={{ '--c': CATEGORY_META[el.categoryKey].color, animation: 'popIn .3s var(--ease-spring) both' } as CSSProperties}>
              {el.symbol}
              <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[var(--text)] text-[var(--bg)] opacity-0 transition-opacity group-hover:opacity-100"><Icon name="x" size={10} strokeWidth={3} /></span>
            </button>
          ))}
          {Array.from({ length: 3 - items.length }, (_, i) => (
            <span key={i} className="hidden h-10 w-10 rounded-xl border border-dashed border-[var(--border-2)] sm:block" aria-hidden="true" />
          ))}
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={onOpen} disabled={items.length < 2}>
          <Icon name="scale" size={15} />Compare{items.length < 2 ? ' (add 1 more)' : ''}
        </button>
        <button type="button" className="icon-btn !h-9 !w-9" onClick={onClear} aria-label="Clear comparison"><Icon name="x" size={15} /></button>
      </div>
    </div>
  )
}

type Row = { label: string; get: (e: Element) => string; num?: (e: Element) => number | null }

const num = (key: PropertyKey) => (e: Element) => e[key]

const ROWS: Row[] = [
  { label: 'Atomic number', get: e => String(e.atomicNumber), num: e => e.atomicNumber },
  { label: 'Atomic mass (u)', get: e => formatNumber(e.atomicMass, 3), num: num('atomicMass') },
  { label: 'Category', get: e => e.category },
  { label: 'Group · Period', get: e => `${e.group ?? 'f'} · ${e.period}` },
  { label: 'Phase at 25 °C', get: e => e.state },
  { label: 'Melting point (K)', get: e => formatNumber(e.meltingPointK, 0), num: num('meltingPointK') },
  { label: 'Boiling point (K)', get: e => formatNumber(e.boilingPointK, 0), num: num('boilingPointK') },
  { label: 'Density (g/cm³)', get: e => formatNumber(e.density, 4), num: num('density') },
  { label: PROPERTY_META.electronegativity.label, get: e => formatNumber(e.electronegativity, 2), num: num('electronegativity') },
  { label: 'Ionization (kJ/mol)', get: e => formatNumber(e.ionizationEnergy, 1), num: num('ionizationEnergy') },
  { label: 'Atomic radius (pm)', get: e => formatNumber(e.atomicRadius, 0), num: num('atomicRadius') },
  { label: 'Valence electrons', get: e => formatNumber(e.valenceElectrons, 0), num: e => e.valenceElectrons },
  { label: 'Configuration', get: e => prettyConfig(e.electronConfigurationSemantic) },
]

export function CompareModal({ items, onClose, onRemove, onOpen }: {
  items: Element[]; onClose: () => void; onRemove: (el: Element) => void; onOpen: (el: Element) => void
}) {
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  return (
    <div className="overlay">
      <div className="backdrop" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cmp-title" tabIndex={-1} className="sheet !max-w-[900px]">
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-7">
          <Icon name="scale" size={20} className="text-[var(--accent-text)]" />
          <h2 id="cmp-title" className="flex-1 text-[19px] font-bold">Compare elements</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close comparison"><Icon name="x" /></button>
        </header>
        <div className="sheet-body p-3 sm:p-6">
          <table className="w-full border-separate border-spacing-0 text-[13.5px]">
            <caption className="sr-only">Side-by-side properties. The highest value in each row is highlighted.</caption>
            <thead>
              <tr>
                <th className="w-[34%] p-2 text-left align-bottom sm:w-[28%]"><span className="eyebrow">Property</span></th>
                {items.map(e => (
                  <th key={e.atomicNumber} className="p-2 align-bottom">
                    <div className="flex flex-col items-center gap-1.5">
                      <button type="button" onClick={() => onOpen(e)} className="el-sym !h-14 !w-14 !rounded-2xl !text-[22px] transition-transform hover:scale-105"
                        style={{ '--c': CATEGORY_META[e.categoryKey].color } as CSSProperties}>{e.symbol}</button>
                      <span className="text-[14px] font-bold">{e.name}</span>
                      <button type="button" onClick={() => onRemove(e)} className="text-[11.5px] font-medium text-[var(--text-4)] hover:text-[var(--danger)]">Remove</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row, ri) => {
                const values = row.num ? items.map(e => row.num?.(e) ?? null) : []
                const max = values.length ? Math.max(...values.filter((v): v is number => v != null)) : null
                return (
                  <tr key={row.label} className={ri % 2 ? '' : '[&>td]:bg-[var(--surface-2)]'}>
                    <td className="rounded-l-xl px-3 py-2.5 text-[12.5px] font-semibold text-[var(--text-3)]">{row.label}</td>
                    {items.map((e, i) => {
                      const isMax = max != null && values[i] === max && values.filter(v => v === max).length < items.length
                      return (
                        <td key={e.atomicNumber} className="px-3 py-2.5 text-center font-mono last:rounded-r-xl"
                          style={isMax ? { color: 'var(--accent-text)', fontWeight: 700 } : { color: 'var(--text-2)' }}>
                          {row.get(e)}{isMax && <span className="ml-1 text-[10px]">▲</span>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
