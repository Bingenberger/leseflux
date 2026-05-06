import type { FastifyPluginAsync } from 'fastify'
import { hash as argon2Hash, verify as argon2Verify } from 'argon2'
import { LoginChildSchema, LoginTeacherSchema } from '@leseflux/shared'
import { hashQrToken } from '../../lib/qr.js'
import { authConfig, rateLimitConfig } from '../../config.js'

const loginRateLimit = {
  config: {
    rateLimit: {
      max: rateLimitConfig.loginMax,
      timeWindow: rateLimitConfig.loginWindowMs,
    },
  },
}

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/login-child', loginRateLimit, async (req, reply) => {
    const body = LoginChildSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

    const hash = hashQrToken(body.data.qrToken)
    const user = await fastify.prisma.user.findUnique({
      where: { qrTokenHash: hash },
      select: { id: true, role: true, displayName: true, classId: true },
    })

    if (!user || user.role !== 'CHILD') {
      return reply.status(401).send({ error: 'Ungültiger QR-Code' })
    }

    const token = fastify.jwt.sign(
      { userId: user.id, role: user.role },
      { expiresIn: authConfig.childTokenExpiry },
    )
    reply.setCookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    })
    return { token, user }
  })

  fastify.post('/login-teacher', loginRateLimit, async (req, reply) => {
    const body = LoginTeacherSchema.safeParse(req.body)
    if (!body.success) return reply.status(400).send({ error: 'Ungültige Eingabe' })

    const user = await fastify.prisma.user.findUnique({
      where: { email: body.data.email },
      select: { id: true, role: true, displayName: true, email: true, passwordHash: true },
    })

    if (!user || !user.passwordHash || user.role === 'CHILD') {
      return reply.status(401).send({ error: 'Ungültige Anmeldedaten' })
    }

    const valid = await argon2Verify(user.passwordHash, body.data.password)
    if (!valid) return reply.status(401).send({ error: 'Ungültige Anmeldedaten' })

    const token = fastify.jwt.sign(
      { userId: user.id, role: user.role },
      { expiresIn: authConfig.teacherTokenExpiry },
    )
    reply.setCookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    })
    return {
      token,
      user: { id: user.id, role: user.role, displayName: user.displayName, email: user.email },
    }
  })

  fastify.post('/logout', async (_, reply) => {
    reply.clearCookie('token', { path: '/' })
    return { ok: true }
  })

  fastify.get('/me', { preHandler: fastify.authenticate }, async (req) => {
    const user = await fastify.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, role: true, displayName: true, email: true, classId: true },
    })
    return user
  })
}

export default authRoutes
