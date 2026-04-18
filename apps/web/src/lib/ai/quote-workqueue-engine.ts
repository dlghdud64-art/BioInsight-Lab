/**
 * Quote Management Workqueue Engine — 견적 응답 운영 큐 상태 모델 + row model + completeness + handoff
 *
 * 고정 규칙:
 * 1. quote workqueue = request submission 이후의 canonical 운영 객체.
 * 2. 응답 수신 ≠ 비교 준비 완료 — completeness gate 분리.
 * 3. canonical quote workqueue object 없이 normalization/compare 진입 금지.
 * 4. raw response를 바로 compare input으로 쓰지 말 것.
 * 5. quote workqueue → normalization → compare review 흐름 고정.
 */

import type { RequestSubmissionEvent, QuoteWorkqueueHandoff } from "./request-submission-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Workqueue Status
// ══════════════════════════════════════════════════════════════════════════════

export type QuoteWorkqueueStatus =
  | "quote_workqueue_open"
  | "quote_response_in_progress"
  | "quote_review_ready";

export type QuoteWorkqueueSubstatus =
  | "awaiting_vendor_response"
  | "partial_response_received"
  | "quote_incomplete"
  | "normalization_required"
  | "ready_for_compare_review"
  | "response_blocked";

// ══════════════════════════════════════════════════════════════════════════════
// Workqueue State
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteWorkqueueState {
  quoteWorkqueueStatus: QuoteWorkqueueStatus;
  substatus: QuoteWorkqueueSubstatus;
  quoteWorkqueueOpenedAt: string;
  quoteWorkqueueOpenedBy: "submission_handoff" | "manual";
  requestSubmissionEventId: string;
  expectedVendorResponseCount: number;
  receivedVendorResponseCount: number;
  expectedQuoteLineCount: number;
  receivedQuoteLineCount: number;
  incompleteQuoteCount: number;
  normalizationRequiredCount: number;
  quoteReviewReadyFlag: boolean;
  quoteWorkqueueObjectId: string;
  // ── Lineage ──
  compareDecisionSnapshotId: string | null;
  aiActivationSnapshotId: string | null;
}

export function createInitialQuoteWorkqueueState(
  handoff: QuoteWorkqueueHandoff,
): QuoteWorkqueueState {
  return {
    quoteWorkqueueStatus: "quote_workqueue_open",
    substatus: "awaiting_vendor_response",
    quoteWorkqueueOpenedAt: new Date().toISOString(),
    quoteWorkqueueOpenedBy: "submission_handoff",
    requestSubmissionEventId: handoff.requestSubmissionEventId,
    expectedVendorResponseCount: handoff.submittedVendorTargetIds.length,
    receivedVendorResponseCount: 0,
    expectedQuoteLineCount: handoff.submittedLineIds.length * handoff.submittedVendorTargetIds.length,
    receivedQuoteLineCount: 0,
    incompleteQuoteCount: 0,
    normalizationRequiredCount: 0,
    quoteReviewReadyFlag: false,
    quoteWorkqueueObjectId: `qwq_${Date.now().toString(36)}`,
    compareDecisionSnapshotId: null,
    aiActivationSnapshotId: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Vendor Response Row Model
// ══════════════════════════════════════════════════════════════════════════════

export type VendorResponseStatus =
  | "no_response"
  | "partial_response"
  | "quote_received"
  | "normalization_required"
  | "ready_for_compare"
  | "needs_followup";

export interface QuoteWorkqueueRow {
  rowId: string;
  vendorTargetId: string;
  vendorDisplayName: string;
  responseStatus: VendorResponseStatus;
  quoteReceivedFlag: boolean;
  quoteLineCoverageCount: number;
  missingLineCount: number;
  normalizationStatus: "not_needed" | "required" | "in_progress" | "completed";
  compareReadinessStatus: "not_ready" | "ready" | "blocked";
  lastUpdatedAt: string | null;
  nextAction: string;
}

export function buildQuoteWorkqueueRows(
  handoff: QuoteWorkqueueHandoff,
): QuoteWorkqueueRow[] {
  return handoff.submittedVendorTargetIds.map((vid, idx) => ({
    rowId: `qrow_${vid.slice(0, 8)}_${Date.now().toString(36)}`,
    vendorTargetId: vid,
    vendorDisplayName: vid,
    responseStatus: "no_response" as VendorResponseStatus,
    quoteReceivedFlag: false,
    quoteLineCoverageCount: 0,
    missingLineCount: handoff.submittedLineIds.length,
    normalizationStatus: "not_needed" as const,
    compareReadinessStatus: "not_ready" as const,
    lastUpdatedAt: null,
    nextAction: "응답 대기 중",
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Quote Intake Completeness Evaluator
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteIntakeCompleteness {
  isComplete: boolean;
  blockingIssues: string[];
  warnings: string[];
  missingFields: string[];
  normalizationRequired: boolean;
  readyForCompareReview: boolean;
}

export function evaluateQuoteIntakeCompleteness(
  row: QuoteWorkqueueRow,
  expectedLineCount: number,
): QuoteIntakeCompleteness {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const missingFields: string[] = [];

  if (!row.quoteReceivedFlag) {
    blockingIssues.push("견적 미수신");
  }

  if (row.missingLineCount > 0) {
    warnings.push(`${row.missingLineCount}개 라인 누락`);
    missingFields.push("라인 커버리지 부족");
  }

  if (row.quoteLineCoverageCount < expectedLineCount && row.quoteReceivedFlag) {
    warnings.push("요청 라인 중 일부만 견적이 포함됨");
  }

  const normalizationRequired = row.normalizationStatus === "required";
  if (normalizationRequired) {
    warnings.push("정규화 필요");
  }

  const isComplete = blockingIssues.length === 0
    && row.quoteReceivedFlag
    && row.missingLineCount === 0
    && !normalizationRequired;

  return {
    isComplete,
    blockingIssues,
    warnings,
    missingFields,
    normalizationRequired,
    readyForCompareReview: isComplete && row.compareReadinessStatus === "ready",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Queue-Level Compare Readiness
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteCompareReadiness {
  canOpenQuoteCompareReview: boolean;
  comparableVendorCount: number;
  blockingIssues: string[];
  warnings: string[];
  recommendedNextAction: string;
}

export function evaluateQuoteCompareReadiness(
  rows: QuoteWorkqueueRow[],
): QuoteCompareReadiness {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  const comparableRows = rows.filter((r) => r.compareReadinessStatus === "ready");
  const normalizationPending = rows.filter((r) => r.normalizationStatus === "required");
  const noResponse = rows.filter((r) => r.responseStatus === "no_response");

  if (comparableRows.length < 2) {
    blockingIssues.push(`비교 가능 공급사 ${comparableRows.length}개 — 최소 2개 필요`);
  }

  if (normalizationPending.length > 0) {
    warnings.push(`${normalizationPending.length}개 공급사 정규화 미완료`);
  }

  if (noResponse.length > 0) {
    warnings.push(`${noResponse.length}개 공급사 미응답`);
  }

  return {
    canOpenQuoteCompareReview: blockingIssues.length === 0,
    comparableVendorCount: comparableRows.length,
    blockingIssues,
    warnings,
    recommendedNextAction: blockingIssues.length > 0
      ? normalizationPending.length > 0
        ? "정규화 필요한 견적을 먼저 처리하세요"
        : noResponse.length > 0
          ? "미응답 공급사 확인이 필요합니다"
          : "비교 가능한 견적을 확보하세요"
      : "견적 비교 검토를 시작하세요",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Quote Workqueue Object
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteWorkqueueObject {
  id: string;
  requestSubmissionEventId: string;
  compareDecisionSnapshotId: string | null;
  aiProvenanceSummary: string | null;
  vendorTargetIds: string[];
  expectedResponseCount: number;
  receivedResponseSummary: string;
  normalizationRequiredSummary: string;
  compareReadinessSummary: string;
  openedAt: string;
  openedBy: string;
}

export function buildQuoteWorkqueueObject(
  handoff: QuoteWorkqueueHandoff,
): QuoteWorkqueueObject {
  return {
    id: `qwqobj_${Date.now().toString(36)}`,
    requestSubmissionEventId: handoff.requestSubmissionEventId,
    compareDecisionSnapshotId: null,
    aiProvenanceSummary: handoff.aiProvenanceSummary,
    vendorTargetIds: handoff.submittedVendorTargetIds,
    expectedResponseCount: handoff.expectedQuoteIntakeCount,
    receivedResponseSummary: `0 / ${handoff.expectedQuoteIntakeCount} 응답`,
    normalizationRequiredSummary: "대기 중",
    compareReadinessSummary: "비교 준비 전",
    openedAt: new Date().toISOString(),
    openedBy: "operator",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Normalization Handoff
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteNormalizationHandoff {
  quoteWorkqueueRowId: string;
  requestSubmissionEventId: string;
  vendorTargetId: string;
  rawQuoteReference: string | null;
  expectedRequestLineCount: number;
  receivedQuoteLineCount: number;
}

export function buildQuoteNormalizationHandoff(
  row: QuoteWorkqueueRow,
  requestSubmissionEventId: string,
  expectedLineCount: number,
): QuoteNormalizationHandoff {
  return {
    quoteWorkqueueRowId: row.rowId,
    requestSubmissionEventId,
    vendorTargetId: row.vendorTargetId,
    rawQuoteReference: null,
    expectedRequestLineCount: expectedLineCount,
    receivedQuoteLineCount: row.quoteLineCoverageCount,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Compare Review Handoff (from queue)
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteCompareReviewHandoff {
  quoteWorkqueueObjectId: string;
  comparableVendorIds: string[];
  normalizedQuoteIds: string[];
  requestSubmissionEventId: string;
  compareBasisSummary: string;
  blockingIssues: string[];
}

export function buildQuoteCompareReviewHandoff(
  workqueueObject: QuoteWorkqueueObject,
  comparableVendorIds: string[],
  readiness: QuoteCompareReadiness,
): QuoteCompareReviewHandoff {
  return {
    quoteWorkqueueObjectId: workqueueObject.id,
    comparableVendorIds,
    normalizedQuoteIds: [],
    requestSubmissionEventId: workqueueObject.requestSubmissionEventId,
    compareBasisSummary: `${comparableVendorIds.length}개 공급사 견적 비교`,
    blockingIssues: readiness.blockingIssues,
  };
}
