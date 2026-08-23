-- CreateEnum
CREATE TYPE "AiContentType" AS ENUM ('LESSON_PLAN', 'LEARNING_MATERIAL', 'TASK_INSTRUCTION', 'RUBRIC');

-- CreateEnum
CREATE TYPE "AiDraftStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ai_content_draft" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "teachingContextId" TEXT,
    "contentType" "AiContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "instruction" TEXT,
    "content" TEXT NOT NULL,
    "status" "AiDraftStatus" NOT NULL DEFAULT 'ACTIVE',
    "modelUsed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_content_draft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_content_draft_teacherProfileId_schoolId_status_idx" ON "ai_content_draft"("teacherProfileId", "schoolId", "status");

-- CreateIndex
CREATE INDEX "ai_content_draft_teachingContextId_idx" ON "ai_content_draft"("teachingContextId");

-- CreateIndex
CREATE INDEX "ai_content_draft_contentType_idx" ON "ai_content_draft"("contentType");

-- AddForeignKey
ALTER TABLE "ai_content_draft" ADD CONSTRAINT "ai_content_draft_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_content_draft" ADD CONSTRAINT "ai_content_draft_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_content_draft" ADD CONSTRAINT "ai_content_draft_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
