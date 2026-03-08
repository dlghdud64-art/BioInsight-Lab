-- Make vendorEmail nullable to support manual (offline) vendor replies
-- Previously: vendorEmail String (NOT NULL)
-- Changed to: vendorEmail String? (nullable)

ALTER TABLE "QuoteVendorRequest" ALTER COLUMN "vendorEmail" DROP NOT NULL;
