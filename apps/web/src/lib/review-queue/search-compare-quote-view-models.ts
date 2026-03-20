/**
 * Search → Compare → Quote (SCQ) P0 흐름 ViewModel
 *
 * 검색 결과 카드, 비교 워크스페이스, 견적 빌더, 제출 결과 등
 * UI 레이어에서 사용하는 뷰모델 타입과 헬퍼 함수를 정의한다.
 */

import type {
  SearchMatchTaxonomy,
  SearchIntentType,
  SearchIntent,
  CompareAxis,
  CompareSummary,
  CompareEligibility,
  QuoteCarryoverContext,
  QuoteLineItem,
} from "./search-compare-quote-contract";

import {
  SEARCH_TAXONOMY_DESCRIPTIONS,
  COMPARE_RULES,
  QUOTE_VALIDATION_RULES,
} from "./search-compare-quote-contract";

// ═══════════════════════════════════════════════════
// 1. Search Result ViewModel
// ═══════════════════════════════════════════════════

/** 검색 결과 단일 카드 뷰모델 */
export interface SearchResultViewModel {
  /** 제품 ID */
  productId: string;
  /** 제품명 */
  productName: string;
  /** 제조사 */
  manufacturer: string;
  /** 카탈로그 번호 */
  catalogNumber: string;
  /** 매칭 분류 */
  taxonomy: SearchMatchTaxonomy;
  /** 분류 라벨 (한국어, e.g. "정확 일치") */
  taxonomyLabel: string;
  /** 분류 톤 (UI 색상 결정용) */
  taxonomyTone: string;
  /** 매칭 사유 (한국어) */
  matchReason: string;
  /** 매칭 하이라이트 */
  highlights: { field: string; matched: string }[];
  /** 스펙 요약 (한국어, e.g. "500mL · ACS grade · 순도 99.5%") */
  specSummary: string;
  /** 보유 문서 뱃지 (e.g. ["SDS", "COA"]) */
  documentBadges: string[];
  /** 재고 상태 라벨 (한국어, e.g. "재고 있음 (3개)") */
  inventoryLabel?: string;
  /** 납기 라벨 (한국어, e.g. "납기 약 5일") */
  leadTimeLabel?: string;
  /** 가격 힌트 */
  priceHint?: string;
  /** 가능한 액션 */
  actions: {
    canCompare: boolean;
    canAddToQuote: boolean;
    canViewDetail: boolean;
  };
}

// ═══════════════════════════════════════════════════
// 2. Search Results Page ViewModel
// ═══════════════════════════════════════════════════

/** 검색 결과 페이지 전체 뷰모델 */
export interface SearchResultsPageViewModel {
  /** 검색 쿼리 원문 */
  query: string;
  /** 의도 라벨 (한국어, e.g. "시약명 검색") */
  intentLabel: string;
  /** 적용된 필터 요약 (한국어) */
  appliedFiltersLabel: string;
  /** 전체 결과 수 */
  totalCount: number;
  /** 정확 일치 수 */
  exactCount: number;
  /** 유사 일치 수 */
  nearCount: number;
  /** 대체 가능 수 */
  substituteCount: number;
  /** 결과 목록 */
  results: SearchResultViewModel[];
  /** AI 해석 한 줄 (한국어, e.g. "Ethanol ACS grade 관련 제품 12건을 찾았습니다") */
  aiInterpretation?: string;
  /** 비교 바스켓 품목 수 */
  compareBasketCount: number;
  /** 견적 바스켓 품목 수 */
  quoteBasketCount: number;
  /** 결과 없음 여부 */
  isEmpty: boolean;
  /** 정확 일치 없음 여부 */
  noExactMatch: boolean;
}

// ═══════════════════════════════════════════════════
// 3. Compare Item ViewModel
// ═══════════════════════════════════════════════════

/** 비교 테이블 단일 컬럼 뷰모델 */
export interface CompareItemViewModel {
  /** 제품 ID */
  productId: string;
  /** 제품명 */
  productName: string;
  /** 제조사 */
  manufacturer: string;
  /** 카탈로그 번호 */
  catalogNumber: string;
  /** 매칭 분류 */
  taxonomy: SearchMatchTaxonomy;
  /** 비교 축별 스펙 값 */
  specs: {
    axis: CompareAxis;
    label: string;
    value: string;
    tone?: "advantage" | "disadvantage" | "neutral";
  }[];
  /** 보유 문서 뱃지 */
  documentBadges: string[];
  /** 가격 힌트 */
  priceHint?: string;
  /** 납기 라벨 (한국어) */
  leadTimeLabel?: string;
  /** 재고 라벨 (한국어) */
  inventoryLabel?: string;
  /** 선택 상태 */
  isSelected: boolean;
  /** 제외 상태 */
  isExcluded: boolean;
  /** 제외 사유 */
  excludeReason?: string;
}

// ═══════════════════════════════════════════════════
// 4. Compare Workspace ViewModel
// ═══════════════════════════════════════════════════

/** 비교 워크스페이스 전체 뷰모델 */
export interface CompareWorkspaceViewModel {
  /** 비교 유형 */
  comparisonType: "direct" | "substitute" | "mixed";
  /** 비교 유형 라벨 (한국어) */
  comparisonTypeLabel: string;
  /** 혼합 비교 경고 (한국어) */
  mixedWarning?: string;
  /** 비교 대상 품목 */
  items: CompareItemViewModel[];
  /** 핵심 차이점 */
  keyDifferences: CompareSummary["keyDifferences"];
  /** AI 추천 (한국어) */
  recommendation?: string;
  /** 대체품 참고 (한국어) */
  substituteNote?: string;
  /** 최종 선택 */
  finalSelection?: { productId: string; reason?: string };
  /** 견적 단계 진행 가능 여부 */
  canProceedToQuote: boolean;
  /** 진행 불가 사유 */
  proceedBlockedReason?: string;
}

// ═══════════════════════════════════════════════════
// 5. Quote Line Item ViewModel
// ═══════════════════════════════════════════════════

/** 견적 품목 단일 뷰모델 */
export interface QuoteLineItemViewModel {
  /** 제품 ID */
  productId: string;
  /** 제품명 */
  productName: string;
  /** 제조사 */
  manufacturer: string;
  /** 카탈로그 번호 */
  catalogNumber: string;
  /** 수량 */
  quantity: number;
  /** 단위 */
  unit: string;
  /** 수량 라벨 (한국어, e.g. "500 mL × 2") */
  quantityLabel: string;
  /** 용도 메모 */
  purposeNote?: string;
  /** 필요 문서 */
  requiredDocuments: string[];
  /** 납기 라벨 (한국어) */
  leadTimeLabel?: string;
  /** 예산 힌트 */
  budgetHint?: {
    label: string;
    tone: "normal" | "warning" | "danger";
  };
  /** 검증 이슈 목록 */
  validationIssues: { message: string; severity: "error" | "warning" }[];
  /** 이월 맥락 요약 (한국어, e.g. "검색: Ethanol ACS · 비교: 3개 중 선택 · 대체품 검토 완료") */
  carryoverSummary: string;
}

// ═══════════════════════════════════════════════════
// 6. Quote Builder ViewModel
// ═══════════════════════════════════════════════════

/** 견적 빌더 전체 뷰모델 */
export interface QuoteBuilderViewModel {
  /** 견적 품목 목록 */
  lineItems: QuoteLineItemViewModel[];
  /** 전체 품목 수 */
  totalItemCount: number;
  /** 오류 존재 여부 */
  hasErrors: boolean;
  /** 경고 존재 여부 */
  hasWarnings: boolean;
  /** 경고 메시지 목록 */
  warningMessages: string[];
  /** 오류 메시지 목록 */
  errorMessages: string[];
  /** 제출 가능 여부 */
  canSubmit: boolean;
  /** 제출 불가 사유 */
  submitBlockedReason?: string;
  /** 예상 총액 라벨 */
  estimatedTotalLabel?: string;
  /** 프로젝트 맥락 */
  projectContext?: { projectName?: string; protocolRef?: string };
}

// ═══════════════════════════════════════════════════
// 7. Quote Submission Result ViewModel
// ═══════════════════════════════════════════════════

/** 견적 제출 결과 뷰모델 */
export interface QuoteSubmissionResultViewModel {
  /** 성공 여부 */
  success: boolean;
  /** 생성 건수 라벨 (한국어, e.g. "3건의 견적 요청이 생성되었습니다") */
  createdCountLabel: string;
  /** 차단 건수 라벨 (한국어, e.g. "1건은 예산 초과로 차단되었습니다") */
  blockedCountLabel?: string;
  /** 차단된 품목 상세 */
  blockedItems: { productName: string; reason: string }[];
  /** 다음 액션 라벨 (한국어) */
  nextActionLabel: string;
  /** 다음 액션 경로 */
  nextActionHref: string;
  /** 맥락 복원 라벨 (한국어) */
  viewSourceContextLabel: string;
}

// ═══════════════════════════════════════════════════
// 8. Helper: classifySearchResult
// ═══════════════════════════════════════════════════

/**
 * 검색 결과를 분류한다.
 *
 * - exact: 카탈로그 번호 또는 CAS 번호가 정확히 일치
 * - near: 이름 부분 일치 + 동일 제조사
 * - substitute: 같은 카테고리/CAS 번호, 다른 제조사
 * - unrelated: 그 외 전부
 */
export function classifySearchResult(
  product: {
    name: string;
    catalogNumber?: string;
    casNumber?: string;
    manufacturer?: string;
  },
  query: string,
  intentType: SearchIntentType,
): SearchMatchTaxonomy {
  const q = query.toLowerCase().trim();

  // 카탈로그 번호 정확 일치
  if (
    intentType === "catalog_number" &&
    product.catalogNumber &&
    product.catalogNumber.toLowerCase() === q
  ) {
    return "exact";
  }

  // CAS 번호 정확 일치
  if (
    intentType === "cas_number" &&
    product.casNumber &&
    product.casNumber.toLowerCase() === q
  ) {
    return "exact";
  }

  // 이름 정확 일치 (시약명·장비명 검색)
  if (
    (intentType === "reagent_name" || intentType === "equipment_name") &&
    product.name.toLowerCase() === q
  ) {
    return "exact";
  }

  // 이름 부분 일치 + 동일 제조사 → near
  const nameMatch = product.name.toLowerCase().includes(q);
  if (nameMatch && product.manufacturer) {
    return "near";
  }

  // CAS 번호가 같지만 다른 제조사 → substitute
  if (product.casNumber && product.casNumber.toLowerCase() === q) {
    return "substitute";
  }

  // 이름 부분 일치만 있으면 substitute
  if (nameMatch) {
    return "substitute";
  }

  return "unrelated";
}

// ═══════════════════════════════════════════════════
// 9. Helper: checkCompareEligibility
// ═══════════════════════════════════════════════════

/**
 * 비교 대상 자격을 판정한다.
 *
 * - 2개 이상, maxCompareItems 이하여야 비교 가능
 * - 카테고리가 모두 같으면 동일 카테고리 비교, 다르면 대체품 비교로 분류
 */
export function checkCompareEligibility(
  items: {
    productId: string;
    category?: string;
    taxonomy: SearchMatchTaxonomy;
  }[],
): CompareEligibility {
  if (items.length < 2) {
    return {
      isEligible: false,
      reason: "비교하려면 2개 이상의 제품이 필요합니다",
      isSameCategory: false,
      isSubstituteComparison: false,
    };
  }

  if (items.length > COMPARE_RULES.maxCompareItems) {
    return {
      isEligible: false,
      reason: `비교 대상은 최대 ${COMPARE_RULES.maxCompareItems}개까지 선택할 수 있습니다`,
      isSameCategory: false,
      isSubstituteComparison: false,
    };
  }

  const categories = items
    .map((item) => item.category)
    .filter((c): c is string => c != null);
  const uniqueCategories = new Set(categories);
  const isSameCategory =
    uniqueCategories.size <= 1 && categories.length === items.length;

  const hasSubstitute = items.some(
    (item) => item.taxonomy === "substitute",
  );
  const isSubstituteComparison = !isSameCategory || hasSubstitute;

  return {
    isEligible: true,
    isSameCategory,
    isSubstituteComparison,
  };
}

// ═══════════════════════════════════════════════════
// 10. Helper: buildCarryoverSummary
// ═══════════════════════════════════════════════════

/** 검색·비교 이월 맥락의 표시용 요약을 생성한다. */
const PREFERENCE_LABELS: Record<
  NonNullable<QuoteCarryoverContext["alternativePreference"]>,
  string
> = {
  cheapest: "최저가",
  fastest_delivery: "최단 납기",
  highest_purity: "최고 순도",
  preferred_vendor: "선호 공급사",
  best_document_coverage: "문서 완비",
};

/**
 * 이월 맥락을 한국어 한 줄 요약으로 변환한다.
 *
 * @example
 * // "검색: Ethanol ACS · 비교: 3개 중 선택 · 선호: 최저가"
 */
export function buildCarryoverSummary(
  context: QuoteCarryoverContext,
): string {
  const parts: string[] = [];

  parts.push(`검색: ${context.searchQuery}`);

  if (context.compareRationale) {
    parts.push(`비교: ${context.compareRationale}`);
  }

  if (context.alternativePreference) {
    const label = PREFERENCE_LABELS[context.alternativePreference];
    parts.push(`선호: ${label}`);
  }

  if (context.originalProductRef) {
    parts.push(`기존 제품: ${context.originalProductRef}`);
  }

  if (context.projectContext?.projectName) {
    parts.push(`프로젝트: ${context.projectContext.projectName}`);
  }

  return parts.join(" · ");
}

// ═══════════════════════════════════════════════════
// 11. Helper: validateQuoteLineItem
// ═══════════════════════════════════════════════════

/**
 * 견적 품목을 검증 규칙에 따라 검사한다.
 *
 * @returns 검증 실패 항목 목록 (빈 배열이면 통과)
 */
export function validateQuoteLineItem(
  item: QuoteLineItem,
): { field: string; message: string; severity: "error" | "warning" }[] {
  const issues: {
    field: string;
    message: string;
    severity: "error" | "warning";
  }[] = [];

  for (const rule of QUOTE_VALIDATION_RULES) {
    switch (rule.ruleId) {
      case "quantity_required":
        if (item.quantity == null || item.quantity === undefined) {
          issues.push({
            field: rule.field,
            message: rule.message,
            severity: rule.severity,
          });
        }
        break;

      case "quantity_min":
        if (item.quantity != null && item.quantity < 1) {
          issues.push({
            field: rule.field,
            message: rule.message,
            severity: rule.severity,
          });
        }
        break;

      case "unit_required":
        if (!item.unit || item.unit.trim() === "") {
          issues.push({
            field: rule.field,
            message: rule.message,
            severity: rule.severity,
          });
        }
        break;

      case "document_sds_recommended":
        if (
          !item.requiredDocuments ||
          !item.requiredDocuments.includes("SDS")
        ) {
          issues.push({
            field: rule.field,
            message: rule.message,
            severity: rule.severity,
          });
        }
        break;

      case "lead_time_too_short":
        if (
          item.requestedLeadTimeDays != null &&
          item.requestedLeadTimeDays < 3
        ) {
          issues.push({
            field: rule.field,
            message: rule.message,
            severity: rule.severity,
          });
        }
        break;

      case "budget_exceeded":
        if (item.budgetHint?.overBudgetWarning) {
          issues.push({
            field: rule.field,
            message: rule.message,
            severity: rule.severity,
          });
        }
        break;

      case "purpose_note_recommended":
        if (!item.purposeNote || item.purposeNote.trim() === "") {
          issues.push({
            field: rule.field,
            message: rule.message,
            severity: rule.severity,
          });
        }
        break;
    }
  }

  return issues;
}
