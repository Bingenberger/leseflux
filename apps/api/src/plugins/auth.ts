import fp from 'fastify-plugin'
import jwtPlugin from '@fastify/jwt'
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import type { JwtPayload } from '@leseflux/shared'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
    authenticateTeacher: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

const authPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.register(jwtPlugin, {
    secret: process.env.JWT_SECRET ?? '',
    cookie: { cookieName: 'token', signed: false },
  })

  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify()
    } catch {
      reply.status(401).send({ error: 'Nicht angemeldet' })
    }
  })

  fastify.decorate('authenticateTeacher', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify()
      if (req.user.role !== 'TEACHER' && req.user.role !== 'ADMIN') {
        return reply.status(403).send({ error: 'Keine Berechtigung' })
      }
    } catch {
      reply.status(401).send({ error: 'Nicht angemeldet' })
    }
  })
})

export default authPlugin
