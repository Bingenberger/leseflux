import type { PrismaClient } from '@prisma/client'
import { levelFromWpm } from '@leseflux/shared'

/** Wählt einen passenden Text basierend auf WPM-Niveau.
 *  Schließt die letzten `excludeCount` Sitzungen des Nutzers aus.
 *  Fallback: benachbarte Niveaus → beliebiger Text, falls Zielniveau leer ist. */
export async function selectNextText(
  prisma: PrismaClient,
  userId: string,
  currentTargetWpm: number,
  excludeCount = 10,
) {
  const level = levelFromWpm(currentTargetWpm)

  const recent = await prisma.trainingSession.findMany({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    take: excludeCount,
    select: {
      exerciseRuns: {
        where: { textId: { not: null } },
        select: { textId: true },
      },
    },
  })
  const excludeIds = recent.flatMap((s) =>
    s.exerciseRuns.map((r) => r.textId).filter((id): id is string => id !== null),
  )

  const pickFrom = async (levels: number[]): Promise<{ id: string } | null> => {
    const candidates = await prisma.text.findMany({
      where: { targetLevel: { in: levels }, id: { notIn: excludeIds } },
      select: { id: true },
    })
    if (candidates.length > 0) return candidates[Math.floor(Math.random() * candidates.length)]!

    // Alle Texte der Niveaus (ohne Ausschluss), falls alles schon gelesen
    const all = await prisma.text.findMany({
      where: { targetLevel: { in: levels } },
      select: { id: true },
    })
    return all.length > 0 ? all[Math.floor(Math.random() * all.length)]! : null
  }

  // 1. Zielnivaeu
  let chosen = await pickFrom([level])

  // 2. Benachbartes Niveau
  if (!chosen) {
    const adjacent = level === 2 ? [3] : level === 4 ? [3] : [2, 4]
    chosen = await pickFrom(adjacent)
  }

  // 3. Irgendein Text
  if (!chosen) {
    chosen = await pickFrom([2, 3, 4])
  }

  if (!chosen) return null

  return prisma.text.findUnique({
    where: { id: chosen.id },
    include: { questions: { orderBy: { orderIndex: 'asc' } } },
  })
}
