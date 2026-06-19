/**
 * §quote-management P4-core-B — 우선 추천 카드 + 우선순위 단일화
 *
 * - 우선 추천 카드: computePriority(룰베이스) score 1위. "AI" 라벨/Sparkles 금지(가드②).
 *   高/中만 추천, 0이면 노출 0(정직). CTA = 케이스 열기(real, dead button 0).
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
  it("정직 — 高/中만 추천(低 skip), 0이면 노출 0", () => {
    expect(CARD).toMatch(/r\.level === "low"/);
    expect(CARD).toMatch(/if \(!best\) return null/);
  });
  it('"우선 추천" 라벨 + "AI"/Sparkles 금지(가드②)', () => {
    expect(CARD).toMatch(/<span className="font-semibold">우선 추천<\/span>/);
    expect(CARD).not.toMatch(/<Sparkles/);
    expect(CARD).not.toMatch(/from "lucide-react".*Sparkles/);
  });
  it("CTA = 케이스 열기(real, dead button 0)", () => {
    expect(CARD).toMatch(/onClick=\{\(\) => onOpen\(best\.id\)\}/);
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
    expect(PAGE).toMatch(/railState === "response_delayed" \? "bg-slate-100/);
  });
  it("구 'AI 추천' 배너(priorityAiRecommendation) 폐기", () => {
    expect(PAGE).not.toMatch(/priorityAiRecommendation/);
  });
});
