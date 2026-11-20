import { ELEMENT_BY_SYMBOL } from '../data/elements'

export interface FormulaBreakdown {
  symbol: string
  count: number
  atomicMass: number
  subtotal: number
  /** Share of the total molar mass, 0..1. */
  fraction: number
}

export interface FormulaResult {
  formula: string
  molarMass: number
  breakdown: FormulaBreakdown[]
}

const MAX_FORMULA_LENGTH = 80
const MAX_NESTING_DEPTH = 10
const MAX_MULTIPLIER = 10_000
const MAX_TOTAL_ATOMS = 1_000_000

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉'
const HYDRATE_DOTS = /[·•⋅∙*.]/

/** Converts typed or pasted formulas (H₂O, CuSO4 • 5H2O) to the parser's ASCII form. */
export function normalizeFormula(input: string): string {
  return input
    .replace(/[₀-₉]/g, ch => String(SUBSCRIPTS.indexOf(ch)))
    .replace(/\s+/g, '')
    .replace(/[·•⋅∙*.]/g, '·')
}

/** Renders a formula with Unicode subscripts, e.g. H2SO4 → H₂SO₄ (hydrate coefficients stay full size). */
export function prettyFormula(formula: string): string {
  return normalizeFormula(formula)
    .split('·')
    .map(part => {
      const coeff = part.match(/^\d+/)?.[0] ?? ''
      return coeff + part.slice(coeff.length).replace(/\d/g, d => SUBSCRIPTS[Number(d)])
    })
    .join('·')
}

function readMultiplier(formula: string, position: number): { value: number; position: number } {
  let end = position
  while (end < formula.length && /\d/.test(formula[end])) end += 1
  if (end === position) return { value: 1, position }

  const value = Number(formula.slice(position, end))
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_MULTIPLIER) {
    throw new Error(`Multipliers must be between 1 and ${MAX_MULTIPLIER.toLocaleString()}.`)
  }
  return { value, position: end }
}

function mergeCounts(target: Map<string, number>, source: Map<string, number>, multiplier: number) {
  for (const [symbol, count] of source) {
    const next = (target.get(symbol) ?? 0) + count * multiplier
    if (next > MAX_TOTAL_ATOMS) throw new Error('Formula contains too many atoms.')
    target.set(symbol, next)
  }
}

function parseGroup(
  formula: string,
  start: number,
  closingToken: ')' | ']' | null,
  depth: number,
): { counts: Map<string, number>; position: number } {
  if (depth > MAX_NESTING_DEPTH) throw new Error('Formula nesting is too deep.')

  const counts = new Map<string, number>()
  let position = start
  let parsedTerm = false

  while (position < formula.length) {
    const token = formula[position]

    if (token === ')' || token === ']') {
      if (token !== closingToken) throw new Error('Formula contains mismatched brackets.')
      if (!parsedTerm) throw new Error('Formula contains an empty group.')
      return { counts, position: position + 1 }
    }

    if (token === '(' || token === '[') {
      const expectedClose = token === '(' ? ')' : ']'
      const group = parseGroup(formula, position + 1, expectedClose, depth + 1)
      const multiplier = readMultiplier(formula, group.position)
      mergeCounts(counts, group.counts, multiplier.value)
      position = multiplier.position
      parsedTerm = true
      continue
    }

    if (/[A-Z]/.test(token)) {
      let end = position + 1
      if (end < formula.length && /[a-z]/.test(formula[end])) end += 1
      const symbol = formula.slice(position, end)
      if (!ELEMENT_BY_SYMBOL.has(symbol)) {
        const hint = /^[a-z]/.test(formula[position + 1] ?? '') ? '' : ' Symbols start with a capital letter.'
        throw new Error(`Unknown element symbol: ${symbol}.${hint}`)
      }

      const multiplier = readMultiplier(formula, end)
      mergeCounts(counts, new Map([[symbol, 1]]), multiplier.value)
      position = multiplier.position
      parsedTerm = true
      continue
    }

    if (/[a-z]/.test(token)) {
      throw new Error(`Element symbols start with a capital letter — did you mean "${token.toUpperCase()}"?`)
    }
    throw new Error(`Unexpected character "${token}" at position ${position + 1}.`)
  }

  if (closingToken) throw new Error(`Formula is missing a closing "${closingToken}".`)
  if (!parsedTerm) throw new Error('Enter a chemical formula.')
  return { counts, position }
}

export function calculateMolarMass(input: string): FormulaResult {
  const formula = normalizeFormula(input.trim())
  if (!formula) throw new Error('Enter a chemical formula.')
  if (formula.length > MAX_FORMULA_LENGTH) throw new Error(`Formula must be ${MAX_FORMULA_LENGTH} characters or fewer.`)

  // Hydrates and adducts: CuSO4·5H2O → CuSO4 + 5 × H2O
  const totals = new Map<string, number>()
  for (const part of formula.split(HYDRATE_DOTS)) {
    if (!part) throw new Error('Formula has an empty part around “·”.')
    const coefficient = readMultiplier(part, 0)
    const body = part.slice(coefficient.position)
    if (!body) throw new Error('A coefficient must be followed by a formula.')
    const parsed = parseGroup(body, 0, null, 0)
    if (parsed.position !== body.length) throw new Error('Formula could not be parsed.')
    mergeCounts(totals, parsed.counts, coefficient.value)
  }

  const items = Array.from(totals, ([symbol, count]) => {
    const element = ELEMENT_BY_SYMBOL.get(symbol)
    if (!element) throw new Error(`Unknown element symbol: ${symbol}.`)
    return { symbol, count, atomicMass: element.atomicMass, subtotal: element.atomicMass * count }
  })
  const molarMass = items.reduce((sum, item) => sum + item.subtotal, 0)

  return {
    formula,
    molarMass,
    breakdown: items.map(item => ({ ...item, fraction: molarMass > 0 ? item.subtotal / molarMass : 0 })),
  }
}
