-- CreateEnum: AiActionType
DO $$ BEGIN
  CREATE TYPE "AiActionType" AS ENUM (
    'QUOTE_DRAFT',
    'VENDOR_EMAIL_DRAFT',
    'REORDER_SUGGESTION',
    'EXPIRY_ALERT',
    'FOLLOWUP_DRAFT',
    'VENDOR_RESPONSE_PARSED',
    'STATUS_CHANGE_SUGGEST'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: AiActionStatus
DO $$ BEGIN
  CREATE TYPE "AiActionStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'DISMISSED',
    'EXPIRED',
    'EXECUTING',
    'FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum: AiActionPriority
DO $$ BEGIN
  CREATE TYPE "AiActionPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterEnum: AuditEntityType에 AI_ACTION 추가
DO $$ BEGIN
  ALTER TYPE "AuditEntityType" ADD VALUE 'AI_ACTION';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: AiActionItem
CREATE TABLE IF NOT EXISTS "AiActionItem" (
    "id" TEXT NOT NULL,
    "type" "AiActionType" NOT NULL,
    "status" "AiActionStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "AiActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "aiModel" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "AiActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AiActionItem_userId_status_idx" ON "AiActionItem"("userId", "status");
CREATE INDEX IF NOT EXISTS "AiActionItem_organizationId_status_idx" ON "AiActionItem"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "AiActionItem_type_idx" ON "AiActionItem"("type");
CREATE INDEX IF NOT EXISTS "AiActionItem_status_idx" ON "AiActionItem"("status");
CREATE INDEX IF NOT EXISTS "AiActionItem_createdAt_idx" ON "AiActionItem"("createdAt");

-- AddForeignKey: userId → User
DO $$ BEGIN
  ALTER TABLE "AiActionItem" ADD CONSTRAINT "AiActionItem_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: organizationId → Organization
DO $$ BEGIN
  ALTER TABLE "AiActionItem" ADD CONSTRAINT "AiActionItem_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
