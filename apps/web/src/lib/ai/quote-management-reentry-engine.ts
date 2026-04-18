/**
 * Quote Management Re-entry Engine — prior quote reconciliation + stale/active/new classification + normalization/compare re-entry handoff
 */

import type { QuoteManagementReentryHandoff } from "./request-submission-reopen-engine";

// ── Status ──
export type QuoteManagementReentryStatus = "quote_management_reentry_open" | "quote_management_reentry_in_progress" | "quote_management_reentry_recorded";
export type QuoteManagementReentrySubstatus = "awaiting_prior_quote_reconciliation" | "awaiting_vendor_response_reclassification" | "awaiting_normalization_reentry_routing" | "quote_management_reentry_blocked" | "ready_for_normalization_reentry" | "ready_for_compare_reentry";

// ── Queue Classification ──
export type QuoteReentryClassification = "new_expected" | "prior_active_retained" | "stale" | "needs_normalization_reentry" | "ready_for_compare_reentry" | "blocked_pending_response";

export interface QuoteReentryQueueRow { rowId: string; vendorId: string; vendorName: string; classification: QuoteReentryClassification; lineDeltaImpact: boolean; normalizationRequired: boolean; compareReady: boolean; }

// ── State ──
export interface QuoteManagementReentryState {
  quoteManagementReentryStatus: QuoteManagementReentryStatus;
  substatus: QuoteManagementReentrySubstatus;
  quoteManagementReentryOpenedAt: string;
  requestResubmissionEventId: string;
  activeQuoteContextCount: number;
  staleQuoteCount: number;
  newExpectedQuoteCount: number;
  vendorOverlapCount: number;
  normalizationReentryCandidateCount: number;
  compareReentryCandidateCount: number;
  missingDecisionCount: number;
  quoteManagementReentryBlockedFlag: boolean;
  quoteManagementReentryBlockedReason: string | null;
  quoteManagementReentryObjectId: string | null;
  queueRows: QuoteReentryQueueRow[];
}

export function createInitialQuoteManagementReentryState(handoff: QuoteManagementReentryHandoff): QuoteManagementReentryState {
  const rows: QuoteReentryQueueRow[] = handoff.finalVendorTargetIds.map((vid, i) => ({
    rowId: `qreentry_${vid}_${Date.now().toString(36)}`,
    vendorId: vid,
    vendorName: vid,
    classification: "new_expected",
    lineDeltaImpact: false,
    normalizationRequired: true,
    compareReady: false,
  }));
  return {
    quoteManagementReentryStatus: "quote_management_reentry_open",
    substatus: "awaiting_prior_quote_reconciliation",
    quoteManagementReentryOpenedAt: new Date().toISOString(),
    requestResubmissionEventId: handoff.requestResubmissionEventId,
    activeQuoteContextCount: 0,
    staleQuoteCount: 0,
    newExpectedQuoteCount: handoff.finalVendorTargetIds.length,
    vendorOverlapCount: 0,
    normalizationReentryCandidateCount: handoff.finalVendorTargetIds.length,
    compareReentryCandidateCount: 0,
    missingDecisionCount: 0,
    quoteManagementReentryBlockedFlag: handoff.quoteManagementReentryReadiness === "blocked",
    quoteManagementReentryBlockedReason: handoff.quoteManagementReentryReadiness === "blocked" ? "Quote Re-entry 조건 미충족" : null,
    quoteManagementReentryObjectId: null,
    queueRows: rows,
  };
}

// ── Prior Quote Reconciliation ──
export interface PriorQuoteReconciliationPlan { activePriorQuoteIds: string[]; stalePriorQuoteIds: string[]; unansweredPriorRequestIds: string[]; vendorOverlapSummary: string; lineOverlapSummary: string; reconciliationRiskSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildPriorQuoteReconciliationPlan(rows: QuoteReentryQueueRow[]): PriorQuoteReconciliationPlan {
  const active = rows.filter(r => r.classification === "prior_active_retained");
  const stale = rows.filter(r => r.classification === "stale");
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (stale.length > 0) warnings.push(`${stale.length}개 stale quote`);
  return { activePriorQuoteIds: active.map(r => r.rowId), stalePriorQuoteIds: stale.map(r => r.rowId), unansweredPriorRequestIds: [], vendorOverlapSummary: `${active.length}개 유지`, lineOverlapSummary: "", reconciliationRiskSummary: stale.length > 0 ? "Stale quote 정리 필요" : "충돌 없음", blockingIssues: blocking, warnings };
}

// ── Queue Classification ──
export interface QuoteReentryQueueClassificationResult { newExpectedQuoteIds: string[]; retainedActiveQuoteIds: string[]; staleQuoteIds: string[]; normalizationReentryCandidateIds: string[]; compareReentryCandidateIds: string[]; blockedQueueIds: string[]; blockingIssues: string[]; warnings: string[]; }
export function buildQuoteReentryQueueClassification(rows: QuoteReentryQueueRow[]): QuoteReentryQueueClassificationResult {
  return { newExpectedQuoteIds: rows.filter(r => r.classification === "new_expected").map(r => r.rowId), retainedActiveQuoteIds: rows.filter(r => r.classification === "prior_active_retained").map(r => r.rowId), staleQuoteIds: rows.filter(r => r.classification === "stale").map(r => r.rowId), normalizationReentryCandidateIds: rows.filter(r => r.normalizationRequired).map(r => r.rowId), compareReentryCandidateIds: rows.filter(r => r.compareReady).map(r => r.rowId), blockedQueueIds: rows.filter(r => r.classification === "blocked_pending_response").map(r => r.rowId), blockingIssues: rows.length === 0 ? ["Queue row 없음"] : [], warnings: [] };
}

// ── Validator ──
export interface QuoteManagementReentryValidation { canRecordQuoteManagementReentry: boolean; canOpenNormalizationReentry: boolean; canOpenCompareReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateQuoteManagementReentryBeforeRecord(state: QuoteManagementReentryState): QuoteManagementReentryValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.quoteManagementReentryBlockedFlag) blocking.push(state.quoteManagementReentryBlockedReason || "차단됨");
  const classResult = buildQuoteReentryQueueClassification(state.queueRows);
  classResult.blockingIssues.forEach(b => blocking.push(b));
  const reconciliation = buildPriorQuoteReconciliationPlan(state.queueRows);
  reconciliation.warnings.forEach(w => warnings.push(w));
  const canRecord = blocking.length === 0;
  const hasNorm = classResult.normalizationReentryCandidateIds.length > 0;
  const hasCompare = classResult.compareReentryCandidateIds.length >= 2;
  return { canRecordQuoteManagementReentry: canRecord, canOpenNormalizationReentry: canRecord && hasNorm, canOpenCompareReentry: canRecord && hasCompare, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : hasNorm ? "Normalization Re-entry로 보내기" : hasCompare ? "Compare Re-entry로 보내기" : "응답 대기" };
}

// ── Decision Options ──
export interface QuoteManagementReentryDecisionOptions { canRecordReentry: boolean; canOpenNormalizationReentry: boolean; canOpenCompareReentry: boolean; canHold: boolean; canReturnRequestSubmissionReopen: boolean; decisionReasonSummary: string; }
export function buildQuoteManagementReentryDecisionOptions(state: QuoteManagementReentryState): QuoteManagementReentryDecisionOptions {
  const v = validateQuoteManagementReentryBeforeRecord(state);
  return { canRecordReentry: v.canRecordQuoteManagementReentry, canOpenNormalizationReentry: v.canOpenNormalizationReentry, canOpenCompareReentry: v.canOpenCompareReentry, canHold: state.staleQuoteCount > 0, canReturnRequestSubmissionReopen: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface QuoteManagementReentryObject { id: string; requestResubmissionEventId: string; activePriorQuoteIds: string[]; stalePriorQuoteIds: string[]; newExpectedQuoteIds: string[]; normalizationReentryCandidateIds: string[]; compareReentryCandidateIds: string[]; priorQuoteReconciliationSummary: string; recordedAt: string; recordedBy: string; }
export function buildQuoteManagementReentryObject(state: QuoteManagementReentryState): QuoteManagementReentryObject {
  const classResult = buildQuoteReentryQueueClassification(state.queueRows);
  const reconciliation = buildPriorQuoteReconciliationPlan(state.queueRows);
  return { id: `qmreentry_${Date.now().toString(36)}`, requestResubmissionEventId: state.requestResubmissionEventId, activePriorQuoteIds: classResult.retainedActiveQuoteIds, stalePriorQuoteIds: classResult.staleQuoteIds, newExpectedQuoteIds: classResult.newExpectedQuoteIds, normalizationReentryCandidateIds: classResult.normalizationReentryCandidateIds, compareReentryCandidateIds: classResult.compareReentryCandidateIds, priorQuoteReconciliationSummary: reconciliation.reconciliationRiskSummary, recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Normalization Re-entry Handoff ──
export interface QuoteNormalizationReentryHandoff { quoteManagementReentryObjectId: string; normalizationReentryCandidateIds: string[]; priorQuoteReconciliationSummary: string; normalizationReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildQuoteNormalizationReentryHandoff(obj: QuoteManagementReentryObject): QuoteNormalizationReentryHandoff {
  return { quoteManagementReentryObjectId: obj.id, normalizationReentryCandidateIds: obj.normalizationReentryCandidateIds, priorQuoteReconciliationSummary: obj.priorQuoteReconciliationSummary, normalizationReentryReadiness: obj.normalizationReentryCandidateIds.length > 0 ? "ready" : "pending" };
}

// ── Compare Re-entry Handoff ──
export interface QuoteCompareReentryHandoff { quoteManagementReentryObjectId: string; compareReentryCandidateIds: string[]; priorQuoteReconciliationSummary: string; compareReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildQuoteCompareReentryHandoff(obj: QuoteManagementReentryObject): QuoteCompareReentryHandoff {
  return { quoteManagementReentryObjectId: obj.id, compareReentryCandidateIds: obj.compareReentryCandidateIds, priorQuoteReconciliationSummary: obj.priorQuoteReconciliationSummary, compareReentryReadiness: obj.compareReentryCandidateIds.length >= 2 ? "ready" : "pending" };
}
