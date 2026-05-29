import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@prisma/client'
import argon2 from 'argon2'
import {
  CreateClassSchema,
  CreateStudentSchema,
  CreateTeacherSchema,
  ImportTextSchema,
  calculateLix,
} from '@leseflux/shared'
import { z } from 'zod'
import { generateQrToken, hashQrToken, generateLoginCode } from '../../lib/qr.js'
import { writeAuditLog } from '../../lib/audit.js'

function primaryFadingRun(session: {
  exerciseRuns: {
    text?: { title: string } | null
    targetWpm: number | null
    durationMs: number | null
    itemsTotal: number
    itemsCorrect: number
    measuredWpm?: number | null
    responses: unknown
  }[]
}) {
  return session.exerciseRuns.find((r) => r.targetWpm !== null)
    ?? session.exerciseRuns.find((r) => r.measuredWpm !== null)
    ?? session.exerciseRuns[0]
    ?? null
}

function runAccuracy(run: { itemsTotal: number; itemsCorrect: number } | null) {
  return run && run.itemsTotal > 0 ? run.itemsCorrect / run.itemsTotal : null
}

function wpmFlag(measuredWpm: number | null | undefined) {
  if (measuredWpm === null || measuredWpm === undefined) return null
  if (measuredWpm < 20 || measuredWpm > 220) return 'UNREALISTIC'
  return null
}

const SYSTEM_TEMPLATE_IDS = new Set(['standard-12-min', 'measurement-day'])

const SessionTemplateBlockSchema = z.object({
  type: z.enum(['FADING', 'FLASH_WORD', 'CLOZE', 'SELF_PACED']),
  targetDurationSec: z.number().int().min(30).max(1800),
}).passthrough()

const SessionTemplateBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  isDefault: z.boolean().optional().default(false),
  visibility: z.enum(['PRIVATE', 'SCHOOL']).optional().default('PRIVATE'),
  blocks: z.array(SessionTemplateBlockSchema).min(1).max(8),
}).superRefine((value, ctx) => {
  const hasReadingBlock = value.blocks.some((block) =>
    block.type === 'FADING' || block.type === 'SELF_PACED',
  )
  if (!hasReadingBlock) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['blocks'],
      message: 'Mindestens ein FADING- oder SELF_PACED-Block ist erforderlich.',
    })
  }
})

const UpdateSessionTemplateBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  isDefault: z.boolean().optional(),
  visibility: z.enum(['PRIVATE', 'SCHOOL']).optional(),
  blocks: z.array(SessionTemplateBlockSchema).min(1).max(8).optional(),
}).superRefine((value, ctx) => {
  if (!value.blocks) return
  const hasReadingBlock = value.blocks.some((block) =>
    block.type === 'FADING' || block.type === 'SELF_PACED',
  )
  if (!hasReadingBlock) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['blocks'],
      message: 'Mindestens ein FADING- oder SELF_PACED-Block ist erforderlich.',
    })
  }
})

const TextQuestionInputSchema = z.object({
  question: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).min(2).max(4),
  correctIndex: z.number().int().min(0),
}).superRefine((value, ctx) => {
  if (value.correctIndex >= value.options.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['correctIndex'],
      message: 'correctIndex muss auf eine vorhandene Antwortoption zeigen.',
    })
  }
})

const UpdateTextBodySchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(10),
  targetLevel: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  questions: z.array(TextQuestionInputSchema).min(1).max(8),
})

const FlashWordBodySchema = z.object({
  word: z.string().trim().min(1),
  syllables: z.number().int().min(1).max(12),
  difficultyLevel: z.number().int().min(1).max(10),
  distractors: z.array(z.string().trim().min(1)).min(1).max(6),
})

const DiagnosticConfigBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  durationSec: z.number().int().min(30).max(600),
  itemCount: z.number().int().min(3).max(120),
  intervalSessions: z.number().int().min(1).max(100).nullable().optional(),
})

const DiagnosticItemBodySchema = z.object({
  sentence: z.string().trim().min(5).max(500),
  isNonsense: z.boolean(),
  difficulty: z.number().int().min(1).max(5),
})

function visibleTemplateWhere(user: { userId: string; role: string }) {
  return user.role === 'ADMIN'
    ? {}
    : { OR: [{ teacherId: null }, { teacherId: user.userId }] }
}

function canEditTemplate(
  template: { id: string; teacherId: string | null },
  user: { userId: string; role: string },
) {
  if (user.role === 'ADMIN') return true
  if (SYSTEM_TEMPLATE_IDS.has(template.id)) return false
  return template.teacherId === user.userId
}

function canUseTemplateForClass(
  template: { teacherId: string | null },
  user: { userId: string; role: string },
  classTeacherId: string,
) {
  if (template.teacherId === null) return true
  if (user.role === 'ADMIN') return template.teacherId === classTeacherId
  return template.teacherId === user.userId
}

const teacherRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Klassen ──────────────────────────────────────────────────────────────

  fastify.get('/classes', { preHandler: fastify.authenticateTeacher }, async (req) => {
    const isAdmin = req.user.role === 'ADMIN'
    return fastify.prisma.class.findMany({
      where: isAdmin ? {} : { teacherId: req.user.userId },
      include: {
        _count: { select: { students: true } },
        teacher: { select: { id: true, displayName: true, email: true } },
      },
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
    const isAdmin = req.user.role === 'ADMIN'
    const cls = await fastify.prisma.class.findFirst({
      where: isAdmin ? { id } : { id, teacherId: req.user.userId },
      include: {
        students: {
          include: { progress: true },
          orderBy: { displayName: 'asc' },
        },
        sessionTemplate: true,
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
      const isAdmin = req.user.role === 'ADMIN'
      const cls = await fastify.prisma.class.findFirst({
        where: isAdmin ? { id } : { id, teacherId: req.user.userId },
      })
      if (!cls) return reply.status(404).send({ error: 'Klasse nicht gefunden' })
      await fastify.prisma.class.delete({ where: { id } })
      return { ok: true }
    },
  )

  fastify.patch('/classes/:id/template', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const BodySchema = z.object({ sessionTemplateId: z.string().nullable() })
    const body = BodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe', issues: body.error.issues })

    const isAdmin = req.user.role === 'ADMIN'
    const cls = await fastify.prisma.class.findFirst({
      where: isAdmin ? { id } : { id, teacherId: req.user.userId },
    })
    if (!cls) return reply.status(404).send({ error: 'Klasse nicht gefunden' })

    if (body.data.sessionTemplateId) {
      const template = await fastify.prisma.sessionTemplate.findUnique({
        where: { id: body.data.sessionTemplateId },
      })
      if (!template) return reply.status(404).send({ error: 'Vorlage nicht gefunden' })
      if (!canUseTemplateForClass(template, req.user, cls.teacherId)) {
        return reply.status(403).send({ error: 'Diese Vorlage ist für diese Klasse nicht verfügbar' })
      }
    }

    return fastify.prisma.class.update({
      where: { id },
      data: { sessionTemplateId: body.data.sessionTemplateId },
      include: { sessionTemplate: true },
    })
  })

  fastify.patch('/classes/:id/teacher', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Nur Admins' })

    const { id } = req.params as { id: string }
    const BodySchema = z.object({ teacherId: z.string().uuid() })
    const body = BodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe', issues: body.error.issues })

    const cls = await fastify.prisma.class.findUnique({
      where: { id },
      include: { sessionTemplate: true },
    })
    if (!cls) return reply.status(404).send({ error: 'Klasse nicht gefunden' })

    const teacher = await fastify.prisma.user.findFirst({
      where: { id: body.data.teacherId, role: { in: ['TEACHER', 'ADMIN'] } },
      select: { id: true },
    })
    if (!teacher) return reply.status(404).send({ error: 'Lehrkraft nicht gefunden' })

    const keepTemplate = cls.sessionTemplate
      ? canUseTemplateForClass(cls.sessionTemplate, req.user, body.data.teacherId)
      : true

    return fastify.prisma.class.update({
      where: { id },
      data: {
        teacherId: body.data.teacherId,
        ...(keepTemplate ? {} : { sessionTemplateId: null }),
      },
      include: {
        _count: { select: { students: true } },
        teacher: { select: { id: true, displayName: true, email: true } },
        sessionTemplate: true,
      },
    })
  })

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

    const loginCode = generateLoginCode()

    const student = await fastify.prisma.user.create({
      data: {
        role: 'CHILD',
        displayName: body.data.displayName,
        classId: body.data.classId ?? null,
        birthYear: body.data.birthYear ?? null,
        qrTokenHash,
        qrTokenRaw: qrToken,
        loginCode,
      },
    })

    await fastify.prisma.userProgress.create({
      data: { userId: student.id, fadingTargetWpm: 60 },
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
      loginCode,
    })
  })

  fastify.post(
    '/students/:id/regenerate-qr',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }

      const isAdmin = req.user.role === 'ADMIN'
      const student = await fastify.prisma.user.findFirst({
        where: isAdmin ? { id, role: 'CHILD' } : { id, role: 'CHILD', class: { teacherId: req.user.userId } },
      })
      if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

      const qrToken = generateQrToken()
      const qrTokenHash = hashQrToken(qrToken)

      await fastify.prisma.user.update({ where: { id }, data: { qrTokenHash, qrTokenRaw: qrToken } })
      await writeAuditLog(fastify.prisma, 'student.qr_regenerate', req.user.userId, id)

      return { qrToken }
    },
  )

  fastify.patch(
    '/students/:id/qr-token',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const BodySchema = z.object({ qrToken: z.string().min(1) })
      const body = BodySchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

      const isAdmin = req.user.role === 'ADMIN'
      const student = await fastify.prisma.user.findFirst({
        where: isAdmin ? { id, role: 'CHILD' } : { id, role: 'CHILD', class: { teacherId: req.user.userId } },
      })
      if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

      const qrTokenHash = hashQrToken(body.data.qrToken)
      await fastify.prisma.user.update({
        where: { id },
        data: { qrTokenHash, qrTokenRaw: body.data.qrToken },
      })
      await writeAuditLog(fastify.prisma, 'student.qr_set_manual', req.user.userId, id)

      return { ok: true }
    },
  )

  fastify.delete(
    '/students/:id',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }

      const isAdmin = req.user.role === 'ADMIN'
      const student = await fastify.prisma.user.findFirst({
        where: isAdmin ? { id, role: 'CHILD' } : { id, role: 'CHILD', class: { teacherId: req.user.userId } },
      })
      if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

      await fastify.prisma.user.delete({ where: { id } })
      await writeAuditLog(fastify.prisma, 'student.delete', req.user.userId, id)

      return { ok: true }
    },
  )

  // ── Einzelner Schüler ─────────────────────────────────────────────────

  fastify.get('/students/:id', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const isAdmin = req.user.role === 'ADMIN'
    const student = await fastify.prisma.user.findFirst({
      where: isAdmin ? { id, role: 'CHILD' } : { id, role: 'CHILD', class: { teacherId: req.user.userId } },
      include: {
        class: { select: { id: true, name: true, sessionTemplateId: true } },
        sessionTemplate: true,
        progress: true,
        sessions: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: { exerciseRuns: true },
        },
      },
    })
    if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

    const lastSession = student.sessions[0]
    const lastRun = lastSession ? primaryFadingRun(lastSession) : null
    const lastSessionAccuracy = runAccuracy(lastRun)

    return {
      id: student.id,
      displayName: student.displayName,
      loginCode: student.loginCode ?? null,
      qrTokenRaw: student.qrTokenRaw ?? null,
      classId: student.classId,
      className: student.class?.name ?? null,
      classSessionTemplateId: student.class?.sessionTemplateId ?? null,
      sessionTemplateId: student.sessionTemplateId,
      sessionTemplate: student.sessionTemplate,
      currentTargetWpm: student.progress?.fadingTargetWpm ?? null,
      totalSessions: student.progress?.totalSessions ?? 0,
      averageQuizAccuracy: student.progress?.averageQuizAccuracy ?? null,
      lastSessionAt: lastSession?.startedAt ?? null,
      lastSessionAccuracy,
      starCount: student.progress?.starCount ?? 0,
      streakDays: student.progress?.streakDays ?? 0,
    }
  })

  fastify.patch('/students/:id/template', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const BodySchema = z.object({ sessionTemplateId: z.string().nullable() })
    const body = BodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe', issues: body.error.issues })

    const isAdmin = req.user.role === 'ADMIN'
    const student = await fastify.prisma.user.findFirst({
      where: isAdmin ? { id, role: 'CHILD' } : { id, role: 'CHILD', class: { teacherId: req.user.userId } },
      include: { class: true },
    })
    if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

    if (body.data.sessionTemplateId) {
      const template = await fastify.prisma.sessionTemplate.findFirst({
        where: {
          id: body.data.sessionTemplateId,
          ...(isAdmin ? {} : { OR: [{ teacherId: null }, { teacherId: req.user.userId }] }),
        },
      })
      if (!template) return reply.status(404).send({ error: 'Vorlage nicht gefunden' })
      if (!canUseTemplateForClass(template, req.user, student.class?.teacherId ?? req.user.userId)) {
        return reply.status(403).send({ error: 'Diese Vorlage ist für diesen Schüler nicht verfügbar' })
      }
    }

    return fastify.prisma.user.update({
      where: { id },
      data: { sessionTemplateId: body.data.sessionTemplateId },
      include: { sessionTemplate: true },
    })
  })

  fastify.post(
    '/students/:id/regenerate-code',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }

      const isAdmin = req.user.role === 'ADMIN'
      const student = await fastify.prisma.user.findFirst({
        where: isAdmin ? { id, role: 'CHILD' } : { id, role: 'CHILD', class: { teacherId: req.user.userId } },
      })
      if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

      const loginCode = generateLoginCode()
      await fastify.prisma.user.update({ where: { id }, data: { loginCode } })
      await writeAuditLog(fastify.prisma, 'student.code_regenerate', req.user.userId, id)

      return { loginCode }
    },
  )

  // ── Sitzungsübersicht für Lehrer ───────────────────────────────────────

  fastify.get(
    '/classes/:id/students-overview',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }

      const isAdmin = req.user.role === 'ADMIN'
      const cls = await fastify.prisma.class.findFirst({
        where: isAdmin ? { id } : { id, teacherId: req.user.userId },
      })
      if (!cls) return reply.status(404).send({ error: 'Klasse nicht gefunden' })

      const students = await fastify.prisma.user.findMany({
        where: { classId: id },
        include: {
          progress: true,
          sessions: {
            orderBy: { startedAt: 'desc' },
            take: 1,
            include: { exerciseRuns: true },
          },
        },
        orderBy: { displayName: 'asc' },
      })

      return students.map((s) => {
        const lastSession = s.sessions[0]
        const accuracy = runAccuracy(lastSession ? primaryFadingRun(lastSession) : null)

        return {
          id: s.id,
          displayName: s.displayName,
          currentTargetWpm: s.progress?.fadingTargetWpm ?? null,
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

      const isAdmin = req.user.role === 'ADMIN'
      const student = await fastify.prisma.user.findFirst({
        where: isAdmin ? { id, role: 'CHILD' } : { id, role: 'CHILD', class: { teacherId: req.user.userId } },
      })
      if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

      const sessions = await fastify.prisma.trainingSession.findMany({
        where: {
          userId: id,
          ...(query.from ? { startedAt: { gte: new Date(query.from) } } : {}),
          ...(query.to ? { startedAt: { lte: new Date(query.to) } } : {}),
        },
        include: { exerciseRuns: { include: { text: { select: { title: true } } } } },
        orderBy: { startedAt: 'desc' },
      })

      return sessions.map((s) => {
        const run = primaryFadingRun(s)
        return {
          id: s.id,
          textTitle: run?.text?.title ?? 'Sitzung',
          targetWpm: run?.targetWpm ?? 0,
          measuredWpm: run?.measuredWpm ?? null,
          wpmFlag: wpmFlag(run?.measuredWpm),
          startedAt: s.startedAt,
          durationMs: s.totalDurationMs,
          completed: s.completed,
          quizAccuracy: runAccuracy(run),
        }
      })
    },
  )

  fastify.get(
    '/students/:id/exercises/:type',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id, type } = req.params as { id: string; type: string }
      const query = req.query as { from?: string; to?: string }
      const ExerciseTypeSchema = z.enum(['FADING', 'FLASH_WORD', 'CLOZE', 'SELF_PACED', 'ALL'])
      const parsedType = ExerciseTypeSchema.safeParse(type.toUpperCase())
      if (!parsedType.success) return reply.status(400).send({ error: 'Ungültiger Übungstyp' })

      const isAdmin = req.user.role === 'ADMIN'
      const student = await fastify.prisma.user.findFirst({
        where: isAdmin ? { id, role: 'CHILD' } : { id, role: 'CHILD', class: { teacherId: req.user.userId } },
      })
      if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

      const runs = await fastify.prisma.exerciseRun.findMany({
        where: {
          session: {
            userId: id,
            ...(query.from ? { startedAt: { gte: new Date(query.from) } } : {}),
            ...(query.to ? { startedAt: { lte: new Date(query.to) } } : {}),
          },
          ...(parsedType.data === 'ALL' ? {} : { exerciseType: parsedType.data }),
        },
        include: {
          session: { select: { id: true, startedAt: true, completed: true } },
          text: { select: { title: true } },
        },
        orderBy: { startedAt: 'desc' },
      })

      return runs.map((r) => ({
        id: r.id,
        sessionId: r.sessionId,
        exerciseType: r.exerciseType,
        textTitle: r.text?.title ?? null,
        startedAt: r.startedAt,
        sessionStartedAt: r.session.startedAt,
        durationMs: r.durationMs,
        itemsTotal: r.itemsTotal,
        itemsCorrect: r.itemsCorrect,
        accuracy: runAccuracy(r),
        targetWpm: r.targetWpm,
        measuredWpm: r.measuredWpm,
        wpmFlag: wpmFlag(r.measuredWpm),
      }))
    },
  )

  // ── Textverwaltung ────────────────────────────────────────────────────────

  fastify.get('/session-templates', { preHandler: fastify.authenticateTeacher }, async (req) => {
    return fastify.prisma.sessionTemplate.findMany({
      where: visibleTemplateWhere(req.user),
      include: { teacher: { select: { id: true, displayName: true } } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    })
  })

  fastify.get('/session-templates/:id', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const template = await fastify.prisma.sessionTemplate.findFirst({
      where: { id, ...visibleTemplateWhere(req.user) },
      include: {
        _count: { select: { classes: true, sessions: true } },
        teacher: { select: { id: true, displayName: true } },
      },
    })
    if (!template) return reply.status(404).send({ error: 'Vorlage nicht gefunden' })
    return template
  })

  fastify.post('/session-templates', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const body = SessionTemplateBodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe', issues: body.error.issues })
    const isAdmin = req.user.role === 'ADMIN'
    const teacherId = isAdmin && body.data.visibility === 'SCHOOL' ? null : req.user.userId

    if (body.data.isDefault && teacherId !== null) {
      return reply.status(403).send({ error: 'Nur schulweite Vorlagen können Default sein' })
    }

    if (body.data.isDefault) {
      await fastify.prisma.sessionTemplate.updateMany({
        where: { isDefault: true, teacherId: null },
        data: { isDefault: false },
      })
    }

    const template = await fastify.prisma.sessionTemplate.create({
      data: {
        name: body.data.name,
        isDefault: body.data.isDefault,
        blocks: body.data.blocks as Prisma.InputJsonValue,
        teacherId,
      },
      include: { teacher: { select: { id: true, displayName: true } } },
    })
    return reply.status(201).send(template)
  })

  fastify.patch('/session-templates/:id', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = UpdateSessionTemplateBodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe', issues: body.error.issues })

    const existing = await fastify.prisma.sessionTemplate.findFirst({
      where: { id, ...visibleTemplateWhere(req.user) },
    })
    if (!existing) return reply.status(404).send({ error: 'Vorlage nicht gefunden' })
    if (!canEditTemplate(existing, req.user)) {
      return reply.status(403).send({ error: 'Diese Vorlage kann von dir nicht bearbeitet werden' })
    }

    if (SYSTEM_TEMPLATE_IDS.has(id) && body.data.blocks) {
      return reply.status(409).send({ error: 'System-Vorlagen können nicht strukturell geändert werden' })
    }
    const nextTeacherId = body.data.visibility !== undefined
      ? (req.user.role === 'ADMIN' && body.data.visibility === 'SCHOOL' ? null : req.user.userId)
      : existing.teacherId
    if (body.data.visibility !== undefined && req.user.role !== 'ADMIN' && body.data.visibility === 'SCHOOL') {
      return reply.status(403).send({ error: 'Nur Admins können Schulvorlagen erstellen' })
    }
    if (body.data.isDefault && nextTeacherId !== null) {
      return reply.status(403).send({ error: 'Nur schulweite Vorlagen können Default sein' })
    }

    if (body.data.isDefault) {
      await fastify.prisma.sessionTemplate.updateMany({
        where: { isDefault: true, teacherId: null, id: { not: id } },
        data: { isDefault: false },
      })
    }

    return fastify.prisma.sessionTemplate.update({
      where: { id },
      data: {
        ...(body.data.name !== undefined ? { name: body.data.name } : {}),
        ...(body.data.isDefault !== undefined ? { isDefault: body.data.isDefault } : {}),
        ...(body.data.visibility !== undefined ? { teacherId: nextTeacherId } : {}),
        ...(body.data.blocks !== undefined ? { blocks: body.data.blocks as Prisma.InputJsonValue } : {}),
      },
      include: { teacher: { select: { id: true, displayName: true } } },
    })
  })

  fastify.delete('/session-templates/:id', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }
    if (SYSTEM_TEMPLATE_IDS.has(id)) {
      return reply.status(409).send({ error: 'System-Vorlagen können nicht gelöscht werden' })
    }

    const template = await fastify.prisma.sessionTemplate.findFirst({
      where: { id, ...visibleTemplateWhere(req.user) },
      include: { _count: { select: { sessions: true, classes: true } } },
    })
    if (!template) return reply.status(404).send({ error: 'Vorlage nicht gefunden' })
    if (!canEditTemplate(template, req.user)) {
      return reply.status(403).send({ error: 'Diese Vorlage kann von dir nicht gelöscht werden' })
    }
    if (template._count.sessions > 0) {
      return reply.status(409).send({ error: 'Vorlage wird bereits von Sitzungen referenziert' })
    }

    await fastify.prisma.$transaction([
      fastify.prisma.class.updateMany({
        where: { sessionTemplateId: id },
        data: { sessionTemplateId: null },
      }),
      fastify.prisma.user.updateMany({
        where: { sessionTemplateId: id },
        data: { sessionTemplateId: null },
      }),
      fastify.prisma.sessionTemplate.delete({ where: { id } }),
    ])
    return { ok: true }
  })

  fastify.post('/flash-words/import', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const BodySchema = z.array(
      z.object({
        word: z.string().min(1),
        syllables: z.number().int().min(1),
        difficultyLevel: z.number().int().min(1),
        distractors: z.array(z.string().min(1)).min(1),
      }),
    )
    const body = BodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültiges Format', issues: body.error.issues })

    let imported = 0
    let updated = 0
    for (const item of body.data) {
      const existing = await fastify.prisma.flashWord.findUnique({ where: { word: item.word } })
      await fastify.prisma.flashWord.upsert({
        where: { word: item.word },
        update: {
          syllables: item.syllables,
          difficultyLevel: item.difficultyLevel,
          distractors: item.distractors,
        },
        create: item,
      })
      if (existing) { updated++ } else { imported++ }
    }

    return { imported, updated }
  })

  fastify.get('/flash-words', { preHandler: fastify.authenticateTeacher }, async (req) => {
    const query = req.query as { q?: string; level?: string }
    const level = query.level ? Number(query.level) : null
    return fastify.prisma.flashWord.findMany({
      where: {
        ...(query.q ? { word: { contains: query.q } } : {}),
        ...(level && Number.isInteger(level) ? { difficultyLevel: level } : {}),
      },
      orderBy: [{ difficultyLevel: 'asc' }, { word: 'asc' }],
      take: 500,
    })
  })

  fastify.post('/flash-words', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const body = FlashWordBodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe', issues: body.error.issues })

    try {
      const word = await fastify.prisma.flashWord.create({ data: body.data })
      return reply.status(201).send(word)
    } catch {
      return reply.status(409).send({ error: 'Dieses Wort existiert bereits' })
    }
  })

  fastify.patch('/flash-words/:id', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = FlashWordBodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe', issues: body.error.issues })

    const existing = await fastify.prisma.flashWord.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Wort nicht gefunden' })

    try {
      return await fastify.prisma.flashWord.update({ where: { id }, data: body.data })
    } catch {
      return reply.status(409).send({ error: 'Dieses Wort existiert bereits' })
    }
  })

  fastify.delete('/flash-words/:id', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const existing = await fastify.prisma.flashWord.findUnique({ where: { id } })
    if (!existing) return reply.status(404).send({ error: 'Wort nicht gefunden' })
    await fastify.prisma.flashWord.delete({ where: { id } })
    return { ok: true }
  })

  fastify.get('/texts', { preHandler: fastify.authenticateTeacher }, async () => {
    const texts = await fastify.prisma.text.findMany({
      select: { id: true, title: true, targetLevel: true, wordCount: true, lixScore: true },
      orderBy: [{ targetLevel: 'asc' }, { title: 'asc' }],
    })

    const grouped = [2, 3, 4].map((level) => ({
      level,
      texts: texts.filter((t) => t.targetLevel === level),
    }))
    return grouped
  })

  fastify.post('/texts/import', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const FileSchema = z.array(ImportTextSchema)
    const parsed = FileSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Ungültiges Format', issues: parsed.error.issues })
    }

    let imported = 0
    let skipped = 0
    for (const t of parsed.data) {
      const existing = await fastify.prisma.text.findUnique({
        where: { title_targetLevel: { title: t.title, targetLevel: t.targetLevel } },
      })
      if (existing) { skipped++; continue }

      const wordCount = t.content.trim().split(/\s+/).filter(Boolean).length
      const lixScore = calculateLix(t.content)
      const estimatedSec = Math.round((wordCount / 80) * 60)

      await fastify.prisma.text.create({
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
              options: q.options,
              correctIndex: q.correctIndex,
              orderIndex: i,
            })),
          },
        },
      })
      imported++
    }

    return { imported, skipped }
  })

  fastify.get('/texts/:id', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const text = await fastify.prisma.text.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { orderIndex: 'asc' } },
        clozeTemplate: { include: { gaps: { orderBy: { wordIndex: 'asc' } } } },
      },
    })
    if (!text) return reply.status(404).send({ error: 'Text nicht gefunden' })
    return {
      ...text,
      questions: text.questions.map((q) => ({
        ...q,
        options: (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) as string[],
      })),
      clozeTemplate: text.clozeTemplate
        ? {
            ...text.clozeTemplate,
            gaps: text.clozeTemplate.gaps.map((gap) => ({
              ...gap,
              distractors: (typeof gap.distractors === 'string' ? JSON.parse(gap.distractors) : gap.distractors) as string[],
            })),
          }
        : null,
    }
  })

  fastify.patch('/texts/:id', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = UpdateTextBodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe', issues: body.error.issues })

    const text = await fastify.prisma.text.findUnique({ where: { id } })
    if (!text) return reply.status(404).send({ error: 'Text nicht gefunden' })

    const wordCount = body.data.content.trim().split(/\s+/).filter(Boolean).length
    const lixScore = calculateLix(body.data.content)
    const estimatedSec = Math.round((wordCount / 80) * 60)

    return fastify.prisma.text.update({
      where: { id },
      data: {
        title: body.data.title,
        content: body.data.content,
        targetLevel: body.data.targetLevel,
        wordCount,
        lixScore,
        estimatedSec,
        questions: {
          deleteMany: {},
          create: body.data.questions.map((q, index) => ({
            question: q.question,
            options: q.options,
            correctIndex: q.correctIndex,
            orderIndex: index,
          })),
        },
      },
      include: { questions: { orderBy: { orderIndex: 'asc' } } },
    })
  })

  fastify.post('/texts/:id/cloze-template', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const BodySchema = z.object({
      strategy: z.enum(['AUTO_EVERY_N', 'MANUAL']).default('AUTO_EVERY_N'),
      gapInterval: z.number().int().min(3).max(20).optional(),
      gaps: z.array(
        z.object({
          wordIndex: z.number().int().min(0),
          correctWord: z.string().min(1),
          distractors: z.array(z.string().min(1)).min(1),
        }),
      ).optional(),
    })
    const body = BodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe', issues: body.error.issues })

    const text = await fastify.prisma.text.findUnique({ where: { id } })
    if (!text) return reply.status(404).send({ error: 'Text nicht gefunden' })

    const template = await fastify.prisma.clozeTemplate.upsert({
      where: { textId: id },
      update: {
        strategy: body.data.strategy,
        gapInterval: body.data.gapInterval ?? (body.data.strategy === 'AUTO_EVERY_N' ? 7 : null),
        gaps: {
          deleteMany: {},
          create: body.data.strategy === 'MANUAL'
            ? (body.data.gaps ?? []).map((gap) => ({
                wordIndex: gap.wordIndex,
                correctWord: gap.correctWord,
                distractors: gap.distractors,
              }))
            : [],
        },
      },
      create: {
        textId: id,
        strategy: body.data.strategy,
        gapInterval: body.data.gapInterval ?? (body.data.strategy === 'AUTO_EVERY_N' ? 7 : null),
        gaps: {
          create: body.data.strategy === 'MANUAL'
            ? (body.data.gaps ?? []).map((gap) => ({
                wordIndex: gap.wordIndex,
                correctWord: gap.correctWord,
                distractors: gap.distractors,
              }))
            : [],
        },
      },
      include: { gaps: { orderBy: { wordIndex: 'asc' } } },
    })

    return template
  })

  fastify.delete(
    '/texts/:id',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const text = await fastify.prisma.text.findUnique({ where: { id } })
      if (!text) return reply.status(404).send({ error: 'Text nicht gefunden' })
      await fastify.prisma.text.delete({ where: { id } })
      return { ok: true }
    },
  )

  // ── Diagnostik-Verwaltung ────────────────────────────────────────────────

  fastify.get('/diagnostics', { preHandler: fastify.authenticateTeacher }, async () => {
    const diagnostics = await fastify.prisma.diagnostic.findMany({
      include: { _count: { select: { items: true, results: true } } },
      orderBy: { type: 'asc' },
    })

    return diagnostics.map((diagnostic) => ({
      id: diagnostic.id,
      type: diagnostic.type,
      name: diagnostic.name,
      durationSec: diagnostic.durationSec,
      itemCount: diagnostic.itemCount,
      intervalSessions: diagnostic.intervalSessions,
      itemTotal: diagnostic._count.items,
      resultTotal: diagnostic._count.results,
    }))
  })

  fastify.patch('/diagnostics/:id', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = DiagnosticConfigBodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe', issues: body.error.issues })

    const diagnostic = await fastify.prisma.diagnostic.findUnique({ where: { id } })
    if (!diagnostic) return reply.status(404).send({ error: 'Diagnostik nicht gefunden' })

    return fastify.prisma.diagnostic.update({
      where: { id },
      data: {
        name: body.data.name,
        durationSec: body.data.durationSec,
        itemCount: body.data.itemCount,
        intervalSessions: diagnostic.type === 'INTERMEDIATE'
          ? body.data.intervalSessions ?? null
          : null,
      },
    })
  })

  fastify.get('/diagnostics/:id/items', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const diagnostic = await fastify.prisma.diagnostic.findUnique({ where: { id } })
    if (!diagnostic) return reply.status(404).send({ error: 'Diagnostik nicht gefunden' })

    return fastify.prisma.diagnosticItem.findMany({
      where: { diagnosticId: id },
      orderBy: [{ difficulty: 'asc' }, { orderIndex: 'asc' }],
    })
  })

  fastify.post('/diagnostics/:id/items', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Nur Admins' })
    const { id } = req.params as { id: string }
    const body = DiagnosticItemBodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe', issues: body.error.issues })

    const diagnostic = await fastify.prisma.diagnostic.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    })
    if (!diagnostic) return reply.status(404).send({ error: 'Diagnostik nicht gefunden' })

    return reply.status(201).send(await fastify.prisma.diagnosticItem.create({
      data: {
        diagnosticId: id,
        sentence: body.data.sentence,
        isNonsense: body.data.isNonsense,
        difficulty: body.data.difficulty,
        orderIndex: diagnostic._count.items,
      },
    }))
  })

  fastify.post('/diagnostics/:id/items/import', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Nur Admins' })
    const { id } = req.params as { id: string }
    const BodySchema = z.array(DiagnosticItemBodySchema).min(1).max(500)
    const body = BodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültiges Format', issues: body.error.issues })

    const diagnostic = await fastify.prisma.diagnostic.findUnique({
      where: { id },
      include: { _count: { select: { items: true } } },
    })
    if (!diagnostic) return reply.status(404).send({ error: 'Diagnostik nicht gefunden' })

    const result = await fastify.prisma.diagnosticItem.createMany({
      data: body.data.map((item, index) => ({
        diagnosticId: id,
        sentence: item.sentence,
        isNonsense: item.isNonsense,
        difficulty: item.difficulty,
        orderIndex: diagnostic._count.items + index,
      })),
      skipDuplicates: true,
    })

    return { imported: result.count, skipped: body.data.length - result.count }
  })

  fastify.patch('/diagnostic-items/:id', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Nur Admins' })
    const { id } = req.params as { id: string }
    const body = DiagnosticItemBodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe', issues: body.error.issues })

    const item = await fastify.prisma.diagnosticItem.findUnique({ where: { id } })
    if (!item) return reply.status(404).send({ error: 'Satz nicht gefunden' })

    return fastify.prisma.diagnosticItem.update({
      where: { id },
      data: body.data,
    })
  })

  fastify.delete('/diagnostic-items/:id', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Nur Admins' })
    const { id } = req.params as { id: string }
    const item = await fastify.prisma.diagnosticItem.findUnique({
      where: { id },
      include: { _count: { select: { answers: true } } },
    })
    if (!item) return reply.status(404).send({ error: 'Satz nicht gefunden' })
    if (item._count.answers > 0) {
      return reply.status(409).send({ error: 'Satz wurde bereits in Diagnostiken verwendet und kann nicht gelöscht werden' })
    }
    await fastify.prisma.diagnosticItem.delete({ where: { id } })
    return { ok: true }
  })

  // ── Diagnostikergebnisse ─────────────────────────────────────────────────

  fastify.get(
    '/students/:id/diagnostics',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const isAdmin = req.user.role === 'ADMIN'

      const student = await fastify.prisma.user.findFirst({
        where: isAdmin
          ? { id, role: 'CHILD' }
          : { id, role: 'CHILD', class: { teacherId: req.user.userId } },
        select: { id: true },
      })
      if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

      const results = await fastify.prisma.diagnosticResult.findMany({
        where: { userId: id, finishedAt: { not: null } },
        orderBy: { startedAt: 'desc' },
        include: {
          diagnostic: { select: { name: true, type: true } },
          answers: {
            include: { result: false, item: { select: { sentence: true, isNonsense: true, difficulty: true } } },
            orderBy: { id: 'asc' },
          },
        },
      })

      return results.map((r) => ({
        id: r.id,
        type: r.diagnostic.type,
        name: r.diagnostic.name,
        startedAt: r.startedAt,
        finishedAt: r.finishedAt,
        estimatedWpm: r.estimatedWpm,
        correctCount: r.correctCount,
        wrongCount: r.wrongCount,
        skippedCount: r.skippedCount,
        answers: r.answers.map((a) => ({
          sentence: a.item.sentence,
          isNonsense: a.item.isNonsense,
          difficulty: a.item.difficulty,
          answer: a.answer,
          isCorrect: a.isCorrect,
          responseTimeMs: a.responseTimeMs,
        })),
      }))
    },
  )

  // ── DSGVO-Export ──────────────────────────────────────────────────────────

  fastify.get(
    '/students/:id/export.json',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }

      const isAdmin = req.user.role === 'ADMIN'
      const student = await fastify.prisma.user.findFirst({
        where: isAdmin ? { id, role: 'CHILD' } : { id, role: 'CHILD', class: { teacherId: req.user.userId } },
        include: {
          progress: true,
          sessions: {
            orderBy: { startedAt: 'desc' },
            include: { exerciseRuns: { include: { text: { select: { title: true } } } } },
          },
          diagnostics: {
            include: { diagnostic: { select: { name: true, type: true } }, answers: true },
          },
        },
      })
      if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

      const payload = {
        exportDate: new Date().toISOString(),
        dataSubject: {
          id: student.id,
          displayName: student.displayName,
          birthYear: student.birthYear,
          createdAt: student.createdAt,
        },
        progress: student.progress
          ? {
              currentTargetWpm: student.progress.fadingTargetWpm,
              fadingTargetWpm: student.progress.fadingTargetWpm,
              totalSessions: student.progress.totalSessions,
              averageQuizAccuracy: student.progress.averageQuizAccuracy,
              starCount: student.progress.starCount,
              streakDays: student.progress.streakDays,
            }
          : null,
        trainingSessions: student.sessions.map((s) => {
          const run = primaryFadingRun(s)
          return {
            id: s.id,
            textTitle: run?.text?.title ?? 'Sitzung',
            targetWpm: run?.targetWpm ?? null,
            startedAt: s.startedAt,
            durationMs: s.totalDurationMs,
            completed: s.completed,
            starsEarned: s.starsEarned,
            exerciseRuns: s.exerciseRuns.map((r) => ({
              id: r.id,
              exerciseType: r.exerciseType,
              textTitle: r.text?.title ?? null,
              targetWpm: r.targetWpm,
              durationMs: r.durationMs,
              itemsTotal: r.itemsTotal,
              itemsCorrect: r.itemsCorrect,
              responses: r.responses,
            })),
          }
        }),
        diagnostics: student.diagnostics.map((r) => ({
          id: r.id,
          type: r.diagnostic.type,
          name: r.diagnostic.name,
          startedAt: r.startedAt,
          finishedAt: r.finishedAt,
          correctCount: r.correctCount,
          wrongCount: r.wrongCount,
          estimatedWpm: r.estimatedWpm,
        })),
      }

      const nameEncoded = encodeURIComponent(`leseflux-export-${student.displayName}.json`)
      const nameSafe = `leseflux-export-${student.displayName.replace(/[^\w.-]/g, '_')}.json`
      reply.header('Content-Type', 'application/json')
      reply.header('Content-Disposition', `attachment; filename="${nameSafe}"; filename*=UTF-8''${nameEncoded}`)
      await writeAuditLog(fastify.prisma, 'data.export', req.user.userId, student.id, { format: 'json' })
      return payload
    },
  )

  fastify.get(
    '/students/:id/export.csv',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }

      const isAdmin = req.user.role === 'ADMIN'
      const student = await fastify.prisma.user.findFirst({
        where: isAdmin ? { id, role: 'CHILD' } : { id, role: 'CHILD', class: { teacherId: req.user.userId } },
        include: {
          sessions: {
            orderBy: { startedAt: 'asc' },
            include: { exerciseRuns: { include: { text: { select: { title: true } } } } },
          },
        },
      })
      if (!student) return reply.status(404).send({ error: 'Schüler nicht gefunden' })

      const rows = [
        ['Datum', 'Text', 'Ziel-WPM', 'Dauer (s)', 'Sterne', 'Quiz-Genauigkeit (%)'].join(';'),
        ...student.sessions.map((s) => {
          const run = primaryFadingRun(s)
          const accuracy = run ? Math.round((runAccuracy(run) ?? 0) * 100) : ''
          return [
            s.startedAt.toISOString().slice(0, 10),
            `"${run?.text?.title ?? 'Sitzung'}"`,
            run?.targetWpm ?? '',
            s.totalDurationMs !== null ? Math.round(s.totalDurationMs / 1000) : '',
            s.starsEarned ?? '',
            accuracy,
          ].join(';')
        }),
      ]

      const nameEncoded = encodeURIComponent(`leseflux-export-${student.displayName}.csv`)
      const nameSafe = `leseflux-export-${student.displayName.replace(/[^\w.-]/g, '_')}.csv`
      reply.header('Content-Type', 'text/csv; charset=utf-8')
      reply.header('Content-Disposition', `attachment; filename="${nameSafe}"; filename*=UTF-8''${nameEncoded}`)
      await writeAuditLog(fastify.prisma, 'data.export', req.user.userId, student.id, { format: 'csv' })
      return rows.join('\n')
    },
  )

  // ── QR-Code-Daten für Druck ───────────────────────────────────────────────

  fastify.get(
    '/classes/:id/qr-data',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const { id } = req.params as { id: string }

      const isAdmin = req.user.role === 'ADMIN'
      const cls = await fastify.prisma.class.findFirst({
        where: isAdmin ? { id } : { id, teacherId: req.user.userId },
        include: {
          students: {
            select: { id: true, displayName: true, qrTokenHash: true, loginCode: true },
            orderBy: { displayName: 'asc' },
          },
        },
      })
      if (!cls) return reply.status(404).send({ error: 'Klasse nicht gefunden' })

      return {
        className: cls.name,
        schoolYear: cls.schoolYear,
        students: cls.students.map((s) => ({
          id: s.id,
          displayName: s.displayName,
          loginCode: s.loginCode,
        })),
      }
    },
  )

  // ── Anton-Import ──────────────────────────────────────────────────────────

  fastify.post(
    '/students/import-anton',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      const RequestSchema = z.object({
        defaultClassId: z.string().optional(),
        rows: z.array(
          z.object({
            vorname: z.string().min(1),
            nachname: z.string().optional().default(''),
            klasse: z.string().optional().default(''),
            antonCode: z.string().min(1),
            schuljahr: z.string().optional(),
          }),
        ),
      })
      const body = RequestSchema.safeParse(req.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Ungültiges Format', issues: body.error.issues })
      }
      const { rows: importRows, defaultClassId } = body.data

      let imported = 0
      const skipped: string[] = []
      const classCache = new Map<string, string>() // name → id

      const getOrCreateClass = async (name: string, schuljahr?: string): Promise<string> => {
        const key = name.toLowerCase()
        if (classCache.has(key)) return classCache.get(key)!
        const isAdmin = req.user.role === 'ADMIN'
        let cls = await fastify.prisma.class.findFirst({
          where: isAdmin ? { name } : { name, teacherId: req.user.userId },
        })
        if (!cls) {
          cls = await fastify.prisma.class.create({
            data: {
              name,
              schoolYear: schuljahr ?? '2025/26',
              teacherId: req.user.userId,
            },
          })
        }
        classCache.set(key, cls.id)
        return cls.id
      }

      for (const row of importRows) {
        const antonCode = row.antonCode.trim().toLowerCase()
        const fullQr = `anton://login/${antonCode}`
        const qrTokenHash = hashQrToken(fullQr)

        const existing = await fastify.prisma.user.findUnique({ where: { qrTokenHash } })
        if (existing) {
          skipped.push(`${row.vorname} (${antonCode}): bereits vorhanden`)
          continue
        }

        const displayName = row.vorname.trim()
        const classId = row.klasse.trim()
          ? await getOrCreateClass(row.klasse.trim(), row.schuljahr)
          : (defaultClassId ?? (await getOrCreateClass('Importiert', row.schuljahr)))
        const loginCode = generateLoginCode()

        const student = await fastify.prisma.user.create({
          data: { role: 'CHILD', displayName, classId, qrTokenHash, loginCode },
        })
        await fastify.prisma.userProgress.create({
          data: { userId: student.id, fadingTargetWpm: 60 },
        })
        await writeAuditLog(fastify.prisma, 'student.import_anton', req.user.userId, student.id, {
          antonCode,
        })
        imported++
      }

      return { imported, skipped }
    },
  )

  fastify.patch('/me/password', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    const BodySchema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, 'Neues Passwort muss mindestens 8 Zeichen haben.'),
    })
    const body = BodySchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: body.error.issues[0]?.message ?? 'Ungültige Eingabe' })

    const user = await fastify.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { passwordHash: true },
    })
    if (!user?.passwordHash) return reply.status(400).send({ error: 'Passwort kann nicht geändert werden.' })

    const valid = await argon2.verify(user.passwordHash, body.data.currentPassword)
    if (!valid) return reply.status(400).send({ error: 'Aktuelles Passwort ist falsch.' })

    const newHash = await argon2.hash(body.data.newPassword)
    await fastify.prisma.user.update({
      where: { id: req.user.userId },
      data: { passwordHash: newHash },
    })

    await writeAuditLog(fastify.prisma, 'user.password_changed', req.user.userId, req.user.userId, {})
    return { ok: true }
  })
}

export default teacherRoutes
