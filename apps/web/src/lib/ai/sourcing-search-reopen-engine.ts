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

// ══════════════════════════════════════════════════════════════════════════════
// V2 Extensions — Procurement Re-entry Reopen based sourcing search reopen
// ══════════════════════════════════════════════════════════════════════════════

import type { SourcingSearchReopenFromProcurementHandoff } from "./procurement-reentry-reopen-engine";

// ── V2 State extension ──
export interface SourcingSearchReopenStateV2 extends SourcingSearchReopenState {
  procurementReentryReopenObjectId: string;
  searchSeedPackageId: string | null;
  seedTranslationSummary: string;
  strategyOptions: SourcingStrategyOption[];
  selectedStrategyOptionId: string | null;
  duplicateSearchReopenRisk: boolean;
}

// ── Sourcing Strategy Option (tri-option) ──
export type SourcingStrategyType = "exact_match_first" | "cross_vendor_equivalent" | "alternative_pack_substitute";
export interface SourcingStrategyOption { id: string; strategyType: SourcingStrategyType; label: string; rationale: string; risk: string; recommendedScenario: string; downstreamEffect: string; }

export function createInitialSourcingSearchReopenStateV2(handoff: SourcingSearchReopenFromProcurementHandoff): SourcingSearchReopenStateV2 {
  const hasReorder = handoff.reorderCandidateQtySummary && handoff.reorderCandidateQtySummary !== "0개";
  return {
    sourcingSearchReopenStatus: "sourcing_search_reopen_open",
    substatus: "awaiting_query_seed_review",
    sourcingSearchReopenOpenedAt: new Date().toISOString(),
    procurementReentryObjectId: handoff.procurementReentryReopenObjectId,
    selectedReentryRoute: handoff.selectedReopenRoute,
    querySeed: { keywordBasis: "", categorySeed: "", specPackSeed: "", manufacturerSeed: "", catalogReferenceSeed: "", excludedTerms: [] },
    filterSeed: { preferredVendors: [], excludedVendors: [], inStockPreference: false, leadTimePreference: "normal", priceSensitivity: "medium", regionPreference: "" },
    prioritySignal: { urgency: hasReorder ? "normal" : "watch", reorderQtyBasis: handoff.reorderCandidateQtySummary, coverageTarget: "", expiryHorizonNote: "" },
    baselineReuseMode: handoff.baselineReuseSummary.includes("full_reuse") ? "full_reuse" : handoff.baselineReuseSummary.includes("partial") ? "partial_reuse" : "full_reset",
    missingDecisionCount: 2,
    sourcingSearchReopenBlockedFlag: handoff.sourcingSearchReopenReadiness === "blocked",
    sourcingSearchReopenBlockedReason: handoff.sourcingSearchReopenReadiness === "blocked" ? "Search Reopen 조건 미충족" : null,
    sourcingSearchReopenObjectId: null,
    // V2 extensions
    procurementReentryReopenObjectId: handoff.procurementReentryReopenObjectId,
    searchSeedPackageId: null,
    seedTranslationSummary: "",
    strategyOptions: buildDefaultStrategyOptions(),
    selectedStrategyOptionId: null,
    duplicateSearchReopenRisk: false,
  };
}

function buildDefaultStrategyOptions(): SourcingStrategyOption[] {
  return [
    { id: "strat_exact", strategyType: "exact_match_first", label: "Exact Match First", rationale: "동일 제품·동일 규격 우선 검색", risk: "대체 후보 부족 가능", recommendedScenario: "기존 제품 재구매", downstreamEffect: "비교 단계 최소화" },
    { id: "strat_cross", strategyType: "cross_vendor_equivalent", label: "Cross-Vendor Equivalent", rationale: "다른 공급사의 동등 제품 탐색", risk: "규격 차이 검증 필요", recommendedScenario: "가격·납기 최적화", downstreamEffect: "비교 단계 확대" },
    { id: "strat_alt", strategyType: "alternative_pack_substitute", label: "Alternative Pack / Substitute", rationale: "대체 용량·대체 제품 포함 검색", risk: "호환성 검증 필요", recommendedScenario: "긴급 재고 확보", downstreamEffect: "비교+규격 검증 필요" },
  ];
}

// ── Search Seed Package Builder ──
export interface SearchSeedPackage { id: string; keywordSeeds: string[]; categorySeeds: string[]; specSeeds: string[]; vendorHints: string[]; excludedHints: string[]; urgencySignals: string[]; quantityBand: string; commercialSignals: string[]; blockingIssues: string[]; warnings: string[]; }
export function buildSourcingSearchSeedPackage(state: SourcingSearchReopenStateV2): SearchSeedPackage {
  const blocking: string[] = [];
  const warnings: string[] = [];
  if (!state.querySeed.keywordBasis && !state.querySeed.categorySeed) blocking.push("검색 키워드 또는 카테고리 미지정");
  return { id: `seedpkg_${Date.now().toString(36)}`, keywordSeeds: state.querySeed.keywordBasis ? [state.querySeed.keywordBasis] : [], categorySeeds: state.querySeed.categorySeed ? [state.querySeed.categorySeed] : [], specSeeds: state.querySeed.specPackSeed ? [state.querySeed.specPackSeed] : [], vendorHints: state.filterSeed.preferredVendors, excludedHints: [...state.querySeed.excludedTerms, ...state.filterSeed.excludedVendors], urgencySignals: [state.prioritySignal.urgency], quantityBand: state.prioritySignal.reorderQtyBasis, commercialSignals: [state.filterSeed.priceSensitivity], blockingIssues: blocking, warnings };
}

// ── V2 Validator ──
export interface SourcingSearchReopenValidationV2 { canRecordSourcingSearchReopen: boolean; canOpenSourcingResult: boolean; blockingIssues: string[]; warnings: string[]; missingItems: string[]; recommendedNextAction: string; }
export function validateSourcingSearchReopenV2BeforeRecord(state: SourcingSearchReopenStateV2): SourcingSearchReopenValidationV2 {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  if (state.sourcingSearchReopenBlockedFlag) blocking.push(state.sourcingSearchReopenBlockedReason || "차단됨");
  const seedPkg = buildSourcingSearchSeedPackage(state);
  seedPkg.blockingIssues.forEach(b => { blocking.push(b); missing.push(b); });
  if (!state.selectedStrategyOptionId) { warnings.push("Strategy 미선택"); missing.push("Strategy 선택"); }
  if (state.baselineReuseMode === "pending") { warnings.push("Baseline 미결정"); missing.push("Baseline 결정"); }
  if (state.duplicateSearchReopenRisk) warnings.push("중복 search reopen 위험");
  const canRecord = blocking.length === 0;
  return { canRecordSourcingSearchReopen: canRecord, canOpenSourcingResult: canRecord && !!state.selectedStrategyOptionId, blockingIssues: blocking, warnings, missingItems: missing, recommendedNextAction: blocking.length > 0 ? "차단 사항 해결" : !state.selectedStrategyOptionId ? "Strategy 선택 후 진행" : "Sourcing Result로 보내기" };
}

// ── V2 Canonical Object ──
export interface SourcingSearchReopenObjectV2 extends SourcingSearchReopenObject { procurementReentryReopenObjectId: string; searchSeedPackageSummary: string; selectedStrategyOptionId: string; selectedStrategyLabel: string; }
export function buildSourcingSearchReopenObjectV2(state: SourcingSearchReopenStateV2): SourcingSearchReopenObjectV2 {
  const base = buildSourcingSearchReopenObject(state);
  const selectedStrategy = state.strategyOptions.find(o => o.id === state.selectedStrategyOptionId);
  return { ...base, procurementReentryReopenObjectId: state.procurementReentryReopenObjectId, searchSeedPackageSummary: `${state.querySeed.keywordBasis || state.querySeed.categorySeed || "미지정"} | ${state.filterSeed.priceSensitivity} | ${state.prioritySignal.urgency}`, selectedStrategyOptionId: state.selectedStrategyOptionId || "", selectedStrategyLabel: selectedStrategy?.label || "미선택" };
}

// ── V2 Result Handoff ──
export interface SourcingSearchResultHandoffV2 extends SourcingSearchResultHandoff { searchSeedPackageSummary: string; selectedStrategyOptionId: string; reopenScopeSummary: string; }
export function buildSourcingSearchResultHandoffV2(obj: SourcingSearchReopenObjectV2): SourcingSearchResultHandoffV2 {
  const base = buildSourcingSearchResultHandoff(obj);
  return { ...base, searchSeedPackageSummary: obj.searchSeedPackageSummary, selectedStrategyOptionId: obj.selectedStrategyOptionId, reopenScopeSummary: obj.reentryScopeSummary };
}
