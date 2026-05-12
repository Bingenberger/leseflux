import type { FastifyPluginAsync } from 'fastify'
import { hash as argon2Hash } from 'argon2'
import { CreateTeacherSchema, UpdateSettingsSchema } from '@leseflux/shared'
import { z } from 'zod'

const DEFAULTS = { childLoginMethods: 'QR_AND_CODE' } as const

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.patch(
    '/classes/:id/teacher',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
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

      const keepTemplate = !cls.sessionTemplate?.teacherId
        || cls.sessionTemplate.teacherId === body.data.teacherId

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
    },
  )

  fastify.post('/teachers', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Nur Admins' })

    const body = CreateTeacherSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

    const passwordHash = await argon2Hash(body.data.password)

    const teacher = await fastify.prisma.user.create({
      data: {
        role: 'TEACHER',
        displayName: body.data.displayName,
        email: body.data.email,
        passwordHash,
      },
      select: { id: true, displayName: true, email: true, role: true, createdAt: true },
    })

    return reply.status(201).send(teacher)
  })

  fastify.get('/teachers', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Nur Admins' })

    const teachers = await fastify.prisma.user.findMany({
      where: { role: { in: ['TEACHER', 'ADMIN'] } },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { teacherOf: true } },
      },
      orderBy: { displayName: 'asc' },
    })

    return teachers.map((t) => ({ ...t, classCount: t._count.teacherOf }))
  })

  fastify.patch(
    '/teachers/:id',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Nur Admins' })

      const { id } = req.params as { id: string }
      const UpdateSchema = z.object({
        displayName: z.string().min(1).optional(),
        email: z.string().email().optional(),
        password: z.string().min(8).optional(),
      })
      const body = UpdateSchema.safeParse(req.body)
      if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

      const data: Record<string, unknown> = {}
      if (body.data.displayName) data.displayName = body.data.displayName
      if (body.data.email) data.email = body.data.email
      if (body.data.password) data.passwordHash = await argon2Hash(body.data.password)

      const updated = await fastify.prisma.user.update({
        where: { id },
        data,
        select: { id: true, displayName: true, email: true, role: true },
      })

      return updated
    },
  )

  fastify.delete(
    '/teachers/:id',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Nur Admins' })

      const { id } = req.params as { id: string }

      if (id === req.user.userId) {
        return reply.status(400).send({ error: 'Eigenes Konto kann nicht gelöscht werden' })
      }

      const teacher = await fastify.prisma.user.findFirst({
        where: { id, role: { in: ['TEACHER', 'ADMIN'] } },
      })
      if (!teacher) return reply.status(404).send({ error: 'Lehrer nicht gefunden' })

      await fastify.prisma.user.delete({ where: { id } })

      return { ok: true }
    },
  )
  fastify.post(
    '/teachers/import',
    { preHandler: fastify.authenticateTeacher },
    async (req, reply) => {
      if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Nur Admins' })

      const ImportSchema = z.array(
        z.object({
          displayName: z.string().min(1),
          email: z.string().email(),
          password: z.string().min(8),
        }),
      )
      const body = ImportSchema.safeParse(req.body)
      if (!body.success) {
        return reply.status(400).send({ error: 'Ungültiges Format', issues: body.error.issues })
      }

      let imported = 0
      const skipped: string[] = []

      for (const row of body.data) {
        const existing = await fastify.prisma.user.findUnique({ where: { email: row.email } })
        if (existing) {
          skipped.push(`${row.email}: bereits vorhanden`)
          continue
        }
        const passwordHash = await argon2Hash(row.password)
        await fastify.prisma.user.create({
          data: { role: 'TEACHER', displayName: row.displayName, email: row.email, passwordHash },
        })
        imported++
      }

      return { imported, skipped }
    },
  )
  fastify.get('/settings', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Nur Admins' })
    const rows = await fastify.prisma.systemSetting.findMany()
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return { childLoginMethods: map.childLoginMethods ?? DEFAULTS.childLoginMethods }
  })

  fastify.patch('/settings', { preHandler: fastify.authenticateTeacher }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Nur Admins' })
    const body = UpdateSettingsSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

    const updates = Object.entries(body.data).filter(([, v]) => v !== undefined) as [string, string][]
    await Promise.all(
      updates.map(([key, value]) =>
        fastify.prisma.systemSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      ),
    )

    const rows = await fastify.prisma.systemSetting.findMany()
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return { childLoginMethods: map.childLoginMethods ?? DEFAULTS.childLoginMethods }
  })
}

export default adminRoutes
