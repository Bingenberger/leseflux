ALTER TABLE "User" ADD COLUMN "qrTokenRaw" TEXT;
CREATE UNIQUE INDEX "User_qrTokenRaw_key" ON "User"("qrTokenRaw");
