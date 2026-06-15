/**
 * §11.252d-1 → §dashboard-shifan-adopt P2 진화 — OnboardingHero "시작하기 3단계" 폐지.
 *
 * 호영님 시안 전면 채택 결정(2026-06-15): 3단계 hero(품목 등록→견적 요청→비교 검토) +
 * dismiss button 은 NextStepBanner("다음 단계 추천", summary 가이드) + GlobalEmpty(빈 계정
 * 시작 CTA)로 대체. 따라서 §11.252d-1 의 hero/dismiss-button/3-step 가드는 stale →
 * "hero 폐지 + 가이드(NextStepBanner/GlobalEmpty) 보존"으로 진화(가이드 awareness 공백 0).
 *
 * 보존: isOnboardingMode derive(타 분기 사용) · onboardingDismissed state(빠른시작 hide 조건).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/page.tsx");
const code = safeRead(PAGE_PATH);

describe("§252d-1→shifan P2 — OnboardingHero 폐지", () => {
  it("'시작하기' 3단계 hero 제거(헤더·진행바·3 step grid 부재)", () => {
    expect(code).not.toMatch(/>\s*시작하기\s*</);
    expect(code).not.toMatch(/3단계로\s*운영\s*흐름을\s*시작하세요/);
    expect(code).not.toMatch(/onboardingSteps\.inventoryDone/);
  });

  it("dismissOnboarding(hero dismiss button) 제거", () => {
    expect(code).not.toMatch(/const dismissOnboarding =/);
  });
});

describe("§252d-1→shifan P2 — 가이드 보존(공백 0)", () => {
  it("NextStepBanner(다음 단계 추천) 배선 — hero 가이드 역할 흡수", () => {
    expect(code).toMatch(/<NextStepBanner/);
  });

  it("GlobalEmpty(빈 계정 시작 CTA) 배선", () => {
    expect(code).toMatch(/<GlobalEmpty\s*\/>/);
  });
});

describe("§252d-1 — invariant 보존", () => {
  it("isOnboardingMode derive 보존(타 분기 사용)", () => {
    expect(code).toMatch(/isOnboardingMode/);
  });

  it("onboardingDismissed state + localStorage persist 보존(빠른시작 hide 조건)", () => {
    expect(code).toMatch(/onboardingDismissed/);
    expect(code).toMatch(/labaxis-onboarding-dismissed/);
  });
});
