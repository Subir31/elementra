import { describe, expect, it } from 'vitest'
import { calculateMolarMass } from './chemistry'

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

  it('rejects malformed and unknown formulas', () => {
    expect(() => calculateMolarMass('Ca(OH2')).toThrow('closing')
    expect(() => calculateMolarMass('Xx2')).toThrow('Unknown element symbol')
    expect(() => calculateMolarMass('H0')).toThrow('Multipliers')
  })
})
