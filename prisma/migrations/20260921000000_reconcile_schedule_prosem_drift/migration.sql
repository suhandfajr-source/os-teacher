-- CreateEnum
CREATE TYPE "PlanItemCategory" AS ENUM ('REGULAR_MATERIAL', 'STS', 'SAS', 'RESERVE');

-- DropIndex
DROP INDEX "academic_plan_item_teachingContextId_orderIndex_idx";

-- AlterTable
ALTER TABLE "academic_context_profile" ADD COLUMN     "effectiveWeeksSem1" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "effectiveWeeksSem2" INTEGER NOT NULL DEFAULT 16,
ADD COLUMN     "hoursPerWeek" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "academic_plan_item" ADD COLUMN     "category" "PlanItemCategory" NOT NULL DEFAULT 'REGULAR_MATERIAL',
ADD COLUMN     "learningObjectiveId" TEXT,
ADD COLUMN     "targetSemester" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "weeklyDistribution" JSONB;

-- AlterTable
ALTER TABLE "learning_objective" ADD COLUMN     "allocatedHours" INTEGER DEFAULT 6,
ADD COLUMN     "targetSemester" INTEGER DEFAULT 1;

-- AlterTable
ALTER TABLE "teaching_session" ADD COLUMN     "teachingScheduleId" TEXT;

-- CreateTable
CREATE TABLE "teaching_schedule" (
    "id" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "room" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teaching_schedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teaching_schedule_teachingContextId_dayOfWeek_idx" ON "teaching_schedule"("teachingContextId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "teaching_schedule_dayOfWeek_startTime_idx" ON "teaching_schedule"("dayOfWeek", "startTime");

-- CreateIndex
CREATE INDEX "academic_plan_item_teachingContextId_targetSemester_orderIn_idx" ON "academic_plan_item"("teachingContextId", "targetSemester", "orderIndex");

-- CreateIndex
CREATE INDEX "academic_plan_item_learningObjectiveId_idx" ON "academic_plan_item"("learningObjectiveId");

-- CreateIndex
CREATE INDEX "teaching_session_teachingScheduleId_idx" ON "teaching_session"("teachingScheduleId");

-- AddForeignKey
ALTER TABLE "teaching_session" ADD CONSTRAINT "teaching_session_teachingScheduleId_fkey" FOREIGN KEY ("teachingScheduleId") REFERENCES "teaching_schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_schedule" ADD CONSTRAINT "teaching_schedule_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_plan_item" ADD CONSTRAINT "academic_plan_item_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "learning_objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

