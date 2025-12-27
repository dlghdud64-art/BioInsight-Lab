-- Enable pg_trgm extension for trigram similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes for trigram search on Product
CREATE INDEX IF NOT EXISTS "Product_name_gin_trgm_idx" ON "Product" USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_catalogNumber_gin_trgm_idx" ON "Product" USING gin ("catalogNumber" gin_trgm_ops);

-- Create GIN indexes for Vendor name (optional but recommended)
CREATE INDEX IF NOT EXISTS "Vendor_name_gin_trgm_idx" ON "Vendor" USING gin (name gin_trgm_ops);

-- Add composite indexes for common search patterns
CREATE INDEX IF NOT EXISTS "Product_category_name_idx" ON "Product" (category, name);
CREATE INDEX IF NOT EXISTS "Product_brand_name_idx" ON "Product" (brand, name);

-- Note: Existing btree indexes on category, brand, vendorId are preserved
-- The new GIN indexes complement them for full-text search
