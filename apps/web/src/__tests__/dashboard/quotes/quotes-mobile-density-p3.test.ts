/**
 * §quotes-mobile-density P3 — 우선추천 카드 inline 1행 + 검색/필터 sticky (밀도 마무리)
 *   (PLAN: docs/plans/PLAN_quotes-mobile-density.md Phase 3)
 *
 * P3: PriorityRecommendationCard 2행(제목 line-clamp + 본문) + h10 아이콘 → 단일 truncate 행(~88px→~48px).
 *     검색+필터 행 sticky top-0(리스트 스크롤 시 상단 고정).
 * ★ canonical 보존: navy 토큰·computePriority 룰베이스·"우선 추천"·CTA(onOpen)·나중에(setDismissed)
 *   ·真 level(§P4-core-B / navy-p4) 전부 무손 — render 밀도만 변경.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..", "..");
const CARD = readFileSync(join(ROOT, "src/components/quotes/priority-recommendation-card.tsx"), "utf8");
const PAGE = readFileSync(join(ROOT, "src/app/dashboard/quotes/page.tsx"), "utf8");

describe("§quotes-mobile-density P3 — 우선추천 inline 1행", () => {
  it("단일 행 컨테이너(flex items-center, 2행 스택 폐지)", () => {
    expect(CARD).toMatch(/flex items-center gap-2\.5/);
    expect(CARD).not.toMatch(/flex flex-col gap-3 sm:flex-row/);
    expect(CARD).not.toMatch(/line-clamp-2/);
  });
  it("본문 단일 truncate 행", () => {
    expect(CARD).toMatch(/min-w-0 flex-1 text-\[12\.5px\] leading-snug truncate/);
  });
  it("아이콘 box(h-10 w-10) 폐지 → 인라인 소형 아이콘", () => {
    expect(CARD).not.toMatch(/h-10 w-10 flex-none items-center justify-center rounded-xl/);
    expect(CARD).toMatch(/<ListChecks className="relative z-10 h-4 w-4 flex-none/);
  });
});

describe("§quotes-mobile-density P3 — 검색/필터 sticky", () => {
  it("검색+필터 컨테이너 sticky top-0 + bg(비침 방지)", () => {
    expect(PAGE).toMatch(/<div className="sticky top-0 z-20 bg-white flex flex-col gap-2 pb-2">/);
  });
});

describe("§quotes-mobile-density P3 — canonical 보존(회귀 0)", () => {
  it("navy 토큰 보존(§navy-p4): gradient + boxShadow + text-[#a9c2f5]", () => {
    expect(CARD).toMatch(/linear-gradient\(100deg, #1b2b50 0%, #243a72 55%, #2f6be0 130%\)/);
    expect(CARD).toMatch(/boxShadow: "0 6px 18px -8px rgba\(20,38,80,\.55\)"/);
    expect(CARD).toMatch(/text-\[#a9c2f5\]/);
  });
  it("룰베이스 + '우선 추천' 정확 마크업 보존(§P4-core-B, AI 격상 0)", () => {
    expect(CARD).toMatch(/computePriority/);
    expect(CARD).toMatch(/<span className="font-semibold">우선 추천<\/span>/);
    const code = CARD.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code).not.toMatch(/Sparkles/);
  });
  it("CTA(onOpen) + 나중에(setDismissed) + !best return null 보존(dead button 0)", () => {
    expect(CARD).toMatch(/onClick=\{\(\) => onOpen\(best!\.id\)\}/);
    expect(CARD).toMatch(/나중에/);
    expect(CARD).toMatch(/setDismissed/);
    expect(CARD).toMatch(/if \(!best\) return null/);
  });
  it("真 level 라벨 + amber/orange 0", () => {
    expect(CARD).toMatch(/high: "높음"/);
    expect(CARD).toMatch(/low: "낮음"/);
    expect(CARD).not.toMatch(/-amber-|-orange-/);
  });
});
