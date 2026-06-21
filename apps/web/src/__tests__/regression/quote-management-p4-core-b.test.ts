/**
 * §quote-management P4-core-B + §quote-flat Q2 — 우선 추천 카드 + 우선순위 단일화
 *
 * - 우선 추천 카드: computePriority(룰베이스) score 1위. "AI" 라벨/Sparkles 금지(가드②).
 *   ★ Q2 진화(CEO 2026-06-21): 최우선 1건 **상시 노출** + 真 level(높음/보통/낮음) 표시.
 *     "高/中만 노출 → return null" 정책 폐기. 단 정직 불변식 보존:
 *       ① 케이스 0건이면 노출 0(!best) ② 가짜 격상 0(best.level 真값) ③ 低 사유 생략(derive reason=null).
 *   CTA = 케이스 열기(real, dead button 0). 다음 단계는 본문 텍스트 안내(가짜 액션 금지).
 * - 단일화: priorityLevel 정의를 computePriority 로 교체(high→critical/mid→high/low→normal).
 *   border·dot·aria 소비처 무변경. deriveRailState 는 status/rail/게이팅 유지(제거 아님).
 * - 회귀: "AI 추천" 배너(priorityAiRecommendation) 폐기.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");
const CARD = root("components/quotes/priority-recommendation-card.tsx");
const PAGE = root("app/dashboard/quotes/page.tsx");

describe("§quote-management P4-core-B — 우선 추천 카드(룰베이스)", () => {
  it("computePriority + toQuoteCase 룰베이스 산출", () => {
    expect(CARD).toMatch(/export function PriorityRecommendationCard/);
    expect(CARD).toMatch(/toQuoteCase\(q\)/);
    expect(CARD).toMatch(/computePriority\(c\)/);
  });
  it("정직 — 최우선 1건 상시 노출 + 真 level(가짜 격상 0), 케이스 0이면 노출 0", () => {
    // 케이스 0건 → 노출 0(빈 상태 별도)
    expect(CARD).toMatch(/if \(!best\) return null/);
    // 低 skip 폐기 — 상시 노출(level별 continue 제거)
    expect(CARD).not.toMatch(/r\.level === "low"/);
    // 真 level 사용(가짜 격상 0) + 낮음까지 정직 표기
    expect(CARD).toMatch(/best\.level/);
    expect(CARD).toMatch(/low: "낮음"/);
  });
  it('"우선 추천" 라벨 + "AI"/Sparkles 금지(가드②)', () => {
    expect(CARD).toMatch(/<span className="font-semibold">우선 추천<\/span>/);
    expect(CARD).not.toMatch(/<Sparkles/);
    expect(CARD).not.toMatch(/from "lucide-react".*Sparkles/);
  });
  it("CTA = 다음 액션(next.label) 직접 연결 + '나중에' 보류 (§quote-screen-sian P6.3 §07, dead button 0)", () => {
    // P6.3: "케이스 열기" → next.label 실행 버튼(onOpen=다음 액션) + "나중에"(일시 보류, dead 아님).
    expect(CARD).toMatch(/onClick=\{\(\) => onOpen\(best!\.id\)\}/);
    expect(CARD).toMatch(/나중에/);
    expect(CARD).toMatch(/setDismissed/);
  });
  it("§11.302 — amber/orange 0", () => {
    expect(CARD).not.toMatch(/-amber-|-orange-/);
  });
});

describe("§quote-management P4-core-B — 우선순위 단일화(computePriority)", () => {
  it("priorityLevel 정의 = computePriority(toQuoteCase) 기반", () => {
    expect(PAGE).toMatch(/const priorityResult = priorityCase \? computePriority\(priorityCase\)/);
    expect(PAGE).toMatch(/priorityResult\?\.level === "high"/);
    expect(PAGE).toMatch(/priorityResult\?\.level === "mid"/);
  });
  it("border·dot 소비처 무변경(critical/high/normal 시각 버킷 유지)", () => {
    expect(PAGE).toMatch(/priorityLevel === "critical" \? "border-l-4 border-red-500"/);
    expect(PAGE).toMatch(/priorityLevel === "critical" \? "bg-red-500"/);
  });
  it("카드 렌더 + import(computePriority/toQuoteCase/카드)", () => {
    expect(PAGE).toMatch(/<PriorityRecommendationCard/);
    expect(PAGE).toMatch(/import \{ computePriority, type Stage \}/);
    expect(PAGE).toMatch(/import \{ toQuoteCase \}/);
  });
});

describe("§quote-management P4-core-B — 회귀 0(deriveRailState 유지·배너 폐기)", () => {
  it("deriveRailState 는 status/rail 용도 유지(제거 아님)", () => {
    expect(PAGE).toMatch(/const railState = deriveRailState\(quote\)/);
    // §quote-screen-sian P6.1 — 단계 칩 색이 §12 stage 매핑으로 진화(발송=blue). railState 소비 의도 보존.
    expect(PAGE).toMatch(/railState === "request_not_sent" \? "bg-blue-100/);
  });
  it("구 'AI 추천' 배너(priorityAiRecommendation) 폐기", () => {
    expect(PAGE).not.toMatch(/priorityAiRecommendation/);
  });
});
