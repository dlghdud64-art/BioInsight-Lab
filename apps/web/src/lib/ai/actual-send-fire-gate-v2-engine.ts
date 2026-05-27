/**
 * Actual Send Fire Gate v2 Engine — execute ready → fire enablement
 *
 * 고정 규칙: execute ready ≠ fire enabled ≠ sent ≠ dispatched.
 * Batch 1: fire/mark_sent/mark_dispatched 전부 금지.
 * Dispatch v2 chain absolute final gate before irreversible supplier send.
 */

import type { ActualSendExecuteSessionV2, ExecuteSessionStatus, ActualSendExecuteFireReadinessGateStateV2, ActualSendExecuteSectionResolutionStateV2 } from "./actual-send-execute-resolution-v2-engine";
import type { ExecuteSectionKey } from "./actual-send-execute-workspace-v2";

export type FireGateStatus = "not_eligible" | "execute_dependency_open" | "return_dependency_open" | "eligible_for_actual_send_fire" | "actual_send_fire_locked_by_policy" | "actual_send_fire_opened";
export type FireGatePhase = "precheck" | "eligibility_review" | "fire_pending" | "fire_enabled" | "fire_open" | "policy_locked";

export type FirePreconditionKey = "execute_ready_achieved" | "no_unresolved_execute_section" | "no_return_to_run_dependency" | "no_return_to_execution_or_commit_dependency" | "recipient_execute_confirmed" | "payload_integrity_execute_confirmed" | "reference_instruction_execute_confirmed" | "exclusion_guard_execute_rechecked" | "authorization_audit_execute_confirmed" | "contamination_not_detected" | "irreversible_execute_basis_confirmed" | "final_fire_policy_lock_cleared";
export type FireBlockingLevel = "hard_blocker" | "soft_blocker" | "policy_lock" | "warning";

export interface ActualSendFirePreconditionResultV2 { preconditionKey: FirePreconditionKey; label: string; status: "satisfied" | "unsatisfied"; reasonIfUnsatisfied: string; derivedFrom: string; blockingLevel: FireBlockingLevel; }

export type FireCandidateStatus = "not_candidate" | "candidate_with_blockers" | "candidate_with_warnings" | "candidate_ready_for_fire" | "candidate_fire_locked";
export interface ActualSendFireCandidateV2 { candidateStatus: FireCandidateStatus; candidateReason: string; originExecuteStatus: ExecuteSessionStatus; executeFireReadinessStatus: string; recipientFinalSnapshot: string; payloadIntegrityFinalSnapshot: string; referenceInstructionFinalSnapshot: string; exclusionGuardFinalSnapshot: string; authorizationAuditFinalSnapshot: string; canOpenActualSendFireControl: boolean; canOnlyPreviewCandidate: boolean; requiresFinalPolicyReview: boolean; }

export interface ActualSendFireBlockerSummaryV2 { blockers: string[]; count: number; primaryBlocker: string | null; }
export interface ActualSendFireWarningSummaryV2 { warnings: string[]; count: number; primaryWarning: string | null; }

export interface ActualSendFireActionGateStateV2 { canPreviewFireCandidate: boolean; canReturnToExecuteReview: boolean; canReopenExecuteSectionReview: boolean; canRouteBackToRunOrCommitIfNeeded: boolean; canHoldForPolicyReview: boolean; canOpenActualSendFireControl: boolean; canExecuteActualSendFire: false; canMarkSent: false; canMarkDispatched: false; canCreateDeliveryTracking: false; disabledActionReasons: Record<string, string>; }

export interface ActualSendFireProvenanceV2 { derivedFromExecuteSessionId: string; derivedFromExecuteGateVersion: string; derivedFromFireReadinessSnapshotId: string; derivedFromSectionResolutionSnapshotIds: string[]; derivedAt: string; derivedByEngineVersion: string; policyLockBasis: string; dependencyRecheckBasis: string; irreversibleFireBasis: string; }

export interface ActualSendFireGateV2 {
  actualSendFireGateId: string; caseId: string; handoffPackageId: string; actualSendExecuteGateId: string; actualSendExecuteSessionId: string;
  gateStatus: FireGateStatus; gatePhase: FireGatePhase;
  candidateStatus: FireCandidateStatus; candidate: ActualSendFireCandidateV2;
  blockerSummary: ActualSendFireBlockerSummaryV2; warningSummary: ActualSendFireWarningSummaryV2;
  actionGate: ActualSendFireActionGateStateV2;
  requiredPreconditions: ActualSendFirePreconditionResultV2[]; unsatisfiedPreconditions: ActualSendFirePreconditionResultV2[];
  fireStatus: "not_fired"; nextSurfaceLabel: string;
  hasPriorReturnHistory: boolean; hasReopenedSectionPending: boolean; requiresDependencyRevalidation: boolean;
  lastReturnTarget: string | null; lastExecuteStatus: string;
  provenance: ActualSendFireProvenanceV2; generatedAt: string;
}

function derivePreconditions(session: ActualSendExecuteSessionV2): ActualSendFirePreconditionResultV2[] {
  const p: ActualSendFirePreconditionResultV2[] = []; const s = session.sectionResolutionStates;
  p.push({ preconditionKey: "execute_ready_achieved", label: "Execute ready 달성", status: session.sessionStatus === "execute_ready_pending_fire" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: session.sessionStatus !== "execute_ready_pending_fire" ? `Status: ${session.sessionStatus}` : "", derivedFrom: "session.sessionStatus", blockingLevel: "hard_blocker" });
  const unresolved = s.filter(x => x.resolutionStatus === "blocked_unresolved" || x.resolutionStatus === "unreviewed" || x.resolutionStatus === "in_review" || x.remainingUnresolvedInputs.length > 0);
  p.push({ preconditionKey: "no_unresolved_execute_section", label: "미해소 execute section 없음", status: unresolved.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: unresolved.length > 0 ? `${unresolved.length}건 미해소` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });
  const retRun = s.filter(x => x.resolutionStatus === "returned_to_actual_send_run");
  p.push({ preconditionKey: "no_return_to_run_dependency", label: "Run return 없음", status: retRun.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retRun.length > 0 ? `${retRun.length}건 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });
  const retEC = s.filter(x => x.resolutionStatus === "returned_to_execution_or_commit");
  p.push({ preconditionKey: "no_return_to_execution_or_commit_dependency", label: "Execution/commit return 없음", status: retEC.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: retEC.length > 0 ? `${retEC.length}건 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });
  const checks: { key: FirePreconditionKey; secKey: ExecuteSectionKey; label: string; level: FireBlockingLevel }[] = [
    { key: "recipient_execute_confirmed", secKey: "recipient_execute_final_block", label: "수신자 execute 확인", level: "hard_blocker" },
    { key: "payload_integrity_execute_confirmed", secKey: "payload_integrity_execute_final_block", label: "Payload integrity 확인", level: "hard_blocker" },
    { key: "reference_instruction_execute_confirmed", secKey: "reference_instruction_execute_final_block", label: "Reference/instruction 확인", level: "soft_blocker" },
    { key: "exclusion_guard_execute_rechecked", secKey: "exclusion_guard_execute_final_block", label: "Exclusion guard 재확인", level: "hard_blocker" },
    { key: "authorization_audit_execute_confirmed", secKey: "actor_authorization_audit_execute_final_block", label: "Authorization/audit 확인", level: "hard_blocker" },
  ];
  for (const c of checks) { const sec = s.find(x => x.sectionKey === c.secKey); const ok = sec && sec.eligibleForFireReadiness; p.push({ preconditionKey: c.key, label: c.label, status: ok ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !ok ? `${c.secKey} 미완료` : "", derivedFrom: `section:${c.secKey}`, blockingLevel: c.level }); }
  const guard = s.find(x => x.sectionKey === "exclusion_guard_execute_final_block");
  p.push({ preconditionKey: "contamination_not_detected", label: "Contamination 미감지", status: guard?.resolutionMode === "guard_confirmation" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: guard?.resolutionMode !== "guard_confirmation" ? "Guard 미확인" : "", derivedFrom: "exclusion_guard_execute_final_block", blockingLevel: "hard_blocker" });
  const audit = s.find(x => x.sectionKey === "actor_authorization_audit_execute_final_block");
  p.push({ preconditionKey: "irreversible_execute_basis_confirmed", label: "Irreversible execute basis 확인", status: audit?.resolutionMode === "authorization_audit_confirmation" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: audit?.resolutionMode !== "authorization_audit_confirmation" ? "Authorization/audit 미확인" : "", derivedFrom: "actor_authorization_audit_execute_final_block", blockingLevel: "hard_blocker" });
  p.push({ preconditionKey: "final_fire_policy_lock_cleared", label: "Final fire policy lock 해소", status: "satisfied", reasonIfUnsatisfied: "", derivedFrom: "policy_check", blockingLevel: "policy_lock" });
  return p;
}

function deriveBlockers(p: ActualSendFirePreconditionResultV2[]): ActualSendFireBlockerSummaryV2 { const b = p.filter(x => x.status === "unsatisfied" && (x.blockingLevel === "hard_blocker" || x.blockingLevel === "soft_blocker")).map(x => x.reasonIfUnsatisfied); return { blockers: b, count: b.length, primaryBlocker: b[0] || null }; }
function deriveWarnings(p: ActualSendFirePreconditionResultV2[], s: ActualSendExecuteSectionResolutionStateV2[]): ActualSendFireWarningSummaryV2 { const w: string[] = []; w.push(...p.filter(x => x.status === "unsatisfied" && x.blockingLevel === "warning").map(x => x.reasonIfUnsatisfied)); const ws = s.filter(x => x.resolutionStatus === "reviewed_with_warning"); if (ws.length > 0) w.push(`${ws.length}건 warning acknowledged`); return { warnings: w, count: w.length, primaryWarning: w[0] || null }; }

function deriveCandidate(session: ActualSendExecuteSessionV2, bs: ActualSendFireBlockerSummaryV2, ws: ActualSendFireWarningSummaryV2): ActualSendFireCandidateV2 {
  const isReady = session.sessionStatus === "execute_ready_pending_fire"; const status: FireCandidateStatus = !isReady ? "not_candidate" : bs.count > 0 ? "candidate_with_blockers" : ws.count > 0 ? "candidate_with_warnings" : "candidate_ready_for_fire";
  const canOpen = status === "candidate_ready_for_fire"; const snap = (k: ExecuteSectionKey) => session.sectionResolutionStates.find(x => x.sectionKey === k)?.resolutionStatus || "unknown";
  return { candidateStatus: status, candidateReason: bs.count > 0 ? bs.primaryBlocker! : ws.count > 0 ? `Warning: ${ws.primaryWarning}` : isReady ? "Fire 가능" : "Execute 미준비", originExecuteStatus: session.sessionStatus, executeFireReadinessStatus: session.fireReadinessGateState.fireReadinessStatus, recipientFinalSnapshot: snap("recipient_execute_final_block"), payloadIntegrityFinalSnapshot: snap("payload_integrity_execute_final_block"), referenceInstructionFinalSnapshot: snap("reference_instruction_execute_final_block"), exclusionGuardFinalSnapshot: snap("exclusion_guard_execute_final_block"), authorizationAuditFinalSnapshot: snap("actor_authorization_audit_execute_final_block"), canOpenActualSendFireControl: canOpen, canOnlyPreviewCandidate: !canOpen && isReady, requiresFinalPolicyReview: false };
}

function deriveActionGate(c: ActualSendFireCandidateV2, hasReturn: boolean): ActualSendFireActionGateStateV2 { return { canPreviewFireCandidate: c.candidateStatus !== "not_candidate", canReturnToExecuteReview: true, canReopenExecuteSectionReview: true, canRouteBackToRunOrCommitIfNeeded: hasReturn, canHoldForPolicyReview: true, canOpenActualSendFireControl: c.canOpenActualSendFireControl, canExecuteActualSendFire: false as const, canMarkSent: false as const, canMarkDispatched: false as const, canCreateDeliveryTracking: false as const, disabledActionReasons: { execute_actual_send_fire: "Batch 1 금지: absolute final fire", mark_sent: "Batch 1 금지", mark_dispatched: "Batch 1 금지", create_delivery_tracking: "Batch 1 금지" } }; }

function deriveGateStatus(session: ActualSendExecuteSessionV2, c: ActualSendFireCandidateV2, hasOpenReturn: boolean, hasRevisitPending: boolean): FireGateStatus {
  if (session.sessionStatus !== "execute_ready_pending_fire") return "not_eligible"; if (hasOpenReturn) return "return_dependency_open"; if (hasRevisitPending) return "execute_dependency_open";
  if (c.candidateStatus === "candidate_ready_for_fire") return "eligible_for_actual_send_fire"; return "actual_send_fire_locked_by_policy";
}
function derivePhase(s: FireGateStatus): FireGatePhase { switch (s) { case "not_eligible": case "execute_dependency_open": case "return_dependency_open": return "precheck"; case "eligible_for_actual_send_fire": return "fire_enabled"; case "actual_send_fire_locked_by_policy": return "policy_locked"; case "actual_send_fire_opened": return "fire_open"; } }

export function buildActualSendFireGateV2(session: ActualSendExecuteSessionV2): ActualSendFireGateV2 {
  const now = new Date().toISOString(); const secs = session.sectionResolutionStates;
  const precs = derivePreconditions(session); const unsatisfied = precs.filter(x => x.status === "unsatisfied");
  const bs = deriveBlockers(precs); const ws = deriveWarnings(precs, secs); const candidate = deriveCandidate(session, bs, ws);
  const hasOpenReturn = secs.some(x => x.resolutionStatus === "returned_to_actual_send_run" || x.resolutionStatus === "returned_to_execution_or_commit");
  const hasRevisitPending = secs.some(x => x.requiresRevisitAfterReturn); const hasPriorReturn = session.returnHistory.length > 0;
  const requiresDepReval = hasRevisitPending || (hasPriorReturn && hasRevisitPending);
  const gateStatus = deriveGateStatus(session, candidate, hasOpenReturn, hasRevisitPending); const actionGate = deriveActionGate(candidate, hasOpenReturn);
  const nextLabel = candidate.canOpenActualSendFireControl ? "Actual Send Fire Control (Entry Enabled)" : "Actual Send Fire Control (Locked Preview Only)";
  const provenance: ActualSendFireProvenanceV2 = { derivedFromExecuteSessionId: session.actualSendExecuteSessionId, derivedFromExecuteGateVersion: session.actualSendExecuteGateId, derivedFromFireReadinessSnapshotId: session.fireReadinessGateState.fireReadinessStatus, derivedFromSectionResolutionSnapshotIds: secs.map(x => `${x.sectionKey}:${x.resolutionStatus}`), derivedAt: now, derivedByEngineVersion: "v2-batch1", policyLockBasis: gateStatus === "actual_send_fire_locked_by_policy" ? "Policy lock" : "none", dependencyRecheckBasis: requiresDepReval ? "Prior return + revisit pending" : "none", irreversibleFireBasis: gateStatus === "eligible_for_actual_send_fire" ? "All preconditions satisfied — absolute final fire eligible" : "Preconditions unsatisfied" };

  return { actualSendFireGateId: `firegate_${Date.now().toString(36)}`, caseId: session.caseId, handoffPackageId: session.handoffPackageId, actualSendExecuteGateId: session.actualSendExecuteGateId, actualSendExecuteSessionId: session.actualSendExecuteSessionId, gateStatus, gatePhase: derivePhase(gateStatus), candidateStatus: candidate.candidateStatus, candidate, blockerSummary: bs, warningSummary: ws, actionGate, requiredPreconditions: precs, unsatisfiedPreconditions: unsatisfied, fireStatus: "not_fired", nextSurfaceLabel: nextLabel, hasPriorReturnHistory: hasPriorReturn, hasReopenedSectionPending: hasRevisitPending, requiresDependencyRevalidation: requiresDepReval, lastReturnTarget: session.returnHistory.length > 0 ? session.returnHistory[session.returnHistory.length - 1].returnTarget : null, lastExecuteStatus: session.sessionStatus, provenance, generatedAt: now };
}

export type FireGateEventType = "actual_send_fire_gate_computed" | "actual_send_fire_eligibility_confirmed" | "actual_send_fire_blocked" | "actual_send_fire_locked_by_policy" | "actual_send_fire_entry_enabled" | "actual_send_fire_preview_opened" | "actual_send_fire_returned_to_execute_review";
export interface FireGateEvent { type: FireGateEventType; caseId: string; executeSessionId: string; fireGateId: string; actionOrComputeReason: string; actorOrSystem: string; timestamp: string; }
export function createFireGateEvent(type: FireGateEventType, gate: ActualSendFireGateV2, reason: string, actor: string): FireGateEvent { return { type, caseId: gate.caseId, executeSessionId: gate.actualSendExecuteSessionId, fireGateId: gate.actualSendFireGateId, actionOrComputeReason: reason, actorOrSystem: actor, timestamp: new Date().toISOString() }; }
