-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "QuizQuestionType" AS ENUM ('MULTIPLE_CHOICE');

-- CreateEnum
CREATE TYPE "QuizAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateTable
CREATE TABLE "quiz" (
    "id" TEXT NOT NULL,
    "teachingContextId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',
    "shareToken" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "shuffleQuestions" BOOLEAN NOT NULL DEFAULT true,
    "shuffleOptions" BOOLEAN NOT NULL DEFAULT true,
    "standardScore" DECIMAL(5,2),
    "deadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_question" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "QuizQuestionType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
    "text" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER,
    "points" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_attempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "QuizAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "score" DECIMAL(5,2),
    "isRemedial" BOOLEAN NOT NULL DEFAULT false,
    "questionOrder" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_answer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedIndex" INTEGER,
    "isCorrect" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quiz_shareToken_key" ON "quiz"("shareToken");

-- CreateIndex
CREATE INDEX "quiz_teachingContextId_status_idx" ON "quiz"("teachingContextId", "status");

-- CreateIndex
CREATE INDEX "quiz_status_deadline_idx" ON "quiz"("status", "deadline");

-- CreateIndex
CREATE INDEX "quiz_question_quizId_order_idx" ON "quiz_question"("quizId", "order");

-- CreateIndex
CREATE INDEX "quiz_attempt_quizId_status_idx" ON "quiz_attempt"("quizId", "status");

-- CreateIndex
CREATE INDEX "quiz_attempt_studentId_idx" ON "quiz_attempt"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_attempt_quizId_studentId_key" ON "quiz_attempt"("quizId", "studentId");

-- CreateIndex
CREATE INDEX "quiz_answer_attemptId_idx" ON "quiz_answer"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_answer_attemptId_questionId_key" ON "quiz_answer"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "quiz" ADD CONSTRAINT "quiz_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_question" ADD CONSTRAINT "quiz_question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answer" ADD CONSTRAINT "quiz_answer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "quiz_attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_answer" ADD CONSTRAINT "quiz_answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "quiz_question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
