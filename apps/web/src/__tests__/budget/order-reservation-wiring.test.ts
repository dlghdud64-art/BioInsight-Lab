/**
 * §order-budget-reservation P3 — 배선 sentinel (PLAN_order-budget-reservation)
 *
 * 러너가 DB 없이 검증 가능한 소스 계약으로 배선 사실을 잠근다:
 *   ① /api/orders POST = Budget 조회 + 예약 검증 + ORDER_RESERVED 기록 (차감 0)
 *   ② /api/orders/[id] PATCH = CANCELLED 전이 시 예약 해제 (void→release · 멱등)
 *   ③ /api/user-budgets = Budget 잔액에 활성 예약 반영 + ⑤ resolveBudgetPeriod 창
 *   ④ /api/budgets/[id] = usage 합산 창도 resolveBudgetPeriod (⑤ 배선)
 *   ⑤ 발주 다이얼로그 = 연구비(UserBudget) 행은 선택 불가 표기 · 접수 후 잔액 invalidate
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ORDERS = "src/app/api/orders/route.ts";
const ORDER_ID = "src/app/api/orders/[id]/route.ts";
const USER_BUDGETS = "src/app/api/user-budgets/route.ts";
const BUDGET_ID = "src/app/api/budgets/[id]/route.ts";
const QUOTE_PAGE = "src/app/quotes/[id]/page.tsx";

describe("① /api/orders — Budget 예약 경로", () => {
  it("예약 코어를 소비한다 — validateReservation · buildReservationEvent · activeReservedAmount", () => {
    const src = read(ORDERS);
    expect(src).toMatch(/from "@\/lib\/budget\/order-reservation"/);
    expect(src).toMatch(/validateReservation\(/);
    expect(src).toMatch(/buildReservationEvent\(/);
    expect(src).toMatch(/activeReservedAmount\(/);
  });

  it("예약은 BudgetEvent 원장에 budgetId 를 달고 기록된다", () => {
    const src = read(ORDERS);
    expect(src).toMatch(/tx\.budgetEvent\.create/);
    expect(src).toMatch(/budgetId:\s*budget\.id/);
  });

  it("잔액 창은 resolveBudgetPeriod — ⑤ 교정 배선", () => {
    expect(read(ORDERS)).toMatch(/resolveBudgetPeriod\(/);
  });

  it("동시 예약 직렬화 — Budget FOR UPDATE (구 UserBudget 패턴 승계)", () => {
    expect(read(ORDERS)).toMatch(/FROM "Budget" WHERE id = \$\{budget\.id\} FOR UPDATE/);
  });

  it("🛑 confirm 창작 금지 — 이 경로는 reserve 만 기록한다 (지출 확정은 PurchaseRecord 소관)", () => {
    /* ORDER_CONFIRMED 상수는 잔액 계산의 조회 축으로는 정당하다 — 금지 대상은 '생성'이다 */
    const code = stripComments(read(ORDERS));
    expect(code).not.toMatch(/buildConfirmEvent\(/);
  });
});

describe("② /api/orders/[id] — void→release", () => {
  it("CANCELLED 전이에서 buildReleaseEvent 로 예약을 해제한다", () => {
    const src = read(ORDER_ID);
    expect(src).toMatch(/OrderStatus\.CANCELLED[\s\S]{0,200}?before\.status !== OrderStatus\.CANCELLED/);
    expect(src).toMatch(/buildReleaseEvent\(/);
  });

  it("중복 해제는 budgetEventKey unique 로 멱등 — P2002 무시 분기", () => {
    expect(read(ORDER_ID)).toMatch(/P2002/);
  });
});

describe("③ /api/user-budgets — 잔액에 예약 반영", () => {
  it("Budget 행 잔액식이 활성 예약을 뺀다 + reservedAmount 노출", () => {
    const src = read(USER_BUDGETS);
    expect(src).toMatch(/activeReservedAmount\(/);
    expect(src).toMatch(/reservedAmount/);
  });

  it("기간 창은 resolveBudgetPeriod — 인라인 파싱 은퇴 (⑤ 단일 truth)", () => {
    expect(read(USER_BUDGETS)).toMatch(/resolveBudgetPeriod\(/);
  });
});

describe("④ /api/budgets/[id] — ⑤ usage 창 배선", () => {
  it("usage 합산 창이 resolveBudgetPeriod 를 쓴다 — 표시 기간과 합산 창의 분리 해소", () => {
    expect(read(BUDGET_ID)).toMatch(/resolveBudgetPeriod\(/);
  });
});

describe("⑤ 발주 다이얼로그 — 선택지 정직성", () => {
  it("연구비(UserBudget) 행은 선택 불가 + 사유 표기 — 고르면 실패할 것을 고르게 두지 않는다", () => {
    const src = read(QUOTE_PAGE);
    expect(src).toMatch(/disabled=\{budget\._source === "user-budget"\}/);
    expect(src).toMatch(/발주 미지원/);
  });

  it("주문 접수 성공 시 예산 잔액을 invalidate — 예약이 화면 잔액에 반영된다", () => {
    const createOrderBlock = read(QUOTE_PAGE).match(/createOrderMutation = useMutation[\s\S]{0,1600}?onError/);
    expect(createOrderBlock).not.toBeNull();
    expect(createOrderBlock![0]).toMatch(/invalidateQueries\(\{ queryKey: \["user-budgets"\] \}\)/);
  });
});
