import { describe, expect, it } from 'vitest'
import { ELEMENTS } from '../data/elements'
import { STUDY_SETS, elementsOfSet } from '../data/learning'
import { buildQuiz } from './quiz'

describe('buildQuiz', () => {
  it('builds well-formed questions for every study set', () => {
    for (const set of STUDY_SETS) {
      const quiz = buildQuiz(elementsOfSet(set), set.id, 20)

      expect(quiz).toHaveLength(20)
      for (const q of quiz) {
        expect(q.options).toContain(q.answer)
        expect(new Set(q.options).size).toBe(q.options.length)
        expect(q.options.length).toBeGreaterThanOrEqual(3)
        expect(q.explain.length).toBeGreaterThan(10)
      }
    }
  })

  it('draws questions only from the chosen set', () => {
    const pool = ELEMENTS.slice(0, 5)
    const quiz = buildQuiz(pool, 'custom', 10)

    expect(quiz.every(q => pool.includes(q.element))).toBe(true)
  })
})
