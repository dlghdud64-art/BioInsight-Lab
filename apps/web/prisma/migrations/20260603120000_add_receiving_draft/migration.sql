-- CreateEnum
CREATE TYPE "ReceivingDraftStatus" AS ENUM ('AWAITING_REPLY', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ReceivingDraft" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "vendorId" TEXT,
    "token" TEXT NOT NULL,
    "status" "ReceivingDraftStatus" NOT NULL DEFAULT 'AWAITING_REPLY',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectedReason" TEXT,
    "vendorNote" TEXT,
    "snapshot" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "restockSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceivingDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivingDraftItem" (
    "id" TEXT NOT NULL,
    "receivingDraftId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "expectedQuantity" DOUBLE PRECISION,
    "receivedQuantity" DOUBLE PRECISION,
    "unit" TEXT,
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "vendorNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceivingDraftItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceivingDraft_token_key" ON "ReceivingDraft"("token");

-- CreateIndex
CREATE INDEX "ReceivingDraft_orderId_idx" ON "ReceivingDraft"("orderId");

-- CreateIndex
CREATE INDEX "ReceivingDraft_userId_idx" ON "ReceivingDraft"("userId");

-- CreateIndex
CREATE INDEX "ReceivingDraft_organizationId_idx" ON "ReceivingDraft"("organizationId");

-- CreateIndex
CREATE INDEX "ReceivingDraft_vendorId_idx" ON "ReceivingDraft"("vendorId");

-- CreateIndex
CREATE INDEX "ReceivingDraft_token_idx" ON "ReceivingDraft"("token");

-- CreateIndex
CREATE INDEX "ReceivingDraft_status_idx" ON "ReceivingDraft"("status");

-- CreateIndex
CREATE INDEX "ReceivingDraft_expiresAt_idx" ON "ReceivingDraft"("expiresAt");

-- CreateIndex
CREATE INDEX "ReceivingDraftItem_receivingDraftId_idx" ON "ReceivingDraftItem"("receivingDraftId");

-- CreateIndex
CREATE INDEX "ReceivingDraftItem_orderItemId_idx" ON "ReceivingDraftItem"("orderItemId");

-- CreateIndex
CREATE INDEX "ReceivingDraftItem_productId_idx" ON "ReceivingDraftItem"("productId");

-- AddForeignKey
ALTER TABLE "ReceivingDraft" ADD CONSTRAINT "ReceivingDraft_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingDraft" ADD CONSTRAINT "ReceivingDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingDraft" ADD CONSTRAINT "ReceivingDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingDraft" ADD CONSTRAINT "ReceivingDraft_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingDraftItem" ADD CONSTRAINT "ReceivingDraftItem_receivingDraftId_fkey" FOREIGN KEY ("receivingDraftId") REFERENCES "ReceivingDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

