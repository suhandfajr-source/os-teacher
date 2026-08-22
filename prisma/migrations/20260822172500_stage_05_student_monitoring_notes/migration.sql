-- CreateTable
CREATE TABLE "student_monitoring_note" (
    "id" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "requiresFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_monitoring_note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "student_monitoring_note_teachingContextId_isArchived_idx" ON "student_monitoring_note"("teachingContextId", "isArchived");

-- CreateIndex
CREATE INDEX "student_monitoring_note_teachingContextId_studentId_idx" ON "student_monitoring_note"("teachingContextId", "studentId");

-- CreateIndex
CREATE INDEX "student_monitoring_note_studentId_idx" ON "student_monitoring_note"("studentId");

-- CreateIndex
CREATE INDEX "student_monitoring_note_requiresFollowUp_resolvedAt_idx" ON "student_monitoring_note"("requiresFollowUp", "resolvedAt");

-- AddForeignKey
ALTER TABLE "student_monitoring_note" ADD CONSTRAINT "student_monitoring_note_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_monitoring_note" ADD CONSTRAINT "student_monitoring_note_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
