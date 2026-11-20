import { describe, expect, it } from 'vitest'
import { CATEGORY_COUNTS, ELEMENTS, elementOfTheDay, globalAverageNormalized, heatNeedsDarkText, stateAtTemperature } from './elements'

describe('element data normalization', () => {
  it('contains exactly the 118 known elements in order', () => {
    expect(ELEMENTS).toHaveLength(118)
    expect(ELEMENTS.map(e => e.atomicNumber)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1))
  })

  it('uses scientific periods for the f-block while preserving grid rows', () => {
    const lanthanum = ELEMENTS.find(element => element.atomicNumber === 57)
    const actinium = ELEMENTS.find(element => element.atomicNumber === 89)

    expect(lanthanum).toMatchObject({ period: 6, group: null, ypos: 9, block: 'f' })
    expect(actinium).toMatchObject({ period: 7, group: null, ypos: 10, block: 'f' })
  })

  it('places helium in the s-block and classifies metal types', () => {
    const helium = ELEMENTS.find(element => element.atomicNumber === 2)
    const silicon = ELEMENTS.find(element => element.atomicNumber === 14)

    expect(helium).toMatchObject({ block: 's', metalType: 'Nonmetal' })
    expect(silicon?.metalType).toBe('Metalloid')
  })

  it('converts gas density from g/L to g/cm3', () => {
    const hydrogen = ELEMENTS.find(element => element.atomicNumber === 1)

    expect(hydrogen?.density).toBeCloseTo(0.00008988, 8)
  })

  it('keeps Latin names only where they explain the symbol', () => {
    const iron = ELEMENTS.find(element => element.symbol === 'Fe')
    const aluminium = ELEMENTS.find(element => element.symbol === 'Al')

    expect(iron?.latinName).toBe('Ferrum')
    expect(aluminium?.latinName).toBeNull()
  })

  it('assigns every element to a category', () => {
    expect(Object.values(CATEGORY_COUNTS).reduce((a, b) => a + b, 0)).toBe(118)
  })
})

describe('property helpers', () => {
  it('ignores missing values in the normalized global average', () => {
    const average = globalAverageNormalized('electronegativity')

    expect(average).toBeGreaterThan(0)
    expect(average).toBeLessThan(1)
  })

  it('models state changes around melting and boiling points', () => {
    const mercury = ELEMENTS.find(element => element.atomicNumber === 80)
    if (!mercury) throw new Error('Mercury data is missing.')

    expect(stateAtTemperature(mercury, 200)).toBe('Solid')
    expect(stateAtTemperature(mercury, 298)).toBe('Liquid')
    expect(stateAtTemperature(mercury, 700)).toBe('Gas')
  })

  it('picks readable text colours for the heat scale', () => {
    expect(heatNeedsDarkText(0)).toBe(false)
    expect(heatNeedsDarkText(0.8)).toBe(true)
  })

  it('returns the same element of the day for the same date', () => {
    const day = new Date(2026, 10, 20)

    expect(elementOfTheDay(day)).toBe(elementOfTheDay(new Date(2026, 10, 20, 23, 59)))
    expect(elementOfTheDay(day)).not.toBe(elementOfTheDay(new Date(2026, 10, 21)))
  })
})
