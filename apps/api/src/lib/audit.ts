import type { PrismaClient } from '@prisma/client'

export type AuditAction =
  | 'student.create'
  | 'student.delete'
  | 'student.qr_regenerate'
  | 'data.export'
  | 'parental_consent.confirmed'

export async function writeAuditLog(
  prisma: PrismaClient,
  action: AuditAction,
  actorId: string | null,
  targetId: string | null,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: { action, actorId, targetId, metadata: metadata ?? null },
  })
}
