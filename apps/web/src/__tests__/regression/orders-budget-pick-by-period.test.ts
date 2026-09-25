/**
 * §orders-budget-pick-by-period (호영님 판정 2026-09-25)
 *
 * 명제: budgetId 없이 들어온 발주는 **기간이 오늘을 포함하는 예산**에 예약된다.
 *   대시보드(§budget-pick-by-period)와 같은 함수(pickBudgetCoveringNow)를 쓴다.
 *   (구) `orderBy: { yearMonth: "desc" }` — yearMonth 는 만든 달이라 기간과 무관한 예산이 뽑혔다.
 *
 * 자기 한계: 라우트 전체 실행은 orders-budget-deduction.behavior 가 든다(기간을 넓게 준 fixture).
 *   여기는 선택 규칙의 행동과 배선 형태만 본다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { stripComments } from "../_helpers/em-dash-scan";
import { pickBudgetCoveringNow } from "@/lib/budget/budget-period";

const ROUTE = join(__dirname, "..", "..", "..", "src/app/api/orders/route.ts");
const code = () => stripComments(readFileSync(ROUTE, "utf8"));

describe("§orders-budget-pick-by-period", () => {
  it("① 행동 · 늦게 만든 월 예산이 아니라 오늘을 포함하는 운영 예산을 고른다", () => {
    const halfYear = { id: "half", yearMonth: "2026-08", description: "[하반기] | period:2026-08-18~2026-12-30", createdAt: new Date("2026-08-18T00:00:00Z") };
    const septOnly = { id: "sept", yearMonth: "2026-09", description: null, createdAt: new Date("2026-09-20T00:00:00Z") };
    // 10월: 9월 예산(yearMonth 최신)은 기간 밖 → 하반기 예산
    expect(pickBudgetCoveringNow([septOnly, halfYear], new Date("2026-10-05T12:00:00"))?.id).toBe("half");
    // 모두 기간 밖이면 null → 라우트는 NO_BUDGET
    expect(pickBudgetCoveringNow([septOnly, halfYear], new Date("2027-01-02T12:00:00"))).toBeNull();
  });

  it("② 배선 · budgetId 없는 경로가 pickBudgetCoveringNow 를 쓴다 · yearMonth 정렬 0", () => {
    const src = code();
    expect(src).toMatch(/import \{[^}]*\bpickBudgetCoveringNow\b[^}]*\} from "@\/lib\/budget\/budget-period"/);
    const i = src.indexOf("const budget = budgetId");
    const decl = src.slice(i, src.indexOf("if (!budget)", i));
    expect(decl).toMatch(/pickBudgetCoveringNow</);
    expect(decl).toMatch(/tx\.budget\.findMany\(/);
    expect(decl).not.toMatch(/yearMonth:\s*"desc"/);
    expect(decl).not.toMatch(/tx\.budget\.findFirst\(/);
  });
});
