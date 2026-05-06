import { z } from 'zod'

export const UserRoleSchema = z.enum(['CHILD', 'TEACHER', 'ADMIN'])

export const UserSchema = z.object({
  id: z.string().uuid(),
  role: UserRoleSchema,
  displayName: z.string(),
  email: z.string().email().optional().nullable(),
  birthYear: z.number().int().optional().nullable(),
  classId: z.string().uuid().optional().nullable(),
})

export const CreateStudentSchema = z.object({
  displayName: z.string().min(1).max(50),
  classId: z.string().uuid().optional(),
  birthYear: z.number().int().min(2010).max(2025).optional(),
  parentalConsentDate: z.string().datetime(),
  /** Optional: Inhalt eines bereits vorhandenen QR-Codes (z. B. Anton-Ausweis).
   *  Wird gehasht gespeichert. Nicht gesetzt → eigener QR wird generiert. */
  existingQrToken: z.string().min(1).optional(),
})

export const CreateTeacherSchema = z.object({
  displayName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[a-zA-Z]/, 'Mindestens ein Buchstabe erforderlich')
    .regex(/[0-9]/, 'Mindestens eine Zahl erforderlich'),
})

export type UserRole = z.infer<typeof UserRoleSchema>
export type User = z.infer<typeof UserSchema>
export type CreateStudentInput = z.infer<typeof CreateStudentSchema>
export type CreateTeacherInput = z.infer<typeof CreateTeacherSchema>
