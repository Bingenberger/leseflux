import { describe, it, expect } from 'vitest'
import { buildFadingSchedule, calculateFadingTiming, splitIntoWords } from '@leseflux/shared'

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

describe('buildFadingSchedule', () => {
  const words = splitIntoWords('Der kleine Igel Fritz sucht im Garten nach leckerem Futter.')

  it('lässt den ganzen Text genau im Zieltempo ablaufen', () => {
    const { totalMs } = buildFadingSchedule(90, words)
    expect(totalMs).toBeCloseTo((words.length * 60_000) / 90, -1)
  })

  it('lässt das erste Wort nicht sofort verblassen', () => {
    const { fadeStartMs } = buildFadingSchedule(90, words)
    // mindestens 70 % eines durchschnittlichen Wortfensters
    expect(fadeStartMs[0]).toBeGreaterThan(0.7 * (60_000 / 90) * 0.6)
  })

  it('jedes Wort ist am Ende seines Fensters verschwunden, Fenster folgen lückenlos', () => {
    const { fadeStartMs, fadeMs, totalMs } = buildFadingSchedule(90, words)
    for (let i = 1; i < words.length; i++) {
      expect(fadeStartMs[i]!).toBeGreaterThan(fadeStartMs[i - 1]!)
    }
    const last = words.length - 1
    expect(fadeStartMs[last]! + fadeMs[last]!).toBeCloseTo(totalMs, -1)
  })

  it('gibt langen Wörtern mehr Zeit als kurzen', () => {
    const { fadeStartMs, fadeMs } = buildFadingSchedule(100, ['Ei', 'Wasserhahn'])
    // Lesezeit = Zeit vom Ende des vorherigen Fensters bis zum Beginn des Ausblendens
    const shortReadMs = fadeStartMs[0]!
    const longReadMs = fadeStartMs[1]! - (fadeStartMs[0]! + fadeMs[0]!)
    expect(longReadMs).toBeGreaterThan(shortReadMs)
  })

  it('liefert für leere Texte einen leeren Plan', () => {
    expect(buildFadingSchedule(90, [])).toEqual({ fadeStartMs: [], fadeMs: [], totalMs: 0 })
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
