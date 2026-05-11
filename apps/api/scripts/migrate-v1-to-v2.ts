import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function tableExists(tableName: string) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${tableName}
    ) AS "exists"
  `
  return rows[0]?.exists ?? false
}

async function columnExists(tableName: string, columnName: string) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = ${columnName}
    ) AS "exists"
  `
  return rows[0]?.exists ?? false
}

async function main() {
  const hasSessionAnswer = await tableExists('SessionAnswer')
  const hasOldSessionText = await columnExists('TrainingSession', 'textId')
  const hasOldProgressWpm = await columnExists('UserProgress', 'currentTargetWpm')

  if (hasSessionAnswer && hasOldSessionText) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO "ExerciseRun" (
          "id", "sessionId", "exerciseType", "orderIndex", "startedAt", "finishedAt",
          "durationMs", "textId", "targetWpm", "itemsTotal", "itemsCorrect", "responses"
      )
      SELECT
          'migrated-' || s."id",
          s."id",
          'FADING'::"ExerciseType",
          0,
          s."startedAt",
          s."finishedAt",
          s."durationMs",
          s."textId",
          s."targetWpm",
          COUNT(a."id")::INTEGER,
          COUNT(a."id") FILTER (WHERE a."isCorrect")::INTEGER,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'questionId', a."questionId",
                'selectedIndex', a."selectedIndex",
                'isCorrect', a."isCorrect",
                'responseTimeMs', a."responseTimeMs"
              )
              ORDER BY a."id"
            ) FILTER (WHERE a."id" IS NOT NULL),
            '[]'::jsonb
          )
      FROM "TrainingSession" s
      LEFT JOIN "SessionAnswer" a ON a."sessionId" = s."id"
      WHERE NOT EXISTS (
        SELECT 1 FROM "ExerciseRun" r
        WHERE r."id" = 'migrated-' || s."id"
      )
      GROUP BY s."id";
    `)

    await prisma.$executeRawUnsafe(`
      UPDATE "TrainingSession"
      SET "totalDurationMs" = "durationMs"
      WHERE "totalDurationMs" IS NULL;
    `)
  }

  if (hasOldProgressWpm) {
    await prisma.$executeRawUnsafe(`
      UPDATE "UserProgress"
      SET
        "fadingTargetWpm" = "currentTargetWpm",
        "fadingSessionsSinceIncrease" = "sessionsSinceLastIncrease";
    `)
  }

  console.log('v1→v2 Datenmigration abgeschlossen oder nicht erforderlich.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
