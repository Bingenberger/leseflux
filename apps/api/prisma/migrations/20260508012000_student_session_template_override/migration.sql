ALTER TABLE "User" ADD COLUMN "sessionTemplateId" TEXT;

CREATE INDEX "User_sessionTemplateId_idx" ON "User"("sessionTemplateId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_sessionTemplateId_fkey"
  FOREIGN KEY ("sessionTemplateId") REFERENCES "SessionTemplate"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
