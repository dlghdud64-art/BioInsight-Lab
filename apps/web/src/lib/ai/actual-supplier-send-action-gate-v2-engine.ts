/**
 * Actual Supplier Send Action Gate v2 Engine — execution ready → send action enablement
 *
 * 고정 규칙:
 * 1. SendExecutionSessionV2 + ReadyGateState = 입력 source.
 * 2. execution ready ≠ actual send action enabled.
 * 3. actual send enabled ≠ dispatched.
 * 4. irreversible boundary — arming과 execution 분리.
 * 5. precondition 12종 명시적 판정.
 * 6. Batch 1: execute_actual_send / mark_dispatched 금지.
 * 7. candidate readiness와 policy lock 분리.
 * 8. provenance + audit 강화 (irreversible action basis 포함).
 */

import type { SendExecutionSessionV2, ExecSessionStatus, SendExecutionReadyGateStateV2, SendExecutionSectionResolutionStateV2 } from "./send-execution-resolution-v2-engine";
import type { SendExecSectionKey } from "./send-execution-workspace-v2";

// ── Gate Status / Phase ──
export type ActualSendGateStatus = "not_eligible" | "execution_dependency_open" | "return_dependency_open" | "eligible_for_actual_send_action" | "actual_send_locked_by_policy" | "actual_send_action_armed";
export type ActualSendGatePhase = "precheck" | "eligibility_review" | "arming_pending" | "armed" | "policy_locked";

// ── Precondition ──
export type ActualSendPreconditionKey = "execution_ready_achieved" | "no_unresolved_execution_section" | "no_return_to_send_confirmation_dependency" | "no_return_to_validation_or_draft_dependency" | "recipient_execution_confirmed" | "payload_integrity_confirmed" | "reference_instruction_confirmed" | "exclusion_guard_rechecked" | "audit_readiness_confirmed" | "contamination_not_detected" | "actor_trace_available" | "final_action_policy_lock_cleared";
export type ActualSendBlockingLevel = "hard_blocker" | "soft_blocker" | "policy_lock" | "warning";

export interface ActualSupplierSendPreconditionResultV2 { preconditionKey: ActualSendPreconditionKey; label: string; status: "satisfied" | "unsatisfied"; reasonIfUnsatisfied: string; derivedFrom: string; blockingLevel: ActualSendBlockingLevel; }

// ── Candidate ──
export type ActualSendCandidateStatus = "not_candidate" | "candidate_with_blockers" | "candidate_with_warnings" | "candidate_ready_for_action" | "candidate_action_locked";

export interface ActualSupplierSendCandidateV2 { candidateStatus: ActualSendCandidateStatus; candidateReason: string; originExecutionStatus: ExecSessionStatus; executionReadyStatus: string; recipientIntegritySnapshot: string; payloadIntegritySnapshot: string; referenceInstructionSnapshot: string; exclusionGuardSnapshot: string; auditReadinessSnapshot: string; canArmActualSendAction: boolean; canOnlyPreviewCandidate: boolean; requiresFinalPolicyReview: boolean; }

// ── Blocker / Warning ──
export interface ActualSupplierSendBlockerSummaryV2 { blockers: string[]; count: number; primaryBlocker: string | null; }
export interface ActualSupplierSendWarningSummaryV2 { warnings: string[]; count: number; primaryWarning: string | null; }

// ── Action Gate ──
export interface ActualSupplierSendActionGateStateV2 { canPreviewActualSendCandidate: boolean; canReturnToSendExecutionReview: boolean; canReopenExecutionSectionReview: boolean; canRouteBackToConfirmationOrValidationIfNeeded: boolean; canHoldForPolicyReview: boolean; canArmActualSendAction: boolean; canExecuteActualSend: false; canMarkDispatched: false; canCreateDeliveryTracking: false; disabledActionReasons: Record<string, string>; }

// ── Provenance ──
export interface ActualSupplierSendProvenanceV2 { derivedFromExecutionSessionId: string; derivedFromExecutionGateVersion: string; derivedFromExecutionReadySnapshotId: string; derivedFromSectionResolutionSnapshotIds: string[]; derivedAt: string; derivedByEngineVersion: string; policyLockBasis: string; dependencyRecheckBasis: string; irreversibleActionBasis: string; }

// ── Top-Level Gate ──
export interface ActualSupplierSendActionGateV2 {
  actualSendActionGateId: string; caseId: string; handoffPackageId: string; sendExecutionGateId: string; executionSessionId: string;
  gateStatus: ActualSendGateStatus; gatePhase: ActualSendGatePhase;
  candidateStatus: ActualSendCandidateStatus; candidate: ActualSupplierSendCandidateV2;
  blockerSummary: ActualSupplierSendBlockerSummaryV2; warningSummary: ActualSupplierSendWarningSummaryV2;
  actionGate: ActualSupplierSendActionGateStateV2;
  requiredPreconditions: ActualSupplierSendPreconditionResultV2[]; unsatisfiedPreconditions: ActualSupplierSendPreconditionResultV2[];
  actualSendStatus: "not_sent"; nextSurfaceLabel: string;
  hasPriorReturnHistory: boolean; hasReopenedSectionPending: boolean; requiresDependencyRevalidation: boolean;
  lastReturnTarget: string | null; lastExecutionStatus: string;
  provenance: ActualSupplierSendProvenanceV2; generatedAt: string;
}

// ── Precondition Derivation ──
function derivePreconditions(session: SendExecutionSessionV2): ActualSupplierSendPreconditionResultV2[] {
  const precs: ActualSupplierSendPreconditionResultV2[] = [];
  const secs = session.sectionResolutionStates;

  precs.push({ preconditionKey: "execution_ready_achieved", label: "Execution ready 달성", status: session.sessionStatus === "execution_ready_pending_actual_send" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: session.sessionStatus !== "execution_ready_pending_actual_send" ? `Status: ${session.sessionStatus}` : "", derivedFrom: "session.sessionStatus", blockingLevel: "hard_blocker" });

  const unresolved = secs.filter(s => s.resolutionStatus === "blocked_unresolved" || s.resolutionStatus === "unreviewed" || s.resolutionStatus === "in_review" || s.remainingUnresolvedInputs.length > 0);
  precs.push({ preconditionKey: "no_unresolved_execution_section", label: "미해소 execution section 없음", status: unresolved.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: unresolved.length > 0 ? `${unresolved.length}건 미해소` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const retConf = secs.filter(s => s.resolutionStatus === "returned_to_send_confirmation");
  precs.push({ preconditionKey: "no_return_to_send_confirmation_dependency", label: "Send confirmation return dependency 없음", status: retConf.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retConf.length > 0 ? `${retConf.length}건 confirmation return 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const retVD = secs.filter(s => s.resolutionStatus === "returned_to_validation_or_draft");
  precs.push({ preconditionKey: "no_return_to_validation_or_draft_dependency", label: "Validation/draft return dependency 없음", status: retVD.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retVD.length > 0 ? `${retVD.length}건 validation/draft return 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const secChecks: { key: ActualSendPreconditionKey; secKey: SendExecSectionKey; label: string; level: ActualSendBlockingLevel }[] = [
    { key: "recipient_execution_confirmed", secKey: "recipient_execution_block", label: "수신자 실행 확인", level: "hard_blocker" },
    { key: "payload_integrity_confirmed", secKey: "payload_integrity_execution_block", label: "Payload integrity 확인", level: "hard_blocker" },
    { key: "reference_instruction_confirmed", secKey: "reference_instruction_execution_block", label: "Reference/instruction 확인", level: "soft_blocker" },
    { key: "exclusion_guard_rechecked", secKey: "exclusion_guard_execution_block", label: "Exclusion guard 재확인", level: "hard_blocker" },
    { key: "audit_readiness_confirmed", secKey: "execution_audit_readiness_block", label: "Audit readiness 확인", level: "hard_blocker" },
  ];
  for (const c of secChecks) { const s = secs.find(x => x.sectionKey === c.secKey); const ok = s && s.eligibleForExecutionReady; precs.push({ preconditionKey: c.key, label: c.label, status: ok ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !ok ? `${c.secKey} 미완료` : "", derivedFrom: `section:${c.secKey}`, blockingLevel: c.level }); }

  const guardSec = secs.find(s => s.sectionKey === "exclusion_guard_execution_block");
  const contamOk = guardSec && guardSec.resolutionStatus === "reviewed_complete" && guardSec.resolutionMode === "guard_confirmation";
  precs.push({ preconditionKey: "contamination_not_detected", label: "Contamination 미감지", status: contamOk ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !contamOk ? "Exclusion guard 미확인 또는 contamination risk" : "", derivedFrom: "exclusion_guard_execution_block", blockingLevel: "hard_blocker" });

  const auditSec = secs.find(s => s.sectionKey === "execution_audit_readiness_block");
  const auditOk = auditSec && auditSec.resolutionStatus === "reviewed_complete" && auditSec.resolutionMode === "audit_confirmation";
  precs.push({ preconditionKey: "actor_trace_available", label: "Actor trace 가용", status: auditOk ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !auditOk ? "Audit readiness 미확인" : "", derivedFrom: "execution_audit_readiness_block", blockingLevel: "hard_blocker" });

  precs.push({ preconditionKey: "final_action_policy_lock_cleared", label: "Final action policy lock 해소", status: "satisfied", reasonIfUnsatisfied: "", derivedFrom: "policy_check", blockingLevel: "policy_lock" });

  return precs;
}

// ── Helpers ──
function deriveBlockers(precs: ActualSupplierSendPreconditionResultV2[]): ActualSupplierSendBlockerSummaryV2 { const b = precs.filter(p => p.status === "unsatisfied" && (p.blockingLevel === "hard_blocker" || p.blockingLevel === "soft_blocker")).map(p => p.reasonIfUnsatisfied); return { blockers: b, count: b.length, primaryBlocker: b[0] || null }; }
function deriveWarnings(precs: ActualSupplierSendPreconditionResultV2[], secs: SendExecutionSectionResolutionStateV2[]): ActualSupplierSendWarningSummaryV2 { const w: string[] = []; w.push(...precs.filter(p => p.status === "unsatisfied" && p.blockingLevel === "warning").map(p => p.reasonIfUnsatisfied)); const ws = secs.filter(s => s.resolutionStatus === "reviewed_with_warning"); if (ws.length > 0) w.push(`${ws.length}건 warning acknowledged`); return { warnings: w, count: w.length, primaryWarning: w[0] || null }; }

function deriveCandidate(session: SendExecutionSessionV2, bs: ActualSupplierSendBlockerSummaryV2, ws: ActualSupplierSendWarningSummaryV2): ActualSupplierSendCandidateV2 {
  const isReady = session.sessionStatus === "execution_ready_pending_actual_send";
  const status: ActualSendCandidateStatus = !isReady ? "not_candidate" : bs.count > 0 ? "candidate_with_blockers" : ws.count > 0 ? "candidate_with_warnings" : "candidate_ready_for_action";
  const canArm = status === "candidate_ready_for_action";
  const secs = session.sectionResolutionStates;
  const snap = (k: SendExecSectionKey) => secs.find(s => s.sectionKey === k)?.resolutionStatus || "unknown";
  return { candidateStatus: status, candidateReason: bs.count > 0 ? bs.primaryBlocker! : ws.count > 0 ? `Warning: ${ws.primaryWarning}` : isReady ? "Actual send action armable" : "Execution 미준비", originExecutionStatus: session.sessionStatus, executionReadyStatus: session.readyGateState.readyStatus, recipientIntegritySnapshot: snap("recipient_execution_block"), payloadIntegritySnapshot: snap("payload_integrity_execution_block"), referenceInstructionSnapshot: snap("reference_instruction_execution_block"), exclusionGuardSnapshot: snap("exclusion_guard_execution_block"), auditReadinessSnapshot: snap("execution_audit_readiness_block"), canArmActualSendAction: canArm, canOnlyPreviewCandidate: !canArm && isReady, requiresFinalPolicyReview: false };
}

function deriveActionGate(candidate: ActualSupplierSendCandidateV2, hasReturn: boolean): ActualSupplierSendActionGateStateV2 { return { canPreviewActualSendCandidate: candidate.candidateStatus !== "not_candidate", canReturnToSendExecutionReview: true, canReopenExecutionSectionReview: true, canRouteBackToConfirmationOrValidationIfNeeded: hasReturn, canHoldForPolicyReview: true, canArmActualSendAction: candidate.canArmActualSendAction, canExecuteActualSend: false as const, canMarkDispatched: false as const, canCreateDeliveryTracking: false as const, disabledActionReasons: { execute_actual_send: "Batch 1 정책: actual send 실행 금지", mark_dispatched: "Batch 1 정책: dispatched 처리 금지", create_delivery_tracking: "Batch 1 정책: delivery tracking 생성 금지" } }; }

function deriveGateStatus(session: SendExecutionSessionV2, candidate: ActualSupplierSendCandidateV2, hasOpenReturn: boolean, hasRevisitPending: boolean): ActualSendGateStatus {
  if (session.sessionStatus !== "execution_ready_pending_actual_send") return "not_eligible";
  if (hasOpenReturn) return "return_dependency_open";
  if (hasRevisitPending) return "execution_dependency_open";
  if (candidate.candidateStatus === "candidate_ready_for_action") return "eligible_for_actual_send_action";
  return "actual_send_locked_by_policy";
}

function derivePhase(s: ActualSendGateStatus): ActualSendGatePhase { switch (s) { case "not_eligible": case "execution_dependency_open": case "return_dependency_open": return "precheck"; case "eligible_for_actual_send_action": return "arming_pending"; case "actual_send_locked_by_policy": return "policy_locked"; case "actual_send_action_armed": return "armed"; } }

// ── Main Builder ──
export function buildActualSupplierSendActionGateV2(session: SendExecutionSessionV2): ActualSupplierSendActionGateV2 {
  const now = new Date().toISOString(); const secs = session.sectionResolutionStates;
  const precs = derivePreconditions(session); const unsatisfied = precs.filter(p => p.status === "unsatisfied");
  const bs = deriveBlockers(precs); const ws = deriveWarnings(precs, secs);
  const candidate = deriveCandidate(session, bs, ws);
  const hasOpenReturn = secs.some(s => s.resolutionStatus === "returned_to_send_confirmation" || s.resolutionStatus === "returned_to_validation_or_draft");
  const hasRevisitPending = secs.some(s => s.requiresRevisitAfterReturn);
  const hasPriorReturn = session.returnHistory.length > 0;
  const requiresDepReval = hasRevisitPending || (hasPriorReturn && hasRevisitPending);
  const gateStatus = deriveGateStatus(session, candidate, hasOpenReturn, hasRevisitPending);
  const actionGate = deriveActionGate(candidate, hasOpenReturn);
  const nextLabel = candidate.canArmActualSendAction ? "Actual Supplier Send Action Control (Action Armable)" : "Actual Supplier Send Action Control (Locked Preview Only)";
  const provenance: ActualSupplierSendProvenanceV2 = { derivedFromExecutionSessionId: session.executionSessionId, derivedFromExecutionGateVersion: session.sendExecutionGateId, derivedFromExecutionReadySnapshotId: session.readyGateState.readyStatus, derivedFromSectionResolutionSnapshotIds: secs.map(s => `${s.sectionKey}:${s.resolutionStatus}`), derivedAt: now, derivedByEngineVersion: "v2-batch1", policyLockBasis: gateStatus === "actual_send_locked_by_policy" ? "Policy lock 또는 unsatisfied precondition" : "none", dependencyRecheckBasis: requiresDepReval ? "Prior return + revisit pending" : "none", irreversibleActionBasis: gateStatus === "eligible_for_actual_send_action" ? "All preconditions satisfied — irreversible action armable" : "Preconditions unsatisfied" };

  return { actualSendActionGateId: `actsndgate_${Date.now().toString(36)}`, caseId: session.caseId, handoffPackageId: session.handoffPackageId, sendExecutionGateId: session.sendExecutionGateId, executionSessionId: session.executionSessionId, gateStatus, gatePhase: derivePhase(gateStatus), candidateStatus: candidate.candidateStatus, candidate, blockerSummary: bs, warningSummary: ws, actionGate, requiredPreconditions: precs, unsatisfiedPreconditions: unsatisfied, actualSendStatus: "not_sent", nextSurfaceLabel: nextLabel, hasPriorReturnHistory: hasPriorReturn, hasReopenedSectionPending: hasRevisitPending, requiresDependencyRevalidation: requiresDepReval, lastReturnTarget: session.returnHistory.length > 0 ? session.returnHistory[session.returnHistory.length - 1].returnTarget : null, lastExecutionStatus: session.sessionStatus, provenance, generatedAt: now };
}

// ── Events ──
export type ActualSendGateEventType = "actual_supplier_send_action_gate_computed" | "actual_supplier_send_action_eligibility_confirmed" | "actual_supplier_send_action_blocked" | "actual_supplier_send_action_locked_by_policy" | "actual_supplier_send_action_armable" | "actual_supplier_send_action_preview_opened" | "actual_supplier_send_action_returned_to_execution_review";
export interface ActualSendGateEvent { type: ActualSendGateEventType; caseId: string; executionSessionId: string; actualSendActionGateId: string; actionOrComputeReason: string; actorOrSystem: string; timestamp: string; }
export function createActualSendGateEvent(type: ActualSendGateEventType, gate: ActualSupplierSendActionGateV2, reason: string, actor: string): ActualSendGateEvent { return { type, caseId: gate.caseId, executionSessionId: gate.executionSessionId, actualSendActionGateId: gate.actualSendActionGateId, actionOrComputeReason: reason, actorOrSystem: actor, timestamp: new Date().toISOString() }; }
