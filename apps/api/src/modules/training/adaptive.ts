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
