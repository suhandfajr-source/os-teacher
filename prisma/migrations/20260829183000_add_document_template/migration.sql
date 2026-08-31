-- CreateEnum
CREATE TYPE "DocumentTemplateFormat" AS ENUM ('DOCX');

-- CreateTable
CREATE TABLE "document_template" (
    "id" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" "AiContentType" NOT NULL,
    "format" "DocumentTemplateFormat" NOT NULL DEFAULT 'DOCX',
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileBytes" BYTEA NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "placeholderManifest" JSONB NOT NULL,
    "status" "EntityStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "document_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_template_teacherProfileId_schoolId_status_idx" ON "document_template"("teacherProfileId", "schoolId", "status");

-- CreateIndex
CREATE INDEX "document_template_contentType_format_status_idx" ON "document_template"("contentType", "format", "status");

-- AddForeignKey
ALTER TABLE "document_template" ADD CONSTRAINT "document_template_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_template" ADD CONSTRAINT "document_template_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
