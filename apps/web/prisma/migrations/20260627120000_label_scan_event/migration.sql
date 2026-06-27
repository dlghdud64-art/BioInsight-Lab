-- §pricing-enforce-p2 P2b — 라벨 스캔 월 한도 enforce용 LabelScanEvent (append-only, additive only)
-- 검증: operator-shell read-only `migrate diff --from-url`(prod) 결과와 일치. CREATE만, DROP/data-loss/기존 ALTER 0.

-- CreateTable
CREATE TABLE "LabelScanEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabelScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabelScanEvent_userId_createdAt_idx" ON "LabelScanEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "LabelScanEvent" ADD CONSTRAINT "LabelScanEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
