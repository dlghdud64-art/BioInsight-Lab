/**
 * Console Priority Tiers — Canonical Definitions
 *
 * 운영 콘솔의 우선순위 티어를 정의합니다.
 * 기존 scoring.ts의 totalScore와 state-mapper의 taskStatus를 기반으로
 * 운영자가 "무엇을 먼저 봐야 하는가"를 명확히 합니다.
 *
 * 순수 정의 파일 — DB 호출 없음.
 */

import type { WorkQueueItem } from "./work-queue-service";
import { OPS_SUBSTATUS_DEFS, isOpsSlaBreach, isOpsStale } from "./ops-queue-semantics";
import { COMPARE_SUBSTATUS_DEFS, isSlaBreach as isCompareSlaBreach } from "./compare-queue-semantics";

// ── Types ──

export type PriorityTier =
  | "urgent_blocker"
  | "approval_needed"
  | "action_needed"
  | "monitoring"
  | "informational";

export interface PriorityTierDef {
  tier: PriorityTier;
  sortOrder: number;
  label: string;
  description: string;
  visualIndicator: "red" | "orange" | "yellow" | "blue" | "gray";
}

// ── Canonical Tier Definitions ──

export const PRIORITY_TIER_DEFS: Record<PriorityTier, PriorityTierDef> = {
  urgent_blocker: {
    tier: "urgent_blocker",
    sortOrder: 0,
    label: "긴급/차단",
    description: "즉시 조치 필요 — 차단됨, 실패, SLA 2x 초과, 정체 핸드오프",
    visualIndicator: "red",
  },
  approval_needed: {
    tier: "approval_needed",
    sortOrder: 1,
    label: "승인 대기",
    description: "승인자 결재 필요 — PENDING 승인 상태",
    visualIndicator: "orange",
  },
  action_needed: {
    tier: "action_needed",
    sortOrder: 2,
    label: "조치 필요",
    description: "운영자 조치 필요 — ACTION_NEEDED 또는 SLA 1x 초과 모니터링",
    visualIndicator: "yellow",
  },
  monitoring: {
    tier: "monitoring",
    sortOrder: 3,
    label: "모니터링",
    description: "진행 중 — WAITING_RESPONSE, IN_PROGRESS, REVIEW_NEEDED",
    visualIndicator: "blue",
  },
  informational: {
    tier: "informational",
    sortOrder: 4,
    label: "정보",
    description: "완료됨 — COMPLETED",
    visualIndicator: "gray",
  },
};

// ── Constants ──

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const BLOCKED_STATUSES = new Set(["BLOCKED", "FAILED"]);
const TERMINAL_STATUSES = new Set(["COMPLETED"]);
const ACTION_STATUSES = new Set(["ACTION_NEEDED"]);
const MONITORING_STATUSES = new Set(["WAITING_RESPONSE", "IN_PROGRESS", "REVIEW_NEEDED", "READY"]);

// ── Priority Tier Assignment ──

/**
 * WorkQueueItem에 우선순위 티어를 할당합니다.
 *
 * 결정 순서:
 * 1. BLOCKED/FAILED → urgent_blocker
 * 2. SLA 2x 초과 (stale) → urgent_blocker
 * 3. approvalStatus === PENDING → approval_needed
 * 4. ACTION_NEEDED → action_needed
 * 5. WAITING_RESPONSE/IN_PROGRESS/REVIEW_NEEDED → monitoring
 * 6. COMPLETED → informational
 */
export function assignPriorityTier(item: WorkQueueItem): PriorityTier {
  const { taskStatus, approvalStatus, substatus } = item;

  // 1. Blocked/Failed → urgent_blocker
  if (BLOCKED_STATUSES.has(taskStatus)) {
    return "urgent_blocker";
  }

  // 2. SLA 2x breach (stale) → urgent_blocker
  if (substatus) {
    const ageDays = computeAgeDays(item.createdAt);
    const opsDef = OPS_SUBSTATUS_DEFS[substatus];
    if (opsDef && !opsDef.isTerminal && opsDef.staleDays > 0 && ageDays >= opsDef.staleDays) {
      return "urgent_blocker";
    }
    const compareDef = COMPARE_SUBSTATUS_DEFS[substatus];
    if (compareDef && !compareDef.isTerminal && compareDef.staleDays > 0 && ageDays >= compareDef.staleDays) {
      return "urgent_blocker";
    }
  }

  // 3. Terminal → informational (before approval check, since completed items may have PENDING legacy)
  if (TERMINAL_STATUSES.has(taskStatus)) {
    return "informational";
  }

  // 4. Approval pending → approval_needed
  if (approvalStatus === "PENDING") {
    return "approval_needed";
  }

  // 5. ACTION_NEEDED → action_needed
  if (ACTION_STATUSES.has(taskStatus)) {
    return "action_needed";
  }

  // 6. Monitoring statuses → monitoring
  if (MONITORING_STATUSES.has(taskStatus)) {
    return "monitoring";
  }

  // Fallback
  return "monitoring";
}

/**
 * SLA 기반 티어 프로모션을 적용합니다.
 *
 * 프로모션 규칙:
 * - monitoring + SLA 1x 초과 → action_needed
 * - action_needed + SLA 2x 초과 → urgent_blocker
 * - approval_needed + SLA 2x 초과 → urgent_blocker
 */
export function applyPromotionRules(item: WorkQueueItem, baseTier: PriorityTier): PriorityTier {
  const { substatus } = item;
  if (!substatus) return baseTier;

  const ageDays = computeAgeDays(item.createdAt);

  // Check SLA breach from ops or compare definitions
  const isSlaBreach = checkSlaBreach(substatus, ageDays);
  const isStaleBreach = checkStaleBreach(substatus, ageDays);

  // monitoring + SLA 1x → action_needed
  if (baseTier === "monitoring" && isSlaBreach) {
    return "action_needed";
  }

  // action_needed + SLA 2x → urgent_blocker
  if (baseTier === "action_needed" && isStaleBreach) {
    return "urgent_blocker";
  }

  // approval_needed + SLA 2x → urgent_blocker
  if (baseTier === "approval_needed" && isStaleBreach) {
    return "urgent_blocker";
  }

  return baseTier;
}

/**
 * 최종 우선순위 티어를 계산합니다 (할당 + 프로모션).
 */
export function computeFinalTier(item: WorkQueueItem): PriorityTier {
  const baseTier = assignPriorityTier(item);
  return applyPromotionRules(item, baseTier);
}

// ── Helpers ──

function computeAgeDays(createdAt: Date | string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / MS_PER_DAY);
}

function checkSlaBreach(substatus: string, ageDays: number): boolean {
  if (isOpsSlaBreach(substatus, ageDays)) return true;
  if (isCompareSlaBreach(substatus, ageDays)) return true;
  return false;
}

function checkStaleBreach(substatus: string, ageDays: number): boolean {
  const opsDef = OPS_SUBSTATUS_DEFS[substatus];
  if (opsDef && !opsDef.isTerminal && opsDef.staleDays > 0 && ageDays >= opsDef.staleDays) {
    return true;
  }
  const compareDef = COMPARE_SUBSTATUS_DEFS[substatus];
  if (compareDef && !compareDef.isTerminal && compareDef.staleDays > 0 && ageDays >= compareDef.staleDays) {
    return true;
  }
  return false;
}
