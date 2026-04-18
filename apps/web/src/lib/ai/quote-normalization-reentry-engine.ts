/**
 * Quote Normalization Re-entry Engine — stale/retained/remap 재분류 + line delta normalization + compare re-entry handoff
 */

import type { QuoteNormalizationReentryHandoff } from "./quote-management-reentry-engine";

// ── Status ──
export type QuoteNormalizationReentryStatus = "quote_normalization_reentry_open" | "quote_normalization_reentry_in_progress" | "quote_normalization_reentry_recorded";
export type QuoteNormalizationReentrySubstatus = "awaiting_candidate_remap_review" | "awaiting_stale_vs_retained_decision" | "awaiting_line_delta_normalization" | "quote_normalization_reentry_blocked" | "ready_for_compare_reentry";

// ── Quote Classification ──
export type NormReentryClassification = "stale" | "retained" | "remapped" | "waiting_new" | "blocked_delta_mismatch";
export interface NormReentryQuoteDecision { quoteId: string; vendorName: string; classification: NormReentryClassification; lineDeltaImpact: boolean; remapRequired: boolean; rationale: string; }

// ── State ──
export interface QuoteNormalizationReentryState {
  quoteNormalizationReentryStatus: QuoteNormalizationReentryStatus;
  substatus: QuoteNormalizationReentrySubstatus;
  quoteNormalizationReentryOpenedAt: string;
  quoteManagementReentryObjectId: string;
  normalizationReentryCandidateIds: string[];
  retainedQuoteIds: string[];
  staleQuoteIds: string[];
  remappedQuoteIds: string[];
  requestLineDeltaNormalizationSummary: string;
  missingDecisionCount: number;
  quoteNormalizationReentryBlockedFlag: boolean;
  quoteNormalizationReentryBlockedReason: string | null;
  quoteNormalizationReentryObjectId: string | null;
  quoteDecisions: NormReentryQuoteDecision[];
}

export function createInitialQuoteNormalizationReentryState(handoff: QuoteNormalizationReentryHandoff): QuoteNormalizationReentryState {
  return {
    quoteNormalizationReentryStatus: "quote_normalization_reentry_open",
    substatus: "awaiting_candidate_remap_review",
    quoteNormalizationReentryOpenedAt: new Date().toISOString(),
    quoteManagementReentryObjectId: handoff.quoteManagementReentryObjectId,
    normalizationReentryCandidateIds: handoff.normalizationReentryCandidateIds,
    retainedQuoteIds: [],
    staleQuoteIds: [],
    remappedQuoteIds: [],
    requestLineDeltaNormalizationSummary: "",
    missingDecisionCount: handoff.normalizationReentryCandidateIds.length,
    quoteNormalizationReentryBlockedFlag: handoff.normalizationReentryReadiness === "blocked",
    quoteNormalizationReentryBlockedReason: handoff.normalizationReentryReadiness === "blocked" ? "Normalization Re-entry 조건 미충족" : null,
    quoteNormalizationReentryObjectId: null,
    quoteDecisions: [],
  };
}

// ── Normalization Plan ──
export interface NormReentryPlan { staleQuoteIds: string[]; retainedQuoteIds: string[]; remappedQuoteIds: string[]; waitingNewQuoteIds: string[]; blockedQuoteIds: string[]; remapRationaleSummary: string; blockingIssues: string[]; warnings: string[]; }
export function buildQuoteReentryNormalizationPlan(decisions: NormReentryQuoteDecision[]): NormReentryPlan {
  const stale = decisions.filter(d => d.classification === "stale").map(d => d.quoteId);
  const retained = decisions.filter(d => d.classification === "retained").map(d => d.quoteId);
  const remapped = decisions.filter(d => d.classification === "remapped").map(d => d.quoteId);
  const waiting = decisions.filter(d => d.classification === "waiting_new").map(d => d.quoteId);
  const blocked = decisions.filter(d => d.classification === "blocked_delta_mismatch").map(d => d.quoteId);
  return { staleQuoteIds: stale, retainedQuoteIds: retained, remappedQuoteIds: remapped, waitingNewQuoteIds: waiting, blockedQuoteIds: blocked, remapRationaleSummary: `Retained ${retained.length}, Remapped ${remapped.length}, Stale ${stale.length}`, blockingIssues: decisions.length === 0 ? ["분류 결정 없음"] : blocked.length > 0 ? [`${blocked.length}개 delta mismatch`] : [], warnings: stale.length > 0 ? [`${stale.length}개 stale 처리`] : [] };
}

// ── Delta Normalization Plan ──
export interface RequestLineDeltaNormalizationPlan { rewrittenLineRemapSummary: string; reusedLineCarryForwardSummary: string; deltaAffectedQuoteIds: string[]; missingNormalizedFieldSummary: string; blockedNormalizationIds: string[]; blockingIssues: string[]; warnings: string[]; }
export function buildRequestLineDeltaNormalizationPlan(decisions: NormReentryQuoteDecision[]): RequestLineDeltaNormalizationPlan {
  const deltaAffected = decisions.filter(d => d.lineDeltaImpact);
  const remapRequired = decisions.filter(d => d.remapRequired);
  return { rewrittenLineRemapSummary: `${remapRequired.length}개 remap 필요`, reusedLineCarryForwardSummary: `${decisions.length - remapRequired.length}개 재사용`, deltaAffectedQuoteIds: deltaAffected.map(d => d.quoteId), missingNormalizedFieldSummary: "", blockedNormalizationIds: decisions.filter(d => d.classification === "blocked_delta_mismatch").map(d => d.quoteId), blockingIssues: [], warnings: remapRequired.length > 0 ? [`${remapRequired.length}개 라인 remap 필요`] : [] };
}

// ── Validator ──
export interface QuoteNormalizationReentryValidation { canRecordQuoteNormalizationReentry: boolean; canOpenQuoteCompareReentry: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateQuoteNormalizationReentryBeforeRecord(state: QuoteNormalizationReentryState): QuoteNormalizationReentryValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.quoteNormalizationReentryBlockedFlag) blocking.push(state.quoteNormalizationReentryBlockedReason || "차단됨");
  const plan = buildQuoteReentryNormalizationPlan(state.quoteDecisions);
  plan.blockingIssues.forEach(b => { blocking.push(b); missing.push(b); });
  plan.warnings.forEach(w => warnings.push(w));
  const delta = buildRequestLineDeltaNormalizationPlan(state.quoteDecisions);
  delta.warnings.forEach(w => warnings.push(w));
  const canRecord = blocking.length === 0;
  const compareReady = canRecord && (plan.retainedQuoteIds.length + plan.remappedQuoteIds.length) >= 2;
  return { canRecordQuoteNormalizationReentry: canRecord, canOpenQuoteCompareReentry: compareReady, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : compareReady ? "Quote Compare Re-entry로 보내기" : "비교 가능 quote 2개 이상 확보 필요" };
}

// ── Decision Options ──
export interface QuoteNormalizationReentryDecisionOptions { canRecordReentry: boolean; canOpenQuoteCompareReentry: boolean; canHold: boolean; canReturnQuoteManagementReentry: boolean; decisionReasonSummary: string; }
export function buildQuoteNormalizationReentryDecisionOptions(state: QuoteNormalizationReentryState): QuoteNormalizationReentryDecisionOptions {
  const v = validateQuoteNormalizationReentryBeforeRecord(state);
  return { canRecordReentry: v.canRecordQuoteNormalizationReentry, canOpenQuoteCompareReentry: v.canOpenQuoteCompareReentry, canHold: state.quoteDecisions.some(d => d.classification === "blocked_delta_mismatch"), canReturnQuoteManagementReentry: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface QuoteNormalizationReentryObject { id: string; quoteManagementReentryObjectId: string; staleQuoteIds: string[]; retainedQuoteIds: string[]; remappedQuoteIds: string[]; requestLineDeltaNormalizationSummary: string; blockedNormalizationIds: string[]; compareReentryCandidateIds: string[]; recordedAt: string; recordedBy: string; }
export function buildQuoteNormalizationReentryObject(state: QuoteNormalizationReentryState): QuoteNormalizationReentryObject {
  const plan = buildQuoteReentryNormalizationPlan(state.quoteDecisions);
  return { id: `qnormreentry_${Date.now().toString(36)}`, quoteManagementReentryObjectId: state.quoteManagementReentryObjectId, staleQuoteIds: plan.staleQuoteIds, retainedQuoteIds: plan.retainedQuoteIds, remappedQuoteIds: plan.remappedQuoteIds, requestLineDeltaNormalizationSummary: state.requestLineDeltaNormalizationSummary || plan.remapRationaleSummary, blockedNormalizationIds: plan.blockedQuoteIds, compareReentryCandidateIds: [...plan.retainedQuoteIds, ...plan.remappedQuoteIds], recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Compare Re-entry Handoff ──
export interface QuoteCompareReentryFromNormHandoff { quoteNormalizationReentryObjectId: string; retainedQuoteIds: string[]; remappedQuoteIds: string[]; compareReentryCandidateIds: string[]; requestLineDeltaNormalizationSummary: string; quoteCompareReentryReadiness: "ready" | "pending" | "blocked"; }
export function buildQuoteCompareReentryFromNormalizationHandoff(obj: QuoteNormalizationReentryObject): QuoteCompareReentryFromNormHandoff {
  return { quoteNormalizationReentryObjectId: obj.id, retainedQuoteIds: obj.retainedQuoteIds, remappedQuoteIds: obj.remappedQuoteIds, compareReentryCandidateIds: obj.compareReentryCandidateIds, requestLineDeltaNormalizationSummary: obj.requestLineDeltaNormalizationSummary, quoteCompareReentryReadiness: obj.compareReentryCandidateIds.length >= 2 ? "ready" : "pending" };
}
