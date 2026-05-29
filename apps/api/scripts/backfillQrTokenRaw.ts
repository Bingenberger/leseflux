/**
 * Befüllt qrTokenRaw für alle per Anton-Import angelegten Schüler,
 * indem es die antonCode-Werte aus dem AuditLog rekonstruiert.
 *
 * Verwendung: node dist/scripts/backfillQrTokenRaw.js
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const logs = await prisma.auditLog.findMany({
    where: { action: 'student.import_anton', targetId: { not: null } },
  })

  console.log(`${logs.length} AuditLog-Einträge vom Anton-Import gefunden.`)

  let updated = 0
  let skipped = 0

  for (const log of logs) {
    const meta = log.metadata as Record<string, unknown> | null
    const antonCode = meta?.antonCode
    if (typeof antonCode !== 'string' || !log.targetId) {
      skipped++
      continue
    }

    const fullQr = `anton://login/${antonCode}`

    const result = await prisma.user.updateMany({
      where: { id: log.targetId, qrTokenRaw: null },
      data: { qrTokenRaw: fullQr },
    })

    if (result.count > 0) {
      updated++
    } else {
      skipped++
    }
  }

  console.log(`Fertig: ${updated} aktualisiert, ${skipped} übersprungen (bereits gesetzt oder Schüler nicht mehr vorhanden).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
