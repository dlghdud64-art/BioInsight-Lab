-- Drop old Purchase/Budget tables if they exist
DROP TABLE IF EXISTS "PurchaseRecord" CASCADE;
DROP TABLE IF EXISTS "Budget" CASCADE;

-- Drop old enums if they exist
DROP TYPE IF EXISTS "PurchaseSource";

-- Create new PurchaseRecord table with scopeKey
CREATE TABLE "PurchaseRecord" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "quoteId" TEXT,
  "purchasedAt" TIMESTAMP(3) NOT NULL,
  "vendorName" TEXT NOT NULL,
  "category" TEXT,
  "itemName" TEXT NOT NULL,
  "catalogNumber" TEXT,
  "unit" TEXT,
  "qty" INTEGER NOT NULL,
  "unitPrice" INTEGER,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KRW',
  "source" TEXT NOT NULL DEFAULT 'import',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PurchaseRecord_pkey" PRIMARY KEY ("id")
);

-- Create indexes for PurchaseRecord
CREATE INDEX "PurchaseRecord_scopeKey_purchasedAt_idx" ON "PurchaseRecord"("scopeKey", "purchasedAt");
CREATE INDEX "PurchaseRecord_scopeKey_vendorName_idx" ON "PurchaseRecord"("scopeKey", "vendorName");
CREATE INDEX "PurchaseRecord_scopeKey_category_idx" ON "PurchaseRecord"("scopeKey", "category");
CREATE INDEX "PurchaseRecord_quoteId_idx" ON "PurchaseRecord"("quoteId");

-- Add foreign key for quoteId
ALTER TABLE "PurchaseRecord" ADD CONSTRAINT "PurchaseRecord_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create Budget table with scopeKey
CREATE TABLE "Budget" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "yearMonth" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KRW',
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- Create unique index and other indexes for Budget
CREATE UNIQUE INDEX "Budget_scopeKey_yearMonth_key" ON "Budget"("scopeKey", "yearMonth");
CREATE INDEX "Budget_scopeKey_idx" ON "Budget"("scopeKey");
CREATE INDEX "Budget_yearMonth_idx" ON "Budget"("yearMonth");

-- Add PURCHASED status to QuoteStatus enum if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'PURCHASED'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'QuoteStatus')
  ) THEN
    ALTER TYPE "QuoteStatus" ADD VALUE 'PURCHASED';
  END IF;
END $$;
