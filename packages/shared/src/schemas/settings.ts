import { z } from 'zod'

export const ChildLoginMethodSchema = z.enum(['QR_AND_CODE', 'QR_ONLY', 'CODE_ONLY'])
export type ChildLoginMethod = z.infer<typeof ChildLoginMethodSchema>

export const UpdateSettingsSchema = z.object({
  childLoginMethods: ChildLoginMethodSchema.optional(),
})
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>

export interface PublicSettings {
  childLoginMethods: ChildLoginMethod
}
