-- AlterTable
ALTER TABLE "Class" ADD COLUMN "sessionTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_sessionTemplateId_fkey" FOREIGN KEY ("sessionTemplateId") REFERENCES "SessionTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
