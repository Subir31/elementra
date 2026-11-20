// Learning content: study sets, mnemonics, symbol stories and memory hooks.

import { ELEMENTS, ELEMENT_BY_SYMBOL, type Element, type PropertyKey } from './elements'

/** A mnemonic is a list of tokens; [word, symbol] pairs are highlighted. */
export type MnemonicToken = string | [word: string, symbol: string]

export interface StudySet {
  id: string
  title: string
  subtitle: string
  symbols: string[]
  mnemonic?: MnemonicToken[]
  tip?: string
}

export const STUDY_SETS: StudySet[] = [
  {
    id: 'first-10',
    title: 'Elements 1–10',
    subtitle: 'Hydrogen to neon — the first two rows',
    symbols: ['H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne'],
    mnemonic: [
      ['Happy', 'H'], ['Henry', 'He'], ['Likes', 'Li'], ['Beans,', 'Be'], ['Bread,', 'B'],
      ['Cheese,', 'C'], ['Nuts,', 'N'], ['Oranges,', 'O'], ['Figs', 'F'], '&', ['Nectarines', 'Ne'],
    ],
  },
  {
    id: 'next-10',
    title: 'Elements 11–20',
    subtitle: 'Sodium to calcium — row three and the start of row four',
    symbols: ['Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca'],
    mnemonic: [
      ['Naughty', 'Na'], ['Magpies', 'Mg'], ['Always', 'Al'], ['Sing', 'Si'], ['Pretty', 'P'],
      ['Songs;', 'S'], ['Clever', 'Cl'], ['Artists', 'Ar'], ['Keep', 'K'], ['Calm', 'Ca'],
    ],
  },
  {
    id: 'alkali',
    title: 'Alkali metals',
    subtitle: 'Group 1 — soft, shiny and explosive in water',
    symbols: ['Li', 'Na', 'K', 'Rb', 'Cs', 'Fr'],
    mnemonic: [
      ['Lily’s', 'Li'], ['Nan', 'Na'], ['Kindly', 'K'], ['Rubbed', 'Rb'], ['Cosy', 'Cs'], ['Ferrets', 'Fr'],
    ],
    tip: 'They get more reactive going down: lithium fizzes, potassium bursts into lilac flame.',
  },
  {
    id: 'alkaline-earth',
    title: 'Alkaline earth metals',
    subtitle: 'Group 2 — two outer electrons each',
    symbols: ['Be', 'Mg', 'Ca', 'Sr', 'Ba', 'Ra'],
    mnemonic: [
      ['Beth’s', 'Be'], ['Mighty', 'Mg'], ['Camel', 'Ca'], ['Strolled', 'Sr'], ['Back', 'Ba'], ['Rapidly', 'Ra'],
    ],
  },
  {
    id: 'halogens',
    title: 'Halogens',
    subtitle: 'Group 17 — the salt makers',
    symbols: ['F', 'Cl', 'Br', 'I', 'At', 'Ts'],
    mnemonic: [
      ['Funny', 'F'], ['Clowns', 'Cl'], ['Bring', 'Br'], ['Ice-cream', 'I'], ['At', 'At'], ['Tennis', 'Ts'],
    ],
    tip: '“Halogen” means salt-former: sodium + chlorine makes table salt.',
  },
  {
    id: 'noble-gases',
    title: 'Noble gases',
    subtitle: 'Group 18 — full shells, very calm',
    symbols: ['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn', 'Og'],
    mnemonic: [
      ['Helen', 'He'], ['Never', 'Ne'], ['Argues', 'Ar'], '—', ['Kris', 'Kr'], '&', ['Xena', 'Xe'], ['Run', 'Rn'], ['Off-grid', 'Og'],
    ],
  },
  {
    id: 'transition-row-1',
    title: 'First-row transition metals',
    subtitle: 'Scandium to zinc — the metals of everyday life',
    symbols: ['Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn'],
    mnemonic: [
      ['Scary', 'Sc'], ['Tigers', 'Ti'], ['Very', 'V'], ['Crossly', 'Cr'], ['Munch', 'Mn'], ['Fresh', 'Fe'],
      ['Coconuts,', 'Co'], ['Nibbling', 'Ni'], ['Cucumbers', 'Cu'], '&', ['Zucchini', 'Zn'],
    ],
  },
  {
    id: 'latin-symbols',
    title: 'Symbols from old names',
    subtitle: 'Why iron is Fe and gold is Au',
    symbols: ['Na', 'K', 'Fe', 'Cu', 'Ag', 'Sn', 'Sb', 'W', 'Au', 'Hg', 'Pb'],
    tip: 'These eleven symbols come from Latin, Greek or German names. Learn the story and the symbol sticks.',
  },
  {
    id: 'all',
    title: 'All 118 elements',
    subtitle: 'The full periodic table',
    symbols: ELEMENTS.map(e => e.symbol),
  },
]

export const STUDY_SET_BY_ID = new Map(STUDY_SETS.map(s => [s.id, s]))

export function elementsOfSet(set: StudySet): Element[] {
  return set.symbols.map(s => {
    const el = ELEMENT_BY_SYMBOL.get(s)
    if (!el) throw new Error(`Unknown symbol in study set ${set.id}: ${s}`)
    return el
  })
}

/** Stories behind symbols that do not match the English name. */
export const SYMBOL_STORIES: Record<string, { origin: string; language: string; story: string }> = {
  Na: { origin: 'Natrium', language: 'Latin', story: 'From natron, the salt ancient Egyptians used to dry out mummies.' },
  K:  { origin: 'Kalium', language: 'Latin', story: 'From the Arabic al-qalī, “plant ashes” — the same root gives us the word alkali.' },
  Fe: { origin: 'Ferrum', language: 'Latin', story: 'Think ferrous metals and ferromagnets — both are about iron.' },
  Cu: { origin: 'Cuprum', language: 'Latin', story: 'From Cyprus, the island whose mines supplied the Roman world with copper.' },
  Ag: { origin: 'Argentum', language: 'Latin', story: 'Argentina was named after silver — the “land of silver”.' },
  Sn: { origin: 'Stannum', language: 'Latin', story: 'The Latin word for tin. Think “stainless tin” to link the S and n.' },
  Sb: { origin: 'Stibium', language: 'Latin', story: 'Named after stibnite, a black mineral ancient Egyptians used as eyeliner (kohl).' },
  W:  { origin: 'Wolfram', language: 'German', story: 'From the mineral wolframite. “Tungsten” is Swedish for “heavy stone”.' },
  Au: { origin: 'Aurum', language: 'Latin', story: 'Means “shining dawn” — think of the golden glow of an aurora.' },
  Hg: { origin: 'Hydrargyrum', language: 'Greek via Latin', story: 'Means “water-silver”: a silvery metal that flows like water.' },
  Pb: { origin: 'Plumbum', language: 'Latin', story: 'Romans made pipes from lead, which is where the word “plumber” comes from.' },
}

/**
 * Indices of the letters in `word` that spell `symbol` in order, starting at
 * the first letter. Returns null when the symbol cannot be traced in the word.
 */
export function symbolLetterIndices(symbol: string, word: string): number[] | null {
  const w = word.toLowerCase()
  const s = symbol.toLowerCase()
  const start = w.search(/[a-z]/)
  if (start === -1 || w[start] !== s[0]) return null
  const out = [start]
  let at = start + 1
  for (const ch of s.slice(1)) {
    const i = w.indexOf(ch, at)
    if (i === -1) return null
    out.push(i)
    at = i + 1
  }
  return out
}

export function setsContaining(symbol: string): StudySet[] {
  return STUDY_SETS.filter(s => s.id !== 'all' && s.symbols.includes(symbol))
}

const ORDINAL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']

/** Short, memorable facts that link an element to its place in the table. */
export function memoryHooks(el: Element): string[] {
  const hooks: string[] = []
  const story = SYMBOL_STORIES[el.symbol]
  if (story) hooks.push(`${el.symbol} comes from ${story.origin} (${story.language}). ${story.story}`)

  const g = el.group
  if (g === 1 && el.symbol !== 'H') hooks.push('Group 1 → one outer electron, which it gives away easily. That is why it is so reactive.')
  else if (g === 2) hooks.push('Group 2 → two outer electrons to lose, so it forms 2+ ions.')
  else if (g === 17) hooks.push('Group 17 → seven outer electrons. It grabs one more to fill its shell, so it is very reactive.')
  else if (g === 18) hooks.push('Group 18 → a full outer shell, so it barely reacts with anything.')
  else if (g != null && g >= 13 && g <= 16) hooks.push(`Group ${g} → ${ORDINAL[g - 10]} outer electrons (group number minus 10).`)

  if (el.shells.length === el.period && el.period <= 7) {
    hooks.push(`Period ${el.period} → ${el.period === 1 ? 'one electron shell' : `${ORDINAL[el.period] ?? el.period} electron shells`}.`)
  }

  const set = setsContaining(el.symbol).find(s => s.mnemonic)
  const token = set?.mnemonic?.find((t): t is [string, string] => Array.isArray(t) && t[1] === el.symbol)
  if (set && token) hooks.push(`Mnemonic word: “${token[0].replace(/[,;]$/, '')}” in the ${set.title.toLowerCase()} rhyme.`)

  return hooks
}

/* ── Periodic trends cheat sheet ── */
export interface TrendCard {
  /** Heatmap property to open; null means show the metal/nonmetal categories. */
  property: PropertyKey | null
  title: string
  rule: string
  across: 'left' | 'right'
  down: 'up' | 'down'
  why: string
}

export const TREND_CARDS: TrendCard[] = [
  {
    property: 'atomicRadius',
    title: 'Atomic radius',
    rule: 'Bigger going down and to the left',
    across: 'left',
    down: 'down',
    why: 'Each period adds an electron shell; across a period, extra protons pull the shells in.',
  },
  {
    property: 'electronegativity',
    title: 'Electronegativity',
    rule: 'Stronger going up and to the right',
    across: 'right',
    down: 'up',
    why: 'Small atoms with nearly full shells pull hardest on shared electrons. Fluorine wins.',
  },
  {
    property: 'ionizationEnergy',
    title: 'Ionization energy',
    rule: 'Higher going up and to the right',
    across: 'right',
    down: 'up',
    why: 'Electrons close to the nucleus are held tightly, so they take more energy to remove.',
  },
  {
    property: null,
    title: 'Metallic character',
    rule: 'More metallic going down and to the left',
    across: 'left',
    down: 'down',
    why: 'Big atoms lose their outer electrons easily — that is what makes something behave like a metal.',
  },
]
