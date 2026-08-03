/**
 * §money-path-coverage-restore Phase 3 축 1 — 공급사별 Order 분리 (동적 행동 검증).
 *
 * 계약 (근거 = 스키마 @@unique([quoteId, vendorId]) + Quote.orders 주석 "결재 후 vendor별 1개씩
 *   생성 — 1 Quote → N Order". 서비스 구현 역산 아님):
 *   C1. N개 vendor candidate → Order 정확히 N개, 각 Order 는 distinct vendorId.
 *   C2. 각 Order 의 OrderItem 은 해당 vendor candidate 의 items 만 담는다 (교차 오염 0).
 *   C3. 이미 (quoteId, vendorId) Order 존재 시 그 vendor 는 skip — order.create 미호출.
 *       (앱 레벨 중복 발주 방어선. 이게 뚫리면 Prisma 가 @@unique 로 던져 트랜잭션 전체 실패.)
 *
 * ⚠️ 계약을 서비스가 어기면 테스트가 맞출 대상이 아니라 발견(P1)이다.
 * 정적 sentinel(readFileSync)이 아니라 mock tx 로 서비스를 실제 실행해 create 호출을 관측한다.
 * 서비스·라우트 소스 무접촉.
 *
 * 범위 밖: mock order.findFirst 는 preset 조회만 하고 같은 런 안의 create 를
 *   반영하지 않는다. 따라서 vendorId=NULL 다건 candidate 의 상호 충돌은
 *   이 파일이 커버하지 않는다(별건 §pocandidate-null-vendor-collapse).
 */
import { describe, it, expect, vi } from "vitest";

// audit/order-number 는 서비스 외곽 부수효과 — mutation 관측과 무관하므로 격리.
vi.mock("@/lib/audit/audit-logger", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/api/order-number", () => ({
  generateOrderNumber: vi.fn((id: string) => `ORD-${id}`),
}));

import { convertPOCandidatesToOrders } from "@/lib/orders/convert-pocandidate-to-orders";

/** vendor 이름 → id 규칙: "Vendor A" → "vendor-a". order.id = "order-<vendorId>". */
function makeTx(opts: { existingVendorIds?: Set<string> } = {}) {
  const existing = opts.existingVendorIds ?? new Set<string>();
  return {
    vendor: {
      findFirst: vi.fn(async ({ where }: any) => ({
        id: String(where.name).trim().replace(/\s+/g, "-").toLowerCase(),
      })),
    },
    order: {
      findFirst: vi.fn(async ({ where }: any) =>
        existing.has(where.vendorId) ? { id: `existing-${where.vendorId}` } : null,
      ),
      create: vi.fn(async ({ data }: any) => ({ id: `order-${data.vendorId}` })),
      update: vi.fn(async () => ({})),
    },
    orderItem: { createMany: vi.fn(async () => ({ count: 0 })) },
  };
}

function candidate(id: string, vendor: string, items: Array<{ name: string }>) {
  return { id, vendor, items, totalAmount: 1000, expectedDelivery: null } as any;
}

const PARAMS = (candidates: any[]) => ({
  quoteId: "q-1",
  userId: "u-1",
  organizationId: "org-1",
  candidates,
});

/** order.id("order-vendor-x") → 그 Order 에 담긴 item name[] */
function itemsByOrder(tx: ReturnType<typeof makeTx>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const call of tx.orderItem.createMany.mock.calls) {
    const data = (call[0] as any).data as any[];
    out[data[0].orderId] = data.map((d) => d.name).sort();
  }
  return out;
}

describe("§money-path-coverage-restore 축1 — convertPOCandidatesToOrders vendor 분리", () => {
  it("C1·C2 — 3 vendor → Order 3개(distinct vendorId) + 각 Order items 는 그 vendor 것만", async () => {
    const tx = makeTx();
    const candidates = [
      candidate("poc-a", "Vendor A", [{ name: "A-1" }]),
      candidate("poc-b", "Vendor B", [{ name: "B-1" }]),
      candidate("poc-c", "Vendor C", [{ name: "C-1" }, { name: "C-2" }]),
    ];

    const res = await convertPOCandidatesToOrders(PARAMS(candidates), { client: tx as any });

    // C1 — Order 정확히 3개, distinct vendorId
    expect(tx.order.create).toHaveBeenCalledTimes(3);
    const vendorIds = tx.order.create.mock.calls.map((c: any) => c[0].data.vendorId).sort();
    expect(vendorIds).toEqual(["vendor-a", "vendor-b", "vendor-c"]);
    expect(res.created).toHaveLength(3);

    // C2 — 각 Order 의 items 는 해당 vendor candidate 것만 (교차 오염 0)
    const byOrder = itemsByOrder(tx);
    expect(byOrder["order-vendor-a"]).toEqual(["A-1"]);
    expect(byOrder["order-vendor-b"]).toEqual(["B-1"]);
    expect(byOrder["order-vendor-c"]).toEqual(["C-1", "C-2"]);
  });

  it("C3 — 이미 Order 있는 vendor 는 skip, order.create 미호출(중복 발주 방어)", async () => {
    const tx = makeTx({ existingVendorIds: new Set(["vendor-b"]) });
    const candidates = [
      candidate("poc-a", "Vendor A", [{ name: "A-1" }]),
      candidate("poc-b", "Vendor B", [{ name: "B-1" }]),
      candidate("poc-c", "Vendor C", [{ name: "C-1" }]),
    ];

    const res = await convertPOCandidatesToOrders(PARAMS(candidates), { client: tx as any });

    // B skip → create 2회 (A, C)
    expect(tx.order.create).toHaveBeenCalledTimes(2);
    const vendorIds = tx.order.create.mock.calls.map((c: any) => c[0].data.vendorId).sort();
    expect(vendorIds).toEqual(["vendor-a", "vendor-c"]);
    expect(res.skipped).toEqual([
      { poCandidateId: "poc-b", vendorId: "vendor-b", reason: "duplicate" },
    ]);
    // B 항목은 어떤 Order 에도 안 담김
    const allNames = tx.orderItem.createMany.mock.calls.flatMap((c: any) =>
      (c[0].data as any[]).map((d) => d.name),
    );
    expect(allNames).not.toContain("B-1");
  });
});
