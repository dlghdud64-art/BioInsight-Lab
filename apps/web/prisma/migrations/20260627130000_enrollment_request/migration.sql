-- §pricing-launch-manual P1~P3 — 수동 결제 출시 도입 신청(EnrollmentRequest, additive only)
-- 검증: operator-shell read-only `migrate diff --from-url`(prod) 결과와 일치. CREATE만, FK/DROP/data-loss/기존 ALTER 0.

-- CreateTable
CREATE TABLE "EnrollmentRequest" (
    "id" TEXT NOT NULL,
    "company" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "planIntent" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "invoiceAmount" INTEGER,
    "invoiceNote" TEXT,
    "note" TEXT,
    "workspaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "EnrollmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrollmentRequest_status_createdAt_idx" ON "EnrollmentRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EnrollmentRequest_contactEmail_idx" ON "EnrollmentRequest"("contactEmail");
