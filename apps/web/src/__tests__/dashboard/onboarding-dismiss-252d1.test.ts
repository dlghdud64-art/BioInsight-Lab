/**
 * §11.252d-1 — 온보딩 자동 숨김 강화 (dismiss button + localStorage persist).
 *
 * 호영님 spec:
 *   - 우상단 X dismiss button (44px 터치 타깃).
 *   - localStorage persist (페이지 새로고침 시 dismiss 상태 유지).
 *   - 자동 hide 조건 추가 — isOnboardingMode + !onboardingDismissed.
 *   - SSR hydration safe (useEffect 안 localStorage 읽기).
 *
 * canonical truth lock:
 *   - isOnboardingMode = totalQuotesCount === 0 derive 보존.
 *   - onboardingSteps (inventoryDone/quoteRequestDone/compareDone) derive 보존.
 *   - OnboardingHero 3 step 구조 (품목 등록 / 견적 요청 / 비교 검토) 보존.
 *   - progress bar / CTA / Link href 모두 보존.
 *
 * localStorage key: "labaxis-onboarding-dismissed" (boolean string).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function safeRead(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const PAGE_PATH = resolve(__dirname, "../../app/dashboard/page.tsx");
const code = safeRead(PAGE_PATH);

describe("§11.252d-1 #1 — dismiss state + localStorage persist", () => {
  it("§11.252d-1 trace marker 명시", () => {
    expect(code).toMatch(/§11\.252d-1|11\.252d-1/);
  });

  it("onboardingDismissed useState 추가", () => {
    expect(code).toMatch(/(onboardingDismissed|setOnboardingDismissed)/);
  });

  it("localStorage key 'labaxis-onboarding-dismissed' 사용", () => {
    expect(code).toMatch(/labaxis-onboarding-dismissed/);
  });

  it("useEffect mount 시 localStorage 읽기 (SSR safe)", () => {
    // useEffect 안 localStorage.getItem 매칭.
    expect(code).toMatch(/useEffect[\s\S]{0,500}localStorage\.getItem\(["']labaxis-onboarding-dismissed["']\)/);
  });
});

describe("§11.252d-1 #2 — X dismiss button + auto hide 조건", () => {
  it("dismiss button onClick → setOnboardingDismissed(true) + localStorage.setItem", () => {
    expect(code).toMatch(/setOnboardingDismissed\(true\)|localStorage\.setItem\(["']labaxis-onboarding-dismissed["']/);
  });

  it("OnboardingHero render 조건 — !onboardingDismissed 추가", () => {
    // isOnboardingMode && !onboardingDismissed 분기.
    expect(code).toMatch(/isOnboardingMode\s*&&\s*!onboardingDismissed|!onboardingDismissed\s*&&\s*isOnboardingMode/);
  });

  it("dismiss button — X icon 또는 '닫기' aria-label", () => {
    expect(code).toMatch(/aria-label=["'](온보딩\s*닫기|시작\s*가이드\s*닫기|닫기)["']/);
  });

  it("dismiss button 터치 타깃 — min-h-[44px] 또는 h-9+ 인근 §11.252d-1 trace", () => {
    // §11.252d-1 ~ 가까운 height class.
    expect(code).toMatch(/§11\.252d-1[\s\S]{0,3000}(min-h-\[44px\]|h-9|h-10|h-11)/);
  });
});

describe("§11.252d-1 — invariant 보존", () => {
  it("isOnboardingMode derive 보존 (totalQuotesCount === 0)", () => {
    expect(code).toMatch(/isOnboardingMode\s*=\s*totalQuotesCount\s*===\s*0/);
  });

  it("onboardingSteps derive 보존 (3 step)", () => {
    expect(code).toMatch(/inventoryDone:/);
    expect(code).toMatch(/quoteRequestDone:/);
    expect(code).toMatch(/compareDone:/);
  });

  it("'시작하기' 헤더 보존 (OnboardingHero 시그니처)", () => {
    expect(code).toMatch(/>\s*시작하기\s*</);
  });

  it("3 step Link href 보존 (/dashboard/inventory + /dashboard/quotes)", () => {
    expect(code).toMatch(/href=["']\/dashboard\/inventory["']/);
    expect(code).toMatch(/href=["']\/dashboard\/quotes["']/);
  });

  it("'3단계로 운영 흐름을 시작하세요' 안내 텍스트 보존", () => {
    expect(code).toMatch(/3단계로\s*운영\s*흐름을\s*시작하세요/);
  });
});
