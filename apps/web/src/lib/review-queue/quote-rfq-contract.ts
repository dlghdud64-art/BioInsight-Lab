/**
 * Quote / RFQ / Supplier Response 운영 흐름 중앙 계약
 *
 * 핵심 원칙:
 * - 견적은 단순 카드 모델이 아니라 실제 운영 흐름 계약
 * - Vendor/Supplier 계약 위에 실행 레이어로 동작
 * - 하나의 QuoteRequest에 여러 Vendor response가 연결되고,
 *   response item은 request item과 1:1 매핑
 * - exact / substitute / partial 구분, 문서 요건 충족, SLA 기반 기한 관리
 * - 비교 → 선정 → 발주 전환까지 끊김 없는 상태 흐름
 */

// ---------------------------------------------------------------------------
// 1. 견적 요청 상태
// ---------------------------------------------------------------------------

/**
 * 견적 요청 상태 — draft → cancelled 까지 운영 흐름 전체를 표현
 *
 * - draft: 작성 중
 * - ready_to_send: 발송 대기
 * - sent: 공급사에 전달됨
 * - partially_responded: 일부 공급사 회신
 * - responded: 전체 공급사 회신
 * - comparison_ready: 정규화 완료, 비교 가능
 * - vendor_selected: 우선 공급사 선정
 * - converted_to_po: 발주 전환 완료
 * - expired: 기한 초과
 * - cancelled: 취소됨
 */
export type QuoteRequestStatus =
  | "draft"
  | "ready_to_send"
  | "sent"
  | "partially_responded"
  | "responded"
  | "comparison_ready"
  | "vendor_selected"
  | "converted_to_po"
  | "expired"
  | "cancelled";

// ---------------------------------------------------------------------------
// 2. 공급사 응답 상태
// ---------------------------------------------------------------------------

/**
 * 공급사 응답 상태 — 개별 공급사의 회신 진행 상황
 *
 * - not_sent: 아직 전달되지 않음
 * - sent: 요청 전달됨
 * - viewed: 공급사가 열람함
 * - responded: 회신 완료
 * - declined: 견적 거절
 * - expired: 응답 기한 초과
 * - incomplete: 부분 응답 (일부 항목만 회신)
 */
export type QuoteResponseStatus =
  | "not_sent"
  | "sent"
  | "viewed"
  | "responded"
  | "declined"
  | "expired"
  | "incomplete";

// ---------------------------------------------------------------------------
// 3. 견적 요청 항목 계약
// ---------------------------------------------------------------------------

/** 견적 요청 개별 항목 — 요청 품목·수량·사양·대체 허용 여부 포함 */
export interface QuoteRequestItemContract {
  /** 항목 고유 ID */
  id: string;
  /** 카탈로그 항목 ID (카탈로그 기반 요청 시) */
  catalogItemId?: string;
  /** 요청 품명 */
  requestedName: string;
  /** 제조사 */
  manufacturer?: string;
  /** 카탈로그 번호 */
  catalogNumber?: string;
  /** CAS 번호 */
  casNumber?: string;
  /** 요청 수량 */
  quantity: number;
  /** 수량 단위 */
  unit: string;
  /** 요청 포장 규격 */
  packSizeRequested?: string;
  /** 사양 요구사항 목록 */
  specRequirements?: string[];
  /** 대체품 허용 여부 */
  substituteAllowed: boolean;
  /** 목표 납기 (일) */
  targetLeadTimeDays?: number;
  /** 목표 단가 */
  targetUnitPrice?: number;
  /** 필수 문서 유형 */
  requiredDocuments?: ("coa" | "msds" | "validation" | "warranty")[];
  /** 연결된 재고 항목 ID */
  linkedInventoryItemId?: string;
  /** 연결된 프로젝트 ID */
  linkedProjectId?: string;
}

// ---------------------------------------------------------------------------
// 4. 견적 요청 계약
// ---------------------------------------------------------------------------

/** 견적 요청 전체 계약 — 요청 상태·공급사·항목·요약 정보 포함 */
export interface QuoteRequestContract {
  /** 요청 고유 ID */
  id: string;
  /** 워크스페이스 ID */
  workspaceId: string;
  /** 요청 번호 (표시용) */
  requestNumber: string;
  /** 요청 제목 */
  title: string;
  /** 현재 상태 */
  status: QuoteRequestStatus;
  /** 요청 출처 유형 */
  sourceType: "search" | "compare" | "manual" | "reorder" | "protocol";
  /** 생성 일시 (ISO 8601) */
  createdAt: string;
  /** 생성자 ID */
  createdBy: string;
  /** 응답 마감 일시 (ISO 8601) */
  dueAt: string;
  /** 우선순위 */
  priority: "low" | "normal" | "high" | "urgent";
  /** 통화 코드 */
  currency: string;
  /** 배송 지역 */
  shippingRegion: string;
  /** 요청 팀 */
  requesterTeam: string;
  /** 연결된 예산 컨텍스트 ID */
  budgetContextId?: string;
  /** 연결된 승인 정책 ID */
  approvalPolicyId?: string;
  /** 대상 공급사 ID 목록 */
  vendorIds: string[];
  /** 요청 항목 목록 */
  items: QuoteRequestItemContract[];
  /** 요청 메모 */
  notes?: string;
  /** 첨부 파일 목록 */
  attachments?: { id: string; name: string; type: string }[];
  /** 요약 정보 */
  summary: {
    /** 총 항목 수 */
    totalItems: number;
    /** 총 공급사 수 */
    totalVendors: number;
    /** 응답 완료 공급사 수 */
    respondedVendors: number;
    /** 선정된 공급사 ID */
    selectedVendorId?: string;
  };
}

// ---------------------------------------------------------------------------
// 5. 공급사 응답 항목 계약
// ---------------------------------------------------------------------------

/** 공급사 응답 개별 항목 — 제안 품목·가격·납기·재고·문서·대체 여부 포함 */
export interface QuoteResponseItemContract {
  /** 항목 고유 ID */
  id: string;
  /** 대응하는 요청 항목 ID */
  requestItemId: string;
  /** 제안 품명 */
  offeredProductName: string;
  /** 제조사 */
  manufacturer?: string;
  /** 카탈로그 번호 */
  catalogNumber?: string;
  /** 포장 규격 */
  packSize: string;
  /** 제안 수량 */
  quantityOffered: number;
  /** 단가 */
  unitPrice: number;
  /** 총가 */
  totalPrice: number;
  /** 납기 (일) */
  leadTimeDays?: number;
  /** 재고 상태 */
  stockStatus:
    | "in_stock"
    | "limited"
    | "backorder"
    | "made_to_order"
    | "unknown";
  /** 제공 가능 준수 문서 목록 */
  complianceDocs: string[];
  /** 사양 편차 사항 */
  deviations?: string[];
  /** 대체품 제안 여부 */
  substituteOffered: boolean;
  /** 대체 사유 */
  substituteReason?: string;
  /** 매칭 신뢰도 */
  matchConfidence?: "exact" | "compatible" | "partial" | "unclear";
}

// ---------------------------------------------------------------------------
// 6. 공급사 응답 계약
// ---------------------------------------------------------------------------

/** 공급사 응답 전체 계약 — 응답 상태·결제 조건·배송비·연락처 포함 */
export interface QuoteResponseContract {
  /** 응답 고유 ID */
  id: string;
  /** 대응하는 견적 요청 ID */
  quoteRequestId: string;
  /** 공급사 ID */
  vendorId: string;
  /** 응답 상태 */
  responseStatus: QuoteResponseStatus;
  /** 응답 일시 (ISO 8601) */
  respondedAt?: string;
  /** 견적 유효 기한 (ISO 8601) */
  validUntil?: string;
  /** 통화 코드 */
  currency: string;
  /** 결제 조건 */
  paymentTerms?: string;
  /** 인코텀즈 */
  incoterms?: string;
  /** 배송비 */
  shippingFee?: number;
  /** 최소 주문 금액 */
  minimumOrderAmount?: number;
  /** 비고 */
  notes?: string;
  /** 응답 항목 목록 */
  responseItems: QuoteResponseItemContract[];
  /** 첨부 파일 목록 */
  attachments?: { id: string; name: string; type: string }[];
  /** 영업 담당자 정보 */
  salesContact?: { name: string; email: string; phone?: string };
}

// ---------------------------------------------------------------------------
// 7. 견적 비교 — 공급사별 옵션
// ---------------------------------------------------------------------------

/** 비교 테이블 내 공급사별 옵션 — 정규화 가격·납기·매칭·문서·점수 포함 */
export interface QuoteVendorOptionContract {
  /** 공급사 ID */
  vendorId: string;
  /** 대응하는 응답 항목 ID */
  responseItemId: string;
  /** 정규화 단가 */
  normalizedUnitPrice?: number;
  /** 정규화 총가 */
  normalizedTotalPrice?: number;
  /** 납기 (일) */
  leadTimeDays?: number;
  /** 정확 매칭 여부 */
  isExactMatch: boolean;
  /** 대체품 여부 */
  isSubstitute: boolean;
  /** 필수 문서 보유 여부 */
  hasRequiredDocs: boolean;
  /** 종합 점수 */
  score?: number;
  /** 경고 배지 목록 */
  warningBadges: string[];
}

// ---------------------------------------------------------------------------
// 8. 견적 비교 행 계약
// ---------------------------------------------------------------------------

/** 비교 테이블 행 — 요청 항목 기준으로 공급사 옵션 나열, 최적 마커 포함 */
export interface QuoteComparisonRowContract {
  /** 대응하는 요청 항목 ID */
  requestItemId: string;
  /** 항목 표시명 */
  itemLabel: string;
  /** 공급사별 옵션 목록 */
  vendorOptions: QuoteVendorOptionContract[];
  /** 최저가 공급사 ID */
  bestPriceVendorId?: string;
  /** 최단 납기 공급사 ID */
  fastestLeadVendorId?: string;
  /** 정확 매칭 공급사 ID */
  exactMatchVendorId?: string;
  /** 커버리지 갭 존재 여부 */
  hasCoverageGap: boolean;
  /** 사양 불일치 존재 여부 */
  hasSpecMismatch: boolean;
  /** 검토 필요 여부 */
  requiresReview: boolean;
}

// ---------------------------------------------------------------------------
// 9. 견적 비교 계약
// ---------------------------------------------------------------------------

/** 견적 비교 전체 계약 — 비교 상태·정규화·리스크·추천 시나리오 포함 */
export interface QuoteComparisonContract {
  /** 비교 고유 ID */
  id: string;
  /** 대응하는 견적 요청 ID */
  quoteRequestId: string;
  /** 비교 상태 */
  comparisonStatus:
    | "not_ready"
    | "partial"
    | "ready"
    | "selected"
    | "converted";
  /** 정규화 기준 통화 */
  normalizedCurrency: string;
  /** 비교 대상 공급사 목록 */
  vendorsInScope: string[];
  /** 비교 행 목록 */
  comparableItemRows: QuoteComparisonRowContract[];
  /** 미응답 공급사 ID 목록 */
  missingResponses: string[];
  /** 리스크 플래그 목록 */
  riskFlags: string[];
  /** 추천 공급사 ID */
  recommendedVendorId?: string;
  /** 추천 시나리오 */
  recommendedScenario?:
    | "lowest_cost"
    | "fastest_delivery"
    | "best_match"
    | "balanced";
}

// ---------------------------------------------------------------------------
// 10. 견적 요청 상태 설명
// ---------------------------------------------------------------------------

/** 견적 요청 상태별 라벨·설명·다음 액션 — UI 표시 및 가이드용 */
export const QUOTE_REQUEST_STATUS_DESCRIPTIONS: Record<
  QuoteRequestStatus,
  { label: string; description: string; nextActions: string[] }
> = {
  draft: {
    label: "초안",
    description: "견적 요청 작성 중",
    nextActions: ["항목 추가", "공급사 선택", "발송 준비"],
  },
  ready_to_send: {
    label: "발송 준비",
    description: "견적 요청 발송 준비 완료",
    nextActions: ["검토 후 발송", "항목 수정"],
  },
  sent: {
    label: "발송됨",
    description: "공급사에 견적 요청 전달 완료",
    nextActions: ["응답 대기", "리마인더 발송"],
  },
  partially_responded: {
    label: "부분 응답",
    description: "일부 공급사가 회신함",
    nextActions: ["추가 응답 대기", "현재까지 비교"],
  },
  responded: {
    label: "응답 완료",
    description: "모든 공급사가 회신함",
    nextActions: ["비교 시작", "추가 공급사 요청"],
  },
  comparison_ready: {
    label: "비교 준비",
    description: "공급사 응답 정규화 완료, 비교 가능",
    nextActions: ["비교 검토", "우선안 선택"],
  },
  vendor_selected: {
    label: "공급사 선정",
    description: "우선 공급사가 선정됨",
    nextActions: ["발주 전환", "재검토"],
  },
  converted_to_po: {
    label: "발주 전환",
    description: "구매 주문으로 전환 완료",
    nextActions: ["주문 추적"],
  },
  expired: {
    label: "만료",
    description: "응답 기한 초과",
    nextActions: ["재요청", "기한 연장"],
  },
  cancelled: {
    label: "취소",
    description: "견적 요청 취소됨",
    nextActions: [],
  },
};

// ---------------------------------------------------------------------------
// 11. 공급사 응답 상태 설명
// ---------------------------------------------------------------------------

/** 공급사 응답 상태별 라벨·설명 — UI 표시용 */
export const QUOTE_RESPONSE_STATUS_DESCRIPTIONS: Record<
  QuoteResponseStatus,
  { label: string; description: string }
> = {
  not_sent: {
    label: "미전달",
    description: "아직 공급사에 요청이 전달되지 않음",
  },
  sent: {
    label: "전달됨",
    description: "공급사에 견적 요청이 전달됨",
  },
  viewed: {
    label: "열람됨",
    description: "공급사가 견적 요청을 열람함",
  },
  responded: {
    label: "회신 완료",
    description: "공급사가 견적을 회신함",
  },
  declined: {
    label: "거절",
    description: "공급사가 견적 요청을 거절함",
  },
  expired: {
    label: "기한 초과",
    description: "응답 기한이 초과됨",
  },
  incomplete: {
    label: "부분 응답",
    description: "일부 항목만 회신됨",
  },
};

// ---------------------------------------------------------------------------
// 12. SLA 기본값
// ---------------------------------------------------------------------------

/** 견적 SLA 기본 설정 — 응답 기한·비교 검토·만료 경고 기준 */
export const QUOTE_SLA_DEFAULTS = {
  /** 견적 요청 기본 마감 기한 (일) */
  requestDueDays: 7,
  /** 공급사 응답 기한 (일) */
  vendorResponseDays: 5,
  /** 비교 검토 기한 (일) */
  comparisonReviewDays: 3,
  /** 지연 배지 표시 기준 (시간) */
  overdueBadgeAfterHours: 48,
  /** 만료 경고 시작 기준 (일) */
  expirationWarningDays: 3,
} as const;

// ---------------------------------------------------------------------------
// 13. 빈 상태 / 에러 / 접근 불가 문구
// ---------------------------------------------------------------------------

/** 견적 목록이 비어 있을 때 표시할 문구 */
export const QUOTE_EMPTY_COPY = {
  title: "견적 요청이 없습니다",
  description: "검색, 비교, 프로토콜에서 견적 요청을 생성할 수 있습니다",
  actionLabel: "견적 요청 만들기",
  actionHref: "/dashboard/quotes/new",
} as const;

/** 견적 데이터 로딩 실패 시 표시할 문구 */
export const QUOTE_ERROR_COPY = {
  title: "견적 정보를 불러오지 못했습니다",
  description: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
} as const;

/** 견적 관리 접근 권한이 없을 때 표시할 문구 */
export const QUOTE_UNAVAILABLE_COPY = {
  title: "현재 권한으로 견적 관리에 접근할 수 없습니다",
  description: "구매 요청자 이상의 권한이 필요합니다",
  actionLabel: "권한 요청하기",
  actionHref: "/dashboard/support-center?tab=ticket",
} as const;

// ---------------------------------------------------------------------------
// 14. 안티패턴
// ---------------------------------------------------------------------------

/**
 * 견적 모델링 시 피해야 할 안티패턴 — 코드 리뷰·설계 검토 시 참고
 *
 * 이 목록에 해당하는 구조가 발견되면 계약 위반으로 판단하고 수정해야 한다.
 */
export const QUOTE_ANTI_PATTERNS: string[] = [
  "단순 hasQuote: boolean으로 견적 존재 여부만 관리",
  "단일 공급사 기준 견적 모델",
  "response item과 request item 매핑이 없는 구조",
  "최저가 추천만 하는 단선적 비교",
  "SLA/응답 기한 없이 무기한 대기",
  "문서 요건 충족 여부를 비교에 반영하지 않음",
  "substitute 제안을 구분하지 않음",
  "발주 전환 가능 상태를 판단할 수 없는 구조",
];

// ---------------------------------------------------------------------------
// 15. 코드 리뷰 체크리스트
// ---------------------------------------------------------------------------

/**
 * 견적 관련 코드 리뷰 체크리스트 — PR 리뷰 시 각 항목을 확인
 *
 * 모든 항목이 "예"로 답변 가능해야 계약을 준수하는 것으로 간주한다.
 */
export const quoteCodeReviewChecklist: string[] = [
  "하나의 QuoteRequest에 여러 Vendor response가 연결되는가",
  "각 response item이 request item과 연결되는가",
  "exact/substitute/partial 구분이 가능한가",
  "compare-ready 여부를 view-model에서 계산할 수 있는가",
  "overdue/missing docs/coverage gap/spec mismatch를 UI가 바로 표현할 수 있는가",
  "selected vendor와 converted_to_po 상태를 자연스럽게 이어갈 수 있는가",
  "SLA 기반 응답 기한과 만료 경고가 작동하는가",
  "문서 요건(COA/MSDS 등)이 비교에 반영되는가",
  "예산/승인 정책과 연결 가능한 구조인가",
  "Vendor/Budget/Workflow 계약과 충돌하지 않는가",
];
