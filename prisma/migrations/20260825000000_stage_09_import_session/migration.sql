-- CreateEnum
CREATE TYPE "ImportCategory" AS ENUM ('ROSTER', 'HISTORICAL_SESSION', 'HISTORICAL_ATTENDANCE', 'HISTORICAL_ASSESSMENT');

-- CreateTable
CREATE TABLE "import_session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "teachingContextId" TEXT,
    "category" "ImportCategory" NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_session_tokenHash_key" ON "import_session"("tokenHash");

-- CreateIndex
CREATE INDEX "import_session_tokenHash_idx" ON "import_session"("tokenHash");

-- CreateIndex
CREATE INDEX "import_session_teacherProfileId_schoolId_idx" ON "import_session"("teacherProfileId", "schoolId");

-- CreateIndex
CREATE INDEX "import_session_teachingContextId_category_idx" ON "import_session"("teachingContextId", "category");

-- AddForeignKey
ALTER TABLE "import_session" ADD CONSTRAINT "import_session_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_session" ADD CONSTRAINT "import_session_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_session" ADD CONSTRAINT "import_session_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
