import type { FastifyPluginAsync } from 'fastify'
import { hash as argon2Hash } from 'argon2'
import { CreateTeacherSchema } from '@leseflux/shared'

const adminRoutes: FastifyPluginAsync = async (fastify) => {
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

    return fastify.prisma.user.findMany({
      where: { role: { in: ['TEACHER', 'ADMIN'] } },
      select: { id: true, displayName: true, email: true, role: true, createdAt: true },
      orderBy: { displayName: 'asc' },
    })
  })
}

export default adminRoutes
