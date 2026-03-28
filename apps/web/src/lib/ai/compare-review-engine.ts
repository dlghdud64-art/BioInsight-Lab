/**
 * Compare Review Engine — 비교 판단 상태 모델 + 카테고리 검증 + 차이 요약 + snapshot
 *
 * 고정 규칙:
 * 1. compare = selection state가 아니라 별도 운영 상태.
 * 2. mixed-category direct compare 차단 또는 warning-heavy.
 * 3. difference summary를 raw matrix보다 먼저 노출.
 * 4. shortlist / exclude / request candidate 반영을 같은 작업면에서.
 * 5. compare decision snapshot이 canonical source.
 * 6. preview와 actual selection truth 분리.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Compare Review Status
// ══════════════════════════════════════════════════════════════════════════════

export type CompareReviewStatus =
  | "compare_ready"
  | "compare_review_open"
  | "compare_shortlist_recorded";

export type CompareSubstatus =
  | "awaiting_compare_basis"
  | "difference_review_active"
  | "shortlist_pending"
  | "compare_blocked"
  | "ready_for_request_candidate";

// ══════════════════════════════════════════════════════════════════════════════
// Compare Review State
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareReviewState {
  compareReviewStatus: CompareReviewStatus;
  substatus: CompareSubstatus;
  compareOpenedAt: string | null;
  compareOpenedBy: "ai_apply" | "manual" | null;
  compareSelectionSnapshotId: string;
  compareCandidateIds: string[];
  compareCategoryStatus: CompareCategoryResult;
  compareShortlistIds: string[];
  compareExcludedIds: string[];
  compareHeldIds: string[];
  compareDecisionSummary: string | null;
  compareDecisionSnapshotId: string | null;
  aiCompositionSourceOptionId: string | null;
}

export function createInitialCompareReviewState(
  candidateIds: string[],
  categoryResult: CompareCategoryResult,
  openedBy: "ai_apply" | "manual",
  aiOptionId?: string | null,
): CompareReviewState {
  return {
    compareReviewStatus: "compare_review_open",
    substatus: categoryResult.isComparable ? "difference_review_active" : "compare_blocked",
    compareOpenedAt: new Date().toISOString(),
    compareOpenedBy: openedBy,
    compareSelectionSnapshotId: `snap_${Date.now().toString(36)}`,
    compareCandidateIds: candidateIds,
    compareCategoryStatus: categoryResult,
    compareShortlistIds: [],
    compareExcludedIds: [],
    compareHeldIds: [],
    compareDecisionSummary: null,
    compareDecisionSnapshotId: null,
    aiCompositionSourceOptionId: aiOptionId ?? null,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Category Validation
// ══════════════════════════════════════════════════════════════════════════════

export type CompareMode = "direct" | "mixed_warning" | "blocked";

export interface CompareCategoryResult {
  isComparable: boolean;
  blockingIssues: string[];
  warnings: string[];
  compareMode: CompareMode;
  recommendedNextAction: string;
}

export interface CompareCandidateInfo {
  id: string;
  name: string;
  brand: string;
  category?: string;
  catalogNumber?: string;
  spec?: string;
  priceKRW: number;
  leadTimeDays: number;
}

export function validateCompareCategoryIntegrity(
  candidates: CompareCandidateInfo[],
): CompareCategoryResult {
  if (candidates.length < 2) {
    return {
      isComparable: false,
      blockingIssues: ["비교 후보가 2개 미만입니다"],
      warnings: [],
      compareMode: "blocked",
      recommendedNextAction: "비교 후보를 추가하세요",
    };
  }

  const categories = candidates.map((c) => c.category?.toLowerCase().trim()).filter(Boolean);
  const uniqueCategories = [...new Set(categories)];
  const brands = [...new Set(candidates.map((c) => c.brand))];

  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  // Mixed category check
  if (uniqueCategories.length > 1) {
    warnings.push(`${uniqueCategories.length}개 카테고리가 혼합되어 있습니다`);
  }

  // Price data check
  const missingPrice = candidates.filter((c) => !c.priceKRW || c.priceKRW <= 0);
  if (missingPrice.length > 0) {
    warnings.push(`${missingPrice.length}개 제품의 가격 정보가 없습니다`);
  }

  // Lead time check
  const missingLead = candidates.filter((c) => !c.leadTimeDays || c.leadTimeDays <= 0);
  if (missingLead.length > 0) {
    warnings.push(`${missingLead.length}개 제품의 납기 정보가 없습니다`);
  }

  const isMixed = uniqueCategories.length > 1;
  const compareMode: CompareMode = blockingIssues.length > 0
    ? "blocked"
    : isMixed
      ? "mixed_warning"
      : "direct";

  return {
    isComparable: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    compareMode,
    recommendedNextAction: blockingIssues.length > 0
      ? "비교 후보를 다시 구성하세요"
      : isMixed
        ? "카테고리를 통일하거나 견적 후보로 전환하세요"
        : "차이를 검토하고 shortlist를 구성하세요",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Difference Summary
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareDifferenceSummary {
  priceAdvantage: DifferenceItem | null;
  leadTimeAdvantage: DifferenceItem | null;
  specFitNote: string;
  brandNote: string;
  missingInfoItems: string[];
  operationalRisk: string;
}

export interface DifferenceItem {
  label: string;
  advantageId: string;
  advantageName: string;
  delta: string;
}

export function buildCompareDifferenceSummary(
  candidates: CompareCandidateInfo[],
): CompareDifferenceSummary {
  const withPrice = candidates.filter((c) => c.priceKRW > 0);
  const withLead = candidates.filter((c) => c.leadTimeDays > 0);

  let priceAdvantage: DifferenceItem | null = null;
  if (withPrice.length >= 2) {
    const sorted = [...withPrice].sort((a, b) => a.priceKRW - b.priceKRW);
    const cheapest = sorted[0];
    const next = sorted[1];
    const diff = next.priceKRW - cheapest.priceKRW;
    const pct = Math.round((diff / next.priceKRW) * 100);
    priceAdvantage = {
      label: `${cheapest.brand || cheapest.name}이(가) ${pct}% 저렴`,
      advantageId: cheapest.id,
      advantageName: cheapest.name,
      delta: `₩${diff.toLocaleString("ko-KR")} 차이`,
    };
  }

  let leadTimeAdvantage: DifferenceItem | null = null;
  if (withLead.length >= 2) {
    const sorted = [...withLead].sort((a, b) => a.leadTimeDays - b.leadTimeDays);
    const fastest = sorted[0];
    const next = sorted[1];
    const diff = next.leadTimeDays - fastest.leadTimeDays;
    if (diff > 0) {
      leadTimeAdvantage = {
        label: `${fastest.brand || fastest.name}이(가) ${diff}일 빠름`,
        advantageId: fastest.id,
        advantageName: fastest.name,
        delta: `${diff}영업일 차이`,
      };
    }
  }

  const missingInfoItems: string[] = [];
  candidates.forEach((c) => {
    if (!c.priceKRW || c.priceKRW <= 0) missingInfoItems.push(`${c.name}: 가격 미확인`);
    if (!c.leadTimeDays || c.leadTimeDays <= 0) missingInfoItems.push(`${c.name}: 납기 미확인`);
    if (!c.spec) missingInfoItems.push(`${c.name}: 규격 미확인`);
  });

  const brands = [...new Set(candidates.map((c) => c.brand))];
  const brandNote = brands.length === 1 ? `동일 브랜드 (${brands[0]})` : `${brands.length}개 브랜드`;

  const specTexts = candidates.map((c) => c.spec?.toLowerCase().trim()).filter(Boolean);
  const specFitNote = specTexts.length === 0
    ? "규격 정보 없음"
    : [...new Set(specTexts)].length === 1
      ? "동일 규격"
      : "규격 차이 확인 필요";

  const operationalRisk = missingInfoItems.length >= 3
    ? "정보 누락이 많아 견적 확인 후 비교를 권장합니다"
    : missingInfoItems.length > 0
      ? "일부 정보 누락 — 견적 요청 시 확인 필요"
      : "비교 가능한 상태입니다";

  return { priceAdvantage, leadTimeAdvantage, specFitNote, brandNote, missingInfoItems, operationalRisk };
}

// ══════════════════════════════════════════════════════════════════════════════
// Compare Decision Recording
// ══════════════════════════════════════════════════════════════════════════════

export interface CompareDecisionPayload {
  shortlistIds: string[];
  excludedIds: string[];
  heldIds: string[];
  requestCandidateIds: string[];
  decisionReasonSummary: string;
}

export interface CompareDecisionSnapshot {
  id: string;
  compareCandidateIds: string[];
  compareBasisSummary: string;
  differenceSummary: CompareDifferenceSummary;
  shortlistIds: string[];
  excludedIds: string[];
  heldIds: string[];
  requestCandidateIds: string[];
  decisionRationale: string;
  decidedAt: string;
  decidedBy: string;
  aiCompositionProvenance: string | null;
  // ── AI activation provenance (Batch 2) ──
  aiActivationSnapshotId: string | null;
  aiDefaultOptionId: string | null;
  aiPreviewOptionIdAtDecision: string | null;
  openedFromAiCompareState: boolean;
  operatorOverrideFlag: boolean;
}

export function buildCompareDecisionSnapshot(
  state: CompareReviewState,
  differenceSummary: CompareDifferenceSummary,
  payload: CompareDecisionPayload,
  aiProvenance?: {
    aiDefaultOptionId?: string | null;
    aiPreviewOptionIdAtDecision?: string | null;
    operatorOverrideFlag?: boolean;
  },
): CompareDecisionSnapshot {
  const defaultAiId = aiProvenance?.aiDefaultOptionId ?? null;
  const previewAiId = aiProvenance?.aiPreviewOptionIdAtDecision ?? null;
  return {
    id: `cdec_${Date.now().toString(36)}`,
    compareCandidateIds: state.compareCandidateIds,
    compareBasisSummary: `${state.compareCandidateIds.length}개 후보 비교`,
    differenceSummary,
    shortlistIds: payload.shortlistIds,
    excludedIds: payload.excludedIds,
    heldIds: payload.heldIds,
    requestCandidateIds: payload.requestCandidateIds,
    decisionRationale: payload.decisionReasonSummary,
    decidedAt: new Date().toISOString(),
    decidedBy: "operator",
    aiCompositionProvenance: state.aiCompositionSourceOptionId,
    aiActivationSnapshotId: state.compareSelectionSnapshotId,
    aiDefaultOptionId: defaultAiId,
    aiPreviewOptionIdAtDecision: previewAiId,
    openedFromAiCompareState: state.compareOpenedBy === "ai_apply",
    operatorOverrideFlag: aiProvenance?.operatorOverrideFlag ?? false,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Request Candidate Handoff
// ══════════════════════════════════════════════════════════════════════════════

export interface RequestCandidateHandoff {
  compareDecisionSnapshotId: string;
  shortlistedItemIds: string[];
  excludedItemIds: string[];
  requestCandidateIds: string[];
  compareRationaleSummary: string;
  unresolvedInfoItems: string[];
  nextRequestActionSeed: string;
}

export function buildRequestCandidateHandoffFromCompare(
  snapshot: CompareDecisionSnapshot,
): RequestCandidateHandoff {
  return {
    compareDecisionSnapshotId: snapshot.id,
    shortlistedItemIds: snapshot.shortlistIds,
    excludedItemIds: snapshot.excludedIds,
    requestCandidateIds: snapshot.requestCandidateIds,
    compareRationaleSummary: snapshot.decisionRationale,
    unresolvedInfoItems: snapshot.differenceSummary.missingInfoItems,
    nextRequestActionSeed: snapshot.requestCandidateIds.length > 0
      ? "견적 요청 조립으로 이동"
      : "shortlist 후보를 견적 후보로 반영하세요",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Stale / Open Guard
// ══════════════════════════════════════════════════════════════════════════════

export function canOpenCompareReview(
  compareIds: string[],
): { canOpen: boolean; reason: string } {
  if (compareIds.length < 2) {
    return { canOpen: false, reason: "비교 후보 2개 이상 필요" };
  }
  return { canOpen: true, reason: "" };
}

export function isComparePreviewStale(
  snapshotCandidateIds: string[],
  currentCompareIds: string[],
): boolean {
  if (snapshotCandidateIds.length !== currentCompareIds.length) return true;
  const sorted1 = [...snapshotCandidateIds].sort();
  const sorted2 = [...currentCompareIds].sort();
  return sorted1.some((id, i) => id !== sorted2[i]);
}
