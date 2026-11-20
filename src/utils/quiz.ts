import { CATEGORY_META, CATEGORY_ORDER, ELEMENTS, type Element } from '../data/elements'
import { SYMBOL_STORIES, memoryHooks } from '../data/learning'

export type QuestionKind = 'name' | 'symbol' | 'number' | 'category' | 'group' | 'latin' | 'metal'

export interface Question {
  id: number
  kind: QuestionKind
  /** Prompt split around the highlighted term, e.g. ["Which element has the symbol ", "Na", "?"] */
  prompt: [string, string, string]
  answer: string
  options: string[]
  element: Element
  explain: string
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Distractor elements: nearby atomic numbers and look-alike symbols make better practice than random ones. */
function distractors(el: Element, pool: Element[], count: number, prefer?: (e: Element) => boolean): Element[] {
  const others = ELEMENTS.filter(e => e.atomicNumber !== el.atomicNumber)
  const lookAlikes = prefer ? shuffle(others.filter(prefer)).slice(0, 2) : []
  const sameSet = pool.length < ELEMENTS.length ? shuffle(others.filter(e => pool.includes(e))) : []
  const near = shuffle(others.filter(e => Math.abs(e.atomicNumber - el.atomicNumber) <= 8))
  const picked: Element[] = []
  for (const e of [...lookAlikes, ...sameSet, ...near, ...shuffle(others)]) {
    if (!picked.includes(e)) picked.push(e)
    if (picked.length === count) break
  }
  return picked
}

function uniqueOptions(answer: string, wrong: string[], count = 4): string[] {
  const set = new Set([answer])
  for (const w of wrong) { if (set.size >= count) break; set.add(w) }
  return shuffle([...set])
}

function makeQuestion(id: number, el: Element, kind: QuestionKind, pool: Element[]): Question {
  const story = SYMBOL_STORIES[el.symbol]
  const hook = memoryHooks(el).find(h => !h.startsWith('Mnemonic')) ?? el.funFact

  switch (kind) {
    case 'name':
      return {
        id, kind, element: el, answer: el.name,
        prompt: ['Which element has the symbol ', el.symbol, '?'],
        options: uniqueOptions(el.name, distractors(el, pool, 3, e => e.symbol[0] === el.symbol[0]).map(e => e.name)),
        explain: story ? `${el.symbol} comes from ${story.origin}. ${story.story}` : `${el.symbol} is short for ${el.name}. ${hook}`,
      }
    case 'symbol':
      return {
        id, kind, element: el, answer: el.symbol,
        prompt: ['What is the chemical symbol for ', el.name, '?'],
        options: uniqueOptions(el.symbol, distractors(el, pool, 3, e => e.symbol[0] === el.symbol[0] || e.name[0] === el.name[0]).map(e => e.symbol)),
        explain: story ? `${el.symbol} comes from ${story.origin} (${story.language}). ${story.story}` : hook,
      }
    case 'latin':
      return {
        id, kind, element: el, answer: el.name,
        prompt: ['Which element’s symbol comes from the old name ', story?.origin ?? el.latinName ?? '', '?'],
        options: uniqueOptions(el.name, distractors(el, pool, 3, e => Boolean(SYMBOL_STORIES[e.symbol])).map(e => e.name)),
        explain: `${story?.origin ?? el.latinName} → ${el.symbol}. ${story?.story ?? ''}`.trim(),
      }
    case 'number': {
      const nums = new Set<string>()
      for (const d of shuffle([-3, -2, -1, 1, 2, 3, 8, -8])) {
        const n = el.atomicNumber + d
        if (n >= 1 && n <= 118) nums.add(String(n))
      }
      return {
        id, kind, element: el, answer: String(el.atomicNumber),
        prompt: ['What is the atomic number of ', el.name, '?'],
        options: uniqueOptions(String(el.atomicNumber), [...nums]),
        explain: `${el.name} has ${el.atomicNumber} proton${el.atomicNumber > 1 ? 's' : ''} in its nucleus — that is its atomic number.`,
      }
    }
    case 'category': {
      const wrong = shuffle(CATEGORY_ORDER.filter(k => k !== el.categoryKey)).map(k => CATEGORY_META[k].label)
      return {
        id, kind, element: el, answer: el.category,
        prompt: ['Which family does ', el.name, ' belong to?'],
        options: uniqueOptions(el.category, wrong),
        explain: `${el.name} is a ${el.category.toLowerCase()}. ${CATEGORY_META[el.categoryKey].blurb}`,
      }
    }
    case 'group': {
      const g = el.group ?? 1
      const wrong = shuffle([g - 2, g - 1, g + 1, g + 2, g + 10, g - 10].filter(n => n >= 1 && n <= 18)).map(String)
      return {
        id, kind, element: el, answer: String(g),
        prompt: ['Which group (column) is ', el.name, ' in?'],
        options: uniqueOptions(String(g), wrong),
        explain: memoryHooks(el).find(h => h.startsWith('Group')) ?? `${el.name} sits in group ${g}, period ${el.period}.`,
      }
    }
    case 'metal':
      return {
        id, kind, element: el, answer: el.metalType,
        prompt: ['Is ', el.name, ' a metal, a nonmetal or a metalloid?'],
        options: ['Metal', 'Nonmetal', 'Metalloid'],
        explain: `${el.name} is a ${el.category.toLowerCase()}, so it counts as a ${el.metalType.toLowerCase()}.`,
      }
  }
}

function kindsFor(el: Element, setId: string): QuestionKind[] {
  const kinds: QuestionKind[] = ['name', 'symbol', 'symbol', 'name', 'number', 'category', 'metal']
  if (el.group != null) kinds.push('group')
  if (SYMBOL_STORIES[el.symbol]) kinds.push('latin', 'latin')
  if (setId === 'latin-symbols') return ['latin', 'symbol', 'name']
  return kinds
}

export function buildQuiz(pool: Element[], setId: string, length: number): Question[] {
  const order: Element[] = []
  while (order.length < length) order.push(...shuffle(pool))
  let lastKind: QuestionKind | null = null
  return order.slice(0, length).map((el, i) => {
    const options = kindsFor(el, setId).filter(k => k !== lastKind)
    const kind = options[Math.floor(Math.random() * options.length)]
    lastKind = kind
    return makeQuestion(i + 1, el, kind, pool)
  })
}
