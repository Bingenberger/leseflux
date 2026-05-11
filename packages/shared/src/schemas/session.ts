import { z } from 'zod'

export const StartSessionSchema = z.object({
  durationMinutes: z.union([z.literal(10), z.literal(15)]).optional(),
  trainingUnitId: z.string().uuid().optional(),
})

export const QuizAnswerInputSchema = z.object({
  questionId: z.string().uuid(),
  selectedIndex: z.number().int().min(0),
  responseTimeMs: z.number().int().min(0),
})

export const ExerciseResponseSchema = z.union([
  QuizAnswerInputSchema,
  z.object({
    itemId: z.string(),
    word: z.string(),
    selectedWord: z.string(),
    isCorrect: z.boolean(),
    responseTimeMs: z.number().int().min(0),
  }),
  z.object({
    gapId: z.string(),
    wordIndex: z.number().int().min(0),
    correctWord: z.string(),
    selectedWord: z.string(),
    isCorrect: z.boolean(),
    responseTimeMs: z.number().int().min(0),
  }),
  z.object({
    event: z.literal('READING_DONE'),
    wordCount: z.number().int().min(1),
    durationMs: z.number().int().min(0),
  }),
])

export const FinishExerciseSchema = z.object({
  responses: z.array(ExerciseResponseSchema),
  durationMs: z.number().int().min(0),
})

export const FinishSessionSchema = z.object({
  sessionId: z.string().uuid(),
  totalDurationMs: z.number().int().min(0),
})

export const SessionOverviewSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  textTitle: z.string(),
  targetWpm: z.number().int(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().nullable(),
  durationMs: z.number().int().nullable(),
  completed: z.boolean(),
  quizAccuracy: z.number().nullable(),
})

export type StartSessionInput = z.infer<typeof StartSessionSchema>
export type QuizAnswerInput = z.infer<typeof QuizAnswerInputSchema>
export type ExerciseResponseInput = z.infer<typeof ExerciseResponseSchema>
export type FinishExerciseInput = z.infer<typeof FinishExerciseSchema>
export type FinishSessionInput = z.infer<typeof FinishSessionSchema>
export type SessionOverview = z.infer<typeof SessionOverviewSchema>
