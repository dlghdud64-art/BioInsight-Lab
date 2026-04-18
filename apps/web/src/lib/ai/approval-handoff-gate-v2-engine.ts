/**
 * Approval Handoff Gate v2 Engine — compare decision snapshot → approval handoff package
 *
 * 고정 규칙:
 * 1. compareDecisionSnapshotV2 = 단일 입력 source.
 * 2. shortlist_ready ≠ approval review started. handoff ready 이후에만 넘기기.
 * 3. scope/separation/rationale/governance/intake 5개 readiness 축 분리 평가.
 * 4. hold / excluded는 approval scope에서 명시적 제외.
 * 5. rationale은 approval이 재작성하지 않도록 구조적으로 넘김.
 * 6. canonical approvalHandoffPackageV2 = approval layer의 단일 intake source.
 * 7. actual approval approve/reject는 이 단계에서 금지.
 * 8. compare decision → approval handoff → approval hydration → approval review 순서 강제.
 */

import type { CompareDecisionSnapshotV2, DecisionSnapshotStatus, CandidateRationale } from "./compare-reopen-v2-review-engine";
import type { CompareGroup, DeltaFirstAxis } from "./compare-reopen-v2-handoff-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";

// ── Gate Status ──
export type ApprovalHandoffGateStatusV2 = "not_started" | "blocked" | "warning" | "ready" | "handed_off";

// ── Readiness Axis ──
export type ApprovalHandoffAxis = "scope_approval_ready" | "separation_approval_ready" | "rationale_approval_ready" | "governance_approval_ready" | "intake_approval_ready";
export type ApprovalHandoffAxisStatus = "ok" | "warning" | "blocked";

export interface ApprovalHandoffAxisResult {
  axis: ApprovalHandoffAxis;
  status: ApprovalHandoffAxisStatus;
  detail: string;
}

// ── Precheck Flag ──
export type ApprovalHandoffPrecheckFlag =
  | "shortlist_empty"
  | "hold_contamination"
  | "excluded_contamination"
  | "rationale_incomplete"
  | "provenance_missing"
  | "quote_reference_missing"
  | "policy_reference_missing"
  | "budget_reference_missing"
  | "mixed_decision_unresolved"
  | "governance_context_stale";

// ── Exception Flag ──
export type ApprovalHandoffExceptionFlag =
  | "equivalent_heavy_shortlist"
  | "hold_issue_remaining"
  | "stale_quote_context"
  | "budget_recheck_needed"
  | "policy_gap";

// ── Handoff Decision ──
export interface ApprovalHandoffDecisionV2 {
  approvalScope: string;
  shortlistCandidateIds: string[];
  holdExcludedIds: string[];
  excludedCandidateIds: string[];
  provenanceByCandidate: LaneProvenance[];
  rationaleByCandidate: CandidateRationale[];
  quoteReferenceVisible: boolean;
  policyReferenceVisible: boolean;
  budgetReferenceVisible: boolean;
  operatorNote: string;
  precheckFlags: ApprovalHandoffPrecheckFlag[];
  exceptionFlags: ApprovalHandoffExceptionFlag[];
}

// ── State ──
export interface ApprovalHandoffGateV2State {
  gateStatus: ApprovalHandoffGateStatusV2;
  compareDecisionSnapshotV2Id: string;
  sourceCompareReviewSessionV2Id: string;
  sourceCompareReopenHandoffPackageV2Id: string;
  poRecordId: string;
  snapshotStatus: DecisionSnapshotStatus;
  shortlistCount: number;
  holdCount: number;
  excludedCount: number;
  compareGroups: CompareGroup[];
  deltaFirstAxis: DeltaFirstAxis[];
  axisResults: ApprovalHandoffAxisResult[];
  decision: ApprovalHandoffDecisionV2 | null;
  blockerCount: number;
  warningCount: number;
  handoffPackageId: string | null;
  approvalCaseId: string | null;
}

export function createInitialApprovalHandoffGateState(snapshot: CompareDecisionSnapshotV2): ApprovalHandoffGateV2State {
  const axes = evaluateApprovalHandoffAxes(snapshot, null);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    gateStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    compareDecisionSnapshotV2Id: snapshot.id,
    sourceCompareReviewSessionV2Id: snapshot.sourceCompareReviewSessionV2Id,
    sourceCompareReopenHandoffPackageV2Id: snapshot.sourceCompareReopenHandoffPackageV2Id,
    poRecordId: snapshot.poRecordId,
    snapshotStatus: snapshot.status,
    shortlistCount: snapshot.shortlistCandidateIds.length,
    holdCount: snapshot.heldCandidateIds.length,
    excludedCount: snapshot.excludedCandidateIds.length,
    compareGroups: snapshot.compareGroups,
    deltaFirstAxis: snapshot.deltaFirstAxis,
    axisResults: axes,
    decision: null,
    blockerCount: blockers.length,
    warningCount: warnings.length,
    handoffPackageId: null,
    approvalCaseId: null,
  };
}

// ── Readiness Axes Evaluation ──
export function evaluateApprovalHandoffAxes(snapshot: CompareDecisionSnapshotV2, decision: ApprovalHandoffDecisionV2 | null): ApprovalHandoffAxisResult[] {
  const results: ApprovalHandoffAxisResult[] = [];

  // 1. Scope approval ready
  if (snapshot.status !== "shortlist_ready" && snapshot.status !== "mixed_decision_ready") {
    results.push({ axis: "scope_approval_ready", status: "blocked", detail: "Snapshot이 approval 가능한 상태가 아님" });
  } else if (snapshot.shortlistCandidateIds.length === 0) {
    results.push({ axis: "scope_approval_ready", status: "blocked", detail: "Shortlist candidate가 없음" });
  } else if (decision && decision.shortlistCandidateIds.length === 0) {
    results.push({ axis: "scope_approval_ready", status: "blocked", detail: "Approval scope candidate 미지정" });
  } else if (decision?.shortlistCandidateIds.length) {
    results.push({ axis: "scope_approval_ready", status: "ok", detail: `${decision.shortlistCandidateIds.length}건 approval scope 확인됨` });
  } else {
    results.push({ axis: "scope_approval_ready", status: "blocked", detail: "Approval scope 미입력" });
  }

  // 2. Separation approval ready
  if (decision) {
    const shortlistSet = new Set(decision.shortlistCandidateIds);
    const holdInShortlist = decision.holdExcludedIds.filter(id => shortlistSet.has(id));
    const excludedInShortlist = decision.excludedCandidateIds.filter(id => shortlistSet.has(id));

    if (holdInShortlist.length > 0) {
      results.push({ axis: "separation_approval_ready", status: "blocked", detail: `${holdInShortlist.length}건 hold candidate가 approval scope에 포함` });
    } else if (excludedInShortlist.length > 0) {
      results.push({ axis: "separation_approval_ready", status: "blocked", detail: `${excludedInShortlist.length}건 excluded candidate가 approval scope에 포함` });
    } else if (snapshot.status === "mixed_decision_ready" && decision.precheckFlags.includes("mixed_decision_unresolved")) {
      results.push({ axis: "separation_approval_ready", status: "warning", detail: "Mixed decision 상태 — hold issue 분리 확인 필요" });
    } else {
      results.push({ axis: "separation_approval_ready", status: "ok", detail: "Hold/excluded 분리 완료" });
    }
  } else {
    results.push({ axis: "separation_approval_ready", status: "blocked", detail: "Separation 미확인" });
  }

  // 3. Rationale approval ready
  if (decision) {
    const shortlistIds = new Set(decision.shortlistCandidateIds);
    const shortlistRationales = decision.rationaleByCandidate.filter(r => shortlistIds.has(r.candidateId));
    const missingRationale = decision.shortlistCandidateIds.filter(
      id => !shortlistRationales.some(r => r.candidateId === id && r.rationaleCodes.length > 0)
    );

    if (missingRationale.length > 0) {
      results.push({ axis: "rationale_approval_ready", status: "blocked", detail: `${missingRationale.length}건 shortlist candidate에 rationale 누락` });
    } else {
      results.push({ axis: "rationale_approval_ready", status: "ok", detail: "Rationale 완결성 확인됨" });
    }
  } else {
    results.push({ axis: "rationale_approval_ready", status: "blocked", detail: "Rationale 미확인" });
  }

  // 4. Governance approval ready
  if (decision) {
    const govIssues: string[] = [];
    if (decision.exceptionFlags.includes("budget_recheck_needed")) govIssues.push("예산 재확인 필요");
    if (decision.exceptionFlags.includes("policy_gap")) govIssues.push("정책 간극 존재");
    if (decision.exceptionFlags.includes("stale_quote_context")) govIssues.push("Quote context stale");

    if (govIssues.length > 0) {
      results.push({ axis: "governance_approval_ready", status: "warning", detail: govIssues.join("; ") });
    } else {
      results.push({ axis: "governance_approval_ready", status: "ok", detail: "Governance context 확인됨" });
    }
  } else {
    results.push({ axis: "governance_approval_ready", status: "blocked", detail: "Governance context 미확인" });
  }

  // 5. Intake approval ready
  if (decision) {
    const intakeBlockers: string[] = [];
    if (decision.precheckFlags.includes("shortlist_empty")) intakeBlockers.push("shortlist 비어 있음");
    if (decision.precheckFlags.includes("provenance_missing")) intakeBlockers.push("provenance 누락");
    if (decision.precheckFlags.includes("hold_contamination")) intakeBlockers.push("hold 혼입");
    if (decision.precheckFlags.includes("excluded_contamination")) intakeBlockers.push("excluded 혼입");

    if (intakeBlockers.length > 0) {
      results.push({ axis: "intake_approval_ready", status: "blocked", detail: intakeBlockers.join("; ") });
    } else if (decision.exceptionFlags.includes("equivalent_heavy_shortlist")) {
      results.push({ axis: "intake_approval_ready", status: "warning", detail: "Equivalent 비중이 높은 shortlist — 승인 검토 부담 가능" });
    } else {
      results.push({ axis: "intake_approval_ready", status: "ok", detail: "Approval intake 준비 완료" });
    }
  } else {
    results.push({ axis: "intake_approval_ready", status: "blocked", detail: "Intake 미확인" });
  }

  return results;
}

// ── Gate Readiness Aggregate ──
export interface ApprovalHandoffReadinessResult {
  status: ApprovalHandoffGateStatusV2;
  blockers: string[];
  warnings: string[];
  canHandoff: boolean;
}

export function evaluateApprovalHandoffReadiness(state: ApprovalHandoffGateV2State): ApprovalHandoffReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.compareDecisionSnapshotV2Id) blockers.push("Compare decision snapshot lineage 없음");
  if (state.snapshotStatus !== "shortlist_ready" && state.snapshotStatus !== "mixed_decision_ready") {
    blockers.push("Snapshot이 approval 가능한 상태가 아님");
  }

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Decision completeness
  if (!state.decision) {
    blockers.push("Approval handoff decision 미완료");
  }

  const status: ApprovalHandoffGateStatusV2 =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 handoff 금지 (보수적)
  return { status, blockers, warnings, canHandoff: status === "ready" };
}

// ── Canonical Approval Handoff Package V2 ──
export interface ApprovalHandoffPackageV2 {
  id: string;
  sourceCompareDecisionSnapshotV2Id: string;
  sourceCompareReviewSessionV2Id: string;
  sourceCompareReopenHandoffPackageV2Id: string;
  poRecordId: string;
  approvalScope: string;
  shortlistCandidateIds: string[];
  holdExcludedIds: string[];
  excludedCandidateIds: string[];
  provenanceByCandidate: LaneProvenance[];
  rationaleByCandidate: CandidateRationale[];
  compareGroups: CompareGroup[];
  deltaFirstAxis: DeltaFirstAxis[];
  quoteReferenceVisible: boolean;
  policyReferenceVisible: boolean;
  budgetReferenceVisible: boolean;
  operatorNote: string;
  exceptionFlags: ApprovalHandoffExceptionFlag[];
  createdAt: string;
  createdBy: string;
  nextDestination: string;
}

export function buildApprovalHandoffPackageV2(state: ApprovalHandoffGateV2State): ApprovalHandoffPackageV2 | null {
  if (!state.decision) return null;
  const readiness = evaluateApprovalHandoffReadiness(state);
  if (!readiness.canHandoff) return null;

  const d = state.decision;
  return {
    id: `apprhpkg_${Date.now().toString(36)}`,
    sourceCompareDecisionSnapshotV2Id: state.compareDecisionSnapshotV2Id,
    sourceCompareReviewSessionV2Id: state.sourceCompareReviewSessionV2Id,
    sourceCompareReopenHandoffPackageV2Id: state.sourceCompareReopenHandoffPackageV2Id,
    poRecordId: state.poRecordId,
    approvalScope: d.approvalScope,
    shortlistCandidateIds: d.shortlistCandidateIds,
    holdExcludedIds: d.holdExcludedIds,
    excludedCandidateIds: d.excludedCandidateIds,
    provenanceByCandidate: d.provenanceByCandidate,
    rationaleByCandidate: d.rationaleByCandidate,
    compareGroups: state.compareGroups,
    deltaFirstAxis: state.deltaFirstAxis,
    quoteReferenceVisible: d.quoteReferenceVisible,
    policyReferenceVisible: d.policyReferenceVisible,
    budgetReferenceVisible: d.budgetReferenceVisible,
    operatorNote: d.operatorNote,
    exceptionFlags: d.exceptionFlags,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    nextDestination: "approval_review",
  };
}

// ── Canonical Approval Case ──
export interface ApprovalCaseV2 {
  id: string;
  sourceApprovalHandoffPackageV2Id: string;
  status: "queued" | "opened" | "hydrating" | "ready_for_approval_review" | "on_hold" | "cancelled";
  openedAt: string;
  openedBy: string;
  targetWorkbench: string;
  nextDestination: string;
}

export function buildApprovalCaseV2(pkg: ApprovalHandoffPackageV2): ApprovalCaseV2 {
  return {
    id: `apprcase_${Date.now().toString(36)}`,
    sourceApprovalHandoffPackageV2Id: pkg.id,
    status: "queued",
    openedAt: new Date().toISOString(),
    openedBy: "operator",
    targetWorkbench: "approval_review",
    nextDestination: "approval_review",
  };
}

// ── Correction Route ──
export interface ApprovalHandoffCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourceCompareDecisionSnapshotV2Id: string;
  routeType: "compare_review_return" | "rationale_correction" | "hold_resolution" | "governance_clarification";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildApprovalHandoffCorrectionRoute(
  state: ApprovalHandoffGateV2State,
  routeType: ApprovalHandoffCorrectionRoute["routeType"],
  reason: string,
): ApprovalHandoffCorrectionRoute {
  const readiness = evaluateApprovalHandoffReadiness(state);

  const nextDest =
    routeType === "compare_review_return" ? "compare_reopen_v2_review"
    : routeType === "rationale_correction" ? "compare_reopen_v2_review"
    : routeType === "hold_resolution" ? "compare_reopen_v2_review"
    : "governance_review";

  return {
    id: `apprhcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceCompareDecisionSnapshotV2Id: state.compareDecisionSnapshotV2Id,
    routeType,
    reason,
    unresolvedBlockers: readiness.blockers,
    createdAt: new Date().toISOString(),
    createdBy: "operator",
    status: "queued",
    nextDestination: nextDest,
  };
}

// ── Activity Events ──
export type ApprovalHandoffGateEventType =
  | "approval_handoff_gate_opened"
  | "approval_handoff_gate_saved"
  | "approval_handoff_gate_hold_set"
  | "approval_handoff_gate_blocker_detected"
  | "approval_handoff_gate_warning_detected"
  | "approval_handoff_package_v2_created"
  | "approval_case_created"
  | "approval_handoff_completed";

export interface ApprovalHandoffGateEvent {
  type: ApprovalHandoffGateEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  compareDecisionSnapshotV2Id: string;
  approvalHandoffPackageV2Id: string | null;
  approvalCaseId: string | null;
  changedFields: string[];
  destination: string;
}

export function createApprovalHandoffGateEvent(
  type: ApprovalHandoffGateEventType,
  state: ApprovalHandoffGateV2State,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): ApprovalHandoffGateEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    compareDecisionSnapshotV2Id: state.compareDecisionSnapshotV2Id,
    approvalHandoffPackageV2Id: state.handoffPackageId,
    approvalCaseId: state.approvalCaseId,
    changedFields,
    destination,
  };
}
