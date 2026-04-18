/**
 * P7-1 — Automation Rules
 *
 * Post-transition side-effects. Each function is called after a
 * successful state transition to trigger downstream operations.
 *
 * All automations are idempotent — safe to retry.
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { computeInventoryCondition } from "./state-definitions";
import { canInventoryIncrease } from "./state-machine";
import { logStateTransition } from "./state-transition-logger";
import type { ReceivingStatus } from "./state-definitions";

// ══════════════════════════════════════════════════════════════════════════════
// 1. Quote Confirmed → Enable purchase conversion CTA
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Called when a quote transitions to COMPLETED/PURCHASED status.
 * Creates an activity log to signal the purchase CTA is now available.
 */
export async function onQuoteConfirmed(
  quoteId: string,
  actorId: string,
  organizationId?: string | null,
): Promise<void> {
  await logStateTransition({
    domain: "QUOTE",
    entityId: quoteId,
    fromStatus: "RESPONDED",
    toStatus: "COMPLETED",
    actorId,
    organizationId,
    metadata: { automation: "onQuoteConfirmed", purchaseCtaEnabled: true },
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. Purchase Ordered → Auto-create receiving records
// ══════════════════════════════════════════════════════════════════════════════

interface OrderedItem {
  productId: string;
  quantity: number;
  inventoryId?: string | null;
}

/**
 * Called when an Order is created. Auto-creates InventoryRestock records
 * with receivingStatus=PENDING for each order item that has a linked inventory.
 */
export async function onPurchaseOrdered(
  orderId: string,
  items: OrderedItem[],
  actorId: string,
  organizationId?: string | null,
): Promise<void> {
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const item of items) {
      if (!item.inventoryId) continue;

      await tx.inventoryRestock.create({
        data: {
          inventoryId: item.inventoryId,
          userId: actorId,
          quantity: 0,
          expectedQuantity: item.quantity,
          receivingStatus: "PENDING",
          orderId,
        },
      });
    }

    await logStateTransition(
      {
        domain: "ORDER",
        entityId: orderId,
        fromStatus: "CREATED",
        toStatus: "ORDERED",
        actorId,
        organizationId,
        metadata: {
          automation: "onPurchaseOrdered",
          restockRecordsCreated: items.filter((i) => i.inventoryId).length,
        },
      },
      tx,
    );
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. Receiving Completed → Increment inventory
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Called when a restock's receivingStatus transitions to COMPLETED.
 * Increments the linked ProductInventory's currentQuantity
 * and updates lot/expiry if provided.
 */
export async function onReceivingCompleted(
  restockId: string,
  actorId: string,
  organizationId?: string | null,
): Promise<void> {
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const restock = await tx.inventoryRestock.findUniqueOrThrow({
      where: { id: restockId },
      include: { inventory: true },
    });

    assertReceivingGate(restock.receivingStatus as ReceivingStatus);

    await tx.productInventory.update({
      where: { id: restock.inventoryId },
      data: {
        currentQuantity: { increment: restock.quantity },
        ...(restock.lotNumber ? { lotNumber: restock.lotNumber } : {}),
        ...(restock.expiryDate ? { expiryDate: restock.expiryDate } : {}),
      },
    });

    await logStateTransition(
      {
        domain: "RECEIVING",
        entityId: restockId,
        fromStatus: "PARTIAL",
        toStatus: "COMPLETED",
        actorId,
        organizationId,
        metadata: {
          automation: "onReceivingCompleted",
          quantityAdded: restock.quantity,
          inventoryId: restock.inventoryId,
        },
      },
      tx,
    );
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. Inventory Changed → Recompute condition
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Called after any inventory quantity/expiry change.
 * Recomputes the inventory condition and returns it.
 */
export async function onInventoryChanged(
  inventoryId: string,
  actorId: string,
  organizationId?: string | null,
): Promise<{ condition: string }> {
  const inventory = await db.productInventory.findUniqueOrThrow({
    where: { id: inventoryId },
    select: {
      currentQuantity: true,
      safetyStock: true,
      expiryDate: true,
      disposalScheduledAt: true,
    },
  });

  const condition = computeInventoryCondition(inventory);

  await logStateTransition({
    domain: "INVENTORY",
    entityId: inventoryId,
    fromStatus: "CHANGED",
    toStatus: condition,
    actorId,
    organizationId,
    metadata: { automation: "onInventoryChanged" },
  });

  return { condition };
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. Receiving Gate Guard
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Guard: blocks inventory increase if receiving is not COMPLETED.
 * Throws an error with a clear message if the gate is not met.
 */
export function assertReceivingGate(receivingStatus: ReceivingStatus): void {
  if (!canInventoryIncrease(receivingStatus)) {
    throw new Error(
      `[ReceivingGate] Inventory increase blocked: receivingStatus is ${receivingStatus}, must be COMPLETED`,
    );
  }
}
