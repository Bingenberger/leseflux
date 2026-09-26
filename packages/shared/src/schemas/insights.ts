import type { QuestionKind } from '../questionKind'

export type InsightFlagCode = 'GUESSING' | 'LOW_COMPREHENSION' | 'IMPLAUSIBLE_PACE'

/** Kennzahlen und Hinweise zu einem Kind für die Lehrkraft (GET /teacher/students/:id/insights) */
export interface StudentInsights {
  /** Genauigkeit der jüngsten Läufe je Bereich (null = keine Daten) */
  accuracyByArea: Record<'comprehension' | 'flashWord' | 'cloze', { accuracy: number | null; runs: number }>
  /** Verständnis nach Verstehensebene der Frage */
  accuracyByQuestionKind: Record<QuestionKind, { correct: number; total: number }>
  flags: { code: InsightFlagCode; message: string }[]
}
