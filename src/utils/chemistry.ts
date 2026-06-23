import { ELEMENTS } from '../data/elements'

export interface FormulaBreakdown {
  symbol: string
  count: number
  atomicMass: number
  subtotal: number
}

export interface FormulaResult {
  formula: string
  molarMass: number
  breakdown: FormulaBreakdown[]
}

const ELEMENT_BY_SYMBOL = new Map(ELEMENTS.map(element => [element.symbol, element]))
const MAX_FORMULA_LENGTH = 80
const MAX_NESTING_DEPTH = 10
const MAX_MULTIPLIER = 10_000
const MAX_TOTAL_ATOMS = 1_000_000

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
      if (!ELEMENT_BY_SYMBOL.has(symbol)) throw new Error(`Unknown element symbol: ${symbol}.`)

      const multiplier = readMultiplier(formula, end)
      mergeCounts(counts, new Map([[symbol, 1]]), multiplier.value)
      position = multiplier.position
      parsedTerm = true
      continue
    }

    throw new Error(`Unexpected character "${token}" at position ${position + 1}.`)
  }

  if (closingToken) throw new Error(`Formula is missing a closing "${closingToken}".`)
  if (!parsedTerm) throw new Error('Enter a chemical formula.')
  return { counts, position }
}

export function calculateMolarMass(input: string): FormulaResult {
  const formula = input.trim().replace(/\s+/g, '')
  if (!formula) throw new Error('Enter a chemical formula.')
  if (formula.length > MAX_FORMULA_LENGTH) throw new Error(`Formula must be ${MAX_FORMULA_LENGTH} characters or fewer.`)

  const parsed = parseGroup(formula, 0, null, 0)
  if (parsed.position !== formula.length) throw new Error('Formula could not be parsed.')

  const breakdown = Array.from(parsed.counts, ([symbol, count]) => {
    const element = ELEMENT_BY_SYMBOL.get(symbol)
    if (!element) throw new Error(`Unknown element symbol: ${symbol}.`)
    return {
      symbol,
      count,
      atomicMass: element.atomicMass,
      subtotal: element.atomicMass * count,
    }
  })

  return {
    formula,
    molarMass: breakdown.reduce((sum, item) => sum + item.subtotal, 0),
    breakdown,
  }
}
