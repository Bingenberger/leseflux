import type { FastifyPluginAsync } from 'fastify'
import {
  StartSessionSchema,
  FinishSessionSchema,
  calculateFadingTiming,
  levelFromWpm,
} from '@leseflux/shared'
import { selectNextText } from './textSelector.js'
import { runAdaptiveEngine } from './adaptive.js'

const trainingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/start', { preHandler: fastify.authenticate }, async (req, reply) => {
    const body = StartSessionSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

    const userId = req.user.userId

    let progress = await fastify.prisma.userProgress.findUnique({ where: { userId } })
    if (!progress) {
      progress = await fastify.prisma.userProgress.create({
        data: { userId, currentTargetWpm: 60 },
      })
    }

    const text = await selectNextText(fastify.prisma, userId, progress.currentTargetWpm)
    if (!text) {
      return reply.status(404).send({ error: 'Keine passenden Texte verfügbar' })
    }

    const { displayMs: fadingMsBase, fadeOutMs: fadingMsPerChar } = calculateFadingTiming(
      progress.currentTargetWpm,
      'Beispiel',
    )

    const session = await fastify.prisma.trainingSession.create({
      data: {
        userId,
        textId: text.id,
        targetWpm: progress.currentTargetWpm,
        fadingMsBase,
        fadingMsPerChar,
        startedAt: new Date(),
      },
    })

    return {
      session: {
        id: session.id,
        targetWpm: session.targetWpm,
        fadingMsBase: session.fadingMsBase,
        fadingMsPerChar: session.fadingMsPerChar,
        durationMinutes: body.data.durationMinutes,
      },
      text: {
        id: text.id,
        title: text.title,
        content: text.content,
        wordCount: text.wordCount,
        estimatedSec: text.estimatedSec,
        questions: text.questions.map((q) => ({
          id: q.id,
          question: q.question,
          options: q.options as string[],
          correctIndex: q.correctIndex,
        })),
      },
    }
  })

  fastify.post('/finish', { preHandler: fastify.authenticate }, async (req, reply) => {
    const body = FinishSessionSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

    const userId = req.user.userId
    const { sessionId, answers, durationMs } = body.data

    const session = await fastify.prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: { text: { include: { questions: true } } },
    })

    if (!session || session.userId !== userId) {
      return reply.status(404).send({ error: 'Sitzung nicht gefunden' })
    }

    const questionMap = new Map(session.text.questions.map((q) => [q.id, q]))
    const answerRecords = answers.map((a) => {
      const question = questionMap.get(a.questionId)
      return {
        sessionId,
        questionId: a.questionId,
        selectedIndex: a.selectedIndex,
        isCorrect: question ? a.selectedIndex === question.correctIndex : false,
        responseTimeMs: a.responseTimeMs,
      }
    })

    const correctCount = answerRecords.filter((a) => a.isCorrect).length
    const accuracy = answers.length > 0 ? correctCount / answers.length : 0

    await fastify.prisma.$transaction([
      fastify.prisma.trainingSession.update({
        where: { id: sessionId },
        data: { finishedAt: new Date(), durationMs, completed: true },
      }),
      fastify.prisma.sessionAnswer.createMany({ data: answerRecords }),
    ])

    const progress = await fastify.prisma.userProgress.findUnique({ where: { userId } })
    if (progress) {
      const level = levelFromWpm(progress.currentTargetWpm)
      const result = runAdaptiveEngine(progress, accuracy, level)

      await fastify.prisma.userProgress.update({
        where: { userId },
        data: {
          currentTargetWpm: result.currentTargetWpm,
          sessionsSinceLastIncrease: result.sessionsSinceLastIncrease,
          totalSessions: result.totalSessions,
          averageQuizAccuracy: result.averageQuizAccuracy,
        },
      })

      return {
        accuracy,
        correctCount,
        totalQuestions: answers.length,
        newTargetWpm: result.currentTargetWpm,
        offerIntermediateDiagnostic: result.offerIntermediateDiagnostic,
      }
    }

    return { accuracy, correctCount, totalQuestions: answers.length }
  })

  fastify.get(
    '/session/:id',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const session = await fastify.prisma.trainingSession.findUnique({
        where: { id },
        include: {
          text: true,
          answers: true,
          user: { select: { id: true, displayName: true } },
        },
      })
      if (!session) return reply.status(404).send({ error: 'Nicht gefunden' })
      return session
    },
  )
}

export default trainingRoutes
