/**
 * §nextstep-banner-density — 대시보드 NextStepBanner 를 견적 우선추천과 동일 thin inline 1행으로 정합
 *   (호영님 2026-06-27: "메인대시보드랑 견적관리랑 우선추천 크기가 다르다" → 크기 일치)
 *
 * §quotes-mobile-density P3 에서 견적 PriorityRecommendationCard 를 inline 1행(~52px)으로 thin화 →
 *   navy 토큰 공유·동일 역할(룰베이스 next-action 배너)인 NextStepBanner 도 동일 thin 으로 정합.
 * ★ §dashboard-shifan-adopt P2 핀(navy gradient·deriveInsight·CTA href·min-h-[44px]·dismiss) 전부 무손.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..", "..");
const BANNER = readFileSync(join(ROOT, "src/components/dashboard/next-step-banner.tsx"), "utf8");

describe("§nextstep-banner-density — thin inline 1행(견적 정합)", () => {
  it("단일 행 컨테이너(flex items-center, 3행 스택 폐지)", () => {
    expect(BANNER).toMatch(/flex items-center gap-2\.5/);
    expect(BANNER).not.toMatch(/flex flex-col gap-0\.5/);
    expect(BANNER).not.toMatch(/p-4 md:px-\[18px\] md:py-\[15px\]/);
  });
  it("본문 단일 truncate 행(eyebrow+title+desc inline)", () => {
    expect(BANNER).toMatch(/min-w-0 flex-1 text-\[12\.5px\] leading-snug truncate/);
  });
  it("아이콘 box(h-10 w-10) 폐지 → 인라인 소형 아이콘", () => {
    expect(BANNER).not.toMatch(/h-10 w-10 flex-shrink-0 items-center justify-center/);
    expect(BANNER).toMatch(/<Icon className="relative z-10 h-4 w-4 flex-none/);
  });
});

describe("§nextstep-banner-density — §dashboard-shifan-adopt P2 무손(회귀 0)", () => {
  it("navy 토큰 보존(gradient + boxShadow)", () => {
    expect(BANNER).toMatch(/linear-gradient\(100deg, #1b2b50 0%, #243a72 55%, #2f6be0 130%\)/);
    expect(BANNER).toMatch(/boxShadow: "0 6px 18px -8px rgba\(20,38,80,\.55\)"/);
  });
  it("deriveInsight + '다음 단계 추천' + CTA href + min-h-[44px] 보존", () => {
    expect(BANNER).toMatch(/다음 단계 추천/);
    expect(BANNER).toMatch(/budget\.isSet/);
    expect(BANNER).toMatch(/예산 설정/);
    expect(BANNER).toMatch(/href=\{ins\.cta\.href\}/);
    expect(BANNER).toMatch(/min-h-\[44px\]/);
  });
  it("dismiss(localStorage) + return null self-gate 보존", () => {
    expect(BANNER).toMatch(/lab_insight_dismissed/);
    expect(BANNER).toMatch(/localStorage/);
    expect(BANNER).toMatch(/return null/);
    expect(BANNER).not.toMatch(/derived\.allEmpty/);
  });
  it("가짜 차트/목업 0", () => {
    expect(BANNER).not.toMatch(/MOCKUP|mockup|recharts|AreaChart/);
  });
});
