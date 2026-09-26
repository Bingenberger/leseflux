import { describe, it, expect } from 'vitest'
import { optionPermutation, shuffleQuestionOptions, toOriginalOptionIndex } from './quizOptions.js'

describe('shuffleQuestionOptions', () => {
  const options = ['Fell', 'Stacheln', 'Federn']

  it('behält alle Optionen und markiert weiterhin die richtige', () => {
    const shuffled = shuffleQuestionOptions('run-1', 'q-1', options, 1)
    expect([...shuffled.options].sort()).toEqual([...options].sort())
    expect(shuffled.options[shuffled.correctIndex]).toBe('Stacheln')
  })

  it('ist für denselben Lauf deterministisch', () => {
    expect(shuffleQuestionOptions('run-1', 'q-1', options, 1))
      .toEqual(shuffleQuestionOptions('run-1', 'q-1', options, 1))
  })

  it('verteilt die richtige Antwort über alle Positionen', () => {
    const positions = new Set<number>()
    for (let i = 0; i < 50; i++) {
      positions.add(shuffleQuestionOptions(`run-${i}`, 'q-1', options, 1).correctIndex)
    }
    expect(positions).toEqual(new Set([0, 1, 2]))
  })

  it('Rückübersetzung liefert den gespeicherten Index', () => {
    for (let i = 0; i < 20; i++) {
      const runId = `run-${i}`
      const shuffled = shuffleQuestionOptions(runId, 'q-7', options, 1)
      shuffled.options.forEach((option, displayIndex) => {
        const original = toOriginalOptionIndex(runId, 'q-7', options.length, displayIndex)
        expect(options[original]).toBe(option)
      })
      expect(toOriginalOptionIndex(runId, 'q-7', options.length, shuffled.correctIndex)).toBe(1)
    }
  })

  it('liefert -1 für ungültige Anzeige-Indizes', () => {
    expect(toOriginalOptionIndex('run-1', 'q-1', 3, 5)).toBe(-1)
  })
})

describe('optionPermutation', () => {
  it('ist eine gültige Permutation', () => {
    const perm = optionPermutation('seed', 4)
    expect([...perm].sort()).toEqual([0, 1, 2, 3])
  })
})
