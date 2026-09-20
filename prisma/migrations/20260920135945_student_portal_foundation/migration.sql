-- Story 1a — Fondasi Skema & Migrasi (DEV STAGE 11)
-- Murni aditif (N1): ADD COLUMN / CREATE TABLE / CREATE INDEX — nol drop/rename.
-- Di-generate via `prisma migrate diff --from-config-datasource --to-schema` terhadap DB lokal,
-- lalu diekstrak subset scope 1a (perubahan schedule/prosem di luar scope = utang drift existing).

-- AlterTable
ALTER TABLE "class" ADD COLUMN     "joinCode" TEXT,
ADD COLUMN     "joinCodeLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joinCodeUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "student" ADD COLUMN     "accessPinHash" TEXT,
ADD COLUMN     "accountStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "failedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "pinUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "platformRole" TEXT NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_actorId_createdAt_idx" ON "audit_log"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_targetType_targetId_idx" ON "audit_log"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "class_joinCode_key" ON "class"("joinCode");
