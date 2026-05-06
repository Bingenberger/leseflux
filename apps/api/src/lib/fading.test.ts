import { describe, it, expect } from 'vitest'
import { calculateFadingTiming, splitIntoWords } from '@leseflux/shared'

describe('calculateFadingTiming', () => {
  it('total time per word decreases as WPM increases', () => {
    const slow = calculateFadingTiming(60, 'Hund')
    const fast = calculateFadingTiming(120, 'Hund')
    expect(slow.displayMs + slow.fadeOutMs).toBeGreaterThan(fast.displayMs + fast.fadeOutMs)
  })

  it('longer words get more time than shorter words at same WPM', () => {
    const short = calculateFadingTiming(100, 'Ei')
    const long = calculateFadingTiming(100, 'Wasserhahn')
    expect(long.displayMs).toBeGreaterThan(short.displayMs)
  })

  it('displayMs is roughly 70% of total time', () => {
    const { displayMs, fadeOutMs } = calculateFadingTiming(100, 'Beispiel')
    const ratio = displayMs / (displayMs + fadeOutMs)
    expect(ratio).toBeCloseTo(0.7, 1)
  })
})

describe('splitIntoWords', () => {
  it('splits on whitespace', () => {
    expect(splitIntoWords('Hallo Welt')).toEqual(['Hallo', 'Welt'])
  })

  it('handles multiple spaces', () => {
    expect(splitIntoWords('A  B   C')).toHaveLength(3)
  })

  it('trims empty strings', () => {
    expect(splitIntoWords('  ')).toHaveLength(0)
  })
})
