import { describe, expect, it } from 'vitest'
import { ELEMENT_BY_SYMBOL } from './elements'
import { STUDY_SETS, SYMBOL_STORIES, elementsOfSet, memoryHooks, symbolLetterIndices } from './learning'

describe('study sets', () => {
  it('only reference real elements', () => {
    for (const set of STUDY_SETS) expect(() => elementsOfSet(set)).not.toThrow()
  })

  it('have mnemonics whose words spell each symbol in order', () => {
    for (const set of STUDY_SETS) {
      if (!set.mnemonic) continue
      const pairs = set.mnemonic.filter((t): t is [string, string] => Array.isArray(t))

      expect(pairs.map(p => p[1])).toEqual(set.symbols)
      for (const [word, symbol] of pairs) {
        expect(symbolLetterIndices(symbol, word), `${symbol} in “${word}”`).not.toBeNull()
      }
    }
  })

  it('tell a story for every symbol that comes from an old name', () => {
    const latinSet = STUDY_SETS.find(s => s.id === 'latin-symbols')

    expect(Object.keys(SYMBOL_STORIES).sort()).toEqual([...(latinSet?.symbols ?? [])].sort())
  })
})

describe('symbolLetterIndices', () => {
  it('finds symbol letters in order', () => {
    expect(symbolLetterIndices('Mg', 'Magnesium')).toEqual([0, 2])
    expect(symbolLetterIndices('Zn', 'Zinc')).toEqual([0, 2])
    expect(symbolLetterIndices('Fe', 'Iron')).toBeNull()
  })
})

describe('memoryHooks', () => {
  it('explains Latin symbols and group behaviour', () => {
    const sodium = ELEMENT_BY_SYMBOL.get('Na')
    if (!sodium) throw new Error('Sodium data is missing.')
    const hooks = memoryHooks(sodium)

    expect(hooks[0]).toContain('Natrium')
    expect(hooks.some(h => h.startsWith('Group 1'))).toBe(true)
    expect(hooks.some(h => h.startsWith('Period 3'))).toBe(true)
  })

  it('skips the period hint when shells and period disagree', () => {
    const palladium = ELEMENT_BY_SYMBOL.get('Pd')
    if (!palladium) throw new Error('Palladium data is missing.')

    expect(memoryHooks(palladium).some(h => h.startsWith('Period'))).toBe(false)
  })
})
