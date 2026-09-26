import { describe, expect, it } from 'vitest'
import { flashWordsFromText, similarWordDistractors } from './flashWords.js'

function seeded(seed = 1) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

describe('similarWordDistractors', () => {
  it.each(['Garten', 'Schnecken', 'spielen', 'Stacheln', 'Winterschlaf'])('%s: zwei verschiedene, ähnliche Ablenker', (word) => {
    const distractors = similarWordDistractors(word, seeded(3))
    expect(distractors).toHaveLength(2)
    expect(new Set(distractors.map((d) => d.toLowerCase())).size).toBe(2)
    for (const d of distractors) {
      expect(d.toLowerCase()).not.toBe(word.toLowerCase())
      expect(Math.abs(d.length - word.length)).toBeLessThanOrEqual(1)
      expect(d[0] === d[0]!.toUpperCase()).toBe(word[0] === word[0]!.toUpperCase())
    }
  })

  it('nutzt typische Verwechslungen wie ei/ie', () => {
    const all = new Set<string>()
    for (let run = 0; run < 200; run++) similarWordDistractors('Eimer').forEach((d) => all.add(d))
    expect(all.has('Iemer')).toBe(true)
  })
})

describe('flashWordsFromText', () => {
  const text = 'Der kleine Igel Fritz sucht im Garten nach Futter. Er liebt Regenwürmer und Schnecken. '
    + 'Fritz hat viele Stacheln auf dem Rücken. Im Garten ist es schön.'

  it('wählt mehrsilbige Inhaltswörter ohne Doppelungen', () => {
    const words = flashWordsFromText(text, 10, 2, seeded())
    const list = words.map((w) => w.word)
    expect(new Set(list).size).toBe(list.length)
    expect(list).not.toContain('Der')
    expect(list).not.toContain('sucht')
    expect(list).toContain('Garten')
    for (const w of words) {
      expect(w.syllables).toBeGreaterThanOrEqual(2)
      expect(w.distractors).toHaveLength(2)
      expect(w.id).toMatch(/^text-/)
    }
  })

  it('begrenzt auf die gewünschte Anzahl', () => {
    expect(flashWordsFromText(text, 3, 2, seeded())).toHaveLength(3)
  })
})
