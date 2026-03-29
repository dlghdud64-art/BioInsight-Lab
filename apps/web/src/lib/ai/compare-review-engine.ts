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

// ══════════════════════════════════════════════════════════════════════════════
// Candidate Classification — direct / reference / blocked
// ══════════════════════════════════════════════════════════════════════════════

export type CandidateClass = "direct" | "reference" | "blocked";

export interface ClassifiedCandidate {
  id: string;
  name: string;
  brand: string;
  candidateClass: CandidateClass;
  /** AI가 생성한 1줄 판단 이유 */
  classReason: string;
  /** delta 한 줄 — "₩12,000 저렴" 또는 "3일 빠름" 등 */
  deltaOneLiner: string;
  /** 후보 위험/주의 사항 (없으면 빈 문자열) */
  riskNote: string;
  /** 추천 다음 행동 */
  suggestedAction: "shortlist" | "hold" | "exclude";
}

/**
 * 후보군을 direct / reference / blocked로 분류.
 *
 * 분류 규칙:
 * - blocked: category 불일치가 심하거나 핵심 데이터(가격+납기 모두) 없음
 * - reference: grade/spec 차이 또는 단일 핵심 데이터 없음
 * - direct: 나머지 (직접 비교 가능)
 *
 * 이 함수는 AI 판단을 대신하지 않고, **판단면을 정리**합니다.
 */
export function classifyCandidatesForReview(
  candidates: CompareCandidateInfo[],
  categoryResult: CompareCategoryResult,
  differenceSummary: CompareDifferenceSummary,
): ClassifiedCandidate[] {
  if (candidates.length < 2) return [];

  // 기준 후보 (첫 번째)
  const source = candidates[0];

  return candidates.map((c) => {
    const isSource = c.id === source.id;
    const missingPrice = !c.priceKRW || c.priceKRW <= 0;
    const missingLead = !c.leadTimeDays || c.leadTimeDays <= 0;
    const missingBoth = missingPrice && missingLead;
    const categoryDiff = source.category && c.category
      && source.category.toLowerCase() !== c.category.toLowerCase();

    // ── Classification ──
    let candidateClass: CandidateClass = "direct";
    let classReason = "";
    let riskNote = "";
    let suggestedAction: "shortlist" | "hold" | "exclude" = "shortlist";

    if (categoryDiff && categoryResult.compareMode === "blocked") {
      candidateClass = "blocked";
      classReason = "카테고리 불일치 — 비교 불가";
      riskNote = "카테고리가 다른 제품입니다";
      suggestedAction = "exclude";
    } else if (missingBoth) {
      candidateClass = "blocked";
      classReason = "가격·납기 정보 모두 없음";
      riskNote = "견적 확인 후 비교 가능";
      suggestedAction = "hold";
    } else if (categoryDiff) {
      candidateClass = "reference";
      classReason = "카테고리 차이 — 참고 비교만 가능";
      riskNote = "동일 규격 비교 시 주의";
      suggestedAction = "hold";
    } else if (missingPrice || missingLead) {
      candidateClass = "reference";
      classReason = missingPrice ? "가격 미확인 — 참고 후보" : "납기 미확인 — 참고 후보";
      riskNote = "누락 정보 확인 후 판단 필요";
      suggestedAction = "hold";
    } else {
      candidateClass = "direct";
      classReason = "직접 비교 가능";
      suggestedAction = "shortlist";
    }

    // ── Delta one-liner ──
    let deltaOneLiner = "";
    if (!isSource && !missingPrice && source.priceKRW > 0) {
      const priceDiff = source.priceKRW - c.priceKRW;
      if (priceDiff > 0) {
        deltaOneLiner = `₩${priceDiff.toLocaleString("ko-KR")} 저렴`;
      } else if (priceDiff < 0) {
        deltaOneLiner = `₩${Math.abs(priceDiff).toLocaleString("ko-KR")} 비쌈`;
      }
    }
    if (!isSource && !missingLead && source.leadTimeDays > 0) {
      const leadDiff = source.leadTimeDays - c.leadTimeDays;
      if (leadDiff > 0) {
        deltaOneLiner += (deltaOneLiner ? " · " : "") + `${leadDiff}일 빠름`;
      } else if (leadDiff < 0) {
        deltaOneLiner += (deltaOneLiner ? " · " : "") + `${Math.abs(leadDiff)}일 느림`;
      }
    }
    if (isSource) {
      deltaOneLiner = "기준 후보";
      classReason = "비교 기준";
      candidateClass = "direct";
      suggestedAction = "shortlist";
    }

    return {
      id: c.id,
      name: c.name,
      brand: c.brand,
      candidateClass,
      classReason,
      deltaOneLiner,
      riskNote,
      suggestedAction,
    };
  });
}

/**
 * 상단 AI 판단 블록용 3줄 요약 생성.
 *
 * - 우선 검토: direct 중 delta 우위 후보
 * - 참고 후보: reference 후보 이유
 * - 제외·보류: blocked 후보 이유
 */
export function buildAiVerdictSummary(
  classified: ClassifiedCandidate[],
): { priorityLine: string; referenceLine: string; blockedLine: string } {
  const directCandidates = classified.filter((c) => c.candidateClass === "direct" && c.deltaOneLiner !== "기준 후보");
  const refs = classified.filter((c) => c.candidateClass === "reference");
  const blocked = classified.filter((c) => c.candidateClass === "blocked");

  // 우선 검토 라인
  let priorityLine = "";
  if (directCandidates.length > 0) {
    const best = directCandidates[0];
    priorityLine = `우선 검토: ${best.name} — ${best.deltaOneLiner || "동일 조건"}`;
  } else {
    priorityLine = "직접 비교 가능한 후보 없음 — 견적 확인 필요";
  }

  // 참고 후보 라인
  let referenceLine = "";
  if (refs.length > 0) {
    referenceLine = `참고 후보 ${refs.length}개: ${refs.map((r) => r.classReason).join(", ")}`;
  }

  // 제외·보류 라인
  let blockedLine = "";
  if (blocked.length > 0) {
    blockedLine = `제외·보류 ${blocked.length}개: ${blocked.map((b) => b.classReason).join(", ")}`;
  }

  return { priorityLine, referenceLine, blockedLine };
}
