import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'

import prismaPlugin from './plugins/prisma.js'
import authPlugin from './plugins/auth.js'
import healthRoutes from './modules/health/routes.js'
import authRoutes from './modules/auth/routes.js'
import trainingRoutes from './modules/training/routes.js'
import teacherRoutes from './modules/teacher/routes.js'
import adminRoutes from './modules/admin/routes.js'

export function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
      serializers: {
        req: (req) => ({ method: req.method, url: req.url }),
      },
    },
  })

  app.register(helmet, { contentSecurityPolicy: false })
  app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })
  app.register(cookie)

  // Rate-Limiting global registrieren, aber per default NICHT aktiv (global: false).
  // Einzelne Routen aktivieren es über config.rateLimit.
  app.register(rateLimit, { global: false })

  app.register(prismaPlugin)
  app.register(authPlugin)

  app.register(healthRoutes, { prefix: '/api' })
  app.register(authRoutes, { prefix: '/api/auth' })
  app.register(trainingRoutes, { prefix: '/api/training' })
  app.register(teacherRoutes, { prefix: '/api/teacher' })
  app.register(adminRoutes, { prefix: '/api/admin' })

  return app
}
