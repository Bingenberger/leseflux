/**
 * Importiert Texte aus einer JSON-Datei.
 * Verwendung: npm run seed:texts -- ./texte/klasse-2.json
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { ImportTextSchema } from '@leseflux/shared'
import { calculateLix } from '@leseflux/shared'
import { z } from 'zod'

const prisma = new PrismaClient()

const FileSchema = z.array(ImportTextSchema)

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Verwendung: tsx scripts/seedTexts.ts <pfad-zur-json-datei>')
    process.exit(1)
  }

  const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
  const texts = FileSchema.parse(raw)

  let created = 0
  for (const t of texts) {
    const words = t.content.split(/\s+/).filter(Boolean)
    const wordCount = words.length
    const lixScore = calculateLix(t.content)
    const estimatedSec = Math.round((wordCount / 80) * 60)

    await prisma.text.create({
      data: {
        title: t.title,
        content: t.content,
        wordCount,
        lixScore,
        targetLevel: t.targetLevel,
        estimatedSec,
        questions: {
          create: t.questions.map((q, i) => ({
            question: q.question,
            options: JSON.stringify(q.options),
            correctIndex: q.correctIndex,
            orderIndex: i,
          })),
        },
      },
    })
    created++
  }

  console.log(`${created} Texte importiert.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
