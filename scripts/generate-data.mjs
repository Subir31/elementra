// Generates src/data/elements.data.json — a trimmed dataset containing only the
// fields Elementra renders. The source packages hold ~700 KB of JSON; the app
// needs a fraction of that, so trimming keeps the single-file build small and
// fast on mobile connections.
//
// Usage: npm run data

import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const base = JSON.parse(readFileSync(require.resolve('node-periodic-table/elements.json'), 'utf8'))
const extra = JSON.parse(readFileSync(require.resolve('periodic-table-data-complete/pTable.json'), 'utf8'))
const extraByZ = new Map(extra.map(e => [e.atomic_number, e]))

const clean = s => (typeof s === 'string' ? s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '') || null
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null)

// True when the symbol can be read straight out of the English name (Al in
// Aluminium, Nb in Niobium). Historical names only matter when it cannot.
function symbolFromName(symbol, name) {
  const s = symbol.toLowerCase()
  const n = name.toLowerCase()
  if (n[0] !== s[0]) return false
  let at = 1
  for (const ch of s.slice(1)) {
    at = n.indexOf(ch, at)
    if (at === -1) return false
    at += 1
  }
  return true
}

// Discoverer fields sometimes hold dates or regions instead of people.
function person(value) {
  const s = clean(value)
  return s && !/\d/.test(s) && !/^(middle east|ancient|unknown|prehistoric)/i.test(s) ? s : null
}

const out = base
  .filter(e => e.number >= 1 && e.number <= 118)
  .sort((a, b) => a.number - b.number)
  .map(e => {
    const x = extraByZ.get(e.number) ?? {}
    const radius = x.radius ?? {}
    const latin = typeof x.alternate_names === 'string' ? x.alternate_names : null
    return {
      z: e.number,
      symbol: e.symbol,
      name: e.name,
      mass: e.atomic_mass,
      xpos: e.xpos,
      ypos: e.ypos,
      period: e.period,
      phase: e.phase,
      melt: num(e.melt),
      boil: num(e.boil),
      density: num(e.density),
      electronegativity: num(e.electronegativity_pauling),
      ionization: num(e.ionization_energies?.[0]),
      electronAffinity: num(e.electron_affinity),
      radius: num(radius.calculated) ?? num(radius.empirical),
      shells: Array.isArray(e.shells) ? e.shells : [],
      config: e.electron_configuration,
      configShort: e.electron_configuration_semantic,
      summary: clean(e.summary),
      appearance: clean(e.appearance),
      discoveredBy: person(e.discovered_by) ?? person(x.discovered?.by),
      discoveryYear: num(x.discovered?.year),
      discoveryPlace: clean(x.discovered?.location),
      // Only keep historical names that explain the symbol (Fe from Ferrum),
      // not spelling variants such as Aluminium or Sulphur.
      latinName: latin && !symbolFromName(e.symbol, e.name) ? latin : null,
      oxidationStates: typeof x.oxidation_states === 'string' ? x.oxidation_states.replace(/c/g, '') : null,
      valence: num(x.valence_electrons),
      radioactive: typeof x.half_life === 'number',
      source: e.source,
    }
  })

if (out.length !== 118) throw new Error(`Expected 118 elements, got ${out.length}`)

const target = resolve(root, 'src/data/elements.data.json')
writeFileSync(target, JSON.stringify(out) + '\n')
console.log(`Wrote ${out.length} elements (${(JSON.stringify(out).length / 1024).toFixed(1)} KB) to ${target}`)
