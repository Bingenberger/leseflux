import { describe, it, expect } from 'vitest'
import {
  blendDiagnosticTarget,
  calibrateFromMeasurement,
  readingQuizAccuracy,
  runAdaptiveEngine,
  runFlashAdaptiveEngine,
  updateRollingAccuracy,
} from './adaptive.js'

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

describe('readingQuizAccuracy', () => {
  it('berechnet die Genauigkeit über alle Lese-Läufe', () => {
    expect(readingQuizAccuracy([
      { itemsTotal: 3, itemsCorrect: 3 },
      { itemsTotal: 3, itemsCorrect: 0 },
    ])).toBe(0.5)
  })

  it('gibt null zurück, wenn keine Fragen beantwortet wurden', () => {
    expect(readingQuizAccuracy([])).toBeNull()
    expect(readingQuizAccuracy([{ itemsTotal: 0, itemsCorrect: 0 }])).toBeNull()
  })
})

describe('calibrateFromMeasurement', () => {
  const understood = { itemsTotal: 3, itemsCorrect: 3 }

  it('zieht das Ziel Richtung gemessenes Tempo (leicht darüber)', () => {
    // 0,5 × 80 + 0,5 × 90 × 1,05 = 87,25 → +7
    expect(calibrateFromMeasurement(80, [{ measuredWpm: 90, ...understood }], 30)).toBe(87)
  })

  it('begrenzt die Änderung pro Messtag', () => {
    expect(calibrateFromMeasurement(80, [{ measuredWpm: 200, ...understood }], 30)).toBe(90)
    expect(calibrateFromMeasurement(80, [{ measuredWpm: 30, ...understood }], 30)).toBe(70)
  })

  it('ignoriert Messungen ohne ausreichendes Verständnis', () => {
    expect(calibrateFromMeasurement(80, [{ measuredWpm: 120, itemsTotal: 3, itemsCorrect: 1 }], 30)).toBe(80)
  })

  it('ignoriert unplausible Messwerte (z. B. sofort „Fertig“ getippt)', () => {
    expect(calibrateFromMeasurement(80, [{ measuredWpm: 900, ...understood }], 30)).toBe(80)
    expect(calibrateFromMeasurement(80, [{ measuredWpm: null, ...understood }], 30)).toBe(80)
  })

  it('unterschreitet das Mindesttempo nicht', () => {
    expect(calibrateFromMeasurement(35, [{ measuredWpm: 20, ...understood }], 30)).toBe(30)
  })
})

describe('blendDiagnosticTarget', () => {
  it('verrechnet Diagnose und Trainingsziel je zur Hälfte', () => {
    expect(blendDiagnosticTarget(80, 90)).toBe(85)
  })

  it('verwirft den Trainingsfortschritt nicht bei einem schwachen Diagnosetag', () => {
    // Diagnose 40 WPM → höchstens −15
    expect(blendDiagnosticTarget(100, 40)).toBe(85)
  })

  it('begrenzt auch Sprünge nach oben', () => {
    expect(blendDiagnosticTarget(60, 150)).toBe(75)
  })
})
