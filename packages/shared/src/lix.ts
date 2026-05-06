/** Berechnet den LIX-Lesbarkeitsindex eines deutschen Textes.
 *  LIX = (W/S) + (L×100)/W
 *  W = Wörter, S = Sätze, L = Wörter mit mehr als 6 Buchstaben
 */
export function calculateLix(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0)
  const words = text.split(/\s+/).filter((w) => w.length > 0)
  const longWords = words.filter(
    (w) => w.replace(/[^a-zA-ZäöüÄÖÜß]/g, '').length > 6,
  )

  const W = words.length
  const S = sentences.length
  const L = longWords.length

  if (W === 0 || S === 0) return 0
  return Math.round(((W / S + (L * 100) / W) * 10) / 10)
}

/** Schätzt WPM aus Diagnostik-Ergebnissen. */
export function estimateWpmFromDiagnostic(
  correctCount: number,
  avgWordsPerSentence: number,
  durationSec: number,
): number {
  if (durationSec === 0) return 0
  return Math.round((avgWordsPerSentence * correctCount) / (durationSec / 60))
}

/** Bestimmt die Zielstufe (2/3/4) aus WPM. */
export function levelFromWpm(wpm: number): 2 | 3 | 4 {
  if (wpm < 80) return 2
  if (wpm < 110) return 3
  return 4
}
