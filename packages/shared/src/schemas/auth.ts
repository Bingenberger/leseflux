import { z } from 'zod'

export const LoginChildSchema = z.object({
  qrToken: z.string().min(1),
})

export const LoginTeacherSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const JwtPayloadSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['CHILD', 'TEACHER', 'ADMIN']),
})

export type LoginChildInput = z.infer<typeof LoginChildSchema>
export type LoginTeacherInput = z.infer<typeof LoginTeacherSchema>
export type JwtPayload = z.infer<typeof JwtPayloadSchema>
