import { describe, it, expect } from 'vitest'
import { calculateLix, estimateWpmFromDiagnostic, levelFromWpm } from '@leseflux/shared'

describe('calculateLix', () => {
  it('returns 0 for empty text', () => {
    expect(calculateLix('')).toBe(0)
  })

  it('simple short sentence has low LIX', () => {
    const lix = calculateLix('Der Hund läuft.')
    expect(lix).toBeLessThan(30)
  })

  it('complex text with long words has higher LIX', () => {
    const simple = calculateLix('Die Katze sitzt im Garten.')
    const complex = calculateLix(
      'Die Übergangsgeschwindigkeit des Verkehrsflusses beeinflusst die Durchlaufoptimierung.',
    )
    expect(complex).toBeGreaterThan(simple)
  })
})

describe('estimateWpmFromDiagnostic', () => {
  it('returns 0 for zero duration', () => {
    expect(estimateWpmFromDiagnostic(10, 6, 0)).toBe(0)
  })

  it('calculates correctly', () => {
    // 30 correct × 6 words/sentence ÷ (90s / 60) = 120 WPM
    expect(estimateWpmFromDiagnostic(30, 6, 90)).toBe(120)
  })
})

describe('levelFromWpm', () => {
  it('returns 2 for low WPM', () => expect(levelFromWpm(60)).toBe(2))
  it('returns 3 for medium WPM', () => expect(levelFromWpm(90)).toBe(3))
  it('returns 4 for high WPM', () => expect(levelFromWpm(120)).toBe(4))
})
