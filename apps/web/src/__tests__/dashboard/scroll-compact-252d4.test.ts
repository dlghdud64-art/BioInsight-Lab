/**
 * §11.252d-4 — 대시보드 스크롤 40% 축소 sweep (모바일 padding/spacing 압축).
 *
 * 호영님 spec: 모바일 dashboard 전체 height ~40% 축소.
 * 전략: 모바일 한정 padding/spacing 압축 + 데스크탑 (≥md/lg) 기존 보존 (회귀 0).
 *
 * canonical truth lock:
 *   - top wrapper class 시그니처 (overflow-x-hidden + bg-sh + min-h-screen) 보존.
 *   - 데스크탑 (md:p-8 md:pt-7 md:space-y-6) 모두 보존.
 *   - OnboardingHero 카드 layout (border-blue-200 + rounded-xl + shadow-sm) 보존.
 *   - §11.252d-1 dismiss button + onboardingDismissed state 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/page.tsx");
const code = safeRead(PAGE_PATH);

describe("§11.252d-4 #1 — 모바일 top wrapper padding/spacing 압축", () => {
  it("§11.252d-4 trace marker 명시", () => {
    expect(code).toMatch(/§11\.252d-4|11\.252d-4/);
  });

  it("모바일 space-y-3 또는 space-y-4 (기존 space-y-5 압축)", () => {
    // top wrapper 안 모바일 space-y-(3|4) + md:space-y-6 분기.
    expect(code).toMatch(/space-y-(3|4)\s+md:space-y-6/);
  });

  it("모바일 p-3 또는 p-4 + md:p-8 보존 (데스크탑 회귀 0)", () => {
    // 데스크탑 md:p-8 보존 필수.
    expect(code).toMatch(/p-(3|4)[\s\S]{0,200}md:p-8/);
  });

  it("overflow-x-hidden + bg-sh + min-h-screen 시그니처 보존", () => {
    expect(code).toMatch(/overflow-x-hidden/);
    expect(code).toMatch(/bg-sh/);
    expect(code).toMatch(/min-h-screen/);
  });
});

describe("§11.252d-4 #2 — OnboardingHero 모바일 padding 압축", () => {
  it("OnboardingHero 카드 모바일 p-4 또는 p-5 + md:p-6 보존", () => {
    // border-blue-200 ~ rounded-xl ~ p-4/5 md:p-6.
    expect(code).toMatch(/border-blue-200[\s\S]{0,200}p-(4|5)\s+md:p-6|border-blue-200[\s\S]{0,200}p-4\s+md:p-6/);
  });

  it("OnboardingHero 헤더 영역 mb-3 또는 mb-4 (모바일 축소)", () => {
    // §11.252d-4 trace 인근 mb-3/4.
    expect(code).toMatch(/§11\.252d-4[\s\S]{0,5000}mb-(3|4)\s+md:mb-5|mb-(3|4)\s+md:mb-5[\s\S]{0,5000}§11\.252d-4/);
  });
});

describe("§11.252d-4 — invariant 보존", () => {
  it("OnboardingHero border-blue-200 + rounded-xl + shadow-sm 보존", () => {
    expect(code).toMatch(/border-blue-200/);
    expect(code).toMatch(/rounded-xl/);
    expect(code).toMatch(/shadow-sm/);
  });

  it("§11.252d-1 dismiss button + onboardingDismissed state 보존", () => {
    expect(code).toMatch(/onboardingDismissed/);
    expect(code).toMatch(/dismissOnboarding/);
  });

  it("§11.252d-2 빠른 시작 분기 보존", () => {
    expect(code).toMatch(/!isOnboardingMode\s*\|\|\s*onboardingDismissed/);
  });

  it("OnboardingHero 3 step grid 보존", () => {
    expect(code).toMatch(/grid-cols-1\s+md:grid-cols-3/);
  });
});
