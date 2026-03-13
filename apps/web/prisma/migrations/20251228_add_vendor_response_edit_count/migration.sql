-- AlterTable
ALTER TABLE "QuoteVendorRequest" ADD COLUMN IF NOT EXISTS "responseEditCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QuoteVendorRequest" ADD COLUMN IF NOT EXISTS "responseEditLimit" INTEGER NOT NULL DEFAULT 1;

-- Update existing records (already default 0 and 1)
-- No backfill needed as defaults are applied
