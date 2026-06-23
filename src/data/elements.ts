// Elementra – Periodic Table Data
// Base: Bowserinator / node-periodic-table (118 elements)
// Enriched with discovery years from periodic-table-data-complete

import rawElements from 'node-periodic-table/elements.json'
import pTableRaw from 'periodic-table-data-complete/pTable.json'

type PTableEl = {
  atomic_number: number
  discovered?: { year?: number, by?: string }
  appearance?: string
  summary?: string
}

type RawElement = {
  name: string
  appearance?: string | null
  atomic_mass: number
  boil?: number | null
  density?: number | null
  discovered_by?: string | null
  melt?: number | null
  number: number
  period: number
  phase?: string
  source: string
  summary?: string
  symbol: string
  xpos: number
  ypos: number
  shells?: number[]
  electron_configuration: string
  electron_configuration_semantic: string
  electronegativity_pauling?: number | null
  ionization_energies?: number[]
}

const pTable = pTableRaw as PTableEl[]
const pTableByZ = new Map(pTable.map(e => [e.atomic_number, e]))

export type CategoryKey =
  | 'alkali-metal'
  | 'alkaline-earth-metal'
  | 'transition-metal'
  | 'post-transition-metal'
  | 'metalloid'
  | 'reactive-nonmetal'
  | 'halogen'
  | 'noble-gas'
  | 'lanthanide'
  | 'actinide'
  | 'unknown'

export interface Element {
  atomicNumber: number
  symbol: string
  name: string
  atomicMass: number
  category: string
  categoryKey: CategoryKey
  group: number | null
  period: number
  block: 's'|'p'|'d'|'f'
  electronConfiguration: string
  electronConfigurationSemantic: string
  state: 'Solid' | 'Liquid' | 'Gas'
  meltingPointK: number | null
  boilingPointK: number | null
  meltingPointC: number | null
  boilingPointC: number | null
  density: number | null
  discoveredBy: string | null
  discoveryYear: number | null
  description: string
  funFact: string
  summary: string
  shells: number[]
  electronegativity: number | null
  ionizationEnergy: number | null
  appearance: string | null
  xpos: number
  ypos: number
  source: string
}

function cleanText(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function categorize(z: number, xpos: number): CategoryKey {
  if (z >= 57 && z <= 71) return 'lanthanide'
  if (z >= 89 && z <= 103) return 'actinide'
  if (xpos === 1) return z === 1 ? 'reactive-nonmetal' : 'alkali-metal'
  if (xpos === 2) return 'alkaline-earth-metal'
  if (xpos >= 3 && xpos <= 12) return 'transition-metal'
  if (xpos === 17) return 'halogen'
  if (xpos === 18) return 'noble-gas'
  // p-block classification
  const metalloids = new Set([5,14,32,33,51,52,84])
  if (metalloids.has(z)) return 'metalloid'
  const postTransition = new Set([13,31,49,50,81,82,83,113,114,115,116])
  if (postTransition.has(z)) return 'post-transition-metal'
  const reactiveNonmetals = new Set([1,6,7,8,15,16,34])
  if (reactiveNonmetals.has(z)) return 'reactive-nonmetal'
  // Halogens already handled via group, but At/Ts fallback
  if ([9,17,35,53,85,117].includes(z)) return 'halogen'
  // Noble gases already handled
  if ([2,10,18,36,54,86,118].includes(z)) return 'noble-gas'
  return 'unknown'
}

function getBlock(group: number | null, categoryKey: CategoryKey): 's'|'p'|'d'|'f' {
  if (categoryKey === 'lanthanide' || categoryKey === 'actinide') return 'f'
  if (group == null) return 'f'
  if (group <= 2) return 's'
  if (group >= 13) return 'p'
  return 'd'
}

function normalizeDensity(density: number | null, phase: string | undefined): number | null {
  if (density == null) return null
  // node-periodic-table stores gases in g/L and condensed matter in g/cm3.
  return phase === 'Gas' ? density / 1000 : density
}

const FUN_FACTS: Record<number, string> = {
  1: "Hydrogen is the most abundant element in the universe, making up ~75% of all normal matter.",
  2: "Helium was first detected in the Sun before it was found on Earth.",
  3: "Lithium batteries power most modern phones and EVs.",
  6: "Carbon forms more compounds than any other element.",
  7: "The air you breathe is 78% nitrogen.",
  8: "Oxygen was independently discovered by Scheele and Priestley.",
  11: "Sodium metal ignites explosively in water.",
  13: "Aluminium is the most abundant metal in Earth's crust.",
  26: "Iron makes up most of Earth's core.",
  29: "Copper has been used by humans for over 10,000 years.",
  47: "Silver has the highest electrical conductivity of any element.",
  79: "Gold is chemically inert — it never tarnishes.",
  80: "Mercury is the only metal that is liquid at room temperature.",
  82: "Lead was used in Roman water pipes — the symbol Pb comes from 'plumbum'.",
  92: "A single golf-ball-sized piece of uranium contains as much energy as ~1 tonne of coal.",
  94: "Plutonium-239 was used in the first atomic bombs.",
}

function makeFunFact(el: {
  atomicNumber:number; name:string; categoryKey:CategoryKey;
  density:number|null; electronegativity:number|null;
  discoveredBy:string|null; discoveryYear:number|null;
  appearance: string | null;
  meltingPointC:number|null;
  boilingPointC:number|null;
}): string {
  const pre = FUN_FACTS[el.atomicNumber]
  if (pre) return pre
  if (el.appearance) return `${el.appearance.charAt(0).toUpperCase()}${el.appearance.slice(1)}.`
  if (el.discoveryYear) return `Discovered in ${el.discoveryYear}${el.discoveredBy ? ` by ${el.discoveredBy}` : ''}.`
  if (el.density != null) return `Density ${el.density} g/cm³ — ${el.name} is a ${el.categoryKey.replace(/-/g,' ')}.`
  if (el.electronegativity != null) return `Electronegativity ${el.electronegativity.toFixed(2)} on the Pauling scale.`
  return `Electron configuration ${el.atomicNumber === 1 ? '1s¹' : 'follows the Aufbau principle'}.`
}

export const ELEMENTS: Element[] = (rawElements as RawElement[]).map((e) => {
  const z = e.number as number
  const p = pTableByZ.get(z)
  const xpos = e.xpos
  const ypos = e.ypos
  const categoryKey = categorize(z, xpos)
  const group = categoryKey === 'lanthanide' || categoryKey === 'actinide' ? null : xpos
  const period = e.period
  const categoryLabelMap: Record<CategoryKey,string> = {
    'alkali-metal': 'Alkali metal',
    'alkaline-earth-metal': 'Alkaline earth metal',
    'transition-metal': 'Transition metal',
    'post-transition-metal': 'Post-transition metal',
    'metalloid': 'Metalloid',
    'reactive-nonmetal': 'Reactive nonmetal',
    'halogen': 'Halogen',
    'noble-gas': 'Noble gas',
    'lanthanide': 'Lanthanide',
    'actinide': 'Actinide',
    'unknown': 'Unknown properties',
  }
  const meltK = e.melt ?? null
  const boilK = e.boil ?? null
  const meltC = meltK != null ? +(meltK - 273.15).toFixed(2) : null
  const boilC = boilK != null ? +(boilK - 273.15).toFixed(2) : null
  const discoveryYear = p?.discovered?.year ?? null
  const discoveredBy = e.discovered_by ?? p?.discovered?.by ?? null
  const density = normalizeDensity(e.density ?? null, e.phase)
  const summaryClean = cleanText(e.summary ?? '')
  const description = summaryClean.slice(0, 440) + (summaryClean.length > 440 ? '…' : '')
  const block = getBlock(group, categoryKey)

  const funFact = makeFunFact({
    atomicNumber: z,
    name: e.name,
    categoryKey,
    density,
    electronegativity: e.electronegativity_pauling ?? null,
    discoveredBy,
    discoveryYear,
    appearance: e.appearance ?? null,
    meltingPointC: meltC,
    boilingPointC: boilC,
  })

  return {
    atomicNumber: z,
    symbol: e.symbol,
    name: e.name,
    atomicMass: e.atomic_mass,
    category: categoryLabelMap[categoryKey],
    categoryKey,
    group,
    period,
    block,
    electronConfiguration: e.electron_configuration,
    electronConfigurationSemantic: e.electron_configuration_semantic,
    state: (e.phase === 'Gas' || e.phase === 'Liquid' || e.phase === 'Solid') ? e.phase : 'Solid',
    meltingPointK: meltK,
    boilingPointK: boilK,
    meltingPointC: meltC,
    boilingPointC: boilC,
    density,
    discoveredBy,
    discoveryYear,
    description,
    funFact,
    summary: summaryClean,
    shells: e.shells ?? [],
    electronegativity: e.electronegativity_pauling ?? null,
    ionizationEnergy: (e.ionization_energies && e.ionization_energies[0]) ?? null,
    appearance: e.appearance ?? null,
    xpos,
    ypos,
    source: e.source,
  }
})

export const CATEGORY_META: Record<CategoryKey, { label: string; color: string; bgSoft: string; }> = {
  'alkali-metal':        { label: 'Alkali metal',         color: '#ff5c6c', bgSoft: 'rgba(255,92,108,0.11)' },
  'alkaline-earth-metal':{ label: 'Alkaline earth metal', color: '#ffae3a', bgSoft: 'rgba(255,174,58,0.11)' },
  'transition-metal':    { label: 'Transition metal',     color: '#4ea8ff', bgSoft: 'rgba(78,168,255,0.11)' },
  'post-transition-metal':{ label: 'Post-transition metal', color: '#34d399', bgSoft: 'rgba(52,211,153,0.12)' },
  'metalloid':           { label: 'Metalloid',            color: '#2ee6c6', bgSoft: 'rgba(46,230,198,0.12)' },
  'reactive-nonmetal':   { label: 'Reactive nonmetal',    color: '#a78bfa', bgSoft: 'rgba(167,139,250,0.12)' },
  'halogen':             { label: 'Halogen',              color: '#facc15', bgSoft: 'rgba(250,204,21,0.11)' },
  'noble-gas':           { label: 'Noble gas',            color: '#f472b6', bgSoft: 'rgba(244,114,182,0.13)' },
  'lanthanide':          { label: 'Lanthanide',           color: '#22d3ee', bgSoft: 'rgba(34,211,238,0.11)' },
  'actinide':            { label: 'Actinide',             color: '#fb923c', bgSoft: 'rgba(251,146,60,0.12)' },
  'unknown':             { label: 'Unknown properties',   color: '#94a3b8', bgSoft: 'rgba(148,163,184,0.11)' },
}

export const CATEGORY_ORDER: CategoryKey[] = [
  'alkali-metal',
  'alkaline-earth-metal',
  'transition-metal',
  'post-transition-metal',
  'metalloid',
  'reactive-nonmetal',
  'halogen',
  'noble-gas',
  'lanthanide',
  'actinide',
  'unknown',
]

export function formatNumber(n: number | null, digits = 3): string {
  if (n == null || Number.isNaN(n)) return '—'
  return Number(n.toFixed(digits)).toString()
}

/* ── Heatmap / property trend helpers ── */
export type PropertyKey = 'atomicMass' | 'electronegativity' | 'meltingPointK' | 'boilingPointK' | 'density' | 'ionizationEnergy'

export const PROPERTY_META: Record<PropertyKey, { label: string; unit: string; icon: string }> = {
  atomicMass:        { label: 'Atomic Mass',       unit: 'u',      icon: '⚖️' },
  electronegativity: { label: 'Electronegativity', unit: '',       icon: '🧲' },
  meltingPointK:     { label: 'Melting Point',     unit: 'K',      icon: '❄️' },
  boilingPointK:     { label: 'Boiling Point',     unit: 'K',      icon: '🔥' },
  density:           { label: 'Density',           unit: 'g/cm³',  icon: '🪨' },
  ionizationEnergy:  { label: 'Ionization Energy', unit: 'kJ/mol', icon: '⚡' },
}

const propertyRangeCache = new Map<PropertyKey, { min: number; max: number }>()
const globalAverageCache = new Map<PropertyKey, number>()

export function getPropertyValue(el: Element, key: PropertyKey): number | null {
  return el[key] as number | null
}

export function getPropertyRange(key: PropertyKey): { min: number; max: number } {
  const cached = propertyRangeCache.get(key)
  if (cached) return cached

  const vals = ELEMENTS.map(e => getPropertyValue(e, key)).filter((v): v is number => v != null && !Number.isNaN(v))
  const range = vals.length > 0
    ? { min: Math.min(...vals), max: Math.max(...vals) }
    : { min: 0, max: 1 }

  propertyRangeCache.set(key, range)
  return range
}

/** Returns a heatmap color (cool→warm) for a normalized 0..1 value */
export function heatColor(t: number): string {
  // viridis-like: deep blue → teal → green → yellow
  const stops = [
    [13, 22, 60],     // deep navy
    [33, 80, 140],    // blue
    [30, 150, 140],   // teal
    [90, 200, 110],   // green
    [240, 210, 90],   // yellow
    [250, 140, 60],   // orange
  ]
  const clamped = Math.max(0, Math.min(1, t))
  const seg = clamped * (stops.length - 1)
  const i = Math.floor(seg)
  const f = seg - i
  const a = stops[i]
  const b = stops[Math.min(stops.length - 1, i + 1)]
  const r = Math.round(a[0] + (b[0] - a[0]) * f)
  const g = Math.round(a[1] + (b[1] - a[1]) * f)
  const bl = Math.round(a[2] + (b[2] - a[2]) * f)
  return `rgb(${r}, ${g}, ${bl})`
}

/** State of an element at a given temperature (K) */
export function stateAtTemperature(el: Element, tempK: number): 'Solid' | 'Liquid' | 'Gas' | 'Unknown' {
  const mp = el.meltingPointK
  const bp = el.boilingPointK
  if (mp == null && bp == null) return 'Unknown'
  if (mp != null && tempK < mp) return 'Solid'
  if (bp != null && tempK >= bp) return 'Gas'
  if (mp != null && bp != null && tempK >= mp && tempK < bp) return 'Liquid'
  // partial data fallbacks
  if (mp != null && bp == null) return tempK < mp ? 'Solid' : 'Liquid'
  if (mp == null && bp != null) return tempK >= bp ? 'Gas' : 'Liquid'
  return 'Unknown'
}

/* ── Radar / Spider chart helpers ── */
export const RADAR_AXES: { key: PropertyKey; label: string; short: string }[] = [
  { key: 'atomicMass',        label: 'Atomic Mass',       short: 'Mass' },
  { key: 'electronegativity', label: 'Electronegativity', short: 'E-Neg' },
  { key: 'ionizationEnergy',  label: 'Ionization Energy', short: 'Ioniz.' },
  { key: 'density',           label: 'Density',           short: 'Density' },
  { key: 'meltingPointK',     label: 'Melting Point',     short: 'Melt' },
  { key: 'boilingPointK',     label: 'Boiling Point',     short: 'Boil' },
]

/** Returns a 0..1 range-normalized value for an element's property (log-friendly). */
export function normalizedProperty(el: Element, key: PropertyKey): number {
  const v = getPropertyValue(el, key)
  if (v == null || Number.isNaN(v)) return 0
  const { min, max } = getPropertyRange(key)
  if (max === min) return 0.5
  // log scaling for highly-skewed properties (density, ionization, points)
  const useLog = key === 'density' || key === 'meltingPointK' || key === 'boilingPointK' || key === 'ionizationEnergy'
  if (useLog) {
    const lv = Math.log10(Math.max(v, 0.0001))
    const lmin = Math.log10(Math.max(min, 0.0001))
    const lmax = Math.log10(Math.max(max, 0.0001))
    return (lv - lmin) / (lmax - lmin || 1)
  }
  return (v - min) / (max - min)
}

/** Average normalized value across elements that have data for the property. */
export function globalAverageNormalized(key: PropertyKey): number {
  const cached = globalAverageCache.get(key)
  if (cached != null) return cached

  const vals = ELEMENTS
    .filter(e => getPropertyValue(e, key) != null)
    .map(e => normalizedProperty(e, key))
  const average = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0

  globalAverageCache.set(key, average)
  return average
}

export interface RadarPoint { key: PropertyKey; label: string; short: string; value: number; avg: number; raw: number | null }

export function getRadarData(el: Element): RadarPoint[] {
  return RADAR_AXES.map(a => ({
    key: a.key,
    label: a.label,
    short: a.short,
    value: normalizedProperty(el, a.key),
    avg: globalAverageNormalized(a.key),
    raw: getPropertyValue(el, a.key),
  }))
}
