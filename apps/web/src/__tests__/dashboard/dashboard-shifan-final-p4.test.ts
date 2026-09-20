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
// §main-dashboard-p0-honesty P1-6 — 블록 창 공용화.
import { blockAfter } from "../_helpers/block-window";
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
    // §main-dashboard-p0-honesty 2026-09-18 — 고정 폭 창 → 등장 순서(p3b 와 같은 재조준).
    //   핸드오프 §1-5: 우측 = 트렌드 + 최근활동 세로 2장. 구 "최근활동 풀폭" 을 덮는다.
    expect(PAGE).toMatch(/grid grid-cols-1 lg:grid-cols-2/);
    const order = ["lg:grid-cols-2", "<BudgetSpendCard", "<SpendTrendCard", "<RecentActivityCard"];
    let at = -1;
    for (const t of order) {
      const i = PAGE.indexOf(t, at + 1);
      expect(i, `순서 위반: ${t}`).toBeGreaterThan(at);
      at = i;
    }
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
    // §main-dashboard-p0-honesty 2026-09-18 — 층위 재조준 (p3b:113 의 **쌍둥이 단언**).
    //   ⚠️ 이 줄을 p3b 와 함께 고치지 않아 재게이트에서 1건 RED 로 남았다.
    //      형태를 하나 고치면 같은 창의 형제 슬롯을 전수 훑는다(CLAUDE.md, 이 저장소 반복 형태).
    //
    //   (구) `toMatch(/예산 미설정/)` — 구현은 UI 문구를 `설정 전` 으로 바꿨는데 **주석의
    //        "초기 상태(예산 미설정)" 이 대신 매칭**해 통과하고 있었다(4원칙 ④ 대체 매칭).
    //        바이트가 우연히 맞은 것이지 명제가 지켜져서 통과한 게 아니다.
    //   (신) 명제로 잰다: **미설정 분기가 정직 표기를 갖고, 집행률을 만들지 않는다.**
    //   (구) CTA 금지가 파일 전체였다 — 핸드오프 §5 는 운영 분기에 `예산 관리 ›` 를 명시한다.
    //        원 취지(빈 계정 예산 CTA 1곳)대로 **미설정 분기 한정**으로 좁힌다.
    expect(BUD.indexOf("!isSet"), "미설정 분기 없음").toBeGreaterThan(-1);
    const block = blockAfter(BUD, "!isSet");
    expect(block).toMatch(/설정 전/);
    expect(block).not.toMatch(/집행/);
    expect(block).not.toMatch(/usageRate/);
    expect(block).not.toMatch(/href="\/dashboard\/budget"/);
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
