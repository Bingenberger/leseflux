import { adaptiveConfig } from '../../config.js'

interface ProgressSnapshot {
  currentTargetWpm: number
  sessionsSinceLastIncrease: number
  totalSessions: number
  averageQuizAccuracy: number | null
}

interface AdaptiveResult {
  currentTargetWpm: number
  sessionsSinceLastIncrease: number
  totalSessions: number
  averageQuizAccuracy: number
  offerIntermediateDiagnostic: boolean
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
  const newSessions = progress.sessionsSinceLastIncrease + 1

  const cfg = adaptiveConfig
  const minWpm = cfg.minWpmByLevel[targetLevel] ?? 30

  let newWpm = progress.currentTargetWpm
  let newSessionsSinceLast = newSessions

  if (newSessions >= cfg.sessionsBeforeChange) {
    if (newAvg >= cfg.accuracyToIncrease) {
      newWpm += cfg.wpmStep
      newSessionsSinceLast = 0
    } else if (newAvg < cfg.accuracyToDecrease) {
      newWpm = Math.max(newWpm - cfg.wpmStep, minWpm)
      newSessionsSinceLast = 0
    } else {
      newSessionsSinceLast = 0
    }
  }

  const offerIntermediateDiagnostic = newTotal % cfg.intermediateDiagnosticInterval === 0

  return {
    currentTargetWpm: newWpm,
    sessionsSinceLastIncrease: newSessionsSinceLast,
    totalSessions: newTotal,
    averageQuizAccuracy: newAvg,
    offerIntermediateDiagnostic,
  }
}
