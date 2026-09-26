import Hypher from 'hypher'
import german from 'hyphenation.de'
import { refineSyllables } from '@leseflux/shared'

// Trennmuster mit gelockerter Mindestlänge links: Sprechsilben wie „I-gel“, „O-ma“ statt
// Rechtschreib-Trennung (die einzelne Buchstaben am Wortanfang nie abtrennt).
// Rechts bleibt 2, sonst entstehen falsche Endsilben („A-ben-d“).
const h = new Hypher({ ...german, leftmin: 1, rightmin: 2 })

/**
 * Zerlegt ein Wort in Sprechsilben (für die Silbenfärbung).
 * Satzzeichen am Rand bleiben an der ersten bzw. letzten Silbe hängen.
 */
export function syllabify(word: string): string[] {
  const match = word.match(/^([^\p{L}]*)(.*?)([^\p{L}]*)$/u)
  const [, prefix = '', core = '', suffix = ''] = match ?? []
  if (core.length < 2 || /\d/.test(core) || /[^\p{L}-]/u.test(core)) return [word]

  const parts = refineSyllables(h.hyphenate(core))
  if (parts.length === 0) return [word]
  parts[0] = prefix + parts[0]
  parts[parts.length - 1] = parts[parts.length - 1] + suffix
  return parts
}
