import { describe, expect, it } from 'vitest'
import { countSyllables, refineSyllables } from '@leseflux/shared'

describe('countSyllables', () => {
  it.each([
    ['Ei', 1], ['Haus', 1], ['Igel', 2], ['Schule', 2], ['Regenwürmer', 4], ['Schmetterling', 3],
    ['neue', 2], ['Mia', 2], ['Radio', 3], ['Feuer', 2], ['Biene', 2], ['Quelle', 2], ['Kaffee', 2],
    ['Rücken.', 2], ['„Hallo!“', 2],
  ])('%s → %i', (word, count) => {
    expect(countSyllables(word)).toBe(count)
  })
})

describe('refineSyllables', () => {
  it.each([
    [['Mia'], ['Mi', 'a']],
    [['neue'], ['neu', 'e']],
    [['Ra', 'dio'], ['Ra', 'di', 'o']],
    [['Oa', 'se'], ['O', 'a', 'se']],
    [['über'], ['ü', 'ber']],
    [['Idee'], ['I', 'dee']],
    [['I', 'gel'], ['I', 'gel']],
    [['Schu', 'le'], ['Schu', 'le']],
    [['Bau', 'er'], ['Bau', 'er']],
    [['Quel', 'le'], ['Quel', 'le']],
    [['Ente'], ['Ente']],
  ])('%j → %j', (parts, expected) => {
    expect(refineSyllables(parts)).toEqual(expected)
  })
})
