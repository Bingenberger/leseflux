export const ADAPTATION = {
  fading: { sessionsPerStep: 5, increaseAt: 0.7, decreaseAt: 0.4, stepWpm: 5 },
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
} as const
