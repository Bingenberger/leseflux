import { describe, it, expect } from 'vitest'
import { runAdaptiveEngine, runFlashAdaptiveEngine, updateRollingAccuracy } from './adaptive.js'

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

describe('runFlashAdaptiveEngine', () => {
  const base = {
    flashWordLevel: 1,
    flashWordDurationMs: 500,
    flashSessionsSinceIncrease: 2,
  }

  it('decreases display duration after 3 strong flash runs', () => {
    const result = runFlashAdaptiveEngine(base, 0.9)
    expect(result.flashWordDurationMs).toBe(450)
    expect(result.flashSessionsSinceIncrease).toBe(0)
  })

  it('increases display duration after weak flash runs', () => {
    const result = runFlashAdaptiveEngine(base, 0.4)
    expect(result.flashWordDurationMs).toBe(550)
    expect(result.flashSessionsSinceIncrease).toBe(0)
  })

  it('levels up when duration would go below minimum', () => {
    const result = runFlashAdaptiveEngine(
      { ...base, flashWordDurationMs: 250 },
      0.9,
    )
    expect(result.flashWordLevel).toBe(2)
    expect(result.flashWordDurationMs).toBe(500)
  })
})

describe('runAdaptiveEngine', () => {
  const base = {
    fadingTargetWpm: 80,
    fadingSessionsSinceIncrease: 0,
    totalSessions: 0,
    averageQuizAccuracy: null,
  }

  it('does not change WPM below threshold', () => {
    const result = runAdaptiveEngine({ ...base, fadingSessionsSinceIncrease: 3 }, 0.8, 3)
    expect(result.fadingTargetWpm).toBe(80)
  })

  it('increases WPM after 5 sessions with high accuracy', () => {
    const result = runAdaptiveEngine(
      { ...base, fadingSessionsSinceIncrease: 5, averageQuizAccuracy: 0.75 },
      0.8,
      3,
    )
    expect(result.fadingTargetWpm).toBe(85)
    expect(result.fadingSessionsSinceIncrease).toBe(0)
  })

  it('decreases WPM after 5 sessions with low accuracy', () => {
    const result = runAdaptiveEngine(
      { ...base, fadingSessionsSinceIncrease: 5, averageQuizAccuracy: 0.3 },
      0.25,
      3,
    )
    expect(result.fadingTargetWpm).toBe(75)
  })

  it('does not go below minimum WPM for level', () => {
    const result = runAdaptiveEngine(
      { ...base, fadingTargetWpm: 32, fadingSessionsSinceIncrease: 5, averageQuizAccuracy: 0.1 },
      0.1,
      2,
    )
    expect(result.fadingTargetWpm).toBe(30)
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
