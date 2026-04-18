/**
 * Search → Compare → Quote (SCQ) P0 운영 흐름 중앙 계약
 *
 * 핵심 원칙:
 * - Search는 후보 압축(candidate compression)이다.
 * - Compare는 선택/제외 판단(selection & exclusion judgment)이다.
 * - Quote는 맥락을 유지한 요청 전환(context-carrying request conversion)이다.
 * - 단계 사이에서 흐름이 끊어져서는 안 된다.
 */

// ═══════════════════════════════════════════════════
// 1. SCQ Flow Stages
// ═══════════════════════════════════════════════════

/** SCQ 흐름의 단계. 모든 UI·이벤트·검증은 이 단계 순서를 따른다. */
export const SCQ_FLOW_STAGES = [
  "searchIntentCapture",
  "searchResultsInterpretation",
  "candidateSelection",
  "compareWorkspace",
  "quoteRequestBuilder",
  "quoteSubmission",
  "queueHandoff",
] as const;

export type ScqFlowStage = (typeof SCQ_FLOW_STAGES)[number];

// ═══════════════════════════════════════════════════
// 2. Search Taxonomy & Intent
// ═══════════════════════════════════════════════════

/** 검색 결과 분류 — 정확도 및 대체 가능성 기준 */
export type SearchMatchTaxonomy = "exact" | "near" | "substitute" | "unrelated";

/** 검색 의도 유형 — 사용자가 무엇을 찾고 있는지 분류 */
export type SearchIntentType =
  | "reagent_name"
  | "equipment_name"
  | "cas_number"
  | "manufacturer"
  | "catalog_number"
  | "category_browse"
  | "alternative_search"
  | "protocol_extraction";

/** 검색 의도 — 쿼리·의도 유형·필터·맥락을 구조화 */
export interface SearchIntent {
  /** 검색 쿼리 원문 */
  query: string;
  /** 의도 유형 */
  intentType: SearchIntentType;
  /** 적용된 필터 */
  filters: {
    manufacturer?: string;
    category?: string;
    gradeLevel?: string;
    documentRequired?: string[];
    budgetMax?: number;
    leadTimeDays?: number;
  };
  /** 검색 맥락 (프로젝트·프로토콜·기존 제품 참조) */
  context?: {
    projectName?: string;
    protocolRef?: string;
    previousProductRef?: string;
  };
}

// ═══════════════════════════════════════════════════
// 3. Search Result Classification
// ═══════════════════════════════════════════════════

/** 개별 검색 결과의 분류 정보 */
export interface SearchResultClassification {
  /** 제품 ID */
  productId: string;
  /** 매칭 분류 */
  taxonomy: SearchMatchTaxonomy;
  /** 매칭 신뢰도 (0–1) */
  matchConfidence: number;
  /** 매칭 사유 (한국어) */
  matchReason: string;
  /** 매칭된 필드·값 하이라이트 */
  highlights: { field: string; matched: string }[];
  /** 필수 문서 보유 여부 */
  hasRequiredDocuments: boolean;
  /** 재고 가용 여부 */
  inventoryAvailable: boolean;
  /** 예상 납기 (영업일) */
  estimatedLeadTimeDays?: number;
}

// ═══════════════════════════════════════════════════
// 4. Search Taxonomy Descriptions
// ═══════════════════════════════════════════════════

/** 검색 결과 분류별 라벨·설명·톤 */
export const SEARCH_TAXONOMY_DESCRIPTIONS: Record<
  SearchMatchTaxonomy,
  { label: string; description: string; tone: "success" | "info" | "warning" | "neutral" }
> = {
  exact: {
    label: "정확 일치",
    description: "검색 조건과 정확히 일치하는 결과입니다",
    tone: "success",
  },
  near: {
    label: "유사 일치",
    description: "이름, 규격, 제조사 등이 부분적으로 일치합니다",
    tone: "info",
  },
  substitute: {
    label: "대체 가능",
    description: "같은 용도로 사용 가능한 대체 제품입니다",
    tone: "warning",
  },
  unrelated: {
    label: "관련 낮음",
    description: "검색 조건과 직접적 관련이 낮은 결과입니다",
    tone: "neutral",
  },
} as const;

// ═══════════════════════════════════════════════════
// 5. Compare Rules & Types
// ═══════════════════════════════════════════════════

/** 비교 대상 자격 판정 결과 */
export interface CompareEligibility {
  /** 비교 가능 여부 */
  isEligible: boolean;
  /** 불가 사유 (한국어) */
  reason?: string;
  /** 동일 카테고리 여부 */
  isSameCategory: boolean;
  /** 대체품 비교 여부 */
  isSubstituteComparison: boolean;
}

/** 비교 규칙 — 최대 수량, 카테고리 혼합 정책 등 */
export const COMPARE_RULES = {
  maxCompareItems: 5,
  sameCategoryRequired: false,
  substituteComparisonLabel: "대체품 비교",
  directComparisonLabel: "동일 카테고리 비교",
  mixedComparisonWarning:
    "서로 다른 카테고리의 제품이 포함되어 있습니다. 대체품 비교로 진행합니다.",
} as const;

/** 비교 축 — 비교 테이블의 각 행이 될 수 있는 속성 */
export type CompareAxis =
  | "specification"
  | "unit_size"
  | "grade"
  | "manufacturer"
  | "price_range"
  | "lead_time"
  | "document_availability"
  | "inventory_status"
  | "brand"
  | "purity"
  | "storage_condition";

/** 비교 요약 — 핵심 차이점, AI 추천, 대체품 참고 */
export interface CompareSummary {
  /** 핵심 차이점 목록 */
  keyDifferences: {
    axis: CompareAxis;
    finding: string;
    tone: "neutral" | "advantage" | "disadvantage" | "caution";
  }[];
  /** AI 추천 한 줄 (한국어) */
  recommendation?: string;
  /** 대체품 비교 시 참고 문구 (한국어) */
  substituteNote?: string;
}

// ═══════════════════════════════════════════════════
// 6. Final Selection
// ═══════════════════════════════════════════════════

/** 비교 후 최종 선택 결과 */
export interface FinalSelection {
  /** 선택된 제품 ID */
  selectedProductId: string;
  /** 선택 사유 (한국어) */
  selectedReason?: string;
  /** 제외된 제품 목록 */
  excludedProducts: { productId: string; excludeReason?: string }[];
  /** 비교 세션 ID */
  compareSessionId: string;
}

// ═══════════════════════════════════════════════════
// 7. Quote Carryover Context
// ═══════════════════════════════════════════════════

/** 견적 요청으로 이월되는 검색·비교 맥락 */
export interface QuoteCarryoverContext {
  /** 원본 검색 쿼리 */
  searchQuery: string;
  /** 검색 의도 유형 */
  searchIntentType: SearchIntentType;
  /** 검색 필터 */
  searchFilters: SearchIntent["filters"];
  /** 비교 세션 ID */
  compareSessionId?: string;
  /** 비교 근거 요약 */
  compareRationale?: string;
  /** 대안 선호 기준 */
  alternativePreference?:
    | "cheapest"
    | "fastest_delivery"
    | "highest_purity"
    | "preferred_vendor"
    | "best_document_coverage";
  /** 기존 제품 참조 (대체품 검색 시) */
  originalProductRef?: string;
  /** 프로젝트 맥락 */
  projectContext?: { projectName?: string; protocolRef?: string };
}

// ═══════════════════════════════════════════════════
// 8. Quote Line Item
// ═══════════════════════════════════════════════════

/** 견적 요청 품목 */
export interface QuoteLineItem {
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
  /** 요청 납기 (영업일) */
  requestedLeadTimeDays?: number;
  /** 용도 메모 (한국어) */
  purposeNote?: string;
  /** 필요 문서 목록 */
  requiredDocuments: string[];
  /** 예산 힌트 */
  budgetHint?: {
    estimatedUnitPrice?: number;
    budgetRemaining?: number;
    overBudgetWarning?: boolean;
  };
  /** 이월 맥락 — 검색·비교 단계에서 전달 */
  carryoverContext: QuoteCarryoverContext;
}

// ═══════════════════════════════════════════════════
// 9. Quote Validation
// ═══════════════════════════════════════════════════

/** 견적 품목 검증 규칙 */
export interface QuoteValidationRule {
  /** 규칙 ID */
  ruleId: string;
  /** 검증 대상 필드 */
  field: string;
  /** 검증 유형 */
  check: "required" | "min" | "max" | "format" | "policy";
  /** 검증 메시지 (한국어) */
  message: string;
  /** 심각도 */
  severity: "error" | "warning";
}

/** 견적 품목 검증 규칙 목록 */
export const QUOTE_VALIDATION_RULES: QuoteValidationRule[] = [
  {
    ruleId: "quantity_required",
    field: "quantity",
    check: "required",
    message: "수량을 입력해주세요",
    severity: "error",
  },
  {
    ruleId: "quantity_min",
    field: "quantity",
    check: "min",
    message: "수량은 1 이상이어야 합니다",
    severity: "error",
  },
  {
    ruleId: "unit_required",
    field: "unit",
    check: "required",
    message: "단위를 선택해주세요",
    severity: "error",
  },
  {
    ruleId: "document_sds_recommended",
    field: "requiredDocuments",
    check: "policy",
    message: "SDS 문서 요청을 권장합니다",
    severity: "warning",
  },
  {
    ruleId: "lead_time_too_short",
    field: "requestedLeadTimeDays",
    check: "policy",
    message:
      "요청 납기가 일반 납기보다 짧습니다. 공급사 확인이 필요할 수 있습니다",
    severity: "warning",
  },
  {
    ruleId: "budget_exceeded",
    field: "budgetHint",
    check: "policy",
    message:
      "예상 금액이 잔여 예산을 초과합니다. 승인이 필요할 수 있습니다",
    severity: "warning",
  },
  {
    ruleId: "purpose_note_recommended",
    field: "purposeNote",
    check: "policy",
    message: "용도를 입력하면 승인 과정이 빨라질 수 있습니다",
    severity: "warning",
  },
] as const;

// ═══════════════════════════════════════════════════
// 10. Quote Submission Result
// ═══════════════════════════════════════════════════

/** 견적 요청 제출 결과 */
export interface QuoteSubmissionResult {
  /** 제출 성공 여부 */
  success: boolean;
  /** 생성된 요청 ID 목록 */
  createdRequestIds: string[];
  /** 생성 건수 */
  createdCount: number;
  /** 차단 건수 */
  blockedCount: number;
  /** 차단된 품목 */
  blockedItems: { productId: string; reason: string }[];
  /** 다음 액션 (한국어 라벨 + 경로) */
  nextAction: { label: string; href: string };
  /** 검색/비교 맥락 보존 여부 */
  sourceContextPreserved: boolean;
}

// ═══════════════════════════════════════════════════
// 11. Queue Handoff Contract
// ═══════════════════════════════════════════════════

/** 견적 제출 후 대기열 인수인계 계약 */
export const QUEUE_HANDOFF_CONTRACT = {
  queueName: "quote_request_pending",
  queueHref: "/dashboard/quotes",
  sourceContextFields: [
    "searchQuery",
    "searchIntentType",
    "compareSessionId",
    "compareRationale",
    "alternativePreference",
    "projectContext",
  ],
  restoreLabel: "검색/비교 맥락 보기",
} as const;

// ═══════════════════════════════════════════════════
// 12. SCQ Funnel Events
// ═══════════════════════════════════════════════════

/** SCQ 퍼널 이벤트 — 단계별 추적 이벤트 정의 */
export const SCQ_FUNNEL_EVENTS = [
  {
    eventName: "search_initiated",
    stage: "searchIntentCapture",
    description: "검색 시작",
  },
  {
    eventName: "search_result_viewed",
    stage: "searchResultsInterpretation",
    description: "검색 결과 확인",
  },
  {
    eventName: "candidate_added_to_compare",
    stage: "candidateSelection",
    description: "비교 대상 추가",
  },
  {
    eventName: "compare_session_started",
    stage: "compareWorkspace",
    description: "비교 시작",
  },
  {
    eventName: "compare_selection_made",
    stage: "compareWorkspace",
    description: "비교 후 선택 완료",
  },
  {
    eventName: "quote_builder_opened",
    stage: "quoteRequestBuilder",
    description: "견적 요청 작성 시작",
  },
  {
    eventName: "quote_line_item_added",
    stage: "quoteRequestBuilder",
    description: "견적 품목 추가",
  },
  {
    eventName: "quote_submitted",
    stage: "quoteSubmission",
    description: "견적 요청 제출",
  },
  {
    eventName: "quote_queue_entered",
    stage: "queueHandoff",
    description: "견적 대기열 진입",
  },
] as const;

// ═══════════════════════════════════════════════════
// 13. SCQ Empty / Error / Unavailable Copy
// ═══════════════════════════════════════════════════

/** 검색·비교·견적 단계별 빈 상태 문구 */
export const SCQ_EMPTY_COPY = {
  search_empty: {
    title: "검색 결과가 없습니다",
    description: "검색어를 변경하거나 필터를 조정해보세요",
    actionLabel: "검색 조건 변경",
    actionHref: null,
  },
  search_no_exact: {
    title: "정확히 일치하는 제품이 없습니다",
    description: "유사 제품 또는 대체 가능 제품을 확인해보세요",
    actionLabel: null,
    actionHref: null,
  },
  compare_empty: {
    title: "비교할 제품을 선택해주세요",
    description: "검색 결과에서 2개 이상의 제품을 비교 대상으로 추가하세요",
    actionLabel: null,
    actionHref: null,
  },
  compare_single: {
    title: "비교하려면 2개 이상의 제품이 필요합니다",
    description: "검색 결과로 돌아가 추가 제품을 선택하세요",
    actionLabel: null,
    actionHref: null,
  },
  quote_empty: {
    title: "견적 요청할 품목이 없습니다",
    description:
      "검색 또는 비교에서 품목을 선택해 견적 요청을 시작하세요",
    actionLabel: null,
    actionHref: null,
  },
} as const;

/** 검색·비교·견적 오류 상태 문구 */
export const SCQ_ERROR_COPY = {
  title: "검색/비교/견적 정보를 불러오지 못했습니다",
  description: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
} as const;

/** 검색·비교·견적 접근 불가 상태 문구 */
export const SCQ_UNAVAILABLE_COPY = {
  title: "현재 권한으로 이 기능에 접근할 수 없습니다",
  description: "로그인하거나 관리자에게 문의해주세요",
} as const;

// ═══════════════════════════════════════════════════
// 14. Anti-Patterns & Code Review Checklist
// ═══════════════════════════════════════════════════

/** SCQ 흐름에서 반드시 피해야 할 안티패턴 */
export const SCQ_ANTI_PATTERNS: string[] = [
  "검색 결과에 exact/near/substitute 구분이 없음",
  "비교 화면에 구매 판단 근거가 없고 표만 있음",
  "견적 전환 시 검색/비교 맥락이 끊김",
  "같은 카테고리 비교와 대체품 비교가 구분되지 않음",
  "견적 요청 전 수량/문서/납기/예산 검증이 없음",
  "AI 요약이 판단/비교/선택에 기여하지 못함",
  "검색 결과가 많아도 다음 액션이 약함",
  "submit 후 queue handoff와 source context가 끊김",
];

/** SCQ 코드 리뷰 체크리스트 — PR 리뷰 시 확인 항목 */
export const scqCodeReviewChecklist: string[] = [
  "검색 결과가 exact/near/substitute로 분류되는가",
  "비교 상단에 key difference summary가 있는가",
  "비교 후 final selection과 exclude reason이 기록되는가",
  "견적 builder에 carryover context가 유지되는가",
  "수량/문서/납기/예산 validation이 사전에 표시되는가",
  "submit 후 생성 건수, blocked 건수, next action이 보이는가",
  "queue handoff 시 source context가 복원 가능한가",
  "AI 해석이 compare/add-to-quote action을 강화하는가",
  "funnel 이벤트가 단계별로 정의되어 있는가",
  "search/compare/quote별 empty/error 상태가 구분되는가",
];
