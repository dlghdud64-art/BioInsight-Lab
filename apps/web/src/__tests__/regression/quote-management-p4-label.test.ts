/**
 * §quote-management P4-label — 룰베이스 "AI 추천" → "우선 추천" 정정(가드②)
 *
 * RAIL_STATE_MAP 의 aiRecommendation 값 8개는 룰베이스(railState 파생)인데 "AI 추천:"으로
 *   라벨돼 있었음(룰베이스를 AI로 라벨 = 가드② 위반). 값 문구만 "우선 추천:"으로 정정.
 *   - 필드명 aiRecommendation 은 유지(rail 계약 — operational-brief-rail-rfq-quote 호환).
 *   - rail/sheet aiRecommendation 렌더 옆 Sparkles(AI 신호) 제거(§368 패턴 정합).
 *   - 실제 LLM 자리(P6)는 무변경.
 *
 * 범위 밖(flag): "AI 판단" 섹션 헤더는 operational-brief-3-section-compress 가 앵커로
 *   강제 → 별도 결정(후속). 본 배치 미적용.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PAGE = readFileSync(
  join(__dirname, "..", "..", "app/dashboard/quotes/page.tsx"),
  "utf8",
);

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
