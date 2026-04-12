-- AlterTable: Add guestKey support to Quote
DO $$ BEGIN
  ALTER TABLE "Quote" ALTER COLUMN "userId" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "guestKey" TEXT;
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'KRW';
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "totalAmount" INTEGER;

-- CreateIndex: Add index for guestKey
CREATE INDEX IF NOT EXISTS "Quote_guestKey_idx" ON "Quote"("guestKey");

-- AlterTable: Update QuoteListItem to support draft items
DO $$ BEGIN
  ALTER TABLE "QuoteListItem" ALTER COLUMN "productId" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "QuoteListItem" ALTER COLUMN "lineNumber" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE "QuoteListItem" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "QuoteListItem" ADD COLUMN IF NOT EXISTS "brand" TEXT;
ALTER TABLE "QuoteListItem" ADD COLUMN IF NOT EXISTS "catalogNumber" TEXT;
ALTER TABLE "QuoteListItem" ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT 'ea';

DO $$ BEGIN
  ALTER TABLE "QuoteListItem" ALTER COLUMN "unitPrice" TYPE INTEGER USING ("unitPrice"::integer);
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "QuoteListItem" ALTER COLUMN "lineTotal" TYPE INTEGER USING ("lineTotal"::integer);
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE "QuoteListItem" ADD COLUMN IF NOT EXISTS "raw" JSONB;

-- CreateTable: QuoteVendor
CREATE TABLE IF NOT EXISTS "QuoteVendor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "email" TEXT,
    "country" TEXT DEFAULT 'KR',
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "QuoteVendor" ADD CONSTRAINT "QuoteVendor_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "QuoteVendor_quoteId_idx" ON "QuoteVendor"("quoteId");
CREATE INDEX IF NOT EXISTS "QuoteVendor_vendorName_idx" ON "QuoteVendor"("vendorName");

-- CreateTable: QuoteShare
CREATE TABLE IF NOT EXISTS "QuoteShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "QuoteShare" ADD CONSTRAINT "QuoteShare_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "QuoteShare_quoteId_key" ON "QuoteShare"("quoteId");
CREATE UNIQUE INDEX IF NOT EXISTS "QuoteShare_shareToken_key" ON "QuoteShare"("shareToken");
CREATE INDEX IF NOT EXISTS "QuoteShare_shareToken_idx" ON "QuoteShare"("shareToken");
CREATE INDEX IF NOT EXISTS "QuoteShare_enabled_idx" ON "QuoteShare"("enabled");
