-- α-D session A (ADR-002 §11.21): persisted operator choice of which
-- QuoteReply this quote will be converted from.
--
-- Nullable column on Quote — older rows persist as NULL (no choice
-- yet). Intentionally NOT a Prisma relation / FOREIGN KEY constraint:
-- an unconstrained string keeps this ALTER TABLE simple, safe to roll
-- back, and lets the resolver fall back to NULL if the referenced
-- QuoteReply is deleted out-of-band. QuoteReply.id format is cuid
-- (same shape as Quote.id), so the column is a plain TEXT.

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "selectedReplyId" TEXT;
