/**
 * §dashboard-shifan-adopt P3b — 중단 2-col 재구성 + 정직성 코어 sentinel
 *
 * 정본: docs/plans/PLAN_dashboard-shifan-adopt.md (Phase 3 / P3b)
 *
 * 검증(격리 readFileSync+regex → operator 실 vitest):
 *   (A) 중단 2-col: BudgetSpendCard(좌) + OperatorQuickActions(우). 차트는 하단 이동.
 *   (B) BudgetSpendCard 정직성: canonical summary.budget 바인딩, 미설정→"미설정"(가짜 집행률 0),
 *       CTA /dashboard/budget, 신호등(amber 금지), mock 0.
 *   (C) ★ 카테고리 도넛 mockup 제거(정직성 코어): MOCKUP/예시/grayscale/overlay 0 + 정직 empty.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const PAGE = read("src/app/dashboard/page.tsx");
const BUD = read("src/components/dashboard/budget-spend-card.tsx");
const CAT = read("src/components/dashboard/category-distribution-card.tsx");

// ── (A) 중단 2-col + 차트 하단 ───────────────────────────────────────────
describe("§dashboard-shifan-adopt P3b (A) — 중단 2-col 재구성", () => {
  it("BudgetSpendCard import + 렌더", () => {
    expect(PAGE).toMatch(/import \{ BudgetSpendCard \} from "@\/components\/dashboard\/budget-spend-card"/);
    expect(PAGE).toMatch(/<BudgetSpendCard/);
  });
  it("2-col: BudgetSpendCard(좌) → OperatorQuickActions(우 단독) + RecentActivity 풀폭 하단", () => {
    // §dashboard-rightcol-rebalance(호영님) — 우측 side-col 폐지: 우측 = 빠른작업 단독(세로 1열),
    //   최근활동은 2-col 아래 풀폭으로 이동(가로 확대). 순서(예산→빠른작업→최근활동) 보존.
    expect(PAGE).toMatch(/lg:grid-cols-2[\s\S]{0,240}<BudgetSpendCard[\s\S]{0,580}<OperatorQuickActions/);
    expect(PAGE).toMatch(/<OperatorQuickActions[\s\S]{0,460}<RecentActivityCard/); // 순서 보존(풀폭 이동, 거리 incidental)
  });
  it("BudgetSpendCard = summarySection 단일 진실 주입(신규 fetch 0)", () => {
    expect(PAGE).toMatch(/<BudgetSpendCard[\s\S]{0,120}state=\{summarySection\.state\}/);
  });
  it("지출 트렌드/카테고리 차트는 하단(빠른작업 뒤)", () => {
    expect(PAGE.indexOf("<OperatorQuickActions")).toBeLessThan(PAGE.indexOf("<SpendTrendCard"));
  });
});

// ── (B) BudgetSpendCard 정직성 ───────────────────────────────────────────
describe("§dashboard-shifan-adopt P3b (B) — 예산 카드 정직(canonical 바인딩)", () => {
  it("canonical summary.budget 바인딩(가짜 데이터 0)", () => {
    expect(BUD).toMatch(/summary\?\.budget/);
    expect(BUD).toMatch(/budget\?\.isSet/);
    expect(BUD).toMatch(/budget\?\.usageRate/);
    expect(BUD).toMatch(/summary\?\.derived\.budTone/);
  });
  it("예산 미설정 정직 — 가짜 집행률 금지(isSet 게이트)", () => {
    expect(BUD).toMatch(/isSet[\s\S]{0,40}집행[\s\S]{0,40}예산 미설정/);
  });
  it("§dashboard-shifan-polish B4 — 예산 설정 CTA는 카드서 제거, NextStepBanner 단독(중복 3→1)", () => {
    // 빈 계정 예산 CTA 3곳→1곳: 배너 단독 소유. 카드는 정직 상태만(설정 동선 미보유, dead button 0).
    //   배너의 canonical /dashboard/budget 동선은 nextstep-wire-shifan-p2(#예산 설정)에서 GREEN.
    expect(BUD).not.toMatch(/href="\/dashboard\/budget"/);
  });
  it("mock/하드코딩 분포 0", () => {
    expect(BUD).not.toMatch(/MOCKUP|mockup/);
    expect(BUD).not.toMatch(/4_800_000|2_900_000|71_600_000/);
  });
  it("§11.302 신호등 — amber/orange Tailwind 클래스 금지(yellow)", () => {
    expect(BUD).not.toMatch(/-amber-|-orange-/);
  });
});

// ── (C) ★ 카테고리 도넛 mockup 제거 — 정직성 코어 ─────────────────────────
describe("§dashboard-shifan-adopt P3b (C) — 카테고리 mockup 제거(정직성 코어)", () => {
  it("MOCKUP_CATEGORY_DATA const 선언 제거", () => {
    expect(CAT).not.toMatch(/const MOCKUP_CATEGORY/);
  });
  it("'위 차트는 예시 데이터' overlay 캡션 제거", () => {
    expect(CAT).not.toMatch(/위 차트는 예시 데이터/);
  });
  it("grayscale/backdrop-blur mockup overlay 0", () => {
    expect(CAT).not.toMatch(/grayscale/);
    expect(CAT).not.toMatch(/backdrop-blur/);
  });
  it("빈 분기 = 정직 compact empty(dashed box + 안내 문구)", () => {
    expect(CAT).toMatch(/발주가 시작되면 카테고리 분포가 표시됩니다/);
    expect(CAT).toMatch(/border-dashed/);
  });
  it("실데이터 분기 recharts 보존(import 유지)", () => {
    expect(CAT).toMatch(/from "recharts"/);
  });
});
