import { PrismaClient } from '@prisma/client'
import { ensureDefaultSessionTemplate } from '../src/services/session.js'

const prisma = new PrismaClient()

async function main() {
  await ensureDefaultSessionTemplate(prisma)
  console.log('Sitzungs-Vorlagen seed abgeschlossen.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
