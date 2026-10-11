-- CreateEnum
CREATE TYPE "QuizLockdownMode" AS ENUM ('OFF', 'MONITOR', 'STRICT');

-- CreateEnum
CREATE TYPE "QuizViolationKind" AS ENUM ('TAB_EXIT', 'FULLSCREEN_EXIT', 'WINDOW_BLUR');

-- AlterTable
ALTER TABLE "quiz" ADD COLUMN     "lockdownMode" "QuizLockdownMode" NOT NULL DEFAULT 'STRICT';

-- AlterTable
ALTER TABLE "quiz_attempt" ADD COLUMN     "lockdownLockedAt" TIMESTAMP(3),
ADD COLUMN     "violationCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "quiz_violation" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "kind" "QuizViolationKind" NOT NULL,
    "awayMs" INTEGER NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_violation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quiz_violation_attemptId_occurredAt_idx" ON "quiz_violation"("attemptId", "occurredAt");

-- AddForeignKey
ALTER TABLE "quiz_violation" ADD CONSTRAINT "quiz_violation_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "quiz_attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

