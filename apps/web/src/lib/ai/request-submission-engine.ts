/**
 * Request Submission Engine — 제출 상태 모델 + validator + submission event + quote workqueue handoff
 *
 * 고정 규칙:
 * 1. request submission = request draft를 외부 운영 상태로 전이시키는 canonical gate.
 * 2. draft recorded ≠ submitted — 별도 상태로 분리.
 * 3. canonical request submission event 없이 quote workqueue 진행 금지.
 * 4. submission 후 기본 목적지 = Quote Management Workqueue.
 * 5. final review 없이 submission 실행 금지.
 */

import type { RequestDraftSnapshot, RequestDraftLine, RequestConditionDraft } from "./request-assembly-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Submission Status
// ══════════════════════════════════════════════════════════════════════════════

export type RequestSubmissionStatus =
  | "request_draft_recorded"
  | "request_submission_ready"
  | "request_submitted";

export type RequestSubmissionSubstatus =
  | "awaiting_final_review"
  | "submission_blocked"
  | "ready_to_submit"
  | "submission_in_progress"
  | "submitted_to_quote_workqueue";

// ══════════════════════════════════════════════════════════════════════════════
// Submission State
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestSubmissionState {
  requestSubmissionStatus: RequestSubmissionStatus;
  substatus: RequestSubmissionSubstatus;
  requestSubmissionOpenedAt: string | null;
  requestSubmissionOpenedBy: "draft_handoff" | "manual" | null;
  requestDraftSnapshotId: string;
  requestSubmissionEventId: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  submittedVendorTargetCount: number;
  submittedLineCount: number;
  submissionBlockedFlag: boolean;
  submissionBlockedReason: string | null;
  quoteWorkqueueHandoffId: string | null;
  // ── Lineage ──
  compareDecisionSnapshotId: string | null;
  aiActivationSnapshotId: string | null;
}

export function createInitialSubmissionState(
  draftSnapshot: RequestDraftSnapshot,
): RequestSubmissionState {
  return {
    requestSubmissionStatus: "request_submission_ready",
    substatus: "awaiting_final_review",
    requestSubmissionOpenedAt: new Date().toISOString(),
    requestSubmissionOpenedBy: "draft_handoff",
    requestDraftSnapshotId: draftSnapshot.id,
    requestSubmissionEventId: null,
    submittedAt: null,
    submittedBy: null,
    submittedVendorTargetCount: draftSnapshot.targetVendorIds.length,
    submittedLineCount: draftSnapshot.requestDraftLines.length,
    submissionBlockedFlag: false,
    submissionBlockedReason: null,
    quoteWorkqueueHandoffId: null,
    compareDecisionSnapshotId: draftSnapshot.compareDecisionSnapshotId,
    aiActivationSnapshotId: draftSnapshot.aiActivationSnapshotId,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Submission Vendor Targets (from draft snapshot)
// ══════════════════════════════════════════════════════════════════════════════

export interface SubmissionVendorTarget {
  vendorId: string;
  vendorDisplayName: string;
  lineCoverageCount: number;
  inquiryFocus: string;
  eligibilityStatus: "eligible" | "blocked" | "warning";
  eligibilityReason: string;
}

export function buildSubmissionVendorTargets(
  draftSnapshot: RequestDraftSnapshot,
): SubmissionVendorTarget[] {
  const vendorIds = draftSnapshot.targetVendorIds;
  if (vendorIds.length === 0) return [];

  return vendorIds.map((vid) => {
    const coveredLines = draftSnapshot.requestDraftLines.filter((l) =>
      l.itemId && vid,
    );
    const incompleteCount = coveredLines.filter((l) => !l.isComplete).length;

    return {
      vendorId: vid,
      vendorDisplayName: vid,
      lineCoverageCount: coveredLines.length || draftSnapshot.requestDraftLines.length,
      inquiryFocus: draftSnapshot.requestConditionSummary.responseRequirements.join(", "),
      eligibilityStatus: incompleteCount > 0 ? "warning" as const : "eligible" as const,
      eligibilityReason: incompleteCount > 0 ? `불완전 라인 ${incompleteCount}개` : "제출 가능",
    };
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// Submission Lines (from draft snapshot)
// ══════════════════════════════════════════════════════════════════════════════

export interface SubmissionLine {
  lineId: string;
  itemName: string;
  catalogReference: string;
  requestedQty: number;
  specBasis: string;
  substituteAllowed: boolean;
  requiredResponseFields: string[];
  isComplete: boolean;
  blockingReason: string | null;
}

export function resolveSubmissionLines(
  draftSnapshot: RequestDraftSnapshot,
): SubmissionLine[] {
  return draftSnapshot.requestDraftLines.map((l) => ({
    lineId: l.lineId,
    itemName: l.itemName,
    catalogReference: l.catalogReference,
    requestedQty: l.requestedQty,
    specBasis: l.requestedSpecBasis,
    substituteAllowed: l.substituteAllowed,
    requiredResponseFields: l.requiredResponseFields,
    isComplete: l.isComplete,
    blockingReason: !l.isComplete ? "정보 불완전" : l.requestedQty <= 0 ? "수량 0" : null,
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Submission Condition Summary
// ══════════════════════════════════════════════════════════════════════════════

export interface SubmissionConditionSummary {
  purpose: string;
  urgency: string;
  urgencyLabel: string;
  responseRequirements: string[];
  substituteScope: string;
  substituteScopeLabel: string;
  attachmentIncluded: boolean;
  requesterContext: string;
  outboundSummary: string;
}

export function buildSubmissionConditionSummary(
  draftSnapshot: RequestDraftSnapshot,
): SubmissionConditionSummary {
  const cond = draftSnapshot.requestConditionSummary;
  const urgencyLabel = cond.urgency === "critical" ? "최우선" : cond.urgency === "urgent" ? "긴급" : "일반";
  const substituteScopeLabel = cond.substituteScope === "equivalent" ? "동등 규격" : cond.substituteScope === "same_brand" ? "동일 브랜드" : "대체 불가";
  const lineCount = draftSnapshot.requestDraftLines.length;
  const vendorCount = draftSnapshot.targetVendorIds.length;

  return {
    purpose: cond.purpose || "미지정",
    urgency: cond.urgency,
    urgencyLabel,
    responseRequirements: cond.responseRequirements,
    substituteScope: cond.substituteScope,
    substituteScopeLabel,
    attachmentIncluded: cond.attachmentIncluded,
    requesterContext: cond.requesterContext,
    outboundSummary: `${vendorCount}개 공급사에 ${lineCount}개 품목 견적 요청 (${urgencyLabel})`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Submission Validator
// ══════════════════════════════════════════════════════════════════════════════

export interface SubmissionValidation {
  canSubmit: boolean;
  blockingIssues: string[];
  warnings: string[];
  missingItems: string[];
  recommendedNextAction: string;
}

export function validateRequestSubmissionBeforeExecute(
  state: RequestSubmissionState,
  draftSnapshot: RequestDraftSnapshot,
): SubmissionValidation {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const missingItems: string[] = [];

  // Draft existence
  if (!state.requestDraftSnapshotId) {
    blockingIssues.push("요청 초안이 없습니다");
  }

  // Vendor targets
  if (draftSnapshot.targetVendorIds.length === 0) {
    blockingIssues.push("공급사 대상이 없습니다");
  }

  // Lines
  const incompleteLines = draftSnapshot.requestDraftLines.filter((l) => !l.isComplete);
  if (incompleteLines.length > 0) {
    warnings.push(`${incompleteLines.length}개 라인이 불완전합니다`);
    incompleteLines.forEach((l) => missingItems.push(`${l.itemName}: 정보 보완 필요`));
  }

  const zeroQtyLines = draftSnapshot.requestDraftLines.filter((l) => l.requestedQty <= 0);
  if (zeroQtyLines.length > 0) {
    blockingIssues.push(`${zeroQtyLines.length}개 라인의 수량이 0입니다`);
  }

  if (draftSnapshot.requestDraftLines.length === 0) {
    blockingIssues.push("요청 라인이 없습니다");
  }

  // Conditions
  if (!draftSnapshot.requestConditionSummary.purpose) {
    warnings.push("요청 목적이 비어 있습니다");
  }

  // Duplicate submission guard
  if (state.requestSubmissionEventId) {
    blockingIssues.push("이미 제출된 요청입니다");
  }

  // Lineage integrity
  if (!state.compareDecisionSnapshotId && draftSnapshot.requestDraftLines.length > 0) {
    warnings.push("비교 판단 근거 없이 요청을 제출합니다");
  }

  return {
    canSubmit: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    missingItems,
    recommendedNextAction: blockingIssues.length > 0
      ? "차단 사항을 먼저 해결하세요"
      : warnings.length > 0
        ? "경고 항목을 검토하고 요청을 제출하세요"
        : "요청을 제출하세요",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Submission Event
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestSubmissionEvent {
  id: string;
  requestDraftSnapshotId: string;
  compareDecisionSnapshotId: string | null;
  aiActivationSnapshotId: string | null;
  submittedVendorTargetIds: string[];
  submittedLineIds: string[];
  submissionConditionSummary: SubmissionConditionSummary;
  outboundSummary: string;
  missingInfoSummary: string[];
  submittedAt: string;
  submittedBy: string;
}

export function buildRequestSubmissionEvent(
  state: RequestSubmissionState,
  draftSnapshot: RequestDraftSnapshot,
): RequestSubmissionEvent {
  const condSummary = buildSubmissionConditionSummary(draftSnapshot);
  return {
    id: `rsub_${Date.now().toString(36)}`,
    requestDraftSnapshotId: draftSnapshot.id,
    compareDecisionSnapshotId: state.compareDecisionSnapshotId,
    aiActivationSnapshotId: state.aiActivationSnapshotId,
    submittedVendorTargetIds: draftSnapshot.targetVendorIds,
    submittedLineIds: draftSnapshot.requestDraftLines.map((l) => l.lineId),
    submissionConditionSummary: condSummary,
    outboundSummary: condSummary.outboundSummary,
    missingInfoSummary: draftSnapshot.missingInfoSummary,
    submittedAt: new Date().toISOString(),
    submittedBy: "operator",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Quote Management Workqueue Handoff
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteWorkqueueHandoff {
  requestSubmissionEventId: string;
  submittedVendorTargetIds: string[];
  submittedLineIds: string[];
  expectedQuoteIntakeCount: number;
  compareRationaleSummary: string;
  aiProvenanceSummary: string | null;
  initialQuoteWorkqueueMode: "awaiting_quotes" | "partial_received" | "all_received";
}

export function buildQuoteWorkqueueHandoff(
  submissionEvent: RequestSubmissionEvent,
  compareRationale: string,
): QuoteWorkqueueHandoff {
  return {
    requestSubmissionEventId: submissionEvent.id,
    submittedVendorTargetIds: submissionEvent.submittedVendorTargetIds,
    submittedLineIds: submissionEvent.submittedLineIds,
    expectedQuoteIntakeCount: submissionEvent.submittedVendorTargetIds.length,
    compareRationaleSummary: compareRationale,
    aiProvenanceSummary: submissionEvent.aiActivationSnapshotId ? `AI activation: ${submissionEvent.aiActivationSnapshotId}` : null,
    initialQuoteWorkqueueMode: "awaiting_quotes",
  };
}
