-- CreateEnum (idempotent)
DO $$ BEGIN
  CREATE TYPE "IngestionSourceType" AS ENUM ('EMAIL', 'ATTACHMENT', 'UPLOAD', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentType" AS ENUM ('VENDOR_QUOTE', 'VENDOR_REPLY', 'INVOICE', 'TRANSACTION_STATEMENT', 'PURCHASE_ORDER_DOCUMENT', 'DELIVERY_UPDATE', 'RECEIVING_DOCUMENT', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VerificationStatus" AS ENUM ('AUTO_VERIFIED', 'REVIEW_NEEDED', 'MISMATCH', 'MISSING');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IngestionTaskType" AS ENUM ('PURCHASE_EVIDENCE_REVIEW', 'INVOICE_MISSING', 'DOCUMENT_MISMATCH', 'VENDOR_REPLY_REVIEW', 'DELIVERY_UPDATE_REVIEW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "IngestionAuditAction" AS ENUM ('INGESTION_RECEIVED', 'DOCUMENT_CLASSIFIED', 'EXTRACTION_COMPLETED', 'ENTITY_LINKED', 'VERIFICATION_AUTO_VERIFIED', 'VERIFICATION_REVIEW_REQUESTED', 'VERIFICATION_MISMATCH_DETECTED', 'VERIFICATION_MISSING_DETECTED', 'WORK_QUEUE_TASK_CREATED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: IngestionEntry
CREATE TABLE IF NOT EXISTS "IngestionEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" "IngestionSourceType" NOT NULL,
    "sourceRef" TEXT,
    "filename" TEXT,
    "mimeType" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaderId" TEXT,
    "documentType" "DocumentType" NOT NULL DEFAULT 'UNKNOWN',
    "classificationConfidence" DOUBLE PRECISION,
    "classifiedAt" TIMESTAMP(3),
    "rawTextRef" TEXT,
    "extractionResult" JSONB,
    "extractedAt" TIMESTAMP(3),
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "linkingConfidence" DOUBLE PRECISION,
    "linkedAt" TIMESTAMP(3),
    "verificationStatus" "VerificationStatus",
    "verificationReason" TEXT,
    "mismatchedFields" JSONB,
    "missingFields" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "workQueueTaskId" TEXT,
    "workQueueTaskType" "IngestionTaskType",
    "policyFlags" JSONB,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: IngestionAuditLog
CREATE TABLE IF NOT EXISTS "IngestionAuditLog" (
    "id" TEXT NOT NULL,
    "ingestionEntryId" TEXT NOT NULL,
    "action" "IngestionAuditAction" NOT NULL,
    "actorType" TEXT NOT NULL DEFAULT 'SYSTEM',
    "actorId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "confidence" DOUBLE PRECISION,
    "durationMs" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "IngestionEntry_organizationId_documentType_idx" ON "IngestionEntry"("organizationId", "documentType");
CREATE INDEX IF NOT EXISTS "IngestionEntry_organizationId_verificationStatus_idx" ON "IngestionEntry"("organizationId", "verificationStatus");
CREATE INDEX IF NOT EXISTS "IngestionEntry_linkedEntityType_linkedEntityId_idx" ON "IngestionEntry"("linkedEntityType", "linkedEntityId");
CREATE INDEX IF NOT EXISTS "IngestionEntry_sourceRef_idx" ON "IngestionEntry"("sourceRef");
CREATE INDEX IF NOT EXISTS "IngestionEntry_receivedAt_idx" ON "IngestionEntry"("receivedAt");
CREATE INDEX IF NOT EXISTS "IngestionEntry_createdAt_idx" ON "IngestionEntry"("createdAt");

CREATE INDEX IF NOT EXISTS "IngestionAuditLog_ingestionEntryId_action_idx" ON "IngestionAuditLog"("ingestionEntryId", "action");
CREATE INDEX IF NOT EXISTS "IngestionAuditLog_createdAt_idx" ON "IngestionAuditLog"("createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "IngestionEntry" ADD CONSTRAINT "IngestionEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "IngestionEntry" ADD CONSTRAINT "IngestionEntry_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "IngestionAuditLog" ADD CONSTRAINT "IngestionAuditLog_ingestionEntryId_fkey" FOREIGN KEY ("ingestionEntryId") REFERENCES "IngestionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
