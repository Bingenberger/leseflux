import Hypher from 'hypher'
import german from 'hyphenation.de'

const h = new Hypher(german)

/**
 * Splits a word into syllables using German hyphenation patterns.
 * Words shorter than 4 chars or containing digits/special chars are returned as-is.
 */
export function syllabify(word: string): string[] {
  if (word.length < 4 || /\d/.test(word)) return [word]
  const parts = h.hyphenate(word)
  return parts.length > 0 ? parts : [word]
}
