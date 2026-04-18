/**
 * Actual Send Execution Gate v2 Engine — commit ready → execution enablement
 *
 * 고정 규칙: commit ready ≠ execution enabled ≠ sent ≠ dispatched.
 * Batch 1: execute / mark_sent / mark_dispatched 전부 금지.
 * Final irreversible execution boundary.
 */

import type { ActualSendCommitSessionV2, CommitSessionStatus, ActualSendCommitExecutionReadinessGateStateV2, ActualSendCommitSectionResolutionStateV2 } from "./actual-send-commit-resolution-v2-engine";
import type { CommitSectionKey } from "./actual-send-commit-workspace-v2";

export type FinalExecGateStatus = "not_eligible" | "commit_dependency_open" | "return_dependency_open" | "eligible_for_actual_send_execution" | "actual_send_execution_locked_by_policy" | "actual_send_execution_opened";
export type FinalExecGatePhase = "precheck" | "eligibility_review" | "execution_pending" | "execution_enabled" | "execution_open" | "policy_locked";

export type FinalExecPreconditionKey = "commit_ready_achieved" | "no_unresolved_commit_section" | "no_return_to_transaction_dependency" | "no_return_to_action_or_execution_dependency" | "recipient_commit_confirmed" | "payload_integrity_commit_confirmed" | "reference_instruction_commit_confirmed" | "exclusion_guard_commit_rechecked" | "authorization_audit_commit_confirmed" | "contamination_not_detected" | "irreversible_commit_basis_confirmed" | "final_execution_policy_lock_cleared";
export type FinalExecBlockingLevel = "hard_blocker" | "soft_blocker" | "policy_lock" | "warning";

export interface ActualSendExecutionPreconditionResultV2 { preconditionKey: FinalExecPreconditionKey; label: string; status: "satisfied" | "unsatisfied"; reasonIfUnsatisfied: string; derivedFrom: string; blockingLevel: FinalExecBlockingLevel; }

export type FinalExecCandidateStatus = "not_candidate" | "candidate_with_blockers" | "candidate_with_warnings" | "candidate_ready_for_execution" | "candidate_execution_locked";
export interface ActualSendExecutionCandidateV2 { candidateStatus: FinalExecCandidateStatus; candidateReason: string; originCommitStatus: CommitSessionStatus; commitExecutionReadinessStatus: string; recipientFinalSnapshot: string; payloadIntegrityFinalSnapshot: string; referenceInstructionFinalSnapshot: string; exclusionGuardFinalSnapshot: string; authorizationAuditFinalSnapshot: string; canOpenActualSendExecutionControl: boolean; canOnlyPreviewCandidate: boolean; requiresFinalPolicyReview: boolean; }

export interface ActualSendExecutionBlockerSummaryV2 { blockers: string[]; count: number; primaryBlocker: string | null; }
export interface ActualSendExecutionWarningSummaryV2 { warnings: string[]; count: number; primaryWarning: string | null; }

export interface ActualSendExecutionActionGateStateV2 { canPreviewExecutionCandidate: boolean; canReturnToCommitReview: boolean; canReopenCommitSectionReview: boolean; canRouteBackToTransactionOrActionIfNeeded: boolean; canHoldForPolicyReview: boolean; canOpenActualSendExecutionControl: boolean; canExecuteActualSendExecution: false; canMarkSent: false; canMarkDispatched: false; canCreateDeliveryTracking: false; disabledActionReasons: Record<string, string>; }

export interface ActualSendExecutionProvenanceV2 { derivedFromCommitSessionId: string; derivedFromCommitGateVersion: string; derivedFromExecutionReadinessSnapshotId: string; derivedFromSectionResolutionSnapshotIds: string[]; derivedAt: string; derivedByEngineVersion: string; policyLockBasis: string; dependencyRecheckBasis: string; irreversibleExecutionBasis: string; }

export interface ActualSendExecutionGateV2 {
  actualSendExecutionGateId: string; caseId: string; handoffPackageId: string; actualSendCommitGateId: string; actualSendCommitSessionId: string;
  gateStatus: FinalExecGateStatus; gatePhase: FinalExecGatePhase;
  candidateStatus: FinalExecCandidateStatus; candidate: ActualSendExecutionCandidateV2;
  blockerSummary: ActualSendExecutionBlockerSummaryV2; warningSummary: ActualSendExecutionWarningSummaryV2;
  actionGate: ActualSendExecutionActionGateStateV2;
  requiredPreconditions: ActualSendExecutionPreconditionResultV2[]; unsatisfiedPreconditions: ActualSendExecutionPreconditionResultV2[];
  executionStatus: "not_executed"; nextSurfaceLabel: string;
  hasPriorReturnHistory: boolean; hasReopenedSectionPending: boolean; requiresDependencyRevalidation: boolean;
  lastReturnTarget: string | null; lastCommitStatus: string;
  provenance: ActualSendExecutionProvenanceV2; generatedAt: string;
}

function derivePreconditions(session: ActualSendCommitSessionV2): ActualSendExecutionPreconditionResultV2[] {
  const p: ActualSendExecutionPreconditionResultV2[] = [];
  const s = session.sectionResolutionStates;

  p.push({ preconditionKey: "commit_ready_achieved", label: "Commit ready 달성", status: session.sessionStatus === "commit_ready_pending_execution" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: session.sessionStatus !== "commit_ready_pending_execution" ? `Status: ${session.sessionStatus}` : "", derivedFrom: "session.sessionStatus", blockingLevel: "hard_blocker" });

  const unresolved = s.filter(x => x.resolutionStatus === "blocked_unresolved" || x.resolutionStatus === "unreviewed" || x.resolutionStatus === "in_review" || x.remainingUnresolvedInputs.length > 0);
  p.push({ preconditionKey: "no_unresolved_commit_section", label: "미해소 commit section 없음", status: unresolved.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: unresolved.length > 0 ? `${unresolved.length}건 미해소` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const retTxn = s.filter(x => x.resolutionStatus === "returned_to_actual_send_transaction");
  p.push({ preconditionKey: "no_return_to_transaction_dependency", label: "Transaction return 없음", status: retTxn.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retTxn.length > 0 ? `${retTxn.length}건 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const retAE = s.filter(x => x.resolutionStatus === "returned_to_action_or_execution");
  p.push({ preconditionKey: "no_return_to_action_or_execution_dependency", label: "Action/execution return 없음", status: retAE.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retAE.length > 0 ? `${retAE.length}건 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const checks: { key: FinalExecPreconditionKey; secKey: CommitSectionKey; label: string; level: FinalExecBlockingLevel }[] = [
    { key: "recipient_commit_confirmed", secKey: "recipient_commit_block", label: "수신자 commit 확인", level: "hard_blocker" },
    { key: "payload_integrity_commit_confirmed", secKey: "payload_integrity_commit_block", label: "Payload integrity 확인", level: "hard_blocker" },
    { key: "reference_instruction_commit_confirmed", secKey: "reference_instruction_commit_block", label: "Reference/instruction 확인", level: "soft_blocker" },
    { key: "exclusion_guard_commit_rechecked", secKey: "exclusion_guard_commit_block", label: "Exclusion guard 재확인", level: "hard_blocker" },
    { key: "authorization_audit_commit_confirmed", secKey: "actor_authorization_audit_commit_block", label: "Authorization/audit 확인", level: "hard_blocker" },
  ];
  for (const c of checks) { const sec = s.find(x => x.sectionKey === c.secKey); const ok = sec && sec.eligibleForExecutionReadiness; p.push({ preconditionKey: c.key, label: c.label, status: ok ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !ok ? `${c.secKey} 미완료` : "", derivedFrom: `section:${c.secKey}`, blockingLevel: c.level }); }

  const guard = s.find(x => x.sectionKey === "exclusion_guard_commit_block");
  p.push({ preconditionKey: "contamination_not_detected", label: "Contamination 미감지", status: guard?.resolutionMode === "guard_confirmation" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: guard?.resolutionMode !== "guard_confirmation" ? "Guard 미확인" : "", derivedFrom: "exclusion_guard_commit_block", blockingLevel: "hard_blocker" });

  const audit = s.find(x => x.sectionKey === "actor_authorization_audit_commit_block");
  p.push({ preconditionKey: "irreversible_commit_basis_confirmed", label: "Irreversible commit basis 확인", status: audit?.resolutionMode === "authorization_audit_confirmation" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: audit?.resolutionMode !== "authorization_audit_confirmation" ? "Authorization/audit 미확인" : "", derivedFrom: "actor_authorization_audit_commit_block", blockingLevel: "hard_blocker" });

  p.push({ preconditionKey: "final_execution_policy_lock_cleared", label: "Final execution policy lock 해소", status: "satisfied", reasonIfUnsatisfied: "", derivedFrom: "policy_check", blockingLevel: "policy_lock" });

  return p;
}

function deriveBlockers(p: ActualSendExecutionPreconditionResultV2[]): ActualSendExecutionBlockerSummaryV2 { const b = p.filter(x => x.status === "unsatisfied" && (x.blockingLevel === "hard_blocker" || x.blockingLevel === "soft_blocker")).map(x => x.reasonIfUnsatisfied); return { blockers: b, count: b.length, primaryBlocker: b[0] || null }; }
function deriveWarnings(p: ActualSendExecutionPreconditionResultV2[], s: ActualSendCommitSectionResolutionStateV2[]): ActualSendExecutionWarningSummaryV2 { const w: string[] = []; w.push(...p.filter(x => x.status === "unsatisfied" && x.blockingLevel === "warning").map(x => x.reasonIfUnsatisfied)); const ws = s.filter(x => x.resolutionStatus === "reviewed_with_warning"); if (ws.length > 0) w.push(`${ws.length}건 warning acknowledged`); return { warnings: w, count: w.length, primaryWarning: w[0] || null }; }

function deriveCandidate(session: ActualSendCommitSessionV2, bs: ActualSendExecutionBlockerSummaryV2, ws: ActualSendExecutionWarningSummaryV2): ActualSendExecutionCandidateV2 {
  const isReady = session.sessionStatus === "commit_ready_pending_execution";
  const status: FinalExecCandidateStatus = !isReady ? "not_candidate" : bs.count > 0 ? "candidate_with_blockers" : ws.count > 0 ? "candidate_with_warnings" : "candidate_ready_for_execution";
  const canOpen = status === "candidate_ready_for_execution";
  const snap = (k: CommitSectionKey) => session.sectionResolutionStates.find(x => x.sectionKey === k)?.resolutionStatus || "unknown";
  return { candidateStatus: status, candidateReason: bs.count > 0 ? bs.primaryBlocker! : ws.count > 0 ? `Warning: ${ws.primaryWarning}` : isReady ? "Execution 가능" : "Commit 미준비", originCommitStatus: session.sessionStatus, commitExecutionReadinessStatus: session.executionReadinessGateState.executionReadinessStatus, recipientFinalSnapshot: snap("recipient_commit_block"), payloadIntegrityFinalSnapshot: snap("payload_integrity_commit_block"), referenceInstructionFinalSnapshot: snap("reference_instruction_commit_block"), exclusionGuardFinalSnapshot: snap("exclusion_guard_commit_block"), authorizationAuditFinalSnapshot: snap("actor_authorization_audit_commit_block"), canOpenActualSendExecutionControl: canOpen, canOnlyPreviewCandidate: !canOpen && isReady, requiresFinalPolicyReview: false };
}

function deriveActionGate(c: ActualSendExecutionCandidateV2, hasReturn: boolean): ActualSendExecutionActionGateStateV2 { return { canPreviewExecutionCandidate: c.candidateStatus !== "not_candidate", canReturnToCommitReview: true, canReopenCommitSectionReview: true, canRouteBackToTransactionOrActionIfNeeded: hasReturn, canHoldForPolicyReview: true, canOpenActualSendExecutionControl: c.canOpenActualSendExecutionControl, canExecuteActualSendExecution: false as const, canMarkSent: false as const, canMarkDispatched: false as const, canCreateDeliveryTracking: false as const, disabledActionReasons: { execute_actual_send_execution: "Batch 1 금지: final irreversible execution", mark_sent: "Batch 1 금지", mark_dispatched: "Batch 1 금지", create_delivery_tracking: "Batch 1 금지" } }; }

function deriveGateStatus(session: ActualSendCommitSessionV2, c: ActualSendExecutionCandidateV2, hasOpenReturn: boolean, hasRevisitPending: boolean): FinalExecGateStatus {
  if (session.sessionStatus !== "commit_ready_pending_execution") return "not_eligible";
  if (hasOpenReturn) return "return_dependency_open";
  if (hasRevisitPending) return "commit_dependency_open";
  if (c.candidateStatus === "candidate_ready_for_execution") return "eligible_for_actual_send_execution";
  return "actual_send_execution_locked_by_policy";
}

function derivePhase(s: FinalExecGateStatus): FinalExecGatePhase { switch (s) { case "not_eligible": case "commit_dependency_open": case "return_dependency_open": return "precheck"; case "eligible_for_actual_send_execution": return "execution_enabled"; case "actual_send_execution_locked_by_policy": return "policy_locked"; case "actual_send_execution_opened": return "execution_open"; } }

export function buildActualSendExecutionGateV2(session: ActualSendCommitSessionV2): ActualSendExecutionGateV2 {
  const now = new Date().toISOString(); const secs = session.sectionResolutionStates;
  const precs = derivePreconditions(session); const unsatisfied = precs.filter(x => x.status === "unsatisfied");
  const bs = deriveBlockers(precs); const ws = deriveWarnings(precs, secs);
  const candidate = deriveCandidate(session, bs, ws);
  const hasOpenReturn = secs.some(x => x.resolutionStatus === "returned_to_actual_send_transaction" || x.resolutionStatus === "returned_to_action_or_execution");
  const hasRevisitPending = secs.some(x => x.requiresRevisitAfterReturn);
  const hasPriorReturn = session.returnHistory.length > 0;
  const requiresDepReval = hasRevisitPending || (hasPriorReturn && hasRevisitPending);
  const gateStatus = deriveGateStatus(session, candidate, hasOpenReturn, hasRevisitPending);
  const actionGate = deriveActionGate(candidate, hasOpenReturn);
  const nextLabel = candidate.canOpenActualSendExecutionControl ? "Actual Send Execution Control (Entry Enabled)" : "Actual Send Execution Control (Locked Preview Only)";
  const provenance: ActualSendExecutionProvenanceV2 = { derivedFromCommitSessionId: session.actualSendCommitSessionId, derivedFromCommitGateVersion: session.actualSendCommitGateId, derivedFromExecutionReadinessSnapshotId: session.executionReadinessGateState.executionReadinessStatus, derivedFromSectionResolutionSnapshotIds: secs.map(x => `${x.sectionKey}:${x.resolutionStatus}`), derivedAt: now, derivedByEngineVersion: "v2-batch1", policyLockBasis: gateStatus === "actual_send_execution_locked_by_policy" ? "Policy lock 또는 unsatisfied precondition" : "none", dependencyRecheckBasis: requiresDepReval ? "Prior return + revisit pending" : "none", irreversibleExecutionBasis: gateStatus === "eligible_for_actual_send_execution" ? "All preconditions satisfied — final irreversible execution eligible" : "Preconditions unsatisfied" };

  return { actualSendExecutionGateId: `fnlexgate_${Date.now().toString(36)}`, caseId: session.caseId, handoffPackageId: session.handoffPackageId, actualSendCommitGateId: session.actualSendCommitGateId, actualSendCommitSessionId: session.actualSendCommitSessionId, gateStatus, gatePhase: derivePhase(gateStatus), candidateStatus: candidate.candidateStatus, candidate, blockerSummary: bs, warningSummary: ws, actionGate, requiredPreconditions: precs, unsatisfiedPreconditions: unsatisfied, executionStatus: "not_executed", nextSurfaceLabel: nextLabel, hasPriorReturnHistory: hasPriorReturn, hasReopenedSectionPending: hasRevisitPending, requiresDependencyRevalidation: requiresDepReval, lastReturnTarget: session.returnHistory.length > 0 ? session.returnHistory[session.returnHistory.length - 1].returnTarget : null, lastCommitStatus: session.sessionStatus, provenance, generatedAt: now };
}

export type FinalExecGateEventType = "actual_send_execution_gate_computed" | "actual_send_execution_eligibility_confirmed" | "actual_send_execution_blocked" | "actual_send_execution_locked_by_policy" | "actual_send_execution_entry_enabled" | "actual_send_execution_preview_opened" | "actual_send_execution_returned_to_commit_review";
export interface FinalExecGateEvent { type: FinalExecGateEventType; caseId: string; commitSessionId: string; executionGateId: string; actionOrComputeReason: string; actorOrSystem: string; timestamp: string; }
export function createFinalExecGateEvent(type: FinalExecGateEventType, gate: ActualSendExecutionGateV2, reason: string, actor: string): FinalExecGateEvent { return { type, caseId: gate.caseId, commitSessionId: gate.actualSendCommitSessionId, executionGateId: gate.actualSendExecutionGateId, actionOrComputeReason: reason, actorOrSystem: actor, timestamp: new Date().toISOString() }; }
