/**
 * apps/web/src/__tests__/lib/api/quote-number.test.ts
 *
 * Tests for #P02-followup-quote-number-missing — utility extraction
 * from /api/quotes/from-cart pattern. Used by createQuote()'s Normal
 * path and by from-cart route. Assigning quoteNumber is what marks a
 * Quote as a "정식 견적" (cart-based formal quote) — quoteNumber-null
 * rows are filtered out of /api/quotes/my and
 * /api/work-queue/purchase-conversion.
 */

import { describe, it, expect } from "vitest";

import { generateQuoteNumber } from "@/lib/api/quote-number";

describe("generateQuoteNumber", () => {
  // 1. last 6 chars of input id, uppercased (real cuid-shaped input)
  it("[1] last 6 chars of input id, uppercased", () => {
    const id = "cmofbcxj30003usrss33mupfl"; // 25 chars
    const last6 = id.slice(-6); // "3mupfl"
    const r = generateQuoteNumber(id, new Date("2026-04-26T05:14:17.919Z"));
    expect(r).toBe(`Q-20260426-${last6.toUpperCase()}`);
  });

  // 2. Different quoteId → different quoteNumber (uniqueness vehicle)
  it("[2] different quoteIds produce different quoteNumbers same day", () => {
    const now = new Date("2026-04-26T00:00:00Z");
    const a = generateQuoteNumber("aaaaaaaaaaaa111111", now);
    const b = generateQuoteNumber("bbbbbbbbbbbb222222", now);
    expect(a).not.toBe(b);
    expect(a).toBe("Q-20260426-111111");
    expect(b).toBe("Q-20260426-222222");
  });

  // 3. now injection — deterministic date for tests
  it("[3] uses injected now for the date prefix", () => {
    const r1 = generateQuoteNumber("xxxxxx", new Date("2026-01-15T12:00:00Z"));
    const r2 = generateQuoteNumber("xxxxxx", new Date("2027-12-31T23:59:59Z"));
    expect(r1).toBe("Q-20260115-XXXXXX");
    expect(r2).toBe("Q-20271231-XXXXXX");
  });

  // 4. Default now = current date when omitted
  it("[4] defaults to current date when now is omitted", () => {
    const r = generateQuoteNumber("aabbccdd112233");
    // Format check only (not asserting the actual current date)
    expect(r).toMatch(/^Q-\d{8}-[A-Z0-9]+$/);
    expect(r.endsWith("-112233")).toBe(true); // last 6, no letters here
  });

  // 5. Short id (< 6 chars) — slice(-6) returns whole string
  it("[5] id shorter than 6 chars uses entire id, uppercased", () => {
    const r = generateQuoteNumber("abc", new Date("2026-04-26T00:00:00Z"));
    expect(r).toBe("Q-20260426-ABC");
  });

  // 6. Format regex (overall contract)
  it("[6] always matches Q-YYYYMMDD-{last-6-uppercased}", () => {
    const r = generateQuoteNumber(
      "anycuidvalue",
      new Date("2026-04-26T00:00:00Z"),
    );
    expect(r).toMatch(/^Q-\d{8}-[A-Z0-9]{1,6}$/);
  });
});
