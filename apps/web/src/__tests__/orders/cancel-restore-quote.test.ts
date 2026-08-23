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
  purchaseRecords?: Array<{ quoteId: string }>;
}) {
  const updates: Array<{ where: any; data: any }> = [];
  const purchaseRecords = seed.purchaseRecords ?? [];
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
      purchaseRecord: {
        findFirst: async ({ where }: any) =>
          purchaseRecords.find((p) => p.quoteId === where.quoteId) ?? null,
      },
    },
  };
}

const ORD = { id: "ord-1", quoteId: "q-1", status: "CANCELLED" };

describe("restoreQuoteOnOrderCancel — 복귀 조건", () => {
  it("PURCHASED · 다른 활성 주문 0 · PurchaseRecord 0 → COMPLETED 로 되돌린다", async () => {
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

  it("🛑 PurchaseRecord 가 있으면 되돌리지 않는다 — 구매가 확정된 견적이다", async () => {
    const { tx, updates } = makeTx({
      orders: [ORD],
      quote: { id: "q-1", status: "PURCHASED" },
      purchaseRecords: [{ quoteId: "q-1" }],
    });
    expect(await restoreQuoteOnOrderCancel(tx as any, { orderId: "ord-1" })).toBe(false);
    expect(updates).toHaveLength(0);
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

  it("복귀 조건은 서비스 안에 있다 — 다른 활성 주문 · PurchaseRecord 두 축", () => {
    const svc = stripComments(read(RESTORE_SVC));
    expect(svc).toMatch(/order\.count\(/);
    expect(svc).toMatch(/status:\s*\{\s*not:\s*"CANCELLED"\s*\}/);
    expect(svc).toMatch(/purchaseRecord\.findFirst\(/);
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
