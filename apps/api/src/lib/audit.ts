import type { Prisma, PrismaClient } from '@prisma/client'

export type AuditAction =
  | 'student.create'
  | 'student.delete'
  | 'student.qr_regenerate'
  | 'student.qr_set_manual'
  | 'student.code_regenerate'
  | 'student.import_anton'
  | 'data.export'
  | 'parental_consent.confirmed'
  | 'user.password_changed'

export async function writeAuditLog(
  prisma: PrismaClient,
  action: AuditAction,
  actorId: string | null,
  targetId: string | null,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      action,
      actorId,
      targetId,
      ...(metadata ? { metadata: metadata as Prisma.InputJsonObject } : {}),
    },
  })
}
