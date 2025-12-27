-- AlterTable
ALTER TABLE "QuoteVendorRequest"
ADD COLUMN "snapshot" JSONB,
ADD COLUMN "snapshotCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill existing records with empty snapshot (will be populated on first access)
-- For MVP: since there's likely no production data, we can use a placeholder
UPDATE "QuoteVendorRequest"
SET "snapshot" = '{"items": []}'::jsonb
WHERE "snapshot" IS NULL;

-- Make snapshot required after backfill
ALTER TABLE "QuoteVendorRequest"
ALTER COLUMN "snapshot" SET NOT NULL;
