import { describe, expect, it } from 'vitest'
import { generateAutoCloze, mazePoolFromTexts, pickMazeDistractors } from './cloze.js'

const TEXT = 'Der kleine Igel Fritz sucht im Garten nach Futter. Er liebt Regenwürmer und Schnecken. '
  + 'Fritz hat viele Stacheln auf dem Rücken. Wenn Gefahr droht, rollt er sich schnell zu einer Kugel zusammen. '
  + 'Im Herbst frisst Fritz viel, um sich Winterspeck anzulegen.'

const POOL = mazePoolFromTexts([
  'Die Katze schläft gern auf dem Sofa. Der Vogel singt laut im Baum. Anna malt bunte Bilder. '
  + 'Der Bäcker backt frische Brötchen. Tom spielt Fußball mit Freunden. Die Blumen wachsen langsam. '
  + 'Oma liest spannende Bücher. Der Hund bellt laut. Die Kinder lachen fröhlich. Der Zug fährt schnell.',
])

function seeded(seed = 1) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

describe('generateAutoCloze (Maze)', () => {
  const result = generateAutoCloze({ content: TEXT }, 7, POOL, seeded())

  it('lässt den ersten Satz vollständig', () => {
    const firstSentenceLength = 'Der kleine Igel Fritz sucht im Garten nach Futter.'.split(' ').length
    expect(result.gaps.length).toBeGreaterThan(0)
    for (const gap of result.gaps) expect(gap.wordIndex).toBeGreaterThanOrEqual(firstSentenceLength)
  })

  it('setzt keine Lücken auf Funktionswörter oder Satzanfänge', () => {
    for (const gap of result.gaps) {
      expect(['und', 'er', 'sich', 'zu', 'einer', 'um', 'auf', 'dem']).not.toContain(gap.correctWord.toLowerCase())
      const previous = result.words[gap.wordIndex - 1] ?? ''
      expect(previous).not.toMatch(/[.!?]$/)
    }
  })

  it('setzt keine Lücke auf ein Adjektiv direkt vor einem Nomen', () => {
    const r = generateAutoCloze(
      { content: 'Heute ist ein schöner Tag. Im Garten gibt es ein altes Haus mit einem roten Dach und vielen Fenstern.' },
      2,
      POOL,
      seeded(7),
    )
    const gapWords = r.gaps.map((g) => g.correctWord)
    expect(gapWords).not.toContain('altes')
    expect(gapWords).not.toContain('roten')
  })

  it('bietet genau drei Optionen inkl. der richtigen, Ablenker nicht aus dem eigenen Text', () => {
    const own = new Set(TEXT.split(/\s+/).map((w) => w.replace(/[^\p{L}]/gu, '').toLowerCase()))
    for (const gap of result.gaps) {
      expect(gap.options).toHaveLength(3)
      expect(gap.options).toContain(gap.correctWord)
      for (const d of gap.distractors) expect(own.has(d.toLowerCase())).toBe(false)
    }
  })

  it('hält Lücken etwa im eingestellten Abstand', () => {
    const indices = result.gaps.map((g) => g.wordIndex)
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]! - indices[i - 1]!).toBeGreaterThanOrEqual(7)
    }
  })

  it('erzeugt ohne Ablenker-Pool keine Lücken statt unpassender Optionen', () => {
    expect(generateAutoCloze({ content: TEXT }, 7, []).gaps).toHaveLength(0)
  })
})

describe('pickMazeDistractors', () => {
  it('wählt für Nomen großgeschriebene Ablenker', () => {
    const picked = pickMazeDistractors('Garten', POOL, new Set(), 2, seeded(3))
    expect(picked).toHaveLength(2)
    for (const p of picked) expect(p).toMatch(/^\p{Lu}/u)
  })

  it('bevorzugt gleiche Endung bei kleingeschriebenen Wörtern', () => {
    const picked = pickMazeDistractors('wachsen', ['lachen', 'backt', 'singt', 'spielen'], new Set(), 2, seeded(5))
    expect(picked.sort()).toEqual(['lachen', 'spielen'])
  })

  it('schließt Funktionswörter und ausgeschlossene Wörter aus', () => {
    const picked = pickMazeDistractors('laufen', ['und', 'aber', 'springen', 'rennen'], new Set(['rennen']), 2, seeded())
    expect(picked).toEqual(['springen'])
  })
})

describe('mazePoolFromTexts', () => {
  it('lässt Satzanfänge und Funktionswörter aus', () => {
    expect(mazePoolFromTexts(['Springen macht Spaß. Nachts schlafen Eulen nicht.']))
      .toEqual(['macht', 'Spaß', 'schlafen', 'Eulen'])
  })
})
