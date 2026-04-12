-- Create ImportJobStatus enum
DO $$ BEGIN
  CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ImportJob" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "errorSample" JSONB,
    "result" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportJob_scopeKey_idx" ON "ImportJob"("scopeKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportJob_type_idx" ON "ImportJob"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");
