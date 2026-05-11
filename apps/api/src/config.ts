/** Alle Schwellenwerte für den Adaptiv-Engine.
 *  Hier anpassen für Pilotphasen – nicht in der Business-Logik hardcoden. */
export const adaptiveConfig = {
  fading: {
    sessionsPerStep: 5,
    increaseAt: 0.7,
    decreaseAt: 0.4,
    stepWpm: 5,
  },
  flashWord: {
    sessionsPerStep: 3,
    increaseAt: 0.85,
    decreaseAt: 0.5,
    durationStepMs: 50,
    durationMin: 250,
    durationMax: 800,
    durationOnLevelUp: 500,
  },
  diagnostic: { intervalSessions: 10 },
  /** Initiales Fading-Tempo = Faktor × diagnostisch ermittelte WPM */
  initialWpmFactor: 0.9,
  minWpmByLevel: { 2: 30, 3: 50, 4: 70 } as Record<number, number>,
  rollingAccuracyWindow: 10,
} as const

export const authConfig = {
  childTokenExpiry: '24h',
  teacherTokenExpiry: '8h',
} as const

export const rateLimitConfig = {
  loginMax: 10,
  loginWindowMs: 60_000,
} as const
