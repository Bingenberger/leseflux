FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci --workspace=apps/api --workspace=packages/shared

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
RUN npm run build -w packages/shared
RUN npm run build -w apps/api
RUN cd apps/api && npx prisma generate

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY apps/api/prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/server.js"]
