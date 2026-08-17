-- ==========================================
-- BACKFILL PHASE (Data Migration from Stage 01 to Stage 02)
-- ==========================================

-- 1. Create Schools from distinct schoolNames
INSERT INTO "school" ("id", "name", "normalizedName", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    "schoolName",
    regexp_replace(lower("schoolName"), '[^a-z0-9]', '', 'g'),
    now(),
    now()
FROM (
    SELECT DISTINCT "schoolName" FROM "teacher_profile" WHERE "schoolName" IS NOT NULL
) AS distinct_schools
ON CONFLICT DO NOTHING;

-- 2. Link TeacherProfile to School via activeSchoolId
UPDATE "teacher_profile" tp
SET "activeSchoolId" = s."id"
FROM "school" s
WHERE tp."schoolName" = s."name";

-- 3. Create TeacherSchoolMembership
INSERT INTO "teacher_school_membership" ("id", "teacherProfileId", "schoolId", "status", "workspaceRole", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    tp."id",
    tp."activeSchoolId",
    'ACTIVE',
    'OWNER',
    now(),
    now()
FROM "teacher_profile" tp
WHERE tp."activeSchoolId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Update AcademicPeriod
UPDATE "academic_period" ap
SET "schoolId" = tp."activeSchoolId"
FROM "teacher_profile" tp
WHERE ap."teacherProfileId" = tp."id";

-- 5. Update Subject
UPDATE "subject" sub
SET "schoolId" = tp."activeSchoolId"
FROM "teacher_profile" tp
WHERE sub."teacherProfileId" = tp."id";

-- 6. Update Class
UPDATE "class" cls
SET "schoolId" = tp."activeSchoolId"
FROM "teacher_profile" tp
WHERE cls."teacherProfileId" = tp."id";

-- 7. Update TeachingContext
UPDATE "teaching_context" tc
SET "schoolId" = tp."activeSchoolId"
FROM "teacher_profile" tp
WHERE tc."teacherProfileId" = tp."id";

-- Handle orphans to prevent NOT NULL constraint failures on cleanups
DELETE FROM "academic_period" WHERE "schoolId" IS NULL;
DELETE FROM "subject" WHERE "schoolId" IS NULL;
DELETE FROM "class" WHERE "schoolId" IS NULL;
DELETE FROM "teaching_context" WHERE "schoolId" IS NULL;

-- ==========================================
-- CONTRACT PHASE (Schema constraints and cleanup)
-- ==========================================

-- DropForeignKey
ALTER TABLE "academic_period" DROP CONSTRAINT "academic_period_teacherProfileId_fkey";

-- DropForeignKey
ALTER TABLE "class" DROP CONSTRAINT "class_teacherProfileId_fkey";

-- DropForeignKey
ALTER TABLE "subject" DROP CONSTRAINT "subject_teacherProfileId_fkey";

-- AlterTable
ALTER TABLE "academic_period" DROP COLUMN "teacherProfileId",
ALTER COLUMN "schoolId" SET NOT NULL;

-- AlterTable
ALTER TABLE "class" DROP COLUMN "teacherProfileId",
ALTER COLUMN "schoolId" SET NOT NULL;

-- AlterTable
ALTER TABLE "subject" DROP COLUMN "teacherProfileId",
ALTER COLUMN "schoolId" SET NOT NULL;

-- AlterTable
ALTER TABLE "teacher_profile" DROP COLUMN "schoolName";

-- AlterTable
ALTER TABLE "teaching_context" ALTER COLUMN "schoolId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "academic_period_schoolId_year_semester_key" ON "academic_period"("schoolId", "year", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "class_schoolId_normalizedName_key" ON "class"("schoolId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "subject_schoolId_normalizedName_key" ON "subject"("schoolId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "teaching_context_teacherProfileId_schoolId_academicPeriodId_key" ON "teaching_context"("teacherProfileId", "schoolId", "academicPeriodId", "subjectId", "classId");
