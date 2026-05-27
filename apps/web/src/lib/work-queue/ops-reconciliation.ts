/**
 * Ops Queue ↔ Entity State Drift Detection — Pure Functions
 *
 * 큐 아이템 상태와 도메인 엔티티 상태 간의 불일치(drift)를 감지합니다.
 * DB 호출 없음 — 입력으로 상태를 받아 결과를 반환하는 순수 함수만 포함합니다.
 */

import {
  determineOpsQueueItemType,
  type OpsQueueItemTypeInput,
} from "./ops-queue-semantics";

// ── Types ──

export type DriftType =
  | "substatus_mismatch"
  | "stale_queue"
  | "missing_queue"
  | "orphan_queue";

export interface DriftResult {
  hasDrift: boolean;
  driftType: DriftType | null;
  expected: string | null;
  actual: string | null;
  recommendation: "resync" | "close" | "create" | "ignore";
}

export interface QueueAnomaly {
  itemId: string;
  anomaly: string;
}

// ── Terminal entity statuses ──

const TERMINAL_ENTITY_STATUSES: Record<string, string[]> = {
  QUOTE: ["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"],
  ORDER: ["DELIVERED", "CANCELLED"],
  INVENTORY_RESTOCK: ["COMPLETED"],
  PURCHASE_REQUEST: ["APPROVED", "REJECTED"],
};

const ACTIVE_TASK_STATUSES = [
  "ACTION_NEEDED",
  "REVIEW_NEEDED",
  "WAITING_RESPONSE",
  "IN_PROGRESS",
  "BLOCKED",
];

// ── Pure Functions ──

/**
 * 엔티티 상태와 큐 아이템 상태를 비교하여 drift를 감지합니다.
 *
 * @param entity - 도메인 엔티티 상태 (entityType + status)
 * @param queueItem - 해당 엔티티의 큐 아이템 (없으면 null)
 * @returns DriftResult
 */
export function detectEntityQueueDrift(
  entity: { status: string; entityType: string },
  queueItem: { substatus: string | null; taskStatus: string } | null,
): DriftResult {
  const terminalStatuses = TERMINAL_ENTITY_STATUSES[entity.entityType] ?? [];
  const isEntityTerminal = terminalStatuses.includes(entity.status);

  // Case 1: Entity is terminal but queue item is still active → orphan
  if (isEntityTerminal && queueItem) {
    const isQueueActive = ACTIVE_TASK_STATUSES.includes(queueItem.taskStatus);
    if (isQueueActive) {
      return {
        hasDrift: true,
        driftType: "orphan_queue",
        expected: null,
        actual: queueItem.taskStatus,
        recommendation: "close",
      };
    }
    // Queue is already completed/failed → no drift
    return { hasDrift: false, driftType: null, expected: null, actual: null, recommendation: "ignore" };
  }

  // Case 2: Entity is active but no queue item → missing
  if (!isEntityTerminal && !queueItem) {
    const expectedType = determineOpsQueueItemType(
      buildQueueItemTypeInput(entity.entityType, entity.status)
    );
    if (expectedType) {
      return {
        hasDrift: true,
        driftType: "missing_queue",
        expected: expectedType,
        actual: null,
        recommendation: "create",
      };
    }
    // No expected queue type for this entity state → ignore
    return { hasDrift: false, driftType: null, expected: null, actual: null, recommendation: "ignore" };
  }

  // Case 3: Entity is active and queue item exists → check substatus alignment
  if (!isEntityTerminal && queueItem) {
    const expectedType = determineOpsQueueItemType(
      buildQueueItemTypeInput(entity.entityType, entity.status)
    );
    if (!expectedType) {
      // Entity state doesn't map to a queue type but queue exists → stale
      const isQueueActive = ACTIVE_TASK_STATUSES.includes(queueItem.taskStatus);
      if (isQueueActive) {
        return {
          hasDrift: true,
          driftType: "stale_queue",
          expected: null,
          actual: queueItem.substatus,
          recommendation: "close",
        };
      }
      return { hasDrift: false, driftType: null, expected: null, actual: null, recommendation: "ignore" };
    }

    // Both exist — compare substatus alignment (lightweight check)
    // Queue's taskStatus should be active if entity is active
    const isQueueActive = ACTIVE_TASK_STATUSES.includes(queueItem.taskStatus);
    if (!isQueueActive) {
      return {
        hasDrift: true,
        driftType: "substatus_mismatch",
        expected: expectedType,
        actual: queueItem.taskStatus,
        recommendation: "resync",
      };
    }

    return { hasDrift: false, driftType: null, expected: null, actual: null, recommendation: "ignore" };
  }

  // Case 4: Entity terminal, no queue → fine
  return { hasDrift: false, driftType: null, expected: null, actual: null, recommendation: "ignore" };
}

/**
 * 동일 엔티티의 큐 아이템 배열에서 이상을 감지합니다.
 *
 * @param items - 동일 엔티티의 큐 아이템들
 * @returns 이상 목록 (정상이면 빈 배열)
 */
export function detectQueueAnomalies(
  items: Array<{ id: string; taskStatus: string; substatus: string | null; updatedAt: string }>,
): QueueAnomaly[] {
  const anomalies: QueueAnomaly[] = [];

  // Check for multiple active items (should be exactly 0 or 1)
  const activeItems = items.filter((i) => ACTIVE_TASK_STATUSES.includes(i.taskStatus));
  if (activeItems.length > 1) {
    for (const item of activeItems.slice(1)) {
      anomalies.push({ itemId: item.id, anomaly: "duplicate_active" });
    }
  }

  // Check for stale items (not updated in 30+ days)
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const item of activeItems) {
    if (now - new Date(item.updatedAt).getTime() > thirtyDaysMs) {
      anomalies.push({ itemId: item.id, anomaly: "stale_active" });
    }
  }

  return anomalies;
}

// ── Helpers ──

function buildQueueItemTypeInput(entityType: string, status: string): OpsQueueItemTypeInput {
  switch (entityType) {
    case "QUOTE":
      return { entityType: "QUOTE", quoteStatus: status };
    case "ORDER":
      return { entityType: "ORDER", orderStatus: status };
    case "INVENTORY_RESTOCK":
      return { entityType: "INVENTORY_RESTOCK", receivingStatus: status };
    case "PURCHASE_REQUEST":
      return { entityType: "PURCHASE_REQUEST", purchaseRequestStatus: status };
    default:
      return { entityType: "QUOTE", quoteStatus: status };
  }
}
