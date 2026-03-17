/**
 * POST /api/work-queue/ops-sync
 *
 * Idempotent reconciliation: scans user's active operational entities
 * (quotes, orders, inventory restocks) and ensures each has exactly one
 * non-completed AiActionItem in the work queue.
 *
 * Mirrors compare-sync pattern for the ops domain.
 *
 * Handles:
 * - Active entities without queue items → create
 * - Active entities with wrong substatus → transition
 * - Terminal entities with active queue items → complete (stale cleanup)
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createWorkItem, transitionWorkItem } from "@/lib/work-queue/work-queue-service";
import { handleApiError } from "@/lib/api-error-handler";
import {
  OPS_SUBSTATUS_DEFS,
  OPS_QUEUE_ITEM_TYPES,
  determineOpsQueueItemType,
  type OpsQueueItemTypeInput,
} from "@/lib/work-queue/ops-queue-semantics";

interface QueueItem {
  id: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  substatus: string | null;
  taskStatus: string;
  type: string;
}

const OPS_ENTITY_TYPES = ["QUOTE", "ORDER", "INVENTORY_RESTOCK", "PURCHASE_REQUEST"];

export async function POST() {
  try {
    const session = await auth();
    const userId = session?.user?.id ?? null;
    if (!userId) {
      return NextResponse.json({ synced: 0 });
    }

    // 1. Fetch active domain entities (parallel)
    const [activeQuotes, activeOrders, activeRestocks] = await Promise.all([
      // Quotes: SENT or RESPONDED (not terminal)
      db.quote.findMany({
        where: {
          userId,
          status: { in: ["SENT", "RESPONDED"] },
        },
        select: { id: true, status: true, title: true, createdAt: true },
      }),
      // Orders: not terminal
      db.order.findMany({
        where: {
          userId,
          status: { in: ["ORDERED", "CONFIRMED", "SHIPPING"] },
        },
        select: { id: true, status: true, orderNumber: true, createdAt: true },
      }),
      // InventoryRestocks: not completed or with pending confirmation
      db.inventoryRestock.findMany({
        where: {
          inventory: { userId },
          receivingStatus: { in: ["PENDING", "PARTIAL", "ISSUE"] },
        },
        select: {
          id: true,
          receivingStatus: true,
          createdAt: true,
          inventory: { select: { id: true, product: { select: { name: true } } } },
        },
      }),
    ]);

    // Build entity ID sets
    const allEntityIds = [
      ...activeQuotes.map((q: { id: string }) => q.id),
      ...activeOrders.map((o: { id: string }) => o.id),
      ...activeRestocks.map((r: { id: string }) => r.id),
    ];

    if (allEntityIds.length === 0) {
      await cleanupStaleOpsItems(userId);
      return NextResponse.json({ synced: 0 });
    }

    // 2. Fetch existing ops queue items
    const existingItems = await db.aiActionItem.findMany({
      where: {
        userId,
        relatedEntityType: { in: OPS_ENTITY_TYPES },
        relatedEntityId: { in: allEntityIds },
      },
      select: {
        id: true,
        relatedEntityType: true,
        relatedEntityId: true,
        substatus: true,
        taskStatus: true,
        type: true,
      },
    });

    // Group: active vs completed per entity
    const activeByEntity = new Map<string, QueueItem>();
    const completedByEntity = new Map<string, QueueItem>();
    for (const item of existingItems as QueueItem[]) {
      if (!item.relatedEntityId) continue;
      if (item.taskStatus === "COMPLETED" || item.taskStatus === "FAILED") {
        completedByEntity.set(item.relatedEntityId, item);
      } else {
        activeByEntity.set(item.relatedEntityId, item);
      }
    }

    let synced = 0;

    // 3. Reconcile quotes
    for (const quote of activeQuotes) {
      const input: OpsQueueItemTypeInput = {
        entityType: "QUOTE",
        quoteStatus: quote.status,
      };
      const queueItemType = determineOpsQueueItemType(input);
      if (!queueItemType) continue;

      const typeDef = OPS_QUEUE_ITEM_TYPES[queueItemType];
      if (!typeDef) continue;

      const targetSubstatus = quote.status === "RESPONDED" ? "vendor_reply_received" : "email_sent";
      const opsDef = OPS_SUBSTATUS_DEFS[targetSubstatus];
      if (!opsDef) continue;

      synced += await reconcileEntity({
        entityId: quote.id,
        entityType: "QUOTE",
        targetSubstatus,
        title: quote.title || "견적 후속 조치",
        summary: opsDef.description,
        actionType: opsDef.ownerActionType,
        userId,
        activeByEntity,
        completedByEntity,
        createdAt: quote.createdAt,
      });
    }

    // 4. Reconcile orders
    for (const order of activeOrders) {
      const input: OpsQueueItemTypeInput = {
        entityType: "ORDER",
        orderStatus: order.status,
      };
      const queueItemType = determineOpsQueueItemType(input);
      if (!queueItemType) continue;

      const targetSubstatus = order.status === "ORDERED"
        ? "status_change_proposed"
        : "vendor_response_parsed";
      const opsDef = OPS_SUBSTATUS_DEFS[targetSubstatus];
      if (!opsDef) continue;

      synced += await reconcileEntity({
        entityId: order.id,
        entityType: "ORDER",
        targetSubstatus,
        title: `발주 ${order.orderNumber || ""} 추적`,
        summary: opsDef.description,
        actionType: opsDef.ownerActionType,
        userId,
        activeByEntity,
        completedByEntity,
        createdAt: order.createdAt,
      });
    }

    // 5. Reconcile inventory restocks
    for (const restock of activeRestocks) {
      const input: OpsQueueItemTypeInput = {
        entityType: "INVENTORY_RESTOCK",
        receivingStatus: restock.receivingStatus,
        inventoryReflected: false,
      };
      const queueItemType = determineOpsQueueItemType(input);
      if (!queueItemType) continue;

      const targetSubstatus = restock.receivingStatus === "ISSUE"
        ? "restock_suggested"
        : "restock_ordered";
      const opsDef = OPS_SUBSTATUS_DEFS[targetSubstatus];
      if (!opsDef) continue;

      const productName = restock.inventory?.product?.name || "제품";

      synced += await reconcileEntity({
        entityId: restock.id,
        entityType: "INVENTORY_RESTOCK",
        targetSubstatus,
        title: `${productName} 입고 처리`,
        summary: opsDef.description,
        actionType: opsDef.ownerActionType,
        userId,
        activeByEntity,
        completedByEntity,
        createdAt: restock.createdAt,
      });
    }

    // 6. Stale cleanup
    await cleanupStaleOpsItems(userId, new Set(allEntityIds));

    return NextResponse.json({ synced });
  } catch (error) {
    return handleApiError(error, "POST /api/work-queue/ops-sync");
  }
}

// ── Reconcile a single entity ──

async function reconcileEntity(params: {
  entityId: string;
  entityType: string;
  targetSubstatus: string;
  title: string;
  summary: string;
  actionType: string;
  userId: string;
  activeByEntity: Map<string, QueueItem>;
  completedByEntity: Map<string, QueueItem>;
  createdAt: Date;
}): Promise<number> {
  const { entityId, entityType, targetSubstatus, title, summary, actionType, userId, activeByEntity, completedByEntity, createdAt } = params;

  const active = activeByEntity.get(entityId);
  const completed = completedByEntity.get(entityId);

  if (active) {
    // Active item exists — update substatus if changed
    if (active.substatus !== targetSubstatus) {
      await transitionWorkItem({
        itemId: active.id,
        substatus: targetSubstatus,
        userId,
      });
      return 1;
    }
    return 0;
  }

  if (completed) {
    // Reopen: entity is active but queue item was completed
    await transitionWorkItem({
      itemId: completed.id,
      substatus: targetSubstatus,
      userId,
      metadata: { reopenReason: "entity_still_active" },
    });
    return 1;
  }

  // No item at all — create new
  await createWorkItem({
    type: actionType as any,
    userId,
    title,
    summary,
    payload: {
      entityType,
      entityCreatedAt: createdAt.toISOString(),
    },
    relatedEntityType: entityType,
    relatedEntityId: entityId,
    priority: "MEDIUM",
  });
  return 1;
}

// ── Stale cleanup ──

async function cleanupStaleOpsItems(userId: string, activeEntityIds?: Set<string>) {
  const staleItems = await db.aiActionItem.findMany({
    where: {
      userId,
      relatedEntityType: { in: OPS_ENTITY_TYPES },
      taskStatus: { notIn: ["COMPLETED", "FAILED"] },
    },
    select: { id: true, relatedEntityId: true, substatus: true },
  });

  for (const item of staleItems as { id: string; relatedEntityId: string | null; substatus: string | null }[]) {
    if (!item.relatedEntityId) continue;
    if (activeEntityIds && activeEntityIds.has(item.relatedEntityId)) continue;

    // Entity no longer active — complete the queue item
    const terminalSubstatus = item.substatus && OPS_SUBSTATUS_DEFS[item.substatus]
      ? (OPS_SUBSTATUS_DEFS[item.substatus].stage === "quote" ? "quote_completed" : "status_change_approved")
      : "status_change_approved";

    await transitionWorkItem({
      itemId: item.id,
      substatus: terminalSubstatus,
      userId,
      metadata: { autoClosedReason: "entity_terminal" },
    });
  }
}
