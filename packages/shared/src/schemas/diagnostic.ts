import { z } from 'zod'

export const StartDiagnosticSchema = z.object({
  type: z.enum(['ENTRY', 'INTERMEDIATE']),
})

export const FinishDiagnosticSchema = z.object({
  answers: z.array(
    z.object({
      itemId: z.string().uuid(),
      answer: z.enum(['TRUE', 'FALSE', 'SKIP']),
      responseTimeMs: z.number().int().min(0),
    }),
  ),
  durationMs: z.number().int().min(0),
})
