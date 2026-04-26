/**
 * apps/web/src/__tests__/lib/api/order-number.test.ts
 *
 * Tests for #α-D session B (ADR §11.22) — order-number utility.
 * Mirror of quote-number.test.ts; format is `ORD-YYYYMMDD-{cuid-tail}`.
 */

import { describe, it, expect } from "vitest";
import { generateOrderNumber } from "@/lib/api/order-number";

describe("generateOrderNumber", () => {
  it("[1] last 6 chars of input id, uppercased", () => {
    const id = "cmofbcxj30003usrss33mupfl";
    const last6 = id.slice(-6);
    const r = generateOrderNumber(id, new Date("2026-04-26T05:14:17.919Z"));
    expect(r).toBe(`ORD-20260426-${last6.toUpperCase()}`);
  });

  it("[2] different orderIds produce different orderNumbers same day", () => {
    const now = new Date("2026-04-26T00:00:00Z");
    const a = generateOrderNumber("aaaaaaaaaaaa111111", now);
    const b = generateOrderNumber("bbbbbbbbbbbb222222", now);
    expect(a).not.toBe(b);
    expect(a).toBe("ORD-20260426-111111");
    expect(b).toBe("ORD-20260426-222222");
  });

  it("[3] uses injected now for the date prefix", () => {
    const r1 = generateOrderNumber("xxxxxx", new Date("2026-01-15T12:00:00Z"));
    const r2 = generateOrderNumber("xxxxxx", new Date("2027-12-31T23:59:59Z"));
    expect(r1).toBe("ORD-20260115-XXXXXX");
    expect(r2).toBe("ORD-20271231-XXXXXX");
  });

  it("[4] defaults to current date when now is omitted", () => {
    const r = generateOrderNumber("aabbccdd112233");
    expect(r).toMatch(/^ORD-\d{8}-[A-Z0-9]+$/);
    expect(r.endsWith("-112233")).toBe(true);
  });

  it("[5] id shorter than 6 chars uses entire id, uppercased", () => {
    const r = generateOrderNumber("xyz", new Date("2026-04-26T00:00:00Z"));
    expect(r).toBe("ORD-20260426-XYZ");
  });

  it("[6] always matches ORD-YYYYMMDD-{last-6-uppercased}", () => {
    const r = generateOrderNumber(
      "anycuidvalue",
      new Date("2026-04-26T00:00:00Z"),
    );
    expect(r).toMatch(/^ORD-\d{8}-[A-Z0-9]{1,6}$/);
  });
});
