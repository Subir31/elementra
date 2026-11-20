import { describe, expect, it } from 'vitest'
import { calculateMolarMass, normalizeFormula, prettyFormula } from './chemistry'

describe('calculateMolarMass', () => {
  it('calculates a simple formula', () => {
    const result = calculateMolarMass('H2O')

    expect(result.molarMass).toBeCloseTo(18.015, 3)
    expect(result.breakdown).toEqual([
      expect.objectContaining({ symbol: 'H', count: 2 }),
      expect.objectContaining({ symbol: 'O', count: 1 }),
    ])
  })

  it('supports nested groups and combines repeated elements', () => {
    const result = calculateMolarMass('Al2(SO4)3')

    expect(result.molarMass).toBeCloseTo(342.131, 3)
    expect(result.breakdown).toEqual([
      expect.objectContaining({ symbol: 'Al', count: 2 }),
      expect.objectContaining({ symbol: 'S', count: 3 }),
      expect.objectContaining({ symbol: 'O', count: 12 }),
    ])
  })

  it('accepts Unicode subscripts', () => {
    expect(calculateMolarMass('H₂SO₄').molarMass).toBeCloseTo(calculateMolarMass('H2SO4').molarMass, 6)
  })

  it('supports hydrates with a dot separator and coefficient', () => {
    const result = calculateMolarMass('CuSO4·5H2O')

    expect(result.molarMass).toBeCloseTo(249.68, 1)
    expect(result.breakdown).toEqual([
      expect.objectContaining({ symbol: 'Cu', count: 1 }),
      expect.objectContaining({ symbol: 'S', count: 1 }),
      expect.objectContaining({ symbol: 'O', count: 9 }),
      expect.objectContaining({ symbol: 'H', count: 10 }),
    ])
    expect(calculateMolarMass('CuSO4*5H2O').molarMass).toBeCloseTo(result.molarMass, 6)
  })

  it('reports each element’s share of the mass', () => {
    const { breakdown } = calculateMolarMass('NaCl')
    const total = breakdown.reduce((sum, item) => sum + item.fraction, 0)

    expect(total).toBeCloseTo(1, 6)
    expect(breakdown[1].fraction).toBeGreaterThan(breakdown[0].fraction)
  })

  it('rejects malformed and unknown formulas', () => {
    expect(() => calculateMolarMass('Ca(OH2')).toThrow('closing')
    expect(() => calculateMolarMass('Xx2')).toThrow('Unknown element symbol')
    expect(() => calculateMolarMass('H0')).toThrow('Multipliers')
    expect(() => calculateMolarMass('h2o')).toThrow('capital letter')
    expect(() => calculateMolarMass('CuSO4·')).toThrow('empty part')
  })
})

describe('formula formatting', () => {
  it('normalizes pasted formulas', () => {
    expect(normalizeFormula('CuSO₄ • 5H₂O')).toBe('CuSO4·5H2O')
  })

  it('renders subscripts but keeps hydrate coefficients', () => {
    expect(prettyFormula('CuSO4.5H2O')).toBe('CuSO₄·5H₂O')
    expect(prettyFormula('Ca(OH)2')).toBe('Ca(OH)₂')
  })
})
