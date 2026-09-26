import { classifyQuestion, type StudentInsights } from '@leseflux/shared'
import { adaptiveConfig } from '../../config.js'

const READING_TYPES = new Set(['FADING', 'SELF_PACED', 'REPEATED_READING'])
const OWN_PACE_TYPES = new Set(['SELF_PACED', 'REPEATED_READING'])

export interface InsightRun {
  exerciseType: string
  startedAt: Date
  itemsTotal: number
  itemsCorrect: number
  measuredWpm: number | null
  responses: unknown
}

interface QuizResponse {
  questionId: string
  isCorrect: boolean
  responseTimeMs: number
}

export function isPlausibleWpm(wpm: number) {
  const { minPlausibleWpm, maxPlausibleWpm } = adaptiveConfig.measurementCalibration
  return wpm >= minPlausibleWpm && wpm <= maxPlausibleWpm
}

function quizResponses(run: InsightRun): QuizResponse[] {
  if (!Array.isArray(run.responses)) return []
  return run.responses.filter((r): r is QuizResponse =>
    typeof r === 'object' && r !== null && 'questionId' in r && 'isCorrect' in r)
}

function areaAccuracy(runs: InsightRun[]) {
  const scored = runs.filter((r) => r.itemsTotal > 0).slice(0, adaptiveConfig.teacherInsights.recentRuns)
  const total = scored.reduce((sum, r) => sum + r.itemsTotal, 0)
  return {
    accuracy: total > 0 ? scored.reduce((sum, r) => sum + r.itemsCorrect, 0) / total : null,
    runs: scored.length,
  }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** Verdichtet die Läufe eines Kindes zu Kennzahlen und Hinweisen für die Lehrkraft.
 *  `runs` beliebig sortiert; `questionTexts` ordnet Frage-IDs ihrem Wortlaut zu. */
export function computeStudentInsights(
  runs: InsightRun[],
  questionTexts: Map<string, string>,
): StudentInsights {
  const cfg = adaptiveConfig.teacherInsights
  const newestFirst = [...runs].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
  const reading = newestFirst.filter((r) => READING_TYPES.has(r.exerciseType) && r.itemsTotal > 0)

  const accuracyByQuestionKind: StudentInsights['accuracyByQuestionKind'] = {
    WOERTLICH: { correct: 0, total: 0 },
    SCHLUSSFOLGERND: { correct: 0, total: 0 },
    BEWERTEND: { correct: 0, total: 0 },
  }
  for (const run of reading.slice(0, cfg.recentRuns * 2)) {
    for (const response of quizResponses(run)) {
      const question = questionTexts.get(response.questionId)
      if (!question) continue
      const bucket = accuracyByQuestionKind[classifyQuestion(question)]
      bucket.total += 1
      if (response.isCorrect) bucket.correct += 1
    }
  }

  const flags: StudentInsights['flags'] = []

  const recentAnswers = reading.slice(0, cfg.recentRuns).flatMap(quizResponses)
  if (recentAnswers.length >= cfg.guessingMinAnswers) {
    const accuracy = recentAnswers.filter((r) => r.isCorrect).length / recentAnswers.length
    const medianMs = median(recentAnswers.map((r) => r.responseTimeMs))
    if (medianMs < cfg.guessingMedianMs && accuracy < cfg.guessingMaxAccuracy) {
      flags.push({
        code: 'GUESSING',
        message: `Antwortet sehr schnell (Median ${(medianMs / 1000).toFixed(1)} s) bei ${Math.round(accuracy * 100)} % richtig – möglicherweise wird geraten.`,
      })
    }
  }

  const lastReading = reading.slice(0, cfg.lowComprehensionRuns)
  if (lastReading.length >= Math.min(3, cfg.lowComprehensionRuns)) {
    const accuracy = areaAccuracy(lastReading).accuracy ?? 1
    if (accuracy < cfg.lowComprehensionBelow) {
      flags.push({
        code: 'LOW_COMPREHENSION',
        message: `Verständnis in den letzten ${lastReading.length} Texten nur ${Math.round(accuracy * 100)} % – Texte zu schwer oder Tempo zu hoch?`,
      })
    }
  }

  const paces = newestFirst
    .filter((r) => OWN_PACE_TYPES.has(r.exerciseType) && r.measuredWpm !== null)
    .slice(0, 5)
  const implausible = paces.filter((r) => !isPlausibleWpm(r.measuredWpm!)).length
  if (implausible >= cfg.implausiblePaceCount) {
    flags.push({
      code: 'IMPLAUSIBLE_PACE',
      message: `${implausible} der letzten ${paces.length} Eigentempo-Messungen sind unrealistisch – tippt das Kind auf „Fertig gelesen“, ohne zu lesen?`,
    })
  }

  return {
    accuracyByArea: {
      comprehension: areaAccuracy(reading),
      flashWord: areaAccuracy(newestFirst.filter((r) => r.exerciseType === 'FLASH_WORD')),
      cloze: areaAccuracy(newestFirst.filter((r) => r.exerciseType === 'CLOZE')),
    },
    accuracyByQuestionKind,
    flags,
  }
}
