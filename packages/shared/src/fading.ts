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

/** Teilt einen Text in Wörter auf (bereinigt Satzzeichen, behält Wortform für Anzeige). */
export function splitIntoWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
}
