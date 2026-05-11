-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('FADING', 'FLASH_WORD', 'CLOZE', 'SELF_PACED');

-- CreateEnum
CREATE TYPE "ClozeStrategy" AS ENUM ('AUTO_EVERY_N', 'MANUAL');

-- CreateTable
CREATE TABLE "SessionTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "blocks" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseRun" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseType" "ExerciseType" NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "textId" TEXT,
    "targetWpm" INTEGER,
    "flashDurationMs" INTEGER,
    "flashDifficulty" INTEGER,
    "itemsTotal" INTEGER NOT NULL DEFAULT 0,
    "itemsCorrect" INTEGER NOT NULL DEFAULT 0,
    "measuredWpm" DOUBLE PRECISION,
    "responses" JSONB NOT NULL,

    CONSTRAINT "ExerciseRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashWord" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "syllables" INTEGER NOT NULL,
    "difficultyLevel" INTEGER NOT NULL,
    "distractors" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlashWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClozeTemplate" (
    "id" TEXT NOT NULL,
    "textId" TEXT NOT NULL,
    "strategy" "ClozeStrategy" NOT NULL,
    "gapInterval" INTEGER,

    CONSTRAINT "ClozeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClozeGap" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "wordIndex" INTEGER NOT NULL,
    "correctWord" TEXT NOT NULL,
    "distractors" JSONB NOT NULL,

    CONSTRAINT "ClozeGap_pkey" PRIMARY KEY ("id")
);

-- AlterTable: add v2 container/progress fields before data migration.
ALTER TABLE "TrainingSession" ADD COLUMN "templateId" TEXT;
ALTER TABLE "TrainingSession" ADD COLUMN "totalDurationMs" INTEGER;

ALTER TABLE "UserProgress" ADD COLUMN "fadingTargetWpm" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "UserProgress" ADD COLUMN "selfPacedAvgWpm" DOUBLE PRECISION;
ALTER TABLE "UserProgress" ADD COLUMN "flashWordLevel" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "UserProgress" ADD COLUMN "flashWordDurationMs" INTEGER NOT NULL DEFAULT 500;
ALTER TABLE "UserProgress" ADD COLUMN "clozeAccuracy" DOUBLE PRECISION;
ALTER TABLE "UserProgress" ADD COLUMN "fadingSessionsSinceIncrease" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserProgress" ADD COLUMN "flashSessionsSinceIncrease" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserProgress" ADD COLUMN "clozeSessionsSinceIncrease" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "FlashWord_word_key" ON "FlashWord"("word");
CREATE UNIQUE INDEX "ClozeTemplate_textId_key" ON "ClozeTemplate"("textId");

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "SessionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExerciseRun" ADD CONSTRAINT "ExerciseRun_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExerciseRun" ADD CONSTRAINT "ExerciseRun_textId_fkey" FOREIGN KEY ("textId") REFERENCES "Text"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClozeTemplate" ADD CONSTRAINT "ClozeTemplate_textId_fkey" FOREIGN KEY ("textId") REFERENCES "Text"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClozeGap" ADD CONSTRAINT "ClozeGap_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ClozeTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data migration: keep every v1 session as one FADING exercise run.
INSERT INTO "ExerciseRun" (
    "id",
    "sessionId",
    "exerciseType",
    "orderIndex",
    "startedAt",
    "finishedAt",
    "durationMs",
    "textId",
    "targetWpm",
    "itemsTotal",
    "itemsCorrect",
    "responses"
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
GROUP BY s."id";

UPDATE "TrainingSession"
SET "totalDurationMs" = "durationMs";

UPDATE "UserProgress"
SET
  "fadingTargetWpm" = "currentTargetWpm",
  "fadingSessionsSinceIncrease" = "sessionsSinceLastIncrease";

-- Seed the Phase-A default template. It is a FADING-only template, so child UX stays unchanged.
INSERT INTO "SessionTemplate" ("id", "name", "isDefault", "blocks")
VALUES (
  'default-fading-only',
  'Standard Fading',
  true,
  '[{"type":"FADING","targetDurationSec":720}]'::jsonb
)
ON CONFLICT ("id") DO NOTHING;

-- Cleanup v1 shape.
ALTER TABLE "TrainingSession" DROP CONSTRAINT "TrainingSession_textId_fkey";
ALTER TABLE "SessionAnswer" DROP CONSTRAINT "SessionAnswer_sessionId_fkey";
DROP TABLE "SessionAnswer";

ALTER TABLE "TrainingSession" DROP COLUMN "textId";
ALTER TABLE "TrainingSession" DROP COLUMN "targetWpm";
ALTER TABLE "TrainingSession" DROP COLUMN "fadingMsBase";
ALTER TABLE "TrainingSession" DROP COLUMN "fadingMsPerChar";
ALTER TABLE "TrainingSession" DROP COLUMN "durationMs";

ALTER TABLE "UserProgress" DROP COLUMN "currentTargetWpm";
ALTER TABLE "UserProgress" DROP COLUMN "sessionsSinceLastIncrease";
