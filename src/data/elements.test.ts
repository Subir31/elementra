import { describe, expect, it } from 'vitest'
import { ELEMENTS, globalAverageNormalized, stateAtTemperature } from './elements'

describe('element data normalization', () => {
  it('uses scientific periods for the f-block while preserving grid rows', () => {
    const lanthanum = ELEMENTS.find(element => element.atomicNumber === 57)
    const actinium = ELEMENTS.find(element => element.atomicNumber === 89)

    expect(lanthanum).toMatchObject({ period: 6, group: null, ypos: 9 })
    expect(actinium).toMatchObject({ period: 7, group: null, ypos: 10 })
  })

  it('converts gas density from g/L to g/cm3', () => {
    const hydrogen = ELEMENTS.find(element => element.atomicNumber === 1)

    expect(hydrogen?.density).toBeCloseTo(0.00008988, 8)
  })
})

describe('property helpers', () => {
  it('ignores missing values in the normalized global average', () => {
    const average = globalAverageNormalized('electronegativity')

    expect(average).toBeGreaterThan(0)
    expect(average).toBeLessThan(1)
  })

  it('models state changes around melting and boiling points', () => {
    const waterFreeElement = ELEMENTS.find(element => element.atomicNumber === 80)
    if (!waterFreeElement) throw new Error('Mercury data is missing.')

    expect(stateAtTemperature(waterFreeElement, 200)).toBe('Solid')
    expect(stateAtTemperature(waterFreeElement, 298)).toBe('Liquid')
    expect(stateAtTemperature(waterFreeElement, 700)).toBe('Gas')
  })
})
