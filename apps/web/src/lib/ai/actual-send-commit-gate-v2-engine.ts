/**
 * Actual Send Commit Gate v2 Engine — transaction ready → commit enablement
 *
 * 고정 규칙: transaction ready ≠ commit enabled ≠ sent ≠ dispatched.
 * Batch 1: execute_actual_send_commit / mark_sent / mark_dispatched 전부 금지.
 */

import type { ActualSendTransactionSessionV2, TransactionSessionStatus, ActualSendTransactionCommitReadinessGateStateV2, ActualSendTransactionSectionResolutionStateV2 } from "./actual-send-transaction-resolution-v2-engine";
import type { TransactionSectionKey } from "./actual-send-transaction-workspace-v2";

export type CommitGateStatus = "not_eligible" | "transaction_dependency_open" | "return_dependency_open" | "eligible_for_actual_send_commit" | "actual_send_commit_locked_by_policy" | "actual_send_commit_opened";
export type CommitGatePhase = "precheck" | "eligibility_review" | "commit_pending" | "commit_enabled" | "commit_open" | "policy_locked";

export type CommitPreconditionKey = "transaction_ready_achieved" | "no_unresolved_transaction_section" | "no_return_to_actual_send_action_dependency" | "no_return_to_execution_or_confirmation_dependency" | "recipient_transaction_confirmed" | "payload_integrity_transaction_confirmed" | "reference_instruction_transaction_confirmed" | "exclusion_guard_transaction_rechecked" | "authorization_audit_transaction_confirmed" | "contamination_not_detected" | "irreversible_transaction_basis_confirmed" | "final_commit_policy_lock_cleared";
export type CommitBlockingLevel = "hard_blocker" | "soft_blocker" | "policy_lock" | "warning";

export interface ActualSendCommitPreconditionResultV2 { preconditionKey: CommitPreconditionKey; label: string; status: "satisfied" | "unsatisfied"; reasonIfUnsatisfied: string; derivedFrom: string; blockingLevel: CommitBlockingLevel; }

export type CommitCandidateStatus = "not_candidate" | "candidate_with_blockers" | "candidate_with_warnings" | "candidate_ready_for_commit" | "candidate_commit_locked";
export interface ActualSendCommitCandidateV2 { candidateStatus: CommitCandidateStatus; candidateReason: string; originTransactionStatus: TransactionSessionStatus; transactionCommitReadinessStatus: string; recipientFinalSnapshot: string; payloadIntegrityFinalSnapshot: string; referenceInstructionFinalSnapshot: string; exclusionGuardFinalSnapshot: string; authorizationAuditFinalSnapshot: string; canOpenActualSendCommitControl: boolean; canOnlyPreviewCandidate: boolean; requiresFinalPolicyReview: boolean; }

export interface ActualSendCommitBlockerSummaryV2 { blockers: string[]; count: number; primaryBlocker: string | null; }
export interface ActualSendCommitWarningSummaryV2 { warnings: string[]; count: number; primaryWarning: string | null; }

export interface ActualSendCommitActionGateStateV2 { canPreviewCommitCandidate: boolean; canReturnToTransactionReview: boolean; canReopenTransactionSectionReview: boolean; canRouteBackToActionOrExecutionIfNeeded: boolean; canHoldForPolicyReview: boolean; canOpenActualSendCommitControl: boolean; canExecuteActualSendCommit: false; canMarkSent: false; canMarkDispatched: false; canCreateDeliveryTracking: false; disabledActionReasons: Record<string, string>; }

export interface ActualSendCommitProvenanceV2 { derivedFromTransactionSessionId: string; derivedFromTransactionGateVersion: string; derivedFromCommitReadinessSnapshotId: string; derivedFromSectionResolutionSnapshotIds: string[]; derivedAt: string; derivedByEngineVersion: string; policyLockBasis: string; dependencyRecheckBasis: string; irreversibleCommitBasis: string; }

export interface ActualSendCommitGateV2 {
  actualSendCommitGateId: string; caseId: string; handoffPackageId: string; actualSendTransactionGateId: string; actualSendTransactionSessionId: string;
  gateStatus: CommitGateStatus; gatePhase: CommitGatePhase;
  candidateStatus: CommitCandidateStatus; candidate: ActualSendCommitCandidateV2;
  blockerSummary: ActualSendCommitBlockerSummaryV2; warningSummary: ActualSendCommitWarningSummaryV2;
  actionGate: ActualSendCommitActionGateStateV2;
  requiredPreconditions: ActualSendCommitPreconditionResultV2[]; unsatisfiedPreconditions: ActualSendCommitPreconditionResultV2[];
  commitStatus: "not_committed"; nextSurfaceLabel: string;
  hasPriorReturnHistory: boolean; hasReopenedSectionPending: boolean; requiresDependencyRevalidation: boolean;
  lastReturnTarget: string | null; lastTransactionStatus: string;
  provenance: ActualSendCommitProvenanceV2; generatedAt: string;
}

function derivePreconditions(session: ActualSendTransactionSessionV2): ActualSendCommitPreconditionResultV2[] {
  const p: ActualSendCommitPreconditionResultV2[] = [];
  const s = session.sectionResolutionStates;

  p.push({ preconditionKey: "transaction_ready_achieved", label: "Transaction ready 달성", status: session.sessionStatus === "transaction_ready_pending_commit" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: session.sessionStatus !== "transaction_ready_pending_commit" ? `Status: ${session.sessionStatus}` : "", derivedFrom: "session.sessionStatus", blockingLevel: "hard_blocker" });

  const unresolved = s.filter(x => x.resolutionStatus === "blocked_unresolved" || x.resolutionStatus === "unreviewed" || x.resolutionStatus === "in_review" || x.remainingUnresolvedInputs.length > 0);
  p.push({ preconditionKey: "no_unresolved_transaction_section", label: "미해소 transaction section 없음", status: unresolved.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: unresolved.length > 0 ? `${unresolved.length}건 미해소` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const retAction = s.filter(x => x.resolutionStatus === "returned_to_actual_send_action");
  p.push({ preconditionKey: "no_return_to_actual_send_action_dependency", label: "Action return 없음", status: retAction.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retAction.length > 0 ? `${retAction.length}건 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const retEC = s.filter(x => x.resolutionStatus === "returned_to_execution_or_confirmation");
  p.push({ preconditionKey: "no_return_to_execution_or_confirmation_dependency", label: "Execution/confirmation return 없음", status: retEC.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retEC.length > 0 ? `${retEC.length}건 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const checks: { key: CommitPreconditionKey; secKey: TransactionSectionKey; label: string; level: CommitBlockingLevel }[] = [
    { key: "recipient_transaction_confirmed", secKey: "recipient_transaction_block", label: "수신자 transaction 확인", level: "hard_blocker" },
    { key: "payload_integrity_transaction_confirmed", secKey: "payload_integrity_transaction_block", label: "Payload integrity 확인", level: "hard_blocker" },
    { key: "reference_instruction_transaction_confirmed", secKey: "reference_instruction_transaction_block", label: "Reference/instruction 확인", level: "soft_blocker" },
    { key: "exclusion_guard_transaction_rechecked", secKey: "exclusion_guard_transaction_block", label: "Exclusion guard 재확인", level: "hard_blocker" },
    { key: "authorization_audit_transaction_confirmed", secKey: "actor_authorization_audit_transaction_block", label: "Authorization/audit 확인", level: "hard_blocker" },
  ];
  for (const c of checks) { const sec = s.find(x => x.sectionKey === c.secKey); const ok = sec && sec.eligibleForCommitReadiness; p.push({ preconditionKey: c.key, label: c.label, status: ok ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !ok ? `${c.secKey} 미완료` : "", derivedFrom: `section:${c.secKey}`, blockingLevel: c.level }); }

  const guard = s.find(x => x.sectionKey === "exclusion_guard_transaction_block");
  p.push({ preconditionKey: "contamination_not_detected", label: "Contamination 미감지", status: guard?.resolutionMode === "guard_confirmation" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: guard?.resolutionMode !== "guard_confirmation" ? "Guard 미확인" : "", derivedFrom: "exclusion_guard_transaction_block", blockingLevel: "hard_blocker" });

  const audit = s.find(x => x.sectionKey === "actor_authorization_audit_transaction_block");
  p.push({ preconditionKey: "irreversible_transaction_basis_confirmed", label: "Irreversible transaction basis 확인", status: audit?.resolutionMode === "authorization_audit_confirmation" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: audit?.resolutionMode !== "authorization_audit_confirmation" ? "Authorization/audit 미확인" : "", derivedFrom: "actor_authorization_audit_transaction_block", blockingLevel: "hard_blocker" });

  p.push({ preconditionKey: "final_commit_policy_lock_cleared", label: "Final commit policy lock 해소", status: "satisfied", reasonIfUnsatisfied: "", derivedFrom: "policy_check", blockingLevel: "policy_lock" });

  return p;
}

function deriveBlockers(p: ActualSendCommitPreconditionResultV2[]): ActualSendCommitBlockerSummaryV2 { const b = p.filter(x => x.status === "unsatisfied" && (x.blockingLevel === "hard_blocker" || x.blockingLevel === "soft_blocker")).map(x => x.reasonIfUnsatisfied); return { blockers: b, count: b.length, primaryBlocker: b[0] || null }; }
function deriveWarnings(p: ActualSendCommitPreconditionResultV2[], s: ActualSendTransactionSectionResolutionStateV2[]): ActualSendCommitWarningSummaryV2 { const w: string[] = []; w.push(...p.filter(x => x.status === "unsatisfied" && x.blockingLevel === "warning").map(x => x.reasonIfUnsatisfied)); const ws = s.filter(x => x.resolutionStatus === "reviewed_with_warning"); if (ws.length > 0) w.push(`${ws.length}건 warning acknowledged`); return { warnings: w, count: w.length, primaryWarning: w[0] || null }; }

function deriveCandidate(session: ActualSendTransactionSessionV2, bs: ActualSendCommitBlockerSummaryV2, ws: ActualSendCommitWarningSummaryV2): ActualSendCommitCandidateV2 {
  const isReady = session.sessionStatus === "transaction_ready_pending_commit";
  const status: CommitCandidateStatus = !isReady ? "not_candidate" : bs.count > 0 ? "candidate_with_blockers" : ws.count > 0 ? "candidate_with_warnings" : "candidate_ready_for_commit";
  const canOpen = status === "candidate_ready_for_commit";
  const snap = (k: TransactionSectionKey) => session.sectionResolutionStates.find(x => x.sectionKey === k)?.resolutionStatus || "unknown";
  return { candidateStatus: status, candidateReason: bs.count > 0 ? bs.primaryBlocker! : ws.count > 0 ? `Warning: ${ws.primaryWarning}` : isReady ? "Commit 가능" : "Transaction 미준비", originTransactionStatus: session.sessionStatus, transactionCommitReadinessStatus: session.commitReadinessGateState.commitReadinessStatus, recipientFinalSnapshot: snap("recipient_transaction_block"), payloadIntegrityFinalSnapshot: snap("payload_integrity_transaction_block"), referenceInstructionFinalSnapshot: snap("reference_instruction_transaction_block"), exclusionGuardFinalSnapshot: snap("exclusion_guard_transaction_block"), authorizationAuditFinalSnapshot: snap("actor_authorization_audit_transaction_block"), canOpenActualSendCommitControl: canOpen, canOnlyPreviewCandidate: !canOpen && isReady, requiresFinalPolicyReview: false };
}

function deriveActionGate(c: ActualSendCommitCandidateV2, hasReturn: boolean): ActualSendCommitActionGateStateV2 { return { canPreviewCommitCandidate: c.candidateStatus !== "not_candidate", canReturnToTransactionReview: true, canReopenTransactionSectionReview: true, canRouteBackToActionOrExecutionIfNeeded: hasReturn, canHoldForPolicyReview: true, canOpenActualSendCommitControl: c.canOpenActualSendCommitControl, canExecuteActualSendCommit: false as const, canMarkSent: false as const, canMarkDispatched: false as const, canCreateDeliveryTracking: false as const, disabledActionReasons: { execute_actual_send_commit: "Batch 1 금지", mark_sent: "Batch 1 금지", mark_dispatched: "Batch 1 금지", create_delivery_tracking: "Batch 1 금지" } }; }

function deriveGateStatus(session: ActualSendTransactionSessionV2, c: ActualSendCommitCandidateV2, hasOpenReturn: boolean, hasRevisitPending: boolean): CommitGateStatus {
  if (session.sessionStatus !== "transaction_ready_pending_commit") return "not_eligible";
  if (hasOpenReturn) return "return_dependency_open";
  if (hasRevisitPending) return "transaction_dependency_open";
  if (c.candidateStatus === "candidate_ready_for_commit") return "eligible_for_actual_send_commit";
  return "actual_send_commit_locked_by_policy";
}

function derivePhase(s: CommitGateStatus): CommitGatePhase { switch (s) { case "not_eligible": case "transaction_dependency_open": case "return_dependency_open": return "precheck"; case "eligible_for_actual_send_commit": return "commit_enabled"; case "actual_send_commit_locked_by_policy": return "policy_locked"; case "actual_send_commit_opened": return "commit_open"; } }

export function buildActualSendCommitGateV2(session: ActualSendTransactionSessionV2): ActualSendCommitGateV2 {
  const now = new Date().toISOString(); const secs = session.sectionResolutionStates;
  const precs = derivePreconditions(session); const unsatisfied = precs.filter(x => x.status === "unsatisfied");
  const bs = deriveBlockers(precs); const ws = deriveWarnings(precs, secs);
  const candidate = deriveCandidate(session, bs, ws);
  const hasOpenReturn = secs.some(x => x.resolutionStatus === "returned_to_actual_send_action" || x.resolutionStatus === "returned_to_execution_or_confirmation");
  const hasRevisitPending = secs.some(x => x.requiresRevisitAfterReturn);
  const hasPriorReturn = session.returnHistory.length > 0;
  const requiresDepReval = hasRevisitPending || (hasPriorReturn && hasRevisitPending);
  const gateStatus = deriveGateStatus(session, candidate, hasOpenReturn, hasRevisitPending);
  const actionGate = deriveActionGate(candidate, hasOpenReturn);
  const nextLabel = candidate.canOpenActualSendCommitControl ? "Actual Send Commit Control (Entry Enabled)" : "Actual Send Commit Control (Locked Preview Only)";
  const provenance: ActualSendCommitProvenanceV2 = { derivedFromTransactionSessionId: session.actualSendTransactionSessionId, derivedFromTransactionGateVersion: session.actualSendTransactionGateId, derivedFromCommitReadinessSnapshotId: session.commitReadinessGateState.commitReadinessStatus, derivedFromSectionResolutionSnapshotIds: secs.map(x => `${x.sectionKey}:${x.resolutionStatus}`), derivedAt: now, derivedByEngineVersion: "v2-batch1", policyLockBasis: gateStatus === "actual_send_commit_locked_by_policy" ? "Policy lock 또는 unsatisfied precondition" : "none", dependencyRecheckBasis: requiresDepReval ? "Prior return + revisit pending" : "none", irreversibleCommitBasis: gateStatus === "eligible_for_actual_send_commit" ? "All preconditions satisfied — irreversible commit eligible" : "Preconditions unsatisfied" };

  return { actualSendCommitGateId: `cmtgate_${Date.now().toString(36)}`, caseId: session.caseId, handoffPackageId: session.handoffPackageId, actualSendTransactionGateId: session.actualSendTransactionGateId, actualSendTransactionSessionId: session.actualSendTransactionSessionId, gateStatus, gatePhase: derivePhase(gateStatus), candidateStatus: candidate.candidateStatus, candidate, blockerSummary: bs, warningSummary: ws, actionGate, requiredPreconditions: precs, unsatisfiedPreconditions: unsatisfied, commitStatus: "not_committed", nextSurfaceLabel: nextLabel, hasPriorReturnHistory: hasPriorReturn, hasReopenedSectionPending: hasRevisitPending, requiresDependencyRevalidation: requiresDepReval, lastReturnTarget: session.returnHistory.length > 0 ? session.returnHistory[session.returnHistory.length - 1].returnTarget : null, lastTransactionStatus: session.sessionStatus, provenance, generatedAt: now };
}

export type CommitGateEventType = "actual_send_commit_gate_computed" | "actual_send_commit_eligibility_confirmed" | "actual_send_commit_blocked" | "actual_send_commit_locked_by_policy" | "actual_send_commit_entry_enabled" | "actual_send_commit_preview_opened" | "actual_send_commit_returned_to_transaction_review";
export interface CommitGateEvent { type: CommitGateEventType; caseId: string; transactionSessionId: string; commitGateId: string; actionOrComputeReason: string; actorOrSystem: string; timestamp: string; }
export function createCommitGateEvent(type: CommitGateEventType, gate: ActualSendCommitGateV2, reason: string, actor: string): CommitGateEvent { return { type, caseId: gate.caseId, transactionSessionId: gate.actualSendTransactionSessionId, commitGateId: gate.actualSendCommitGateId, actionOrComputeReason: reason, actorOrSystem: actor, timestamp: new Date().toISOString() }; }
