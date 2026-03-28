/**
 * Request Reopen Engine — 요청 재개 vendor/line/condition 재구성 + request submission reopen handoff
 */

import type { RequestReopenFromCompareHandoff } from "./compare-reopen-engine";

// ── Status ──
export type RequestReopenStatus = "request_reopen_open" | "request_reopen_in_progress" | "request_reopen_recorded";
export type RequestReopenSubstatus = "awaiting_vendor_target_review" | "awaiting_request_line_reuse_review" | "awaiting_condition_delta_review" | "request_reopen_blocked" | "ready_for_request_submission_reopen";

// ── State ──
export interface RequestReopenState {
  requestReopenStatus: RequestReopenStatus;
  substatus: RequestReopenSubstatus;
  requestReopenOpenedAt: string;
  compareReopenDecisionSnapshotId: string;
  requestCandidateIds: string[];
  shortlistIds: string[];
  reusedVendorTargetIds: string[];
  addedVendorTargetIds: string[];
  excludedVendorTargetIds: string[];
  reusedRequestLineIds: string[];
  rewrittenRequestLineIds: string[];
  requestConditionDeltaSummary: string;
  missingDecisionCount: number;
  requestReopenBlockedFlag: boolean;
  requestReopenBlockedReason: string | null;
  requestReopenObjectId: string | null;
}

export function createInitialRequestReopenState(handoff: RequestReopenFromCompareHandoff): RequestReopenState {
  return {
    requestReopenStatus: "request_reopen_open",
    substatus: "awaiting_vendor_target_review",
    requestReopenOpenedAt: new Date().toISOString(),
    compareReopenDecisionSnapshotId: handoff.compareReopenDecisionSnapshotId,
    requestCandidateIds: handoff.requestCandidateIds,
    shortlistIds: handoff.shortlistIds,
    reusedVendorTargetIds: [],
    addedVendorTargetIds: [],
    excludedVendorTargetIds: [],
    reusedRequestLineIds: [],
    rewrittenRequestLineIds: [],
    requestConditionDeltaSummary: "",
    missingDecisionCount: 3,
    requestReopenBlockedFlag: handoff.requestReopenReadiness === "blocked",
    requestReopenBlockedReason: handoff.requestReopenReadiness === "blocked" ? "Request Reopen 조건 미충족" : null,
    requestReopenObjectId: null,
  };
}

// ── Vendor Target Plan ──
export interface RequestReopenVendorTargetPlan { reusedVendorTargetIds: string[]; addedVendorTargetIds: string[]; excludedVendorTargetIds: string[]; vendorPrioritySummary: string; vendorCarryForwardRiskSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildRequestReopenVendorTargetPlan(state: RequestReopenState): RequestReopenVendorTargetPlan {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (state.reusedVendorTargetIds.length === 0 && state.addedVendorTargetIds.length === 0) blocking.push("공급사 대상 없음");
  if (state.excludedVendorTargetIds.length > 0) warnings.push(`${state.excludedVendorTargetIds.length}개 공급사 제외됨`);
  return { reusedVendorTargetIds: state.reusedVendorTargetIds, addedVendorTargetIds: state.addedVendorTargetIds, excludedVendorTargetIds: state.excludedVendorTargetIds, vendorPrioritySummary: `재사용 ${state.reusedVendorTargetIds.length} + 추가 ${state.addedVendorTargetIds.length}`, vendorCarryForwardRiskSummary: state.reusedVendorTargetIds.length > 0 ? "이전 공급사 가격 변동 가능" : "전체 신규", blockingIssues: blocking, warnings };
}

// ── Line Plan ──
export interface RequestReopenLinePlan { reusedRequestLineIds: string[]; rewrittenRequestLineIds: string[]; qtyDeltaSummary: string; specDeltaSummary: string; urgencyDeltaSummary: string; missingFieldSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildRequestReopenLinePlan(state: RequestReopenState): RequestReopenLinePlan {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (state.reusedRequestLineIds.length === 0 && state.rewrittenRequestLineIds.length === 0) blocking.push("요청 라인 없음");
  if (state.rewrittenRequestLineIds.length > 0) warnings.push(`${state.rewrittenRequestLineIds.length}개 라인 재작성 필요`);
  return { reusedRequestLineIds: state.reusedRequestLineIds, rewrittenRequestLineIds: state.rewrittenRequestLineIds, qtyDeltaSummary: "확인 필요", specDeltaSummary: "확인 필요", urgencyDeltaSummary: "확인 필요", missingFieldSummary: "", blockingIssues: blocking, warnings };
}

// ── Condition Delta ──
export interface RequestReopenConditionDelta { requestPurposeDelta: string; responseFieldDelta: string; deliveryExpectationDelta: string; commercialNoteDelta: string; messageDeltaSummary: string; missingInfoSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildRequestReopenConditionDelta(state: RequestReopenState): RequestReopenConditionDelta {
  return { requestPurposeDelta: "", responseFieldDelta: "", deliveryExpectationDelta: "", commercialNoteDelta: "", messageDeltaSummary: state.requestConditionDeltaSummary || "미지정", missingInfoSummary: "", blockingIssues: [], warnings: !state.requestConditionDeltaSummary ? ["조건 delta 미정의"] : [] };
}

// ── Validator ──
export interface RequestReopenValidation { canRecordRequestReopen: boolean; canOpenRequestSubmissionReopen: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateRequestReopenBeforeRecord(state: RequestReopenState): RequestReopenValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.requestReopenBlockedFlag) blocking.push(state.requestReopenBlockedReason || "차단됨");
  const vp = buildRequestReopenVendorTargetPlan(state);
  vp.blockingIssues.forEach(b => { blocking.push(b); missing.push(b); });
  vp.warnings.forEach(w => warnings.push(w));
  const lp = buildRequestReopenLinePlan(state);
  lp.blockingIssues.forEach(b => { blocking.push(b); missing.push(b); });
  lp.warnings.forEach(w => warnings.push(w));
  const cd = buildRequestReopenConditionDelta(state);
  cd.warnings.forEach(w => warnings.push(w));
  const canRecord = blocking.length === 0;
  return { canRecordRequestReopen: canRecord, canOpenRequestSubmissionReopen: canRecord, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : warnings.length > 0 ? "경고 항목 검토 후 저장" : "Request Submission Reopen으로 보내기" };
}

// ── Decision Options ──
export interface RequestReopenDecisionOptions { canRecordReopen: boolean; canOpenRequestSubmissionReopen: boolean; canHold: boolean; canReturnCompareReopen: boolean; decisionReasonSummary: string; }
export function buildRequestReopenDecisionOptions(state: RequestReopenState): RequestReopenDecisionOptions {
  const v = validateRequestReopenBeforeRecord(state);
  return { canRecordReopen: v.canRecordRequestReopen, canOpenRequestSubmissionReopen: v.canOpenRequestSubmissionReopen, canHold: v.missingItems.length > 0, canReturnCompareReopen: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface RequestReopenObject { id: string; compareReopenDecisionSnapshotId: string; requestCandidateIds: string[]; reusedVendorTargetIds: string[]; addedVendorTargetIds: string[]; reusedRequestLineIds: string[]; rewrittenRequestLineIds: string[]; requestConditionDeltaSummary: string; recordedAt: string; recordedBy: string; }
export function buildRequestReopenObject(state: RequestReopenState): RequestReopenObject {
  return { id: `reqreopen_${Date.now().toString(36)}`, compareReopenDecisionSnapshotId: state.compareReopenDecisionSnapshotId, requestCandidateIds: state.requestCandidateIds, reusedVendorTargetIds: state.reusedVendorTargetIds, addedVendorTargetIds: state.addedVendorTargetIds, reusedRequestLineIds: state.reusedRequestLineIds, rewrittenRequestLineIds: state.rewrittenRequestLineIds, requestConditionDeltaSummary: state.requestConditionDeltaSummary, recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Request Submission Reopen Handoff ──
export interface RequestSubmissionReopenHandoff { requestReopenObjectId: string; reusedVendorTargetIds: string[]; addedVendorTargetIds: string[]; reusedRequestLineIds: string[]; rewrittenRequestLineIds: string[]; requestConditionDeltaSummary: string; requestSubmissionReopenReadiness: "ready" | "pending" | "blocked"; }
export function buildRequestSubmissionReopenHandoff(obj: RequestReopenObject): RequestSubmissionReopenHandoff {
  const hasVendors = obj.reusedVendorTargetIds.length > 0 || obj.addedVendorTargetIds.length > 0;
  const hasLines = obj.reusedRequestLineIds.length > 0 || obj.rewrittenRequestLineIds.length > 0;
  return { requestReopenObjectId: obj.id, reusedVendorTargetIds: obj.reusedVendorTargetIds, addedVendorTargetIds: obj.addedVendorTargetIds, reusedRequestLineIds: obj.reusedRequestLineIds, rewrittenRequestLineIds: obj.rewrittenRequestLineIds, requestConditionDeltaSummary: obj.requestConditionDeltaSummary, requestSubmissionReopenReadiness: hasVendors && hasLines ? "ready" : "pending" };
}
