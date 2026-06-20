/**
 * §quote-management P4-label — 룰베이스 "AI 추천" → "우선 추천" 정정(가드②)
 *
 * RAIL_STATE_MAP 의 aiRecommendation 값 8개는 룰베이스(railState 파생)인데 "AI 추천:"으로
 *   라벨돼 있었음(룰베이스를 AI로 라벨 = 가드② 위반). 값 문구만 "우선 추천:"으로 정정.
 *   - 필드명 aiRecommendation 은 유지(rail 계약 — operational-brief-rail-rfq-quote 호환).
 *   - rail/sheet aiRecommendation 렌더 옆 Sparkles(AI 신호) 제거(§368 패턴 정합).
 *   - 실제 LLM 자리(P6)는 무변경.
 *
 * 후속 완료(AI 판단 micro-batch): rail "AI 판단" 섹션 헤더 → "운영 판단"(가드② 마무리).
 *   operational-brief-3-section-compress 앵커도 "운영 판단"으로 진화(섹션 collapse 검사 보존).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = readFileSync(
  join(__dirname, "..", "..", "app/dashboard/quotes/page.tsx"),
  "utf8",
);

describe("§quote-management P4-label (AI 판단 micro-batch) — rail 섹션 헤더 정정", () => {
  it("rail '운영 판단' 헤더 + 'AI 판단' 라벨 0(가드②)", () => {
    expect(PAGE).toMatch(/>운영 판단<\/div>/);
    expect(PAGE).not.toMatch(/AI 판단/); // 헤더·주석 전수 정정 → page-wide 0
  });
});

describe("§quote-management P4-label — 'AI 추천' → '우선 추천' (가드②)", () => {
  it("RAIL_STATE_MAP aiRecommendation 값 = '우선 추천:' (룰베이스 정정)", () => {
    expect(PAGE).toMatch(/aiRecommendation: "우선 추천: /);
    expect(PAGE).not.toMatch(/"AI 추천: /); // 룰베이스 'AI 추천' 라벨 0
  });
  it("필드명 aiRecommendation 유지(rail 계약 보존)", () => {
    expect(PAGE).toMatch(/aiRecommendation: string/);
  });
  it("rail/sheet aiRecommendation 옆 Sparkles(AI 신호) 제거 + 텍스트 렌더 보존", () => {
    expect(PAGE).not.toMatch(/<Sparkles[^>]*\/>\{selectedSignals\.aiRecommendation\}/);
    expect(PAGE).toMatch(/\{selectedSignals\.aiRecommendation\}/);
  });
});
