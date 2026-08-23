-- CreateEnum
CREATE TYPE "AcademicPlanType" AS ENUM ('PROTA', 'PROSEM');

-- CreateTable
CREATE TABLE "academic_context_profile" (
    "id" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "curriculumName" TEXT,
    "phase" TEXT,
    "academicNote" TEXT,
    "cpText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_context_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_objective" (
    "id" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_plan_item" (
    "id" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "planType" "AcademicPlanType" NOT NULL,
    "title" TEXT NOT NULL,
    "targetMonth" INTEGER,
    "allocatedHours" INTEGER,
    "notes" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_plan_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teaching_session_learning_objective" (
    "id" TEXT NOT NULL,
    "teachingSessionId" TEXT NOT NULL,
    "learningObjectiveId" TEXT NOT NULL,
    "snapshotCode" TEXT,
    "snapshotDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teaching_session_learning_objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_learning_objective" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "learningObjectiveId" TEXT NOT NULL,
    "snapshotCode" TEXT,
    "snapshotDescription" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_learning_objective_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "academic_context_profile_teachingContextId_key" ON "academic_context_profile"("teachingContextId");

-- CreateIndex
CREATE INDEX "learning_objective_teachingContextId_status_idx" ON "learning_objective"("teachingContextId", "status");

-- CreateIndex
CREATE INDEX "learning_objective_teachingContextId_orderIndex_idx" ON "learning_objective"("teachingContextId", "orderIndex");

-- CreateIndex
CREATE INDEX "academic_plan_item_teachingContextId_planType_status_idx" ON "academic_plan_item"("teachingContextId", "planType", "status");

-- CreateIndex
CREATE INDEX "academic_plan_item_teachingContextId_orderIndex_idx" ON "academic_plan_item"("teachingContextId", "orderIndex");

-- CreateIndex
CREATE INDEX "teaching_session_learning_objective_teachingSessionId_idx" ON "teaching_session_learning_objective"("teachingSessionId");

-- CreateIndex
CREATE INDEX "teaching_session_learning_objective_learningObjectiveId_idx" ON "teaching_session_learning_objective"("learningObjectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "teaching_session_learning_objective_teachingSessionId_learn_key" ON "teaching_session_learning_objective"("teachingSessionId", "learningObjectiveId");

-- CreateIndex
CREATE INDEX "assessment_learning_objective_assessmentId_idx" ON "assessment_learning_objective"("assessmentId");

-- CreateIndex
CREATE INDEX "assessment_learning_objective_learningObjectiveId_idx" ON "assessment_learning_objective"("learningObjectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_learning_objective_assessmentId_learningObjectiv_key" ON "assessment_learning_objective"("assessmentId", "learningObjectiveId");

-- AddForeignKey
ALTER TABLE "academic_context_profile" ADD CONSTRAINT "academic_context_profile_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_objective" ADD CONSTRAINT "learning_objective_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_plan_item" ADD CONSTRAINT "academic_plan_item_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_session_learning_objective" ADD CONSTRAINT "teaching_session_learning_objective_teachingSessionId_fkey" FOREIGN KEY ("teachingSessionId") REFERENCES "teaching_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_session_learning_objective" ADD CONSTRAINT "teaching_session_learning_objective_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "learning_objective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_learning_objective" ADD CONSTRAINT "assessment_learning_objective_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_learning_objective" ADD CONSTRAINT "assessment_learning_objective_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "learning_objective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
