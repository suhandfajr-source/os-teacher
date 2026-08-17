-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "EntityStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- DropIndex
DROP INDEX "teaching_context_teacherProfileId_academicPeriodId_subjectI_key";

-- AlterTable
ALTER TABLE "academic_period" ADD COLUMN     "entityStatus" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "schoolId" TEXT;

-- AlterTable
ALTER TABLE "class" ADD COLUMN     "normalizedName" TEXT,
ADD COLUMN     "schoolId" TEXT,
ADD COLUMN     "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "subject" ADD COLUMN     "normalizedName" TEXT,
ADD COLUMN     "schoolId" TEXT,
ADD COLUMN     "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "teacher_profile" ADD COLUMN     "activeSchoolId" TEXT;

-- AlterTable
ALTER TABLE "teaching_context" ADD COLUMN     "schoolId" TEXT;

-- CreateTable
CREATE TABLE "school" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "city" TEXT,
    "province" TEXT,
    "npsn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_school_membership" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "workspaceRole" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_school_membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "nis" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByTeacherProfileId" TEXT,
    "updatedByTeacherProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "class_student" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicPeriodId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_student_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_npsn_key" ON "school"("npsn");

-- CreateIndex
CREATE INDEX "school_normalizedName_idx" ON "school"("normalizedName");

-- CreateIndex
CREATE INDEX "school_npsn_idx" ON "school"("npsn");

-- CreateIndex
CREATE INDEX "teacher_school_membership_status_idx" ON "teacher_school_membership"("status");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_school_membership_teacherProfileId_schoolId_key" ON "teacher_school_membership"("teacherProfileId", "schoolId");

-- CreateIndex
CREATE INDEX "student_fullName_idx" ON "student"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "student_schoolId_nis_key" ON "student"("schoolId", "nis");

-- CreateIndex
CREATE INDEX "class_student_classId_academicPeriodId_idx" ON "class_student"("classId", "academicPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "class_student_studentId_academicPeriodId_key" ON "class_student"("studentId", "academicPeriodId");

-- AddForeignKey
ALTER TABLE "teacher_school_membership" ADD CONSTRAINT "teacher_school_membership_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_school_membership" ADD CONSTRAINT "teacher_school_membership_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student" ADD CONSTRAINT "student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_student" ADD CONSTRAINT "class_student_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_student" ADD CONSTRAINT "class_student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "class"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class_student" ADD CONSTRAINT "class_student_academicPeriodId_fkey" FOREIGN KEY ("academicPeriodId") REFERENCES "academic_period"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "academic_period" ADD CONSTRAINT "academic_period_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject" ADD CONSTRAINT "subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "class" ADD CONSTRAINT "class_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teaching_context" ADD CONSTRAINT "teaching_context_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;
