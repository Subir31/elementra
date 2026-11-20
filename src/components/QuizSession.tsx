import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { CATEGORY_META, type Element } from '../data/elements'
import { STUDY_SET_BY_ID, elementsOfSet, type StudySet } from '../data/learning'
import type { Progress } from '../hooks/useProgress'
import { useDialog } from '../hooks/useUi'
import { buildQuiz, type Question } from '../utils/quiz'
import { Ring } from './Charts'
import { Icon } from './Icon'

interface Answer { q: Question; choice: string; correct: boolean }

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

export const quizLength = (set: StudySet) => (set.id === 'all' ? 20 : 10)

/** A focused, full-screen quiz for one study set. */
export function QuizSession({ set, progress, active, onOpen, onStudyMissed, onClose }: {
  set: StudySet
  progress: Progress
  /** False while another dialog (an element sheet) is on top. */
  active: boolean
  onOpen: (el: Element) => void
  onStudyMissed: (elements: Element[]) => void
  onClose: () => void
}) {
  const dialogRef = useDialog<HTMLDivElement>(onClose)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [questions, setQuestions] = useState<Question[]>(() => buildQuiz(elementsOfSet(set), set.id, quizLength(set)))
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [streak, setStreak] = useState(0)
  const [result, setResult] = useState<{ percent: number; best: boolean } | null>(null)
  const advanceTimer = useRef<number | null>(null)

  const clearTimer = () => { if (advanceTimer.current) window.clearTimeout(advanceTimer.current) }
  useEffect(() => clearTimer, [])

  const restart = () => {
    clearTimer()
    setQuestions(buildQuiz(elementsOfSet(set), set.id, quizLength(set)))
    setIndex(0)
    setAnswers([])
    setStreak(0)
    setResult(null)
    bodyRef.current?.scrollTo({ top: 0 })
  }

  const q = result ? undefined : questions[index]
  const current = answers[index]

  const next = useCallback(() => {
    clearTimer()
    if (index + 1 >= questions.length) {
      const correct = answers.filter(a => a.correct).length
      const percent = Math.round((correct / questions.length) * 100)
      // Only the built-in sets keep a personal best; review sets just count towards the streak.
      const saved = STUDY_SET_BY_ID.has(set.id)
      if (!saved) progress.markStudied()
      setResult({ percent, best: saved && progress.recordQuiz(set.id, percent) })
      bodyRef.current?.scrollTo({ top: 0 })
      return
    }
    setIndex(i => i + 1)
    bodyRef.current?.scrollTo({ top: 0 })
  }, [questions, index, answers, progress, set.id])

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
    return clearTimer
  }, [current])

  useEffect(() => {
    if (!active || !q) return
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      const n = Number(e.key)
      if (!current && n >= 1 && n <= q.options.length) { e.preventDefault(); choose(q.options[n - 1]) }
      else if (current && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, q, current, choose, next])

  const correctCount = answers.filter(a => a?.correct).length
  const answered = index + (current ? 1 : 0)

  return (
    <div className="overlay">
      <div className="backdrop" onClick={result ? onClose : undefined} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="quiz-title" tabIndex={-1}
        className="sheet !max-w-[720px] md:!max-h-[min(92dvh,860px)]">
        <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Quiz</div>
            <h2 id="quiz-title" className="truncate text-[17px] font-bold">{set.title}</h2>
          </div>
          {!result && (
            <div className="flex shrink-0 items-center gap-3 font-mono text-[13px] font-bold">
              <span className="text-[var(--success)]" aria-label={`${correctCount} correct`}>✓ {correctCount}</span>
              <span className={`flex items-center gap-1 ${streak >= 3 ? 'text-orange-400' : 'text-[var(--text-3)]'}`} aria-label={`Streak ${streak}`}>
                <Icon name="flame" size={14} />{streak}
              </span>
            </div>
          )}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close quiz"><Icon name="x" /></button>
        </header>

        {!result && (
          <div className="px-4 pt-3 sm:px-6">
            <div className="meter" role="progressbar" aria-label="Quiz progress" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answered}>
              <span style={{ width: `${(answered / questions.length) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-3))' }} />
            </div>
          </div>
        )}

        <div ref={bodyRef} className="sheet-body flex-1">
          {result ? (
            <Results result={result} answers={answers} total={questions.length} set={set} best={progress.quizBest[set.id]}
              onAgain={restart} onDone={onClose} onOpen={onOpen} onStudyMissed={onStudyMissed} />
          ) : q ? (
            <div className="p-5 sm:p-7" key={q.id}>
              <div className="eyebrow mb-3 animate-[fadeIn_.3s_ease]">Question {index + 1} of {questions.length}</div>
              <p className="font-display text-[clamp(20px,3.4vw,27px)] font-bold leading-snug tracking-[-0.02em] text-[var(--text)] animate-[fadeUp_.35s_var(--ease-out)_both]">
                {q.prompt[0]}
                <span className="rounded-lg px-1.5 text-[var(--accent-text)]" style={{ background: 'var(--accent-soft)' }}>{q.prompt[1]}</span>
                {q.prompt[2]}
              </p>

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
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Results({ result, answers, total, set, best, onAgain, onDone, onOpen, onStudyMissed }: {
  result: { percent: number; best: boolean }; answers: Answer[]; total: number; set: StudySet; best?: number
  onAgain: () => void; onDone: () => void; onOpen: (el: Element) => void; onStudyMissed: (els: Element[]) => void
}) {
  const missed = answers.filter(a => !a.correct)
  const missedElements = [...new Map(missed.map(a => [a.q.element.atomicNumber, a.q.element])).values()]
  const correct = total - missed.length
  const headline = result.percent === 100 ? 'Perfect score!' : result.percent >= 80 ? 'Brilliant work!' : result.percent >= 50 ? 'Good progress!' : 'Keep going — it sticks with practice'

  return (
    <section aria-labelledby="result-title">
      <div className="hero flex flex-col items-center px-6 py-8 text-center" style={{ '--c': result.percent >= 80 ? '#34d399' : result.percent >= 50 ? '#8286ff' : '#fb923c' } as CSSProperties}>
        <div className="relative animate-[popIn_.5s_var(--ease-spring)_both]">
          <Ring value={result.percent / 100} size={128} stroke={10} color="#ffffff">
            <span className="text-center leading-none text-white"><span className="block font-display text-[34px] font-extrabold">{result.percent}%</span><span className="text-[12px] opacity-80">{correct}/{total}</span></span>
          </Ring>
          {result.percent >= 80 && <Confetti />}
        </div>
        <h3 id="result-title" className="mt-4 font-display text-[26px] font-extrabold !text-white">{headline}</h3>
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
          <button type="button" className="btn" onClick={onDone}>Done</button>
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
