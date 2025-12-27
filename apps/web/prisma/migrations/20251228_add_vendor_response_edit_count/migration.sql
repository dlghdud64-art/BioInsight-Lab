-- AlterTable
ALTER TABLE "QuoteVendorRequest"
ADD COLUMN "responseEditCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "responseEditLimit" INTEGER NOT NULL DEFAULT 1;

-- Update existing records (already default 0 and 1)
-- No backfill needed as defaults are applied
