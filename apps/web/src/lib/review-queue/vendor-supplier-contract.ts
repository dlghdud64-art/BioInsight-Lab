/**
 * Vendor / Supplier 운영 관계 중앙 계약
 *
 * 핵심 원칙:
 * - Vendor는 이름 목록이 아니라 운영 관계 단위
 * - 공급사 상태·승인·품질·계약 범위·문서·응답 성능을 함께 표시
 * - preferred / approved / conditional / blocked 관계를 명확히 분리
 * - 검색·견적·발주·연동·문서·예산 흐름이 공급사 관계를 통해 연결
 */

// ---------------------------------------------------------------------------
// 1. 페이지 섹션 정의
// ---------------------------------------------------------------------------

/** 공급사 관리 페이지 섹션 순서 — 위에서 아래로 렌더링 */
export const VENDOR_PAGE_SECTIONS = [
  "header",
  "healthSummary",
  "priorityRisks",
  "supplierList",
  "selectedOverview",
  "offersPerformanceDocs",
  "relatedQueues",
  "auditGovernance",
] as const;

// ---------------------------------------------------------------------------
// 2. 공급사 관계 유형
// ---------------------------------------------------------------------------

/**
 * 공급사 관계 유형 — preferred → blocked 순으로 거래 가능 범위가 좁아짐
 *
 * - preferred: 기본 견적 요청 대상
 * - approved: 거래 승인된 공급사
 * - conditional: 추가 승인 필요
 * - regional: 특정 지역 전용
 * - category_specific: 특정 카테고리 전용
 * - fallback: 주 공급사 불가 시 대안
 * - blocked: 거래 중단
 * - suspended: 일시 정지
 * - pending_review: 승인 대기
 */
export type VendorRelationshipType =
  | "preferred"
  | "approved"
  | "conditional"
  | "regional"
  | "category_specific"
  | "fallback"
  | "blocked"
  | "suspended"
  | "pending_review";

// ---------------------------------------------------------------------------
// 3. 공급사 프로필
// ---------------------------------------------------------------------------

/** 공급사 기본 프로필 — 관계 상태·계약 범위·연락처·운영 담당자 포함 */
export interface VendorProfile {
  /** 공급사 고유 ID */
  id: string;
  /** 공급사명 (한국어) */
  name: string;
  /** 공급사 영문명 */
  nameEn?: string;
  /** 내부 공급사 코드 */
  code?: string;
  /** 관계 유형 */
  relationshipType: VendorRelationshipType;
  /** 활성 여부 */
  isActive: boolean;
  /** 등록일 (ISO 8601) */
  registeredAt: string;
  /** 승인일 (ISO 8601) */
  approvedAt?: string;
  /** 승인자 이름 또는 ID */
  approvedBy?: string;
  /** 차단일 (ISO 8601) */
  blockedAt?: string;
  /** 차단 사유 (한국어) */
  blockedReason?: string;
  /** 취급 카테고리 목록 */
  categories: string[];
  /** 공급 가능 지역 목록 */
  regions: string[];
  /** 주 담당자 연락처 */
  primaryContact: {
    name: string;
    email: string;
    phone?: string;
    role?: string;
  };
  /** 내부 운영 담당자 */
  operationsOwner?: {
    userId: string;
    name: string;
  };
  /** 계약 범위 */
  contractScope?: {
    /** 계약 시작일 (ISO 8601) */
    validFrom: string;
    /** 계약 종료일 (ISO 8601) */
    validUntil?: string;
    /** 계약 조건 설명 */
    terms?: string;
    /** 최소 주문 금액 */
    minimumOrderAmount?: number;
    /** 거래 통화 */
    currency?: string;
    /** 배송 조건 (Incoterms) */
    incoterms?: string;
  };
  /** 연동 상태 */
  integrationStatus?: "connected" | "manual" | "partial" | "disconnected";
  /** 비고 */
  notes?: string;
}

// ---------------------------------------------------------------------------
// 4. 공급사 성능 지표
// ---------------------------------------------------------------------------

/** 공급사 성능 측정 지표 — 기간별 집계 */
export interface VendorPerformanceMetrics {
  /** 공급사 ID */
  vendorId: string;
  /** 측정 기간 라벨 (예: "최근 90일") */
  periodLabel: string;
  /** 평균 응답 시간 (영업일) */
  avgResponseTimeDays: number;
  /** 정시 납품률 (0-1) */
  onTimeDeliveryRate: number;
  /** 문서 충족률 (0-1) */
  documentComplianceRate: number;
  /** 가격 일관성 점수 (0-100) */
  priceConsistencyScore: number;
  /** 주문 성공률 (0-1) */
  orderSuccessRate: number;
  /** 분쟁 건수 */
  disputeCount: number;
  /** 해당 기간 총 주문 건수 */
  totalOrdersInPeriod: number;
  /** 해당 기간 총 견적 건수 */
  totalQuotesInPeriod: number;
  /** 마지막 응답 일시 (ISO 8601) */
  lastResponseAt?: string;
}

// ---------------------------------------------------------------------------
// 5. 성능 임계값
// ---------------------------------------------------------------------------

/** 성능 지표별 good / warning / danger 임계값 */
export const VENDOR_PERFORMANCE_THRESHOLDS = {
  /** 응답 시간 (영업일) — 낮을수록 좋음 */
  responseTimeDays: { good: 2, warning: 5, danger: 10 },
  /** 정시 납품률 (0-1) — 높을수록 좋음 */
  onTimeDeliveryRate: { good: 0.95, warning: 0.85, danger: 0.7 },
  /** 문서 충족률 (0-1) — 높을수록 좋음 */
  documentComplianceRate: { good: 0.95, warning: 0.8, danger: 0.6 },
  /** 가격 일관성 점수 (0-100) — 높을수록 좋음 */
  priceConsistencyScore: { good: 85, warning: 60, danger: 40 },
  /** 주문 성공률 (0-1) — 높을수록 좋음 */
  orderSuccessRate: { good: 0.95, warning: 0.85, danger: 0.7 },
} as const;

// ---------------------------------------------------------------------------
// 6. 공급사 리스크 항목
// ---------------------------------------------------------------------------

/** 공급사 리스크 개별 항목 — 감지·심각도·액션 포함 */
export interface VendorRiskItem {
  /** 리스크 항목 ID */
  id: string;
  /** 공급사 ID */
  vendorId: string;
  /** 리스크 제목 (한국어) */
  title: string;
  /** 리스크 설명 (한국어) */
  description: string;
  /** 리스크 유형 */
  riskType:
    | "repeated_delay"
    | "missing_document"
    | "integration_instability"
    | "inactive_contact"
    | "blocked_relationship"
    | "compliance_risk"
    | "price_volatility"
    | "low_coverage";
  /** 심각도 */
  severity: "critical" | "high" | "medium";
  /** 조치 버튼 라벨 (한국어) */
  actionLabel: string;
  /** 조치 링크 */
  actionHref: string;
  /** 감지 일시 (ISO 8601) */
  detectedAt: string;
}

// ---------------------------------------------------------------------------
// 7. 공급사 제약 조건
// ---------------------------------------------------------------------------

/** 공급사 거래 제약 조건 — 카테고리·지역·MOQ·통화·인코텀즈·세금·인증 등 */
export interface VendorConstraint {
  /** 공급사 ID */
  vendorId: string;
  /** 제약 유형 */
  constraintType:
    | "category_limit"
    | "region_limit"
    | "moq"
    | "currency"
    | "incoterms"
    | "shipping"
    | "tax"
    | "compliance_cert_required";
  /** 제약 설명 (한국어) */
  description: string;
  /** 제약 값 (선택) */
  value?: string;
}

// ---------------------------------------------------------------------------
// 8. 관계 유형별 설명·운영 규칙
// ---------------------------------------------------------------------------

/** 관계 유형별 라벨·설명·게이팅 규칙 매핑 (한국어) */
export const VENDOR_RELATIONSHIP_DESCRIPTIONS: Record<
  VendorRelationshipType,
  { label: string; description: string; gatingRule: string }
> = {
  preferred: {
    label: "우선 공급사",
    description: "기본 견적 요청 대상, 비교 시 우선 노출",
    gatingRule: "견적/발주 자동 포함",
  },
  approved: {
    label: "승인 공급사",
    description: "거래 승인된 공급사",
    gatingRule: "견적 요청 가능",
  },
  conditional: {
    label: "조건부 공급사",
    description: "특정 조건 충족 시 거래 가능",
    gatingRule: "추가 승인 필요",
  },
  regional: {
    label: "지역 공급사",
    description: "특정 센터/지역 전용",
    gatingRule: "해당 지역 요청만 가능",
  },
  category_specific: {
    label: "카테고리 전용 공급사",
    description: "특정 품목 카테고리만 취급",
    gatingRule: "해당 카테고리만 요청 가능",
  },
  fallback: {
    label: "대체 공급사",
    description: "주 공급사 불가 시 대안",
    gatingRule: "주 공급사 응답 실패 시 자동 포함",
  },
  blocked: {
    label: "차단 공급사",
    description: "거래 중단 상태",
    gatingRule: "견적/발주 불가",
  },
  suspended: {
    label: "일시 정지 공급사",
    description: "검토 중 일시 거래 중단",
    gatingRule: "견적/발주 일시 불가",
  },
  pending_review: {
    label: "검토 대기 공급사",
    description: "신규 등록 후 승인 대기",
    gatingRule: "승인 전 거래 불가",
  },
};

// ---------------------------------------------------------------------------
// 9. 빈 상태·에러·접근 불가 문구
// ---------------------------------------------------------------------------

/** 공급사 없음 상태 문구 */
export const VENDOR_EMPTY_COPY = {
  title: "등록된 공급사가 없습니다",
  description: "공급사를 등록하면 견적 요청과 비교에 활용할 수 있습니다",
  actionLabel: "공급사 등록하기",
  actionHref: "/dashboard/vendors/new",
} as const;

/** 공급사 정보 로딩 에러 문구 */
export const VENDOR_ERROR_COPY = {
  title: "공급사 정보를 불러오지 못했습니다",
  description: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
} as const;

/** 공급사 관리 접근 불가 문구 */
export const VENDOR_UNAVAILABLE_COPY = {
  title: "현재 권한으로 공급사 관리에 접근할 수 없습니다",
  description: "구매 관리자 권한이 필요합니다",
  actionLabel: "권한 요청하기",
  actionHref: "/dashboard/support-center?tab=ticket",
} as const;

// ---------------------------------------------------------------------------
// 10. 공급사 관리 안티패턴
// ---------------------------------------------------------------------------

/** 공급사 관리 UI/운영에서 피해야 할 안티패턴 목록 */
export const VENDOR_ANTI_PATTERNS: string[] = [
  "공급사 정보만 있고 거래 판단 기준이 없음",
  "preferred/approved/blocked 관계가 구분되지 않음",
  "견적 단계와 공급사 운영 정보가 분리됨",
  "응답 속도, 문서 충족률 등 품질 정보가 누락됨",
  "계약/지역/카테고리 제한이 반영되지 않음",
  "공급사 contact와 운영 owner가 혼재됨",
  "vendor relationship가 검색/비교/견적과 단절됨",
  "supplier risk가 operator action으로 연결되지 않음",
];

// ---------------------------------------------------------------------------
// 11. 코드 리뷰 체크리스트
// ---------------------------------------------------------------------------

/** 공급사 관련 코드 리뷰 시 확인 항목 */
export const vendorCodeReviewChecklist: string[] = [
  "VendorRelationshipType별 견적/발주 자격이 gatingRule에 따라 적용되는가",
  "VendorProfile.primaryContact와 operationsOwner가 역할 분리되어 표시되는가",
  "VendorPerformanceMetrics가 VENDOR_PERFORMANCE_THRESHOLDS 기준으로 톤 분류되는가",
  "VendorRiskItem이 severity별로 정렬되고 actionHref로 연결되는가",
  "VendorConstraint가 견적 라우팅 및 발주 검증에 반영되는가",
  "contractScope 만료 임박 시 리스크 항목이 자동 생성되는가",
  "integrationStatus가 disconnected일 때 경고가 표시되는가",
  "관계 변경(preferred 지정, blocked 전환 등)이 audit에 기록되는가",
  "VENDOR_PAGE_SECTIONS 순서대로 섹션이 렌더링되는가",
  "모바일에서도 healthSummary + priorityRisks + supplierList 흐름이 유지되는가",
];
