-- AlterEnum
ALTER TYPE "DocumentTemplateFormat" ADD VALUE 'XLSX';

-- RenameIndex
ALTER INDEX "parent_teaching_access_parentStudentRelationId_teachingConte_ke" RENAME TO "parent_teaching_access_parentStudentRelationId_teachingCont_key";
