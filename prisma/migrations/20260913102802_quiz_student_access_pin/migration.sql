-- CreateTable
CREATE TABLE "quiz_student_access" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "pin" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_student_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quiz_student_access_studentId_idx" ON "quiz_student_access"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_student_access_quizId_studentId_key" ON "quiz_student_access"("quizId", "studentId");

-- AddForeignKey
ALTER TABLE "quiz_student_access" ADD CONSTRAINT "quiz_student_access_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_student_access" ADD CONSTRAINT "quiz_student_access_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
