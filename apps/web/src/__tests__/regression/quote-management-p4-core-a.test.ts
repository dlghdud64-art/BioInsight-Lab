/**
 * §quote-management P4-core-A — computePriority 매퍼 토대(UI 무변경)
 *
 * 클라 Quote → QuoteCase 매퍼 + API 실값 forward(totalAmount, vendorRequest expiresAt).
 * 정직성(호영님): amount 미상=null(근사 0), 기한 미상=sentDate null→마감 "—",
 *   재고 미연계=stock "ok" 기본, s1/s3/s4 마감=null, 퍼널 외=null.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");
const MAP = root("lib/quote-management/from-quote.ts");
const API = root("app/api/quotes/route.ts");
const PAGE = root("app/dashboard/quotes/page.tsx");

describe("§quote-management P4-core-A — toQuoteCase 매퍼", () => {
  it("deriveStage 게이트(퍼널 외 = null)", () => {
    expect(MAP).toMatch(/export function toQuoteCase/);
    expect(MAP).toMatch(/const stage = deriveStage\(q\.status\)/);
    expect(MAP).toMatch(/if \(!stage\) return null/);
  });
  it("정직 fallback — amount null / stock ok / s1·s3·s4 마감 null", () => {
    expect(MAP).toMatch(/amount: q\.totalAmount \?\? null/);
    expect(MAP).toMatch(/stock: "ok"/);
    expect(MAP).toMatch(/sendByDate: null/);
    expect(MAP).toMatch(/decisionDueDate: null/);
  });
  it("응답 기한 실값 — expiresAt−createdAt, 미상이면 sentDate null(근사 금지)", () => {
    expect(MAP).toMatch(/const sentDate = hasWindow \?/);
    expect(MAP).toMatch(/: null;/);
    expect(MAP).toMatch(/soonest!\.expires - soonest!\.created/);
    expect(MAP).toMatch(/responseWindowDays = hasWindow/);
  });
});

describe("§quote-management P4-core-A — API 실값 forward", () => {
  it("totalAmount forward(근사 금지, 미상 null)", () => {
    expect(API).toMatch(/totalAmount: q\.totalAmount \?\? null/);
  });
  it("vendorRequest expiresAt select + map", () => {
    expect(API).toMatch(/expiresAt: true/);
    expect(API).toMatch(/expiresAt: vr\.expiresAt \? vr\.expiresAt\.toISOString\(\) : null/);
  });
});

describe("§quote-management P4-core-A — 클라 Quote 타입 확장", () => {
  it("totalAmount + vendorRequest expiresAt 타입 추가", () => {
    expect(PAGE).toMatch(/totalAmount\?: number \| null/);
    expect(PAGE).toMatch(/expiresAt\?: string \| null/);
  });
});
