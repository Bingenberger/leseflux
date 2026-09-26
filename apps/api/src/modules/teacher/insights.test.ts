import { describe, expect, it } from 'vitest'
import { computeStudentInsights, type InsightRun } from './insights.js'

let day = 0
function run(partial: Partial<InsightRun>): InsightRun {
  day += 1
  return {
    exerciseType: 'REPEATED_READING',
    startedAt: new Date(2026, 0, day),
    itemsTotal: 0,
    itemsCorrect: 0,
    measuredWpm: null,
    responses: [],
    ...partial,
  }
}

function quiz(correct: boolean[], ms: number, prefix = 'q') {
  return correct.map((isCorrect, i) => ({ questionId: `${prefix}${i}`, selectedIndex: 0, isCorrect, responseTimeMs: ms }))
}

const questions = new Map([
  ['q0', 'Was frisst der Igel?'],
  ['q1', 'Warum rollt sich der Igel ein?'],
  ['q2', 'Was denkst du über Igel?'],
])

describe('computeStudentInsights', () => {
  it('trennt die Genauigkeit nach Bereich', () => {
    const result = computeStudentInsights([
      run({ itemsTotal: 3, itemsCorrect: 3, responses: quiz([true, true, true], 4000) }),
      run({ exerciseType: 'FLASH_WORD', itemsTotal: 12, itemsCorrect: 6 }),
      run({ exerciseType: 'CLOZE', itemsTotal: 10, itemsCorrect: 9 }),
    ], questions)
    expect(result.accuracyByArea.comprehension).toEqual({ accuracy: 1, runs: 1 })
    expect(result.accuracyByArea.flashWord).toEqual({ accuracy: 0.5, runs: 1 })
    expect(result.accuracyByArea.cloze).toEqual({ accuracy: 0.9, runs: 1 })
    expect(result.flags).toEqual([])
  })

  it('wertet nach Verstehensebene aus', () => {
    const result = computeStudentInsights([
      run({ itemsTotal: 3, itemsCorrect: 1, responses: quiz([true, false, false], 4000) }),
    ], questions)
    expect(result.accuracyByQuestionKind).toEqual({
      WOERTLICH: { correct: 1, total: 1 },
      SCHLUSSFOLGERND: { correct: 0, total: 1 },
      BEWERTEND: { correct: 0, total: 1 },
    })
  })

  it('erkennt Rate-Muster (schnell und meist falsch)', () => {
    const runs = [1, 2, 3].map(() => run({ itemsTotal: 3, itemsCorrect: 1, responses: quiz([true, false, false], 900) }))
    expect(computeStudentInsights(runs, questions).flags.map((f) => f.code)).toContain('GUESSING')
  })

  it('meldet kein Raten bei langsamen falschen Antworten', () => {
    const runs = [1, 2, 3].map(() => run({ itemsTotal: 3, itemsCorrect: 1, responses: quiz([true, false, false], 6000) }))
    expect(computeStudentInsights(runs, questions).flags.map((f) => f.code)).not.toContain('GUESSING')
  })

  it('meldet dauerhaft schwaches Verständnis', () => {
    const runs = [1, 2, 3, 4].map(() => run({ itemsTotal: 3, itemsCorrect: 1, responses: quiz([true, false, false], 6000) }))
    expect(computeStudentInsights(runs, questions).flags.map((f) => f.code)).toContain('LOW_COMPREHENSION')
  })

  it('meldet wiederholt unplausible Eigentempo-Messungen', () => {
    const runs = [900, 60, 1200, 70].map((measuredWpm) => run({ exerciseType: 'SELF_PACED', measuredWpm }))
    expect(computeStudentInsights(runs, questions).flags.map((f) => f.code)).toContain('IMPLAUSIBLE_PACE')
  })
})
