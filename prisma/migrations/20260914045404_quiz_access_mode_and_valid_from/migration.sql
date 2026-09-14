-- CreateEnum
CREATE TYPE "QuizAccessMode" AS ENUM ('CLASSROOM_PIN', 'INDIVIDUAL_PIN');

-- AlterTable
ALTER TABLE "quiz" ADD COLUMN     "accessMode" "QuizAccessMode" NOT NULL DEFAULT 'CLASSROOM_PIN',
ADD COLUMN     "classroomPin" TEXT,
ADD COLUMN     "validFrom" TIMESTAMP(3);
