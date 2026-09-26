import { describe, it, expect } from 'vitest'
import {
  buildFadingSchedule,
  pauseAfter,
  calculateFadingTiming,
  repeatedReadingPassWpm,
  splitIntoWords,
} from '@leseflux/shared'

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

  it('misst die Wortlänge in Silben, nicht in Buchstaben', () => {
    // „Schrank“ (7 Buchstaben, 1 Silbe) bekommt nicht mehr Zeit als „Oma“ (3 Buchstaben, 2 Silben)
    const oneSyllable = calculateFadingTiming(100, 'Schrank')
    const twoSyllables = calculateFadingTiming(100, 'Oma')
    expect(twoSyllables.displayMs).toBeGreaterThan(oneSyllable.displayMs)
  })

  it('macht nach Satzende und Komma eine Pause, ohne das Gesamttempo zu ändern', () => {
    const plain = buildFadingSchedule(90, ['Mia', 'lief', 'los', 'und', 'Tim', 'rief'])
    const punctuated = buildFadingSchedule(90, ['Mia', 'lief', 'los.', 'Und', 'Tim', 'rief'])
    expect(punctuated.totalMs).toBeCloseTo(plain.totalMs, -1)
    // Abstand zwischen „los.“ und „Und“ größer als zwischen „lief“ und „los.“
    const beforeStop = punctuated.fadeStartMs[2]! - punctuated.fadeStartMs[1]!
    const afterStop = punctuated.fadeStartMs[3]! - punctuated.fadeStartMs[2]!
    expect(afterStop).toBeGreaterThan(beforeStop * 1.4)
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

describe('pauseAfter', () => {
  it.each([
    ['Haus', 0], ['Haus.', 0.6], ['Hilfe!', 0.6], ['sagte:', 0.3], ['Garten,', 0.3], ['Mia.“', 0.6], ['„Hallo', 0],
  ])('%s → %s', (word, pause) => {
    expect(pauseAfter(word)).toBe(pause)
  })
})

describe('repeatedReadingPassWpm', () => {
  const cfg = { passFactors: [1.1, 1.2], baseMinFactor: 0.8, baseMaxFactor: 1.2 }

  it('steigert vom Kaltlesetempo aus um 10 % und 20 %', () => {
    expect(repeatedReadingPassWpm(80, 75, cfg)).toEqual([83, 90])
  })

  it('nutzt das Fading-Ziel, wenn keine Messung vorliegt', () => {
    expect(repeatedReadingPassWpm(80, null, cfg)).toEqual([88, 96])
  })

  it('begrenzt unplausible Kaltlesewerte auf das Band um das Ziel', () => {
    expect(repeatedReadingPassWpm(80, 900, cfg)).toEqual([106, 115])
    expect(repeatedReadingPassWpm(80, 10, cfg)).toEqual([70, 77])
  })
})
