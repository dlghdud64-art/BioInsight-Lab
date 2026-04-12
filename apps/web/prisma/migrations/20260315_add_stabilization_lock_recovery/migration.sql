-- P2-1/P2-4C: StabilizationLock + StabilizationRecoveryRecord + canonicalSlot
-- additive-only — no existing table modifications except adding nullable column

-- 1. canonicalSlot column on StabilizationBaseline
ALTER TABLE "StabilizationBaseline" ADD COLUMN "canonicalSlot" TEXT;
CREATE UNIQUE INDEX "StabilizationBaseline_canonicalSlot_key" ON "StabilizationBaseline"("canonicalSlot");

-- 2. StabilizationLockTarget enum
DO $$ BEGIN
  CREATE TYPE "StabilizationLockTarget" AS ENUM ('CANONICAL_BASELINE', 'AUTHORITY_LINE', 'INCIDENT_STREAM', 'SNAPSHOT_RESTORE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. StabilizationLock table
CREATE TABLE "StabilizationLock" (
    "id" TEXT NOT NULL,
    "lockKey" TEXT NOT NULL,
    "lockOwner" TEXT NOT NULL,
    "lockToken" TEXT NOT NULL,
    "targetType" "StabilizationLockTarget" NOT NULL,
    "reason" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StabilizationLock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StabilizationLock_lockKey_key" ON "StabilizationLock"("lockKey");
CREATE INDEX "StabilizationLock_targetType_idx" ON "StabilizationLock"("targetType");
CREATE INDEX "StabilizationLock_expiresAt_idx" ON "StabilizationLock"("expiresAt");

-- 4. StabilizationRecoveryRecord table
CREATE TABLE "StabilizationRecoveryRecord" (
    "id" TEXT NOT NULL,
    "recoveryId" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "incidentId" TEXT,
    "baselineId" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "releaseMode" TEXT NOT NULL,
    "recoveryState" TEXT NOT NULL,
    "recoveryStage" TEXT,
    "lockKey" TEXT,
    "lockToken" TEXT,
    "operatorId" TEXT NOT NULL,
    "overrideUsed" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "signOffMetadata" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "failureReasonCode" TEXT,
    "stageResults" JSONB,
    "preconditionResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StabilizationRecoveryRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StabilizationRecoveryRecord_recoveryId_key" ON "StabilizationRecoveryRecord"("recoveryId");
CREATE INDEX "StabilizationRecoveryRecord_correlationId_idx" ON "StabilizationRecoveryRecord"("correlationId");
CREATE INDEX "StabilizationRecoveryRecord_recoveryState_idx" ON "StabilizationRecoveryRecord"("recoveryState");
