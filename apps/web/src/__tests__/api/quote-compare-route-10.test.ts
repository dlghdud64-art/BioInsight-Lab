/**
 * §10 견적 비교 백엔드 — /api/ai/quote-compare route 신규(dead button 봉합).
 *
 * 갭: dashboard/quotes 의 runAiQuoteCompare 가 /api/ai/quote-compare 를 호출하나
 *   route 가 부재 → 404 dead button. 이 route 를 추가해 봉합.
 *
 * canonical truth(§11.318 정합): 페이로드에 canonical 단가/납기가 없으므로
 *   숫자를 AI 로 날조하지 않고 "견적 확인 필요"/"—" placeholder + 정성 분석으로 응답.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE = readFileSync(
  resolve(__dirname, "../../app/api/ai/quote-compare/route.ts"),
  "utf8",
);
const PAGE = readFileSync(
  resolve(__dirname, "../../app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§10 quote-compare — route 존재 + 계약 + canonical truth", () => {
  it("POST 핸들러 + auth 401 게이트", () => {
    expect(ROUTE).toMatch(/export async function POST/);
    expect(ROUTE).toContain('import { auth } from "@/auth"');
    expect(ROUTE).toMatch(/session\?\.user\?\.id/);
    expect(ROUTE).toContain("인증이 필요합니다");
  });

  it("비교 게이트: 견적 후보 2건 미만이면 400(honest, dead-end 아님)", () => {
    expect(ROUTE).toMatch(/quotes\.length < 2/);
    expect(ROUTE).toContain("2건 이상");
  });

  it("canonical truth: 단가/납기 숫자 날조 0 — placeholder 표기", () => {
    expect(ROUTE).toContain("견적 확인 필요");
    // §11.318 — 환각 금지 주석 흔적
    expect(ROUTE).toMatch(/환각 금지|canonical truth/);
  });

  it("GEMINI 키 부재/파싱 실패 시 로컬 fallback(가짜 성공 아님)", () => {
    expect(ROUTE).toContain("buildLocalQuoteCompare");
    expect(ROUTE).toMatch(/!GEMINI_API_KEY/);
    expect(ROUTE).toContain("fallback: true");
  });

  it("프론트 계약 보존: page 가 /api/ai/quote-compare 호출 + data.data 소비", () => {
    expect(PAGE).toContain('"/api/ai/quote-compare"');
    expect(PAGE).toContain("setAiCompareResult(data.data)");
  });
});

describe("§10 숫자 세부표 v1 — canonical 총액 기반 결정론 순위/점수", () => {
  it("route: totalPrice 로 순위/가격점수/추천 결정론 계산(AI 숫자 날조 0)", () => {
    expect(ROUTE).toContain("buildComparisonRows");
    expect(ROUTE).toMatch(/rank.*===\s*1|recommended:\s*rank === 1/);
    // 가격 점수 단일축(60~100 선형) — 결정론
    expect(ROUTE).toMatch(/\*\s*40\s*\+\s*60/);
    // 단가/납기는 미수집(환각 0)
    expect(ROUTE).toContain('leadTime: "미수집"');
    expect(ROUTE).toContain("견적 확인 필요");
  });

  it("route 입력 계약: totalPrice canonical 수신", () => {
    expect(ROUTE).toMatch(/totalPrice\?:\s*number\s*\|\s*null/);
  });

  it("page: payload 가 회신 최저 totalPrice(canonical) 를 실어 보냄", () => {
    expect(PAGE).toMatch(/\.map\(\(r\) => r\.totalPrice\)/);
    expect(PAGE).toContain("Math.min(...totals)");
    expect(PAGE).toContain("totalPrice,");
  });

  it("page: aiCompareResult row shape 에 rank/score/recommended", () => {
    expect(PAGE).toMatch(/rank:\s*number\s*\|\s*null/);
    expect(PAGE).toMatch(/score:\s*number\s*\|\s*null/);
    expect(PAGE).toMatch(/recommended:\s*boolean/);
  });

  it("page: 순위 카드 + AI 추천 리본 + 세부표 + 미수집 주석", () => {
    expect(PAGE).toContain("공급사 순위");
    expect(PAGE).toContain("AI 추천");
    expect(PAGE).toContain("예상 총액");
    expect(PAGE).toContain("가격 점수");
    expect(PAGE).toContain("단가·납기·최소주문(MOQ)");
  });
});
