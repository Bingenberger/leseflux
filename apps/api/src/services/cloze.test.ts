import { describe, expect, it } from 'vitest'
import { generateAutoCloze } from './cloze.js'

describe('generateAutoCloze', () => {
  it('creates gaps at the configured interval', () => {
    const result = generateAutoCloze({
      content: 'Eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn vierzehn',
    }, 7)

    expect(result.words).toHaveLength(14)
    expect(result.gaps.map((gap) => gap.wordIndex)).toEqual([6, 13])
  })

  it('includes the correct word in each option set', () => {
    const result = generateAutoCloze({
      content: 'Mia findet einen kleinen Drachen hinter dem grünen Busch im Garten',
    }, 4)

    expect(result.gaps.length).toBeGreaterThan(0)
    for (const gap of result.gaps) {
      expect(gap.options).toContain(gap.correctWord)
    }
  })
})
