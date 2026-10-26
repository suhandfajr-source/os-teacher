-- CreateEnum
CREATE TYPE "BugReportCategory" AS ENUM ('UI_UX', 'FEATURE_ERROR', 'AI_AGENT', 'AUTHENTICATION', 'PERFORMANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "BugReportStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BugReportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "bug_report" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "userId" TEXT,
    "reporterEmail" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "BugReportCategory" NOT NULL DEFAULT 'FEATURE_ERROR',
    "status" "BugReportStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "BugReportPriority" NOT NULL DEFAULT 'MEDIUM',
    "pageUrl" TEXT,
    "deviceInfo" TEXT,
    "attachmentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adminNotes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bug_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bug_report_ticketNumber_key" ON "bug_report"("ticketNumber");

-- CreateIndex
CREATE INDEX "bug_report_status_idx" ON "bug_report"("status");

-- CreateIndex
CREATE INDEX "bug_report_category_idx" ON "bug_report"("category");

-- CreateIndex
CREATE INDEX "bug_report_createdAt_idx" ON "bug_report"("createdAt");

-- AddForeignKey
ALTER TABLE "bug_report" ADD CONSTRAINT "bug_report_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
