/**
 * §order-no-budget-message (대기열 ⑫) — 발주 NO_BUDGET 문구 오진 정정
 *
 * 실측 2026-08-18 프로덕션: 잔액 ₩4,150,000 을 표시하는 화면에서 발주하면
 * "등록된 예산이 없습니다" 가 떴다. 예산은 있고 **종류가 달라서** 못 찾은 것이다.
 *
 * ⑪ 판정(호영님 2026-08-22): canonical 예산 = Budget · (나) 예약 도입.
 * P3(PLAN_order-budget-reservation)가 발주 경로를 Budget+예약으로 재배선했다 —
 * 이제 예산 관리 화면의 예산이 발주에 **실제로 연결된다.** 문구도 그 사실을 따른다.
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

  it("어느 예산이 없는지 지목한다 — 발주 예산 축 (P3 재조준)", () => {
    expect(read(ROUTE)).toMatch(/NO_BUDGET[\s\S]{0,400}?발주에 사용할 예산이 없습니다/);
  });

  it("⛔ '아직 발주에 연결되지 않습니다' 은퇴 (P3) — 재배선 후엔 그 문구가 거짓이다", () => {
    /* 옛 축: "예산 관리 화면에서 만든 예산은 아직 발주에 연결되지 않습니다" 를 요구.
     * ⑫ 정정 시점(P0 이전)엔 사실이었으나 P3 재배선으로 Budget 이 발주에 연결됐다 —
     * 옛 단언을 남기면 sentinel 이 거짓 문구를 강제한다(lab-toast #b45821 과 같은 형태).
     * 역방향 잠금: 그 문구의 재유입을 금지한다. */
    const code = stripComments(read(ROUTE));
    expect(code).not.toMatch(/아직 발주에 연결되지 않습니다/);
  });

  it("만드는 곳을 실제 화면 이름으로 지목한다 — 예산 관리 (P3 재조준)", () => {
    /* 라벨은 실물과 대조한다 — budget/page.tsx h1 "예산 관리" */
    expect(read(ROUTE)).toMatch(/NO_BUDGET[\s\S]{0,400}?예산 관리에서 예산을 만들어 주세요/);
    expect(read("src/app/dashboard/budget/page.tsx")).toMatch(/예산 관리<\/h1>/);
  });

  it("구분자는 가운뎃점이다 — em dash 0 (CLAUDE.md 전역 조항)", () => {
    const m = read(ROUTE).match(/message:\s*\n?\s*"발주에 사용할 예산[^"]*"/);
    expect(m).not.toBeNull();
    expect(m![0]).not.toMatch(/—/);
    expect(m![0]).toMatch(/·/);
  });
});

describe("§order-no-budget-message — 회귀 0", () => {
  it("⛔ tripwire 승계 2차 (P3 · 2026-08-22) — 재배선 사실을 잠근다", () => {
    /* 이력: ① tx.budget./tx.categoryBudget. 유입 금지 tripwire (⑪ 판정 전 조용한 통합 방지)
     *       ② P0 에서 명시 해제 — 판정 문서 잠금 + 현행 사실(tx.userBudget.findUnique) 유지
     *       ③ 본 커밋(P3): 재배선으로 현행 사실이 바뀌었다 — 잠금도 사실을 따라간다.
     * 판정 문서 잠금은 유지. 현행 사실 축을 역전: 발주 경로는 Budget 조회 + 예약 기록이고
     * UserBudget 접근은 0 이다 (쓰기 소거 — 갈래 (나) 이행 완료). */
    const plan = read("../../docs/plans/PLAN_order-budget-reservation.md");
    expect(plan).toMatch(/canonical 예산 = Budget/);
    expect(plan).toMatch(/\(나\) 예약/);
    const code = stripComments(read(ROUTE));
    expect(code).toMatch(/tx\.budget\.findUnique/);
    expect(code).not.toMatch(/tx\.userBudget\./);
    expect(code).not.toMatch(/userBudgetTransaction/);
  });

  it("INSUFFICIENT_BUDGET 는 불변 — 잔액 부족은 다른 사유다", () => {
    expect(read(ROUTE)).toMatch(/INSUFFICIENT_BUDGET:\s*\{\s*\n?\s*message:\s*"예산이 부족합니다\. 잔액을 확인해주세요\."/);
  });

  it("throw 지점은 budget 미발견 그대로다", () => {
    expect(read(ROUTE)).toMatch(/if \(!budget\) \{\s*\n\s*throw new Error\("NO_BUDGET"\);/);
  });
});
