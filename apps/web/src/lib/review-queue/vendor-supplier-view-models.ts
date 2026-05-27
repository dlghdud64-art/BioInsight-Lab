/**
 * Vendor / Supplier UI ViewModel 타입 및 헬퍼
 *
 * vendor-supplier-contract.ts의 도메인 타입을 UI 표현용으로 변환하는
 * ViewModel과 유틸리티 함수를 정의한다.
 */

import type {
  VendorPerformanceMetrics,
  VendorRelationshipType,
} from "./vendor-supplier-contract";

import { VENDOR_PERFORMANCE_THRESHOLDS } from "./vendor-supplier-contract";

// ---------------------------------------------------------------------------
// 1. 공급사 전체 건강 요약 ViewModel
// ---------------------------------------------------------------------------

/** 공급사 관리 전체 건강 요약 — 대시보드 상단 카드용 */
export interface VendorHealthSummaryViewModel {
  /** 전체 공급사 수 */
  totalVendors: number;
  /** 활성 공급사 수 */
  activeVendors: number;
  /** 우선 공급사 수 */
  preferredCount: number;
  /** 승인 공급사 수 */
  approvedCount: number;
  /** 차단 공급사 수 */
  blockedCount: number;
  /** 검토 대기 공급사 수 */
  pendingReviewCount: number;
  /** 평균 응답 시간 라벨 (한국어, 예: "평균 응답 2.3일") */
  avgResponseLabel: string;
  /** 평균 납품률 라벨 (한국어, 예: "정시 납품 92%") */
  avgDeliveryLabel: string;
  /** 최우선 리스크 한줄 요약 (한국어) */
  topRiskLabel?: string;
}

// ---------------------------------------------------------------------------
// 2. 공급사 목록 아이템 ViewModel
// ---------------------------------------------------------------------------

/** 공급사 목록 행/카드 표시용 ViewModel */
export interface VendorListItemViewModel {
  /** 공급사 ID */
  id: string;
  /** 공급사명 */
  name: string;
  /** 관계 유형 원본 */
  relationshipType: VendorRelationshipType;
  /** 관계 유형 라벨 (한국어) */
  relationshipLabel: string;
  /** 전체 톤 — healthy/warning/danger/blocked/pending */
  tone: "healthy" | "warning" | "danger" | "blocked" | "pending";
  /** 카테고리 요약 라벨 (한국어, 예: "시약, 소모품 외 1건") */
  categoriesLabel: string;
  /** 지역 요약 라벨 (한국어, 예: "한국, 아시아태평양") */
  regionsLabel: string;
  /** 성능 요약 한줄 라벨 (한국어, 예: "평균 응답 2.1일 · 정시 납품 94%") */
  performanceSummaryLabel: string;
  /** 마지막 응답 라벨 (한국어, 예: "3일 전") */
  lastResponseLabel?: string;
  /** 리스크 뱃지 라벨 목록 */
  riskBadges: string[];
  /** 연동 여부 */
  isIntegrated: boolean;
  /** 상세 페이지 링크 */
  href: string;
}

// ---------------------------------------------------------------------------
// 3. 공급사 상세 ViewModel
// ---------------------------------------------------------------------------

/** 공급사 상세 페이지 전체 ViewModel */
export interface VendorDetailViewModel {
  /** 공급사 ID */
  id: string;
  /** 공급사명 (한국어) */
  name: string;
  /** 공급사 영문명 */
  nameEn?: string;
  /** 내부 공급사 코드 */
  code?: string;
  /** 관계 유형 원본 */
  relationshipType: VendorRelationshipType;
  /** 관계 유형 라벨 (한국어) */
  relationshipLabel: string;
  /** 관계 유형 설명 (한국어) */
  relationshipDescription: string;
  /** 활성 여부 */
  isActive: boolean;
  /** 상태 톤 */
  statusTone: string;
  /** 주 담당자 라벨 (한국어, 예: "김영수 (영업 담당) · kim@example.com") */
  contactLabel: string;
  /** 운영 담당자 라벨 (한국어) */
  operationsOwnerLabel?: string;
  /** 계약 범위 라벨 (한국어) */
  contractScopeLabel?: string;
  /** 연동 상태 라벨 (한국어) */
  integrationStatusLabel: string;
  /** 성능 지표 표시용 */
  performance: {
    /** 응답 시간 라벨 (한국어, 예: "평균 응답 2.1일") */
    responseTimeLabel: string;
    /** 납품률 라벨 (한국어, 예: "정시 납품 94%") */
    deliveryLabel: string;
    /** 문서 충족률 라벨 (한국어, 예: "문서 충족 88%") */
    docComplianceLabel: string;
    /** 가격 일관성 라벨 (한국어, 예: "가격 일관성 82점") */
    priceLabel: string;
    /** 주문 성공률 라벨 (한국어, 예: "주문 성공 96%") */
    orderSuccessLabel: string;
    /** 분쟁 라벨 (한국어, 예: "분쟁 2건") */
    disputeLabel: string;
    /** 전체 성능 톤 */
    overallTone: "healthy" | "warning" | "danger";
  };
  /** 제약 조건 목록 */
  constraints: {
    type: string;
    label: string;
  }[];
  /** 리스크 목록 */
  risks: {
    title: string;
    severity: string;
    actionLabel: string;
    actionHref: string;
  }[];
  /** 관련 큐/워크리스트 링크 */
  relatedQueues: {
    label: string;
    href: string;
    count?: number;
  }[];
  /** 감사 이력 */
  auditEntries: {
    actor: string;
    action: string;
    timeLabel: string;
  }[];
}

// ---------------------------------------------------------------------------
// 4. 견적 비교용 공급사 카드 ViewModel
// ---------------------------------------------------------------------------

/** 견적 비교 시 공급사별 카드 표시용 ViewModel */
export interface VendorCompareCardViewModel {
  /** 공급사 ID */
  vendorId: string;
  /** 공급사명 */
  vendorName: string;
  /** 관계 유형 라벨 (한국어) */
  relationshipLabel: string;
  /** 응답 커버리지 라벨 (한국어, 예: "8/10 품목 응답") */
  responseCoverageLabel: string;
  /** 가격 범위 라벨 (한국어, 예: "₩120,000 ~ ₩450,000") */
  priceRangeLabel: string;
  /** 리드타임 라벨 (한국어, 예: "평균 5영업일") */
  leadTimeLabel: string;
  /** 문서 충족률 라벨 (한국어, 예: "문서 충족 88%") */
  docComplianceLabel: string;
  /** 전체 톤 */
  overallTone: "healthy" | "warning" | "danger";
  /** 경고 뱃지 라벨 목록 */
  warningBadges: string[];
}

// ---------------------------------------------------------------------------
// 5. 헬퍼: 공급사 톤 판정
// ---------------------------------------------------------------------------

/**
 * 공급사 관계 유형과 성능 지표를 기반으로 전체 톤을 판정한다.
 *
 * - blocked → "blocked"
 * - pending_review / suspended → "pending"
 * - 성능 지표 없으면 관계 기반 기본 톤 반환
 * - 성능 지표 있으면 resolvePerformanceTone 결과 반영
 *
 * @param relationship - 공급사 관계 유형
 * @param metrics - 성능 지표 (선택)
 * @returns 톤 문자열
 */
export function resolveVendorTone(
  relationship: VendorRelationshipType,
  metrics?: VendorPerformanceMetrics,
): "healthy" | "warning" | "danger" | "blocked" | "pending" {
  if (relationship === "blocked") return "blocked";
  if (relationship === "pending_review" || relationship === "suspended") return "pending";

  if (!metrics) {
    // 관계만으로 기본 톤 판정
    if (relationship === "preferred" || relationship === "approved") return "healthy";
    return "warning";
  }

  const perfTone = resolvePerformanceTone(metrics);
  return perfTone;
}

// ---------------------------------------------------------------------------
// 6. 헬퍼: 성능 톤 판정
// ---------------------------------------------------------------------------

/**
 * 성능 지표를 기반으로 전체 성능 톤을 판정한다.
 *
 * - danger: 하나라도 danger 임계값 이하
 * - warning: 하나라도 warning 임계값 이하
 * - healthy: 모두 good 임계값 이상
 *
 * @param metrics - 성능 지표
 * @returns 성능 톤
 */
export function resolvePerformanceTone(
  metrics: VendorPerformanceMetrics,
): "healthy" | "warning" | "danger" {
  const t = VENDOR_PERFORMANCE_THRESHOLDS;

  // danger 체크 (응답 시간은 높을수록 나쁨, 나머지는 낮을수록 나쁨)
  if (
    metrics.avgResponseTimeDays >= t.responseTimeDays.danger ||
    metrics.onTimeDeliveryRate <= t.onTimeDeliveryRate.danger ||
    metrics.documentComplianceRate <= t.documentComplianceRate.danger ||
    metrics.priceConsistencyScore <= t.priceConsistencyScore.danger ||
    metrics.orderSuccessRate <= t.orderSuccessRate.danger
  ) {
    return "danger";
  }

  // warning 체크
  if (
    metrics.avgResponseTimeDays >= t.responseTimeDays.warning ||
    metrics.onTimeDeliveryRate <= t.onTimeDeliveryRate.warning ||
    metrics.documentComplianceRate <= t.documentComplianceRate.warning ||
    metrics.priceConsistencyScore <= t.priceConsistencyScore.warning ||
    metrics.orderSuccessRate <= t.orderSuccessRate.warning
  ) {
    return "warning";
  }

  return "healthy";
}

// ---------------------------------------------------------------------------
// 7. 헬퍼: 성능 요약 문구 생성
// ---------------------------------------------------------------------------

/**
 * 성능 지표를 한국어 한줄 요약 문구로 변환한다.
 *
 * 예: "평균 응답 2.1일 · 정시 납품 94% · 문서 충족 88%"
 *
 * @param metrics - 성능 지표
 * @returns 한국어 요약 문자열
 */
export function formatVendorPerformanceSummary(
  metrics: VendorPerformanceMetrics,
): string {
  const response = `평균 응답 ${metrics.avgResponseTimeDays.toFixed(1)}일`;
  const delivery = `정시 납품 ${Math.round(metrics.onTimeDeliveryRate * 100)}%`;
  const docCompliance = `문서 충족 ${Math.round(metrics.documentComplianceRate * 100)}%`;

  return `${response} · ${delivery} · ${docCompliance}`;
}
