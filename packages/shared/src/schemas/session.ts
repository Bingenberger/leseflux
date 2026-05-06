import { z } from 'zod'

export const StartSessionSchema = z.object({
  durationMinutes: z.union([z.literal(10), z.literal(15)]),
})

export const SessionAnswerInputSchema = z.object({
  questionId: z.string().uuid(),
  selectedIndex: z.number().int().min(0),
  responseTimeMs: z.number().int().min(0),
})

export const FinishSessionSchema = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(SessionAnswerInputSchema),
  durationMs: z.number().int().min(0),
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
export type SessionAnswerInput = z.infer<typeof SessionAnswerInputSchema>
export type FinishSessionInput = z.infer<typeof FinishSessionSchema>
export type SessionOverview = z.infer<typeof SessionOverviewSchema>
