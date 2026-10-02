-- CreateTable
CREATE TABLE "submission_file" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "submission_file_storageKey_key" ON "submission_file"("storageKey");

-- CreateIndex
CREATE INDEX "submission_file_submissionId_idx" ON "submission_file"("submissionId");

-- AddForeignKey
ALTER TABLE "submission_file" ADD CONSTRAINT "submission_file_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "assignment_submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
