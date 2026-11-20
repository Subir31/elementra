import { formatNumber } from '../data/elements'

const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

/** "[Ar] 3d6 4s2" → "[Ar] 3d⁶ 4s²" */
export function prettyConfig(config: string): string {
  return config.replace(/([spdf])(\d+)/g, (_, orbital: string, n: string) =>
    orbital + n.split('').map(d => SUPERSCRIPTS[Number(d)]).join(''),
  )
}

export function kelvinToCelsius(k: number): number {
  return k - 273.15
}

export function kelvinToFahrenheit(k: number): number {
  return (k - 273.15) * 9 / 5 + 32
}

/** "1811 K · 1538 °C" */
export function formatTemperature(k: number | null): string {
  if (k == null) return '—'
  return `${formatNumber(k, 0)} K · ${formatNumber(kelvinToCelsius(k), 0)} °C`
}

export function formatDensity(d: number | null): string {
  if (d == null) return '—'
  if (d < 0.01) return `${d.toExponential(2).replace('e', '×10^')} g/cm³`.replace(/\^(-?\d+)/, (_, e: string) => toSuperscript(e))
  return `${formatNumber(d, 3)} g/cm³`
}

function toSuperscript(n: string): string {
  return n.split('').map(ch => (ch === '-' ? '⁻' : SUPERSCRIPTS[Number(ch)] ?? ch)).join('')
}

export function formatDiscovery(year: number | null, by: string | null): string {
  if (year == null) return by ?? 'Known since ancient times'
  const when = year < 0 ? `c. ${formatNumber(-year, 0)} BC` : String(year)
  return by ? `${when} · ${by}` : when
}

export function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
