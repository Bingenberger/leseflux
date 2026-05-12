import type { FastifyPluginAsync } from 'fastify'

const DEFAULTS = { childLoginMethods: 'QR_AND_CODE' } as const

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_, reply) => {
    try {
      await fastify.prisma.$queryRaw`SELECT 1`
      return reply.send({ status: 'ok', db: 'ok' })
    } catch {
      return reply.status(503).send({ status: 'error', db: 'unreachable' })
    }
  })

  fastify.get('/settings', async () => {
    const rows = await fastify.prisma.systemSetting.findMany()
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return { childLoginMethods: map.childLoginMethods ?? DEFAULTS.childLoginMethods }
  })
}

export default healthRoutes
