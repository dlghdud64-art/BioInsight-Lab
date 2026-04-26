/**
 * apps/web/src/lib/api/quote-number.ts
 *
 * Single source of truth for the formal quote number format
 * (`Q-YYYYMMDD-XXXXXX`).
 *
 * Why this exists (#P02-followup-quote-number-missing, ADR-002 §11.19)
 * --------------------------------------------------------------------
 * Two creation paths previously diverged:
 *   - /api/quotes/from-cart assigned a quoteNumber inline (`Q-${dateStr}-${quote.id.slice(-6).toUpperCase()}`).
 *   - /api/quotes (createQuote()'s Normal path) assigned nothing, so
 *     fresh formal quotes shipped with `quoteNumber: null` and were
 *     filtered out of /api/quotes/my and /api/work-queue/purchase-conversion
 *     (both filter `quoteNumber: { not: null }` to exclude PDF-extraction
 *     drafts and other non-formal rows).
 *
 * The fix is to centralize the format here and have both paths call it,
 * so "정식 견적" / "비정식 quote" stays a single boolean signal:
 *
 *   quoteNumber === null   → draft / extraction snapshot, hidden from
 *                            user-facing "내 견적" / conversion-queue
 *   quoteNumber !== null   → formal quote, surfaced in user inbox
 *
 * Format
 * ------
 *   Q-YYYYMMDD-{last-6-of-quoteId, uppercased}
 *
 * Uniqueness comes from the cuid suffix, not from a sequence — Quote.id
 * is `@default(cuid())` (collision-free). Same-day quotes get distinct
 * suffixes because their cuids are distinct.
 */

/**
 * Build a formal quote number from a Quote.id and a timestamp.
 *
 * @param quoteId - the Quote.id (typically a cuid).
 * @param now - timestamp source. Defaults to `new Date()`. Inject for
 *   deterministic tests.
 */
export function generateQuoteNumber(
  quoteId: string,
  now: Date = new Date(),
): string {
  // YYYYMMDD from ISO date — matches the from-cart inline pattern this
  // utility replaces.
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  // Tail of the cuid, uppercased. cuids are 25 chars so slice(-6) is
  // safe; a defensive `.slice(-6)` on a shorter string returns the
  // whole string, which is fine.
  const suffix = quoteId.slice(-6).toUpperCase();
  return `Q-${dateStr}-${suffix}`;
}
