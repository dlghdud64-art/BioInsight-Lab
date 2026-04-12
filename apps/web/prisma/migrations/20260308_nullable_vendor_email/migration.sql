-- Make vendorEmail nullable to support manual (offline) vendor replies
-- Previously: vendorEmail String (NOT NULL)
-- Changed to: vendorEmail String? (nullable)

DO $$ BEGIN
  ALTER TABLE "QuoteVendorRequest" ALTER COLUMN "vendorEmail" DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
