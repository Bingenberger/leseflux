ALTER TABLE "SessionTemplate" ADD COLUMN "teacherId" TEXT;

CREATE INDEX "SessionTemplate_teacherId_idx" ON "SessionTemplate"("teacherId");

ALTER TABLE "SessionTemplate"
  ADD CONSTRAINT "SessionTemplate_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
