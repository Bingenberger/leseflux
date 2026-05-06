import type { FastifyPluginAsync } from 'fastify'
import argon2 from 'argon2'
import { CreateClassSchema, CreateStudentSchema, CreateTeacherSchema } from '@leseflux/shared'
import { generateQrToken, hashQrToken } from '../../lib/qr.js'
import { writeAuditLog } from '../../lib/audit.js'

const teacherRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Klassen ──────────────────────────────────────────────────────────────

  fastify.get('/classes', { preHandler: fastify.authenticateTeacher }, async (req) => {
    return fastify.prisma.class.findMany({
      where: { teacherId: req.user.userId },
      include: { _count: { select: { students: true } } },
      orderBy: { createdAt: 'desc' },
    })
  })

  fastify.post('/classes', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const body = CreateClassSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

    const cls = await fastify.prisma.class.create({
      data: { ...body.data, teacherId: req.user.userId },
    })
    return reply.status(201).send(cls)
  })

  fastify.get('/classes/:id', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const cls = await fastify.prisma.class.findFirst({
      where: { id, teacherId: req.user.userId },
      include: {
        students: {
          include: { progress: true },
          orderBy: { displayName: 'asc' },
        },
      },
    })
    if (!cls) return reply.status(404).send({ error: 'Klasse nicht gefunden' })
    return cls
  })

  fastify.delete(
    '/classes/:id',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const cls = await fastify.prisma.class.findFirst({
        where: { id, teacherId: req.user.userId },
      })
      if (!cls) return reply.status(404).send({ error: 'Klasse nicht gefunden' })
      await fastify.prisma.class.delete({ where: { id } })
      return { ok: true }
    },
  )

  // ── Schüler ───────────────────────────────────────────────────────────────

  fastify.post('/students', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const body = CreateStudentSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe', issues: body.error.issues })

    // Einwilligung prüfen – muss vorhanden sein
    if (!body.data.parentalConsentDate) {
      return reply.status(400).send({ error: 'Einwilligung der Erziehungsberechtigten fehlt' })
    }

    // Anton-QR oder eigener generierter Token
    const qrToken = body.data.existingQrToken ?? generateQrToken()
    const qrTokenHash = hashQrToken(qrToken)

    const student = await fastify.prisma.user.create({
      data: {
        role: 'CHILD',
        displayName: body.data.displayName,
        classId: body.data.classId ?? null,
        birthYear: body.data.birthYear ?? null,
        qrTokenHash,
      },
    })

    await fastify.prisma.userProgress.create({
      data: { userId: student.id, currentTargetWpm: 60 },
    })

    await writeAuditLog(fastify.prisma, 'student.create', req.user.userId, student.id, {
      parentalConsentDate: body.data.parentalConsentDate,
    })

    // QR-Token wird nur einmalig zurückgegeben und nicht erneut abrufbar
    return reply.status(201).send({
      student: {
        id: student.id,
        displayName: student.displayName,
        classId: student.classId,
        birthYear: student.birthYear,
        role: student.role,
        createdAt: student.createdAt,
      },
      qrToken,
    })
  })

  fastify.post(
    '/students/:id/regenerate-qr',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }

      const student = await fastify.prisma.user.findFirst({
        where: { id, role: 'CHILD', class: { teacherId: req.user.userId } },
      })
      if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

      const qrToken = generateQrToken()
      const qrTokenHash = hashQrToken(qrToken)

      await fastify.prisma.user.update({ where: { id }, data: { qrTokenHash } })
      await writeAuditLog(fastify.prisma, 'student.qr_regenerate', req.user.userId, id)

      return { qrToken }
    },
  )

  fastify.delete(
    '/students/:id',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }

      const student = await fastify.prisma.user.findFirst({
        where: { id, role: 'CHILD', class: { teacherId: req.user.userId } },
      })
      if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

      await fastify.prisma.user.delete({ where: { id } })
      await writeAuditLog(fastify.prisma, 'student.delete', req.user.userId, id)

      return { ok: true }
    },
  )

  // ── Sitzungsübersicht für Lehrer ───────────────────────────────────────

  fastify.get(
    '/classes/:id/students-overview',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }

      const cls = await fastify.prisma.class.findFirst({
        where: { id, teacherId: req.user.userId },
      })
      if (!cls) return reply.status(404).send({ error: 'Klasse nicht gefunden' })

      const students = await fastify.prisma.user.findMany({
        where: { classId: id },
        include: {
          progress: true,
          sessions: {
            orderBy: { startedAt: 'desc' },
            take: 1,
            include: { answers: true },
          },
        },
        orderBy: { displayName: 'asc' },
      })

      return students.map((s) => {
        const lastSession = s.sessions[0]
        const accuracy =
          lastSession && lastSession.answers.length > 0
            ? lastSession.answers.filter((a) => a.isCorrect).length / lastSession.answers.length
            : null

        return {
          id: s.id,
          displayName: s.displayName,
          currentTargetWpm: s.progress?.currentTargetWpm ?? null,
          totalSessions: s.progress?.totalSessions ?? 0,
          averageQuizAccuracy: s.progress?.averageQuizAccuracy ?? null,
          lastSessionAt: lastSession?.startedAt ?? null,
          lastSessionAccuracy: accuracy,
        }
      })
    },
  )

  fastify.get(
    '/students/:id/sessions',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const query = req.query as { from?: string; to?: string }

      const student = await fastify.prisma.user.findFirst({
        where: { id, role: 'CHILD', class: { teacherId: req.user.userId } },
      })
      if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

      const sessions = await fastify.prisma.trainingSession.findMany({
        where: {
          userId: id,
          ...(query.from ? { startedAt: { gte: new Date(query.from) } } : {}),
          ...(query.to ? { startedAt: { lte: new Date(query.to) } } : {}),
        },
        include: { text: { select: { title: true } }, answers: true },
        orderBy: { startedAt: 'desc' },
      })

      return sessions.map((s) => ({
        id: s.id,
        textTitle: s.text.title,
        targetWpm: s.targetWpm,
        startedAt: s.startedAt,
        durationMs: s.durationMs,
        completed: s.completed,
        quizAccuracy:
          s.answers.length > 0
            ? s.answers.filter((a) => a.isCorrect).length / s.answers.length
            : null,
      }))
    },
  )
}

export default teacherRoutes
