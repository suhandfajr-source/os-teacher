-- CreateEnum
CREATE TYPE "AgentActionStatus" AS ENUM ('PENDING', 'EXECUTED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "agent_action_proposal" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "classId" TEXT,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "AgentActionStatus" NOT NULL DEFAULT 'PENDING',
    "executionResult" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_action_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_counter" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "usageDate" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_counter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "agent_action_proposal_conversationId_idx" ON "agent_action_proposal"("conversationId");

-- CreateIndex
CREATE INDEX "agent_action_proposal_schoolId_teacherProfileId_idx" ON "agent_action_proposal"("schoolId", "teacherProfileId");

-- CreateIndex
CREATE INDEX "agent_action_proposal_status_idx" ON "agent_action_proposal"("status");

-- CreateIndex
CREATE INDEX "ai_usage_counter_usageDate_idx" ON "ai_usage_counter"("usageDate");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_counter_teacherProfileId_usageDate_key" ON "ai_usage_counter"("teacherProfileId", "usageDate");

-- AddForeignKey
ALTER TABLE "agent_action_proposal" ADD CONSTRAINT "agent_action_proposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "agent_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_action_proposal" ADD CONSTRAINT "agent_action_proposal_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_action_proposal" ADD CONSTRAINT "agent_action_proposal_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_action_proposal" ADD CONSTRAINT "agent_action_proposal_classId_fkey" FOREIGN KEY ("classId") REFERENCES "class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
