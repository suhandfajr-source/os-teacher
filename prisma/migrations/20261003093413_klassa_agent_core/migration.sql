-- CreateTable
CREATE TABLE "agent_conversation" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "classContextId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Percakapan Baru',
    "modelUsed" TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "toolResults" JSONB,
    "pendingAction" JSONB,
    "actionStatus" TEXT NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_agent_memory" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "communicationTone" TEXT NOT NULL DEFAULT 'RAMAH_SOPAN',
    "preferredModel" TEXT NOT NULL DEFAULT 'gemini-1.5-flash',
    "pedagogyDefaults" JSONB,
    "customContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_agent_memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_insight_aggregate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "period" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "sampleCount" INTEGER NOT NULL DEFAULT 1,
    "tags" TEXT[],
    "metadata" JSONB,
    "anonymizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_insight_aggregate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_conversation_teacherProfileId_idx" ON "agent_conversation"("teacherProfileId");

-- CreateIndex
CREATE INDEX "agent_conversation_classContextId_idx" ON "agent_conversation"("classContextId");

-- CreateIndex
CREATE INDEX "agent_message_conversationId_idx" ON "agent_message"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_agent_memory_teacherProfileId_key" ON "teacher_agent_memory"("teacherProfileId");

-- CreateIndex
CREATE INDEX "agent_insight_aggregate_schoolId_idx" ON "agent_insight_aggregate"("schoolId");

-- CreateIndex
CREATE INDEX "agent_insight_aggregate_category_period_idx" ON "agent_insight_aggregate"("category", "period");

-- AddForeignKey
ALTER TABLE "agent_conversation" ADD CONSTRAINT "agent_conversation_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_message" ADD CONSTRAINT "agent_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "agent_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_agent_memory" ADD CONSTRAINT "teacher_agent_memory_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
