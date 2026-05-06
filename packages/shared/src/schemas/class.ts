import { z } from 'zod'

export const CreateClassSchema = z.object({
  name: z.string().min(1).max(20),
  schoolYear: z.string().regex(/^\d{4}\/\d{2,4}$/, 'Format: 2025/26'),
})

export const ClassSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  schoolYear: z.string(),
  teacherId: z.string().uuid(),
  createdAt: z.string().datetime(),
})

export type CreateClassInput = z.infer<typeof CreateClassSchema>
export type Class = z.infer<typeof ClassSchema>
