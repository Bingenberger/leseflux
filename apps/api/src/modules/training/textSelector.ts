import type { PrismaClient } from '@prisma/client'
import { levelFromWpm } from '@leseflux/shared'

/** Wählt einen passenden Text basierend auf WPM-Niveau.
 *  Schließt die letzten `excludeCount` Sitzungen des Nutzers aus. */
export async function selectNextText(
  prisma: PrismaClient,
  userId: string,
  currentTargetWpm: number,
  excludeCount = 10,
) {
  const level = levelFromWpm(currentTargetWpm)

  // Zuletzt gelesene Texte ermitteln
  const recent = await prisma.trainingSession.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: excludeCount,
    select: { textId: true },
  })
  const excludeIds = recent.map((s) => s.textId)

  const candidates = await prisma.text.findMany({
    where: {
      targetLevel: level,
      id: { notIn: excludeIds },
    },
    select: { id: true },
  })

  // Fallback: alle Texte der Stufe, falls zu wenige verfügbar
  const pool =
    candidates.length > 0
      ? candidates
      : await prisma.text.findMany({
          where: { targetLevel: level },
          select: { id: true },
        })

  if (pool.length === 0) return null

  const chosen = pool[Math.floor(Math.random() * pool.length)]!

  return prisma.text.findUnique({
    where: { id: chosen.id },
    include: { questions: { orderBy: { orderIndex: 'asc' } } },
  })
}
