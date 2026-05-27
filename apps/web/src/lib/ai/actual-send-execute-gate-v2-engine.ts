/**
 * Actual Send Execute Gate v2 Engine — run ready → final execute enablement
 *
 * 고정 규칙: run ready ≠ execute enabled ≠ sent ≠ dispatched.
 * Batch 1: execute / mark_sent / mark_dispatched 전부 금지.
 * Dispatch v2 chain absolute terminal gate.
 */

import type { ActualSendRunSessionV2, RunSessionStatus, ActualSendRunReadinessGateStateV2, ActualSendRunSectionResolutionStateV2 } from "./actual-send-run-resolution-v2-engine";
import type { RunSectionKey } from "./actual-send-run-workspace-v2";

export type ExecuteGateStatus = "not_eligible" | "run_dependency_open" | "return_dependency_open" | "eligible_for_actual_send_execute" | "actual_send_execute_locked_by_policy" | "actual_send_execute_opened";
export type ExecuteGatePhase = "precheck" | "eligibility_review" | "execute_pending" | "execute_enabled" | "execute_open" | "policy_locked";

export type ExecutePreconditionKey = "run_ready_achieved" | "no_unresolved_run_section" | "no_return_to_execution_dependency" | "no_return_to_commit_or_transaction_dependency" | "recipient_run_confirmed" | "payload_integrity_run_confirmed" | "reference_instruction_run_confirmed" | "exclusion_guard_run_rechecked" | "authorization_audit_run_confirmed" | "contamination_not_detected" | "irreversible_run_basis_confirmed" | "final_execute_policy_lock_cleared";
export type ExecuteBlockingLevel = "hard_blocker" | "soft_blocker" | "policy_lock" | "warning";

export interface ActualSendExecutePreconditionResultV2 { preconditionKey: ExecutePreconditionKey; label: string; status: "satisfied" | "unsatisfied"; reasonIfUnsatisfied: string; derivedFrom: string; blockingLevel: ExecuteBlockingLevel; }

export type ExecuteCandidateStatus = "not_candidate" | "candidate_with_blockers" | "candidate_with_warnings" | "candidate_ready_for_execute" | "candidate_execute_locked";
export interface ActualSendExecuteCandidateV2 { candidateStatus: ExecuteCandidateStatus; candidateReason: string; originRunStatus: RunSessionStatus; runReadinessStatus: string; recipientFinalSnapshot: string; payloadIntegrityFinalSnapshot: string; referenceInstructionFinalSnapshot: string; exclusionGuardFinalSnapshot: string; authorizationAuditFinalSnapshot: string; canOpenActualSendExecuteControl: boolean; canOnlyPreviewCandidate: boolean; requiresFinalPolicyReview: boolean; }

export interface ActualSendExecuteBlockerSummaryV2 { blockers: string[]; count: number; primaryBlocker: string | null; }
export interface ActualSendExecuteWarningSummaryV2 { warnings: string[]; count: number; primaryWarning: string | null; }

export interface ActualSendExecuteActionGateStateV2 { canPreviewExecuteCandidate: boolean; canReturnToRunReview: boolean; canReopenRunSectionReview: boolean; canRouteBackToExecutionOrCommitIfNeeded: boolean; canHoldForPolicyReview: boolean; canOpenActualSendExecuteControl: boolean; canExecuteActualSendExecute: false; canMarkSent: false; canMarkDispatched: false; canCreateDeliveryTracking: false; disabledActionReasons: Record<string, string>; }

export interface ActualSendExecuteProvenanceV2 { derivedFromRunSessionId: string; derivedFromRunGateVersion: string; derivedFromRunReadinessSnapshotId: string; derivedFromSectionResolutionSnapshotIds: string[]; derivedAt: string; derivedByEngineVersion: string; policyLockBasis: string; dependencyRecheckBasis: string; irreversibleExecuteBasis: string; }

export interface ActualSendExecuteGateV2 {
  actualSendExecuteGateId: string; caseId: string; handoffPackageId: string; actualSendRunGateId: string; actualSendRunSessionId: string;
  gateStatus: ExecuteGateStatus; gatePhase: ExecuteGatePhase;
  candidateStatus: ExecuteCandidateStatus; candidate: ActualSendExecuteCandidateV2;
  blockerSummary: ActualSendExecuteBlockerSummaryV2; warningSummary: ActualSendExecuteWarningSummaryV2;
  actionGate: ActualSendExecuteActionGateStateV2;
  requiredPreconditions: ActualSendExecutePreconditionResultV2[]; unsatisfiedPreconditions: ActualSendExecutePreconditionResultV2[];
  executeStatus: "not_executed"; nextSurfaceLabel: string;
  hasPriorReturnHistory: boolean; hasReopenedSectionPending: boolean; requiresDependencyRevalidation: boolean;
  lastReturnTarget: string | null; lastRunStatus: string;
  provenance: ActualSendExecuteProvenanceV2; generatedAt: string;
}

function derivePreconditions(session: ActualSendRunSessionV2): ActualSendExecutePreconditionResultV2[] {
  const p: ActualSendExecutePreconditionResultV2[] = [];
  const s = session.sectionResolutionStates;

  p.push({ preconditionKey: "run_ready_achieved", label: "Run ready 달성", status: session.sessionStatus === "run_ready_pending_execute" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: session.sessionStatus !== "run_ready_pending_execute" ? `Status: ${session.sessionStatus}` : "", derivedFrom: "session.sessionStatus", blockingLevel: "hard_blocker" });

  const unresolved = s.filter(x => x.resolutionStatus === "blocked_unresolved" || x.resolutionStatus === "unreviewed" || x.resolutionStatus === "in_review" || x.remainingUnresolvedInputs.length > 0);
  p.push({ preconditionKey: "no_unresolved_run_section", label: "미해소 run section 없음", status: unresolved.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: unresolved.length > 0 ? `${unresolved.length}건 미해소` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const retExec = s.filter(x => x.resolutionStatus === "returned_to_actual_send_execution");
  p.push({ preconditionKey: "no_return_to_execution_dependency", label: "Execution return 없음", status: retExec.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retExec.length > 0 ? `${retExec.length}건 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const retCT = s.filter(x => x.resolutionStatus === "returned_to_commit_or_transaction");
  p.push({ preconditionKey: "no_return_to_commit_or_transaction_dependency", label: "Commit/transaction return 없음", status: retCT.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retCT.length > 0 ? `${retCT.length}건 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const checks: { key: ExecutePreconditionKey; secKey: RunSectionKey; label: string; level: ExecuteBlockingLevel }[] = [
    { key: "recipient_run_confirmed", secKey: "recipient_run_final_block", label: "수신자 run 확인", level: "hard_blocker" },
    { key: "payload_integrity_run_confirmed", secKey: "payload_integrity_run_final_block", label: "Payload integrity 확인", level: "hard_blocker" },
    { key: "reference_instruction_run_confirmed", secKey: "reference_instruction_run_final_block", label: "Reference/instruction 확인", level: "soft_blocker" },
    { key: "exclusion_guard_run_rechecked", secKey: "exclusion_guard_run_final_block", label: "Exclusion guard 재확인", level: "hard_blocker" },
    { key: "authorization_audit_run_confirmed", secKey: "actor_authorization_audit_run_final_block", label: "Authorization/audit 확인", level: "hard_blocker" },
  ];
  for (const c of checks) { const sec = s.find(x => x.sectionKey === c.secKey); const ok = sec && sec.eligibleForRunReadiness; p.push({ preconditionKey: c.key, label: c.label, status: ok ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !ok ? `${c.secKey} 미완료` : "", derivedFrom: `section:${c.secKey}`, blockingLevel: c.level }); }

  const guard = s.find(x => x.sectionKey === "exclusion_guard_run_final_block");
  p.push({ preconditionKey: "contamination_not_detected", label: "Contamination 미감지", status: guard?.resolutionMode === "guard_confirmation" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: guard?.resolutionMode !== "guard_confirmation" ? "Guard 미확인" : "", derivedFrom: "exclusion_guard_run_final_block", blockingLevel: "hard_blocker" });

  const audit = s.find(x => x.sectionKey === "actor_authorization_audit_run_final_block");
  p.push({ preconditionKey: "irreversible_run_basis_confirmed", label: "Irreversible run basis 확인", status: audit?.resolutionMode === "authorization_audit_confirmation" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: audit?.resolutionMode !== "authorization_audit_confirmation" ? "Authorization/audit 미확인" : "", derivedFrom: "actor_authorization_audit_run_final_block", blockingLevel: "hard_blocker" });

  p.push({ preconditionKey: "final_execute_policy_lock_cleared", label: "Final execute policy lock 해소", status: "satisfied", reasonIfUnsatisfied: "", derivedFrom: "policy_check", blockingLevel: "policy_lock" });

  return p;
}

function deriveBlockers(p: ActualSendExecutePreconditionResultV2[]): ActualSendExecuteBlockerSummaryV2 { const b = p.filter(x => x.status === "unsatisfied" && (x.blockingLevel === "hard_blocker" || x.blockingLevel === "soft_blocker")).map(x => x.reasonIfUnsatisfied); return { blockers: b, count: b.length, primaryBlocker: b[0] || null }; }
function deriveWarnings(p: ActualSendExecutePreconditionResultV2[], s: ActualSendRunSectionResolutionStateV2[]): ActualSendExecuteWarningSummaryV2 { const w: string[] = []; w.push(...p.filter(x => x.status === "unsatisfied" && x.blockingLevel === "warning").map(x => x.reasonIfUnsatisfied)); const ws = s.filter(x => x.resolutionStatus === "reviewed_with_warning"); if (ws.length > 0) w.push(`${ws.length}건 warning acknowledged`); return { warnings: w, count: w.length, primaryWarning: w[0] || null }; }

function deriveCandidate(session: ActualSendRunSessionV2, bs: ActualSendExecuteBlockerSummaryV2, ws: ActualSendExecuteWarningSummaryV2): ActualSendExecuteCandidateV2 {
  const isReady = session.sessionStatus === "run_ready_pending_execute";
  const status: ExecuteCandidateStatus = !isReady ? "not_candidate" : bs.count > 0 ? "candidate_with_blockers" : ws.count > 0 ? "candidate_with_warnings" : "candidate_ready_for_execute";
  const canOpen = status === "candidate_ready_for_execute";
  const snap = (k: RunSectionKey) => session.sectionResolutionStates.find(x => x.sectionKey === k)?.resolutionStatus || "unknown";
  return { candidateStatus: status, candidateReason: bs.count > 0 ? bs.primaryBlocker! : ws.count > 0 ? `Warning: ${ws.primaryWarning}` : isReady ? "Execute 가능" : "Run 미준비", originRunStatus: session.sessionStatus, runReadinessStatus: session.runReadinessGateState.runReadinessStatus, recipientFinalSnapshot: snap("recipient_run_final_block"), payloadIntegrityFinalSnapshot: snap("payload_integrity_run_final_block"), referenceInstructionFinalSnapshot: snap("reference_instruction_run_final_block"), exclusionGuardFinalSnapshot: snap("exclusion_guard_run_final_block"), authorizationAuditFinalSnapshot: snap("actor_authorization_audit_run_final_block"), canOpenActualSendExecuteControl: canOpen, canOnlyPreviewCandidate: !canOpen && isReady, requiresFinalPolicyReview: false };
}

function deriveActionGate(c: ActualSendExecuteCandidateV2, hasReturn: boolean): ActualSendExecuteActionGateStateV2 { return { canPreviewExecuteCandidate: c.candidateStatus !== "not_candidate", canReturnToRunReview: true, canReopenRunSectionReview: true, canRouteBackToExecutionOrCommitIfNeeded: hasReturn, canHoldForPolicyReview: true, canOpenActualSendExecuteControl: c.canOpenActualSendExecuteControl, canExecuteActualSendExecute: false as const, canMarkSent: false as const, canMarkDispatched: false as const, canCreateDeliveryTracking: false as const, disabledActionReasons: { execute_actual_send_execute: "Batch 1 금지: absolute terminal execute", mark_sent: "Batch 1 금지", mark_dispatched: "Batch 1 금지", create_delivery_tracking: "Batch 1 금지" } }; }

function deriveGateStatus(session: ActualSendRunSessionV2, c: ActualSendExecuteCandidateV2, hasOpenReturn: boolean, hasRevisitPending: boolean): ExecuteGateStatus {
  if (session.sessionStatus !== "run_ready_pending_execute") return "not_eligible";
  if (hasOpenReturn) return "return_dependency_open";
  if (hasRevisitPending) return "run_dependency_open";
  if (c.candidateStatus === "candidate_ready_for_execute") return "eligible_for_actual_send_execute";
  return "actual_send_execute_locked_by_policy";
}

function derivePhase(s: ExecuteGateStatus): ExecuteGatePhase { switch (s) { case "not_eligible": case "run_dependency_open": case "return_dependency_open": return "precheck"; case "eligible_for_actual_send_execute": return "execute_enabled"; case "actual_send_execute_locked_by_policy": return "policy_locked"; case "actual_send_execute_opened": return "execute_open"; } }

export function buildActualSendExecuteGateV2(session: ActualSendRunSessionV2): ActualSendExecuteGateV2 {
  const now = new Date().toISOString(); const secs = session.sectionResolutionStates;
  const precs = derivePreconditions(session); const unsatisfied = precs.filter(x => x.status === "unsatisfied");
  const bs = deriveBlockers(precs); const ws = deriveWarnings(precs, secs);
  const candidate = deriveCandidate(session, bs, ws);
  const hasOpenReturn = secs.some(x => x.resolutionStatus === "returned_to_actual_send_execution" || x.resolutionStatus === "returned_to_commit_or_transaction");
  const hasRevisitPending = secs.some(x => x.requiresRevisitAfterReturn);
  const hasPriorReturn = session.returnHistory.length > 0;
  const requiresDepReval = hasRevisitPending || (hasPriorReturn && hasRevisitPending);
  const gateStatus = deriveGateStatus(session, candidate, hasOpenReturn, hasRevisitPending);
  const actionGate = deriveActionGate(candidate, hasOpenReturn);
  const nextLabel = candidate.canOpenActualSendExecuteControl ? "Actual Send Execute Control (Entry Enabled)" : "Actual Send Execute Control (Locked Preview Only)";
  const provenance: ActualSendExecuteProvenanceV2 = { derivedFromRunSessionId: session.actualSendRunSessionId, derivedFromRunGateVersion: session.actualSendRunGateId, derivedFromRunReadinessSnapshotId: session.runReadinessGateState.runReadinessStatus, derivedFromSectionResolutionSnapshotIds: secs.map(x => `${x.sectionKey}:${x.resolutionStatus}`), derivedAt: now, derivedByEngineVersion: "v2-batch1", policyLockBasis: gateStatus === "actual_send_execute_locked_by_policy" ? "Policy lock 또는 unsatisfied precondition" : "none", dependencyRecheckBasis: requiresDepReval ? "Prior return + revisit pending" : "none", irreversibleExecuteBasis: gateStatus === "eligible_for_actual_send_execute" ? "All preconditions satisfied — absolute terminal execute eligible" : "Preconditions unsatisfied" };

  return { actualSendExecuteGateId: `execgate_${Date.now().toString(36)}`, caseId: session.caseId, handoffPackageId: session.handoffPackageId, actualSendRunGateId: session.actualSendRunGateId, actualSendRunSessionId: session.actualSendRunSessionId, gateStatus, gatePhase: derivePhase(gateStatus), candidateStatus: candidate.candidateStatus, candidate, blockerSummary: bs, warningSummary: ws, actionGate, requiredPreconditions: precs, unsatisfiedPreconditions: unsatisfied, executeStatus: "not_executed", nextSurfaceLabel: nextLabel, hasPriorReturnHistory: hasPriorReturn, hasReopenedSectionPending: hasRevisitPending, requiresDependencyRevalidation: requiresDepReval, lastReturnTarget: session.returnHistory.length > 0 ? session.returnHistory[session.returnHistory.length - 1].returnTarget : null, lastRunStatus: session.sessionStatus, provenance, generatedAt: now };
}

export type ExecuteGateEventType = "actual_send_execute_gate_computed" | "actual_send_execute_eligibility_confirmed" | "actual_send_execute_blocked" | "actual_send_execute_locked_by_policy" | "actual_send_execute_entry_enabled" | "actual_send_execute_preview_opened" | "actual_send_execute_returned_to_run_review";
export interface ExecuteGateEvent { type: ExecuteGateEventType; caseId: string; runSessionId: string; executeGateId: string; actionOrComputeReason: string; actorOrSystem: string; timestamp: string; }
export function createExecuteGateEvent(type: ExecuteGateEventType, gate: ActualSendExecuteGateV2, reason: string, actor: string): ExecuteGateEvent { return { type, caseId: gate.caseId, runSessionId: gate.actualSendRunSessionId, executeGateId: gate.actualSendExecuteGateId, actionOrComputeReason: reason, actorOrSystem: actor, timestamp: new Date().toISOString() }; }
