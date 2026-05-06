import { z } from 'zod'

export const TextQuestionSchema = z.object({
  id: z.string().uuid(),
  question: z.string(),
  options: z.array(z.string()).min(2).max(4),
  correctIndex: z.number().int().min(0),
  orderIndex: z.number().int(),
})

export const TextSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  content: z.string(),
  wordCount: z.number().int(),
  lixScore: z.number(),
  targetLevel: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  estimatedSec: z.number().int(),
  questions: z.array(TextQuestionSchema),
})

export const ImportTextQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2).max(4),
  correctIndex: z.number().int().min(0),
})

export const ImportTextSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(10),
  targetLevel: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  questions: z.array(ImportTextQuestionSchema).min(1).max(5),
})

export type TextQuestion = z.infer<typeof TextQuestionSchema>
export type Text = z.infer<typeof TextSchema>
export type ImportTextInput = z.infer<typeof ImportTextSchema>
