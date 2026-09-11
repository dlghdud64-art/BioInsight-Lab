/**
 * runDeliveryInventorySync — PO DELIVERED transition 시 호출되는
 * 자동 inventory wiring helper.
 *
 * §11.56 / #inventory-model-consolidation Phase 1 (RED → GREEN).
 *
 * Schema-designed path (LabAxis 운영 ontology):
 *   Order (PO) → OrderItem
 *     ↓ DELIVERED
 *   InventoryRestock (입고 receipt: orderId FK + lotNumber + expiryDate)
 *     ↓
 *   ProductInventory (운영 master — restockRecords[] 통해 receipt 조회)
 *
 * Pre-§11.56: admin endpoint가 잘못된 path (UserInventory legacy)로
 * 자동 wiring하고 있었음. 운영자 시야의 ProductInventory에는 0% 반영.
 *
 * 본 helper는:
 *   1. Order + items + organizationId 조회 (caller가 tx 제공)
 *   2. F-3 Block: OrderItem.productId 누락 시 throw
 *   3. ProductInventory.upsert (owner: organizationId 우선 → userId fallback)
 *   4. InventoryRestock.create (PO ↔ inventory 연결)
 *
 * Caller responsibility:
 *   - Order.status === "SHIPPING" → "DELIVERED" transition을 같은 tx에서
 *   - duplicate transition guard (이미 DELIVERED 면 호출 안 함)
 */

import type { Prisma, ProductInventory, InventoryRestock } from "@prisma/client";

export interface DeliveryInventorySyncInput {
  /** Active Prisma transaction client. caller responsibility. */
  tx: Prisma.TransactionClient;
  /** Order id to sync (status가 DELIVERED로 transition되기 직전 또는 직후). */
  orderId: string;
  /**
   * 입고 시 default 값. 운영자 입력 dock (§11.56 본 트랙)에서 제공.
   * 미제공 시 fallback 사용.
   */
  defaults?: {
    location?: string;
    receivedAt?: Date;
    lotNumber?: string;
    expiryDate?: Date;
  };
}

export interface DeliveryInventorySyncResult {
  inventoryRestocks: InventoryRestock[];
  productInventories: ProductInventory[];
}

export class DeliverySyncError extends Error {
  constructor(
    public code: "missing_product_id" | "order_not_found" | "no_items" | "no_organization",
    message: string,
  ) {
    super(message);
    this.name = "DeliverySyncError";
  }
}

export async function runDeliveryInventorySync(
  input: DeliveryInventorySyncInput,
): Promise<DeliveryInventorySyncResult> {
  const { tx, orderId, defaults } = input;

  // 1. Order + items 조회
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new DeliverySyncError("order_not_found", `Order ${orderId} not found`);
  }

  if (!order.items || order.items.length === 0) {
    throw new DeliverySyncError("no_items", `Order ${orderId} has no items`);
  }

  // 2. F-3 Block: OrderItem.productId 누락 검사 (atomicity — 한 건이라도 빠지면 전체 reject)
  const itemsMissingProductId = order.items.filter(
    (it: { productId: string | null }) => it.productId == null,
  );
  if (itemsMissingProductId.length > 0) {
    throw new DeliverySyncError(
      "missing_product_id",
      `OrderItem.productId required for inventory sync. ${itemsMissingProductId.length} of ${order.items.length} items missing productId. Resolve product mapping before DELIVERED transition.`,
    );
  }

  // 3. 소유 조직 · §inventory-org-required (호영님 2026-09-11): 재고는 조직의 것이다.
  //   옛 판본은 organizationId 가 없으면 userId 로 **개인 재고**를 만들었다(개인 분기 · userId 유니크 키).
  //   조직 없는 발주는 재고를 만들지 않고 던진다. 호출부 두 곳의 처리는 기존 DeliverySyncError 와 같다:
  //     orders/[id] PATCH        잡아서 restock 만 건너뛴다(주문 DELIVERED 는 유지)
  //     admin/orders/[id]/status 트랜잭션째 실패(missing_product_id 와 같은 경로)
  //   prod 실측 2026-09-11(로컬 operator-shell → Supabase): organizationId null 발주 0건 · 잠복 경로.
  const organizationId: string | null = order.organizationId;
  if (!organizationId) {
    throw new DeliverySyncError("no_organization", `Order ${orderId} has no organizationId`);
  }

  // 4. 같은 productId 합산 (Map<productId, totalQuantity>)
  const aggregated = new Map<string, number>();
  for (const item of order.items as Array<{ productId: string; quantity: number }>) {
    aggregated.set(item.productId, (aggregated.get(item.productId) ?? 0) + item.quantity);
  }

  // 5. 각 product per ProductInventory upsert + InventoryRestock create
  const productInventories: ProductInventory[] = [];
  const inventoryRestocks: InventoryRestock[] = [];
  const receivedAt = defaults?.receivedAt ?? new Date();

  for (const [productId, totalQuantity] of aggregated.entries()) {
    const inventory = await tx.productInventory.upsert({
      where: { organizationId_productId: { organizationId, productId } },
      create: {
        organizationId,
        productId,
        currentQuantity: totalQuantity,
        location: defaults?.location ?? null,
        lotNumber: defaults?.lotNumber ?? null,
        expiryDate: defaults?.expiryDate ?? null,
      },
      update: {
        currentQuantity: { increment: totalQuantity },
      },
    });
    productInventories.push(inventory);

    const restock = await tx.inventoryRestock.create({
      data: {
        inventoryId: inventory.id,
        orderId: order.id,
        userId: order.userId,
        quantity: totalQuantity,
        lotNumber: defaults?.lotNumber ?? null,
        expiryDate: defaults?.expiryDate ?? null,
        receivingStatus: "COMPLETED",
        restockedAt: receivedAt,
      },
    });
    inventoryRestocks.push(restock);
  }

  return { productInventories, inventoryRestocks };
}
