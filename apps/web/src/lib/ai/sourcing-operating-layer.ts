/**
 * Sourcing Tri-Option Operating Layer — selector / contextHash / compare handoff
 *
 * 고정 규칙:
 * 1. sourcing AI = candidate grouping + compare seed framing. product recommendation 금지.
 * 2. current object = query + filters + visible pool + selected basket. single row 아님.
 * 3. option click = preview only. compare seed 반영 = explicit operator action.
 * 4. compare actual truth(comparedItemIds)는 sourcing이 직접 쓰지 않는다.
 * 5. compare handoff = preview → compare seed draft → operator confirm → compare start.
 * 6. 3안 불가 시 surface 숨김. 1안만 남기기 금지.
 * 7. queue/list operating layer로만 동작. search chatbot/floating assistant 금지.
 */

import type { DecisionOption, DecisionOptionSet } from "./decision-option-set";

// ══════════════════════════════════════════════════════════════════════════════
// Current Object
// ══════════════════════════════════════════════════════════════════════════════

export interface SourcingCurrentObject {
  query: string;
  activeFilterSnapshot: Record<string, string>;
  visibleResultIds: string[];
  /** operator가 이미 compare 후보로 담은 것 */
  selectedCandidateIds: string[];
  /** secondary context — current object core 아님 */
  activeResultId: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// AI Context + ContextHash
// ══════════════════════════════════════════════════════════════════════════════

export interface SourcingAiContext {
  query: string;
  activeFilterSnapshot: Record<string, string>;
  visibleResultIds: string[];
  selectedCandidateIds: string[];
  // activeResultId는 core hash에서 제외 — row 변경만으로 regenerate 방지
}

/**
 * contextHash core 입력:
 * - query (검색 의도)
 * - filters (list meaning)
 * - visible pool (현재 결과)
 * - selected basket (operator intent)
 *
 * 제외:
 * - activeResultId (secondary reference — row 클릭만으로 regenerate 과민 방지)
 */
export function buildSourcingAiContextHash(ctx: SourcingAiContext): string {
  const parts = [
    `q:${ctx.query}`,
    `f:${Object.entries(ctx.activeFilterSnapshot).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(",")}`,
    `v:${ctx.visibleResultIds.length}:${ctx.visibleResultIds.slice(0, 5).join(",")}`,
    `c:${ctx.selectedCandidateIds.slice().sort().join(",")}`,
  ];
  // simple deterministic hash
  const str = parts.join("|");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return `sourcing_${Math.abs(hash).toString(36)}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// Stale Discard
// ══════════════════════════════════════════════════════════════════════════════

export function isSourcingOptionSetStale(
  optionSetContextHash: string,
  currentContextHash: string
): boolean {
  return optionSetContextHash !== currentContextHash;
}

// ══════════════════════════════════════════════════════════════════════════════
// Compare Seed Draft (compare actual truth와 분리)
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareSeedDraft {
  source: "sourcing_option";
  sourceOptionId: string;
  sourceStrategy: "conservative" | "balanced" | "alternative";
  candidateIds: string[];
  rationale: string;
  createdAt: string;
}

/**
 * compare seed draft는 compare session이 아니다.
 * operator confirm 이전에는 compare truth가 아니다.
 */
export function createCompareSeedDraft(
  option: SourcingStrategyOptionLocal,
  now: string
): CompareSeedDraft {
  return {
    source: "sourcing_option",
    sourceOptionId: option.id,
    sourceStrategy: option.frame,
    candidateIds: option.compareSeedIds,
    rationale: option.rationale,
    createdAt: now,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Compare Start Input (operator confirm 후에만)
// ══════════════════════════════════════════════════════════════════════════════

export interface StartCompareFromSourcingInput {
  source: "sourcing_option";
  sourceOptionId: string;
  comparedItemIds: string[];
  sourceContextHash: string;
}

/**
 * compare seed draft → compare start input 변환.
 * operator confirm 후에만 호출해야 한다.
 */
export function buildStartCompareInput(
  seed: CompareSeedDraft,
  contextHash: string
): StartCompareFromSourcingInput {
  return {
    source: "sourcing_option",
    sourceOptionId: seed.sourceOptionId,
    comparedItemIds: seed.candidateIds,
    sourceContextHash: contextHash,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Sourcing Strategy Option (stage-specific extension)
// ══════════════════════════════════════════════════════════════════════════════

export interface SourcingStrategyOptionLocal extends DecisionOption {
  /** compare seed로 제안하는 candidate IDs */
  compareSeedIds: string[];
  /** 우선순위 이유 */
  prioritizationReasons: string[];
  /** 결과 커버리지 */
  resultCoverage: "narrow" | "balanced" | "broad";
}

// ══════════════════════════════════════════════════════════════════════════════
// Sourcing AI UI State
// ══════════════════════════════════════════════════════════════════════════════

export interface SourcingAiUiState {
  activeSourcingStrategyOptionId: string | null;
  compareSeedDraft: CompareSeedDraft | null;
}

export function createInitialSourcingAiUiState(): SourcingAiUiState {
  return {
    activeSourcingStrategyOptionId: null,
    compareSeedDraft: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Surface Model
// ══════════════════════════════════════════════════════════════════════════════

export interface SourcingStrategySurfaceModel {
  optionSet: DecisionOptionSet | null;
  options: SourcingStrategyOptionLocal[];
  activeOption: SourcingStrategyOptionLocal | null;
  compareSeedDraft: CompareSeedDraft | null;
  shouldRender: boolean;
  canCreateCompareSeed: boolean;
  canStartCompare: boolean;
}

export function buildSourcingStrategySurfaceModel(input: {
  optionSet: DecisionOptionSet | null;
  options: SourcingStrategyOptionLocal[];
  activeOptionId: string | null;
  compareSeedDraft: CompareSeedDraft | null;
  currentContextHash: string | null;
}): SourcingStrategySurfaceModel {
  const { optionSet, options, activeOptionId, compareSeedDraft, currentContextHash } = input;

  // 3안 불가 시 숨김
  if (!optionSet || options.length !== 3 || !currentContextHash) {
    return {
      optionSet: null,
      options: [],
      activeOption: null,
      compareSeedDraft: null,
      shouldRender: false,
      canCreateCompareSeed: false,
      canStartCompare: false,
    };
  }

  // stale check
  if (isSourcingOptionSetStale(optionSet.contextHash, currentContextHash)) {
    return {
      optionSet: null,
      options: [],
      activeOption: null,
      compareSeedDraft: null,
      shouldRender: false,
      canCreateCompareSeed: false,
      canStartCompare: false,
    };
  }

  const activeOption = activeOptionId
    ? options.find(o => o.id === activeOptionId) ?? options.find(o => o.frame === "balanced") ?? null
    : options.find(o => o.frame === "balanced") ?? null;

  const canCreateCompareSeed = !!activeOption && activeOption.compareSeedIds.length >= 2;
  const canStartCompare = !!compareSeedDraft && compareSeedDraft.candidateIds.length >= 2;

  return {
    optionSet,
    options,
    activeOption,
    compareSeedDraft,
    shouldRender: true,
    canCreateCompareSeed,
    canStartCompare,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Interaction Helpers
// ══════════════════════════════════════════════════════════════════════════════

/** option click = preview only */
export function focusSourcingOption(
  state: SourcingAiUiState,
  optionId: string
): SourcingAiUiState {
  return { ...state, activeSourcingStrategyOptionId: optionId };
}

/** "이 전략으로 비교 후보 구성" = compare seed draft 생성 */
export function createSourcingCompareSeed(
  state: SourcingAiUiState,
  option: SourcingStrategyOptionLocal
): SourcingAiUiState {
  return {
    ...state,
    compareSeedDraft: createCompareSeedDraft(option, new Date().toISOString()),
  };
}

/** "이 묶음으로 비교 시작" = compare session handoff (이후 router.push) */
export function clearSourcingCompareSeed(
  state: SourcingAiUiState
): SourcingAiUiState {
  return { ...state, compareSeedDraft: null };
}

/** surface dismiss */
export function dismissSourcingSurface(
  state: SourcingAiUiState
): SourcingAiUiState {
  return {
    activeSourcingStrategyOptionId: null,
    compareSeedDraft: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Generation Eligibility
// ══════════════════════════════════════════════════════════════════════════════

export interface SourcingGenerationEligibility {
  eligible: boolean;
  reason:
    | "eligible"
    | "no_query"
    | "insufficient_results"
    | "inflight"
    | "stale_not_cleared"
    | "compare_transition";
}

export function checkSourcingGenerationEligibility(input: {
  query: string;
  visibleResultCount: number;
  isInflight: boolean;
  isInCompareTransition: boolean;
}): SourcingGenerationEligibility {
  if (!input.query.trim()) return { eligible: false, reason: "no_query" };
  if (input.visibleResultCount < 2) return { eligible: false, reason: "insufficient_results" };
  if (input.isInflight) return { eligible: false, reason: "inflight" };
  if (input.isInCompareTransition) return { eligible: false, reason: "compare_transition" };
  return { eligible: true, reason: "eligible" };
}

// ══════════════════════════════════════════════════════════════════════════════
// Inflight Identity
// ══════════════════════════════════════════════════════════════════════════════

export interface SourcingOptionSetGenerationRequest {
  requestId: string;
  query: string;
  contextHash: string;
  startedAt: string;
}

export function isDuplicateSourcingInflight(
  inflight: SourcingOptionSetGenerationRequest | null,
  next: { contextHash: string }
): boolean {
  if (!inflight) return false;
  return inflight.contextHash === next.contextHash;
}
