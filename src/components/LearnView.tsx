import type { CSSProperties } from 'react'
import { CATEGORY_META, ELEMENT_BY_SYMBOL, type Element, type PropertyKey } from '../data/elements'
import { STUDY_SETS, SYMBOL_STORIES, TREND_CARDS, elementsOfSet, symbolLetterIndices, type MnemonicToken, type StudySet, type TrendCard } from '../data/learning'
import type { Progress } from '../hooks/useProgress'
import { AdSlot } from './AdSlot'
import { Ring } from './Charts'
import { HighlightedName } from './ElementSheet'
import { Icon } from './Icon'

export function Mnemonic({ tokens }: { tokens: MnemonicToken[] }) {
  return (
    <p className="font-display text-[15.5px] font-semibold leading-[1.6] text-[var(--text)]">
      “{tokens.map((t, i) => {
        if (typeof t === 'string') return <span key={i} className="text-[var(--text-3)]">{t} </span>
        const [word, symbol] = t
        const marks = symbolLetterIndices(symbol, word) ?? []
        return (
          <span key={i} title={symbol}>
            {word.split('').map((ch, j) => (marks.includes(j) ? <span key={j} className="mark">{ch}</span> : ch))}{' '}
          </span>
        )
      })}”
    </p>
  )
}

export function LearnView({ progress, onOpen, onStudy, onQuiz, onShowTrend }: {
  progress: Progress
  onOpen: (el: Element) => void
  onStudy: (set: StudySet) => void
  onQuiz: (set: StudySet) => void
  onShowTrend: (property: PropertyKey | null) => void
}) {
  const { learned, streak } = progress
  const sets = STUDY_SETS.filter(s => s.id !== 'all')
  const all = STUDY_SETS.find(s => s.id === 'all')

  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Header */}
      <section className="grid gap-4 pt-2 sm:pt-4 lg:grid-cols-[1.4fr_1fr] lg:items-end">
        <div className="reveal">
          <div className="eyebrow mb-2">Learn</div>
          <h1 className="font-display text-[clamp(28px,4.4vw,46px)] font-extrabold leading-[1.08] tracking-[-0.04em]">
            Small sets, clever tricks, <span className="text-gradient">lasting memory.</span>
          </h1>
          <p className="mt-3 max-w-[58ch] text-[15px] leading-relaxed text-[var(--text-2)]">
            Pick a set, read its mnemonic out loud, then flip through the cards. Anything you get right is saved on this device, so you can see your progress grow.
          </p>
        </div>
        <div className="card reveal flex items-center gap-4 p-4 [animation-delay:100ms]">
          <Ring value={learned.size / 118} size={76} stroke={7}>
            <span className="text-center leading-none"><span className="block font-mono text-[18px] font-bold">{learned.size}</span><span className="text-[10px] text-[var(--text-3)]">/118</span></span>
          </Ring>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">{learned.size === 118 ? 'You know them all!' : learned.size ? 'Elements learned' : 'Your journey starts here'}</div>
            <div className="mt-1 flex items-center gap-1.5 text-[13px] text-[var(--text-3)]">
              <Icon name="flame" size={14} className={streak ? 'text-orange-400' : ''} />{streak ? `${streak}-day study streak` : 'Study today to start a streak'}
            </div>
            {all && <button type="button" className="btn btn-sm btn-soft mt-3" onClick={() => onStudy(all)}><Icon name="layers" size={14} />Study all 118</button>}
          </div>
        </div>
      </section>

      {/* Study sets */}
      <section aria-labelledby="sets-title">
        <SectionTitle id="sets-title" icon="layers" title="Study sets" text="Start with the first 20 — they appear in almost every chemistry lesson." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sets.map((set, i) => <SetCard key={set.id} set={set} learned={learned} index={i} onStudy={onStudy} onQuiz={onQuiz} onOpen={onOpen} />)}
        </div>
      </section>

      <AdSlot placement="learn" />

      {/* Symbol stories */}
      <section aria-labelledby="stories-title">
        <SectionTitle id="stories-title" icon="book" title="Why is gold Au?" text="Eleven symbols come from old Latin, Greek or German names. Each one has a story that makes it stick." />
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Object.entries(SYMBOL_STORIES).map(([symbol, s]) => {
            const el = ELEMENT_BY_SYMBOL.get(symbol)
            if (!el) return null
            return (
              <button key={symbol} type="button" onClick={() => onOpen(el)}
                className="el-card !items-start !p-4" style={{ '--c': CATEGORY_META[el.categoryKey].color } as CSSProperties}>
                <span className="el-sym">{symbol}</span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold">{el.name} <span className="font-normal text-[var(--text-3)]">←</span> <HighlightedName symbol={symbol} word={s.origin} /></span>
                  <span className="mt-1 block text-[13px] leading-snug text-[var(--text-3)]">{s.story}</span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {/* Trends */}
      <section aria-labelledby="trends-title">
        <SectionTitle id="trends-title" icon="sparkles" title="Four trends to remember" text="Most exam questions about the periodic table come down to these arrows." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TREND_CARDS.map(t => <TrendCardView key={t.title} card={t} onShow={() => onShowTrend(t.property)} />)}
        </div>
      </section>

      {/* Reading a tile */}
      <section aria-labelledby="tile-title" className="card grid items-center gap-6 p-5 sm:p-7 md:grid-cols-[auto_1fr]">
        <AnnotatedTile />
        <div>
          <h2 id="tile-title" className="text-[22px] font-bold">How to read an element tile</h2>
          <ul className="mt-3 space-y-2.5 text-[14.5px] text-[var(--text-2)]">
            {[
              ['Atomic number', 'The number of protons. It is the element’s ID — no two share one.'],
              ['Symbol', 'One or two letters. The first is always a capital letter.'],
              ['Name', 'Often from Greek or Latin, a place, or a famous scientist.'],
              ['Atomic mass', 'The average mass of one atom in atomic mass units (u).'],
            ].map(([k, v], i) => (
              <li key={k} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] font-mono text-[12px] font-bold text-[var(--accent-text)]">{i + 1}</span>
                <span><b className="text-[var(--text)]">{k}.</b> {v}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}

function SectionTitle({ id, icon, title, text }: { id: string; icon: 'layers' | 'book' | 'sparkles'; title: string; text: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-text)]"><Icon name={icon} size={19} /></span>
      <div>
        <h2 id={id} className="text-[21px] font-bold sm:text-[23px]">{title}</h2>
        <p className="mt-0.5 text-[14px] text-[var(--text-3)]">{text}</p>
      </div>
    </div>
  )
}

function SetCard({ set, learned, index, onStudy, onQuiz, onOpen }: {
  set: StudySet; learned: Set<number>; index: number
  onStudy: (s: StudySet) => void; onQuiz: (s: StudySet) => void; onOpen: (el: Element) => void
}) {
  const els = elementsOfSet(set)
  const done = els.filter(e => learned.has(e.atomicNumber)).length
  const complete = done === els.length

  return (
    <article className="card reveal flex flex-col p-4 sm:p-5" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[17px] font-bold">{set.title}</h3>
          <p className="text-[13px] text-[var(--text-3)]">{set.subtitle}</p>
        </div>
        {complete && <span className="chip !h-6 shrink-0 !px-2 !text-[11px]" aria-pressed="true" style={{ '--c': 'var(--success)' } as CSSProperties}><Icon name="check" size={12} />Done</span>}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {els.map(e => (
          <button key={e.atomicNumber} type="button" onClick={() => onOpen(e)} title={e.name}
            className="el-sym relative !h-9 !w-9 !rounded-[10px] !text-[13.5px] transition-transform hover:-translate-y-0.5"
            style={{ '--c': CATEGORY_META[e.categoryKey].color, animation: 'none' } as CSSProperties}>
            {e.symbol}
            {learned.has(e.atomicNumber) && <span className="tile-badge !right-[-3px] !top-[-3px] !h-2.5 !w-2.5" />}
          </button>
        ))}
      </div>

      {set.mnemonic && <div className="mt-4 rounded-2xl bg-[var(--surface-2)] p-3.5"><Mnemonic tokens={set.mnemonic} /></div>}
      {set.tip && <p className="mt-3 flex gap-2 text-[13px] leading-snug text-[var(--text-2)]"><Icon name="bulb" size={15} className="mt-0.5 shrink-0 text-[var(--warning)]" />{set.tip}</p>}

      <div className="mt-auto pt-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="meter flex-1"><span style={{ width: `${(done / els.length) * 100}%`, background: complete ? 'var(--success)' : 'linear-gradient(90deg, var(--accent), var(--accent-3))' }} /></div>
          <span className="font-mono text-[11.5px] font-semibold text-[var(--text-3)]">{done}/{els.length}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onStudy(set)}><Icon name="layers" size={14} />Flashcards</button>
          <button type="button" className="btn btn-sm" onClick={() => onQuiz(set)}><Icon name="target" size={14} />Quiz</button>
        </div>
      </div>
    </article>
  )
}

function TrendCardView({ card, onShow }: { card: TrendCard; onShow: () => void }) {
  // A tiny 5×4 grid with arrows showing which way the property grows.
  const hx = card.across === 'right'
  const vy = card.down === 'down'
  return (
    <article className="card flex flex-col p-4">
      <div className="relative mx-auto mb-4 grid w-full max-w-[150px] grid-cols-5 gap-1 p-2 sm:max-w-[200px]" aria-hidden="true">
        {Array.from({ length: 20 }, (_, i) => {
          const x = i % 5
          const y = Math.floor(i / 5)
          const t = ((hx ? x : 4 - x) / 4 + (vy ? y : 3 - y) / 3) / 2
          return <span key={i} className="aspect-square rounded-[5px]" style={{ background: `color-mix(in oklab, var(--accent) ${12 + t * 70}%, var(--surface-2))` }} />
        })}
        <span className="absolute -top-2 left-2 right-2 flex items-center justify-center text-[var(--accent-text)]">
          <Icon name={hx ? 'arrowRight' : 'arrowLeft'} size={16} strokeWidth={2.4} />
        </span>
        <span className="absolute -right-3 bottom-2 top-2 flex items-center text-[var(--accent-text)]">
          <Icon name={vy ? 'arrowDown' : 'arrowUp'} size={16} strokeWidth={2.4} />
        </span>
      </div>
      <h3 className="text-[16px] font-bold">{card.title}</h3>
      <p className="mt-0.5 text-[14px] font-semibold text-[var(--accent-text)]">{card.rule}</p>
      <p className="mt-2 text-[13px] leading-snug text-[var(--text-3)]">{card.why}</p>
      <button type="button" className="btn btn-sm mt-4 self-start" onClick={onShow}>
        See it on the table<Icon name="arrowRight" size={14} />
      </button>
    </article>
  )
}

function AnnotatedTile() {
  const c = CATEGORY_META['transition-metal'].color
  const Marker = ({ n }: { n: number }) => (
    <span className="absolute -left-[46px] top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full bg-[var(--accent)] font-mono text-[12px] font-bold text-white shadow-lg">{n}</span>
  )
  return (
    <div className="mx-auto pl-[46px]" aria-hidden="true">
      <div className="flex h-[196px] w-[150px] flex-col justify-between rounded-[22px] p-4"
        style={{ background: `color-mix(in oklab, ${c} calc(var(--tile-bg-mix) + 6%), var(--tile-base))`, border: `1.5px solid color-mix(in oklab, ${c} 60%, transparent)`, color: `color-mix(in oklab, ${c} var(--tile-ink-mix), var(--tile-ink-base))`, boxShadow: `0 18px 40px -18px ${c}` }}>
        <span className="relative font-mono text-[16px] font-semibold"><Marker n={1} />26</span>
        <span className="relative font-display text-[56px] font-extrabold leading-none tracking-[-0.04em]"><Marker n={2} />Fe</span>
        <span className="space-y-2">
          <span className="relative block text-[14px] font-semibold leading-tight"><Marker n={3} />Iron</span>
          <span className="relative block font-mono text-[12px] leading-tight opacity-75"><Marker n={4} />55.845</span>
        </span>
      </div>
    </div>
  )
}
