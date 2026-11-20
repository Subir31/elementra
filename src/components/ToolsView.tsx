import { useState, type CSSProperties } from 'react'
import { CATEGORY_META, ELEMENT_BY_SYMBOL, type Element } from '../data/elements'
import { calculateMolarMass, prettyFormula, type FormulaResult } from '../utils/chemistry'
import { AdSlot } from './AdSlot'
import { Icon } from './Icon'

const EXAMPLES = [
  ['H2O', 'Water'],
  ['CO2', 'Carbon dioxide'],
  ['NaCl', 'Table salt'],
  ['C6H12O6', 'Glucose'],
  ['H2SO4', 'Sulfuric acid'],
  ['Ca(OH)2', 'Slaked lime'],
  ['CuSO4·5H2O', 'Blue vitriol'],
  ['C8H10N4O2', 'Caffeine'],
] as const

export function ToolsView({ onOpen }: { onOpen: (el: Element) => void }) {
  return (
    <div className="space-y-6 pt-2 sm:pt-4">
      <div className="reveal">
        <div className="eyebrow mb-2">Tools</div>
        <h1 className="font-display text-[clamp(28px,4.4vw,44px)] font-extrabold leading-[1.08] tracking-[-0.04em]">
          Homework helpers <span className="text-gradient">that show their working.</span>
        </h1>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <MolarMass onOpen={onOpen} />
        <div className="space-y-5">
          <TemperatureConverter />
          <AdSlot placement="tools" />
        </div>
      </div>
    </div>
  )
}

function MolarMass({ onOpen }: { onOpen: (el: Element) => void }) {
  const [formula, setFormula] = useState('')
  const [result, setResult] = useState<FormulaResult | null>(null)
  const [error, setError] = useState('')

  const run = (value: string) => {
    try { setResult(calculateMolarMass(value)); setError('') }
    catch (e) { setResult(null); setError(e instanceof Error ? e.message : 'Invalid formula.') }
  }

  return (
    <section className="card p-5 sm:p-7" aria-labelledby="mm-title">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon name="calculator" size={21} /></span>
        <div>
          <h2 id="mm-title" className="text-[21px] font-bold">Molar mass calculator</h2>
          <p className="text-[13.5px] text-[var(--text-3)]">Brackets, hydrates (·) and subscripts like H₂O all work — fully offline.</p>
        </div>
      </div>

      <form className="mt-5 flex flex-col gap-2.5 sm:flex-row" onSubmit={e => { e.preventDefault(); run(formula) }}>
        <label htmlFor="formula" className="sr-only">Chemical formula</label>
        <input id="formula" className="field !h-12 font-mono !text-[16px]" value={formula} onChange={e => setFormula(e.target.value)}
          placeholder="e.g. Ca(OH)2 or CuSO4·5H2O" maxLength={80} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" />
        <button type="submit" className="btn btn-primary !h-12 sm:!px-7">Calculate</button>
      </form>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXAMPLES.map(([f, name]) => (
          <button key={f} type="button" className="chip" onClick={() => { setFormula(f); run(f) }} title={name}>
            <span className="font-mono">{prettyFormula(f)}</span>
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-3.5 py-2.5 text-[13.5px] font-medium text-[var(--danger)]">{error}</p>}

      {result && (
        <div className="mt-6 animate-[fadeUp_.35s_var(--ease-out)_both]" aria-live="polite">
          <div className="panel flex flex-wrap items-baseline gap-x-4 gap-y-1 p-5">
            <span className="font-mono text-[18px] font-semibold text-[var(--text-2)]">{prettyFormula(result.formula)}</span>
            <span className="font-display text-[40px] font-extrabold tabular-nums tracking-[-0.03em] text-gradient">{result.molarMass.toFixed(3)}</span>
            <span className="font-mono text-[14px] text-[var(--text-3)]">g/mol</span>
          </div>

          <div className="mt-4">
            <div className="eyebrow mb-2">Mass composition</div>
            <div className="flex h-4 overflow-hidden rounded-full bg-[var(--surface-3)]" role="img"
              aria-label={result.breakdown.map(b => `${b.symbol} ${(b.fraction * 100).toFixed(1)}%`).join(', ')}>
              {result.breakdown.map(b => {
                const el = ELEMENT_BY_SYMBOL.get(b.symbol)
                return <span key={b.symbol} title={`${b.symbol} ${(b.fraction * 100).toFixed(1)}%`}
                  style={{ width: `${b.fraction * 100}%`, background: el ? CATEGORY_META[el.categoryKey].color : 'var(--accent)', transition: 'width .6s var(--ease-out)' }} />
              })}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
            <table className="w-full text-left text-[13.5px]">
              <thead className="bg-[var(--surface-2)] text-[11.5px] uppercase tracking-wider text-[var(--text-3)]">
                <tr><th className="px-3 py-2.5 font-semibold">Element</th><th className="px-3 py-2.5 font-semibold">Atoms</th><th className="hidden px-3 py-2.5 font-semibold min-[440px]:table-cell">× mass</th><th className="px-3 py-2.5 text-right font-semibold">Share</th></tr>
              </thead>
              <tbody>
                {result.breakdown.map(b => {
                  const el = ELEMENT_BY_SYMBOL.get(b.symbol)
                  return (
                    <tr key={b.symbol} className="border-t border-[var(--border)]">
                      <td className="px-3 py-2">
                        {el && (
                          <button type="button" onClick={() => onOpen(el)} className="flex items-center gap-2.5 font-semibold hover:text-[var(--accent-text)]">
                            <span className="el-sym !h-8 !w-8 !rounded-lg !text-[13px]" style={{ '--c': CATEGORY_META[el.categoryKey].color, animation: 'none' } as CSSProperties}>{el.symbol}</span>
                            <span className="hidden min-[400px]:inline">{el.name}</span>
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">{b.count}</td>
                      <td className="hidden px-3 py-2 font-mono text-[var(--text-3)] min-[440px]:table-cell">{b.atomicMass.toFixed(3)} = {b.subtotal.toFixed(3)}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{(b.fraction * 100).toFixed(1)}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

function TemperatureConverter() {
  const [value, setValue] = useState('25')
  const [unit, setUnit] = useState<'C' | 'K' | 'F'>('C')
  const n = Number(value.replace(',', '.'))
  const valid = value.trim() !== '' && Number.isFinite(n)
  const k = !valid ? null : unit === 'K' ? n : unit === 'C' ? n + 273.15 : (n - 32) * 5 / 9 + 273.15
  const below = k != null && k < 0
  const fmt = (v: number) => (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, ''))

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="temp-title">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon name="thermometer" size={21} /></span>
        <div>
          <h2 id="temp-title" className="text-[19px] font-bold">Temperature converter</h2>
          <p className="text-[13.5px] text-[var(--text-3)]">K = °C + 273.15</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <label htmlFor="temp-in" className="sr-only">Temperature</label>
        <input id="temp-in" className="field !h-12 font-mono !text-[16px]" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} />
        <div className="segmented shrink-0" role="group" aria-label="Input unit">
          {(['C', 'K', 'F'] as const).map(u => <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}>{u === 'K' ? 'K' : `°${u}`}</button>)}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {([['Kelvin', 'K', k], ['Celsius', '°C', k != null ? k - 273.15 : null], ['Fahrenheit', '°F', k != null ? (k - 273.15) * 9 / 5 + 32 : null]] as const).map(([label, sym, v]) => (
          <div key={label} className="stat">
            <div className="stat-label">{label}</div>
            <div className="stat-value !text-[15px]">{v != null && !below ? `${fmt(v)} ${sym}` : '—'}</div>
          </div>
        ))}
      </div>
      {below && <p className="mt-3 text-[13px] text-[var(--danger)]">Nothing can be colder than absolute zero (0 K).</p>}
    </section>
  )
}
