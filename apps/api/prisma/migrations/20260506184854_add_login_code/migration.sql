/*
  Warnings:

  - A unique constraint covering the columns `[loginCode]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "loginCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_loginCode_key" ON "User"("loginCode");
