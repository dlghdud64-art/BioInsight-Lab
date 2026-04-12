/**
 * Dispatch Invalidation Engine — 이벤트 기반 targeted invalidation
 *
 * CLAUDE.md 규칙:
 * - reopen 후에는 targeted invalidation으로 관련 surface만 갱신
 * - broad global refresh 금지
 * - 8개 이벤트 각각에 대해 재계산 + targeted invalidation 연결
 *
 * Events:
 * 1. PO conversion completed
 * 2. PO conversion reopened
 * 3. supplier profile changed
 * 4. approval snapshot invalidated
 * 5. policy hold changed
 * 6. attachment added/removed
 * 7. send scheduled
 * 8. schedule cancelled
 */

import type { DispatchGovernanceReadiness, DispatchBlockerType } from "./po-dispatch-governance-engine";

// ══════════════════════════════════════════════
// Invalidation Event Types
// ══════════════════════════════════════════════

export type DispatchInvalidationEventType =
  | "po_conversion_completed"
  | "po_conversion_reopened"
  | "supplier_profile_changed"
  | "approval_snapshot_invalidated"
  | "policy_hold_changed"
  | "attachment_changed"
  | "send_scheduled"
  | "schedule_cancelled"
  // B2-h: PurchaseOrderContract.updatedAt > approval.finalDecisionAt 감지 시 발행
  | "po_data_changed_after_approval";

export interface DispatchInvalidationEvent {
  type: DispatchInvalidationEventType;
  caseId: string;
  poNumber: string;
  timestamp: string;
  actor: string;
  /** 이벤트별 추가 데이터 */
  payload: DispatchInvalidationPayload;
}

export type DispatchInvalidationPayload =
  | { kind: "po_conversion_completed"; draftObjectId: string }
  | { kind: "po_conversion_reopened"; reason: string }
  | { kind: "supplier_profile_changed"; supplierId: string; changedFields: string[] }
  | { kind: "approval_snapshot_invalidated"; reason: string; previousSnapshotId: string }
  | { kind: "policy_hold_changed"; holdActive: boolean; holdReason: string }
  | { kind: "attachment_changed"; action: "added" | "removed"; attachmentName: string }
  | { kind: "send_scheduled"; scheduledAt: string }
  | { kind: "schedule_cancelled"; cancelReason: string }
  | { kind: "po_data_changed_after_approval"; previousUpdatedAt: string | null; newUpdatedAt: string; changedFields: string[] };

// ══════════════════════════════════════════════
// Invalidation Target — 어떤 surface/state를 무효화할지
// ══════════════════════════════════════════════

export type InvalidationTarget =
  | "dispatch_readiness"
  | "snapshot_validity"
  | "supplier_payload"
  | "confirmation_checklist"
  | "blocker_list"
  | "schedule_state"
  | "po_created_record"
  | "dock_actions";

export interface InvalidationResult {
  event: DispatchInvalidationEventType;
  targets: InvalidationTarget[];
  /** 재계산이 필요한 blocker 유형 */
  blockerRecalc: DispatchBlockerType[];
  /** readiness 상태 변경 힌트 */
  readinessImpact: "may_block" | "may_unblock" | "schedule_change" | "no_change";
  /** irreversible action (Send Now) 잠금 여부 */
  lockIrreversibleActions: boolean;
  /** 전체 재로드 필요 여부 (false = targeted만) */
  requiresFullReload: boolean;
}

// ══════════════════════════════════════════════
// Event → Invalidation Mapping
// ══════════════════════════════════════════════

const INVALIDATION_MAP: Record<DispatchInvalidationEventType, {
  targets: InvalidationTarget[];
  blockerRecalc: DispatchBlockerType[];
  readinessImpact: InvalidationResult["readinessImpact"];
  lockIrreversible: boolean;
}> = {
  po_conversion_completed: {
    targets: ["dispatch_readiness", "po_created_record", "blocker_list", "confirmation_checklist", "dock_actions"],
    blockerRecalc: [],
    readinessImpact: "may_unblock",
    lockIrreversible: false,
  },
  po_conversion_reopened: {
    targets: ["dispatch_readiness", "po_created_record", "snapshot_validity", "blocker_list", "supplier_payload", "dock_actions"],
    blockerRecalc: ["snapshot_invalidated", "po_data_changed_after_approval"],
    readinessImpact: "may_block",
    lockIrreversible: true,
  },
  supplier_profile_changed: {
    targets: ["dispatch_readiness", "supplier_payload", "blocker_list", "confirmation_checklist"],
    blockerRecalc: ["supplier_mismatch", "supplier_profile_changed", "shipping_contact_incomplete"],
    readinessImpact: "may_block",
    lockIrreversible: true,
  },
  approval_snapshot_invalidated: {
    targets: ["dispatch_readiness", "snapshot_validity", "blocker_list", "dock_actions"],
    blockerRecalc: ["snapshot_invalidated", "approval_expired"],
    readinessImpact: "may_block",
    lockIrreversible: true,
  },
  policy_hold_changed: {
    targets: ["dispatch_readiness", "blocker_list", "dock_actions"],
    blockerRecalc: ["policy_hold_active"],
    readinessImpact: "may_block",
    lockIrreversible: true,
  },
  attachment_changed: {
    targets: ["dispatch_readiness", "supplier_payload", "blocker_list", "confirmation_checklist"],
    blockerRecalc: ["required_document_missing"],
    readinessImpact: "may_unblock",
    lockIrreversible: false,
  },
  send_scheduled: {
    targets: ["schedule_state", "dock_actions"],
    blockerRecalc: [],
    readinessImpact: "schedule_change",
    lockIrreversible: false,
  },
  schedule_cancelled: {
    targets: ["schedule_state", "dispatch_readiness", "dock_actions"],
    blockerRecalc: [],
    readinessImpact: "schedule_change",
    lockIrreversible: false,
  },
  po_data_changed_after_approval: {
    targets: ["dispatch_readiness", "snapshot_validity", "blocker_list", "confirmation_checklist", "dock_actions"],
    blockerRecalc: ["po_data_changed_after_approval", "snapshot_invalidated"],
    readinessImpact: "may_block",
    lockIrreversible: true,
  },
};

// ══════════════════════════════════════════════
// Core: 이벤트 → InvalidationResult 계산
// ══════════════════════════════════════════════

export function computeInvalidation(event: DispatchInvalidationEvent): InvalidationResult {
  const mapping = INVALIDATION_MAP[event.type];

  return {
    event: event.type,
    targets: mapping.targets,
    blockerRecalc: mapping.blockerRecalc,
    readinessImpact: mapping.readinessImpact,
    lockIrreversibleActions: mapping.lockIrreversible,
    requiresFullReload: false, // targeted invalidation만 사용
  };
}

/**
 * 다중 이벤트의 invalidation 결과를 병합.
 * broad refresh로 회귀하지 않고, 각 이벤트의 target을 합집합으로 처리.
 */
export function mergeInvalidations(results: InvalidationResult[]): InvalidationResult {
  if (results.length === 0) {
    return {
      event: "po_conversion_completed",
      targets: [],
      blockerRecalc: [],
      readinessImpact: "no_change",
      lockIrreversibleActions: false,
      requiresFullReload: false,
    };
  }

  const allTargets = new Set<InvalidationTarget>();
  const allBlockerRecalc = new Set<DispatchBlockerType>();
  let shouldLock = false;
  let impact: InvalidationResult["readinessImpact"] = "no_change";

  for (const r of results) {
    r.targets.forEach(t => allTargets.add(t));
    r.blockerRecalc.forEach(b => allBlockerRecalc.add(b));
    if (r.lockIrreversibleActions) shouldLock = true;
    // may_block이 하나라도 있으면 may_block으로
    if (r.readinessImpact === "may_block") impact = "may_block";
    else if (r.readinessImpact === "schedule_change" && impact !== "may_block") impact = "schedule_change";
    else if (r.readinessImpact === "may_unblock" && impact === "no_change") impact = "may_unblock";
  }

  return {
    event: results[results.length - 1].event,
    targets: Array.from(allTargets),
    blockerRecalc: Array.from(allBlockerRecalc),
    readinessImpact: impact,
    lockIrreversibleActions: shouldLock,
    requiresFullReload: false,
  };
}

// ══════════════════════════════════════════════
// Readiness recalculation trigger
// ══════════════════════════════════════════════

export interface ReadinessRecalcInput {
  currentReadiness: DispatchGovernanceReadiness;
  invalidation: InvalidationResult;
}

/**
 * Invalidation 결과에 따라 readiness 재계산이 필요한지 판단.
 * 실제 재계산은 evaluateDispatchGovernance()를 다시 호출해야 함.
 * 여기서는 "재계산 필요 여부"만 반환.
 */
export function shouldRecalcReadiness(input: ReadinessRecalcInput): boolean {
  const { currentReadiness, invalidation } = input;

  // schedule 변경은 readiness 재계산 불필요
  if (invalidation.readinessImpact === "schedule_change") return false;
  if (invalidation.readinessImpact === "no_change") return false;

  // may_block인데 이미 blocked면 blocker 목록만 업데이트 필요
  if (invalidation.readinessImpact === "may_block" && currentReadiness === "blocked") {
    return invalidation.blockerRecalc.length > 0;
  }

  // may_unblock인데 현재 blocked/needs_review면 재계산
  if (invalidation.readinessImpact === "may_unblock" && (currentReadiness === "blocked" || currentReadiness === "needs_review")) {
    return true;
  }

  // may_block인데 현재 ready_to_send면 재계산 필수
  if (invalidation.readinessImpact === "may_block" && currentReadiness === "ready_to_send") {
    return true;
  }

  return invalidation.targets.includes("dispatch_readiness");
}

// ══════════════════════════════════════════════
// Dock action lock 판단
// ══════════════════════════════════════════════

export interface DockActionLockState {
  sendNowLocked: boolean;
  scheduleSendLocked: boolean;
  requestCorrectionEnabled: boolean;
  reopenConversionEnabled: boolean;
  cancelPrepEnabled: boolean;
  lockReason: string | null;
}

export function computeDockLocks(
  readiness: DispatchGovernanceReadiness,
  invalidation: InvalidationResult | null,
  snapshotValid: boolean,
  allConfirmed: boolean,
): DockActionLockState {
  // CLAUDE.md: snapshot validity fail이면 dock의 irreversible action을 잠금
  const snapshotBlocked = !snapshotValid;
  const irreversibleLocked = snapshotBlocked || (invalidation?.lockIrreversibleActions ?? false);

  const isReady = readiness === "ready_to_send" && allConfirmed && !irreversibleLocked;

  return {
    sendNowLocked: !isReady,
    scheduleSendLocked: !isReady,
    requestCorrectionEnabled: readiness === "blocked" || readiness === "needs_review",
    reopenConversionEnabled: readiness !== "sent",
    cancelPrepEnabled: readiness !== "sent",
    lockReason: snapshotBlocked
      ? "Snapshot 무효 — 재승인 또는 PO 전환 재실행 필요"
      : irreversibleLocked
        ? "유효성 검증 실패 — 발송 불가"
        : readiness !== "ready_to_send"
          ? "발송 준비 미완료"
          : !allConfirmed
            ? "확인 체크리스트 미완료"
            : null,
  };
}
