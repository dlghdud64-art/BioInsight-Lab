/**
 * Compare Review Workbench — difference-first decision surface + shortlist + request handoff
 *
 * 고정 규칙:
 * 1. compare는 rail 보조가 아니라 center work window가 기본 판단면.
 * 2. raw table 나열보다 difference summary가 먼저.
 * 3. mixed-category direct compare 차단. same-category gate 필수.
 * 4. shortlist / exclude / request candidate 반영이 같은 work window 안에서 처리.
 * 5. compare decision snapshot 없이 request candidate canonical 확정 금지.
 * 6. center / rail / dock이 동일 compare truth를 봐야 함.
 * 7. compare는 보기 단계가 아니라 다음 조달 행동을 바꾸는 판단 단계.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Compare Review Status
// ══════════════════════════════════════════════════════════════════════════════

export type CompareReviewStatus =
  | "compare_ready"
  | "compare_review_open"
  | "compare_shortlist_recorded";

export type CompareReviewSubstatus =
  | "awaiting_compare_basis"
  | "difference_review_active"
  | "shortlist_pending"
  | "compare_blocked"
  | "ready_for_request_candidate";

export const COMPARE_REVIEW_STATUS_LABELS: Record<CompareReviewStatus, string> = {
  compare_ready: "비교 준비",
  compare_review_open: "비교 검토 중",
  compare_shortlist_recorded: "비교 결과 저장",
};

export const COMPARE_REVIEW_SUBSTATUS_LABELS: Record<CompareReviewSubstatus, string> = {
  awaiting_compare_basis: "비교 기준 대기",
  difference_review_active: "차이 검토 중",
  shortlist_pending: "Shortlist 대기",
  compare_blocked: "비교 차단",
  ready_for_request_candidate: "견적 후보 반영 가능",
};

// ══════════════════════════════════════════════════════════════════════════════
// Compare Candidate (structured)
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareCandidate {
  productId: string;
  productName: string;
  brand: string | null;
  catalogNumber: string | null;
  specification: string | null;
  unitPriceKRW: number | null;
  leadTimeDays: number | null;
  vendorName: string | null;
  category: string | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Compare Review State
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareReviewState {
  // ── Status ──
  compareReviewStatus: CompareReviewStatus;
  compareSubstatus: CompareReviewSubstatus;
  compareOpenedAt: string | null;

  // ── Selection snapshot ──
  compareSelectionSnapshotId: string | null;
  compareCandidateIds: string[];
  compareCandidates: CompareCandidate[];

  // ── Category ──
  compareCategoryStatus: "same_category" | "mixed_category" | "unknown";

  // ── Decision ──
  compareShortlistIds: string[];
  compareExcludedIds: string[];
  compareHeldIds: string[];
  requestCandidateIds: string[];
  compareDecisionSummary: string | null;
  compareDecisionSnapshotId: string | null;

  // ── Source ──
  sourceStrategyOptionId: string | null;
}

export function createInitialCompareReviewState(
  candidateIds: string[],
  candidates: CompareCandidate[],
  sourceStrategyOptionId?: string | null
): CompareReviewState {
  return {
    compareReviewStatus: "compare_ready",
    compareSubstatus: "awaiting_compare_basis",
    compareOpenedAt: null,
    compareSelectionSnapshotId: null,
    compareCandidateIds: candidateIds,
    compareCandidates: candidates,
    compareCategoryStatus: "unknown",
    compareShortlistIds: [],
    compareExcludedIds: [],
    compareHeldIds: [],
    requestCandidateIds: [],
    compareDecisionSummary: null,
    compareDecisionSnapshotId: null,
    sourceStrategyOptionId: sourceStrategyOptionId ?? null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Same-Category Gate
// ══════════════════════════════════════════════════════════════════════════════

export type CompareModeType = "direct_compare" | "alternative_review" | "mixed_blocked";

export interface CompareCategoryGateResult {
  isComparable: boolean;
  blockingIssues: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  compareMode: CompareModeType;
  recommendedNextAction: string;
}

export function validateCompareCategoryIntegrity(
  candidates: CompareCandidate[]
): CompareCategoryGateResult {
  const blockingIssues: { code: string; message: string }[] = [];
  const warnings: { code: string; message: string }[] = [];

  if (candidates.length < 2) {
    blockingIssues.push({ code: "insufficient_candidates", message: "비교 대상이 2개 이상이어야 합니다." });
  }

  // Category check
  const categories = candidates.map(c => c.category).filter(Boolean);
  const uniqueCategories = [...new Set(categories)];
  const hasMixedCategory = uniqueCategories.length > 1;
  const hasUnknownCategory = candidates.some(c => !c.category);

  if (hasMixedCategory) {
    blockingIssues.push({
      code: "mixed_category",
      message: "같은 카테고리 제품만 직접 비교할 수 있습니다.",
    });
  }

  if (hasUnknownCategory) {
    warnings.push({
      code: "unknown_category",
      message: "일부 제품의 카테고리가 확인되지 않았습니다.",
    });
  }

  // Price info check
  const missingPrice = candidates.filter(c => !c.unitPriceKRW || c.unitPriceKRW <= 0);
  if (missingPrice.length > 0) {
    warnings.push({
      code: "missing_price",
      message: `${missingPrice.length}개 제품의 가격 정보가 없습니다. 견적 요청이 필요합니다.`,
    });
  }

  // Spec missing check
  const missingSpec = candidates.filter(c => !c.specification);
  if (missingSpec.length > 0) {
    warnings.push({
      code: "missing_spec",
      message: `${missingSpec.length}개 제품의 규격 정보가 누락되었습니다.`,
    });
  }

  let compareMode: CompareModeType;
  if (hasMixedCategory) {
    compareMode = "mixed_blocked";
  } else if (hasUnknownCategory) {
    compareMode = "alternative_review";
  } else {
    compareMode = "direct_compare";
  }

  let recommendedNextAction: string;
  if (blockingIssues.length > 0) {
    recommendedNextAction = "같은 카테고리 제품을 다시 선택하거나 견적 후보 검토로 넘기세요.";
  } else if (warnings.length > 0) {
    recommendedNextAction = `주의 ${warnings.length}건 확인 후 비교를 진행하세요.`;
  } else {
    recommendedNextAction = "직접 비교가 가능합니다.";
  }

  return {
    isComparable: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    compareMode,
    recommendedNextAction,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Difference Summary (shown before raw matrix)
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareDifferenceItem {
  dimension: string;
  summary: string;
  advantageProductId: string | null;
  severity: "none" | "info" | "notable" | "critical";
}

export interface CompareDifferenceSummary {
  items: CompareDifferenceItem[];
  overallRecommendation: string;
  unresolved: string[];
  quoteNeeded: string[];
}

export function buildCompareDifferenceSummary(
  candidates: CompareCandidate[]
): CompareDifferenceSummary {
  const items: CompareDifferenceItem[] = [];
  const unresolved: string[] = [];
  const quoteNeeded: string[] = [];

  if (candidates.length < 2) {
    return { items: [], overallRecommendation: "비교 대상이 부족합니다.", unresolved: [], quoteNeeded: [] };
  }

  // Price comparison
  const priced = candidates.filter(c => c.unitPriceKRW && c.unitPriceKRW > 0);
  if (priced.length >= 2) {
    const sorted = [...priced].sort((a, b) => (a.unitPriceKRW ?? 0) - (b.unitPriceKRW ?? 0));
    const cheapest = sorted[0];
    const priciest = sorted[sorted.length - 1];
    const diff = ((priciest.unitPriceKRW ?? 0) - (cheapest.unitPriceKRW ?? 0));
    const pctDiff = (cheapest.unitPriceKRW ?? 1) > 0 ? Math.round((diff / (cheapest.unitPriceKRW ?? 1)) * 100) : 0;
    items.push({
      dimension: "가격",
      summary: pctDiff > 5
        ? `${cheapest.productName}이(가) ${pctDiff}% 저렴`
        : "가격 차이 미미",
      advantageProductId: pctDiff > 5 ? cheapest.productId : null,
      severity: pctDiff > 20 ? "notable" : pctDiff > 5 ? "info" : "none",
    });
  } else {
    const noPriceNames = candidates.filter(c => !c.unitPriceKRW || c.unitPriceKRW <= 0).map(c => c.productName);
    quoteNeeded.push(...noPriceNames);
    items.push({
      dimension: "가격",
      summary: "견적 필요 품목이 있어 가격 비교 불가",
      advantageProductId: null,
      severity: "critical",
    });
  }

  // Lead time comparison
  const leaded = candidates.filter(c => c.leadTimeDays != null && c.leadTimeDays > 0);
  if (leaded.length >= 2) {
    const sorted = [...leaded].sort((a, b) => (a.leadTimeDays ?? 0) - (b.leadTimeDays ?? 0));
    const fastest = sorted[0];
    const slowest = sorted[sorted.length - 1];
    const daysDiff = (slowest.leadTimeDays ?? 0) - (fastest.leadTimeDays ?? 0);
    items.push({
      dimension: "납기",
      summary: daysDiff > 0
        ? `${fastest.productName}이(가) ${daysDiff}일 빠름`
        : "납기 동일",
      advantageProductId: daysDiff > 0 ? fastest.productId : null,
      severity: daysDiff > 5 ? "notable" : daysDiff > 0 ? "info" : "none",
    });
  } else {
    unresolved.push("납기 정보 부족");
  }

  // Brand diversity
  const brands = [...new Set(candidates.map(c => c.brand).filter(Boolean))];
  if (brands.length > 1) {
    items.push({
      dimension: "브랜드",
      summary: `${brands.length}개 브랜드 비교`,
      advantageProductId: null,
      severity: "info",
    });
  }

  // Missing spec
  const missingSpec = candidates.filter(c => !c.specification);
  if (missingSpec.length > 0) {
    unresolved.push(`규격 미확인 ${missingSpec.length}건`);
    items.push({
      dimension: "규격",
      summary: "일부 규격 정보 확인 필요",
      advantageProductId: null,
      severity: "notable",
    });
  }

  // Overall recommendation
  let overallRecommendation: string;
  const notable = items.filter(i => i.severity === "notable" || i.severity === "critical");
  if (notable.length > 0) {
    overallRecommendation = `주요 차이 ${notable.length}건 — 핵심 항목 비교 후 shortlist 결정`;
  } else if (items.length > 0) {
    overallRecommendation = "차이가 작아 추가 정보로 판단 필요";
  } else {
    overallRecommendation = "비교 데이터 부족";
  }

  return { items, overallRecommendation, unresolved, quoteNeeded };
}

// ══════════════════════════════════════════════════════════════════════════════
// Compare Decision Snapshot
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareDecisionSnapshot {
  snapshotId: string;
  compareCandidateIds: string[];
  compareBasisSummary: string;
  differenceSummary: CompareDifferenceSummary;
  shortlistIds: string[];
  excludedIds: string[];
  heldIds: string[];
  requestCandidateIds: string[];
  decisionRationale: string;
  decidedAt: string;
  decidedBy: string | null;
}

let _cds = 0;
function cdsUid(): string { return `cds_${Date.now()}_${++_cds}`; }

export interface RecordCompareDecisionInput {
  shortlistIds: string[];
  excludedIds: string[];
  heldIds: string[];
  requestCandidateIds: string[];
  decisionReasonSummary: string;
  decidedBy?: string | null;
}

export interface RecordCompareDecisionResult {
  success: boolean;
  snapshot: CompareDecisionSnapshot | null;
  state: CompareReviewState;
  reason: string | null;
}

export function recordCompareDecision(
  state: CompareReviewState,
  differenceSummary: CompareDifferenceSummary,
  input: RecordCompareDecisionInput
): RecordCompareDecisionResult {
  // Guard: must be in review
  if (state.compareReviewStatus !== "compare_review_open") {
    return {
      success: false,
      snapshot: null,
      state,
      reason: "비교 검토 중에만 결과를 저장할 수 있습니다.",
    };
  }

  // Guard: shortlist must not be empty
  if (input.shortlistIds.length === 0 && input.requestCandidateIds.length === 0) {
    return {
      success: false,
      snapshot: null,
      state,
      reason: "Shortlist 또는 견적 후보가 최소 1개 이상이어야 합니다.",
    };
  }

  const now = new Date().toISOString();

  const snapshot: CompareDecisionSnapshot = {
    snapshotId: cdsUid(),
    compareCandidateIds: state.compareCandidateIds,
    compareBasisSummary: `${state.compareCandidates.length}개 후보 비교`,
    differenceSummary,
    shortlistIds: input.shortlistIds,
    excludedIds: input.excludedIds,
    heldIds: input.heldIds,
    requestCandidateIds: input.requestCandidateIds,
    decisionRationale: input.decisionReasonSummary,
    decidedAt: now,
    decidedBy: input.decidedBy ?? null,
  };

  const updatedState: CompareReviewState = {
    ...state,
    compareReviewStatus: "compare_shortlist_recorded",
    compareSubstatus: input.requestCandidateIds.length > 0 ? "ready_for_request_candidate" : "shortlist_pending",
    compareShortlistIds: input.shortlistIds,
    compareExcludedIds: input.excludedIds,
    compareHeldIds: input.heldIds,
    requestCandidateIds: input.requestCandidateIds,
    compareDecisionSummary: input.decisionReasonSummary,
    compareDecisionSnapshotId: snapshot.snapshotId,
  };

  return {
    success: true,
    snapshot,
    state: updatedState,
    reason: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Candidate Handoff from Compare
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestCandidateHandoff {
  handoffId: string;
  compareDecisionSnapshotId: string;
  shortlistedItemIds: string[];
  excludedItemIds: string[];
  requestCandidateIds: string[];
  compareRationaleSummary: string;
  unresolvedInfoItems: string[];
  nextRequestActionSeed: string;
  preparedAt: string;
}

let _rch = 0;
function rchUid(): string { return `rch_${Date.now()}_${++_rch}`; }

export function buildRequestCandidateHandoffFromCompare(
  snapshot: CompareDecisionSnapshot
): RequestCandidateHandoff {
  return {
    handoffId: rchUid(),
    compareDecisionSnapshotId: snapshot.snapshotId,
    shortlistedItemIds: snapshot.shortlistIds,
    excludedItemIds: snapshot.excludedIds,
    requestCandidateIds: snapshot.requestCandidateIds,
    compareRationaleSummary: snapshot.decisionRationale,
    unresolvedInfoItems: snapshot.differenceSummary.unresolved,
    nextRequestActionSeed: snapshot.requestCandidateIds.length > 0
      ? "견적 요청서 작성 가능"
      : "Shortlist 확정 후 견적 후보 반영",
    preparedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Compare Review Workbench Model (center + rail + dock)
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareReviewWorkbenchModel {
  state: CompareReviewState;
  categoryGate: CompareCategoryGateResult;
  differenceSummary: CompareDifferenceSummary;

  isCompareReviewVisible: boolean;

  // ── Header ──
  reviewBadge: string;
  reviewColor: "slate" | "amber" | "emerald" | "red" | "blue";

  // ── Dock CTAs ──
  primaryAction: CompareReviewDockAction;
  secondaryActions: CompareReviewDockAction[];

  // ── Rail checklist ──
  checklistItems: CompareReviewChecklistItem[];
}

export interface CompareReviewDockAction {
  id: string;
  label: string;
  enabled: boolean;
  reason: string | null;
}

export interface CompareReviewChecklistItem {
  label: string;
  status: "done" | "pending" | "blocked";
}

export function buildCompareReviewWorkbenchModel(input: {
  state: CompareReviewState;
  categoryGate: CompareCategoryGateResult;
  differenceSummary: CompareDifferenceSummary;
}): CompareReviewWorkbenchModel {
  const { state, categoryGate, differenceSummary } = input;

  const isVisible = state.compareCandidateIds.length >= 2;

  if (!isVisible) {
    return {
      state,
      categoryGate,
      differenceSummary,
      isCompareReviewVisible: false,
      reviewBadge: "—",
      reviewColor: "slate",
      primaryAction: { id: "noop", label: "—", enabled: false, reason: null },
      secondaryActions: [],
      checklistItems: [],
    };
  }

  // Badge
  let reviewBadge: string;
  let reviewColor: CompareReviewWorkbenchModel["reviewColor"];
  switch (state.compareSubstatus) {
    case "awaiting_compare_basis":
      reviewBadge = "비교 기준 대기";
      reviewColor = "slate";
      break;
    case "difference_review_active":
      reviewBadge = "차이 검토 중";
      reviewColor = "blue";
      break;
    case "shortlist_pending":
      reviewBadge = "Shortlist 대기";
      reviewColor = "amber";
      break;
    case "compare_blocked":
      reviewBadge = "비교 차단";
      reviewColor = "red";
      break;
    case "ready_for_request_candidate":
      reviewBadge = "견적 후보 반영 가능";
      reviewColor = "emerald";
      break;
  }

  // Checklist
  const hasDecision = !!state.compareDecisionSnapshotId;
  const hasShortlist = state.compareShortlistIds.length > 0;
  const hasRequestCandidates = state.requestCandidateIds.length > 0;

  const checklist: CompareReviewChecklistItem[] = [
    {
      label: "카테고리 확인",
      status: categoryGate.isComparable ? "done" : "blocked",
    },
    {
      label: "차이 검토",
      status: state.compareReviewStatus !== "compare_ready" ? "done" : "pending",
    },
    {
      label: "Shortlist 결정",
      status: hasShortlist ? "done" : "pending",
    },
    {
      label: "비교 결과 저장",
      status: hasDecision ? "done" : "pending",
    },
    {
      label: "견적 후보 반영",
      status: hasRequestCandidates ? "done" : "pending",
    },
  ];

  // Dock
  let primaryAction: CompareReviewDockAction;
  if (!categoryGate.isComparable) {
    primaryAction = {
      id: "reselect_candidates",
      label: "비교 구성 다시 선택",
      enabled: true,
      reason: null,
    };
  } else if (!hasDecision) {
    primaryAction = {
      id: "save_compare_result",
      label: "비교 결과 저장",
      enabled: hasShortlist || state.compareReviewStatus === "compare_review_open",
      reason: !hasShortlist ? "Shortlist를 먼저 결정하세요" : null,
    };
  } else if (!hasRequestCandidates) {
    primaryAction = {
      id: "reflect_request_candidates",
      label: "견적 후보로 반영",
      enabled: hasShortlist,
      reason: !hasShortlist ? "Shortlist가 비어있습니다" : null,
    };
  } else {
    primaryAction = {
      id: "close_compare",
      label: "비교 종료",
      enabled: true,
      reason: null,
    };
  }

  const secondaryActions: CompareReviewDockAction[] = [];

  if (hasDecision && !hasRequestCandidates) {
    secondaryActions.push({
      id: "close_compare",
      label: "비교 종료",
      enabled: true,
      reason: null,
    });
  }

  if (differenceSummary.unresolved.length > 0) {
    secondaryActions.push({
      id: "check_missing_info",
      label: `누락 정보 ${differenceSummary.unresolved.length}건`,
      enabled: true,
      reason: null,
    });
  }

  return {
    state,
    categoryGate,
    differenceSummary,
    isCompareReviewVisible: true,
    reviewBadge,
    reviewColor,
    primaryAction,
    secondaryActions,
    checklistItems: checklist,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Open Compare Review (state transition)
// ══════════════════════════════════════════════════════════════════════════════

export function openCompareReview(state: CompareReviewState): CompareReviewState {
  if (state.compareReviewStatus !== "compare_ready") return state;
  return {
    ...state,
    compareReviewStatus: "compare_review_open",
    compareSubstatus: "difference_review_active",
    compareOpenedAt: new Date().toISOString(),
    compareSelectionSnapshotId: `css_${Date.now()}`,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Update Shortlist (during review)
// ══════════════════════════════════════════════════════════════════════════════

export function updateCompareShortlist(
  state: CompareReviewState,
  action: "shortlist" | "exclude" | "hold",
  productId: string
): CompareReviewState {
  const shortlist = state.compareShortlistIds.filter(id => id !== productId);
  const excluded = state.compareExcludedIds.filter(id => id !== productId);
  const held = state.compareHeldIds.filter(id => id !== productId);

  switch (action) {
    case "shortlist":
      shortlist.push(productId);
      break;
    case "exclude":
      excluded.push(productId);
      break;
    case "hold":
      held.push(productId);
      break;
  }

  return {
    ...state,
    compareShortlistIds: shortlist,
    compareExcludedIds: excluded,
    compareHeldIds: held,
    compareSubstatus: shortlist.length > 0 ? "shortlist_pending" : "difference_review_active",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Compare Review Activity Events
// ══════════════════════════════════════════════════════════════════════════════

export type CompareReviewActivityType =
  | "compare_review_opened"
  | "strategy_option_applied"
  | "shortlist_updated"
  | "compare_decision_saved"
  | "request_candidate_prepared"
  | "compare_review_closed";

export interface CompareReviewActivity {
  type: CompareReviewActivityType;
  at: string;
  actorId: string | null;
  summary: string;
  snapshotId: string | null;
}

export function createCompareReviewActivity(input: {
  type: CompareReviewActivityType;
  actorId?: string;
  summary: string;
  snapshotId?: string;
}): CompareReviewActivity {
  return {
    type: input.type,
    at: new Date().toISOString(),
    actorId: input.actorId ?? null,
    summary: input.summary,
    snapshotId: input.snapshotId ?? null,
  };
}
