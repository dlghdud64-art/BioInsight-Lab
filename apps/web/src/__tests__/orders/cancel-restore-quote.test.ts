/**
 * §cancel-restores-quote — 주문 취소가 견적을 되돌린다
 *
 * 카드: docs/handoff/CARD_cancel-does-not-restore-quote.md
 *   겹 1  quote.status 가 PURCHASED 로 굳음   → UI 진입 차단 (deriveRailState 는 COMPLETED 만 본다)
 *   겹 2  ALREADY_ORDERED 가 CANCELLED 도 셈  → 서버 차단 (1:1 시절 판정식 잔존)
 * 두 겹은 서로 다른 축이라 둘 다 고쳐야 재발주 경로가 열린다.
 *
 * 인벤토리 실측 2026-08-23 (파일:줄 · 추정 0):
 *   quote.status = PURCHASED 쓰기 3곳 — api/orders/route.ts:336 · api/admin/orders/route.ts:303
 *                                       · api/quotes/[id]/route.ts:302(범용 PATCH)
 *   Quote↔Order = 1:N (@@unique([quoteId, vendorId]) · legacy vendorId NULL 은 NULL-distinct)
 *   ALREADY_ORDERED 판정 2곳 — api/orders/route.ts:136 · api/admin/orders/route.ts:177
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { restoreQuoteOnOrderCancel } from "@/lib/orders/cancel-restore-quote";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const ORDER_ID = "src/app/api/orders/[id]/route.ts";
const ADMIN_ORDER_STATUS = "src/app/api/admin/orders/[id]/status/route.ts";
const ORDERS = "src/app/api/orders/route.ts";
const ADMIN_ORDERS = "src/app/api/admin/orders/route.ts";
const RESTORE_SVC = "src/lib/orders/cancel-restore-quote.ts";

// ─────────────────────────────────────────────────────────────────────────────
// 목 — where 절을 **실제로 적용**한다.
//   🛑 2026-08-22 학습: 목이 where 를 무시하면 필터 회귀를 목이 흡수한다
//      (다인 confirm 계약 테스트 1차가 정확히 그 자리였다).
// ─────────────────────────────────────────────────────────────────────────────
type OrderRow = { id: string; quoteId: string; status: string };

function makeTx(seed: {
  orders: OrderRow[];
  quote: { id: string; status: string } | null;
  ledger?: Array<{ sourceEntityId: string; eventType: string }>;
}) {
  const updates: Array<{ where: any; data: any }> = [];
  const ledger = seed.ledger ?? [];
  return {
    updates,
    tx: {
      order: {
        findUnique: async ({ where }: any) =>
          seed.orders.find((o) => o.id === where.id) ?? null,
        count: async ({ where }: any) =>
          seed.orders.filter((o) => {
            if (where.quoteId !== undefined && o.quoteId !== where.quoteId) return false;
            if (where.id?.not !== undefined && o.id === where.id.not) return false;
            if (where.status?.not !== undefined && o.status === where.status.not) return false;
            return true;
          }).length,
      },
      quote: {
        findUnique: async ({ where }: any) =>
          seed.quote && seed.quote.id === where.id ? seed.quote : null,
        update: async (args: any) => {
          updates.push(args);
          return { ...seed.quote, ...args.data };
        },
      },
      budgetEvent: {
        findFirst: async ({ where }: any) =>
          ledger.find(
            (e) =>
              e.sourceEntityId === where.sourceEntityId && e.eventType === where.eventType,
          ) ?? null,
      },
    },
  };
}

const ORD = { id: "ord-1", quoteId: "q-1", status: "CANCELLED" };

describe("restoreQuoteOnOrderCancel — 복귀 조건", () => {
  it("PURCHASED · 다른 활성 주문 0 · 이 주문 confirm 0 → COMPLETED 로 되돌린다", async () => {
    const { tx, updates } = makeTx({ orders: [ORD], quote: { id: "q-1", status: "PURCHASED" } });
    const restored = await restoreQuoteOnOrderCancel(tx as any, { orderId: "ord-1" });
    expect(restored).toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ where: { id: "q-1" }, data: { status: "COMPLETED" } });
  });

  it("🛑 다른 활성 주문이 남아 있으면 되돌리지 않는다 — 다른 주문이 세운 PURCHASED 를 무르면 안 된다", async () => {
    const { tx, updates } = makeTx({
      orders: [ORD, { id: "ord-2", quoteId: "q-1", status: "ORDERED" }],
      quote: { id: "q-1", status: "PURCHASED" },
    });
    expect(await restoreQuoteOnOrderCancel(tx as any, { orderId: "ord-1" })).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("다른 주문이 전부 CANCELLED 면 되돌린다 — count 의 status 필터가 실제로 걸린다", async () => {
    const { tx, updates } = makeTx({
      orders: [ORD, { id: "ord-2", quoteId: "q-1", status: "CANCELLED" }],
      quote: { id: "q-1", status: "PURCHASED" },
    });
    expect(await restoreQuoteOnOrderCancel(tx as any, { orderId: "ord-1" })).toBe(true);
    expect(updates).toHaveLength(1);
  });

  it("다른 견적의 활성 주문은 세지 않는다 — quoteId 필터가 실제로 걸린다", async () => {
    const { tx, updates } = makeTx({
      orders: [ORD, { id: "ord-9", quoteId: "q-other", status: "ORDERED" }],
      quote: { id: "q-1", status: "PURCHASED" },
    });
    expect(await restoreQuoteOnOrderCancel(tx as any, { orderId: "ord-1" })).toBe(true);
    expect(updates).toHaveLength(1);
  });

  it("🛑 이 주문이 confirm 됐으면 되돌리지 않는다 — 구매가 확정된 발주다", async () => {
    const { tx, updates } = makeTx({
      orders: [ORD],
      quote: { id: "q-1", status: "PURCHASED" },
      ledger: [{ sourceEntityId: "ord-1", eventType: "order_confirmed" }],
    });
    expect(await restoreQuoteOnOrderCancel(tx as any, { orderId: "ord-1" })).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("다른 주문의 confirm 은 이 주문을 막지 않는다 — sourceEntityId 필터가 실제로 걸린다", async () => {
    /* 🛑 옛 초안(PurchaseRecord 0건)이 정확히 여기서 틀렸다. PurchaseRecord 에는
     * orderId 가 없어 quoteId 축으로만 걸리므로, 이 주문과 무관한 확정이 복귀를 막았다.
     * 프로덕션 실측 — quote 6QRG 의 레코드는 2026-08-18 생성, 주문 C3PN 은 08-22,
     * SKSQ 는 08-24. 두 주문 어느 쪽도 그 레코드를 만들 수 없는데 둘 다 막혔다. */
    const { tx, updates } = makeTx({
      orders: [ORD, { id: "ord-2", quoteId: "q-1", status: "CANCELLED" }],
      quote: { id: "q-1", status: "PURCHASED" },
      ledger: [{ sourceEntityId: "ord-2", eventType: "order_confirmed" }],
    });
    expect(await restoreQuoteOnOrderCancel(tx as any, { orderId: "ord-1" })).toBe(true);
    expect(updates).toHaveLength(1);
  });

  it("이 주문의 reserve/release 는 confirm 이 아니다 — eventType 필터가 실제로 걸린다", async () => {
    const { tx, updates } = makeTx({
      orders: [ORD],
      quote: { id: "q-1", status: "PURCHASED" },
      ledger: [
        { sourceEntityId: "ord-1", eventType: "order_reserved" },
        { sourceEntityId: "ord-1", eventType: "order_released" },
      ],
    });
    expect(await restoreQuoteOnOrderCancel(tx as any, { orderId: "ord-1" })).toBe(true);
    expect(updates).toHaveLength(1);
  });

  it("⚠️ 레거시 — 원장 흔적이 0 인 주문은 복귀시킨다 (알고 남긴 구멍)", async () => {
    /* 2026-08-22 이전 주문은 예약이 없어 확정 여부를 원장으로 판정할 수 없다.
     * 그런 주문을 취소하면 "확정 안 됨" 으로 보고 견적을 되돌린다 — 이것은 사고가
     * 아니라 판정이다(호영님 2026-08-24). 신규 주문은 해당 없다: 접수 두 경로 모두
     * 예산 없으면 NO_BUDGET 으로 막으므로 예약 없는 주문이 새로 생기지 않는다.
     * 완전히 닫으려면 PurchaseRecord.orderId (additive DDL · 별도 승인)가 필요하다.
     * 🛑 이 단언을 지우려면 그 DDL 슬라이스와 함께 지운다 — 그전에는 계약이다. */
    const { tx, updates } = makeTx({
      orders: [ORD],
      quote: { id: "q-1", status: "PURCHASED" },
      ledger: [],
    });
    expect(await restoreQuoteOnOrderCancel(tx as any, { orderId: "ord-1" })).toBe(true);
    expect(updates).toHaveLength(1);
  });

  it("이미 COMPLETED 면 no-op — 멱등(취소 재호출 안전)", async () => {
    const { tx, updates } = makeTx({ orders: [ORD], quote: { id: "q-1", status: "COMPLETED" } });
    expect(await restoreQuoteOnOrderCancel(tx as any, { orderId: "ord-1" })).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("PURCHASED 가 아닌 견적은 손대지 않는다 (CANCELLED 견적 포함)", async () => {
    const { tx, updates } = makeTx({ orders: [ORD], quote: { id: "q-1", status: "CANCELLED" } });
    expect(await restoreQuoteOnOrderCancel(tx as any, { orderId: "ord-1" })).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("주문이 없으면 no-op", async () => {
    const { tx, updates } = makeTx({ orders: [], quote: { id: "q-1", status: "PURCHASED" } });
    expect(await restoreQuoteOnOrderCancel(tx as any, { orderId: "ord-1" })).toBe(false);
    expect(updates).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 겹 1 배선 — 취소 진입점 2곳이 같은 서비스를 부른다
// ─────────────────────────────────────────────────────────────────────────────
describe("겹 1 배선 — 취소 진입점 2곳 (owner · admin)", () => {
  it("owner PATCH /api/orders/[id] — 해제 직후 복귀를 같은 블록에서 부른다", () => {
    const code = stripComments(read(ORDER_ID));
    expect(code).toMatch(/releaseOrderReservation\(tx, \{ orderId[\s\S]{0,200}?restoreQuoteOnOrderCancel\(tx, \{ orderId/);
  });

  it("admin PATCH /api/admin/orders/[id]/status — 해제 직후 복귀를 같은 블록에서 부른다", () => {
    const code = stripComments(read(ADMIN_ORDER_STATUS));
    expect(code).toMatch(/releaseOrderReservation\(tx, \{ orderId[\s\S]{0,200}?restoreQuoteOnOrderCancel\(tx, \{ orderId/);
  });

  it("🛑 역방향 잠금 — 라우트가 견적 복귀를 재인라인하지 않는다 (서비스 단일점)", () => {
    for (const rel of [ORDER_ID, ADMIN_ORDER_STATUS]) {
      const code = stripComments(read(rel));
      expect(code).not.toMatch(/quote\.update\([\s\S]{0,300}?QuoteStatus\.COMPLETED/);
      expect(code).not.toMatch(/quote\.update\([\s\S]{0,300}?status:\s*"COMPLETED"/);
    }
  });

  it("복귀 조건은 서비스 안에 있다 — 다른 활성 주문 · 이 주문의 confirm 두 축", () => {
    const svc = stripComments(read(RESTORE_SVC));
    expect(svc).toMatch(/order\.count\(/);
    expect(svc).toMatch(/status:\s*\{\s*not:\s*"CANCELLED"\s*\}/);
    /* ③ 은 주체가 박힌 사건으로 판정한다 — sourceEntityId 와 ORDER_CONFIRMED 가 한 where 안에 */
    expect(svc).toMatch(/budgetEvent\.findFirst\([\s\S]{0,200}?sourceEntityId:\s*orderId[\s\S]{0,120}?eventType:\s*ORDER_CONFIRMED/);
  });

  it("🛑 역방향 잠금 — ③ 을 PurchaseRecord 축으로 되돌리지 않는다 (주체 식별 불가 · orderId 컬럼 없음)", () => {
    const svc = stripComments(read(RESTORE_SVC));
    expect(svc).not.toMatch(/purchaseRecord\./);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 겹 2 배선 — ALREADY_ORDERED 가 취소분을 세지 않는다 (형제 슬롯 2곳)
// ─────────────────────────────────────────────────────────────────────────────
describe("겹 2 배선 — ALREADY_ORDERED 는 활성 주문만 센다", () => {
  for (const rel of [ORDERS, ADMIN_ORDERS]) {
    it(`${rel} — CANCELLED 를 제외한 뒤 판정한다`, () => {
      const code = stripComments(read(rel));
      expect(code).toMatch(
        /filter\(\([^)]*\) =>[^)\n]*status !== OrderStatus\.CANCELLED\)[\s\S]{0,300}?throw new Error\("ALREADY_ORDERED"\)/,
      );
    });

    it(`${rel} — 🛑 취소분까지 세던 옛 판정식이 남아 있지 않다`, () => {
      const code = stripComments(read(rel));
      expect(code).not.toMatch(/quote\.orders && quote\.orders\.length > 0/);
    });
  }
});
