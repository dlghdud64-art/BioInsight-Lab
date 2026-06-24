/**
 * §dashboard-shifan-adopt P4 — 시안 채택 트랙 capstone(최종 구조·반응형·정직성 lock)
 *
 * 정본: docs/plans/PLAN_dashboard-shifan-adopt.md (Phase 4 — 트랙 클로즈)
 *
 * 트랙 전체 불변식을 한 곳에 고정(향후 회귀 차단):
 *   (A) 시안 단일 흐름 순서 — StatLine→NextStep→ActionInbox→Pipeline→(예산&지출+빠른작업)→차트(하단).
 *   (B) 중단 2-col 반응형 — 예산집행률 카드 + 빠른작업(grid-cols-1 lg:grid-cols-2, 모바일 stack).
 *   (C) ★ 정직성 — 예산 카드 canonical(미설정 정직) + 카테고리 도넛 가짜분포 0.
 *   (D) 접근성/터치 — 예산 카드 터치 ≥44px, break-keep, aria-busy, §11.302 amber 금지.
 *   (E) 가드 보존 — §11.199b 로딩게이트 무수정 + summary 단일 진실 훅 단일 + ExecutiveSummary 제거.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const PAGE = read("src/app/dashboard/page.tsx");
const BUD = read("src/components/dashboard/budget-spend-card.tsx");
const CAT = read("src/components/dashboard/category-distribution-card.tsx");
const idx = (s: string): number => PAGE.indexOf(s);

// ── (A) 시안 단일 흐름 순서 ──────────────────────────────────────────────
describe("§dashboard-shifan-adopt P4 (A) — 시안 최종 순서", () => {
  it("StatLine→NextStep→ActionInbox→Pipeline", () => {
    expect(idx("<StatLine")).toBeLessThan(idx("<NextStepBanner"));
    expect(idx("<NextStepBanner")).toBeLessThan(idx("<ActionInbox"));
    expect(idx("<ActionInbox")).toBeLessThan(idx("<Pipeline"));
  });
  it("Pipeline→2-col(예산카드→지출트렌드) — §dashboard-home-redesign P1 (빠른작업 제거)", () => {
    expect(idx("<Pipeline")).toBeLessThan(idx("<BudgetSpendCard"));
    expect(idx("<BudgetSpendCard")).toBeLessThan(idx("<SpendTrendCard"));
    expect(PAGE).not.toMatch(/<OperatorQuickActions/);
  });
});

// ── (B) 중단 2-col 반응형 ────────────────────────────────────────────────
describe("§dashboard-shifan-adopt P4 (B) — 중단 2-col 반응형", () => {
  it("grid-cols-1 lg:grid-cols-2 (모바일 stack → 데스크탑 2-col): 예산&지출 + 지출트렌드 · 최근활동 풀폭", () => {
    // §dashboard-home-redesign P1 (호영님 시안) — 2-col = 예산&지출 ↔ 지출 트렌드(빠른작업 제거).
    //   최근활동은 2-col 아래 풀폭(가로 확대). 순서(예산→트렌드→최근활동) 보존.
    expect(PAGE).toMatch(/grid grid-cols-1 lg:grid-cols-2[\s\S]{0,260}<BudgetSpendCard[\s\S]{0,800}<SpendTrendCard/);
    expect(PAGE).toMatch(/<SpendTrendCard[\s\S]{0,700}<RecentActivityCard/);
  });
  it("예산 카드 summarySection 단일 진실 주입(신규 fetch 0)", () => {
    expect(PAGE).toMatch(/<BudgetSpendCard[\s\S]{0,120}state=\{summarySection\.state\}/);
  });
});

// ── (C) ★ 정직성 — 예산 canonical + 카테고리 가짜분포 0 ───────────────────
describe("§dashboard-shifan-adopt P4 (C) — 정직성 lock", () => {
  it("예산 카드 canonical summary.budget 바인딩", () => {
    expect(BUD).toMatch(/summary\?\.budget/);
    expect(BUD).toMatch(/summary\?\.derived\.budTone/);
  });
  it("예산 미설정 정직(가짜 집행률 0) — §B4: 설정 CTA는 NextStepBanner 단독(카드서 제거)", () => {
    expect(BUD).toMatch(/예산 미설정/);
    // §dashboard-shifan-polish B4 — 예산 설정 CTA 3곳→1곳: 배너 단독. 카드 내부 CTA 제거.
    expect(BUD).not.toMatch(/href="\/dashboard\/budget"/);
    expect(BUD).not.toMatch(/MOCKUP|mockup/);
  });
  it("카테고리 도넛 가짜분포 0 — mockup const/예시 overlay/grayscale 제거", () => {
    expect(CAT).not.toMatch(/const MOCKUP_CATEGORY/);
    expect(CAT).not.toMatch(/위 차트는 예시 데이터/);
    expect(CAT).not.toMatch(/grayscale/);
  });
  it("카테고리 정직 empty(차트 미렌더 + 안내 문구)", () => {
    expect(CAT).toMatch(/발주가 시작되면 카테고리 분포가 표시됩니다/);
    expect(CAT).toMatch(/border-dashed/);
  });
});

// ── (D) 접근성/터치/신호등 ───────────────────────────────────────────────
describe("§dashboard-shifan-adopt P4 (D) — 접근성·터치·신호등", () => {
  it("예산 카드 터치 ≥44px", () => {
    expect(BUD).toMatch(/min-h-\[44px\]/);
  });
  it("예산 카드 break-keep + 로딩 aria-busy", () => {
    expect(BUD).toMatch(/break-keep/);
    expect(BUD).toMatch(/aria-busy/);
  });
  it("§11.302 신호등 — amber/orange Tailwind 클래스 0(yellow)", () => {
    expect(BUD).not.toMatch(/-amber-|-orange-/);
  });
});

// ── (E) 가드 보존 ────────────────────────────────────────────────────────
describe("§dashboard-shifan-adopt P4 (E) — 가드 보존", () => {
  it("§11.199b 로딩게이트 무수정", () => {
    expect(PAGE).toMatch(/isStillLoading/);
    expect(PAGE).toMatch(/loadTimedOut/);
  });
  it("summary 단일 진실 훅 page 단일(중복 fetch 0)", () => {
    expect((PAGE.match(/useDashboardSection<DashboardSummary>/g) || []).length).toBe(1);
  });
  it("ExecutiveSummary 제거 + awareness(ActionInbox/NextStep/GlobalEmpty/Pipeline) 완비", () => {
    expect(PAGE).not.toMatch(/<ExecutiveSummarySection/);
    expect(PAGE).toMatch(/<ActionInbox/);
    expect(PAGE).toMatch(/<NextStepBanner/);
    expect(PAGE).toMatch(/<GlobalEmpty\s*\/>/);
    expect(PAGE).toMatch(/<Pipeline/);
  });
});
