-- CreateTable
CREATE TABLE "teacher_revocation_request" (
    "id" TEXT NOT NULL,
    "teacherSchoolMembershipId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "requesterProfileId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_revocation_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "teacher_revocation_request_schoolId_status_idx" ON "teacher_revocation_request"("schoolId", "status");

-- CreateIndex
CREATE INDEX "teacher_revocation_request_teacherSchoolMembershipId_idx" ON "teacher_revocation_request"("teacherSchoolMembershipId");

-- AddForeignKey
ALTER TABLE "teacher_revocation_request" ADD CONSTRAINT "teacher_revocation_request_teacherSchoolMembershipId_fkey" FOREIGN KEY ("teacherSchoolMembershipId") REFERENCES "teacher_school_membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_revocation_request" ADD CONSTRAINT "teacher_revocation_request_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_revocation_request" ADD CONSTRAINT "teacher_revocation_request_requesterProfileId_fkey" FOREIGN KEY ("requesterProfileId") REFERENCES "teacher_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_revocation_request" ADD CONSTRAINT "teacher_revocation_request_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
