/**
 * Actual Send Run Gate v2 Engine — execution ready → final run enablement
 *
 * 고정 규칙: execution ready ≠ run enabled ≠ sent ≠ dispatched.
 * Batch 1: execute / mark_sent / mark_dispatched 전부 금지.
 * Final irreversible run boundary — 전체 dispatch v2 체인의 마지막 gate.
 */

import type { ActualSendExecutionSessionV2, FinalExecSessionStatus, ActualSendExecutionRunReadinessGateStateV2, ActualSendExecutionSectionResolutionStateV2 } from "./actual-send-execution-resolution-v2-engine";
import type { FinalExecSectionKey } from "./actual-send-execution-workspace-v2";

export type RunGateStatus = "not_eligible" | "execution_dependency_open" | "return_dependency_open" | "eligible_for_actual_send_run" | "actual_send_run_locked_by_policy" | "actual_send_run_opened";
export type RunGatePhase = "precheck" | "eligibility_review" | "run_pending" | "run_enabled" | "run_open" | "policy_locked";

export type RunPreconditionKey = "execution_ready_achieved" | "no_unresolved_execution_section" | "no_return_to_commit_dependency" | "no_return_to_transaction_or_action_dependency" | "recipient_execution_confirmed" | "payload_integrity_execution_confirmed" | "reference_instruction_execution_confirmed" | "exclusion_guard_execution_rechecked" | "authorization_audit_execution_confirmed" | "contamination_not_detected" | "irreversible_execution_basis_confirmed" | "final_run_policy_lock_cleared";
export type RunBlockingLevel = "hard_blocker" | "soft_blocker" | "policy_lock" | "warning";

export interface ActualSendRunPreconditionResultV2 { preconditionKey: RunPreconditionKey; label: string; status: "satisfied" | "unsatisfied"; reasonIfUnsatisfied: string; derivedFrom: string; blockingLevel: RunBlockingLevel; }

export type RunCandidateStatus = "not_candidate" | "candidate_with_blockers" | "candidate_with_warnings" | "candidate_ready_for_run" | "candidate_run_locked";
export interface ActualSendRunCandidateV2 { candidateStatus: RunCandidateStatus; candidateReason: string; originExecutionStatus: FinalExecSessionStatus; executionRunReadinessStatus: string; recipientFinalSnapshot: string; payloadIntegrityFinalSnapshot: string; referenceInstructionFinalSnapshot: string; exclusionGuardFinalSnapshot: string; authorizationAuditFinalSnapshot: string; canOpenActualSendRunControl: boolean; canOnlyPreviewCandidate: boolean; requiresFinalPolicyReview: boolean; }

export interface ActualSendRunBlockerSummaryV2 { blockers: string[]; count: number; primaryBlocker: string | null; }
export interface ActualSendRunWarningSummaryV2 { warnings: string[]; count: number; primaryWarning: string | null; }

export interface ActualSendRunActionGateStateV2 { canPreviewRunCandidate: boolean; canReturnToExecutionReview: boolean; canReopenExecutionSectionReview: boolean; canRouteBackToCommitOrTransactionIfNeeded: boolean; canHoldForPolicyReview: boolean; canOpenActualSendRunControl: boolean; canExecuteActualSendRun: false; canMarkSent: false; canMarkDispatched: false; canCreateDeliveryTracking: false; disabledActionReasons: Record<string, string>; }

export interface ActualSendRunProvenanceV2 { derivedFromExecutionSessionId: string; derivedFromExecutionGateVersion: string; derivedFromRunReadinessSnapshotId: string; derivedFromSectionResolutionSnapshotIds: string[]; derivedAt: string; derivedByEngineVersion: string; policyLockBasis: string; dependencyRecheckBasis: string; irreversibleRunBasis: string; }

export interface ActualSendRunGateV2 {
  actualSendRunGateId: string; caseId: string; handoffPackageId: string; actualSendExecutionGateId: string; actualSendExecutionSessionId: string;
  gateStatus: RunGateStatus; gatePhase: RunGatePhase;
  candidateStatus: RunCandidateStatus; candidate: ActualSendRunCandidateV2;
  blockerSummary: ActualSendRunBlockerSummaryV2; warningSummary: ActualSendRunWarningSummaryV2;
  actionGate: ActualSendRunActionGateStateV2;
  requiredPreconditions: ActualSendRunPreconditionResultV2[]; unsatisfiedPreconditions: ActualSendRunPreconditionResultV2[];
  runStatus: "not_run"; nextSurfaceLabel: string;
  hasPriorReturnHistory: boolean; hasReopenedSectionPending: boolean; requiresDependencyRevalidation: boolean;
  lastReturnTarget: string | null; lastExecutionStatus: string;
  provenance: ActualSendRunProvenanceV2; generatedAt: string;
}

function derivePreconditions(session: ActualSendExecutionSessionV2): ActualSendRunPreconditionResultV2[] {
  const p: ActualSendRunPreconditionResultV2[] = [];
  const s = session.sectionResolutionStates;

  p.push({ preconditionKey: "execution_ready_achieved", label: "Execution ready 달성", status: session.sessionStatus === "execution_ready_pending_run" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: session.sessionStatus !== "execution_ready_pending_run" ? `Status: ${session.sessionStatus}` : "", derivedFrom: "session.sessionStatus", blockingLevel: "hard_blocker" });

  const unresolved = s.filter(x => x.resolutionStatus === "blocked_unresolved" || x.resolutionStatus === "unreviewed" || x.resolutionStatus === "in_review" || x.remainingUnresolvedInputs.length > 0);
  p.push({ preconditionKey: "no_unresolved_execution_section", label: "미해소 execution section 없음", status: unresolved.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: unresolved.length > 0 ? `${unresolved.length}건 미해소` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const retCommit = s.filter(x => x.resolutionStatus === "returned_to_actual_send_commit");
  p.push({ preconditionKey: "no_return_to_commit_dependency", label: "Commit return 없음", status: retCommit.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retCommit.length > 0 ? `${retCommit.length}건 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const retTA = s.filter(x => x.resolutionStatus === "returned_to_transaction_or_action");
  p.push({ preconditionKey: "no_return_to_transaction_or_action_dependency", label: "Transaction/action return 없음", status: retTA.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retTA.length > 0 ? `${retTA.length}건 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const checks: { key: RunPreconditionKey; secKey: FinalExecSectionKey; label: string; level: RunBlockingLevel }[] = [
    { key: "recipient_execution_confirmed", secKey: "recipient_execution_final_block", label: "수신자 execution 확인", level: "hard_blocker" },
    { key: "payload_integrity_execution_confirmed", secKey: "payload_integrity_execution_final_block", label: "Payload integrity 확인", level: "hard_blocker" },
    { key: "reference_instruction_execution_confirmed", secKey: "reference_instruction_execution_final_block", label: "Reference/instruction 확인", level: "soft_blocker" },
    { key: "exclusion_guard_execution_rechecked", secKey: "exclusion_guard_execution_final_block", label: "Exclusion guard 재확인", level: "hard_blocker" },
    { key: "authorization_audit_execution_confirmed", secKey: "actor_authorization_audit_execution_final_block", label: "Authorization/audit 확인", level: "hard_blocker" },
  ];
  for (const c of checks) { const sec = s.find(x => x.sectionKey === c.secKey); const ok = sec && sec.eligibleForRunReadiness; p.push({ preconditionKey: c.key, label: c.label, status: ok ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !ok ? `${c.secKey} 미완료` : "", derivedFrom: `section:${c.secKey}`, blockingLevel: c.level }); }

  const guard = s.find(x => x.sectionKey === "exclusion_guard_execution_final_block");
  p.push({ preconditionKey: "contamination_not_detected", label: "Contamination 미감지", status: guard?.resolutionMode === "guard_confirmation" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: guard?.resolutionMode !== "guard_confirmation" ? "Guard 미확인" : "", derivedFrom: "exclusion_guard_execution_final_block", blockingLevel: "hard_blocker" });

  const audit = s.find(x => x.sectionKey === "actor_authorization_audit_execution_final_block");
  p.push({ preconditionKey: "irreversible_execution_basis_confirmed", label: "Irreversible execution basis 확인", status: audit?.resolutionMode === "authorization_audit_confirmation" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: audit?.resolutionMode !== "authorization_audit_confirmation" ? "Authorization/audit 미확인" : "", derivedFrom: "actor_authorization_audit_execution_final_block", blockingLevel: "hard_blocker" });

  p.push({ preconditionKey: "final_run_policy_lock_cleared", label: "Final run policy lock 해소", status: "satisfied", reasonIfUnsatisfied: "", derivedFrom: "policy_check", blockingLevel: "policy_lock" });

  return p;
}

function deriveBlockers(p: ActualSendRunPreconditionResultV2[]): ActualSendRunBlockerSummaryV2 { const b = p.filter(x => x.status === "unsatisfied" && (x.blockingLevel === "hard_blocker" || x.blockingLevel === "soft_blocker")).map(x => x.reasonIfUnsatisfied); return { blockers: b, count: b.length, primaryBlocker: b[0] || null }; }
function deriveWarnings(p: ActualSendRunPreconditionResultV2[], s: ActualSendExecutionSectionResolutionStateV2[]): ActualSendRunWarningSummaryV2 { const w: string[] = []; w.push(...p.filter(x => x.status === "unsatisfied" && x.blockingLevel === "warning").map(x => x.reasonIfUnsatisfied)); const ws = s.filter(x => x.resolutionStatus === "reviewed_with_warning"); if (ws.length > 0) w.push(`${ws.length}건 warning acknowledged`); return { warnings: w, count: w.length, primaryWarning: w[0] || null }; }

function deriveCandidate(session: ActualSendExecutionSessionV2, bs: ActualSendRunBlockerSummaryV2, ws: ActualSendRunWarningSummaryV2): ActualSendRunCandidateV2 {
  const isReady = session.sessionStatus === "execution_ready_pending_run";
  const status: RunCandidateStatus = !isReady ? "not_candidate" : bs.count > 0 ? "candidate_with_blockers" : ws.count > 0 ? "candidate_with_warnings" : "candidate_ready_for_run";
  const canOpen = status === "candidate_ready_for_run";
  const snap = (k: FinalExecSectionKey) => session.sectionResolutionStates.find(x => x.sectionKey === k)?.resolutionStatus || "unknown";
  return { candidateStatus: status, candidateReason: bs.count > 0 ? bs.primaryBlocker! : ws.count > 0 ? `Warning: ${ws.primaryWarning}` : isReady ? "Run 가능" : "Execution 미준비", originExecutionStatus: session.sessionStatus, executionRunReadinessStatus: session.runReadinessGateState.runReadinessStatus, recipientFinalSnapshot: snap("recipient_execution_final_block"), payloadIntegrityFinalSnapshot: snap("payload_integrity_execution_final_block"), referenceInstructionFinalSnapshot: snap("reference_instruction_execution_final_block"), exclusionGuardFinalSnapshot: snap("exclusion_guard_execution_final_block"), authorizationAuditFinalSnapshot: snap("actor_authorization_audit_execution_final_block"), canOpenActualSendRunControl: canOpen, canOnlyPreviewCandidate: !canOpen && isReady, requiresFinalPolicyReview: false };
}

function deriveActionGate(c: ActualSendRunCandidateV2, hasReturn: boolean): ActualSendRunActionGateStateV2 { return { canPreviewRunCandidate: c.candidateStatus !== "not_candidate", canReturnToExecutionReview: true, canReopenExecutionSectionReview: true, canRouteBackToCommitOrTransactionIfNeeded: hasReturn, canHoldForPolicyReview: true, canOpenActualSendRunControl: c.canOpenActualSendRunControl, canExecuteActualSendRun: false as const, canMarkSent: false as const, canMarkDispatched: false as const, canCreateDeliveryTracking: false as const, disabledActionReasons: { execute_actual_send_run: "Batch 1 금지: final irreversible run", mark_sent: "Batch 1 금지", mark_dispatched: "Batch 1 금지", create_delivery_tracking: "Batch 1 금지" } }; }

function deriveGateStatus(session: ActualSendExecutionSessionV2, c: ActualSendRunCandidateV2, hasOpenReturn: boolean, hasRevisitPending: boolean): RunGateStatus {
  if (session.sessionStatus !== "execution_ready_pending_run") return "not_eligible";
  if (hasOpenReturn) return "return_dependency_open";
  if (hasRevisitPending) return "execution_dependency_open";
  if (c.candidateStatus === "candidate_ready_for_run") return "eligible_for_actual_send_run";
  return "actual_send_run_locked_by_policy";
}

function derivePhase(s: RunGateStatus): RunGatePhase { switch (s) { case "not_eligible": case "execution_dependency_open": case "return_dependency_open": return "precheck"; case "eligible_for_actual_send_run": return "run_enabled"; case "actual_send_run_locked_by_policy": return "policy_locked"; case "actual_send_run_opened": return "run_open"; } }

export function buildActualSendRunGateV2(session: ActualSendExecutionSessionV2): ActualSendRunGateV2 {
  const now = new Date().toISOString(); const secs = session.sectionResolutionStates;
  const precs = derivePreconditions(session); const unsatisfied = precs.filter(x => x.status === "unsatisfied");
  const bs = deriveBlockers(precs); const ws = deriveWarnings(precs, secs);
  const candidate = deriveCandidate(session, bs, ws);
  const hasOpenReturn = secs.some(x => x.resolutionStatus === "returned_to_actual_send_commit" || x.resolutionStatus === "returned_to_transaction_or_action");
  const hasRevisitPending = secs.some(x => x.requiresRevisitAfterReturn);
  const hasPriorReturn = session.returnHistory.length > 0;
  const requiresDepReval = hasRevisitPending || (hasPriorReturn && hasRevisitPending);
  const gateStatus = deriveGateStatus(session, candidate, hasOpenReturn, hasRevisitPending);
  const actionGate = deriveActionGate(candidate, hasOpenReturn);
  const nextLabel = candidate.canOpenActualSendRunControl ? "Actual Send Run Control (Entry Enabled)" : "Actual Send Run Control (Locked Preview Only)";
  const provenance: ActualSendRunProvenanceV2 = { derivedFromExecutionSessionId: session.actualSendExecutionSessionId, derivedFromExecutionGateVersion: session.actualSendExecutionGateId, derivedFromRunReadinessSnapshotId: session.runReadinessGateState.runReadinessStatus, derivedFromSectionResolutionSnapshotIds: secs.map(x => `${x.sectionKey}:${x.resolutionStatus}`), derivedAt: now, derivedByEngineVersion: "v2-batch1", policyLockBasis: gateStatus === "actual_send_run_locked_by_policy" ? "Policy lock 또는 unsatisfied precondition" : "none", dependencyRecheckBasis: requiresDepReval ? "Prior return + revisit pending" : "none", irreversibleRunBasis: gateStatus === "eligible_for_actual_send_run" ? "All preconditions satisfied — final irreversible run eligible" : "Preconditions unsatisfied" };

  return { actualSendRunGateId: `rungate_${Date.now().toString(36)}`, caseId: session.caseId, handoffPackageId: session.handoffPackageId, actualSendExecutionGateId: session.actualSendExecutionGateId, actualSendExecutionSessionId: session.actualSendExecutionSessionId, gateStatus, gatePhase: derivePhase(gateStatus), candidateStatus: candidate.candidateStatus, candidate, blockerSummary: bs, warningSummary: ws, actionGate, requiredPreconditions: precs, unsatisfiedPreconditions: unsatisfied, runStatus: "not_run", nextSurfaceLabel: nextLabel, hasPriorReturnHistory: hasPriorReturn, hasReopenedSectionPending: hasRevisitPending, requiresDependencyRevalidation: requiresDepReval, lastReturnTarget: session.returnHistory.length > 0 ? session.returnHistory[session.returnHistory.length - 1].returnTarget : null, lastExecutionStatus: session.sessionStatus, provenance, generatedAt: now };
}

export type RunGateEventType = "actual_send_run_gate_computed" | "actual_send_run_eligibility_confirmed" | "actual_send_run_blocked" | "actual_send_run_locked_by_policy" | "actual_send_run_entry_enabled" | "actual_send_run_preview_opened" | "actual_send_run_returned_to_execution_review";
export interface RunGateEvent { type: RunGateEventType; caseId: string; executionSessionId: string; runGateId: string; actionOrComputeReason: string; actorOrSystem: string; timestamp: string; }
export function createRunGateEvent(type: RunGateEventType, gate: ActualSendRunGateV2, reason: string, actor: string): RunGateEvent { return { type, caseId: gate.caseId, executionSessionId: gate.actualSendExecutionSessionId, runGateId: gate.actualSendRunGateId, actionOrComputeReason: reason, actorOrSystem: actor, timestamp: new Date().toISOString() }; }
