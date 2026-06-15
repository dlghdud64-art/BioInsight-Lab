/**
 * §dashboard-shifan-adopt P2 — NextStepBanner("다음 단계 추천") + hero 폐지 sentinel
 *
 * 정본: docs/plans/PLAN_dashboard-shifan-adopt.md (P2)
 *
 * 검증:
 *   (A) NextStepBanner 컴포넌트 — summary 소스·다크·dismiss·allEmpty self-gate·CTA·no-op 0.
 *   (B) page 배선 — NextStepBanner + GlobalEmpty(allEmpty 게이트 단순화).
 *   (C) "시작하기 3단계" hero 폐지 + cluster 정리(onboardingSteps/dismissOnboarding).
 *   (D) 무회귀 — StatLine·Pipeline·ActionInbox·ExecutiveSummary·stats 로딩게이트 보존.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const PAGE = read("src/app/dashboard/page.tsx");
const BANNER = read("src/components/dashboard/next-step-banner.tsx");

// ── (A) NextStepBanner 컴포넌트 ─────────────────────────────────────────
describe("§dashboard-shifan-adopt P2 (A) — NextStepBanner 컴포넌트", () => {
  it("summary 소스 + '다음 단계 추천' + 다크 gradient", () => {
    expect(BANNER).toMatch(/from "@\/lib\/dashboard\/summary-derive"/);
    expect(BANNER).toMatch(/다음 단계 추천/);
    expect(BANNER).toMatch(/bg-gradient-to-br/);
  });
  it("allEmpty self-gate(중복 0) + dismiss(sessionStorage)", () => {
    expect(BANNER).toMatch(/derived\.allEmpty/);
    expect(BANNER).toMatch(/return null/);
    expect(BANNER).toMatch(/sessionStorage/);
  });
  it("예산 미설정 가이드 CTA(예산 설정) + 터치 44px(no-op 0)", () => {
    expect(BANNER).toMatch(/budget\.isSet/);
    expect(BANNER).toMatch(/예산 설정/);
    expect(BANNER).toMatch(/href=\{cta\.href\}/);
    expect(BANNER).toMatch(/min-h-\[44px\]/);
  });
  it("가짜 차트/목업 0", () => {
    expect(BANNER).not.toMatch(/MOCKUP|mockup|recharts|AreaChart/);
  });
});

// ── (B) page 배선 ───────────────────────────────────────────────────────
describe("§dashboard-shifan-adopt P2 (B) — page 배선", () => {
  it("NextStepBanner import + 렌더(summary 주입)", () => {
    expect(PAGE).toMatch(/import \{ NextStepBanner \} from "@\/components\/dashboard\/next-step-banner"/);
    expect(PAGE).toMatch(/<NextStepBanner summary=\{summarySection\.data\}/);
  });
  it("GlobalEmpty 게이트 단순화(allEmpty 노출, hero 상호배타 게이트 제거)", () => {
    expect(PAGE).toMatch(/summarySection\.state === "empty" && <GlobalEmpty/);
  });
});

// ── (C) hero 폐지 + cluster 정리 ────────────────────────────────────────
describe("§dashboard-shifan-adopt P2 (C) — 시작하기 hero 폐지", () => {
  it("'시작하기' 3단계 hero 제거(헤더·3 step·dismiss button)", () => {
    expect(PAGE).not.toMatch(/>\s*시작하기\s*</);
    expect(PAGE).not.toMatch(/3단계로\s*운영\s*흐름을\s*시작하세요/);
    expect(PAGE).not.toMatch(/onboardingSteps\.inventoryDone/);
    expect(PAGE).not.toMatch(/const dismissOnboarding =/);
    expect(PAGE).not.toMatch(/const onboardingSteps =/);
  });
  it("onboardingDismissed state는 보존(빠른시작 hide 조건 사용)", () => {
    expect(PAGE).toMatch(/onboardingDismissed/);
  });
});

// ── (D) 무회귀 ──────────────────────────────────────────────────────────
describe("§dashboard-shifan-adopt P2 (D) — 무회귀", () => {
  it("StatLine·Pipeline·ActionInbox·ExecutiveSummary 보존", () => {
    expect(PAGE).toMatch(/<StatLine/);
    expect(PAGE).toMatch(/<Pipeline/);
    expect(PAGE).toMatch(/<ActionInbox/);
    expect(PAGE).toMatch(/<ExecutiveSummarySection/);
  });
  it("§11.199b stats useQuery + 로딩 게이트 보존", () => {
    expect(PAGE).toMatch(/queryKey:\s*\["dashboard-stats"\]/);
    expect(PAGE).toMatch(/isStillLoading/);
    expect(PAGE).toMatch(/loadTimedOut/);
  });
});
