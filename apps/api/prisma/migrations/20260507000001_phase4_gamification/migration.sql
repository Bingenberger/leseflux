-- AlterTable: TrainingSession – add starsEarned
ALTER TABLE "TrainingSession" ADD COLUMN "starsEarned" INTEGER;

-- AlterTable: UserProgress – add gamification fields
ALTER TABLE "UserProgress" ADD COLUMN "starCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserProgress" ADD COLUMN "streakDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserProgress" ADD COLUMN "lastSessionDate" TIMESTAMP(3);
