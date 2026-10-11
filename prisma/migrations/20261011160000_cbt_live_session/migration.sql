-- CreateEnum
CREATE TYPE "CbtSessionStatus" AS ENUM ('WAITING', 'ACTIVE', 'PAUSED', 'ENDED');

-- AlterTable
ALTER TABLE "quiz_attempt" ADD COLUMN "cbtSessionId" TEXT,
ADD COLUMN "currentQuestion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "cbt_session" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "CbtSessionStatus" NOT NULL DEFAULT 'WAITING',
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cbt_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cbt_session_token_key" ON "cbt_session"("token");

-- CreateIndex
CREATE INDEX "cbt_session_quizId_status_idx" ON "cbt_session"("quizId", "status");

-- CreateIndex
CREATE INDEX "cbt_session_teachingContextId_status_idx" ON "cbt_session"("teachingContextId", "status");

-- CreateIndex
CREATE INDEX "cbt_session_token_status_idx" ON "cbt_session"("token", "status");

-- AddForeignKey
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_cbtSessionId_fkey" FOREIGN KEY ("cbtSessionId") REFERENCES "cbt_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_session" ADD CONSTRAINT "cbt_session_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_session" ADD CONSTRAINT "cbt_session_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cbt_session" ADD CONSTRAINT "cbt_session_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
