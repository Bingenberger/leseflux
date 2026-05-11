import type { FastifyPluginAsync } from 'fastify'
import {
  StartSessionSchema,
  FinishSessionSchema,
  FinishExerciseSchema,
  levelFromWpm,
} from '@leseflux/shared'
import { runAdaptiveEngine, runFlashAdaptiveEngine } from './adaptive.js'
import { adaptiveConfig } from '../../config.js'
import { buildTrainingSession, createNextReadingExercise, selectSessionTemplate } from '../../services/session.js'

type SessionBlockPreview = {
  type: string
  targetDurationSec: number
}

const trainingRoutes: FastifyPluginAsync = async (fastify) => {
  const getIntermediateDiagnosticInterval = async () => {
    const diagnostic = await fastify.prisma.diagnostic.findFirst({
      where: { type: 'INTERMEDIATE' },
      select: { intervalSessions: true },
    })
    return diagnostic?.intervalSessions ?? adaptiveConfig.intermediateDiagnosticInterval
  }

  fastify.get('/my-progress', { preHandler: fastify.authenticate }, async (req) => {
    const progress = await fastify.prisma.userProgress.findUnique({
      where: { userId: req.user.userId },
    })

    const totalSessions = progress?.totalSessions ?? 0
    const interval = await getIntermediateDiagnosticInterval()
    const sessionsUntilNextCheck = interval - (totalSessions % interval)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const lastDate = progress?.lastSessionDate ? new Date(progress.lastSessionDate) : null
    if (lastDate) lastDate.setHours(0, 0, 0, 0)
    const todayDone = lastDate ? lastDate.getTime() === today.getTime() : false

    return {
      starCount: progress?.starCount ?? 0,
      streakDays: progress?.streakDays ?? 0,
      totalSessions,
      currentTargetWpm: progress?.fadingTargetWpm ?? null,
      nextTargetWpm: progress ? progress.fadingTargetWpm + adaptiveConfig.wpmStep : null,
      sessionsUntilNextCheck,
      todayDone,
    }
  })

  fastify.get('/today-program', { preHandler: fastify.authenticate }, async (req) => {
    const progress = await fastify.prisma.userProgress.findUnique({
      where: { userId: req.user.userId },
    })
    const totalSessions = progress?.totalSessions ?? 0

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const lastDate = progress?.lastSessionDate ? new Date(progress.lastSessionDate) : null
    if (lastDate) lastDate.setHours(0, 0, 0, 0)
    const todayDone = lastDate ? lastDate.getTime() === today.getTime() : false

    if (todayDone) {
      return {
        todayDone,
        templateName: null,
        isMeasurementDay: false,
        totalDurationSec: 0,
        blocks: [],
      }
    }

    const template = await selectSessionTemplate(fastify.prisma, req.user.userId, totalSessions)
    const blocks = Array.isArray(template.blocks)
      ? (template.blocks as SessionBlockPreview[])
      : []
    const nextSessionNumber = totalSessions + 1

    return {
      todayDone,
      templateName: template.name,
      isMeasurementDay: nextSessionNumber > 1 && nextSessionNumber % 5 === 0,
      totalDurationSec: blocks.reduce((sum, block) => sum + block.targetDurationSec, 0),
      blocks: blocks.map((block) => ({
        type: block.type,
        targetDurationSec: block.targetDurationSec,
      })),
    }
  })

  fastify.post('/start', { preHandler: fastify.authenticate }, async (req, reply) => {
    const body = StartSessionSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

    const userId = req.user.userId

    const progress = await fastify.prisma.userProgress.upsert({
      where: { userId },
      update: {},
      create: { userId, fadingTargetWpm: 60 },
    })

    // Tages-Limit: nur eine Trainingseinheit pro Tag
    const { trainingUnitId } = body.data
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const lastDate = progress.lastSessionDate ? new Date(progress.lastSessionDate) : null
    if (lastDate) lastDate.setHours(0, 0, 0, 0)
    const doneToday = lastDate && lastDate.getTime() === today.getTime()

    if (doneToday) {
      // Nur erlauben wenn es zur laufenden Trainingseinheit gehört
      if (!trainingUnitId) {
        return reply.status(429).send({ error: 'Heute schon geübt' })
      }
      const unitExists = await fastify.prisma.trainingSession.findFirst({
        where: { userId, trainingUnitId, startedAt: { gte: today } },
      })
      if (!unitExists) {
        return reply.status(429).send({ error: 'Heute schon geübt' })
      }
    }

    const session = await buildTrainingSession(
      fastify.prisma,
      userId,
      body.data.durationMinutes ?? 10,
      trainingUnitId,
    )
    if (!session) {
      return reply.status(404).send({ error: 'Keine passenden Texte verfügbar' })
    }

    return session
  })

  fastify.post('/exercise/:runId/finish', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { runId } = req.params as { runId: string }
    const body = FinishExerciseSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

    const userId = req.user.userId
    const run = await fastify.prisma.exerciseRun.findUnique({
      where: { id: runId },
      include: {
        session: true,
        text: { include: { questions: true } },
      },
    })

    if (!run || run.session.userId !== userId) {
      return reply.status(404).send({ error: 'Übung nicht gefunden' })
    }
    if (run.finishedAt) return reply.status(409).send({ error: 'Übung bereits abgeschlossen' })

    const responses = body.data.responses
    if (run.exerciseType === 'FLASH_WORD') {
      const responseRecords = responses.map((a) => ({
        ...a,
        isCorrect: 'isCorrect' in a ? a.isCorrect : false,
      }))
      const correctCount = responseRecords.filter((a) => a.isCorrect).length
      const accuracy = responseRecords.length > 0 ? correctCount / responseRecords.length : 0

      await fastify.prisma.exerciseRun.update({
        where: { id: runId },
        data: {
          finishedAt: new Date(),
          durationMs: body.data.durationMs,
          itemsTotal: responseRecords.length,
          itemsCorrect: correctCount,
          responses: responseRecords,
        },
      })

      const progress = await fastify.prisma.userProgress.findUnique({ where: { userId } })
      if (progress) {
        const result = runFlashAdaptiveEngine(progress, accuracy)
        await fastify.prisma.userProgress.update({
          where: { userId },
          data: result,
        })
      }

      return { accuracy, correctCount, totalQuestions: responseRecords.length }
    }

    if (run.exerciseType === 'CLOZE') {
      const responseRecords = responses
        .filter((a): a is {
          gapId: string
          wordIndex: number
          correctWord: string
          selectedWord: string
          isCorrect: boolean
          responseTimeMs: number
        } => 'gapId' in a)
        .map((a) => ({ ...a, isCorrect: a.isCorrect }))
      const correctCount = responseRecords.filter((a) => a.isCorrect).length
      const accuracy = responseRecords.length > 0 ? correctCount / responseRecords.length : 0

      await fastify.prisma.exerciseRun.update({
        where: { id: runId },
        data: {
          finishedAt: new Date(),
          durationMs: body.data.durationMs,
          itemsTotal: responseRecords.length,
          itemsCorrect: correctCount,
          responses: responseRecords,
        },
      })

      const progress = await fastify.prisma.userProgress.findUnique({ where: { userId } })
      if (progress) {
        const alpha = 0.2
        const clozeAccuracy = progress.clozeAccuracy === null
          ? accuracy
          : Math.round((alpha * accuracy + (1 - alpha) * progress.clozeAccuracy) * 100) / 100
        await fastify.prisma.userProgress.update({
          where: { userId },
          data: {
            clozeAccuracy,
            clozeSessionsSinceIncrease: progress.clozeSessionsSinceIncrease + 1,
          },
        })
      }

      return { accuracy, correctCount, totalQuestions: responseRecords.length }
    }

    const questions = run.text?.questions ?? []
    const questionMap = new Map(questions.map((q) => [q.id, q]))
    const quizResponses = responses.filter(
      (a): a is { questionId: string; selectedIndex: number; responseTimeMs: number } =>
        'questionId' in a,
    )
    const readingDone = responses.find(
      (a): a is { event: 'READING_DONE'; wordCount: number; durationMs: number } =>
        'event' in a && a.event === 'READING_DONE',
    )
    const responseRecords = quizResponses.map((a) => {
      const question = questionMap.get(a.questionId)
      return {
        questionId: a.questionId,
        selectedIndex: a.selectedIndex,
        isCorrect: question ? a.selectedIndex === question.correctIndex : false,
        responseTimeMs: a.responseTimeMs,
      }
    })

    const correctCount = responseRecords.filter((a) => a.isCorrect).length
    const accuracy = responseRecords.length > 0 ? correctCount / responseRecords.length : 0
    const measuredWpm = run.exerciseType === 'SELF_PACED' && readingDone && readingDone.durationMs > 0
      ? Math.round((readingDone.wordCount / (readingDone.durationMs / 60_000)) * 10) / 10
      : null

    await fastify.prisma.exerciseRun.update({
      where: { id: runId },
      data: {
        finishedAt: new Date(),
        durationMs: body.data.durationMs,
        itemsTotal: responseRecords.length,
        itemsCorrect: correctCount,
        measuredWpm,
        responses: responseRecords,
      },
    })

    if (run.exerciseType === 'SELF_PACED' && measuredWpm !== null) {
      const progress = await fastify.prisma.userProgress.findUnique({ where: { userId } })
      if (progress) {
        const alpha = 0.25
        const selfPacedAvgWpm = progress.selfPacedAvgWpm === null
          ? measuredWpm
          : Math.round((alpha * measuredWpm + (1 - alpha) * progress.selfPacedAvgWpm) * 10) / 10
        await fastify.prisma.userProgress.update({
          where: { userId },
          data: { selfPacedAvgWpm },
        })
      }
    }

    return { accuracy, correctCount, totalQuestions: responseRecords.length }
  })

  fastify.post('/exercise/:runId/next-reading', { preHandler: fastify.authenticate }, async (req, reply) => {
    const { runId } = req.params as { runId: string }
    const nextExercise = await createNextReadingExercise(
      fastify.prisma,
      req.user.userId,
      runId,
    )

    if (!nextExercise) {
      return reply.status(404).send({ error: 'Kein weiterer Lesetext verfügbar' })
    }

    return nextExercise
  })

  fastify.post('/finish', { preHandler: fastify.authenticate }, async (req, reply) => {
    const body = FinishSessionSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

    const userId = req.user.userId
    const { sessionId, totalDurationMs } = body.data

    const session = await fastify.prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: { exerciseRuns: true },
    })

    if (!session || session.userId !== userId) {
      return reply.status(404).send({ error: 'Sitzung nicht gefunden' })
    }
    if (session.completed) return reply.status(409).send({ error: 'Sitzung bereits abgeschlossen' })

    const fadingRuns = session.exerciseRuns.filter((r) => r.exerciseType === 'FADING')
    const totalQuestions = fadingRuns.reduce((sum, r) => sum + r.itemsTotal, 0)
    const correctCount = fadingRuns.reduce((sum, r) => sum + r.itemsCorrect, 0)
    const accuracy = totalQuestions > 0 ? correctCount / totalQuestions : 0
    const starsEarned = accuracy >= 0.7 ? 3 : accuracy >= 0.4 ? 2 : 1

    await fastify.prisma.trainingSession.update({
      where: { id: sessionId },
      data: { finishedAt: new Date(), totalDurationMs, completed: true, starsEarned },
    })

    const progress = await fastify.prisma.userProgress.findUnique({ where: { userId } })
    if (progress) {
      const diagnosticInterval = await getIntermediateDiagnosticInterval()
      const hasFading = fadingRuns.length > 0
      const level = levelFromWpm(progress.fadingTargetWpm)
      const result = hasFading ? runAdaptiveEngine(progress, accuracy, level) : {
        fadingTargetWpm: progress.fadingTargetWpm,
        fadingSessionsSinceIncrease: progress.fadingSessionsSinceIncrease,
        totalSessions: progress.totalSessions + 1,
        averageQuizAccuracy: progress.averageQuizAccuracy ?? accuracy,
        offerIntermediateDiagnostic: false,
      }
      const offerIntermediateDiagnostic = result.totalSessions % diagnosticInterval === 0

      // Streak berechnen
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      const lastDate = progress.lastSessionDate ? new Date(progress.lastSessionDate) : null
      if (lastDate) lastDate.setHours(0, 0, 0, 0)

      let newStreak = progress.streakDays
      if (!lastDate) {
        newStreak = 1
      } else if (lastDate.getTime() === yesterday.getTime()) {
        newStreak = progress.streakDays + 1
      } else if (lastDate.getTime() < yesterday.getTime()) {
        newStreak = 1
      }
      // lastDate === today → kein Streak-Update nötig

      await fastify.prisma.userProgress.update({
        where: { userId },
        data: {
          fadingTargetWpm: result.fadingTargetWpm,
          fadingSessionsSinceIncrease: result.fadingSessionsSinceIncrease,
          totalSessions: result.totalSessions,
          averageQuizAccuracy: result.averageQuizAccuracy,
          starCount: progress.starCount + starsEarned,
          streakDays: newStreak,
          lastSessionDate: new Date(),
        },
      })

      return {
        accuracy,
        correctCount,
        totalQuestions,
        newTargetWpm: result.fadingTargetWpm,
        offerIntermediateDiagnostic,
        starsEarned,
        streakDays: newStreak,
      }
    }

    return { accuracy, correctCount, totalQuestions, starsEarned, streakDays: 1 }
  })

  fastify.get(
    '/session/:id',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const session = await fastify.prisma.trainingSession.findUnique({
        where: { id },
        include: {
          exerciseRuns: { include: { text: true } },
          user: { select: { id: true, displayName: true } },
        },
      })
      if (!session) return reply.status(404).send({ error: 'Nicht gefunden' })
      return session
    },
  )
}

export default trainingRoutes
