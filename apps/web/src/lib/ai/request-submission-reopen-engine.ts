/**
 * Request Submission Reopen Engine — 재요청 최종 검토 + resend guard + resubmission event + quote management re-entry handoff
 */

import type { RequestSubmissionReopenHandoff } from "./request-reopen-engine";

// ── Status ──
export type RequestSubmissionReopenStatus = "request_submission_reopen_open" | "request_submission_reopen_in_progress" | "request_resubmission_recorded";
export type RequestSubmissionReopenSubstatus = "awaiting_final_vendor_review" | "awaiting_final_line_delta_review" | "awaiting_final_payload_confirmation" | "request_submission_reopen_blocked" | "ready_for_quote_management_reentry";

// ── State ──
export interface RequestSubmissionReopenState {
  requestSubmissionReopenStatus: RequestSubmissionReopenStatus;
  substatus: RequestSubmissionReopenSubstatus;
  requestSubmissionReopenOpenedAt: string;
  requestReopenObjectId: string;
  finalVendorTargetCount: number;
  reusedRequestLineCount: number;
  rewrittenRequestLineCount: number;
  conditionDeltaStatus: "defined" | "pending" | "none";
  payloadFreshnessStatus: "fresh" | "stale" | "unknown";
  duplicateResendRiskFlag: boolean;
  missingDecisionCount: number;
  requestSubmissionReopenBlockedFlag: boolean;
  requestSubmissionReopenBlockedReason: string | null;
  requestResubmissionEventId: string | null;
}

export function createInitialRequestSubmissionReopenState(handoff: RequestSubmissionReopenHandoff): RequestSubmissionReopenState {
  const vendorCount = handoff.reusedVendorTargetIds.length + handoff.addedVendorTargetIds.length;
  const lineCount = handoff.reusedRequestLineIds.length + handoff.rewrittenRequestLineIds.length;
  return {
    requestSubmissionReopenStatus: "request_submission_reopen_open",
    substatus: "awaiting_final_vendor_review",
    requestSubmissionReopenOpenedAt: new Date().toISOString(),
    requestReopenObjectId: handoff.requestReopenObjectId,
    finalVendorTargetCount: vendorCount,
    reusedRequestLineCount: handoff.reusedRequestLineIds.length,
    rewrittenRequestLineCount: handoff.rewrittenRequestLineIds.length,
    conditionDeltaStatus: handoff.requestConditionDeltaSummary ? "defined" : "pending",
    payloadFreshnessStatus: "unknown",
    duplicateResendRiskFlag: false,
    missingDecisionCount: 0,
    requestSubmissionReopenBlockedFlag: handoff.requestSubmissionReopenReadiness === "blocked",
    requestSubmissionReopenBlockedReason: handoff.requestSubmissionReopenReadiness === "blocked" ? "Request Submission Reopen 조건 미충족" : null,
    requestResubmissionEventId: null,
  };
}

// ── Resend Guards ──
export interface ResubmissionGuards { duplicateResendRisk: boolean; unchangedPayloadRisk: boolean; priorQuoteConflict: boolean; vendorOverlapRequiresReview: boolean; stalePayloadFlag: boolean; blockingIssues: string[]; warnings: string[]; }
export function evaluateRequestResubmissionGuards(state: RequestSubmissionReopenState): ResubmissionGuards {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (state.requestSubmissionReopenBlockedFlag) blocking.push(state.requestSubmissionReopenBlockedReason || "차단됨");
  if (state.duplicateResendRiskFlag) warnings.push("동일 요청 중복 발송 위험");
  if (state.payloadFreshnessStatus === "stale") warnings.push("Stale payload — 갱신 필요");
  if (state.conditionDeltaStatus === "pending") warnings.push("조건 delta 미정의");
  return { duplicateResendRisk: state.duplicateResendRiskFlag, unchangedPayloadRisk: state.rewrittenRequestLineCount === 0 && state.conditionDeltaStatus === "none", priorQuoteConflict: false, vendorOverlapRequiresReview: false, stalePayloadFlag: state.payloadFreshnessStatus === "stale", blockingIssues: blocking, warnings };
}

// ── Payload Plan ──
export interface ResubmissionPayloadPlan { finalVendorTargetIds: string[]; finalLinePayloadCount: number; lineDeltaSummary: string; conditionDeltaSummary: string; payloadDeltaSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildRequestResubmissionPayloadPlan(state: RequestSubmissionReopenState, handoff: RequestSubmissionReopenHandoff): ResubmissionPayloadPlan {
  const allVendors = [...handoff.reusedVendorTargetIds, ...handoff.addedVendorTargetIds];
  const totalLines = handoff.reusedRequestLineIds.length + handoff.rewrittenRequestLineIds.length;
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (allVendors.length === 0) blocking.push("최종 공급사 없음");
  if (totalLines === 0) blocking.push("최종 요청 라인 없음");
  return { finalVendorTargetIds: allVendors, finalLinePayloadCount: totalLines, lineDeltaSummary: `재사용 ${handoff.reusedRequestLineIds.length} + 재작성 ${handoff.rewrittenRequestLineIds.length}`, conditionDeltaSummary: handoff.requestConditionDeltaSummary || "미정의", payloadDeltaSummary: `${allVendors.length}개 공급사 × ${totalLines}개 라인`, blockingIssues: blocking, warnings };
}

// ── Validator ──
export interface RequestSubmissionReopenValidation { canRecordRequestResubmission: boolean; canOpenQuoteManagementReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateRequestSubmissionReopenBeforeRecord(state: RequestSubmissionReopenState, handoff: RequestSubmissionReopenHandoff): RequestSubmissionReopenValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  const guards = evaluateRequestResubmissionGuards(state);
  guards.blockingIssues.forEach(b => blocking.push(b));
  guards.warnings.forEach(w => warnings.push(w));
  const payload = buildRequestResubmissionPayloadPlan(state, handoff);
  payload.blockingIssues.forEach(b => { blocking.push(b); missing.push(b); });
  payload.warnings.forEach(w => warnings.push(w));
  if (state.requestResubmissionEventId) blocking.push("이미 재제출됨");
  const canRecord = blocking.length === 0;
  return { canRecordRequestResubmission: canRecord, canOpenQuoteManagementReentry: canRecord, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : warnings.length > 0 ? "경고 확인 후 재제출" : "Quote Management Re-entry로 보내기" };
}

// ── Decision Options ──
export interface RequestSubmissionReopenDecisionOptions { canRecordResubmission: boolean; canOpenQuoteManagementReentry: boolean; canHold: boolean; canReturnRequestReopen: boolean; decisionReasonSummary: string; }
export function buildRequestSubmissionReopenDecisionOptions(state: RequestSubmissionReopenState, handoff: RequestSubmissionReopenHandoff): RequestSubmissionReopenDecisionOptions {
  const v = validateRequestSubmissionReopenBeforeRecord(state, handoff);
  return { canRecordResubmission: v.canRecordRequestResubmission, canOpenQuoteManagementReentry: v.canOpenQuoteManagementReentry, canHold: v.missingItems.length > 0, canReturnRequestReopen: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Event ──
export interface RequestResubmissionEvent { id: string; requestReopenObjectId: string; finalVendorTargetIds: string[]; finalRequestLinePayloadCount: number; requestConditionDeltaSummary: string; finalPayloadSummary: string; duplicateResendRiskSummary: string; recordedAt: string; recordedBy: string; }
export function buildRequestResubmissionEvent(state: RequestSubmissionReopenState, handoff: RequestSubmissionReopenHandoff): RequestResubmissionEvent {
  const payload = buildRequestResubmissionPayloadPlan(state, handoff);
  return { id: `reqresub_${Date.now().toString(36)}`, requestReopenObjectId: state.requestReopenObjectId, finalVendorTargetIds: payload.finalVendorTargetIds, finalRequestLinePayloadCount: payload.finalLinePayloadCount, requestConditionDeltaSummary: payload.conditionDeltaSummary, finalPayloadSummary: payload.payloadDeltaSummary, duplicateResendRiskSummary: state.duplicateResendRiskFlag ? "중복 위험 있음" : "중복 위험 없음", recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Quote Management Re-entry Handoff ──
export interface QuoteManagementReentryHandoff { requestResubmissionEventId: string; finalVendorTargetIds: string[]; finalRequestLinePayloadCount: number; requestConditionDeltaSummary: string; quoteManagementReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildQuoteManagementReentryHandoff(event: RequestResubmissionEvent): QuoteManagementReentryHandoff {
  return { requestResubmissionEventId: event.id, finalVendorTargetIds: event.finalVendorTargetIds, finalRequestLinePayloadCount: event.finalRequestLinePayloadCount, requestConditionDeltaSummary: event.requestConditionDeltaSummary, quoteManagementReentryReadiness: event.finalVendorTargetIds.length > 0 ? "ready" : "pending" };
}
