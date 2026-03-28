/**
 * Sourcing Search Reopen Engine — 검색 재진입 seed 구성 + baseline reuse + result handoff
 *
 * 고정 규칙:
 * 1. search reopen = procurement re-entry 결과를 canonical search seed로 번역하는 gate.
 * 2. re-entry ≠ search reopen — reorder truth와 search seed truth는 다른 canonical 객체.
 * 3. query / filter / baseline은 structured seed로 저장 (free-text만 금지).
 * 4. canonical sourcing search reopen object 없이 result 화면 진입 금지.
 * 5. sourcing result → 1단계 AI 판단으로 순환 연결.
 */

import type { SourcingReopenHandoff } from "./procurement-reentry-engine";

// ── Status ──
export type SourcingSearchReopenStatus = "sourcing_search_reopen_open" | "sourcing_search_reopen_in_progress" | "sourcing_search_reopen_recorded";
export type SourcingSearchReopenSubstatus = "awaiting_query_seed_review" | "awaiting_filter_seed_review" | "awaiting_baseline_reuse_confirmation" | "sourcing_search_reopen_blocked" | "ready_for_search_result_open";

// ── Query Seed ──
export interface QuerySeed { keywordBasis: string; categorySeed: string; specPackSeed: string; manufacturerSeed: string; catalogReferenceSeed: string; excludedTerms: string[]; }

// ── Filter Seed ──
export interface FilterSeed { preferredVendors: string[]; excludedVendors: string[]; inStockPreference: boolean; leadTimePreference: "fast" | "normal" | "flexible"; priceSensitivity: "low" | "medium" | "high"; regionPreference: string; }

// ── Priority Signal ──
export interface SourcingPrioritySignal { urgency: "immediate" | "normal" | "watch"; reorderQtyBasis: string; coverageTarget: string; expiryHorizonNote: string; }

// ── State ──
export interface SourcingSearchReopenState {
  sourcingSearchReopenStatus: SourcingSearchReopenStatus;
  substatus: SourcingSearchReopenSubstatus;
  sourcingSearchReopenOpenedAt: string;
  procurementReentryObjectId: string;
  selectedReentryRoute: string;
  querySeed: QuerySeed;
  filterSeed: FilterSeed;
  prioritySignal: SourcingPrioritySignal;
  baselineReuseMode: "full_reuse" | "partial_reuse" | "full_reset" | "pending";
  missingDecisionCount: number;
  sourcingSearchReopenBlockedFlag: boolean;
  sourcingSearchReopenBlockedReason: string | null;
  sourcingSearchReopenObjectId: string | null;
}

export function createInitialSourcingSearchReopenState(handoff: SourcingReopenHandoff): SourcingSearchReopenState {
  return {
    sourcingSearchReopenStatus: "sourcing_search_reopen_open",
    substatus: "awaiting_query_seed_review",
    sourcingSearchReopenOpenedAt: new Date().toISOString(),
    procurementReentryObjectId: handoff.procurementReentryObjectId,
    selectedReentryRoute: handoff.selectedReentryRoute,
    querySeed: { keywordBasis: "", categorySeed: "", specPackSeed: "", manufacturerSeed: "", catalogReferenceSeed: "", excludedTerms: [] },
    filterSeed: { preferredVendors: [], excludedVendors: [], inStockPreference: false, leadTimePreference: "normal", priceSensitivity: "medium", regionPreference: "" },
    prioritySignal: { urgency: "normal", reorderQtyBasis: handoff.reorderCandidateQtySummary, coverageTarget: "", expiryHorizonNote: "" },
    baselineReuseMode: handoff.baselineReuseSummary.includes("full_reuse") ? "full_reuse" : handoff.baselineReuseSummary.includes("partial") ? "partial_reuse" : "full_reset",
    missingDecisionCount: 2,
    sourcingSearchReopenBlockedFlag: handoff.sourcingReopenReadiness === "blocked",
    sourcingSearchReopenBlockedReason: handoff.sourcingReopenReadiness === "blocked" ? "Search Reopen 조건 미충족" : null,
    sourcingSearchReopenObjectId: null,
  };
}

// ── Search Seeds Builder ──
export interface SourcingSearchSeeds { querySeeds: QuerySeed; filterSeeds: FilterSeed; prioritySignals: SourcingPrioritySignal; baselineCarryForwardFlags: { searchContext: boolean; compareBasis: boolean; vendorHints: boolean }; blockingIssues: string[]; warnings: string[]; }
export function buildSourcingSearchSeeds(state: SourcingSearchReopenState): SourcingSearchSeeds {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (!state.querySeed.keywordBasis && !state.querySeed.categorySeed) blocking.push("검색 키워드 또는 카테고리 미지정");
  if (state.baselineReuseMode === "pending") warnings.push("Baseline reuse 미결정");
  return { querySeeds: state.querySeed, filterSeeds: state.filterSeed, prioritySignals: state.prioritySignal, baselineCarryForwardFlags: { searchContext: state.baselineReuseMode === "full_reuse" || state.baselineReuseMode === "partial_reuse", compareBasis: state.baselineReuseMode === "full_reuse", vendorHints: state.baselineReuseMode !== "full_reset" }, blockingIssues: blocking, warnings };
}

// ── Baseline Reuse Decision ──
export interface SearchBaselineReuseDecision { reuseSearchQueryContext: boolean; reuseCategoryAndSpecBaseline: boolean; reusePreferredVendorHints: boolean; resetPreviousVendorBias: boolean; resetPreviousCommercialPreference: boolean; baselineCarryForwardRiskSummary: string; }
export function buildSearchBaselineReuseDecision(state: SourcingSearchReopenState): SearchBaselineReuseDecision {
  const mode = state.baselineReuseMode;
  return { reuseSearchQueryContext: mode === "full_reuse" || mode === "partial_reuse", reuseCategoryAndSpecBaseline: mode === "full_reuse" || mode === "partial_reuse", reusePreferredVendorHints: mode === "full_reuse", resetPreviousVendorBias: mode === "full_reset" || mode === "partial_reuse", resetPreviousCommercialPreference: mode === "full_reset", baselineCarryForwardRiskSummary: mode === "full_reuse" ? "이전 공급사 가격 변동 가능" : mode === "partial_reuse" ? "부분 baseline 재사용 — 비교 기준 재설정 필요" : "전체 초기화" };
}

// ── Validator ──
export interface SourcingSearchReopenValidation { canRecordSourcingSearchReopen: boolean; canOpenSourcingResult: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateSourcingSearchReopenBeforeRecord(state: SourcingSearchReopenState): SourcingSearchReopenValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.sourcingSearchReopenBlockedFlag) blocking.push(state.sourcingSearchReopenBlockedReason || "차단됨");
  const seeds = buildSourcingSearchSeeds(state);
  seeds.blockingIssues.forEach(b => { blocking.push(b); missing.push(b); });
  seeds.warnings.forEach(w => warnings.push(w));
  if (state.baselineReuseMode === "pending") { warnings.push("Baseline 결정 필요"); missing.push("Baseline reuse 결정"); }
  const canRecord = blocking.length === 0;
  return { canRecordSourcingSearchReopen: canRecord, canOpenSourcingResult: canRecord, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : warnings.length > 0 ? "경고 항목 검토 후 저장" : "Sourcing Result로 보내기" };
}

// ── Decision Options ──
export interface SourcingSearchReopenDecisionOptions { canRecordReopen: boolean; canOpenSourcingResult: boolean; canHold: boolean; canReturnProcurementReentry: boolean; decisionReasonSummary: string; }
export function buildSourcingSearchReopenDecisionOptions(state: SourcingSearchReopenState): SourcingSearchReopenDecisionOptions {
  const v = validateSourcingSearchReopenBeforeRecord(state);
  return { canRecordReopen: v.canRecordSourcingSearchReopen, canOpenSourcingResult: v.canOpenSourcingResult, canHold: v.missingItems.length > 0, canReturnProcurementReentry: true, decisionReasonSummary: v.recommendedNextAction };
}

// ── Canonical Object ──
export interface SourcingSearchReopenObject { id: string; procurementReentryObjectId: string; selectedReentryRoute: string; querySeedSummary: string; filterSeedSummary: string; baselineReuseSummary: string; sourcingPrioritySummary: string; reentryScopeSummary: string; recordedAt: string; recordedBy: string; }
export function buildSourcingSearchReopenObject(state: SourcingSearchReopenState): SourcingSearchReopenObject {
  return { id: `srcreopen_${Date.now().toString(36)}`, procurementReentryObjectId: state.procurementReentryObjectId, selectedReentryRoute: state.selectedReentryRoute, querySeedSummary: state.querySeed.keywordBasis || state.querySeed.categorySeed || "미지정", filterSeedSummary: `Stock: ${state.filterSeed.inStockPreference ? "선호" : "무관"}, Lead: ${state.filterSeed.leadTimePreference}, Price: ${state.filterSeed.priceSensitivity}`, baselineReuseSummary: state.baselineReuseMode, sourcingPrioritySummary: `${state.prioritySignal.urgency} — ${state.prioritySignal.reorderQtyBasis}`, reentryScopeSummary: state.prioritySignal.reorderQtyBasis || "미지정", recordedAt: new Date().toISOString(), recordedBy: "operator" };
}

// ── Sourcing Result Handoff ──
export interface SourcingSearchResultHandoff { sourcingSearchReopenObjectId: string; querySeedSummary: string; filterSeedSummary: string; baselineReuseSummary: string; sourcingPrioritySummary: string; sourcingResultReadiness: "ready" | "pending" | "blocked"; }
export function buildSourcingSearchResultHandoff(obj: SourcingSearchReopenObject): SourcingSearchResultHandoff {
  return { sourcingSearchReopenObjectId: obj.id, querySeedSummary: obj.querySeedSummary, filterSeedSummary: obj.filterSeedSummary, baselineReuseSummary: obj.baselineReuseSummary, sourcingPrioritySummary: obj.sourcingPrioritySummary, sourcingResultReadiness: obj.querySeedSummary !== "미지정" ? "ready" : "pending" };
}
