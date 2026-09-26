import { adaptiveConfig } from '../../config.js'

interface ProgressSnapshot {
  fadingTargetWpm: number
  fadingSessionsSinceIncrease: number
  totalSessions: number
  averageQuizAccuracy: number | null
}

interface AdaptiveResult {
  fadingTargetWpm: number
  fadingSessionsSinceIncrease: number
  totalSessions: number
  averageQuizAccuracy: number
  offerIntermediateDiagnostic: boolean
}

interface FlashProgressSnapshot {
  flashWordLevel: number
  flashWordDurationMs: number
  flashSessionsSinceIncrease: number
}

interface FlashAdaptiveResult {
  flashWordLevel: number
  flashWordDurationMs: number
  flashSessionsSinceIncrease: number
}

/** Berechnet neuen gleitenden Genauigkeitsdurchschnitt über die letzten N Sitzungen. */
export function updateRollingAccuracy(
  previous: number | null,
  newAccuracy: number,
  window = adaptiveConfig.rollingAccuracyWindow,
): number {
  if (previous === null) return newAccuracy
  // Exponentiell gewichteter Durchschnitt mit Fenstergewicht
  const alpha = 1 / window
  return Math.round((alpha * newAccuracy + (1 - alpha) * previous) * 100) / 100
}

/** Passt currentTargetWpm nach einer abgeschlossenen Sitzung an. */
export function runAdaptiveEngine(
  progress: ProgressSnapshot,
  sessionAccuracy: number,
  targetLevel: number,
): AdaptiveResult {
  const newAvg = updateRollingAccuracy(progress.averageQuizAccuracy, sessionAccuracy)
  const newTotal = progress.totalSessions + 1
  const newSessions = progress.fadingSessionsSinceIncrease + 1

  const cfg = adaptiveConfig.fading
  const minWpm = adaptiveConfig.minWpmByLevel[targetLevel] ?? 30

  let newWpm = progress.fadingTargetWpm
  let newSessionsSinceLast = newSessions

  if (newSessions >= cfg.sessionsPerStep) {
    if (newAvg >= cfg.increaseAt) {
      newWpm += cfg.stepWpm
      newSessionsSinceLast = 0
    } else if (newAvg < cfg.decreaseAt) {
      newWpm = Math.max(newWpm - cfg.stepWpm, minWpm)
      newSessionsSinceLast = 0
    } else {
      newSessionsSinceLast = 0
    }
  }

  const offerIntermediateDiagnostic = newTotal % adaptiveConfig.diagnostic.intervalSessions === 0

  return {
    fadingTargetWpm: newWpm,
    fadingSessionsSinceIncrease: newSessionsSinceLast,
    totalSessions: newTotal,
    averageQuizAccuracy: newAvg,
    offerIntermediateDiagnostic,
  }
}

interface MeasurementRun {
  measuredWpm: number | null
  itemsTotal: number
  itemsCorrect: number
}

/** Verständnisgenauigkeit über die Lese-Läufe einer Sitzung (nur Quizfragen, keine anderen Übungen).
 *  Gibt null zurück, wenn keine Fragen beantwortet wurden. */
export function readingQuizAccuracy(runs: { itemsTotal: number; itemsCorrect: number }[]): number | null {
  const total = runs.reduce((sum, r) => sum + r.itemsTotal, 0)
  if (total === 0) return null
  return runs.reduce((sum, r) => sum + r.itemsCorrect, 0) / total
}

/** Kalibriert das Fading-Ziel am Messtag am tatsächlich gemessenen Lesetempo.
 *  Nur Läufe mit plausiblem Tempo und ausreichendem Verständnis zählen.
 *  Gibt das unveränderte Ziel zurück, wenn keine gültige Messung vorliegt. */
export function calibrateFromMeasurement(
  currentTargetWpm: number,
  runs: MeasurementRun[],
  minWpm: number,
): number {
  const cfg = adaptiveConfig.measurementCalibration
  const valid = runs.filter((r) =>
    r.measuredWpm !== null
    && r.measuredWpm >= cfg.minPlausibleWpm
    && r.measuredWpm <= cfg.maxPlausibleWpm
    && r.itemsTotal > 0
    && r.itemsCorrect / r.itemsTotal >= cfg.minQuizAccuracy,
  )
  if (valid.length === 0) return currentTargetWpm

  const measured = valid.reduce((sum, r) => sum + r.measuredWpm!, 0) / valid.length
  const proposed = (1 - cfg.weight) * currentTargetWpm + cfg.weight * measured * cfg.targetFactor
  const change = Math.max(-cfg.maxChangeWpm, Math.min(cfg.maxChangeWpm, proposed - currentTargetWpm))
  return Math.max(Math.round(currentTargetWpm + change), minWpm)
}

/** Verrechnet das Ergebnis einer Zwischendiagnostik mit dem trainierten Fading-Ziel:
 *  gewichtet und pro Diagnostik auf ±maxChangeWpm begrenzt. */
export function blendDiagnosticTarget(currentTargetWpm: number, diagnosticTargetWpm: number): number {
  const cfg = adaptiveConfig.intermediateDiagnostic
  const proposed = (1 - cfg.weight) * currentTargetWpm + cfg.weight * diagnosticTargetWpm
  const change = Math.max(-cfg.maxChangeWpm, Math.min(cfg.maxChangeWpm, proposed - currentTargetWpm))
  return Math.max(Math.round(currentTargetWpm + change), 30)
}

export function runFlashAdaptiveEngine(
  progress: FlashProgressSnapshot,
  accuracy: number,
): FlashAdaptiveResult {
  const cfg = adaptiveConfig.flashWord
  const sessions = progress.flashSessionsSinceIncrease + 1

  let flashWordLevel = progress.flashWordLevel
  let flashWordDurationMs = progress.flashWordDurationMs
  let flashSessionsSinceIncrease = sessions

  if (sessions >= cfg.sessionsPerStep) {
    if (accuracy >= cfg.increaseAt) {
      const nextDuration = flashWordDurationMs - cfg.durationStepMs
      if (nextDuration < cfg.durationMin) {
        flashWordLevel += 1
        flashWordDurationMs = cfg.durationOnLevelUp
      } else {
        flashWordDurationMs = nextDuration
      }
      flashSessionsSinceIncrease = 0
    } else if (accuracy < cfg.decreaseAt) {
      flashWordDurationMs = Math.min(
        flashWordDurationMs + cfg.durationStepMs,
        cfg.durationMax,
      )
      flashSessionsSinceIncrease = 0
    } else {
      flashSessionsSinceIncrease = 0
    }
  }

  return { flashWordLevel, flashWordDurationMs, flashSessionsSinceIncrease }
}
