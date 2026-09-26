import { countSyllables } from '@leseflux/shared'
import { cleanWord, isContentWord } from './cloze.js'

type Rng = () => number

/** Buchstaben(-gruppen), die Leseanfänger leicht verwechseln (visuell oder lautlich ähnlich) */
const CONFUSIONS: [string, string][] = [
  ['ei', 'ie'], ['ie', 'ei'], ['b', 'd'], ['d', 'b'], ['p', 'b'], ['m', 'n'], ['n', 'm'],
  ['h', 'k'], ['k', 'h'], ['a', 'o'], ['o', 'a'], ['u', 'ü'], ['ü', 'u'], ['ö', 'o'],
  ['ä', 'a'], ['t', 'f'], ['f', 't'], ['l', 't'], ['r', 'n'], ['e', 'a'],
]

function shuffle<T>(items: T[], rng: Rng): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const current = copy[i]!
    copy[i] = copy[j]!
    copy[j] = current
  }
  return copy
}

function matchCase(original: string, replacement: string) {
  return original[0] === original[0]?.toUpperCase()
    ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
    : replacement
}

/** Erzeugt zwei ähnlich aussehende Ablenker für ein Wort (Verwechslung ähnlicher Buchstaben
 *  oder Vertauschen zweier benachbarter Buchstaben im Wortinneren). Bevorzugt zwei
 *  verschiedene Veränderungsarten, damit die Wahl nicht über ein einziges Merkmal geht. */
export function similarWordDistractors(word: string, rng: Rng = Math.random): string[] {
  const lower = word.toLowerCase()
  const substitutions: string[] = []
  for (const [from, to] of CONFUSIONS) {
    let index = lower.indexOf(from)
    while (index !== -1) {
      substitutions.push(matchCase(word, lower.slice(0, index) + to + lower.slice(index + from.length)))
      index = lower.indexOf(from, index + 1)
    }
  }
  const transpositions: string[] = []
  for (let i = 1; i < lower.length - 2; i++) {
    if (lower[i] === lower[i + 1]) continue
    transpositions.push(matchCase(word, lower.slice(0, i) + lower[i + 1] + lower[i] + lower.slice(i + 2)))
  }

  const valid = (candidate: string) => candidate.toLowerCase() !== lower
  const pools = [shuffle(substitutions.filter(valid), rng), shuffle(transpositions.filter(valid), rng)]
  const chosen: string[] = []
  // Abwechselnd aus beiden Arten ziehen
  for (let round = 0; chosen.length < 2 && round < 50; round++) {
    const pool = pools[round % 2]!
    const next = pool.find((candidate) => !chosen.some((c) => c.toLowerCase() === candidate.toLowerCase()))
    if (next) chosen.push(next)
    if (pools.every((p) => p.every((c) => chosen.includes(c)))) break
  }
  return chosen
}

export interface TextFlashWord {
  id: string
  word: string
  syllables: number
  difficultyLevel: number
  distractors: string[]
}

/** Wählt Wörter aus dem folgenden Lesetext für den Wortblitz (Vorentlastung): mehrsilbige
 *  Inhaltswörter, jedes nur einmal, mit erzeugten ähnlichen Ablenkern. */
export function flashWordsFromText(
  content: string,
  count: number,
  difficultyLevel: number,
  rng: Rng = Math.random,
): TextFlashWord[] {
  const seen = new Set<string>()
  const candidates: string[] = []
  for (const raw of content.split(/\s+/)) {
    const word = cleanWord(raw)
    const key = word.toLowerCase()
    if (seen.has(key) || !isContentWord(word) || word.length < 4 || word.length > 14) continue
    if (countSyllables(word) < 2) continue
    seen.add(key)
    candidates.push(word)
  }
  return shuffle(candidates, rng)
    .map((word, i) => ({
      id: `text-${i}`,
      word,
      syllables: countSyllables(word),
      difficultyLevel,
      distractors: similarWordDistractors(word, rng),
    }))
    .filter((item) => item.distractors.length === 2)
    .slice(0, count)
}
