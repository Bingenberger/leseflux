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
  /** Messtag (Lesen im eigenen Tempo): kalibriert das Fading-Tempo am tatsächlich gemessenen Lesetempo */
  measurementCalibration: {
    /** Fading-Ziel = Faktor × gemessenes Tempo (leicht über dem Eigentempo) */
    targetFactor: 1.05,
    /** Gewicht des Messwerts gegenüber dem bisherigen Ziel (0–1) */
    weight: 0.5,
    /** Maximale Änderung des Ziels pro Messtag in WPM */
    maxChangeWpm: 10,
    /** Messung zählt nur, wenn der Text auch verstanden wurde */
    minQuizAccuracy: 0.66,
    /** Plausibilitätsgrenzen – schnelles „Fertig“-Tippen ohne Lesen wird ignoriert */
    minPlausibleWpm: 20,
    maxPlausibleWpm: 250,
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
