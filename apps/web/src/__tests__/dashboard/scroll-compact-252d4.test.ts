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

// §dashboard-shifan-adopt P2 진화 — OnboardingHero(border-blue-200 카드·3-step grid·dismiss
//   button) 폐지(시안 채택)→ NextStepBanner. hero padding/grid 가드는 stale. 페이지 wrapper
//   compact(#1)는 유지·유효.
describe("§252d-4→shifan P2 — OnboardingHero 폐지", () => {
  it("hero 카드/3-step grid/dismissOnboarding 제거", () => {
    expect(code).not.toMatch(/grid-cols-1\s+md:grid-cols-3/);
    expect(code).not.toMatch(/const dismissOnboarding =/);
  });

  it("NextStepBanner 대체 (레거시 빠른시작 zero 분기 폐지 — §dashboard-shifan-fidelity P-fid1)", () => {
    // §dashboard-shifan-fidelity P-fid1 — 레거시 3상태 패널(빠른시작 zero 분기) 폐지.
    //   진행 가이드는 NextStepBanner 단일. 빠른시작 조건부 분기(!isOnboardingMode||onboardingDismissed
    //   로 hide하던 카드) 자체가 부재. 모바일 압축(#1) 의도는 top wrapper 무변경으로 보존.
    expect(code).toMatch(/<NextStepBanner/);
    expect(code).not.toMatch(/>\s*빠른\s*시작\s*</); // 빠른시작 카드 부재(되살아나면 잡음)
  });

  it("onboardingDismissed state 보존(빠른시작 hide)", () => {
    expect(code).toMatch(/onboardingDismissed/);
  });
});
