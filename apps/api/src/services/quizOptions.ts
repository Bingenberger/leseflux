import { createHash } from 'crypto'

/** Deterministische Permutation der Indizes 0..n-1, abgeleitet aus einem Seed.
 *  permutation[displayIndex] = originalIndex */
export function optionPermutation(seed: string, n: number): number[] {
  const hash = createHash('sha256').update(seed).digest()
  const perm = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = hash[i % hash.length]! % (i + 1)
    const current = perm[i]!
    perm[i] = perm[j]!
    perm[j] = current
  }
  return perm
}

function seedFor(runId: string, questionId: string) {
  return `${runId}:${questionId}`
}

/** Mischt die Antwortoptionen einer Frage pro Übungslauf, damit die Position der richtigen
 *  Antwort nicht erraten werden kann (im Korpus liegt sie überwiegend auf B). */
export function shuffleQuestionOptions(
  runId: string,
  questionId: string,
  options: string[],
  correctIndex: number,
) {
  const perm = optionPermutation(seedFor(runId, questionId), options.length)
  return {
    options: perm.map((originalIndex) => options[originalIndex]!),
    correctIndex: perm.indexOf(correctIndex),
  }
}

/** Übersetzt den vom Kind gewählten Anzeige-Index zurück in den Index der gespeicherten Frage. */
export function toOriginalOptionIndex(
  runId: string,
  questionId: string,
  optionCount: number,
  displayIndex: number,
): number {
  const perm = optionPermutation(seedFor(runId, questionId), optionCount)
  return perm[displayIndex] ?? -1
}
