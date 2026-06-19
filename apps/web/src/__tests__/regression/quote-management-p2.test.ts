/**
 * §quote-management P2 (PLAN_quote-management) — 파이프라인 퍼널 + 현재집중 + 흡수
 *
 * 지시문 §01·§06. stage(QuoteStatus 파생) 집계, 0=흐리게, 현재집중 배지, 단계 클릭=필터.
 *   - 가짜 데이터 0: 실 quotes 에서만 집계(빈 계정 전부 0).
 *   - dead button 0: 0건 단계 disabled, n>0 만 onStageClick.
 *   - §11.302 정합: 회신추적=yellow(amber/orange 미사용).
 *   - same-canvas: 현행 /dashboard/quotes 흡수(신규 page 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const FUNNEL = read("components/quotes/quote-funnel.tsx");
const PAGE = read("app/dashboard/quotes/page.tsx");

describe("§quote-management P2 — 퍼널 컴포넌트", () => {
  it("deriveStage 집계 + 5단계(s1~s5) + 현재집중", () => {
    expect(FUNNEL).toMatch(/deriveStage/);
    expect(FUNNEL).toMatch(/key: "s1"[\s\S]*key: "s2"[\s\S]*key: "s3"[\s\S]*key: "s4"[\s\S]*key: "s5"/);
    expect(FUNNEL).toMatch(/현재 집중/);
    expect(FUNNEL).toMatch(/counts\[s\] \+= 1/);
  });
  it("0 흐리게(opacity-50) + 클릭 dead button 0", () => {
    expect(FUNNEL).toMatch(/opacity-50/);
    expect(FUNNEL).toMatch(/disabled=\{n === 0\}/);
    expect(FUNNEL).toMatch(/n > 0 && onStageClick/);
  });
  it("§11.302 정합 — amber/orange 0(yellow=회신추적)", () => {
    expect(FUNNEL).not.toMatch(/-amber-|-orange-/);
    expect(FUNNEL).toMatch(/text-yellow-600/);
  });
});

describe("§quote-management P2 — page 흡수(same-canvas, 실데이터)", () => {
  it("QuoteFunnel import + 흡수 + 실 quotes 집계", () => {
    expect(PAGE).toMatch(/import \{ QuoteFunnel \} from "@\/components\/quotes\/quote-funnel"/);
    expect(PAGE).toMatch(/<QuoteFunnel/);
    expect(PAGE).toMatch(/quotes=\{quotesData\?\.quotes \?\? \[\]\}/);
  });
  it("onStageClick → statusFilter 연동(dead button 0)", () => {
    expect(PAGE).toMatch(/onStageClick=\{/);
    expect(PAGE).toMatch(/setStatusFilter\(\(prev\) => \(prev === map\[s\]/);
  });
});
