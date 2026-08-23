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
const ADMIN_ORDER_STATUS = "src/app/api/admin/orders/[id]/status/route.ts";
const RELEASE_SVC = "src/lib/budget/order-reservation-service.ts";
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
  /* 🛑 승계 (§order-entry-rewire P3-3 · 호영님 승인 2026-08-22 — 진화 판정):
   * 옛 축은 buildReleaseEvent(·P2002 를 **라우트 파일 안**에서 요구했다. P3-3 이 인라인
   * 40줄을 releaseOrderReservation(order-reservation-service.ts)으로 이관했다 — 계약은
   * 그대로이고 장소만 옮겼다. 두 CANCELLED 진입점(owner PATCH·admin status)이 같은
   * 함수를 부르게 만드는 것이 P3-3 의 취지라, 단언도 "라우트는 호출 · 구현은 서비스"
   * 로 나눈다. 아래 ②-c 가 역방향 잠금이다 — 없으면 복붙 재발이 무잠금이 된다. */
  it("CANCELLED 전이에서 해제 서비스를 부른다 (라우트 = 호출부)", () => {
    const src = read(ORDER_ID);
    expect(src).toMatch(/OrderStatus\.CANCELLED[\s\S]{0,200}?before\.status !== OrderStatus\.CANCELLED/);
    expect(src).toMatch(/releaseOrderReservation\(tx, \{ orderId/);
  });

  it("해제 구현은 서비스 단일점에 있다 — buildReleaseEvent + P2002 멱등", () => {
    const svc = read(RELEASE_SVC);
    expect(svc).toMatch(/buildReleaseEvent\(/);
    expect(svc).toMatch(/P2002/);
  });

  it("🛑 역방향 잠금 — 두 라우트 어느 쪽도 해제를 다시 인라인하지 않는다 (복붙 재발 차단)", () => {
    /* P3-3 이 봉합한 결함이 정확히 "한쪽만 고쳐지는 형태"였다. 라우트가 구현을
     * 되가져가면 admin/owner 가 다시 갈라진다 — 그 순간을 RED 로 잡는다. */
    for (const rel of [ORDER_ID, ADMIN_ORDER_STATUS]) {
      const code = stripComments(read(rel));
      expect(code).not.toMatch(/buildReleaseEvent\(/);
      expect(code).not.toMatch(/budgetEvent\.create\(/);
    }
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
