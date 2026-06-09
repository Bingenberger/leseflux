import type { FastifyPluginAsync } from 'fastify'
import {
  StartDiagnosticSchema,
  FinishDiagnosticSchema,
  estimateWpmFromDiagnostic,
} from '@leseflux/shared'
import { adaptiveConfig } from '../../config.js'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = a[i]!
    a[i] = a[j]!
    a[j] = current
  }
  return a
}

function selectBalancedItems<T extends { difficulty: number }>(items: T[], itemCount: number): T[] {
  const byDifficulty = new Map<number, T[]>()
  for (const item of items) {
    const bucket = byDifficulty.get(item.difficulty) ?? []
    bucket.push(item)
    byDifficulty.set(item.difficulty, bucket)
  }

  const difficulties = [...byDifficulty.keys()].sort((a, b) => a - b)
  if (difficulties.length === 0) return []

  const shuffledBuckets = new Map(
    difficulties.map((difficulty) => [difficulty, shuffle(byDifficulty.get(difficulty)!)]),
  )
  const base = Math.floor(itemCount / difficulties.length)
  let remainder = itemCount % difficulties.length
  const selected: T[] = []

  for (const difficulty of difficulties) {
    const take = base + (remainder > 0 ? 1 : 0)
    remainder = Math.max(0, remainder - 1)
    selected.push(...(shuffledBuckets.get(difficulty) ?? []).splice(0, take))
  }

  if (selected.length < itemCount) {
    const selectedIds = new Set(selected)
    const remaining = shuffle(items.filter((item) => !selectedIds.has(item)))
    selected.push(...remaining.slice(0, itemCount - selected.length))
  }

  return shuffle(selected).slice(0, itemCount)
}

const diagnosticRoutes: FastifyPluginAsync = async (fastify) => {
  // Prüft ob Eingangs- oder Zwischendiagnostik aussteht
  fastify.get('/check', { preHandler: fastify.authenticate }, async (req) => {
    const userId = req.user.userId

    const [hasEntry, completedIntermediateCount, progress, intermediateDiagnostic] = await Promise.all([
      fastify.prisma.diagnosticResult.findFirst({
        where: { userId, diagnostic: { type: 'ENTRY' }, finishedAt: { not: null } },
      }),
      fastify.prisma.diagnosticResult.count({
        where: { userId, diagnostic: { type: 'INTERMEDIATE' }, finishedAt: { not: null } },
      }),
      fastify.prisma.userProgress.findUnique({ where: { userId } }),
      fastify.prisma.diagnostic.findFirst({
        where: { type: 'INTERMEDIATE' },
        select: { intervalSessions: true },
      }),
    ])

    const diagnosticInterval = intermediateDiagnostic?.intervalSessions ?? adaptiveConfig.diagnostic.intervalSessions
    const totalSessions = progress?.totalSessions ?? 0
    const needsIntermediate = !!hasEntry && totalSessions >= (completedIntermediateCount + 1) * diagnosticInterval

    return { needsEntry: !hasEntry, needsIntermediate }
  })

  // Startet eine Diagnostik-Sitzung, gibt Items zurück (ohne isNonsense)
  fastify.post('/start', { preHandler: fastify.authenticate }, async (req, reply) => {
    const body = StartDiagnosticSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

    const diagnostic = await fastify.prisma.diagnostic.findFirst({
      where: { type: body.data.type },
      include: { items: true },
    })
    if (!diagnostic) return reply.status(404).send({ error: 'Diagnostik nicht gefunden' })

    const selectedItems = selectBalancedItems(diagnostic.items, diagnostic.itemCount)
    if (selectedItems.length === 0) return reply.status(404).send({ error: 'Keine Diagnostik-Sätze vorhanden' })

    const result = await fastify.prisma.diagnosticResult.create({
      data: {
        userId: req.user.userId,
        diagnosticId: diagnostic.id,
        startedAt: new Date(),
      },
    })

    return reply.status(201).send({
      resultId: result.id,
      durationSec: diagnostic.durationSec,
      // isNonsense wird NICHT an den Client gesendet
      items: selectedItems.map((i, idx) => ({
        id: i.id,
        sentence: i.sentence,
        orderIndex: idx,
        difficulty: i.difficulty,
      })),
    })
  })

  // Schließt eine Diagnostik ab, berechnet WPM, aktualisiert UserProgress
  fastify.post('/:resultId/finish', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { resultId } = req.params as { resultId: string }
    const body = FinishDiagnosticSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

    const diagnosticResult = await fastify.prisma.diagnosticResult.findUnique({
      where: { id: resultId },
      include: { diagnostic: { include: { items: true } } },
    })
    if (!diagnosticResult || diagnosticResult.userId !== req.user.userId) {
      return reply.status(404).send({ error: 'Diagnostik nicht gefunden' })
    }
    if (diagnosticResult.finishedAt) {
      return reply.status(409).send({ error: 'Diagnostik bereits abgeschlossen' })
    }

    const itemMap = new Map(diagnosticResult.diagnostic.items.map((i) => [i.id, i]))

    const answerRecords = body.data.answers.map((a) => {
      const item = itemMap.get(a.itemId)
      const isCorrect = item
        ? a.answer !== 'SKIP' && (a.answer === 'TRUE' ? !item.isNonsense : item.isNonsense)
        : false
      return {
        resultId,
        itemId: a.itemId,
        answer: a.answer as 'TRUE' | 'FALSE' | 'SKIP',
        responseTimeMs: a.responseTimeMs,
        isCorrect,
      }
    })

    const correctCount = answerRecords.filter((a) => a.isCorrect).length
    const wrongCount = answerRecords.filter((a) => !a.isCorrect && a.answer !== 'SKIP').length
    const skippedCount = answerRecords.filter((a) => a.answer === 'SKIP').length

    const answeredItemIds = new Set(body.data.answers.map((a) => a.itemId))
    const allItems = diagnosticResult.diagnostic.items.filter((item) => answeredItemIds.has(item.id))
    const avgWordsPerSentence =
      allItems.length > 0
        ? allItems.reduce((sum, i) => sum + i.sentence.trim().split(/\s+/).length, 0) / allItems.length
        : 5

    const durationSec = Math.min(
      body.data.durationMs / 1000,
      diagnosticResult.diagnostic.durationSec,
    )
    const estimatedWpm = Math.max(
      Math.round(estimateWpmFromDiagnostic(correctCount, avgWordsPerSentence, durationSec)),
      1,
    )
    const newTargetWpm = Math.max(
      Math.round(estimatedWpm * adaptiveConfig.initialWpmFactor),
      30,
    )

    await fastify.prisma.$transaction([
      fastify.prisma.diagnosticResult.update({
        where: { id: resultId },
        data: { finishedAt: new Date(), correctCount, wrongCount, skippedCount, estimatedWpm },
      }),
      fastify.prisma.diagnosticAnswer.createMany({ data: answerRecords }),
    ])

    await fastify.prisma.userProgress.upsert({
      where: { userId: req.user.userId },
      update: {
        fadingTargetWpm: newTargetWpm,
        lastIntermediateDiagnosticAt: new Date(),
      },
      create: {
        userId: req.user.userId,
        fadingTargetWpm: newTargetWpm,
      },
    })

    return { estimatedWpm, newTargetWpm }
  })
}

export default diagnosticRoutes
