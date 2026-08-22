-- CreateEnum
CREATE TYPE "AssessmentCategory" AS ENUM ('ASSIGNMENT', 'FORMATIVE', 'SUMMATIVE', 'MIDTERM', 'FINAL_TERM', 'SCHOOL_EXAM', 'PRACTICE', 'PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "GradePolicyStatus" AS ENUM ('DRAFT', 'ACTIVE');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssessmentResultStatus" AS ENUM ('PENDING', 'GRADED', 'ABSENT', 'EXCUSED');

-- CreateTable
CREATE TABLE "assessment_type" (
    "id" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "category" "AssessmentCategory" NOT NULL DEFAULT 'OTHER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_policy" (
    "id" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "status" "GradePolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_policy_item" (
    "id" TEXT NOT NULL,
    "gradePolicyId" TEXT NOT NULL,
    "assessmentTypeId" TEXT NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_policy_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment" (
    "id" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "assessmentTypeId" TEXT NOT NULL,
    "teachingSessionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assessmentDate" DATE NOT NULL,
    "maxScore" DECIMAL(10,2) NOT NULL,
    "minimumPassingScore" DECIMAL(5,2),
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "participantsInitializedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_result" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AssessmentResultStatus" NOT NULL DEFAULT 'PENDING',
    "rawScore" DECIMAL(10,2),
    "normalizedScore" DECIMAL(5,2),
    "finalScore" DECIMAL(5,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remedial_attempt" (
    "id" TEXT NOT NULL,
    "assessmentResultId" TEXT NOT NULL,
    "score" DECIMAL(5,2) NOT NULL,
    "note" TEXT,
    "attemptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remedial_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assessment_type_teachingContextId_isActive_idx" ON "assessment_type"("teachingContextId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_type_teachingContextId_normalizedName_key" ON "assessment_type"("teachingContextId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "grade_policy_teachingContextId_key" ON "grade_policy"("teachingContextId");

-- CreateIndex
CREATE INDEX "grade_policy_teachingContextId_status_idx" ON "grade_policy"("teachingContextId", "status");

-- CreateIndex
CREATE INDEX "grade_policy_item_gradePolicyId_idx" ON "grade_policy_item"("gradePolicyId");

-- CreateIndex
CREATE INDEX "grade_policy_item_assessmentTypeId_idx" ON "grade_policy_item"("assessmentTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "grade_policy_item_gradePolicyId_assessmentTypeId_key" ON "grade_policy_item"("gradePolicyId", "assessmentTypeId");

-- CreateIndex
CREATE INDEX "assessment_teachingContextId_status_idx" ON "assessment"("teachingContextId", "status");

-- CreateIndex
CREATE INDEX "assessment_teachingContextId_assessmentDate_idx" ON "assessment"("teachingContextId", "assessmentDate");

-- CreateIndex
CREATE INDEX "assessment_assessmentTypeId_idx" ON "assessment"("assessmentTypeId");

-- CreateIndex
CREATE INDEX "assessment_teachingSessionId_idx" ON "assessment"("teachingSessionId");

-- CreateIndex
CREATE INDEX "assessment_result_assessmentId_status_idx" ON "assessment_result"("assessmentId", "status");

-- CreateIndex
CREATE INDEX "assessment_result_studentId_idx" ON "assessment_result"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_result_assessmentId_studentId_key" ON "assessment_result"("assessmentId", "studentId");

-- CreateIndex
CREATE INDEX "remedial_attempt_assessmentResultId_idx" ON "remedial_attempt"("assessmentResultId");

-- CreateIndex
CREATE INDEX "remedial_attempt_attemptDate_idx" ON "remedial_attempt"("attemptDate");

-- AddForeignKey
ALTER TABLE "assessment_type" ADD CONSTRAINT "assessment_type_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_policy" ADD CONSTRAINT "grade_policy_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_policy_item" ADD CONSTRAINT "grade_policy_item_gradePolicyId_fkey" FOREIGN KEY ("gradePolicyId") REFERENCES "grade_policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_policy_item" ADD CONSTRAINT "grade_policy_item_assessmentTypeId_fkey" FOREIGN KEY ("assessmentTypeId") REFERENCES "assessment_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_assessmentTypeId_fkey" FOREIGN KEY ("assessmentTypeId") REFERENCES "assessment_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment" ADD CONSTRAINT "assessment_teachingSessionId_fkey" FOREIGN KEY ("teachingSessionId") REFERENCES "teaching_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_result" ADD CONSTRAINT "assessment_result_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_result" ADD CONSTRAINT "assessment_result_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remedial_attempt" ADD CONSTRAINT "remedial_attempt_assessmentResultId_fkey" FOREIGN KEY ("assessmentResultId") REFERENCES "assessment_result"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
