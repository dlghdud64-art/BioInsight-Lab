/**
 * §10 Phase 2 — per-RFQ 공급사 비교 데이터 와이어링(호영님 피봇 결정 2026-06-22).
 *
 * 교차(5견적) → per-RFQ(한 견적 안 공급사) 비교로 전환. 단가/납기/moq 는 한 RFQ 안
 *   공급사별로만 의미 → QuoteVendorResponseItem(canonical)에서 끌어와 세부표 채움.
 *   ① quotes API: vendorRequests.responseItems(unitPrice/leadTimeDays/moq) include + forward
 *   ② page runAiQuoteCompare: 회신 2곳+ 견적 선택 + 공급사별 집계(Σ단가×수량) payload
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const QUOTES = readFileSync(resolve(__dirname, "../../app/api/quotes/route.ts"), "utf8");
const PAGE = readFileSync(resolve(__dirname, "../../app/dashboard/quotes/page.tsx"), "utf8");

describe("§10 Phase 2 — quotes API responseItems(단가/납기/moq) 와이어링", () => {
  it("vendorRequests include 에 responseItems(unitPrice/leadTimeDays/moq)", () => {
    expect(QUOTES).toContain("responseItems");
    expect(QUOTES).toMatch(/unitPrice:\s*true/);
    expect(QUOTES).toMatch(/leadTimeDays:\s*true/);
    expect(QUOTES).toMatch(/moq:\s*true/);
  });
  it("프론트로 forward(매핑)", () => {
    expect(QUOTES).toMatch(/responseItems:\s*\(vr\.responseItems/);
  });
});

describe("§10 Phase 2 — page per-RFQ 공급사 비교 집계", () => {
  it("회신 2곳+ 견적 선택(hasVendorData ≥2) — 부족 시 정직 에러", () => {
    expect(PAGE).toContain("hasVendorData");
    expect(PAGE).toMatch(/\.length >= 2/);
    expect(PAGE).toContain("비교할 공급사 회신이 부족합니다");
  });
  it("공급사별 집계: 단가×수량 총액 + 납기/moq max", () => {
    expect(PAGE).toContain("qtyById");
    expect(PAGE).toMatch(/total \+= it\.unitPrice \* qty/);
    expect(PAGE).toContain("Math.round(total / totalQty)");
    expect(PAGE).toMatch(/Math\.max\(\.\.\.leads\)/);
  });
  it("payload 가 공급사별 단가/납기/moq 전송 + selectedQuoteId 의존", () => {
    expect(PAGE).toMatch(/leadTimeDays:\s*leads\.length/);
    expect(PAGE).toMatch(/\}, \[quotes, selectedQuoteId, permOrganizationId\]\)/);
  });
});
