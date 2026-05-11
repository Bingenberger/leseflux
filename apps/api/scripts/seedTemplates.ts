import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.sessionTemplate.upsert({
    where: { id: 'standard-12-min' },
    update: {
      name: 'Standard 12 Min',
      isDefault: true,
      blocks: [
        { type: 'FLASH_WORD', targetDurationSec: 120 },
        { type: 'FADING', targetDurationSec: 600 },
        { type: 'CLOZE', targetDurationSec: 180 },
      ],
    },
    create: {
      id: 'standard-12-min',
      name: 'Standard 12 Min',
      isDefault: true,
      blocks: [
        { type: 'FLASH_WORD', targetDurationSec: 120 },
        { type: 'FADING', targetDurationSec: 600 },
        { type: 'CLOZE', targetDurationSec: 180 },
      ],
    },
  })

  await prisma.sessionTemplate.upsert({
    where: { id: 'measurement-day' },
    update: {
      name: 'Messtag',
      isDefault: false,
      blocks: [
        { type: 'FLASH_WORD', targetDurationSec: 120 },
        { type: 'SELF_PACED', targetDurationSec: 600 },
        { type: 'CLOZE', targetDurationSec: 180 },
      ],
    },
    create: {
      id: 'measurement-day',
      name: 'Messtag',
      isDefault: false,
      blocks: [
        { type: 'FLASH_WORD', targetDurationSec: 120 },
        { type: 'SELF_PACED', targetDurationSec: 600 },
        { type: 'CLOZE', targetDurationSec: 180 },
      ],
    },
  })

  console.log('Sitzungs-Vorlagen seed abgeschlossen.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
