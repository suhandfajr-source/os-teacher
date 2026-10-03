-- CreateTable
CREATE TABLE "assignment_attachment" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assignment_attachment_storageKey_key" ON "assignment_attachment"("storageKey");

-- CreateIndex
CREATE INDEX "assignment_attachment_assignmentId_idx" ON "assignment_attachment"("assignmentId");

-- AddForeignKey
ALTER TABLE "assignment_attachment" ADD CONSTRAINT "assignment_attachment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
