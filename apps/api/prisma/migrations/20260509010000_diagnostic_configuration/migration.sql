ALTER TABLE "Diagnostic" ADD COLUMN "itemCount" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "Diagnostic" ADD COLUMN "intervalSessions" INTEGER;

UPDATE "Diagnostic"
SET "intervalSessions" = 10
WHERE "type" = 'INTERMEDIATE'
  AND "intervalSessions" IS NULL;
