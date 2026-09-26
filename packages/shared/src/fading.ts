/** Berechnet Anzeige- und Fade-Dauer pro Wort für den Fading-Reader. */
export function calculateFadingTiming(targetWpm: number, word: string) {
  const msPerAverageWord = 60_000 / targetWpm
  const baseDisplayMs = msPerAverageWord * 0.7
  const fadeOutMs = msPerAverageWord * 0.3

  // Wurzel-skalierte Längenkorrektur: 5,5 Zeichen = 100 %, lange Wörter werden nicht überproportional verlängert
  const lengthFactor = word.length / 5.5
  const adjustedFactor = 0.6 + 0.4 * Math.sqrt(lengthFactor)

  return {
    displayMs: Math.round(baseDisplayMs * adjustedFactor),
    fadeOutMs: Math.round(fadeOutMs * adjustedFactor),
  }
}

export interface FadingSchedule {
  /** Zeitpunkt (ms ab Start), ab dem Wort i zu verblassen beginnt */
  fadeStartMs: number[]
  /** Dauer des Ausblendens von Wort i (ms) */
  fadeMs: number[]
  /** Zeitpunkt, zu dem das letzte Wort vollständig verschwunden ist */
  totalMs: number
}

/** Zeitplan für einen vollständig sichtbaren Text, dessen Wörter nacheinander verblassen.
 *  Jedes Wort erhält ein Zeitfenster (Anzeige + Ausblenden) und ist am Ende seines Fensters
 *  verschwunden. Die Fenster werden so skaliert, dass der ganze Text exakt im Zieltempo
 *  abläuft (Wörter × 60 000 / targetWpm); die Längenkorrektur verteilt die Zeit nur um. */
export function buildFadingSchedule(targetWpm: number, words: string[]): FadingSchedule {
  const timings = words.map((word) => calculateFadingTiming(targetWpm, word))
  const rawTotal = timings.reduce((sum, t) => sum + t.displayMs + t.fadeOutMs, 0)
  const targetTotal = (words.length * 60_000) / targetWpm
  const scale = rawTotal > 0 ? targetTotal / rawTotal : 1

  const fadeStartMs: number[] = []
  const fadeMs: number[] = []
  let slotStart = 0
  for (const { displayMs, fadeOutMs } of timings) {
    const display = displayMs * scale
    const fade = fadeOutMs * scale
    fadeStartMs.push(Math.round(slotStart + display))
    fadeMs.push(Math.round(fade))
    slotStart += display + fade
  }

  return { fadeStartMs, fadeMs, totalMs: Math.round(slotStart) }
}

/** Teilt einen Text in Wörter auf (bereinigt Satzzeichen, behält Wortform für Anzeige). */
export function splitIntoWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
}
