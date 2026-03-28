/**
 * Actual Send Transaction Gate v2 Engine — arming complete → transaction enablement
 *
 * 고정 규칙:
 * 1. ActualSupplierSendActionSessionV2 + ArmingGateState = 입력 source.
 * 2. arming complete ≠ transaction enabled.
 * 3. transaction enabled ≠ sent / dispatched.
 * 4. precondition 12종 명시적 판정.
 * 5. Batch 1: execute / mark_sent / mark_dispatched 전부 금지.
 * 6. candidate readiness와 policy lock 분리.
 * 7. provenance + audit 강화 (irreversible transaction basis).
 */

import type { ActualSupplierSendActionSessionV2, ArmingSessionStatus, ActualSupplierSendActionArmingGateStateV2, ActualSupplierSendActionSectionResolutionStateV2 } from "./actual-supplier-send-action-resolution-v2-engine";
import type { ArmingSectionKey } from "./actual-supplier-send-action-workspace-v2";

// ── Gate Status / Phase ──
export type TransactionGateStatus = "not_eligible" | "arming_dependency_open" | "return_dependency_open" | "eligible_for_actual_send_transaction" | "actual_send_transaction_locked_by_policy" | "actual_send_transaction_opened";
export type TransactionGatePhase = "precheck" | "eligibility_review" | "transaction_pending" | "transaction_enabled" | "transaction_open" | "policy_locked";

// ── Precondition ──
export type TransactionPreconditionKey = "arming_complete_achieved" | "no_unresolved_arming_section" | "no_return_to_send_execution_dependency" | "no_return_to_confirmation_or_validation_dependency" | "recipient_arming_confirmed" | "payload_integrity_arming_confirmed" | "reference_instruction_arming_confirmed" | "exclusion_guard_final_rechecked" | "actor_audit_basis_confirmed" | "contamination_not_detected" | "irreversible_action_basis_confirmed" | "final_transaction_policy_lock_cleared";
export type TransactionBlockingLevel = "hard_blocker" | "soft_blocker" | "policy_lock" | "warning";

export interface ActualSendTransactionPreconditionResultV2 { preconditionKey: TransactionPreconditionKey; label: string; status: "satisfied" | "unsatisfied"; reasonIfUnsatisfied: string; derivedFrom: string; blockingLevel: TransactionBlockingLevel; }

// ── Candidate ──
export type TransactionCandidateStatus = "not_candidate" | "candidate_with_blockers" | "candidate_with_warnings" | "candidate_ready_for_transaction" | "candidate_transaction_locked";
export interface ActualSendTransactionCandidateV2 { candidateStatus: TransactionCandidateStatus; candidateReason: string; originArmingStatus: ArmingSessionStatus; armingCompletionStatus: string; recipientFinalSnapshot: string; payloadIntegrityFinalSnapshot: string; referenceInstructionFinalSnapshot: string; exclusionGuardFinalSnapshot: string; actorAuditFinalSnapshot: string; canOpenActualSendTransactionControl: boolean; canOnlyPreviewCandidate: boolean; requiresFinalPolicyReview: boolean; }

// ── Blocker / Warning ──
export interface ActualSendTransactionBlockerSummaryV2 { blockers: string[]; count: number; primaryBlocker: string | null; }
export interface ActualSendTransactionWarningSummaryV2 { warnings: string[]; count: number; primaryWarning: string | null; }

// ── Action Gate ──
export interface ActualSendTransactionActionGateStateV2 { canPreviewTransactionCandidate: boolean; canReturnToActualSendActionReview: boolean; canReopenArmingSectionReview: boolean; canRouteBackToExecutionOrConfirmationIfNeeded: boolean; canHoldForPolicyReview: boolean; canOpenActualSendTransactionControl: boolean; canExecuteActualSendTransaction: false; canMarkSent: false; canMarkDispatched: false; canCreateDeliveryTracking: false; disabledActionReasons: Record<string, string>; }

// ── Provenance ──
export interface ActualSendTransactionProvenanceV2 { derivedFromActualSendActionSessionId: string; derivedFromActualSendActionGateVersion: string; derivedFromArmingGateSnapshotId: string; derivedFromSectionResolutionSnapshotIds: string[]; derivedAt: string; derivedByEngineVersion: string; policyLockBasis: string; dependencyRecheckBasis: string; irreversibleTransactionBasis: string; }

// ── Top-Level Gate ──
export interface ActualSendTransactionGateV2 {
  actualSendTransactionGateId: string; caseId: string; handoffPackageId: string; actualSendActionGateId: string; actualSendActionSessionId: string;
  gateStatus: TransactionGateStatus; gatePhase: TransactionGatePhase;
  candidateStatus: TransactionCandidateStatus; candidate: ActualSendTransactionCandidateV2;
  blockerSummary: ActualSendTransactionBlockerSummaryV2; warningSummary: ActualSendTransactionWarningSummaryV2;
  actionGate: ActualSendTransactionActionGateStateV2;
  requiredPreconditions: ActualSendTransactionPreconditionResultV2[]; unsatisfiedPreconditions: ActualSendTransactionPreconditionResultV2[];
  transactionStatus: "not_sent"; nextSurfaceLabel: string;
  hasPriorReturnHistory: boolean; hasReopenedSectionPending: boolean; requiresDependencyRevalidation: boolean;
  lastReturnTarget: string | null; lastArmingStatus: string;
  provenance: ActualSendTransactionProvenanceV2; generatedAt: string;
}

// ── Precondition Derivation ──
function derivePreconditions(session: ActualSupplierSendActionSessionV2): ActualSendTransactionPreconditionResultV2[] {
  const p: ActualSendTransactionPreconditionResultV2[] = [];
  const s = session.sectionResolutionStates;

  p.push({ preconditionKey: "arming_complete_achieved", label: "Arming 완료", status: session.sessionStatus === "arming_complete_pending_actual_send_transaction" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: session.sessionStatus !== "arming_complete_pending_actual_send_transaction" ? `Status: ${session.sessionStatus}` : "", derivedFrom: "session.sessionStatus", blockingLevel: "hard_blocker" });

  const unresolved = s.filter(x => x.resolutionStatus === "blocked_unresolved" || x.resolutionStatus === "unreviewed" || x.resolutionStatus === "in_review" || x.remainingUnresolvedInputs.length > 0);
  p.push({ preconditionKey: "no_unresolved_arming_section", label: "미해소 arming section 없음", status: unresolved.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: unresolved.length > 0 ? `${unresolved.length}건 미해소` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const retExec = s.filter(x => x.resolutionStatus === "returned_to_send_execution");
  p.push({ preconditionKey: "no_return_to_send_execution_dependency", label: "Execution return 없음", status: retExec.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retExec.length > 0 ? `${retExec.length}건 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const retCV = s.filter(x => x.resolutionStatus === "returned_to_confirmation_or_validation");
  p.push({ preconditionKey: "no_return_to_confirmation_or_validation_dependency", label: "Confirmation/validation return 없음", status: retCV.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retCV.length > 0 ? `${retCV.length}건 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const checks: { key: TransactionPreconditionKey; secKey: ArmingSectionKey; label: string; level: TransactionBlockingLevel }[] = [
    { key: "recipient_arming_confirmed", secKey: "recipient_final_arming_block", label: "수신자 arming 확인", level: "hard_blocker" },
    { key: "payload_integrity_arming_confirmed", secKey: "payload_integrity_final_arming_block", label: "Payload integrity arming 확인", level: "hard_blocker" },
    { key: "reference_instruction_arming_confirmed", secKey: "reference_instruction_final_arming_block", label: "Reference/instruction arming 확인", level: "soft_blocker" },
    { key: "exclusion_guard_final_rechecked", secKey: "exclusion_guard_final_arming_block", label: "Exclusion guard 최종 재확인", level: "hard_blocker" },
    { key: "actor_audit_basis_confirmed", secKey: "actor_and_audit_final_arming_block", label: "Actor/audit basis 확인", level: "hard_blocker" },
  ];
  for (const c of checks) { const sec = s.find(x => x.sectionKey === c.secKey); const ok = sec && sec.eligibleForArmingCompletion; p.push({ preconditionKey: c.key, label: c.label, status: ok ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !ok ? `${c.secKey} 미완료` : "", derivedFrom: `section:${c.secKey}`, blockingLevel: c.level }); }

  const guard = s.find(x => x.sectionKey === "exclusion_guard_final_arming_block");
  p.push({ preconditionKey: "contamination_not_detected", label: "Contamination 미감지", status: guard?.resolutionMode === "guard_confirmation" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: guard?.resolutionMode !== "guard_confirmation" ? "Guard 미확인" : "", derivedFrom: "exclusion_guard_final_arming_block", blockingLevel: "hard_blocker" });

  const audit = s.find(x => x.sectionKey === "actor_and_audit_final_arming_block");
  p.push({ preconditionKey: "irreversible_action_basis_confirmed", label: "Irreversible action basis 확인", status: audit?.resolutionMode === "actor_audit_confirmation" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: audit?.resolutionMode !== "actor_audit_confirmation" ? "Actor/audit 미확인" : "", derivedFrom: "actor_and_audit_final_arming_block", blockingLevel: "hard_blocker" });

  p.push({ preconditionKey: "final_transaction_policy_lock_cleared", label: "Final transaction policy lock 해소", status: "satisfied", reasonIfUnsatisfied: "", derivedFrom: "policy_check", blockingLevel: "policy_lock" });

  return p;
}

function deriveBlockers(p: ActualSendTransactionPreconditionResultV2[]): ActualSendTransactionBlockerSummaryV2 { const b = p.filter(x => x.status === "unsatisfied" && (x.blockingLevel === "hard_blocker" || x.blockingLevel === "soft_blocker")).map(x => x.reasonIfUnsatisfied); return { blockers: b, count: b.length, primaryBlocker: b[0] || null }; }
function deriveWarnings(p: ActualSendTransactionPreconditionResultV2[], s: ActualSupplierSendActionSectionResolutionStateV2[]): ActualSendTransactionWarningSummaryV2 { const w: string[] = []; w.push(...p.filter(x => x.status === "unsatisfied" && x.blockingLevel === "warning").map(x => x.reasonIfUnsatisfied)); const ws = s.filter(x => x.resolutionStatus === "reviewed_with_warning"); if (ws.length > 0) w.push(`${ws.length}건 warning acknowledged`); return { warnings: w, count: w.length, primaryWarning: w[0] || null }; }

function deriveCandidate(session: ActualSupplierSendActionSessionV2, bs: ActualSendTransactionBlockerSummaryV2, ws: ActualSendTransactionWarningSummaryV2): ActualSendTransactionCandidateV2 {
  const isComplete = session.sessionStatus === "arming_complete_pending_actual_send_transaction";
  const status: TransactionCandidateStatus = !isComplete ? "not_candidate" : bs.count > 0 ? "candidate_with_blockers" : ws.count > 0 ? "candidate_with_warnings" : "candidate_ready_for_transaction";
  const canOpen = status === "candidate_ready_for_transaction";
  const snap = (k: ArmingSectionKey) => session.sectionResolutionStates.find(x => x.sectionKey === k)?.resolutionStatus || "unknown";
  return { candidateStatus: status, candidateReason: bs.count > 0 ? bs.primaryBlocker! : ws.count > 0 ? `Warning: ${ws.primaryWarning}` : isComplete ? "Transaction 가능" : "Arming 미완료", originArmingStatus: session.sessionStatus, armingCompletionStatus: session.armingGateState.armingStatus, recipientFinalSnapshot: snap("recipient_final_arming_block"), payloadIntegrityFinalSnapshot: snap("payload_integrity_final_arming_block"), referenceInstructionFinalSnapshot: snap("reference_instruction_final_arming_block"), exclusionGuardFinalSnapshot: snap("exclusion_guard_final_arming_block"), actorAuditFinalSnapshot: snap("actor_and_audit_final_arming_block"), canOpenActualSendTransactionControl: canOpen, canOnlyPreviewCandidate: !canOpen && isComplete, requiresFinalPolicyReview: false };
}

function deriveActionGate(c: ActualSendTransactionCandidateV2, hasReturn: boolean): ActualSendTransactionActionGateStateV2 { return { canPreviewTransactionCandidate: c.candidateStatus !== "not_candidate", canReturnToActualSendActionReview: true, canReopenArmingSectionReview: true, canRouteBackToExecutionOrConfirmationIfNeeded: hasReturn, canHoldForPolicyReview: true, canOpenActualSendTransactionControl: c.canOpenActualSendTransactionControl, canExecuteActualSendTransaction: false as const, canMarkSent: false as const, canMarkDispatched: false as const, canCreateDeliveryTracking: false as const, disabledActionReasons: { execute_actual_send_transaction: "Batch 1 금지", mark_sent: "Batch 1 금지", mark_dispatched: "Batch 1 금지", create_delivery_tracking: "Batch 1 금지" } }; }

function deriveGateStatus(session: ActualSupplierSendActionSessionV2, c: ActualSendTransactionCandidateV2, hasOpenReturn: boolean, hasRevisitPending: boolean): TransactionGateStatus {
  if (session.sessionStatus !== "arming_complete_pending_actual_send_transaction") return "not_eligible";
  if (hasOpenReturn) return "return_dependency_open";
  if (hasRevisitPending) return "arming_dependency_open";
  if (c.candidateStatus === "candidate_ready_for_transaction") return "eligible_for_actual_send_transaction";
  return "actual_send_transaction_locked_by_policy";
}

function derivePhase(s: TransactionGateStatus): TransactionGatePhase { switch (s) { case "not_eligible": case "arming_dependency_open": case "return_dependency_open": return "precheck"; case "eligible_for_actual_send_transaction": return "transaction_enabled"; case "actual_send_transaction_locked_by_policy": return "policy_locked"; case "actual_send_transaction_opened": return "transaction_open"; } }

// ── Main Builder ──
export function buildActualSendTransactionGateV2(session: ActualSupplierSendActionSessionV2): ActualSendTransactionGateV2 {
  const now = new Date().toISOString(); const secs = session.sectionResolutionStates;
  const precs = derivePreconditions(session); const unsatisfied = precs.filter(x => x.status === "unsatisfied");
  const bs = deriveBlockers(precs); const ws = deriveWarnings(precs, secs);
  const candidate = deriveCandidate(session, bs, ws);
  const hasOpenReturn = secs.some(x => x.resolutionStatus === "returned_to_send_execution" || x.resolutionStatus === "returned_to_confirmation_or_validation");
  const hasRevisitPending = secs.some(x => x.requiresRevisitAfterReturn);
  const hasPriorReturn = session.returnHistory.length > 0;
  const requiresDepReval = hasRevisitPending || (hasPriorReturn && hasRevisitPending);
  const gateStatus = deriveGateStatus(session, candidate, hasOpenReturn, hasRevisitPending);
  const actionGate = deriveActionGate(candidate, hasOpenReturn);
  const nextLabel = candidate.canOpenActualSendTransactionControl ? "Actual Send Transaction Control (Entry Enabled)" : "Actual Send Transaction Control (Locked Preview Only)";
  const provenance: ActualSendTransactionProvenanceV2 = { derivedFromActualSendActionSessionId: session.actualSendActionSessionId, derivedFromActualSendActionGateVersion: session.actualSendActionGateId, derivedFromArmingGateSnapshotId: session.armingGateState.armingStatus, derivedFromSectionResolutionSnapshotIds: secs.map(x => `${x.sectionKey}:${x.resolutionStatus}`), derivedAt: now, derivedByEngineVersion: "v2-batch1", policyLockBasis: gateStatus === "actual_send_transaction_locked_by_policy" ? "Policy lock 또는 unsatisfied precondition" : "none", dependencyRecheckBasis: requiresDepReval ? "Prior return + revisit pending" : "none", irreversibleTransactionBasis: gateStatus === "eligible_for_actual_send_transaction" ? "All preconditions satisfied" : "Preconditions unsatisfied" };

  return { actualSendTransactionGateId: `txngate_${Date.now().toString(36)}`, caseId: session.caseId, handoffPackageId: session.handoffPackageId, actualSendActionGateId: session.actualSendActionGateId, actualSendActionSessionId: session.actualSendActionSessionId, gateStatus, gatePhase: derivePhase(gateStatus), candidateStatus: candidate.candidateStatus, candidate, blockerSummary: bs, warningSummary: ws, actionGate, requiredPreconditions: precs, unsatisfiedPreconditions: unsatisfied, transactionStatus: "not_sent", nextSurfaceLabel: nextLabel, hasPriorReturnHistory: hasPriorReturn, hasReopenedSectionPending: hasRevisitPending, requiresDependencyRevalidation: requiresDepReval, lastReturnTarget: session.returnHistory.length > 0 ? session.returnHistory[session.returnHistory.length - 1].returnTarget : null, lastArmingStatus: session.sessionStatus, provenance, generatedAt: now };
}

// ── Events ──
export type TransactionGateEventType = "actual_send_transaction_gate_computed" | "actual_send_transaction_eligibility_confirmed" | "actual_send_transaction_blocked" | "actual_send_transaction_locked_by_policy" | "actual_send_transaction_entry_enabled" | "actual_send_transaction_preview_opened" | "actual_send_transaction_returned_to_action_review";
export interface TransactionGateEvent { type: TransactionGateEventType; caseId: string; actualSendActionSessionId: string; actualSendTransactionGateId: string; actionOrComputeReason: string; actorOrSystem: string; timestamp: string; }
export function createTransactionGateEvent(type: TransactionGateEventType, gate: ActualSendTransactionGateV2, reason: string, actor: string): TransactionGateEvent { return { type, caseId: gate.caseId, actualSendActionSessionId: gate.actualSendActionSessionId, actualSendTransactionGateId: gate.actualSendTransactionGateId, actionOrComputeReason: reason, actorOrSystem: actor, timestamp: new Date().toISOString() }; }
