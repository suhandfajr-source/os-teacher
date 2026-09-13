-- DropForeignKey
ALTER TABLE "quiz_answer" DROP CONSTRAINT "quiz_answer_questionId_fkey";

-- AlterTable
ALTER TABLE "quiz_answer" ALTER COLUMN "questionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "quiz_answer" ADD CONSTRAINT "quiz_answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "quiz_question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
