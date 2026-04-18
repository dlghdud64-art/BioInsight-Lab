/**
 * Send Execution Gate v2 Engine — confirmation complete → send execution entry eligibility
 *
 * 고정 규칙:
 * 1. SendConfirmationSessionV2 + CompletionGateState = 입력 source.
 * 2. confirmation complete ≠ send execution entry eligible.
 * 3. send execution entry ≠ dispatched.
 * 4. return/reopen/dependency revalidation 이력 반영.
 * 5. precondition 10종 명시적 판정.
 * 6. Batch 1: execute_supplier_send / mark_dispatched 전부 금지.
 * 7. candidate readiness와 policy lock 분리.
 * 8. provenance + audit 강화.
 */

import type { SendConfirmationSessionV2, ConfirmationSessionStatus, SendConfirmationCompletionGateStateV2, SendConfirmationSectionResolutionStateV2 } from "./send-confirmation-resolution-v2-engine";
import type { SendConfirmationSectionKey } from "./send-confirmation-workspace-v2";

// ── Gate Status / Phase ──
export type SendExecutionGateStatus = "not_eligible" | "confirmation_dependency_open" | "return_dependency_open" | "eligible_for_send_execution_entry" | "send_execution_locked_by_policy" | "send_execution_entry_opened";
export type SendExecutionGatePhase = "precheck" | "eligibility_review" | "entry_pending" | "entry_enabled" | "entry_open" | "policy_locked";

// ── Precondition ──
export type SendExecutionPreconditionKey = "confirmation_completion_achieved" | "no_unresolved_section_blocker" | "no_return_to_validation_dependency" | "no_return_to_draft_assembly_dependency" | "recipient_confirmed" | "scope_confirmed" | "mandatory_reference_confirmed" | "instruction_confirmed" | "exclusion_guard_confirmed" | "contamination_not_detected";
export type SendExecBlockingLevel = "hard_blocker" | "soft_blocker" | "policy_lock" | "warning";

export interface SendExecutionPreconditionResultV2 { preconditionKey: SendExecutionPreconditionKey; label: string; status: "satisfied" | "unsatisfied"; reasonIfUnsatisfied: string; derivedFrom: string; blockingLevel: SendExecBlockingLevel; }

// ── Entry Candidate ──
export type SendExecCandidateStatus = "not_candidate" | "candidate_with_blockers" | "candidate_with_warnings" | "candidate_ready_for_entry" | "candidate_entry_locked";

export interface SendExecutionEntryCandidateV2 { candidateStatus: SendExecCandidateStatus; candidateReason: string; originConfirmationStatus: ConfirmationSessionStatus; confirmationCompletionStatus: string; supplierPayloadIntegritySnapshot: string; recipientConfirmationSnapshot: string; scopeConfirmationSnapshot: string; referenceVisibilitySnapshot: string; instructionVisibilitySnapshot: string; exclusionGuardSnapshot: string; canOpenSendExecutionWorkspace: boolean; canOnlyPreviewCandidate: boolean; requiresAdditionalGateReview: boolean; }

// ── Blocker / Warning ──
export interface SendExecutionBlockerSummaryV2 { blockers: string[]; count: number; primaryBlocker: string | null; }
export interface SendExecutionWarningSummaryV2 { warnings: string[]; count: number; primaryWarning: string | null; }

// ── Action Gate ──
export interface SendExecutionActionGateV2 { canOpenSendExecutionWorkspace: boolean; canPreviewSendExecutionCandidate: boolean; canReturnToSendConfirmationReview: boolean; canReopenConfirmationSectionReview: boolean; canRouteBackToValidationOrDraft: boolean; canHoldForPolicyReview: boolean; canPrepareSendExecutionSession: boolean; canExecuteSupplierSend: false; canMarkDispatched: false; disabledActionReasons: Record<string, string>; }

// ── Provenance ──
export interface SendExecutionProvenanceV2 { derivedFromConfirmationSessionId: string; derivedFromConfirmationGateVersion: string; derivedFromConfirmationCompletionSnapshotId: string; derivedFromSectionResolutionSnapshotIds: string[]; derivedAt: string; derivedByEngineVersion: string; policyLockBasis: string; dependencyRecheckBasis: string; }

// ── Top-Level Gate ──
export interface SendExecutionGateV2 {
  sendExecutionGateId: string; caseId: string; handoffPackageId: string; sendConfirmationGateId: string; confirmationSessionId: string;
  gateStatus: SendExecutionGateStatus; gatePhase: SendExecutionGatePhase;
  entryCandidateStatus: SendExecCandidateStatus; entryCandidate: SendExecutionEntryCandidateV2;
  blockerSummary: SendExecutionBlockerSummaryV2; warningSummary: SendExecutionWarningSummaryV2;
  actionGate: SendExecutionActionGateV2;
  requiredPreconditions: SendExecutionPreconditionResultV2[]; unsatisfiedPreconditions: SendExecutionPreconditionResultV2[];
  dispatchStatus: "not_dispatched"; nextSurfaceLabel: string;
  hasPriorReturnHistory: boolean; hasReopenedSectionPending: boolean; requiresDependencyRevalidation: boolean;
  lastReturnTarget: string | null; lastConfirmationStatus: string;
  provenance: SendExecutionProvenanceV2; generatedAt: string;
}

// ── Precondition Derivation ──
function derivePreconditions(session: SendConfirmationSessionV2): SendExecutionPreconditionResultV2[] {
  const precs: SendExecutionPreconditionResultV2[] = [];
  const secs = session.sectionResolutionStates;

  precs.push({ preconditionKey: "confirmation_completion_achieved", label: "Confirmation 완료", status: session.sessionStatus === "confirmation_complete_pending_send_execution_gate" ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: session.sessionStatus !== "confirmation_complete_pending_send_execution_gate" ? `Status: ${session.sessionStatus}` : "", derivedFrom: "session.sessionStatus", blockingLevel: "hard_blocker" });

  const unresolvedSecs = secs.filter(s => s.resolutionStatus === "blocked_unresolved" || s.resolutionStatus === "unreviewed" || s.resolutionStatus === "in_review" || s.remainingUnconfirmedInputs.length > 0);
  precs.push({ preconditionKey: "no_unresolved_section_blocker", label: "미해소 section 없음", status: unresolvedSecs.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: unresolvedSecs.length > 0 ? `${unresolvedSecs.length}건 미해소` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const returnedToVal = secs.filter(s => s.resolutionStatus === "returned_to_validation");
  precs.push({ preconditionKey: "no_return_to_validation_dependency", label: "Validation return dependency 없음", status: returnedToVal.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: returnedToVal.length > 0 ? `${returnedToVal.length}건 validation return 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const returnedToDraft = secs.filter(s => s.resolutionStatus === "returned_to_draft_assembly");
  precs.push({ preconditionKey: "no_return_to_draft_assembly_dependency", label: "Draft assembly return dependency 없음", status: returnedToDraft.length === 0 ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: returnedToDraft.length > 0 ? `${returnedToDraft.length}건 draft return 열림` : "", derivedFrom: "sectionResolutionStates", blockingLevel: "hard_blocker" });

  const secChecks: { key: SendExecutionPreconditionKey; secKey: SendConfirmationSectionKey; label: string; level: SendExecBlockingLevel }[] = [
    { key: "recipient_confirmed", secKey: "recipient_confirmation_block", label: "수신자 확인 완료", level: "hard_blocker" },
    { key: "scope_confirmed", secKey: "scope_confirmation_block", label: "범위 확인 완료", level: "hard_blocker" },
    { key: "mandatory_reference_confirmed", secKey: "reference_visibility_confirmation_block", label: "필수 reference 확인", level: "soft_blocker" },
    { key: "instruction_confirmed", secKey: "instruction_confirmation_block", label: "Instruction 확인", level: "soft_blocker" },
    { key: "exclusion_guard_confirmed", secKey: "exclusion_guard_confirmation_block", label: "Exclusion guard 확인", level: "hard_blocker" },
  ];
  for (const c of secChecks) { const s = secs.find(x => x.sectionKey === c.secKey); const ok = s && s.eligibleForConfirmationCompletion; precs.push({ preconditionKey: c.key, label: c.label, status: ok ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !ok ? `${c.secKey} 미완료` : "", derivedFrom: `section:${c.secKey}`, blockingLevel: c.level }); }

  const guardSec = secs.find(s => s.sectionKey === "exclusion_guard_confirmation_block");
  const contamOk = guardSec && guardSec.resolutionStatus === "confirmed_complete" && guardSec.resolutionMode === "guard_confirmation";
  precs.push({ preconditionKey: "contamination_not_detected", label: "Contamination 미감지", status: contamOk ? "satisfied" : "unsatisfied", reasonIfUnsatisfied: !contamOk ? "Exclusion guard 미확인 또는 contamination risk" : "", derivedFrom: "exclusion_guard_confirmation_block", blockingLevel: "hard_blocker" });

  return precs;
}

// ── Helpers ──
function deriveBlockerSummary(precs: SendExecutionPreconditionResultV2[]): SendExecutionBlockerSummaryV2 { const b = precs.filter(p => p.status === "unsatisfied" && (p.blockingLevel === "hard_blocker" || p.blockingLevel === "soft_blocker")).map(p => p.reasonIfUnsatisfied); return { blockers: b, count: b.length, primaryBlocker: b[0] || null }; }
function deriveWarningSummary(precs: SendExecutionPreconditionResultV2[], secs: SendConfirmationSectionResolutionStateV2[]): SendExecutionWarningSummaryV2 { const w: string[] = []; w.push(...precs.filter(p => p.status === "unsatisfied" && p.blockingLevel === "warning").map(p => p.reasonIfUnsatisfied)); const ws = secs.filter(s => s.resolutionStatus === "confirmed_with_warning"); if (ws.length > 0) w.push(`${ws.length}건 warning acknowledged`); return { warnings: w, count: w.length, primaryWarning: w[0] || null }; }

function deriveCandidate(session: SendConfirmationSessionV2, bs: SendExecutionBlockerSummaryV2, ws: SendExecutionWarningSummaryV2): SendExecutionEntryCandidateV2 {
  const isComplete = session.sessionStatus === "confirmation_complete_pending_send_execution_gate";
  const status: SendExecCandidateStatus = !isComplete ? "not_candidate" : bs.count > 0 ? "candidate_with_blockers" : ws.count > 0 ? "candidate_with_warnings" : "candidate_ready_for_entry";
  const canOpen = status === "candidate_ready_for_entry";
  const secs = session.sectionResolutionStates;
  const snap = (k: SendConfirmationSectionKey) => secs.find(s => s.sectionKey === k)?.resolutionStatus || "unknown";
  return { candidateStatus: status, candidateReason: bs.count > 0 ? bs.primaryBlocker! : ws.count > 0 ? `Warning: ${ws.primaryWarning}` : isComplete ? "Send execution entry 가능" : "Confirmation 미완료", originConfirmationStatus: session.sessionStatus, confirmationCompletionStatus: session.completionGateState.completionStatus, supplierPayloadIntegritySnapshot: `${secs.filter(s => s.eligibleForConfirmationCompletion).length}/${secs.length}`, recipientConfirmationSnapshot: snap("recipient_confirmation_block"), scopeConfirmationSnapshot: snap("scope_confirmation_block"), referenceVisibilitySnapshot: snap("reference_visibility_confirmation_block"), instructionVisibilitySnapshot: snap("instruction_confirmation_block"), exclusionGuardSnapshot: snap("exclusion_guard_confirmation_block"), canOpenSendExecutionWorkspace: canOpen, canOnlyPreviewCandidate: !canOpen && isComplete, requiresAdditionalGateReview: bs.count > 0 || ws.count > 0 };
}

function deriveActionGate(candidate: SendExecutionEntryCandidateV2, hasReturn: boolean): SendExecutionActionGateV2 { return { canOpenSendExecutionWorkspace: candidate.canOpenSendExecutionWorkspace, canPreviewSendExecutionCandidate: candidate.candidateStatus !== "not_candidate", canReturnToSendConfirmationReview: true, canReopenConfirmationSectionReview: true, canRouteBackToValidationOrDraft: hasReturn, canHoldForPolicyReview: true, canPrepareSendExecutionSession: candidate.canOpenSendExecutionWorkspace, canExecuteSupplierSend: false as const, canMarkDispatched: false as const, disabledActionReasons: { execute_supplier_send: "Batch 1 정책: supplier 발송 실행 금지", mark_dispatched: "Batch 1 정책: dispatched 처리 금지" } }; }

function deriveGateStatus(session: SendConfirmationSessionV2, candidate: SendExecutionEntryCandidateV2, hasOpenReturn: boolean, hasRevisitPending: boolean): SendExecutionGateStatus {
  if (session.sessionStatus !== "confirmation_complete_pending_send_execution_gate") return "not_eligible";
  if (hasOpenReturn) return "return_dependency_open";
  if (hasRevisitPending) return "confirmation_dependency_open";
  if (candidate.candidateStatus === "candidate_ready_for_entry") return "eligible_for_send_execution_entry";
  return "send_execution_locked_by_policy";
}

function derivePhase(s: SendExecutionGateStatus): SendExecutionGatePhase { switch (s) { case "not_eligible": case "confirmation_dependency_open": case "return_dependency_open": return "precheck"; case "eligible_for_send_execution_entry": return "entry_enabled"; case "send_execution_locked_by_policy": return "policy_locked"; case "send_execution_entry_opened": return "entry_open"; } }

// ── Main Builder ──
export function buildSendExecutionGateV2(session: SendConfirmationSessionV2): SendExecutionGateV2 {
  const now = new Date().toISOString(); const secs = session.sectionResolutionStates;
  const precs = derivePreconditions(session); const unsatisfied = precs.filter(p => p.status === "unsatisfied");
  const bs = deriveBlockerSummary(precs); const ws = deriveWarningSummary(precs, secs);
  const candidate = deriveCandidate(session, bs, ws);
  const hasOpenReturn = secs.some(s => s.resolutionStatus === "returned_to_validation" || s.resolutionStatus === "returned_to_draft_assembly");
  const hasRevisitPending = secs.some(s => s.requiresRevisitAfterReturn);
  const hasPriorReturn = session.returnHistory.length > 0;
  const requiresDepReval = hasRevisitPending || (hasPriorReturn && hasRevisitPending);
  const gateStatus = deriveGateStatus(session, candidate, hasOpenReturn, hasRevisitPending);
  const actionGate = deriveActionGate(candidate, hasOpenReturn);
  const nextLabel = candidate.canOpenSendExecutionWorkspace ? "Send Execution Workspace (Entry Enabled)" : "Send Execution Workspace (Locked Preview Only)";
  const provenance: SendExecutionProvenanceV2 = { derivedFromConfirmationSessionId: session.confirmationSessionId, derivedFromConfirmationGateVersion: session.sendConfirmationGateId, derivedFromConfirmationCompletionSnapshotId: session.completionGateState.completionStatus, derivedFromSectionResolutionSnapshotIds: secs.map(s => `${s.sectionKey}:${s.resolutionStatus}`), derivedAt: now, derivedByEngineVersion: "v2-batch1", policyLockBasis: gateStatus === "send_execution_locked_by_policy" ? "Batch 1 또는 unsatisfied precondition" : "none", dependencyRecheckBasis: requiresDepReval ? "Prior return + revisit pending" : "none" };

  return { sendExecutionGateId: `sndexgate_${Date.now().toString(36)}`, caseId: session.caseId, handoffPackageId: session.handoffPackageId, sendConfirmationGateId: session.sendConfirmationGateId, confirmationSessionId: session.confirmationSessionId, gateStatus, gatePhase: derivePhase(gateStatus), entryCandidateStatus: candidate.candidateStatus, entryCandidate: candidate, blockerSummary: bs, warningSummary: ws, actionGate, requiredPreconditions: precs, unsatisfiedPreconditions: unsatisfied, dispatchStatus: "not_dispatched", nextSurfaceLabel: nextLabel, hasPriorReturnHistory: hasPriorReturn, hasReopenedSectionPending: hasRevisitPending, requiresDependencyRevalidation: requiresDepReval, lastReturnTarget: session.returnHistory.length > 0 ? session.returnHistory[session.returnHistory.length - 1].returnTarget : null, lastConfirmationStatus: session.sessionStatus, provenance, generatedAt: now };
}

// ── Events ──
export type SendExecutionGateEventType = "send_execution_entry_gate_computed" | "send_execution_entry_eligibility_confirmed" | "send_execution_entry_blocked" | "send_execution_entry_locked_by_policy" | "send_execution_entry_enabled" | "send_execution_entry_preview_opened" | "send_execution_entry_returned_to_confirmation_review";
export interface SendExecutionGateEvent { type: SendExecutionGateEventType; caseId: string; confirmationSessionId: string; sendExecutionGateId: string; actionOrComputeReason: string; actorOrSystem: string; timestamp: string; }
export function createSendExecutionGateEvent(type: SendExecutionGateEventType, gate: SendExecutionGateV2, reason: string, actor: string): SendExecutionGateEvent { return { type, caseId: gate.caseId, confirmationSessionId: gate.confirmationSessionId, sendExecutionGateId: gate.sendExecutionGateId, actionOrComputeReason: reason, actorOrSystem: actor, timestamp: new Date().toISOString() }; }
