import { readFile } from 'fs/promises'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

const FlashWordSchema = z.object({
  word: z.string().min(1),
  syllables: z.coerce.number().int().min(1),
  difficultyLevel: z.coerce.number().int().min(1),
  distractors: z.array(z.string().min(1)),
})

const DEFAULT_WORDS = [
  { word: 'Haus', syllables: 1, difficultyLevel: 1, distractors: ['Hans', 'Hase'] },
  { word: 'Baum', syllables: 1, difficultyLevel: 1, distractors: ['Bauch', 'Bahn'] },
  { word: 'Kind', syllables: 1, difficultyLevel: 1, distractors: ['Wind', 'Kino'] },
  { word: 'Schule', syllables: 2, difficultyLevel: 1, distractors: ['Schale', 'Spule'] },
  { word: 'Blume', syllables: 2, difficultyLevel: 1, distractors: ['Blase', 'Biene'] },
  { word: 'Garten', syllables: 2, difficultyLevel: 1, distractors: ['Karten', 'Warten'] },
  { word: 'Lesen', syllables: 2, difficultyLevel: 1, distractors: ['Leben', 'Leise'] },
  { word: 'Wasser', syllables: 2, difficultyLevel: 1, distractors: ['Wiese', 'Wolke'] },
  { word: 'Fenster', syllables: 2, difficultyLevel: 1, distractors: ['Fester', 'Feuer'] },
  { word: 'Morgen', syllables: 2, difficultyLevel: 1, distractors: ['Magen', 'Sorgen'] },
  { word: 'Abenteuer', syllables: 4, difficultyLevel: 2, distractors: ['Abendrot', 'Ameise'] },
  { word: 'Bibliothek', syllables: 4, difficultyLevel: 2, distractors: ['Bilderbuch', 'Bleistift'] },
]

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const [headerLine, ...rows] = lines
  if (!headerLine) return []
  const headers = headerLine.split(/[;,]/).map((h) => h.trim())
  return rows.map((row) => {
    const values = row.split(/[;,]/).map((v) => v.trim())
    const record = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
    return {
      word: record.word ?? record.Wort,
      syllables: record.syllables ?? record.Silben,
      difficultyLevel: record.difficultyLevel ?? record.Level,
      distractors: (record.distractors ?? record.Distraktoren ?? '')
        .split('|')
        .map((v) => v.trim())
        .filter(Boolean),
    }
  })
}

async function loadWords(path?: string) {
  if (!path) return DEFAULT_WORDS
  const text = await readFile(path, 'utf8')
  const raw = path.endsWith('.json') ? JSON.parse(text) : parseCsv(text)
  return z.array(FlashWordSchema).parse(raw)
}

async function main() {
  const words = await loadWords(process.argv[2])
  let imported = 0

  for (const item of words) {
    const parsed = FlashWordSchema.parse(item)
    await prisma.flashWord.upsert({
      where: { word: parsed.word },
      update: {
        syllables: parsed.syllables,
        difficultyLevel: parsed.difficultyLevel,
        distractors: parsed.distractors,
      },
      create: parsed,
    })
    imported++
  }

  console.log(`Wortblitz-Wörter seed abgeschlossen: ${imported}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
