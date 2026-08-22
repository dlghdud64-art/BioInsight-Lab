/**
 * §order-no-budget-message (대기열 ⑫) — 발주 NO_BUDGET 문구 오진 정정
 *
 * 실측 2026-08-18 프로덕션: 잔액 ₩4,150,000 을 표시하는 화면에서 발주하면
 * "등록된 예산이 없습니다" 가 떴다. 예산은 있고 **종류가 달라서** 못 찾은 것이다.
 *
 * 2026-08-19 실측 — 예산 모델은 셋이다:
 *   Budget          예산 관리 화면 · PurchaseRecord 합계 파생
 *   UserBudget      연구비 관리 화면 · 잔액 컬럼 직접 차감   ← 이 경로가 유일하게 보는 것
 *   CategoryBudget  화면 없음 · BudgetEvent 예약/해제 원장
 *
 * 🛑 이 sentinel 은 **모델 통합(⑪)을 잠그지 않는다.** ⑪ 은 판정 대기이고
 *    이건 판정과 무관하게 틀린 문구만 고친다. 통합이 결정되면 이 문구도 함께 바뀐다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const ROUTE = "src/app/api/orders/route.ts";

/* 부정 단언은 주석 제거본에 건다 — 문구를 설명하는 주석이 대신 매칭되면
 * 구현자가 주석만 지워도 통과한다(CLAUDE.md §부정 단언). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("§order-no-budget-message — 문구가 사실과 반대이면 안 된다", () => {
  it("🛑 '등록된 예산이 없습니다' 단정을 쓰지 않는다", () => {
    const code = stripComments(read(ROUTE));
    expect(code).not.toMatch(/등록된 예산이 없습니다/);
  });

  it("어느 예산이 없는지 지목한다 — 연구비 축", () => {
    expect(read(ROUTE)).toMatch(/NO_BUDGET[\s\S]{0,400}?발주에 사용할 연구비 예산이 없습니다/);
  });

  it("다른 종류의 예산이 있을 수 있음을 문구가 인정한다", () => {
    expect(read(ROUTE)).toMatch(/NO_BUDGET[\s\S]{0,400}?예산 관리 화면에서 만든 예산은 아직 발주에 연결되지 않습니다/);
  });

  it("만드는 곳을 실제 화면 이름으로 지목한다", () => {
    /* 라벨은 실물과 대조한다 — grants/page.tsx title="연구비 관리" */
    expect(read(ROUTE)).toMatch(/NO_BUDGET[\s\S]{0,400}?연구비 관리에서 예산을 만들어 주세요/);
    expect(read("src/app/dashboard/grants/page.tsx")).toMatch(/title="연구비 관리"/);
  });

  it("구분자는 가운뎃점이다 — em dash 0 (CLAUDE.md 전역 조항)", () => {
    const m = read(ROUTE).match(/message:\s*\n?\s*"발주에 사용할 연구비[^"]*"/);
    expect(m).not.toBeNull();
    expect(m![0]).not.toMatch(/—/);
    expect(m![0]).toMatch(/·/);
  });
});

describe("§order-no-budget-message — 회귀 0", () => {
  it("⛔ tripwire 명시 해제 (2026-08-22) — ⑪ 판정으로 임무 종료 · 판정 문서를 잠근다", () => {
    /* 옛 축: tx.budget./tx.categoryBudget. 유입 금지 — ⑪ 판정 전 조용한 모델 통합을 막는
     * tripwire 였다 (HANDOFF §4: "우회하거나 조용히 편집하면 안 된다 · 해제 커밋에 갈래와 근거").
     * 판정(호영님 2026-08-22): canonical 예산 = Budget · (나) 예약(reserved) 도입.
     * 근거 실측: UserBudget 프로덕션 실행 0 · 읽기 축 기통합 · 쓰기 축만 낙오(NO_BUDGET 오진).
     * → 이 커밋으로 명시 해제. 대체 잠금: 판정 문서가 그 갈래를 담은 채 존재해야 한다.
     * P3(배선)에서 역방향 재조준 예정 — Budget 합류는 예약 서비스(BudgetEvent) 경유만. */
    const plan = read("../../docs/plans/PLAN_order-budget-reservation.md");
    expect(plan).toMatch(/canonical 예산 = Budget/);
    expect(plan).toMatch(/\(나\) 예약/);
    /* 해제 시점의 현행 사실은 유지 — 아직 UserBudget 경로다 (P3 전까지 유효) */
    expect(read(ROUTE)).toMatch(/tx\.userBudget\.findUnique/);
  });

  it("INSUFFICIENT_BUDGET 는 불변 — 잔액 부족은 다른 사유다", () => {
    expect(read(ROUTE)).toMatch(/INSUFFICIENT_BUDGET:\s*\{\s*\n?\s*message:\s*"예산이 부족합니다\. 잔액을 확인해주세요\."/);
  });

  it("throw 지점은 budget 미발견 그대로다", () => {
    expect(read(ROUTE)).toMatch(/if \(!budget\) \{\s*\n\s*throw new Error\("NO_BUDGET"\);/);
  });
});
