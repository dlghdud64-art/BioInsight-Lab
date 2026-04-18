/**
 * Promotion Queue — 승격 대기열
 *
 * 개별 승격 요청이 즉시 실행되지 않고 포트폴리오 큐에 대기합니다.
 * Capacity Manager와 Expansion Policy에 의해 실행 순서가 결정됩니다.
 */

import type { LifecycleState } from "./rollout-state-machine";
import type { RiskTier } from "./doctype-tiering";
import type { CapacityStatus } from "./capacity-manager";

// ── Types ──

export type QueueItemStatus = "QUEUED" | "READY" | "EXECUTING" | "COMPLETED" | "BLOCKED" | "CANCELLED";

export interface PromotionQueueItem {
  id: string;
  documentType: string;
  currentStage: LifecycleState;
  targetStage: LifecycleState;
  riskTier: RiskTier;
  readinessScore: number; // from ops-load-scoring
  queuedAt: Date;
  readyAt: Date | null;
  executedAt: Date | null;
  status: QueueItemStatus;
  requestedBy: string;
  blockReason: string | null;
  priority: number; // computed: higher = more urgent
}

// ── In-memory store (production: DB-backed) ──

const queue: PromotionQueueItem[] = [];

/**
 * 승격 요청을 큐에 추가
 */
export function enqueuePromotion(params: {
  documentType: string;
  currentStage: LifecycleState;
  targetStage: LifecycleState;
  riskTier: RiskTier;
  readinessScore: number;
  requestedBy: string;
}): PromotionQueueItem {
  const priority = computeQueuePriority(params.riskTier, params.readinessScore, params.currentStage);

  const item: PromotionQueueItem = {
    id: `PQ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    documentType: params.documentType,
    currentStage: params.currentStage,
    targetStage: params.targetStage,
    riskTier: params.riskTier,
    readinessScore: params.readinessScore,
    queuedAt: new Date(),
    readyAt: null,
    executedAt: null,
    status: "QUEUED",
    requestedBy: params.requestedBy,
    blockReason: null,
    priority,
  };

  queue.push(item);
  return item;
}

/**
 * Capacity 상태에 따라 큐 항목을 READY 또는 BLOCKED로 전환
 */
export function evaluateQueue(capacityStatus: CapacityStatus): {
  ready: PromotionQueueItem[];
  blocked: PromotionQueueItem[];
} {
  const sorted = getQueuedItems();
  const ready: PromotionQueueItem[] = [];
  const blocked: PromotionQueueItem[] = [];

  for (const item of sorted) {
    if (capacityStatus === "CAPACITY_BLOCKED") {
      item.status = "BLOCKED";
      item.blockReason = "Portfolio capacity BLOCKED — 전면 동결";
      blocked.push(item);
    } else if (capacityStatus === "CAPACITY_TIGHT") {
      // TIGHT: TIER_1/TIER_2 + small stage transitions only
      const isLowRisk = item.riskTier === "TIER_1_STABLE" || item.riskTier === "TIER_2_MODERATE";
      const isSmallStep = item.targetStage === "ACTIVE_5" || item.targetStage === "ACTIVE_25";

      if (isLowRisk && isSmallStep) {
        item.status = "READY";
        item.readyAt = new Date();
        ready.push(item);
      } else {
        item.status = "BLOCKED";
        item.blockReason = "Capacity TIGHT — Low-risk 소규모 승격만 허용";
        blocked.push(item);
      }
    } else {
      // CAPACITY_OK
      item.status = "READY";
      item.readyAt = new Date();
      ready.push(item);
    }
  }

  return { ready, blocked };
}

/**
 * 큐 항목 실행 처리
 */
export function markQueueItemExecuting(itemId: string): boolean {
  const item = queue.find((q) => q.id === itemId);
  if (!item || item.status !== "READY") return false;
  item.status = "EXECUTING";
  return true;
}

export function markQueueItemCompleted(itemId: string): boolean {
  const item = queue.find((q) => q.id === itemId);
  if (!item || item.status !== "EXECUTING") return false;
  item.status = "COMPLETED";
  item.executedAt = new Date();
  return true;
}

export function cancelQueueItem(itemId: string): boolean {
  const item = queue.find((q) => q.id === itemId);
  if (!item || item.status === "COMPLETED" || item.status === "CANCELLED") return false;
  item.status = "CANCELLED";
  return true;
}

/**
 * 큐 조회 — 우선순위순
 */
export function getQueuedItems(): PromotionQueueItem[] {
  return queue
    .filter((q) => q.status === "QUEUED" || q.status === "BLOCKED")
    .sort((a, b) => b.priority - a.priority);
}

export function getFullQueue(): PromotionQueueItem[] {
  return [...queue].sort((a, b) => b.priority - a.priority);
}

export function getQueueStats(): {
  total: number;
  queued: number;
  ready: number;
  executing: number;
  blocked: number;
  completed: number;
} {
  return {
    total: queue.length,
    queued: queue.filter((q) => q.status === "QUEUED").length,
    ready: queue.filter((q) => q.status === "READY").length,
    executing: queue.filter((q) => q.status === "EXECUTING").length,
    blocked: queue.filter((q) => q.status === "BLOCKED").length,
    completed: queue.filter((q) => q.status === "COMPLETED").length,
  };
}

// ── Helpers ──

function computeQueuePriority(tier: RiskTier, readinessScore: number, currentStage: LifecycleState): number {
  // Higher readiness = higher priority
  let priority = readinessScore;

  // Lower tier = higher priority (safer to promote)
  const tierBonus: Record<RiskTier, number> = {
    TIER_1_STABLE: 20,
    TIER_2_MODERATE: 10,
    TIER_3_ELEVATED: 0,
    TIER_4_HIGH_VARIANCE: -10,
  };
  priority += tierBonus[tier];

  // Earlier stages get slight boost (smaller blast radius)
  const stageBonus: Partial<Record<LifecycleState, number>> = {
    SHADOW_ONLY: 15,
    ACTIVE_5: 10,
    ACTIVE_25: 5,
    ACTIVE_50: 0,
  };
  priority += stageBonus[currentStage] ?? 0;

  return Math.max(priority, 0);
}
