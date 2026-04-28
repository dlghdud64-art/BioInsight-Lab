/**
 * Tests for runDeliveryInventorySync (#inventory-model-consolidation Phase 1).
 *
 * Helper signature:
 *   runDeliveryInventorySync({tx, orderId, defaults?})
 *     → {inventoryRestocks[], productInventories[]}
 *
 * Cases:
 *   1. 정상 입고 (productId 있음, ProductInventory 미존재 → 신규 create)
 *   2. 추가 입고 (ProductInventory 이미 있음 → currentQuantity += quantity upsert)
 *   3. catalog free-text reject (F-3 Block — productId null → DeliverySyncError)
 *   4. 중복 productId 합산 (같은 PO에 같은 product 여러 OrderItem → quantity 합산)
 *   5. defaults forward (lotNumber/expiryDate/location/receivedAt — §11.59 contract 확장)
 *
 * Idempotency는 caller responsibility (Order.status duplicate guard) — helper 자체는 검증 안 함.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  runDeliveryInventorySync,
  DeliverySyncError,
} from "@/lib/inventory/delivery-sync";

type MockTx = {
  order: { findUnique: ReturnType<typeof vi.fn> };
  productInventory: {
    upsert: ReturnType<typeof vi.fn>;
  };
  inventoryRestock: { create: ReturnType<typeof vi.fn> };
};

function makeMockTx(): MockTx {
  return {
    order: { findUnique: vi.fn() },
    productInventory: { upsert: vi.fn() },
    inventoryRestock: { create: vi.fn() },
  };
}

const NOW = new Date("2026-04-28T00:00:00Z");

describe("runDeliveryInventorySync (#inventory-model-consolidation Phase 1)", () => {
  let tx: MockTx;
  beforeEach(() => {
    tx = makeMockTx();
  });

  it("Case 1 — 정상 입고: ProductInventory 신규 create + InventoryRestock create", async () => {
    tx.order.findUnique.mockResolvedValue({
      id: "order-1",
      userId: "user-1",
      organizationId: "org-1",
      items: [
        {
          id: "item-1",
          productId: "prod-1",
          name: "Trypsin-EDTA 100ml",
          quantity: 10,
          unitPrice: 45000,
        },
      ],
    });
    tx.productInventory.upsert.mockResolvedValue({
      id: "inv-1",
      productId: "prod-1",
      organizationId: "org-1",
      currentQuantity: 10,
    });
    tx.inventoryRestock.create.mockResolvedValue({
      id: "restock-1",
      inventoryId: "inv-1",
      orderId: "order-1",
      quantity: 10,
      receivingStatus: "COMPLETED",
    });

    const result = await runDeliveryInventorySync({
      tx: tx as never,
      orderId: "order-1",
      defaults: { location: "냉장고 A-1", receivedAt: NOW },
    });

    expect(result.productInventories).toHaveLength(1);
    expect(result.inventoryRestocks).toHaveLength(1);

    // ProductInventory.upsert 호출: org owner 우선, productId 매칭, currentQuantity += quantity
    expect(tx.productInventory.upsert).toHaveBeenCalledOnce();
    const upsertArgs = tx.productInventory.upsert.mock.calls[0][0];
    expect(upsertArgs.where).toEqual({
      organizationId_productId: { organizationId: "org-1", productId: "prod-1" },
    });
    expect(upsertArgs.create).toMatchObject({
      organizationId: "org-1",
      productId: "prod-1",
      currentQuantity: 10,
      location: "냉장고 A-1",
    });
    expect(upsertArgs.update).toMatchObject({
      currentQuantity: { increment: 10 },
    });

    // InventoryRestock.create 호출
    expect(tx.inventoryRestock.create).toHaveBeenCalledOnce();
    const restockArgs = tx.inventoryRestock.create.mock.calls[0][0];
    expect(restockArgs.data).toMatchObject({
      inventoryId: "inv-1",
      orderId: "order-1",
      userId: "user-1",
      quantity: 10,
      receivingStatus: "COMPLETED",
    });
  });

  it("Case 2 — owner fallback: organizationId 없으면 userId 기준 upsert", async () => {
    tx.order.findUnique.mockResolvedValue({
      id: "order-2",
      userId: "user-1",
      organizationId: null,
      items: [{ id: "item-2", productId: "prod-1", name: "Reagent A", quantity: 5, unitPrice: 1000 }],
    });
    tx.productInventory.upsert.mockResolvedValue({
      id: "inv-2",
      productId: "prod-1",
      userId: "user-1",
      currentQuantity: 5,
    });
    tx.inventoryRestock.create.mockResolvedValue({ id: "restock-2", inventoryId: "inv-2", orderId: "order-2", quantity: 5, receivingStatus: "COMPLETED" });

    await runDeliveryInventorySync({
      tx: tx as never,
      orderId: "order-2",
    });

    const upsertArgs = tx.productInventory.upsert.mock.calls[0][0];
    expect(upsertArgs.where).toEqual({
      userId_productId: { userId: "user-1", productId: "prod-1" },
    });
    expect(upsertArgs.create).toMatchObject({
      userId: "user-1",
      productId: "prod-1",
      currentQuantity: 5,
    });
  });

  it("Case 3 — F-3 Block: OrderItem.productId 누락 시 DeliverySyncError throw", async () => {
    tx.order.findUnique.mockResolvedValue({
      id: "order-3",
      userId: "user-1",
      organizationId: "org-1",
      items: [
        {
          id: "item-3",
          productId: null, // catalog free-text
          name: "Free-text reagent",
          quantity: 1,
          unitPrice: 5000,
        },
      ],
    });

    await expect(
      runDeliveryInventorySync({ tx: tx as never, orderId: "order-3" }),
    ).rejects.toThrow(DeliverySyncError);

    // 어떤 prisma write도 호출 안 됐는지 확인 (atomicity)
    expect(tx.productInventory.upsert).not.toHaveBeenCalled();
    expect(tx.inventoryRestock.create).not.toHaveBeenCalled();
  });

  it("Case 4 — 중복 productId 합산: 같은 PO에 같은 product 여러 OrderItem → quantity 합산 후 1 upsert + 1 restock", async () => {
    tx.order.findUnique.mockResolvedValue({
      id: "order-4",
      userId: "user-1",
      organizationId: "org-1",
      items: [
        { id: "item-4a", productId: "prod-1", name: "Same product", quantity: 3, unitPrice: 1000 },
        { id: "item-4b", productId: "prod-1", name: "Same product", quantity: 7, unitPrice: 1000 },
      ],
    });
    tx.productInventory.upsert.mockResolvedValue({
      id: "inv-4",
      productId: "prod-1",
      organizationId: "org-1",
      currentQuantity: 10,
    });
    tx.inventoryRestock.create.mockResolvedValue({ id: "restock-4", inventoryId: "inv-4", orderId: "order-4", quantity: 10, receivingStatus: "COMPLETED" });

    const result = await runDeliveryInventorySync({
      tx: tx as never,
      orderId: "order-4",
    });

    // 같은 productId라 1 upsert
    expect(tx.productInventory.upsert).toHaveBeenCalledOnce();
    const upsertArgs = tx.productInventory.upsert.mock.calls[0][0];
    expect(upsertArgs.create.currentQuantity).toBe(10); // 3 + 7
    expect(upsertArgs.update.currentQuantity).toEqual({ increment: 10 });

    // 1 restock (PO 단위 receipt)
    expect(tx.inventoryRestock.create).toHaveBeenCalledOnce();
    expect(tx.inventoryRestock.create.mock.calls[0][0].data.quantity).toBe(10);

    expect(result.productInventories).toHaveLength(1);
    expect(result.inventoryRestocks).toHaveLength(1);
  });

  it("Case 5 — defaults forward: lotNumber/expiryDate/location/receivedAt → ProductInventory.create + InventoryRestock.create 에 정확히 persist", async () => {
    // §11.59 #po-delivery-operator-contract — endpoint contract 확장으로 운영자 입력
    // (lot/expiry/location/receivedAt) 이 helper 까지 forward 됨을 검증.
    // helper 자체는 Phase 1 (commit 3dbd3a33) 부터 defaults 를 지원하지만 이 case
    // 는 contract 보장 — 향후 #order-operator-surface UI 트랙이 진입할 때
    // body shape 변경 시 빨리 fail 하도록 유지.
    const RECEIVED_AT = new Date("2026-04-28T10:30:00Z");
    const EXPIRY = new Date("2027-12-31T00:00:00Z");
    tx.order.findUnique.mockResolvedValue({
      id: "order-5",
      userId: "user-1",
      organizationId: "org-1",
      items: [
        { id: "item-5", productId: "prod-1", name: "FBS 500ml", quantity: 4, unitPrice: 80000 },
      ],
    });
    tx.productInventory.upsert.mockResolvedValue({
      id: "inv-5",
      productId: "prod-1",
      organizationId: "org-1",
      currentQuantity: 4,
    });
    tx.inventoryRestock.create.mockResolvedValue({
      id: "restock-5",
      inventoryId: "inv-5",
      orderId: "order-5",
      quantity: 4,
      receivingStatus: "COMPLETED",
    });

    await runDeliveryInventorySync({
      tx: tx as never,
      orderId: "order-5",
      defaults: {
        lotNumber: "LOT-2026-A1",
        expiryDate: EXPIRY,
        location: "냉동고 -20°C",
        receivedAt: RECEIVED_AT,
      },
    });

    // ProductInventory.create 에 lotNumber/expiryDate/location 전달
    const upsertArgs = tx.productInventory.upsert.mock.calls[0][0];
    expect(upsertArgs.create).toMatchObject({
      lotNumber: "LOT-2026-A1",
      expiryDate: EXPIRY,
      location: "냉동고 -20°C",
    });

    // InventoryRestock.create 에 lotNumber/expiryDate/restockedAt 전달
    const restockArgs = tx.inventoryRestock.create.mock.calls[0][0];
    expect(restockArgs.data).toMatchObject({
      lotNumber: "LOT-2026-A1",
      expiryDate: EXPIRY,
      restockedAt: RECEIVED_AT,
    });
  });
});
