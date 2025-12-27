-- AlterTable: Add guestKey support to Quote
ALTER TABLE "Quote"
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN "guestKey" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'KRW',
  ADD COLUMN "totalAmount" INTEGER;

-- CreateIndex: Add index for guestKey
CREATE INDEX "Quote_guestKey_idx" ON "Quote"("guestKey");

-- AlterTable: Update QuoteListItem to support draft items
ALTER TABLE "QuoteListItem"
  ALTER COLUMN "productId" DROP NOT NULL,
  ALTER COLUMN "lineNumber" DROP NOT NULL,
  ADD COLUMN "name" TEXT,
  ADD COLUMN "brand" TEXT,
  ADD COLUMN "catalogNumber" TEXT,
  ADD COLUMN "unit" TEXT DEFAULT 'ea',
  ALTER COLUMN "unitPrice" TYPE INTEGER USING ("unitPrice"::integer),
  ALTER COLUMN "lineTotal" TYPE INTEGER USING ("lineTotal"::integer),
  ADD COLUMN "raw" JSONB;

-- CreateTable: QuoteVendor
CREATE TABLE "QuoteVendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "email" TEXT,
    "country" TEXT DEFAULT 'KR',
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteVendor_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QuoteVendor_quoteId_idx" ON "QuoteVendor"("quoteId");
CREATE INDEX "QuoteVendor_vendorName_idx" ON "QuoteVendor"("vendorName");

-- CreateTable: QuoteShare
CREATE TABLE "QuoteShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL UNIQUE,
    "shareToken" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteShare_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "QuoteShare_quoteId_key" ON "QuoteShare"("quoteId");
CREATE UNIQUE INDEX "QuoteShare_shareToken_key" ON "QuoteShare"("shareToken");
CREATE INDEX "QuoteShare_shareToken_idx" ON "QuoteShare"("shareToken");
CREATE INDEX "QuoteShare_enabled_idx" ON "QuoteShare"("enabled");
