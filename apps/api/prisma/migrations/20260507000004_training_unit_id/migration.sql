-- AlterTable: add trainingUnitId to link multiple sessions within one training unit
ALTER TABLE "TrainingSession" ADD COLUMN "trainingUnitId" TEXT;
