import { countSyllables } from './syllables'

/** Durchschnittliche Silbenzahl eines Wortes in Kindertexten (Bezugsgröße der Längenkorrektur) */
const AVERAGE_SYLLABLES = 1.8

/** Pausen an Satzgrenzen, relativ zur durchschnittlichen Zeit pro Wort. Sie gliedern den Text
 *  prosodisch (Atempause am Satzende, kurzes Absetzen am Komma) und sind im Zieltempo enthalten. */
export const FADING_PAUSES = {
  sentenceEnd: 0.6,
  clause: 0.3,
} as const

/** Berechnet Anzeige- und Fade-Dauer pro Wort für den Fading-Reader.
 *  Die Längenkorrektur folgt der Silbenzahl (bei Leseanfängern ein besserer Prädiktor der
 *  Lesezeit als die Buchstabenzahl); Satzzeichen zählen nicht mit. */
export function calculateFadingTiming(targetWpm: number, word: string) {
  const msPerAverageWord = 60_000 / targetWpm
  const baseDisplayMs = msPerAverageWord * 0.7
  const fadeOutMs = msPerAverageWord * 0.3

  // Wurzel-skalierte Längenkorrektur: 1,8 Silben = 100 %, lange Wörter werden nicht überproportional verlängert
  const lengthFactor = countSyllables(word) / AVERAGE_SYLLABLES
  const adjustedFactor = 0.6 + 0.4 * Math.sqrt(lengthFactor)

  return {
    displayMs: Math.round(baseDisplayMs * adjustedFactor),
    fadeOutMs: Math.round(fadeOutMs * adjustedFactor),
  }
}

/** Pause nach einem Wort (Anteil einer durchschnittlichen Wortzeit) */
export function pauseAfter(word: string): number {
  if (/[.!?…]["“”„»«'’)]*$/u.test(word)) return FADING_PAUSES.sentenceEnd
  if (/[,;:–—]["“”„»«'’)]*$/u.test(word)) return FADING_PAUSES.clause
  return 0
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
 *  verschwunden. Nach Satzenden und Kommas folgt eine kurze Pause, bevor das nächste Fenster
 *  beginnt. Fenster und Pausen werden so skaliert, dass der ganze Text exakt im Zieltempo
 *  abläuft (Wörter × 60 000 / targetWpm); Längenkorrektur und Pausen verteilen die Zeit nur um. */
export function buildFadingSchedule(targetWpm: number, words: string[]): FadingSchedule {
  const msPerAverageWord = 60_000 / targetWpm
  const timings = words.map((word) => calculateFadingTiming(targetWpm, word))
  // Pause nach dem letzten Wort zählt nicht – danach kommt nichts mehr
  const pauses = words.map((word, i) => (i < words.length - 1 ? pauseAfter(word) * msPerAverageWord : 0))
  const rawTotal = timings.reduce((sum, t, i) => sum + t.displayMs + t.fadeOutMs + pauses[i]!, 0)
  const targetTotal = words.length * msPerAverageWord
  const scale = rawTotal > 0 ? targetTotal / rawTotal : 1

  const fadeStartMs: number[] = []
  const fadeMs: number[] = []
  let slotStart = 0
  timings.forEach(({ displayMs, fadeOutMs }, i) => {
    const display = displayMs * scale
    const fade = fadeOutMs * scale
    fadeStartMs.push(Math.round(slotStart + display))
    fadeMs.push(Math.round(fade))
    slotStart += display + fade + pauses[i]! * scale
  })

  return { fadeStartMs, fadeMs, totalMs: Math.round(slotStart) }
}

export interface RepeatedReadingConfig {
  /** Tempo der Fading-Durchgänge relativ zur Basis, z. B. [1.1, 1.2] */
  passFactors: number[]
  /** Band um das Fading-Ziel, in dem das Kaltlesetempo als Basis zählt */
  baseMinFactor: number
  baseMaxFactor: number
}

/** Tempi der Fading-Durchgänge beim wiederholten Lesen desselben Textes.
 *  Basis ist das gemessene Kaltlesetempo des ersten Durchgangs, begrenzt auf ein Band um das
 *  Fading-Ziel (schützt vor „Fertig“-Tippen ohne Lesen und vor Ausreißern); ohne Messung
 *  das Fading-Ziel selbst. */
export function repeatedReadingPassWpm(
  targetWpm: number,
  coldReadWpm: number | null,
  config: RepeatedReadingConfig,
): number[] {
  const base = coldReadWpm !== null && Number.isFinite(coldReadWpm) && coldReadWpm > 0
    ? Math.min(targetWpm * config.baseMaxFactor, Math.max(targetWpm * config.baseMinFactor, coldReadWpm))
    : targetWpm
  return config.passFactors.map((factor) => Math.round(base * factor))
}

/** Teilt einen Text in Wörter auf (bereinigt Satzzeichen, behält Wortform für Anzeige). */
export function splitIntoWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0)
}
