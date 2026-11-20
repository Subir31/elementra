import { useCallback, useMemo } from 'react'
import { todayKey } from '../utils/format'
import { useStoredState } from './useStoredState'

const isNumberArray = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every(n => Number.isInteger(n) && n >= 1 && n <= 118)

const isBestMap = (v: unknown): v is Record<string, number> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) &&
  Object.values(v).every(n => typeof n === 'number' && n >= 0 && n <= 100)

interface Streak { last: string; count: number }
const isStreak = (v: unknown): v is Streak =>
  typeof v === 'object' && v !== null &&
  typeof (v as Streak).last === 'string' && Number.isInteger((v as Streak).count)

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)
}

/** Learning progress kept on this device: learned elements, quiz bests and a daily streak. */
export function useProgress() {
  const [learnedList, setLearnedList] = useStoredState<number[]>('elementra-learned', [], isNumberArray)
  const [quizBest, setQuizBest] = useStoredState<Record<string, number>>('elementra-quiz-best', {}, isBestMap)
  const [streak, setStreak] = useStoredState<Streak>('elementra-streak', { last: '', count: 0 }, isStreak)

  const learned = useMemo(() => new Set(learnedList), [learnedList])

  const markStudied = useCallback(() => {
    const today = todayKey()
    setStreak(prev => {
      if (prev.last === today) return prev
      const gap = prev.last ? daysBetween(prev.last, today) : Infinity
      return { last: today, count: gap === 1 ? prev.count + 1 : 1 }
    })
  }, [setStreak])

  const setLearned = useCallback((z: number, value: boolean) => {
    setLearnedList(prev => {
      const has = prev.includes(z)
      if (value === has) return prev
      return value ? [...prev, z].sort((a, b) => a - b) : prev.filter(n => n !== z)
    })
    if (value) markStudied()
  }, [setLearnedList, markStudied])

  /** Saves a quiz score and reports whether it beat the previous best for that set. */
  const recordQuiz = useCallback((setId: string, percent: number) => {
    const isBest = (quizBest[setId] ?? -1) < percent
    if (isBest) setQuizBest(prev => ({ ...prev, [setId]: Math.max(prev[setId] ?? 0, percent) }))
    markStudied()
    return isBest
  }, [quizBest, setQuizBest, markStudied])

  // A streak only counts if the last study day was today or yesterday.
  const activeStreak = streak.last && daysBetween(streak.last, todayKey()) <= 1 ? streak.count : 0

  return { learned, setLearned, quizBest, recordQuiz, streak: activeStreak, markStudied }
}

export type Progress = ReturnType<typeof useProgress>
