import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { CATEGORY_META, type Element } from '../data/elements'
import { STUDY_SETS, STUDY_SET_BY_ID, elementsOfSet, type StudySet } from '../data/learning'
import type { Progress } from '../hooks/useProgress'
import { buildQuiz, type Question } from '../utils/quiz'
import { Ring } from './Charts'
import { Icon } from './Icon'

interface Answer { q: Question; choice: string; correct: boolean }
export interface QuizRequest { setId: string; nonce: number }

const CONFETTI_COLORS = ['#8286ff', '#22d3ee', '#34d399', '#fbbf24', '#f472b6', '#c084fc']

function Confetti() {
  const [pieces] = useState(() => Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.4
    const dist = 60 + Math.random() * 70
    return {
      '--dx': `${Math.cos(angle) * dist}px`,
      '--dy': `${Math.sin(angle) * dist - 20}px`,
      '--rot': `${Math.random() * 540 - 270}deg`,
      background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      animationDelay: `${Math.random() * 60}ms`,
    } as CSSProperties
  }))
  return <span aria-hidden="true">{pieces.map((style, i) => <span key={i} className="confetti" style={style} />)}</span>
}

export function QuizView({ progress, request, active, onOpen, onStudyMissed }: {
  progress: Progress
  request: QuizRequest | null
  active: boolean
  onOpen: (el: Element) => void
  onStudyMissed: (elements: Element[]) => void
}) {
  const [setId, setSetId] = useState('first-10')
  const [length, setLength] = useState(10)
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [streak, setStreak] = useState(0)
  const [result, setResult] = useState<{ percent: number; best: boolean } | null>(null)
  const advanceTimer = useRef<number | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const start = useCallback((id: string, len: number) => {
    const set = STUDY_SET_BY_ID.get(id) ?? STUDY_SETS[0]
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    setSetId(set.id)
    setQuestions(buildQuiz(elementsOfSet(set), set.id, len))
    setIndex(0)
    setAnswers([])
    setStreak(0)
    setResult(null)
  }, [])

  // Quizzes started from the Learn page arrive as requests.
  useEffect(() => {
    if (request) start(request.setId, 10)
  }, [request, start])

  useEffect(() => () => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current) }, [])

  const q = questions?.[index]
  const current = answers[index]

  const next = useCallback(() => {
    if (!questions) return
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    if (index + 1 >= questions.length) {
      const correct = answers.filter(a => a.correct).length
      const percent = Math.round((correct / questions.length) * 100)
      setResult({ percent, best: progress.recordQuiz(setId, percent) })
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setIndex(i => i + 1)
  }, [questions, index, answers, progress, setId])

  const choose = useCallback((choice: string) => {
    if (!q || current) return
    const correct = choice === q.answer
    setAnswers(a => { const copy = [...a]; copy[index] = { q, choice, correct }; return copy })
    setStreak(s => (correct ? s + 1 : 0))
  }, [q, current, index])

  // Correct answers move on by themselves; wrong ones wait so the explanation can be read.
  const nextRef = useRef(next)
  useEffect(() => { nextRef.current = next }, [next])
  useEffect(() => {
    if (!current?.correct) return
    advanceTimer.current = window.setTimeout(() => nextRef.current(), 1400)
    return () => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current) }
  }, [current])

  useEffect(() => {
    if (!active || !q || result) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      const n = Number(e.key)
      if (!current && n >= 1 && n <= q.options.length) { e.preventDefault(); choose(q.options[n - 1]) }
      else if (current && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, q, current, result, choose, next])

  const set = STUDY_SET_BY_ID.get(setId) ?? STUDY_SETS[0]
  const correctCount = answers.filter(a => a?.correct).length

  return (
    <div ref={topRef} className="mx-auto max-w-[760px] scroll-mt-24 space-y-6 pt-2 sm:pt-4">
      {!questions || result ? (
        result && questions ? (
          <Results result={result} answers={answers} total={questions.length} set={set} best={progress.quizBest[setId]}
            onAgain={() => start(setId, questions.length)} onChange={() => { setQuestions(null); setResult(null) }}
            onOpen={onOpen} onStudyMissed={onStudyMissed} />
        ) : (
          <Setup setId={setId} setSetId={setSetId} length={length} setLength={setLength} bests={progress.quizBest} onStart={() => start(setId, length)} />
        )
      ) : q ? (
        <section className="card overflow-hidden" aria-label="Quiz question">
          <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-6">
            <button type="button" className="icon-btn !h-9 !w-9" onClick={() => setQuestions(null)} aria-label="Quit quiz"><Icon name="x" size={16} /></button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-[var(--text-3)]">{set.title}</div>
              <div className="meter mt-1.5" role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={index + (current ? 1 : 0)}>
                <span style={{ width: `${((index + (current ? 1 : 0)) / questions.length) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-3))' }} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 font-mono text-[13px] font-bold">
              <span className="text-[var(--success)]" aria-label={`${correctCount} correct`}>✓ {correctCount}</span>
              <span className={`flex items-center gap-1 ${streak >= 3 ? 'text-orange-400' : 'text-[var(--text-3)]'}`} aria-label={`Streak ${streak}`}>
                <Icon name="flame" size={14} />{streak}
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-7" key={q.id}>
            <div className="eyebrow mb-3 animate-[fadeIn_.3s_ease]">Question {index + 1} of {questions.length}</div>
            <h2 className="font-display text-[clamp(20px,3.4vw,27px)] font-bold leading-snug tracking-[-0.02em] animate-[fadeUp_.35s_var(--ease-out)_both]">
              {q.prompt[0]}
              <span className="rounded-lg px-1.5 text-[var(--accent-text)]" style={{ background: 'var(--accent-soft)' }}>{q.prompt[1]}</span>
              {q.prompt[2]}
            </h2>

            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              {q.options.map((o, i) => {
                const isAnswer = o === q.answer
                const chosen = current?.choice === o
                const cls = current ? (isAnswer ? 'is-correct' : chosen ? 'is-wrong' : 'is-faded') : ''
                return (
                  <button key={o} type="button" className={`option ${cls} animate-[fadeUp_.35s_var(--ease-out)_both]`}
                    style={{ animationDelay: `${60 + i * 50}ms` }} onClick={() => choose(o)} disabled={Boolean(current)}>
                    <span className="kbd key">{i + 1}</span>
                    <span className="flex-1">{o}</span>
                    {current && isAnswer && <Icon name="check" size={18} className="text-[var(--success)]" />}
                    {current && chosen && !isAnswer && <Icon name="x" size={18} className="text-[var(--danger)]" />}
                    {current?.correct && chosen && <Confetti />}
                  </button>
                )
              })}
            </div>

            <div aria-live="polite">
              {current && (
                <div className="mt-5 animate-[fadeUp_.35s_var(--ease-out)_both]">
                  <div className="hook" style={{ '--c': current.correct ? 'var(--success)' : 'var(--danger)' } as CSSProperties}>
                    <Icon name={current.correct ? 'sparkles' : 'bulb'} size={17} className="mt-0.5 shrink-0" style={{ color: current.correct ? 'var(--success)' : 'var(--danger)' }} />
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--text)]">
                        {current.correct ? (streak >= 3 ? `Correct — ${streak} in a row!` : 'Correct!') : `Not quite — it’s ${q.answer}.`}
                      </div>
                      <p className="mt-0.5 text-[14px] leading-relaxed">{q.explain}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(q.element)}>
                      <span className="el-sym !h-7 !w-7 !rounded-lg !text-[12px]" style={{ '--c': CATEGORY_META[q.element.categoryKey].color } as CSSProperties}>{q.element.symbol}</span>
                      Open {q.element.name}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={next}>
                      {index + 1 >= questions.length ? 'See results' : 'Next'}<Icon name="arrowRight" size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function Setup({ setId, setSetId, length, setLength, bests, onStart }: {
  setId: string; setSetId: (id: string) => void; length: number; setLength: (n: number) => void
  bests: Record<string, number>; onStart: () => void
}) {
  return (
    <>
      <div className="reveal">
        <div className="eyebrow mb-2">Quiz</div>
        <h1 className="font-display text-[clamp(28px,4.4vw,44px)] font-extrabold leading-[1.08] tracking-[-0.04em]">
          Test yourself. <span className="text-gradient">Learn from every miss.</span>
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-2)]">
          Every answer comes with a quick explanation, and wrong answers wait for you — so each mistake teaches you something.
        </p>
      </div>

      <section className="card p-4 sm:p-6" aria-labelledby="choose-set">
        <h2 id="choose-set" className="mb-3 text-[17px] font-bold">Choose a set</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {STUDY_SETS.map(s => {
            const selected = s.id === setId
            const best = bests[s.id]
            return (
              <button key={s.id} type="button" onClick={() => setSetId(s.id)} aria-pressed={selected}
                className="flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors"
                style={{ borderColor: selected ? 'var(--accent-border)' : 'var(--border)', background: selected ? 'var(--accent-soft)' : 'var(--surface-2)' }}>
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border-2" style={{ borderColor: selected ? 'var(--accent)' : 'var(--border-2)' }}>
                  {selected && <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold">{s.title}</span>
                  <span className="block truncate text-[12.5px] text-[var(--text-3)]">{s.symbols.slice(0, 8).join(' · ')}{s.symbols.length > 8 ? ' …' : ''}</span>
                </span>
                {best != null && <span className="shrink-0 font-mono text-[11.5px] font-semibold text-[var(--text-3)]" title="Your best score">★ {best}%</span>}
              </button>
            )
          })}
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[14px] font-semibold text-[var(--text-2)]">Questions</span>
            <div className="segmented" role="group" aria-label="Number of questions">
              {[10, 20].map(n => <button key={n} type="button" aria-pressed={length === n} onClick={() => setLength(n)}>{n}</button>)}
            </div>
          </div>
          <button type="button" className="btn btn-primary btn-lg" onClick={onStart}>Start quiz<Icon name="arrowRight" size={17} /></button>
        </div>
      </section>
    </>
  )
}

function Results({ result, answers, total, set, best, onAgain, onChange, onOpen, onStudyMissed }: {
  result: { percent: number; best: boolean }; answers: Answer[]; total: number; set: StudySet; best?: number
  onAgain: () => void; onChange: () => void; onOpen: (el: Element) => void; onStudyMissed: (els: Element[]) => void
}) {
  const missed = answers.filter(a => !a.correct)
  const missedElements = [...new Map(missed.map(a => [a.q.element.atomicNumber, a.q.element])).values()]
  const correct = total - missed.length
  const headline = result.percent === 100 ? 'Perfect score!' : result.percent >= 80 ? 'Brilliant work!' : result.percent >= 50 ? 'Good progress!' : 'Keep going — it sticks with practice'

  return (
    <section className="card overflow-hidden" aria-labelledby="result-title">
      <div className="hero flex flex-col items-center px-6 py-8 text-center" style={{ '--c': result.percent >= 80 ? '#34d399' : result.percent >= 50 ? '#8286ff' : '#fb923c' } as CSSProperties}>
        <div className="relative animate-[popIn_.5s_var(--ease-spring)_both]">
          <Ring value={result.percent / 100} size={128} stroke={10} color="#ffffff">
            <span className="text-center leading-none text-white"><span className="block font-display text-[34px] font-extrabold">{result.percent}%</span><span className="text-[12px] opacity-80">{correct}/{total}</span></span>
          </Ring>
          {result.percent >= 80 && <Confetti />}
        </div>
        <h2 id="result-title" className="mt-4 font-display text-[26px] font-extrabold !text-white">{headline}</h2>
        <p className="mt-1 text-[14px] text-white/85">
          {set.title}{result.best ? ' · new personal best!' : best != null ? ` · best ${best}%` : ''}
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-7">
        <div className="grid gap-2 sm:grid-cols-3">
          <button type="button" className="btn btn-primary" onClick={onAgain}><Icon name="rotate" size={16} />Play again</button>
          {missedElements.length > 0 && (
            <button type="button" className="btn btn-soft" onClick={() => onStudyMissed(missedElements)}><Icon name="layers" size={16} />Review {missedElements.length} missed</button>
          )}
          <button type="button" className="btn" onClick={onChange}>Choose another set</button>
        </div>

        {missed.length > 0 && (
          <div>
            <div className="eyebrow mb-2.5">What to review</div>
            <ul className="space-y-2">
              {missed.map(a => (
                <li key={a.q.id}>
                  <button type="button" onClick={() => onOpen(a.q.element)} className="panel flex w-full items-start gap-3 p-3 text-left transition-colors hover:border-[var(--accent-border)]">
                    <span className="el-sym !h-10 !w-10 !rounded-xl !text-[15px]" style={{ '--c': CATEGORY_META[a.q.element.categoryKey].color } as CSSProperties}>{a.q.element.symbol}</span>
                    <span className="min-w-0 text-[13.5px]">
                      <span className="block font-semibold text-[var(--text)]">{a.q.prompt.join('')}</span>
                      <span className="block text-[var(--text-3)]">You said <s className="text-[var(--danger)]">{a.choice}</s> · answer <b className="text-[var(--success)]">{a.q.answer}</b></span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
