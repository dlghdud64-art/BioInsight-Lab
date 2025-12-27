-- Supabase Row Level Security (RLS) Policies for Quote System
--
-- IMPORTANT: These policies work with service role key for server-side operations.
-- Client-side access should NEVER bypass RLS - all guest operations must go through API routes.

-- Enable RLS on Quote table
ALTER TABLE "Quote" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on QuoteListItem table
ALTER TABLE "QuoteListItem" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on QuoteVendor table
ALTER TABLE "QuoteVendor" ENABLE ROW LEVEL SECURITY;

-- Enable RLS on QuoteShare table (if needed for public sharing)
ALTER TABLE "QuoteShare" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Quote Policies
-- =============================================================================

-- Policy: Authenticated users can see their own quotes
CREATE POLICY "Users can view own quotes"
  ON "Quote"
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = "userId");

-- Policy: Authenticated users can insert their own quotes
CREATE POLICY "Users can create own quotes"
  ON "Quote"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = "userId");

-- Policy: Authenticated users can update their own quotes
CREATE POLICY "Users can update own quotes"
  ON "Quote"
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

-- Policy: Authenticated users can delete their own quotes
CREATE POLICY "Users can delete own quotes"
  ON "Quote"
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = "userId");

-- NOTE: Guest users (guestKey-based) CANNOT directly access via Supabase client
-- All guest operations MUST go through API routes using service role key

-- =============================================================================
-- QuoteListItem Policies
-- =============================================================================

-- Policy: Users can view items of their own quotes
CREATE POLICY "Users can view own quote items"
  ON "QuoteListItem"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Quote"
      WHERE "Quote".id = "QuoteListItem"."quoteId"
        AND "Quote"."userId" = auth.uid()::text
    )
  );

-- Policy: Users can insert items to their own quotes
CREATE POLICY "Users can create items in own quotes"
  ON "QuoteListItem"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Quote"
      WHERE "Quote".id = "QuoteListItem"."quoteId"
        AND "Quote"."userId" = auth.uid()::text
    )
  );

-- Policy: Users can update items in their own quotes
CREATE POLICY "Users can update items in own quotes"
  ON "QuoteListItem"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Quote"
      WHERE "Quote".id = "QuoteListItem"."quoteId"
        AND "Quote"."userId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Quote"
      WHERE "Quote".id = "QuoteListItem"."quoteId"
        AND "Quote"."userId" = auth.uid()::text
    )
  );

-- Policy: Users can delete items from their own quotes
CREATE POLICY "Users can delete items from own quotes"
  ON "QuoteListItem"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Quote"
      WHERE "Quote".id = "QuoteListItem"."quoteId"
        AND "Quote"."userId" = auth.uid()::text
    )
  );

-- =============================================================================
-- QuoteVendor Policies
-- =============================================================================

-- Policy: Users can view vendors of their own quotes
CREATE POLICY "Users can view vendors of own quotes"
  ON "QuoteVendor"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Quote"
      WHERE "Quote".id = "QuoteVendor"."quoteId"
        AND "Quote"."userId" = auth.uid()::text
    )
  );

-- Policy: Users can add vendors to their own quotes
CREATE POLICY "Users can add vendors to own quotes"
  ON "QuoteVendor"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Quote"
      WHERE "Quote".id = "QuoteVendor"."quoteId"
        AND "Quote"."userId" = auth.uid()::text
    )
  );

-- Policy: Users can update vendors in their own quotes
CREATE POLICY "Users can update vendors in own quotes"
  ON "QuoteVendor"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Quote"
      WHERE "Quote".id = "QuoteVendor"."quoteId"
        AND "Quote"."userId" = auth.uid()::text
    )
  );

-- Policy: Users can delete vendors from their own quotes
CREATE POLICY "Users can delete vendors from own quotes"
  ON "QuoteVendor"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Quote"
      WHERE "Quote".id = "QuoteVendor"."quoteId"
        AND "Quote"."userId" = auth.uid()::text
    )
  );

-- =============================================================================
-- QuoteShare Policies (for Phase B - Public Sharing)
-- =============================================================================

-- Policy: Anyone can view enabled shares (public access)
-- UNCOMMENT WHEN IMPLEMENTING PHASE B PUBLIC SHARING:
-- CREATE POLICY "Anyone can view enabled shares"
--   ON "QuoteShare"
--   FOR SELECT
--   TO anon, authenticated
--   USING ("enabled" = true AND ("expiresAt" IS NULL OR "expiresAt" > NOW()));

-- Policy: Users can manage shares for their own quotes
CREATE POLICY "Users can manage shares of own quotes"
  ON "QuoteShare"
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "Quote"
      WHERE "Quote".id = "QuoteShare"."quoteId"
        AND "Quote"."userId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Quote"
      WHERE "Quote".id = "QuoteShare"."quoteId"
        AND "Quote"."userId" = auth.uid()::text
    )
  );

-- =============================================================================
-- Notes
-- =============================================================================

-- 1. Guest users (guestKey-based access) MUST use API routes
--    - API routes use service role key to bypass RLS
--    - Server-side validation checks guestKey match
--
-- 2. Authenticated users access quotes via Supabase client
--    - RLS automatically enforces userId = auth.uid()
--
-- 3. Public sharing (Phase B) will use QuoteShare.shareToken
--    - Read-only access to quote snapshots
--    - Uncomment public share policy when implementing
