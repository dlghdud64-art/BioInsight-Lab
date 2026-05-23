-- §11.290 Phase 1: OcrJob / OcrResult models + 3 enum
-- Smart receiving AI multi-provider fallback foundation

-- CreateEnum
CREATE TYPE "OcrJobType" AS ENUM ('LABEL', 'QUOTE');

-- CreateEnum
CREATE TYPE "OcrJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "OcrProvider" AS ENUM ('GEMINI', 'CLOUD_VISION_CLAUDE', 'REGEX');

-- CreateTable
CREATE TABLE "OcrJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "OcrJobType" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageHash" TEXT NOT NULL,
    "status" "OcrJobStatus" NOT NULL DEFAULT 'PENDING',
    "finalResultId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcrJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OcrResult" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "provider" "OcrProvider" NOT NULL,
    "parsedFields" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "rawText" TEXT,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcrResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OcrJob_finalResultId_key" ON "OcrJob"("finalResultId");

-- CreateIndex
CREATE INDEX "OcrJob_organizationId_type_idx" ON "OcrJob"("organizationId", "type");

-- CreateIndex
CREATE INDEX "OcrJob_imageHash_idx" ON "OcrJob"("imageHash");

-- CreateIndex
CREATE INDEX "OcrResult_jobId_idx" ON "OcrResult"("jobId");

-- AddForeignKey
ALTER TABLE "OcrJob" ADD CONSTRAINT "OcrJob_finalResultId_fkey" FOREIGN KEY ("finalResultId") REFERENCES "OcrResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OcrResult" ADD CONSTRAINT "OcrResult_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "OcrJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
