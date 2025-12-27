-- CreateEnum: VendorRequestStatus
CREATE TYPE "VendorRequestStatus" AS ENUM ('SENT', 'RESPONDED', 'EXPIRED', 'CANCELLED');

-- CreateTable: QuoteVendorRequest
CREATE TABLE "QuoteVendorRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "vendorName" TEXT,
    "vendorEmail" TEXT NOT NULL,
    "message" TEXT,
    "token" TEXT NOT NULL UNIQUE,
    "status" "VendorRequestStatus" NOT NULL DEFAULT 'SENT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteVendorRequest_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable: QuoteVendorResponseItem
CREATE TABLE "QuoteVendorResponseItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendorRequestId" TEXT NOT NULL,
    "quoteItemId" TEXT NOT NULL,
    "unitPrice" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "leadTimeDays" INTEGER,
    "moq" INTEGER,
    "vendorSku" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteVendorResponseItem_vendorRequestId_fkey" FOREIGN KEY ("vendorRequestId") REFERENCES "QuoteVendorRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteVendorResponseItem_quoteItemId_fkey" FOREIGN KEY ("quoteItemId") REFERENCES "QuoteListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QuoteVendorRequest_quoteId_idx" ON "QuoteVendorRequest"("quoteId");
CREATE INDEX "QuoteVendorRequest_token_idx" ON "QuoteVendorRequest"("token");
CREATE INDEX "QuoteVendorRequest_status_idx" ON "QuoteVendorRequest"("status");
CREATE INDEX "QuoteVendorRequest_expiresAt_idx" ON "QuoteVendorRequest"("expiresAt");

CREATE UNIQUE INDEX "QuoteVendorResponseItem_vendorRequestId_quoteItemId_key" ON "QuoteVendorResponseItem"("vendorRequestId", "quoteItemId");
CREATE INDEX "QuoteVendorResponseItem_vendorRequestId_idx" ON "QuoteVendorResponseItem"("vendorRequestId");
CREATE INDEX "QuoteVendorResponseItem_quoteItemId_idx" ON "QuoteVendorResponseItem"("quoteItemId");
