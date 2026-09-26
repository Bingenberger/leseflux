import type { ClozeGap, Text } from '@prisma/client'

const DEFAULT_GAP_INTERVAL = 7

/** Funktionswörter: werden weder zur Lücke noch zum Ablenker (sonst ist die Wahl zu leicht
 *  bzw. prüft Grammatikwissen statt Leseverstehen). */
const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  'und', 'oder', 'aber', 'doch', 'denn', 'sondern', 'als', 'wie', 'wenn', 'weil', 'dass', 'ob',
  'im', 'in', 'am', 'an', 'auf', 'aus', 'bei', 'mit', 'nach', 'von', 'vom', 'vor', 'zu', 'zum',
  'zur', 'für', 'über', 'unter', 'um', 'durch', 'gegen', 'ohne', 'bis', 'seit', 'ins', 'beim',
  'er', 'sie', 'es', 'wir', 'ihr', 'ich', 'du', 'man', 'sich', 'ihn', 'ihm', 'ihnen', 'uns',
  'sein', 'seine', 'seinen', 'seinem', 'seiner', 'ihre', 'ihren', 'ihrem', 'ihrer',
  'mein', 'meine', 'dein', 'deine', 'unser', 'unsere',
  'ist', 'sind', 'war', 'waren', 'hat', 'haben', 'hatte', 'hatten', 'wird', 'werden', 'wurde',
  'kann', 'können', 'konnte', 'nicht', 'auch', 'noch', 'schon', 'sehr', 'so', 'dann', 'da',
  'hier', 'dort', 'ja', 'nein', 'nur', 'mal', 'dieser', 'diese', 'dieses', 'diesen', 'alle',
  'viele', 'wo', 'was', 'wer', 'etwas', 'immer', 'jetzt',
])

export interface GeneratedClozeGap {
  id: string
  wordIndex: number
  correctWord: string
  distractors: string[]
  options: string[]
}

type Rng = () => number

function shuffle<T>(items: T[], rng: Rng = Math.random) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const current = copy[i]!
    copy[i] = copy[j]!
    copy[j] = current
  }
  return copy
}

function cleanWord(word: string) {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

function isCapitalized(word: string) {
  return /^\p{Lu}/u.test(word)
}

function isContentWord(word: string) {
  return word.length >= 3 && /^\p{L}+$/u.test(word) && !STOPWORDS.has(word.toLowerCase())
}

/** Indizes der Wörter, die einen Satz beginnen (Großschreibung dort ist kein Wortart-Hinweis). */
function sentenceStarts(displayWords: string[]) {
  const starts = new Set<number>([0])
  displayWords.forEach((word, i) => {
    if (/[.!?]["“”»«']*$/u.test(word)) starts.add(i + 1)
  })
  return starts
}

/** Wählt Ablenker, die der Lücke formal gleichen (Maze-Prinzip): gleiche Groß-/Kleinschreibung
 *  (≈ Nomen vs. andere Wortarten), möglichst gleiche Endung (≈ Flexion) und ähnliche Länge –
 *  aber aus anderen Texten, damit sie inhaltlich nicht passen. */
export function pickMazeDistractors(
  correctWord: string,
  pool: string[],
  excluded: Set<string>,
  count = 2,
  rng: Rng = Math.random,
): string[] {
  const cap = isCapitalized(correctWord)
  const lower = correctWord.toLowerCase()
  const candidates = [...new Set(pool)].filter((candidate) =>
    isContentWord(candidate)
    && isCapitalized(candidate) === cap
    && !excluded.has(candidate.toLowerCase())
    && candidate.toLowerCase() !== lower
    && Math.abs(candidate.length - correctWord.length) <= 3,
  )

  const tiers = [
    candidates.filter((c) => c.slice(-2).toLowerCase() === lower.slice(-2)),
    candidates.filter((c) => c.slice(-1).toLowerCase() === lower.slice(-1)),
    candidates,
  ]
  const chosen: string[] = []
  for (const tier of tiers) {
    for (const candidate of shuffle(tier, rng)) {
      if (chosen.length >= count) break
      if (!chosen.includes(candidate)) chosen.push(candidate)
    }
  }
  return chosen
}

/** Sammelt Ablenker-Kandidaten aus anderen Texten. Satzanfänge werden ausgelassen, weil ihre
 *  Großschreibung nichts über die Wortart verrät („Springen“, „Nachts“). */
export function mazePoolFromTexts(contents: string[]): string[] {
  return contents.flatMap((content) => {
    const words = content.split(/\s+/).filter(Boolean)
    const starts = sentenceStarts(words)
    return words.filter((_, i) => !starts.has(i)).map(cleanWord).filter(isContentWord)
  })
}

/** Erzeugt einen Maze-Lückentext: Der erste Satz bleibt vollständig, danach etwa jedes n-te
 *  Inhaltswort als Lücke (nie am Satzanfang, nie Funktionswörter, nie Adjektive direkt vor einem
 *  Nomen – dort passen formgleiche Ablenker meist auch inhaltlich). Ablenker stammen aus
 *  `distractorPool` (Wörter anderer Texte derselben Stufe, siehe `mazePoolFromTexts`). */
export function generateAutoCloze(
  text: Pick<Text, 'content'>,
  gapInterval = DEFAULT_GAP_INTERVAL,
  distractorPool: string[] = [],
  rng: Rng = Math.random,
) {
  const displayWords = text.content.split(/\s+/).filter(Boolean)
  const cleanWords = displayWords.map(cleanWord)
  const starts = sentenceStarts(displayWords)
  const ownWords = new Set(cleanWords.map((w) => w.toLowerCase()))
  const pool = distractorPool.map(cleanWord).filter(Boolean)

  // Kleingeschriebenes Wort direkt vor einem Nomen (meist attributives Adjektiv: „ein [altes] Haus“):
  // dort passen Ablenker derselben Form fast immer auch inhaltlich → keine eindeutige Lücke.
  const isAttributive = (i: number) => {
    const word = cleanWords[i] ?? ''
    const next = cleanWords[i + 1] ?? ''
    const endsClause = /[.,;:!?]["“”»«']*$/u.test(displayWords[i] ?? '')
    return !isCapitalized(word) && !endsClause && isCapitalized(next) && !starts.has(i + 1)
  }

  const firstSentenceEnd = [...starts].filter((i) => i > 0).sort((a, b) => a - b)[0] ?? 0

  const gaps: GeneratedClozeGap[] = []
  let next = Math.max(firstSentenceEnd, 0) + gapInterval - 1
  while (next < displayWords.length) {
    // Nächstes geeignetes Wort ab der Sollposition suchen (höchstens bis zur nächsten Sollposition)
    let index = -1
    for (let i = next; i < Math.min(displayWords.length, next + gapInterval); i++) {
      if (!starts.has(i) && isContentWord(cleanWords[i] ?? '') && !isAttributive(i)) {
        index = i
        break
      }
    }
    if (index === -1) {
      next += gapInterval
      continue
    }

    const correctWord = cleanWords[index]!
    const distractors = pickMazeDistractors(correctWord, pool, ownWords, 2, rng)
    if (distractors.length === 2) {
      gaps.push({
        id: `auto-${index}`,
        wordIndex: index,
        correctWord,
        distractors,
        options: shuffle([correctWord, ...distractors], rng),
      })
    }
    next = index + gapInterval
  }

  return { words: displayWords, gaps }
}

export function formatManualCloze(text: Pick<Text, 'content'>, gaps: ClozeGap[]) {
  const words = text.content.split(/\s+/).filter(Boolean)
  return {
    words,
    gaps: gaps.map((gap) => {
      const distractors = (Array.isArray(gap.distractors) ? gap.distractors : []) as string[]
      const options = shuffle([gap.correctWord, ...distractors]).slice(0, 3)
      return {
        id: gap.id,
        wordIndex: gap.wordIndex,
        correctWord: gap.correctWord,
        distractors,
        options: options.includes(gap.correctWord) ? options : [gap.correctWord, ...options.slice(0, 2)],
      }
    }),
  }
}
