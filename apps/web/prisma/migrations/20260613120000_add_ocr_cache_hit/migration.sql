-- CreateTable
CREATE TABLE "OcrCacheHit" (
    "id" TEXT NOT NULL,
    "cachedJobId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageHash" TEXT NOT NULL,
    "hitAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OcrCacheHit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcrCacheHit_organizationId_hitAt_idx" ON "OcrCacheHit"("organizationId", "hitAt");

-- CreateIndex
CREATE INDEX "OcrCacheHit_cachedJobId_idx" ON "OcrCacheHit"("cachedJobId");

-- AddForeignKey
ALTER TABLE "OcrCacheHit" ADD CONSTRAINT "OcrCacheHit_cachedJobId_fkey" FOREIGN KEY ("cachedJobId") REFERENCES "OcrJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
