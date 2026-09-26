import { z } from 'zod'

/** Klassenstufe 1–6; bestimmt die Textstufe der Kinder */
export const GradeLevelSchema = z.number().int().min(1).max(6)

export const CreateClassSchema = z.object({
  name: z.string().min(1).max(20),
  schoolYear: z.string().regex(/^\d{4}\/\d{2,4}$/, 'Format: 2025/26'),
  gradeLevel: GradeLevelSchema.nullable().optional(),
})

export const UpdateClassGradeSchema = z.object({
  gradeLevel: GradeLevelSchema.nullable(),
})

export const ClassSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  schoolYear: z.string(),
  gradeLevel: z.number().int().nullable(),
  teacherId: z.string().uuid(),
  createdAt: z.string().datetime(),
})

export type CreateClassInput = z.infer<typeof CreateClassSchema>
export type UpdateClassGradeInput = z.infer<typeof UpdateClassGradeSchema>
export type Class = z.infer<typeof ClassSchema>
