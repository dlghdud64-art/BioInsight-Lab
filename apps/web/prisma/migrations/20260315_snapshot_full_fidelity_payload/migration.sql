-- AlterTable: Add full-fidelity payload columns to StabilizationSnapshot
ALTER TABLE "StabilizationSnapshot" ADD COLUMN "scopePayload" JSONB;
ALTER TABLE "StabilizationSnapshot" ADD COLUMN "configPayload" JSONB;
ALTER TABLE "StabilizationSnapshot" ADD COLUMN "capturedBy" TEXT;
ALTER TABLE "StabilizationSnapshot" ADD COLUMN "snapshotId" TEXT;

-- CreateIndex: unique index on snapshotId for repo-first lookup
CREATE UNIQUE INDEX "StabilizationSnapshot_snapshotId_key" ON "StabilizationSnapshot"("snapshotId");
