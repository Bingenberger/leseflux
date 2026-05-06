import { describe, it, expect } from 'vitest'
import { runAdaptiveEngine, updateRollingAccuracy } from './adaptive.js'

describe('updateRollingAccuracy', () => {
  it('returns the new value when no previous value', () => {
    expect(updateRollingAccuracy(null, 0.8)).toBe(0.8)
  })

  it('blends toward new value', () => {
    const result = updateRollingAccuracy(0.5, 1.0, 10)
    expect(result).toBeGreaterThan(0.5)
    expect(result).toBeLessThan(1.0)
  })
})

describe('runAdaptiveEngine', () => {
  const base = {
    currentTargetWpm: 80,
    sessionsSinceLastIncrease: 0,
    totalSessions: 0,
    averageQuizAccuracy: null,
  }

  it('does not change WPM below threshold', () => {
    const result = runAdaptiveEngine({ ...base, sessionsSinceLastIncrease: 3 }, 0.8, 3)
    expect(result.currentTargetWpm).toBe(80)
  })

  it('increases WPM after 5 sessions with high accuracy', () => {
    const result = runAdaptiveEngine(
      { ...base, sessionsSinceLastIncrease: 5, averageQuizAccuracy: 0.75 },
      0.8,
      3,
    )
    expect(result.currentTargetWpm).toBe(85)
    expect(result.sessionsSinceLastIncrease).toBe(0)
  })

  it('decreases WPM after 5 sessions with low accuracy', () => {
    const result = runAdaptiveEngine(
      { ...base, sessionsSinceLastIncrease: 5, averageQuizAccuracy: 0.3 },
      0.25,
      3,
    )
    expect(result.currentTargetWpm).toBe(75)
  })

  it('does not go below minimum WPM for level', () => {
    const result = runAdaptiveEngine(
      { ...base, currentTargetWpm: 32, sessionsSinceLastIncrease: 5, averageQuizAccuracy: 0.1 },
      0.1,
      2,
    )
    expect(result.currentTargetWpm).toBe(30)
  })

  it('flags intermediate diagnostic every 10 sessions', () => {
    const result = runAdaptiveEngine(
      { ...base, totalSessions: 9 },
      0.5,
      3,
    )
    expect(result.offerIntermediateDiagnostic).toBe(true)
    expect(result.totalSessions).toBe(10)
  })
})
