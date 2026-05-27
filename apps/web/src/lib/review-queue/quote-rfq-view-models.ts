/**
 * Quote / RFQ / Supplier Response 뷰모델 및 헬퍼
 *
 * quote-rfq-contract.ts 의 운영 계약 타입을 UI 렌더링·비교·의사결정에
 * 필요한 형태로 변환하는 뷰모델과 유틸리티 함수를 정의한다.
 */

import type {
  QuoteRequestStatus,
  QuoteResponseStatus,
  QuoteResponseContract,
  QuoteComparisonContract,
} from "./quote-rfq-contract";

import { QUOTE_SLA_DEFAULTS } from "./quote-rfq-contract";

// ---------------------------------------------------------------------------
// 1. 견적 요청 목록 아이템 뷰모델
// ---------------------------------------------------------------------------

/** 견적 요청 목록에서 한 행을 표현하는 뷰모델 */
export interface QuoteRequestListItemVM {
  /** 요청 ID */
  id: string;
  /** 요청 번호 (표시용) */
  requestNumber: string;
  /** 요청 제목 */
  title: string;
  /** 현재 상태 라벨 (한국어) */
  currentStatusLabel: string;
  /** 상태 톤 — UI 색상 힌트 */
  statusTone: "neutral" | "info" | "warning" | "danger" | "success";
  /** 대상 공급사 수 */
  vendorCount: number;
  /** 요청 항목 수 */
  itemCount: number;
  /** 마감 상태 */
  dueState: {
    label: string;
    isOverdue: boolean;
    tone: "normal" | "due_soon" | "overdue";
  };
  /** 응답 진행 텍스트 (예: "3/5 공급사 응답") */
  responseProgressText: string;
  /** 선정된 공급사 이름 */
  selectedVendorName?: string;
  /** 추천 시나리오 라벨 */
  recommendedScenario?: string;
  /** 긴급 배지 (예: "긴급", "지연") */
  urgencyBadge?: string;
  /** 차단 사유 (진행 불가 시) */
  blockedReason?: string;
  /** 출처 유형 라벨 (한국어) */
  sourceTypeLabel: string;
  /** 상세 페이지 경로 */
  href: string;
}

// ---------------------------------------------------------------------------
// 2. 공급사 응답 뷰모델
// ---------------------------------------------------------------------------

/** 개별 공급사 응답 카드를 표현하는 뷰모델 */
export interface QuoteVendorResponseVM {
  /** 공급사 ID */
  vendorId: string;
  /** 공급사 이름 */
  vendorName: string;
  /** 응답 상태 라벨 (한국어) */
  responseStatusLabel: string;
  /** 상태 톤 — UI 색상 힌트 */
  statusTone: string;
  /** 응답 커버리지 — 응답 항목 수 / 전체 항목 수 */
  responseCoverage: {
    responded: number;
    total: number;
    /** 한국어 라벨 (예: "8/10 항목 응답") */
    label: string;
  };
  /** 가격 범위 텍스트 (예: "₩25,000 ~ ₩32,000") */
  priceRangeText?: string;
  /** 납기 범위 텍스트 (예: "3~7일") */
  leadTimeRangeText?: string;
  /** 누락 문서 수 */
  missingDocsCount: number;
  /** 대체품 제안 수 */
  substituteCount: number;
  /** 리스크 배지 목록 */
  riskBadges: string[];
  /** 비교 가능 여부 */
  canCompare: boolean;
  /** 선정 가능 여부 */
  canSelect: boolean;
}

// ---------------------------------------------------------------------------
// 3. 견적 비교 행 뷰모델
// ---------------------------------------------------------------------------

/** 비교 테이블 내 공급사 컬럼 정보 */
export interface QuoteComparisonVendorColumn {
  /** 공급사 ID */
  vendorId: string;
  /** 공급사 이름 */
  vendorName: string;
  /** 가격 라벨 (한국어 포맷) */
  priceLabel?: string;
  /** 납기 라벨 (한국어 포맷) */
  leadTimeLabel?: string;
  /** 매칭 라벨 (예: "정확 일치", "대체품", "부분 일치") */
  matchLabel: string;
  /** 매칭 톤 — UI 색상 힌트 */
  matchTone: string;
  /** 필수 문서 보유 여부 */
  hasRequiredDocs: boolean;
  /** 경고 배지 목록 */
  warningBadges: string[];
  /** 종합 점수 */
  score?: number;
}

/** 비교 테이블 한 행을 표현하는 뷰모델 */
export interface QuoteComparisonRowVM {
  /** 요청 항목 ID */
  requestItemId: string;
  /** 항목 표시명 */
  itemLabel: string;
  /** 요청 사양 요약 */
  requestedSpecSummary: string;
  /** 공급사별 컬럼 데이터 */
  vendorColumns: QuoteComparisonVendorColumn[];
  /** 최저가 마커 (공급사 이름 등) */
  bestPriceMarker?: string;
  /** 최단 납기 마커 */
  fastestLeadMarker?: string;
  /** 정확 매칭 마커 */
  exactMatchMarker?: string;
  /** 검토 필요 여부 */
  reviewRequired: boolean;
  /** 이슈 요약 (한국어) */
  issueSummary?: string;
}

// ---------------------------------------------------------------------------
// 4. 의사결정 요약 뷰모델
// ---------------------------------------------------------------------------

/** 비교 결과 기반 의사결정 요약 — 추천·미커버·대체·전환 준비 상태 */
export interface QuoteDecisionSummaryVM {
  /** 추천 공급사 이름 */
  recommendedVendorName?: string;
  /** 추천 근거 (한국어, 예: "가격·납기·문서 균형 기준") */
  recommendationBasis: string;
  /** 비교 가능 총 비용 (포맷된 문자열) */
  totalComparableCost?: string;
  /** 미커버 항목 수 */
  uncoveredItemCount: number;
  /** 대체품 항목 수 */
  substituteItemCount: number;
  /** 미응답 공급사 수 */
  missingResponseVendorCount: number;
  /** 발주 전환 준비 상태 */
  conversionReadiness: "ready" | "needs_review" | "blocked";
  /** 전환 차단 사유 목록 (한국어) */
  conversionBlockers: string[];
}

// ---------------------------------------------------------------------------
// 5. 견적 페이지 최상위 뷰모델
// ---------------------------------------------------------------------------

/** 견적 상세 페이지 전체를 구성하는 최상위 뷰모델 */
export interface QuotePageViewModel {
  /** 페이지 헤더 */
  header: {
    /** 페이지 제목 */
    title: string;
    /** 목적 설명 */
    purposeDescription: string;
  };
  /** 견적 요청 정보 */
  request: QuoteRequestListItemVM;
  /** 공급사 응답 목록 */
  vendorResponses: QuoteVendorResponseVM[];
  /** 비교 결과 (비교 단계 진입 시) */
  comparison?: {
    rows: QuoteComparisonRowVM[];
    decision: QuoteDecisionSummaryVM;
  };
  /** 페이지 상태 플래그 */
  pageState: {
    /** 빈 상태 여부 */
    isEmpty: boolean;
    /** 에러 발생 여부 */
    hasError: boolean;
    /** 접근 불가 여부 */
    isUnavailable: boolean;
  };
}

// ---------------------------------------------------------------------------
// 6. 헬퍼 — 마감 상태 계산
// ---------------------------------------------------------------------------

/**
 * 견적 마감 일시를 기준으로 마감 상태를 계산한다.
 *
 * - overdue: 현재 시각이 마감 이후
 * - due_soon: 마감까지 QUOTE_SLA_DEFAULTS.expirationWarningDays 이내
 * - normal: 그 외
 *
 * @param dueAt - 마감 일시 (ISO 8601 문자열)
 * @param now - 기준 시각 (기본: 현재)
 * @returns 마감 상태 객체
 */
export function resolveQuoteDueState(
  dueAt: string,
  now: Date = new Date(),
): { label: string; isOverdue: boolean; tone: "normal" | "due_soon" | "overdue" } {
  const due = new Date(dueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    const overdueDays = Math.abs(Math.floor(diffDays));
    return {
      label: `${overdueDays}일 초과`,
      isOverdue: true,
      tone: "overdue",
    };
  }

  if (diffDays <= QUOTE_SLA_DEFAULTS.expirationWarningDays) {
    const remaining = Math.ceil(diffDays);
    return {
      label: remaining === 0 ? "오늘 마감" : `${remaining}일 남음`,
      isOverdue: false,
      tone: "due_soon",
    };
  }

  return {
    label: `${Math.ceil(diffDays)}일 남음`,
    isOverdue: false,
    tone: "normal",
  };
}

// ---------------------------------------------------------------------------
// 7. 헬퍼 — 응답 진행률 계산
// ---------------------------------------------------------------------------

/**
 * 공급사 목록과 응답 상태를 기반으로 응답 진행률을 계산한다.
 *
 * "responded" 또는 "incomplete" 상태인 공급사를 응답 완료로 간주한다.
 *
 * @param vendorIds - 대상 공급사 ID 목록
 * @param responses - 공급사별 응답 상태
 * @returns 진행률 객체 (한국어 라벨 포함)
 */
export function calculateResponseProgress(
  vendorIds: string[],
  responses: { vendorId: string; responseStatus: QuoteResponseStatus }[],
): { responded: number; total: number; label: string } {
  const total = vendorIds.length;
  const respondedStatuses: QuoteResponseStatus[] = ["responded", "incomplete"];
  const responded = responses.filter(
    (r) =>
      vendorIds.includes(r.vendorId) &&
      respondedStatuses.includes(r.responseStatus),
  ).length;

  return {
    responded,
    total,
    label: `${responded}/${total} 공급사 응답`,
  };
}

// ---------------------------------------------------------------------------
// 8. 헬퍼 — 발주 전환 준비 상태 판단
// ---------------------------------------------------------------------------

/**
 * 비교 결과와 응답 데이터를 기반으로 발주 전환 가능 여부를 판단한다.
 *
 * - blocked: 미응답 50% 초과, 치명적 리스크, 공급사 미선정
 * - needs_review: 검토 필요 행 존재, 대체품 포함, 문서 누락
 * - ready: 전체 커버, 공급사 선정, 치명적 차단 없음
 *
 * @param comparison - 비교 계약 데이터
 * @param responses - 공급사 응답 목록
 * @returns 전환 준비 상태 및 차단 사유 목록
 */
export function resolveConversionReadiness(
  comparison: QuoteComparisonContract,
  responses: QuoteResponseContract[],
): { readiness: "ready" | "needs_review" | "blocked"; blockers: string[] } {
  const blockers: string[] = [];

  // ---- blocked 조건 ----

  // 미응답 비율 50% 초과
  const totalVendors = comparison.vendorsInScope.length;
  const missingCount = comparison.missingResponses.length;
  if (totalVendors > 0 && missingCount / totalVendors > 0.5) {
    blockers.push(
      `미응답 공급사 비율 과다 (${missingCount}/${totalVendors})`,
    );
  }

  // 치명적 리스크 플래그
  const criticalFlags = comparison.riskFlags.filter(
    (f) => f.includes("critical") || f.includes("치명"),
  );
  if (criticalFlags.length > 0) {
    blockers.push(`치명적 리스크 플래그 ${criticalFlags.length}건`);
  }

  // 공급사 미선정
  if (!comparison.recommendedVendorId) {
    blockers.push("추천 공급사가 선정되지 않음");
  }

  if (blockers.length > 0) {
    return { readiness: "blocked", blockers };
  }

  // ---- needs_review 조건 ----
  const reviewReasons: string[] = [];

  // 검토 필요 행
  const reviewRows = comparison.comparableItemRows.filter(
    (row) => row.requiresReview,
  );
  if (reviewRows.length > 0) {
    reviewReasons.push(`검토 필요 항목 ${reviewRows.length}건`);
  }

  // 대체품 존재
  const hasSubstitutes = responses.some((r) =>
    r.responseItems.some((item) => item.substituteOffered),
  );
  if (hasSubstitutes) {
    reviewReasons.push("대체품 제안 항목 존재");
  }

  // 필수 문서 누락
  const hasMissingDocs = comparison.comparableItemRows.some((row) =>
    row.vendorOptions.some((opt) => !opt.hasRequiredDocs),
  );
  if (hasMissingDocs) {
    reviewReasons.push("일부 공급사 필수 문서 미확보");
  }

  if (reviewReasons.length > 0) {
    return { readiness: "needs_review", blockers: reviewReasons };
  }

  // ---- ready ----
  return { readiness: "ready", blockers: [] };
}

// ---------------------------------------------------------------------------
// 9. 헬퍼 — 추천 시나리오 라벨
// ---------------------------------------------------------------------------

/**
 * 추천 시나리오 코드를 한국어 라벨로 변환한다.
 *
 * @param scenario - 추천 시나리오 코드
 * @returns 한국어 라벨
 */
export function buildRecommendationBasis(
  scenario: string | undefined,
): string {
  switch (scenario) {
    case "lowest_cost":
      return "최저 비용 기준";
    case "fastest_delivery":
      return "최단 납기 기준";
    case "best_match":
      return "사양 일치도 기준";
    case "balanced":
      return "가격·납기·문서 균형 기준";
    default:
      return "추천 기준 미정";
  }
}
