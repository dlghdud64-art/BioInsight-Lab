/**
 * Approval Workbench Intake Hydration Engine — handoff package → approval review session
 *
 * 고정 규칙:
 * 1. approvalHandoffPackageV2 = 단일 입력 source.
 * 2. opened ≠ review started. hydration ready 이후에만 review session 생성.
 * 3. scope/separation/rationale/governance/review 5개 hydration 축 분리 평가.
 * 4. hold / excluded는 approval session에 재유입 금지.
 * 5. compare rationale / provenance는 reference-visible — approval truth 자동 생성 금지.
 * 6. canonical approvalReviewSessionV2 = actual review의 단일 source of truth.
 * 7. approve / reject / return decision은 이 단계에서 금지.
 * 8. open → hydrate → ready → review 순서 강제.
 */

import type { ApprovalHandoffPackageV2, ApprovalCaseV2, ApprovalHandoffExceptionFlag } from "./approval-handoff-gate-v2-engine";
import type { CandidateRationale } from "./compare-reopen-v2-review-engine";
import type { CompareGroup, DeltaFirstAxis } from "./compare-reopen-v2-handoff-engine";
import type { LaneProvenance } from "./sourcing-result-workbench-v2-triage-engine";

// ── Hydration Status ──
export type ApprovalHydrationStatus = "not_started" | "blocked" | "warning" | "ready" | "hydrated";

// ── Readiness Axis ──
export type ApprovalHydrationAxis = "scope_hydration_ready" | "separation_hydration_ready" | "rationale_hydration_ready" | "governance_hydration_ready" | "review_execution_ready";
export type ApprovalHydrationAxisStatus = "ok" | "warning" | "blocked";

export interface ApprovalHydrationAxisResult {
  axis: ApprovalHydrationAxis;
  status: ApprovalHydrationAxisStatus;
  detail: string;
}

// ── Precheck Flag ──
export type ApprovalHydrationPrecheckFlag =
  | "scope_empty"
  | "hold_contamination"
  | "excluded_contamination"
  | "rationale_incomplete"
  | "provenance_missing"
  | "quote_reference_missing"
  | "policy_reference_missing"
  | "budget_reference_missing"
  | "governance_stale"
  | "equivalent_heavy";

// ── State ──
export interface ApprovalWorkbenchHydrationState {
  hydrationStatus: ApprovalHydrationStatus;
  approvalCaseId: string;
  handoffPackageV2Id: string;
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
  axisResults: ApprovalHydrationAxisResult[];
  operatorPrepNote: string;
  precheckFlags: ApprovalHydrationPrecheckFlag[];
  blockerCount: number;
  warningCount: number;
  reviewSessionId: string | null;
  correctionRouteId: string | null;
}

export function createInitialApprovalHydrationState(
  pkg: ApprovalHandoffPackageV2,
  approvalCase: ApprovalCaseV2,
): ApprovalWorkbenchHydrationState {
  const axes = evaluateApprovalHydrationAxes(pkg, []);
  const blockers = axes.filter(a => a.status === "blocked");
  const warnings = axes.filter(a => a.status === "warning");

  return {
    hydrationStatus: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "not_started",
    approvalCaseId: approvalCase.id,
    handoffPackageV2Id: pkg.id,
    poRecordId: pkg.poRecordId,
    approvalScope: pkg.approvalScope,
    shortlistCandidateIds: pkg.shortlistCandidateIds,
    holdExcludedIds: pkg.holdExcludedIds,
    excludedCandidateIds: pkg.excludedCandidateIds,
    provenanceByCandidate: pkg.provenanceByCandidate,
    rationaleByCandidate: pkg.rationaleByCandidate,
    compareGroups: pkg.compareGroups,
    deltaFirstAxis: pkg.deltaFirstAxis,
    quoteReferenceVisible: pkg.quoteReferenceVisible,
    policyReferenceVisible: pkg.policyReferenceVisible,
    budgetReferenceVisible: pkg.budgetReferenceVisible,
    axisResults: axes,
    operatorPrepNote: "",
    precheckFlags: [],
    blockerCount: blockers.length,
    warningCount: warnings.length,
    reviewSessionId: null,
    correctionRouteId: null,
  };
}

// ── Hydration Axes Evaluation ──
export function evaluateApprovalHydrationAxes(pkg: ApprovalHandoffPackageV2, precheckFlags: ApprovalHydrationPrecheckFlag[]): ApprovalHydrationAxisResult[] {
  const results: ApprovalHydrationAxisResult[] = [];

  // 1. Scope hydration ready
  if (pkg.shortlistCandidateIds.length === 0) {
    results.push({ axis: "scope_hydration_ready", status: "blocked", detail: "Approval scope에 shortlist candidate 없음" });
  } else if (precheckFlags.includes("scope_empty")) {
    results.push({ axis: "scope_hydration_ready", status: "blocked", detail: "Scope hydrate 실패" });
  } else {
    results.push({ axis: "scope_hydration_ready", status: "ok", detail: `${pkg.shortlistCandidateIds.length}건 approval scope hydrate 준비` });
  }

  // 2. Separation hydration ready
  if (precheckFlags.includes("hold_contamination")) {
    results.push({ axis: "separation_hydration_ready", status: "blocked", detail: "Hold candidate가 approval session에 혼입" });
  } else if (precheckFlags.includes("excluded_contamination")) {
    results.push({ axis: "separation_hydration_ready", status: "blocked", detail: "Excluded candidate가 approval session에 혼입" });
  } else {
    const holdInShortlist = pkg.holdExcludedIds.filter(id => pkg.shortlistCandidateIds.includes(id));
    const excludedInShortlist = pkg.excludedCandidateIds.filter(id => pkg.shortlistCandidateIds.includes(id));
    if (holdInShortlist.length > 0) {
      results.push({ axis: "separation_hydration_ready", status: "blocked", detail: `${holdInShortlist.length}건 hold candidate가 shortlist에 포함` });
    } else if (excludedInShortlist.length > 0) {
      results.push({ axis: "separation_hydration_ready", status: "blocked", detail: `${excludedInShortlist.length}건 excluded candidate가 shortlist에 포함` });
    } else {
      results.push({ axis: "separation_hydration_ready", status: "ok", detail: "Hold/excluded 분리 완료" });
    }
  }

  // 3. Rationale hydration ready
  const shortlistIds = new Set(pkg.shortlistCandidateIds);
  const shortlistRationales = pkg.rationaleByCandidate.filter(r => shortlistIds.has(r.candidateId));
  const missingRationale = pkg.shortlistCandidateIds.filter(
    id => !shortlistRationales.some(r => r.candidateId === id && r.rationaleCodes.length > 0)
  );

  if (missingRationale.length > 0) {
    results.push({ axis: "rationale_hydration_ready", status: "blocked", detail: `${missingRationale.length}건 shortlist에 rationale 누락` });
  } else if (precheckFlags.includes("rationale_incomplete")) {
    results.push({ axis: "rationale_hydration_ready", status: "blocked", detail: "Rationale hydrate 불완전" });
  } else {
    results.push({ axis: "rationale_hydration_ready", status: "ok", detail: "Rationale hydrate 준비 완료" });
  }

  // 4. Governance hydration ready
  const govIssues: string[] = [];
  if (precheckFlags.includes("quote_reference_missing")) govIssues.push("Quote reference 누락");
  if (precheckFlags.includes("policy_reference_missing")) govIssues.push("Policy reference 누락");
  if (precheckFlags.includes("budget_reference_missing")) govIssues.push("Budget reference 누락");
  if (precheckFlags.includes("governance_stale")) govIssues.push("Governance context stale");

  if (govIssues.length > 0) {
    results.push({ axis: "governance_hydration_ready", status: "warning", detail: govIssues.join("; ") });
  } else if (pkg.exceptionFlags.includes("stale_quote_context")) {
    results.push({ axis: "governance_hydration_ready", status: "warning", detail: "Quote context stale 가능성" });
  } else if (pkg.exceptionFlags.includes("budget_recheck_needed")) {
    results.push({ axis: "governance_hydration_ready", status: "warning", detail: "Budget 재확인 필요" });
  } else {
    results.push({ axis: "governance_hydration_ready", status: "ok", detail: "Governance reference 준비 완료" });
  }

  // 5. Review execution ready
  const hasBlocker = results.some(r => r.status === "blocked");
  if (hasBlocker) {
    results.push({ axis: "review_execution_ready", status: "blocked", detail: "Hydration blocker 존재" });
  } else if (precheckFlags.includes("equivalent_heavy")) {
    results.push({ axis: "review_execution_ready", status: "warning", detail: "Equivalent 비중 높은 shortlist — 승인 검토 부담 가능" });
  } else if (precheckFlags.includes("provenance_missing")) {
    results.push({ axis: "review_execution_ready", status: "blocked", detail: "Provenance 누락" });
  } else {
    results.push({ axis: "review_execution_ready", status: "ok", detail: "Approval review 시작 가능" });
  }

  return results;
}

// ── Hydration Readiness Aggregate ──
export interface ApprovalHydrationReadinessResult {
  status: ApprovalHydrationStatus;
  blockers: string[];
  warnings: string[];
  canComplete: boolean;
}

export function evaluateApprovalHydrationReadiness(state: ApprovalWorkbenchHydrationState): ApprovalHydrationReadinessResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Source lineage
  if (!state.handoffPackageV2Id) blockers.push("Handoff package lineage 없음");
  if (!state.approvalCaseId) blockers.push("Approval case lineage 없음");

  // Axis check
  for (const axis of state.axisResults) {
    if (axis.status === "blocked") blockers.push(axis.detail);
    if (axis.status === "warning") warnings.push(axis.detail);
  }

  // Precheck flags
  if (state.precheckFlags.includes("scope_empty")) blockers.push("Approval scope 비어 있음");
  if (state.precheckFlags.includes("hold_contamination")) blockers.push("Hold 혼입");
  if (state.precheckFlags.includes("excluded_contamination")) blockers.push("Excluded 혼입");
  if (state.precheckFlags.includes("rationale_incomplete")) blockers.push("Rationale 불완전");
  if (state.precheckFlags.includes("provenance_missing")) blockers.push("Provenance 누락");
  if (state.precheckFlags.includes("governance_stale")) warnings.push("Governance context stale");
  if (state.precheckFlags.includes("equivalent_heavy")) warnings.push("Equivalent 비중 높음");
  if (state.precheckFlags.includes("quote_reference_missing")) warnings.push("Quote reference 누락");
  if (state.precheckFlags.includes("policy_reference_missing")) warnings.push("Policy reference 누락");
  if (state.precheckFlags.includes("budget_reference_missing")) warnings.push("Budget reference 누락");

  const status: ApprovalHydrationStatus =
    blockers.length > 0 ? "blocked"
    : warnings.length > 0 ? "warning"
    : "ready";

  // Batch 1: warning에서도 completion 금지 (보수적)
  return { status, blockers, warnings, canComplete: status === "ready" };
}

// ── Approval Review Session Status ──
export type ApprovalReviewSessionStatus = "initialized" | "hydrated" | "ready_for_approval_review" | "review_in_progress" | "review_completed" | "cancelled";

// ── Canonical Approval Review Session V2 ──
export interface ApprovalReviewSessionV2 {
  id: string;
  sourceApprovalHandoffPackageV2Id: string;
  sourceApprovalCaseId: string;
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
  operatorPrepNote: string;
  precheckFlags: ApprovalHydrationPrecheckFlag[];
  hydratedAt: string;
  hydratedBy: string;
  status: ApprovalReviewSessionStatus;
  nextDestination: string;
}

export function buildApprovalReviewSessionV2(state: ApprovalWorkbenchHydrationState): ApprovalReviewSessionV2 | null {
  const readiness = evaluateApprovalHydrationReadiness(state);
  if (!readiness.canComplete) return null;

  return {
    id: `apprvssv2_${Date.now().toString(36)}`,
    sourceApprovalHandoffPackageV2Id: state.handoffPackageV2Id,
    sourceApprovalCaseId: state.approvalCaseId,
    poRecordId: state.poRecordId,
    approvalScope: state.approvalScope,
    shortlistCandidateIds: state.shortlistCandidateIds,
    holdExcludedIds: state.holdExcludedIds,
    excludedCandidateIds: state.excludedCandidateIds,
    provenanceByCandidate: state.provenanceByCandidate,
    rationaleByCandidate: state.rationaleByCandidate,
    compareGroups: state.compareGroups,
    deltaFirstAxis: state.deltaFirstAxis,
    quoteReferenceVisible: state.quoteReferenceVisible,
    policyReferenceVisible: state.policyReferenceVisible,
    budgetReferenceVisible: state.budgetReferenceVisible,
    operatorPrepNote: state.operatorPrepNote,
    precheckFlags: state.precheckFlags,
    hydratedAt: new Date().toISOString(),
    hydratedBy: "operator",
    status: "ready_for_approval_review",
    nextDestination: "approval_review_v2",
  };
}

// ── Correction Route ──
export interface ApprovalHydrationCorrectionRoute {
  id: string;
  sourcePoRecordId: string;
  sourceHandoffPackageV2Id: string;
  routeType: "handoff_gate_return" | "compare_review_return" | "rationale_correction" | "governance_correction" | "separation_correction";
  reason: string;
  unresolvedBlockers: string[];
  createdAt: string;
  createdBy: string;
  status: "queued" | "in_progress" | "resolved" | "cancelled";
  nextDestination: string;
}

export function buildApprovalHydrationCorrectionRoute(
  state: ApprovalWorkbenchHydrationState,
  routeType: ApprovalHydrationCorrectionRoute["routeType"],
  reason: string,
): ApprovalHydrationCorrectionRoute {
  const readiness = evaluateApprovalHydrationReadiness(state);

  const nextDest =
    routeType === "handoff_gate_return" ? "approval_handoff_gate_v2"
    : routeType === "compare_review_return" ? "compare_reopen_v2_review"
    : routeType === "rationale_correction" ? "approval_handoff_gate_v2"
    : routeType === "governance_correction" ? "approval_handoff_gate_v2"
    : "approval_handoff_gate_v2";

  return {
    id: `apphydrcorr_${Date.now().toString(36)}`,
    sourcePoRecordId: state.poRecordId,
    sourceHandoffPackageV2Id: state.handoffPackageV2Id,
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
export type ApprovalHydrationEventType =
  | "approval_hydration_opened"
  | "approval_hydration_saved"
  | "approval_hydration_hold_set"
  | "approval_hydration_blocker_detected"
  | "approval_hydration_warning_detected"
  | "approval_review_session_v2_created"
  | "approval_hydration_completed"
  | "approval_ready_for_review";

export interface ApprovalHydrationEvent {
  type: ApprovalHydrationEventType;
  actor: string;
  timestamp: string;
  previousStatus: string;
  nextStatus: string;
  poRecordId: string;
  handoffPackageV2Id: string;
  approvalCaseId: string;
  reviewSessionV2Id: string | null;
  changedFields: string[];
  destination: string;
}

export function createApprovalHydrationEvent(
  type: ApprovalHydrationEventType,
  state: ApprovalWorkbenchHydrationState,
  previousStatus: string,
  nextStatus: string,
  changedFields: string[],
  destination: string,
): ApprovalHydrationEvent {
  return {
    type,
    actor: "operator",
    timestamp: new Date().toISOString(),
    previousStatus,
    nextStatus,
    poRecordId: state.poRecordId,
    handoffPackageV2Id: state.handoffPackageV2Id,
    approvalCaseId: state.approvalCaseId,
    reviewSessionV2Id: state.reviewSessionId,
    changedFields,
    destination,
  };
}
