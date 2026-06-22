/**
 * §10 견적 비교 — /api/ai/quote-compare + 대시보드 비교 모달(시안 CompareModal 풀 빌드).
 *
 * dead button 봉합(route 부재 404) + 시안 layout: 네이비 종합추천·순위 카드·세부표(단가/납기/moq)·협상 포인트.
 * canonical truth(§11.318): 총액·순위·점수는 결정론, 단가/납기/moq canonical 부재 시 "미수집"(AI 날조 0).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE = readFileSync(resolve(__dirname, "../../app/api/ai/quote-compare/route.ts"), "utf8");
const PAGE = readFileSync(resolve(__dirname, "../../app/dashboard/quotes/page.tsx"), "utf8");

describe("§10 quote-compare route — 계약 + canonical truth", () => {
  it("POST + auth 401 + 후보<2 400", () => {
    expect(ROUTE).toMatch(/export async function POST/);
    expect(ROUTE).toContain('import { auth } from "@/auth"');
    expect(ROUTE).toContain("인증이 필요합니다");
    expect(ROUTE).toMatch(/quotes\.length < 2/);
  });

  it("결정론 순위/점수/추천 — buildCompareData(rank===1, 점수 60~100)", () => {
    expect(ROUTE).toContain("buildCompareData");
    expect(ROUTE).toMatch(/recommended:\s*rank === 1/);
    expect(ROUTE).toMatch(/\*\s*40\s*\+\s*60/);
  });

  it("canonical: 단가/납기/moq 없으면 '미수집'(날조 0), null 총액='견적 확인 필요'", () => {
    expect(ROUTE).toContain("미수집");
    expect(ROUTE).toContain("견적 확인 필요");
    expect(ROUTE).toMatch(/환각 금지|canonical truth/);
  });

  it("리치 shape: ranks/rows/totalRow/negotiationPoints/recommendedIdx", () => {
    expect(ROUTE).toMatch(/ranks:/);
    expect(ROUTE).toMatch(/rows:/);
    expect(ROUTE).toMatch(/totalRow:/);
    expect(ROUTE).toMatch(/negotiationPoints/);
    expect(ROUTE).toMatch(/recommendedIdx/);
  });

  it("GEMINI 키 부재/파싱 실패 시 로컬 fallback(가짜 성공 0)", () => {
    expect(ROUTE).toMatch(/!GEMINI_API_KEY/);
    expect(ROUTE).toContain("buildLocalText");
    expect(ROUTE).toContain("fallback: true");
  });
});

describe("§10 비교 모달(page) — 시안 CompareModal layout 소비", () => {
  it("프론트 계약: /api/ai/quote-compare 호출 + data.data 소비 + canonical 총액 payload", () => {
    expect(PAGE).toContain('"/api/ai/quote-compare"');
    expect(PAGE).toContain("setAiCompareResult(data.data)");
    // §10 Phase 2 — per-RFQ 피봇: Phase 1 단순 Math.min(...totals) → 공급사별 canonical 총액 Σ(단가×수량) 집계.
    expect(PAGE).toContain("total += it.unitPrice * qty");
  });

  it("state 리치 shape(ranks/rows/totalRow/recommendedIdx)", () => {
    expect(PAGE).toMatch(/ranks: Array</);
    expect(PAGE).toMatch(/totalRow: \{/);
    expect(PAGE).toMatch(/recommendedIdx: number \| null/);
  });

  it("시안 layout: 네이비 종합추천 + 순위카드 + 세부표(★추천·행별✓) + 협상 포인트", () => {
    expect(PAGE).toContain("AI 종합 추천");
    expect(PAGE).toContain("AI 협상 포인트");
    expect(PAGE).toContain("비교 항목");
    expect(PAGE).toContain("예상 총액");
    expect(PAGE).toContain("★ 추천");
    expect(PAGE).toContain("from-[#0f1b34]");
  });
});
