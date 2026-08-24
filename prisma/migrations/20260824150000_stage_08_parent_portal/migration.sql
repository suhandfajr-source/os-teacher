-- CreateEnum
CREATE TYPE "ParentAccessStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ParentInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

-- CreateTable
CREATE TABLE "parent_profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parent_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_student_relation" (
    "id" TEXT NOT NULL,
    "parentProfileId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "relationshipLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parent_student_relation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_invitation" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "relationshipLabel" TEXT,
    "studentId" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "status" "ParentInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByParentProfileId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parent_invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parent_teaching_access" (
    "id" TEXT NOT NULL,
    "parentStudentRelationId" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "grantedByTeacherProfileId" TEXT NOT NULL,
    "status" "ParentAccessStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parent_teaching_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "parent_profile_userId_key" ON "parent_profile"("userId");

-- CreateIndex
CREATE INDEX "parent_student_relation_studentId_idx" ON "parent_student_relation"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "parent_student_relation_parentProfileId_studentId_key" ON "parent_student_relation"("parentProfileId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "parent_invitation_tokenHash_key" ON "parent_invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "parent_invitation_tokenHash_idx" ON "parent_invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "parent_invitation_recipientEmail_idx" ON "parent_invitation"("recipientEmail");

-- CreateIndex
CREATE INDEX "parent_invitation_teachingContextId_status_idx" ON "parent_invitation"("teachingContextId", "status");

-- CreateIndex
CREATE INDEX "parent_invitation_studentId_idx" ON "parent_invitation"("studentId");

-- CreateIndex
CREATE INDEX "parent_teaching_access_teachingContextId_status_idx" ON "parent_teaching_access"("teachingContextId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "parent_teaching_access_parentStudentRelationId_teachingConte_key" ON "parent_teaching_access"("parentStudentRelationId", "teachingContextId");

-- AddForeignKey
ALTER TABLE "parent_profile" ADD CONSTRAINT "parent_profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_student_relation" ADD CONSTRAINT "parent_student_relation_parentProfileId_fkey" FOREIGN KEY ("parentProfileId") REFERENCES "parent_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_student_relation" ADD CONSTRAINT "parent_student_relation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_invitation" ADD CONSTRAINT "parent_invitation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_invitation" ADD CONSTRAINT "parent_invitation_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_invitation" ADD CONSTRAINT "parent_invitation_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_invitation" ADD CONSTRAINT "parent_invitation_acceptedByParentProfileId_fkey" FOREIGN KEY ("acceptedByParentProfileId") REFERENCES "parent_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_teaching_access" ADD CONSTRAINT "parent_teaching_access_parentStudentRelationId_fkey" FOREIGN KEY ("parentStudentRelationId") REFERENCES "parent_student_relation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_teaching_access" ADD CONSTRAINT "parent_teaching_access_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parent_teaching_access" ADD CONSTRAINT "parent_teaching_access_grantedByTeacherProfileId_fkey" FOREIGN KEY ("grantedByTeacherProfileId") REFERENCES "teacher_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
