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
/**
 * §main-dashboard-p0-honesty 2026-09-18 — 고정 폭 창 폐기.
 *   (구) `lg:grid-cols-2[\s\S]{0,260}<BudgetSpendCard[\s\S]{0,800}<SpendTrendCard`
 *        → 사이에 주석 몇 줄만 들어가도 계약을 지키는 구현이 RED 가 된다.
 *          이 저장소에서 같은 형태가 이미 3회 기록됐다(CLAUDE.md 정규식 4원칙 ⑤).
 *   (신) **등장 순서**로 단언한다. 길이에 좌우되지 않고 명제(좌 예산 → 우 트렌드 → 최근활동)는 그대로다.
 */
function inOrder(src: string, ...tokens: string[]): boolean {
  let at = -1;
  for (const t of tokens) {
    const i = src.indexOf(t, at + 1);
    if (i < 0) return false;
    at = i;
  }
  return true;
}


// ── (A) 중단 2-col + 차트 하단 ───────────────────────────────────────────
describe("§dashboard-shifan-adopt P3b (A) — 중단 2-col 재구성", () => {
  it("BudgetSpendCard import + 렌더", () => {
    expect(PAGE).toMatch(/import \{ BudgetSpendCard \} from "@\/components\/dashboard\/budget-spend-card"/);
    expect(PAGE).toMatch(/<BudgetSpendCard/);
  });
  it("2-col: BudgetSpendCard(좌) → SpendTrendCard(우) + RecentActivity 풀폭 하단", () => {
    // §dashboard-home-redesign P1 (호영님 시안) — 빠른작업 제거, 2-col = 예산&지출 ↔ 지출 트렌드.
    //   §dashboard-shifan-adopt P3b / §rightcol-rebalance(2-col=예산+빠른작업, 트렌드 하단) 역전.
    //   최근활동은 2-col 뒤 풀폭 유지(순서: 예산→트렌드→최근활동).
    // 핸드오프 §1-5(호영님 2026-09-17, 판정 2026-09-18): 우측 = 지출 트렌드 + 최근 활동 **세로 2장**.
    //   구 계약("최근활동은 2-col 뒤 풀폭")을 이 지시가 덮는다. 순서 명제는 그대로 유지된다.
    expect(inOrder(PAGE, "lg:grid-cols-2", "<BudgetSpendCard", "<SpendTrendCard", "<RecentActivityCard")).toBe(true);
    // 우측 2장이 좌측 카드 높이에 맞춘다(§1-5 flex:1).
    expect(PAGE).toMatch(/items-stretch/);
    expect(PAGE).toMatch(/flex-1 flex flex-col/);
  });
  it("BudgetSpendCard = summarySection 단일 진실 주입(신규 fetch 0)", () => {
    expect(PAGE).toMatch(/<BudgetSpendCard[\s\S]{0,120}state=\{summarySection\.state\}/);
  });
  it("빠른작업(OperatorQuickActions) page 렌더 제거 — 동선 Pipeline 흡수 + 2-col 순서", () => {
    // §dashboard-home-redesign P1 — page 에서 빠른작업 카드 제거(컴포넌트 파일은 dormant 보존).
    expect(PAGE).not.toMatch(/<OperatorQuickActions/);
    expect(PAGE.indexOf("<BudgetSpendCard")).toBeLessThan(PAGE.indexOf("<SpendTrendCard"));
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
    // §main-dashboard-p0-honesty 2026-09-18 — 층위 재조준.
    //   (구) `isSet` · `집행` · `예산 미설정` 이 40자 안에 붙어 있는지 = 한 줄 삼항일 때만 성립하는 근접 검사.
    //   (신) 명제 그대로: **미설정 분기 안에 집행률이 존재하지 않는다.** 분기가 블록으로 갈라져도 성립한다.
    //   더 강한 단언이다 — 구 판본은 "집행" 문자열이 같은 줄에 있기만 하면 통과했다.
    const i = BUD.indexOf("!isSet");
    expect(i, "미설정 분기 없음").toBeGreaterThan(-1);
    let depth = 0;
    let block = "";
    const start = BUD.indexOf("{", i);
    for (let k = start; k < BUD.length; k++) {
      if (BUD[k] === "{") depth++;
      else if (BUD[k] === "}") {
        depth--;
        if (depth === 0) {
          block = BUD.slice(start, k + 1);
          break;
        }
      }
    }
    expect(block).not.toMatch(/집행/);
    expect(block).not.toMatch(/usageRate/);
  });
  it("§dashboard-shifan-polish B4 — 예산 설정 CTA는 카드서 제거, NextStepBanner 단독(중복 3→1)", () => {
    // 빈 계정 예산 CTA 3곳→1곳: 배너 단독 소유. 카드는 정직 상태만(설정 동선 미보유, dead button 0).
    //   배너의 canonical /dashboard/budget 동선은 nextstep-wire-shifan-p2(#예산 설정)에서 GREEN.
    // §main-dashboard-p0-honesty 2026-09-18 — 범위 재조준(호영님 판정).
    //   원 결정의 취지는 "**빈 계정**에서 예산 CTA 3곳 → 배너 1곳" 이다. 파일 전체 금지는 그 취지보다 넓었다.
    //   핸드오프 §5 는 운영 상태 카드에 `예산 관리 ›` 를 명시한다(설정 뒤의 관리 동선 = 다른 것).
    //   → 미설정 분기 안에서만 금지한다. 취지는 그대로, 글자만 좁힌다.
    const i = BUD.indexOf("!isSet");
    expect(i, "미설정 분기 없음").toBeGreaterThan(-1);
    let d = 0, block = "";
    const st = BUD.indexOf("{", i);
    for (let k = st; k < BUD.length; k++) {
      if (BUD[k] === "{") d++;
      else if (BUD[k] === "}") { d--; if (d === 0) { block = BUD.slice(st, k + 1); break; } }
    }
    expect(block).not.toMatch(/href="\/dashboard\/budget"/);
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
