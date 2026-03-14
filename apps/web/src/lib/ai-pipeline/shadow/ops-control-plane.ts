/**
 * Ops Control Plane — 운영자 액션 단일 계층
 *
 * 모든 운영 액션은 이 계층을 통해 실행:
 *  - request/approve/reject promotion
 *  - force hold / rollback / emergency off
 *  - auto-verify enable/disable
 *  - exclusion update
 *  - certification re-run
 *  - review sample export
 *  - stabilization complete marking
 *
 * 각 액션은 audit/event와 연결.
 */

import type { LifecycleState } from "./rollout-state-machine";
import { validateTransition, toCanaryStage } from "./rollout-state-machine";
import { createApprovalRequest, approveRequest, rejectRequest, markExecuted, getValidApproval, requiresApproval } from "./approval-store";
import { runTransitionGuard } from "./stage-transition-guard";
import { runCertification } from "./certification-runner";
import { updateRegistryEntry, getRegistryEntry } from "./doctype-registry";
import { emitAlert, alertRollback } from "./alerting-service";
import type { ApprovalRecord } from "./approval-store";
import type { CertificationReport } from "./certification-runner";

// ── Action Result ──

export interface OpsActionResult {
  success: boolean;
  action: string;
  documentType: string;
  detail: string;
  approvalId?: string;
  certificationId?: string;
  previousState?: LifecycleState;
  newState?: LifecycleState;
}

// ── Actions ──

/**
 * 승격 요청 (approval 생성)
 */
export async function requestPromotion(params: {
  documentType: string;
  requestedBy: string;
  notes: string;
  basisReportIds: string[];
}): Promise<OpsActionResult> {
  const entry = getRegistryEntry(params.documentType);
  if (!entry) {
    return { success: false, action: "REQUEST_PROMOTION", documentType: params.documentType, detail: "Registry 미등록" };
  }

  const from = entry.lifecycleState;
  const transition = validateTransition({
    documentType: params.documentType,
    from,
    to: getNextStage(from),
    type: "PROMOTE",
    requestedBy: params.requestedBy,
    reason: params.notes,
  });

  if (!transition.allowed) {
    return { success: false, action: "REQUEST_PROMOTION", documentType: params.documentType, detail: transition.errors.join("; ") };
  }

  // Dry-run certification
  const cert = await runCertification({
    documentType: params.documentType,
    from,
    to: transition.to,
    mode: "DRY_RUN",
  });

  if (cert.result === "FAIL") {
    return {
      success: false,
      action: "REQUEST_PROMOTION",
      documentType: params.documentType,
      detail: `Certification FAIL: ${cert.failures.join("; ")}`,
      certificationId: cert.id,
    };
  }

  const approval = createApprovalRequest({
    documentType: params.documentType,
    currentStage: from,
    proposedStage: transition.to,
    proposedRestrictedAutoVerify: entry.restrictedAutoVerifyEnabled,
    decisionType: `PROMOTE_${from}_TO_${transition.to}`,
    basisReportIds: params.basisReportIds,
    requestedBy: params.requestedBy,
    notes: params.notes,
  });

  updateRegistryEntry(params.documentType, { approvalStatus: "PENDING" });

  return {
    success: true,
    action: "REQUEST_PROMOTION",
    documentType: params.documentType,
    detail: `승격 요청 생성 (${from} → ${transition.to})`,
    approvalId: approval.id,
    certificationId: cert.id,
  };
}

/**
 * 승격 승인 + 집행
 */
export async function approvePromotion(params: {
  approvalId: string;
  approvedBy: string;
  notes?: string;
}): Promise<OpsActionResult> {
  const approved = approveRequest(params.approvalId, params.approvedBy, params.notes);
  if (!approved) {
    return { success: false, action: "APPROVE_PROMOTION", documentType: "unknown", detail: "승인 실패 (미존재/만료/이미 처리)" };
  }

  // Launch certification
  const cert = await runCertification({
    documentType: approved.documentType,
    from: approved.currentStage,
    to: approved.proposedStage,
    mode: "LAUNCH",
    approvalId: approved.id,
  });

  if (cert.result === "FAIL") {
    return {
      success: false,
      action: "APPROVE_PROMOTION",
      documentType: approved.documentType,
      detail: `Launch Certification FAIL: ${cert.failures.join("; ")}`,
      certificationId: cert.id,
    };
  }

  // Guard
  const guard = await runTransitionGuard(
    approved.documentType, approved.currentStage, approved.proposedStage, approved.id,
  );
  if (!guard.allowed) {
    return {
      success: false,
      action: "APPROVE_PROMOTION",
      documentType: approved.documentType,
      detail: `Guard 차단: ${guard.blockingReasons.join("; ")}`,
    };
  }

  // Execute transition
  markExecuted(approved.id);
  updateRegistryEntry(approved.documentType, {
    lifecycleState: approved.proposedStage,
    currentStage: toCanaryStage(approved.proposedStage),
    lastPromotionAt: new Date().toISOString(),
    approvalStatus: "APPROVED",
    restrictedAutoVerifyEnabled: approved.proposedRestrictedAutoVerify,
  });

  return {
    success: true,
    action: "APPROVE_PROMOTION",
    documentType: approved.documentType,
    detail: `승격 완료: ${approved.currentStage} → ${approved.proposedStage}`,
    approvalId: approved.id,
    previousState: approved.currentStage,
    newState: approved.proposedStage,
  };
}

/**
 * 승격 거부
 */
export function rejectPromotion(params: {
  approvalId: string;
  rejectedBy: string;
  notes?: string;
}): OpsActionResult {
  const rejected = rejectRequest(params.approvalId, params.rejectedBy, params.notes);
  if (!rejected) {
    return { success: false, action: "REJECT_PROMOTION", documentType: "unknown", detail: "거부 실패" };
  }
  updateRegistryEntry(rejected.documentType, { approvalStatus: "REJECTED" });
  return {
    success: true,
    action: "REJECT_PROMOTION",
    documentType: rejected.documentType,
    detail: `승격 거부: ${rejected.currentStage} → ${rejected.proposedStage}`,
  };
}

/**
 * 즉시 롤백 (approval 불필요)
 */
export async function rollbackToStage(params: {
  documentType: string;
  targetStage: LifecycleState;
  executedBy: string;
  reason: string;
}): Promise<OpsActionResult> {
  const entry = getRegistryEntry(params.documentType);
  if (!entry) {
    return { success: false, action: "ROLLBACK", documentType: params.documentType, detail: "Registry 미등록" };
  }

  const from = entry.lifecycleState;
  const transition = validateTransition({
    documentType: params.documentType,
    from,
    to: params.targetStage,
    type: "ROLLBACK",
    requestedBy: params.executedBy,
    reason: params.reason,
  });

  if (!transition.allowed) {
    return { success: false, action: "ROLLBACK", documentType: params.documentType, detail: transition.errors.join("; ") };
  }

  updateRegistryEntry(params.documentType, {
    lifecycleState: params.targetStage,
    currentStage: toCanaryStage(params.targetStage),
    lastRollbackAt: new Date().toISOString(),
    restrictedAutoVerifyEnabled: false,
  });

  alertRollback(params.documentType, from, params.targetStage, params.reason);

  return {
    success: true,
    action: "ROLLBACK",
    documentType: params.documentType,
    detail: `롤백 완료: ${from} → ${params.targetStage}`,
    previousState: from,
    newState: params.targetStage,
  };
}

/**
 * Emergency OFF (전체 비활성)
 */
export function emergencyOff(params: {
  documentType: string;
  executedBy: string;
  reason: string;
}): OpsActionResult {
  const entry = getRegistryEntry(params.documentType);
  const from = entry?.lifecycleState ?? "OFF";

  updateRegistryEntry(params.documentType, {
    lifecycleState: "OFF",
    currentStage: "OFF",
    restrictedAutoVerifyEnabled: false,
  });

  emitAlert({
    severity: "CRITICAL",
    documentType: params.documentType,
    stage: from,
    eventType: "ROLLBACK_TRIGGERED",
    impact: `Emergency OFF: ${params.reason}`,
    recommendedAction: "INVESTIGATE_ROOT_CAUSE",
  });

  return {
    success: true,
    action: "EMERGENCY_OFF",
    documentType: params.documentType,
    detail: `Emergency OFF 실행: ${from} → OFF`,
    previousState: from,
    newState: "OFF",
  };
}

/**
 * Restricted Auto-Verify 비활성
 */
export function disableAutoVerify(params: {
  documentType: string;
  executedBy: string;
  reason: string;
}): OpsActionResult {
  updateRegistryEntry(params.documentType, {
    restrictedAutoVerifyEnabled: false,
  });

  const entry = getRegistryEntry(params.documentType);
  emitAlert({
    severity: "HIGH",
    documentType: params.documentType,
    stage: entry?.lifecycleState ?? "OFF",
    eventType: "RESTRICTED_AUTO_VERIFY_KILL",
    impact: params.reason,
    recommendedAction: "REVIEW_AUTO_VERIFY_SAFETY",
  });

  return {
    success: true,
    action: "DISABLE_AUTO_VERIFY",
    documentType: params.documentType,
    detail: "Restricted auto-verify 비활성 완료",
  };
}

/**
 * Force Hold (현 stage 유지, 승격 동결)
 */
export function forceHold(params: {
  documentType: string;
  executedBy: string;
  reason: string;
}): OpsActionResult {
  updateRegistryEntry(params.documentType, {
    approvalStatus: "NONE",
    nextEligibleReviewAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  return {
    success: true,
    action: "FORCE_HOLD",
    documentType: params.documentType,
    detail: `승격 동결: ${params.reason}`,
  };
}

/**
 * Stabilization 완료 마킹
 */
export function markStabilizationComplete(params: {
  documentType: string;
  executedBy: string;
}): OpsActionResult {
  const entry = getRegistryEntry(params.documentType);
  if (entry?.lifecycleState !== "FULL_ACTIVE_WITH_RESTRICTIONS") {
    return { success: false, action: "MARK_STABLE", documentType: params.documentType, detail: "FULL_ACTIVE_WITH_RESTRICTIONS 상태에서만 가능" };
  }

  updateRegistryEntry(params.documentType, {
    lifecycleState: "FULL_ACTIVE_STABLE",
    currentOperatingState: "FULL_ACTIVE_STABLE",
    stabilizationStatus: "COMPLETE",
  });

  return {
    success: true,
    action: "MARK_STABLE",
    documentType: params.documentType,
    detail: "FULL_ACTIVE_STABLE 전환 완료",
    previousState: "FULL_ACTIVE_WITH_RESTRICTIONS",
    newState: "FULL_ACTIVE_STABLE",
  };
}

// ── Helper ──

function getNextStage(current: LifecycleState): LifecycleState {
  const order: LifecycleState[] = [
    "OFF", "SHADOW_ONLY", "ACTIVE_5", "ACTIVE_25", "ACTIVE_50",
    "ACTIVE_100", "FULL_ACTIVE_WITH_RESTRICTIONS", "FULL_ACTIVE_STABLE",
  ];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : current;
}
