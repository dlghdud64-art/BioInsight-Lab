/**
 * apps/web/src/lib/api/order-number.ts
 *
 * Single source of truth for the formal order number format
 * (`ORD-YYYYMMDD-XXXXXX`).
 *
 * Why this exists (#α-D session B, ADR-002 §11.22)
 * ------------------------------------------------
 * Bulk-PO conversion creates Order rows from the conversion-queue's
 * ready_for_po quotes. Each Order needs a stable, human-recognizable
 * number that mirrors the quoteNumber convention (Q-YYYYMMDD-XXXXXX
 * from §11.19).
 *
 * Format
 * ------
 *   ORD-YYYYMMDD-{last-6-of-orderId, uppercased}
 *
 * Uniqueness comes from the cuid suffix, not from a sequence —
 * Order.id is `@default(cuid())` (collision-free). Same-day orders
 * get distinct suffixes because their cuids are distinct.
 *
 * Mirrors quote-number.ts intentionally — keeping the two as separate
 * files (vs. a generic helper) makes greps and edits scope-tight.
 */

export function generateOrderNumber(
  orderId: string,
  now: Date = new Date(),
): string {
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = orderId.slice(-6).toUpperCase();
  return `ORD-${dateStr}-${suffix}`;
}
