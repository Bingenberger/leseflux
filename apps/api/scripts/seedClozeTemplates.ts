import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const texts = await prisma.text.findMany({
    where: { clozeTemplate: null },
    select: { id: true, title: true },
  })

  let created = 0
  for (const text of texts) {
    await prisma.clozeTemplate.create({
      data: {
        textId: text.id,
        strategy: 'AUTO_EVERY_N',
        gapInterval: 7,
      },
    })
    created++
  }

  console.log(`Cloze-AUTO-Templates seed abgeschlossen: ${created}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
