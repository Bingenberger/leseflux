import { levelFromWpm } from '@leseflux/shared'
import { adaptiveConfig } from '../../config.js'

/** Leitet die Klassenstufe aus einem Klassennamen wie „3a“ oder „Klasse 4b“ ab. */
export function gradeFromClassName(name: string | null | undefined): number | null {
  const match = name?.match(/(?:^|\D)([1-6])(?:\s*[a-zA-Z]?\s*$|\D)/)
  return match ? Number(match[1]) : null
}

interface TextLevelInput {
  /** Klassenstufe laut Klasse (explizit gesetzt) */
  gradeLevel: number | null
  /** Klassenname als Rückfall, wenn keine Stufe gesetzt ist */
  className?: string | null
  /** Gleitender Durchschnitt der Verständnisfragen (null = noch keine Daten) */
  averageQuizAccuracy: number | null
  /** Nur Rückfall, wenn keine Klassenstufe bekannt ist */
  targetWpm: number
}

/** Bestimmt die Textstufe aus Klassenstufe und Textverständnis – nicht aus dem Lesetempo.
 *  Ein langsames Kind der 4. Klasse soll altersgemäße Texte lesen (das Tempo regelt das Fading);
 *  nur wer den Texten dauerhaft nicht folgen kann, bekommt eine Stufe leichter. */
export function chooseTextLevel(input: TextLevelInput): number {
  const cfg = adaptiveConfig.textLevel
  const grade = input.gradeLevel ?? gradeFromClassName(input.className)
  if (grade === null) return levelFromWpm(input.targetWpm)

  let level = grade
  if (input.averageQuizAccuracy !== null) {
    if (input.averageQuizAccuracy < cfg.easierBelow) level -= 1
    else if (input.averageQuizAccuracy >= cfg.harderFrom) level += 1
  }
  return Math.min(cfg.maxLevel, Math.max(cfg.minLevel, level))
}
