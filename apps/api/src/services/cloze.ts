import type { ClozeGap, Text } from '@prisma/client'

const DEFAULT_GAP_INTERVAL = 7

const COMMON_DISTRACTORS = [
  'und',
  'aber',
  'dann',
  'heute',
  'klein',
  'groß',
  'schnell',
  'langsam',
]

export interface GeneratedClozeGap {
  id: string
  wordIndex: number
  correctWord: string
  distractors: string[]
  options: string[]
}

function shuffle<T>(items: T[]) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = copy[i]!
    copy[i] = copy[j]!
    copy[j] = current
  }
  return copy
}

function cleanWord(word: string) {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

function sameShapeDistractor(word: string, words: string[]) {
  const lower = word.toLowerCase()
  const sameLength = words.find((candidate) =>
    candidate.toLowerCase() !== lower && Math.abs(candidate.length - word.length) <= 2,
  )
  return sameLength ?? words.find((candidate) => candidate.toLowerCase() !== lower) ?? 'Wort'
}

export function generateAutoCloze(text: Pick<Text, 'content'>, gapInterval = DEFAULT_GAP_INTERVAL) {
  const displayWords = text.content.split(/\s+/).filter(Boolean)
  const cleanWords = displayWords.map(cleanWord).filter((word) => word.length > 0)

  const gaps: GeneratedClozeGap[] = []
  for (let i = gapInterval - 1; i < displayWords.length; i += gapInterval) {
    const correctWord = cleanWord(displayWords[i] ?? '')
    if (correctWord.length < 3) continue

    const distractorFromText = sameShapeDistractor(correctWord, cleanWords)
    const common = COMMON_DISTRACTORS.find((candidate) => candidate.toLowerCase() !== correctWord.toLowerCase())
      ?? 'dann'
    const distractors = [...new Set([common, distractorFromText])]
    const options = shuffle([correctWord, ...distractors]).slice(0, 3)

    gaps.push({
      id: `auto-${i}`,
      wordIndex: i,
      correctWord,
      distractors,
      options: options.includes(correctWord) ? options : [correctWord, ...options.slice(0, 2)],
    })
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
