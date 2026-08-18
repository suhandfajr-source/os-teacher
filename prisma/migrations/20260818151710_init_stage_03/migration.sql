-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'SICK', 'PERMISSION', 'ABSENT', 'LATE');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "teaching_session" (
    "id" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "attendanceRecordedAt" TIMESTAMP(3),
    "plannedTopic" TEXT,
    "actualTopic" TEXT,
    "activitySummary" TEXT,
    "reflection" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teaching_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_record" (
    "id" TEXT NOT NULL,
    "teachingSessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment" (
    "id" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "teachingSessionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teaching_session_teachingContextId_idx" ON "teaching_session"("teachingContextId");

-- CreateIndex
CREATE INDEX "teaching_session_date_idx" ON "teaching_session"("date");

-- CreateIndex
CREATE INDEX "teaching_session_status_idx" ON "teaching_session"("status");

-- CreateIndex
CREATE INDEX "attendance_record_teachingSessionId_idx" ON "attendance_record"("teachingSessionId");

-- CreateIndex
CREATE INDEX "attendance_record_studentId_idx" ON "attendance_record"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_record_teachingSessionId_studentId_key" ON "attendance_record"("teachingSessionId", "studentId");

-- CreateIndex
CREATE INDEX "assignment_teachingContextId_idx" ON "assignment"("teachingContextId");

-- CreateIndex
CREATE INDEX "assignment_teachingSessionId_idx" ON "assignment"("teachingSessionId");

-- CreateIndex
CREATE INDEX "assignment_dueDate_idx" ON "assignment"("dueDate");

-- AddForeignKey
ALTER TABLE "teaching_session" ADD CONSTRAINT "teaching_session_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_teachingSessionId_fkey" FOREIGN KEY ("teachingSessionId") REFERENCES "teaching_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_record" ADD CONSTRAINT "attendance_record_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment" ADD CONSTRAINT "assignment_teachingSessionId_fkey" FOREIGN KEY ("teachingSessionId") REFERENCES "teaching_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
