import type { FastifyPluginAsync } from 'fastify'

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`
      return reply.send({ status: 'ok', db: 'ok' })
    } catch {
      return reply.status(503).send({ status: 'error', db: 'unreachable' })
    }
  })
}

export default healthRoutes
