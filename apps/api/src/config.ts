/** Alle Schwellenwerte für den Adaptiv-Engine.
 *  Hier anpassen für Pilotphasen – nicht in der Business-Logik hardcoden. */
export const adaptiveConfig = {
  sessionsBeforeChange: 5,
  accuracyToIncrease: 0.7,
  accuracyToDecrease: 0.4,
  wpmStep: 5,
  intermediateDiagnosticInterval: 10,
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
