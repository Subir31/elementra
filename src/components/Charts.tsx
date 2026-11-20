import { useId, useState } from 'react'
import { ELEMENTS, PROPERTY_META, formatNumber, getPropertyRange, getPropertyValue, getRadarData, type Element, type PropertyKey } from '../data/elements'

/* ── Bohr model with orbiting electrons ── */
export function Bohr({ shells, color, size = 200 }: { shells: number[]; color: string; size?: number }) {
  const maxR = 88
  const n = shells.length
  const gradientId = useId()
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className="max-w-full" role="img"
      aria-label={`Electron shells: ${shells.join(', ')}`}>
      <defs>
        <radialGradient id={gradientId}>
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="20" fill={`url(#${gradientId})`} />
      <circle cx="100" cy="100" r="7" fill={color} />
      {shells.map((count, i) => {
        const r = 22 + (maxR - 22) * ((i + 1) / Math.max(1, n))
        return (
          <g key={i}>
            <circle cx="100" cy="100" r={r} fill="none" stroke="var(--border-2)" strokeWidth="1" />
            <g className="orbit" style={{ '--orbit-speed': `${10 + i * 6}s`, animationDirection: i % 2 ? 'reverse' : 'normal' } as React.CSSProperties}>
              {Array.from({ length: count }, (_, j) => {
                const a = (j / count) * Math.PI * 2 - Math.PI / 2
                return <circle key={j} cx={100 + r * Math.cos(a)} cy={100 + r * Math.sin(a)} r={count > 20 ? 2.2 : 3} fill={color} />
              })}
            </g>
          </g>
        )
      })}
    </svg>
  )
}

/* ── Property fingerprint radar ── */
export function Radar({ el, color }: { el: Element; color: string }) {
  const data = getRadarData(el)
  const [active, setActive] = useState<number | null>(null)
  const size = 260
  const c = size / 2
  const R = 86
  const n = data.length
  const ang = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2
  const pt = (i: number, r: number) => ({ x: c + Math.cos(ang(i)) * R * r, y: c + Math.sin(ang(i)) * R * r })
  const poly = (vals: number[]) => vals.map((v, i) => { const p = pt(i, Math.max(0.04, v)); return `${p.x.toFixed(1)},${p.y.toFixed(1)}` }).join(' ')

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[260px]" role="img" aria-label={`Property fingerprint for ${el.name} compared with the average element`}>
        {[0.25, 0.5, 0.75, 1].map(r => (
          <polygon key={r} points={data.map((_, i) => { const p = pt(i, r); return `${p.x},${p.y}` }).join(' ')}
            fill="none" stroke="var(--border-2)" strokeWidth={r === 1 ? 1.2 : 0.7} />
        ))}
        {data.map((_, i) => { const p = pt(i, 1); return <line key={i} x1={c} y1={c} x2={p.x} y2={p.y} stroke="var(--border)" /> })}
        <polygon points={poly(data.map(d => d.avg))} fill="var(--text-4)" fillOpacity="0.12" stroke="var(--text-4)" strokeWidth="1.2" strokeDasharray="3 3" />
        <polygon points={poly(data.map(d => d.value))} fill={color} fillOpacity="0.22" stroke={color} strokeWidth="2.2" strokeLinejoin="round"
          style={{ transformOrigin: 'center', animation: 'popIn .6s var(--ease-out) both' }} />
        {data.map((d, i) => {
          const p = pt(i, Math.max(0.04, d.value))
          return <circle key={d.key} cx={p.x} cy={p.y} r={active === i ? 5.5 : 3.5} fill={color} stroke="var(--surface-solid)" strokeWidth="2" />
        })}
        {data.map((d, i) => {
          const p = pt(i, 1.24)
          const cos = Math.cos(ang(i))
          return (
            <text key={d.key} x={p.x} y={p.y} textAnchor={Math.abs(cos) < 0.3 ? 'middle' : cos > 0 ? 'start' : 'end'} dominantBaseline="middle"
              fontSize="10" fontWeight="700" fontFamily="var(--font-mono)" fill={active === i ? color : 'var(--text-3)'}>
              {d.short}
            </text>
          )
        })}
      </svg>
      <div className="grid w-full grid-cols-3 gap-2">
        {data.map((d, i) => (
          <button key={d.key} type="button" className="stat text-left transition-colors"
            style={active === i ? { borderColor: color } : undefined}
            onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
            <div className="stat-label">{d.short}</div>
            <div className="stat-value !text-[12px]">{d.raw != null ? formatNumber(d.raw, PROPERTY_META[d.key].digits) : '—'}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── Property across the table (sparkline by atomic number) ── */
export function TrendLine({ property, highlight }: { property: PropertyKey; highlight?: number }) {
  const { min, max } = getPropertyRange(property)
  const W = 320
  const H = 90
  const P = 6
  const x = (z: number) => P + ((z - 1) / 117) * (W - P * 2)
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - P * 2)
  const segments: string[][] = []
  let current: string[] = []
  for (const e of ELEMENTS) {
    const v = getPropertyValue(e, property)
    if (v == null) { if (current.length > 1) segments.push(current); current = []; continue }
    current.push(`${x(e.atomicNumber).toFixed(1)},${y(v).toFixed(1)}`)
  }
  if (current.length > 1) segments.push(current)
  const hv = highlight ? getPropertyValue(ELEMENTS[highlight - 1], property) : null

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[90px] w-full" role="img" aria-label={`${PROPERTY_META[property].label} by atomic number`}>
      <defs>
        <linearGradient id="trend-line" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="50%" stopColor="var(--accent-2)" />
          <stop offset="100%" stopColor="var(--accent-3)" />
        </linearGradient>
      </defs>
      {[1, 3, 11, 19, 37, 55, 87].map(z => (
        <line key={z} x1={x(z)} x2={x(z)} y1={P} y2={H - P} stroke="var(--border)" strokeDasharray="2 3" />
      ))}
      {segments.map((s, i) => (
        <path key={i} d={`M ${s.join(' L ')}`} fill="none" stroke="url(#trend-line)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {highlight && hv != null && <circle cx={x(highlight)} cy={y(hv)} r="4.5" fill="var(--text)" stroke="var(--surface-solid)" strokeWidth="2" />}
    </svg>
  )
}

/* ── Progress ring ── */
export function Ring({ value, size = 64, stroke = 7, color = 'var(--accent)', children }: {
  value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ring-track" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.max(0, Math.min(1, value)))}
          style={{ transition: 'stroke-dashoffset 1s var(--ease-out)' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
