-- AlterEnum
ALTER TYPE "QuizAttemptStatus" ADD VALUE 'NEEDS_GRADING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QuizQuestionType" ADD VALUE 'SHORT_ANSWER';
ALTER TYPE "QuizQuestionType" ADD VALUE 'ESSAY';

-- AlterTable
ALTER TABLE "quiz_answer" ADD COLUMN     "essayAnswer" TEXT,
ADD COLUMN     "feedback" TEXT,
ADD COLUMN     "score" DECIMAL(5,2);
