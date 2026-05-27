/**
 * Reorder / Expiry / Stock Risk 뷰모델 및 헬퍼
 *
 * reorder-expiry-stock-risk-contract.ts 의 중앙 계약을 기반으로
 * UI 렌더링에 필요한 뷰모델 인터페이스와 상태 해석 헬퍼를 정의한다.
 *
 * 원칙:
 * - 모든 라벨·요약 문자열은 한국어
 * - 계약 인터페이스를 직접 UI에 노출하지 않고 VM을 통해 변환
 * - 헬퍼는 순수 함수 — 외부 상태 의존 없음
 */

import type {
  InventoryStockRiskStatus,
  ReorderRecommendationContract,
  ReorderRecommendationStatus,
  ReorderPolicyContract,
  ExpiryActionContract,
  StockRiskSnapshotContract,
} from "./reorder-expiry-stock-risk-contract";

// ---------------------------------------------------------------------------
// 1. 재고 건강 상태 뷰모델 (item-level)
// ---------------------------------------------------------------------------

/**
 * 재고 건강 상태 뷰모델 — 품목 수준의 재고 위험을 UI에 표시하기 위한 구조
 */
export interface InventoryStockHealthVM {
  /** 뷰모델 ID */
  id: string;
  /** 재고 품목 ID */
  inventoryItemId: string;
  /** 품목 표시명 (한국어) */
  itemLabel: string;
  /** 보관 위치명 */
  locationName: string;
  /** 가용 수량 vs 기준 요약 (예: "가용 15 / 기준 20 (부족 5)") */
  availableVsThresholdSummary: string;
  /** 커버리지 요약 (예: "현재 소비율 기준 12일분") */
  coverageSummary?: string;
  /** 입고 예정 요약 (예: "입고 예정 30개 (PO-2041)") */
  incomingSummary?: string;
  /** 위험 상태 라벨 (한국어) */
  riskStatusLabel: string;
  /** 위험 톤 */
  riskTone: "healthy" | "watch" | "warning" | "danger" | "blocked";
  /** 위험 뱃지 목록 */
  riskBadges: string[];
  /** 재주문 진행 상태 */
  reorderState: {
    /** 오픈 추천 존재 여부 */
    hasOpenRecommendation: boolean;
    /** 연결 견적 존재 여부 */
    hasLinkedQuote: boolean;
    /** 연결 PO 존재 여부 */
    hasLinkedPO: boolean;
    /** 상태 라벨 (한국어) */
    label: string;
  };
  /** 차단 사유 (있는 경우) */
  blockedReason?: string;
  /** 상세 링크 */
  href: string;
}

// ---------------------------------------------------------------------------
// 2. 로트 위험 뷰모델 (lot-level)
// ---------------------------------------------------------------------------

/**
 * 로트 위험 뷰모델 — 개별 로트의 만료·격리·사용 가능 상태를 UI에 표시
 */
export interface InventoryLotRiskVM {
  /** 뷰모델 ID */
  id: string;
  /** 재고 품목 ID */
  inventoryItemId: string;
  /** 품목 표시명 */
  itemLabel: string;
  /** 로트 번호 */
  lotNumber: string;
  /** 수량 요약 (예: "가용 8 / 격리 2 / 만료 0") */
  quantitySummary: string;
  /** 만료 상태 */
  expiryState: {
    /** 만료 라벨 (한국어) */
    label: string;
    /** 만료까지 남은 일수 */
    daysToExpiry?: number;
    /** 만료 톤 */
    tone: "normal" | "warning" | "danger" | "expired";
  };
  /** 사용 가능 상태 라벨 (한국어) */
  usabilityLabel: string;
  /** 사용 가능 상태 톤 */
  usabilityTone: string;
  /** 격리 상태 라벨 (한국어) */
  quarantineLabel: string;
  /** 격리 상태 톤 */
  quarantineTone: string;
  /** 위험 뱃지 목록 */
  riskBadges: string[];
  /** 권장 조치 */
  recommendedAction: {
    /** 조치 라벨 (한국어) */
    label: string;
    /** 조치 키 */
    actionKey: string;
  };
  /** 이슈 요약 (있는 경우) */
  issueSummary?: string;
}

// ---------------------------------------------------------------------------
// 3. 재주문 추천 뷰모델
// ---------------------------------------------------------------------------

/**
 * 재주문 추천 뷰모델 — 재주문 추천 항목을 UI에 표시하기 위한 구조
 */
export interface ReorderRecommendationVM {
  /** 뷰모델 ID */
  id: string;
  /** 재고 품목 ID */
  inventoryItemId: string;
  /** 품목 표시명 */
  itemLabel: string;
  /** 보관 위치명 */
  locationName: string;
  /** 추천 유형 라벨 (한국어) */
  recommendationTypeLabel: string;
  /** 긴급도 뱃지 (한국어) */
  urgencyBadge: string;
  /** 긴급도 톤 */
  urgencyTone: "low" | "normal" | "high" | "urgent";
  /** 권장 주문 요약 (예: "20 × 500mL 권장") */
  recommendedOrderSummary: string;
  /** 공급사 힌트 (예: "우선 공급사: Thermo Fisher") */
  vendorHint?: string;
  /** 예산 영향 요약 (예: "예상 ₩450,000 · 잔여 예산 62%") */
  budgetImpactSummary?: string;
  /** 추천 사유 요약 (한국어) */
  reasonSummary: string;
  /** 전환 진행 상태 */
  conversionState: {
    /** 상태 라벨 (한국어) */
    label: string;
    /** 상태 톤 */
    tone: "open" | "in_progress" | "converted" | "blocked";
  };
  /** 차단 사유 (있는 경우) */
  blockedReason?: string;
  /** 상태 라벨 (한국어) */
  statusLabel: string;
  /** 상세 링크 */
  href: string;
}

// ---------------------------------------------------------------------------
// 4. 만료 조치 뷰모델
// ---------------------------------------------------------------------------

/**
 * 만료 조치 뷰모델 — 만료 임박/만료 로트에 대한 조치 항목을 UI에 표시
 */
export interface ExpiryActionVM {
  /** 뷰모델 ID */
  id: string;
  /** 재고 품목 ID */
  inventoryItemId: string;
  /** 품목 표시명 */
  itemLabel: string;
  /** 로트 번호 */
  lotNumber: string;
  /** 조치 유형 라벨 (한국어) */
  actionTypeLabel: string;
  /** 만료까지 남은 일수 요약 (예: "만료까지 23일") */
  daysToExpirySummary: string;
  /** 만료 톤 */
  expiryTone: "normal" | "warning" | "danger" | "expired";
  /** 영향 수량 요약 (예: "500mL × 3") */
  affectedQuantitySummary: string;
  /** 담당자명 */
  ownerName?: string;
  /** 기한 상태 */
  dueState?: {
    /** 기한 라벨 (한국어) */
    label: string;
    /** 기한 초과 여부 */
    isOverdue: boolean;
    /** 기한 톤 */
    tone: "normal" | "due_soon" | "overdue";
  };
  /** 상태 라벨 (한국어) */
  statusLabel: string;
  /** 상태 톤 */
  statusTone: string;
  /** 이슈 요약 (있는 경우) */
  issueSummary?: string;
}

// ---------------------------------------------------------------------------
// 5. 재고 위험 스냅샷 뷰모델
// ---------------------------------------------------------------------------

/**
 * 재고 위험 스냅샷 뷰모델 — 전체 재고 위험 요약을 대시보드에 표시
 */
export interface StockRiskSnapshotVM {
  /** 생성 시점 라벨 (한국어) */
  generatedAtLabel: string;
  /** 재고 부족 품목 수 */
  lowStockCount: number;
  /** 긴급 부족 품목 수 */
  criticalShortageCount: number;
  /** 만료 임박 로트 수 */
  expiringLotCount: number;
  /** 격리 제약 품목 수 */
  quarantineConstraintCount: number;
  /** 차단된 재주문 수 */
  blockedReorderCount: number;
  /** 전체 톤 */
  overallTone: "calm" | "attention" | "critical";
  /** 주요 위험 뱃지 목록 */
  topRiskBadges: string[];
  /** 권장 다음 조치 */
  recommendedNextAction: {
    /** 조치 라벨 (한국어) */
    label: string;
    /** 조치 키 */
    actionKey: string;
    /** 이동 링크 */
    href: string;
  };
}

// ---------------------------------------------------------------------------
// 6. 재고 의사결정 요약 뷰모델
// ---------------------------------------------------------------------------

/**
 * 재고 의사결정 요약 뷰모델 — 재주문·만료·조달 핸드오프 준비 상태 종합
 */
export interface StockDecisionSummaryVM {
  /** 재주문 준비 상태 */
  reorderReadiness: "ready" | "needs_review" | "blocked";
  /** 만료 조치 준비 상태 */
  expiryActionReadiness: "ready" | "partial" | "blocked";
  /** 조달 핸드오프 준비 상태 */
  procurementHandoffReadiness: "ready" | "needs_review" | "blocked";
  /** 미해결 위험 수 */
  openRiskCount: number;
  /** 긴급 위험 수 */
  criticalRiskCount: number;
  /** 만료 임박 로트 수 */
  expiringSoonLotCount: number;
  /** 차단된 재주문 수 */
  blockedReorderCount: number;
  /** 권장 다음 조치 */
  recommendedNextAction: {
    /** 조치 라벨 (한국어) */
    label: string;
    /** 조치 키 */
    actionKey: string;
  };
  /** 권장 다음 담당자 */
  recommendedNextOwner?: string;
}

// ---------------------------------------------------------------------------
// 7. 페이지 뷰모델 (top-level)
// ---------------------------------------------------------------------------

/**
 * 재고 위험 페이지 뷰모델 — 재고 위험 관리 화면의 전체 구조
 */
export interface StockRiskPageViewModel {
  /** 페이지 헤더 */
  header: {
    /** 페이지 제목 */
    title: string;
    /** 목적 설명 */
    purposeDescription: string;
    /** 범위 라벨 */
    scopeLabel: string;
  };
  /** 위험 스냅샷 */
  snapshot: StockRiskSnapshotVM;
  /** 품목별 재고 건강 상태 목록 */
  stockHealth: InventoryStockHealthVM[];
  /** 로트별 위험 목록 */
  lotRisks: InventoryLotRiskVM[];
  /** 재주문 추천 목록 */
  reorderRecommendations: ReorderRecommendationVM[];
  /** 만료 조치 목록 */
  expiryActions: ExpiryActionVM[];
  /** 의사결정 요약 */
  decision: StockDecisionSummaryVM;
  /** 페이지 상태 */
  pageState: {
    /** 데이터 없음 */
    isEmpty: boolean;
    /** 에러 발생 */
    hasError: boolean;
    /** 접근 불가 */
    isUnavailable: boolean;
  };
}

// ---------------------------------------------------------------------------
// 8. 재고 위험 톤 해석
// ---------------------------------------------------------------------------

/**
 * 재고 위험 상태를 UI 톤으로 변환
 *
 * - healthy → healthy
 * - watch → watch
 * - reorder_due, expiry_risk → warning
 * - critical_shortage, quarantine_constrained → danger
 * - blocked → blocked
 */
export function resolveStockRiskTone(
  riskStatus: InventoryStockRiskStatus,
): "healthy" | "watch" | "warning" | "danger" | "blocked" {
  switch (riskStatus) {
    case "healthy":
      return "healthy";
    case "watch":
      return "watch";
    case "reorder_due":
    case "expiry_risk":
      return "warning";
    case "critical_shortage":
    case "quarantine_constrained":
      return "danger";
    case "blocked":
      return "blocked";
  }
}

// ---------------------------------------------------------------------------
// 9. 만료 톤 해석
// ---------------------------------------------------------------------------

/**
 * 만료까지 남은 일수를 UI 톤으로 변환
 *
 * - undefined 또는 > 90일 → normal
 * - <= 90일 → warning
 * - <= 30일 → danger
 * - <= 0일 → expired
 */
export function resolveExpiryTone(
  daysToExpiry: number | undefined,
): "normal" | "warning" | "danger" | "expired" {
  if (daysToExpiry === undefined || daysToExpiry > 90) return "normal";
  if (daysToExpiry <= 0) return "expired";
  if (daysToExpiry <= 30) return "danger";
  return "warning";
}

// ---------------------------------------------------------------------------
// 10. 재주문 준비 상태 해석
// ---------------------------------------------------------------------------

/**
 * 재주문 추천의 실행 준비 상태를 판단
 *
 * blocked 조건: 활성 정책 없음(manual_review 제외), 추천 수량 0 이하, 중복 오픈, 치명적 차단 사유
 * needs_review 조건: 우선 공급사 없음, 예산 영향 임계값 초과
 * ready: 그 외
 *
 * @param recommendation 재주문 추천 계약
 * @param policy 재주문 정책 (있는 경우)
 * @param existingOpenRecommendations 동일 품목·위치의 기존 오픈 추천 ID 목록
 */
export function resolveReorderReadiness(
  recommendation: ReorderRecommendationContract,
  policy?: ReorderPolicyContract,
  existingOpenRecommendations?: string[],
): { readiness: "ready" | "needs_review" | "blocked"; blockers: string[] } {
  const blockers: string[] = [];

  // blocked 조건
  if (
    !policy &&
    recommendation.recommendationType !== "manual_review"
  ) {
    blockers.push("활성 재주문 정책 없음");
  }
  if (policy && policy.status !== "active") {
    blockers.push("재주문 정책이 비활성 상태");
  }
  if (recommendation.recommendedOrderQuantity <= 0) {
    blockers.push("추천 주문 수량이 0 이하");
  }
  if (
    existingOpenRecommendations &&
    existingOpenRecommendations.length > 0 &&
    existingOpenRecommendations.some((id) => id !== recommendation.id)
  ) {
    blockers.push("동일 품목·위치에 이미 오픈 추천 존재");
  }
  if (recommendation.blockedReasons.length > 0) {
    blockers.push(...recommendation.blockedReasons);
  }

  if (blockers.length > 0) {
    return { readiness: "blocked", blockers };
  }

  // needs_review 조건
  const reviewReasons: string[] = [];
  if (!recommendation.preferredVendorId) {
    reviewReasons.push("우선 공급사 미지정");
  }
  if (
    recommendation.budgetImpactEstimate &&
    recommendation.budgetImpactEstimate.budgetRemainingPercent !== undefined &&
    recommendation.budgetImpactEstimate.budgetRemainingPercent < 20
  ) {
    reviewReasons.push("잔여 예산 20% 미만");
  }

  if (reviewReasons.length > 0) {
    return { readiness: "needs_review", blockers: reviewReasons };
  }

  return { readiness: "ready", blockers: [] };
}

// ---------------------------------------------------------------------------
// 11. 만료 조치 준비 상태 해석
// ---------------------------------------------------------------------------

/**
 * 만료 조치의 실행 준비 상태를 판단
 *
 * blocked: 영향 수량 미확인, 조치 유형 미결정
 * partial: 담당자 없음, 기한 없음
 * ready: 로트 식별됨, 조치 유형·수량·담당자·기한 모두 확인
 *
 * @param action 만료 조치 계약
 */
export function resolveExpiryActionReadiness(
  action: ExpiryActionContract,
): { readiness: "ready" | "partial" | "blocked"; blockers: string[] } {
  const blockers: string[] = [];

  // blocked 조건
  if (action.affectedQuantity <= 0) {
    blockers.push("영향 수량 미확인");
  }
  if (!action.actionType) {
    blockers.push("조치 유형 미결정");
  }

  if (blockers.length > 0) {
    return { readiness: "blocked", blockers };
  }

  // partial 조건
  const partialReasons: string[] = [];
  if (!action.ownerId) {
    partialReasons.push("담당자 미지정");
  }
  if (!action.dueAt) {
    partialReasons.push("기한 미설정");
  }

  if (partialReasons.length > 0) {
    return { readiness: "partial", blockers: partialReasons };
  }

  return { readiness: "ready", blockers: [] };
}

// ---------------------------------------------------------------------------
// 12. 조달 핸드오프 준비 상태 해석
// ---------------------------------------------------------------------------

/**
 * 재주문 추천의 조달 핸드오프 준비 상태를 판단
 *
 * blocked: status가 blocked/dismissed, 추천 수량 없음
 * needs_review: 우선 공급사 없음, 예산 영향 높음, 대체 불가인데 필요
 * ready: approved_for_quote 또는 open이며 차단 없음
 *
 * @param recommendation 재주문 추천 계약
 */
export function resolveProcurementHandoffReadiness(
  recommendation: ReorderRecommendationContract,
): { readiness: "ready" | "needs_review" | "blocked"; blockers: string[] } {
  const blockers: string[] = [];

  // blocked 조건
  if (
    recommendation.status === "blocked" ||
    recommendation.status === "dismissed"
  ) {
    blockers.push(`추천 상태: ${recommendation.status}`);
  }
  if (recommendation.recommendedOrderQuantity <= 0) {
    blockers.push("추천 주문 수량 없음");
  }

  if (blockers.length > 0) {
    return { readiness: "blocked", blockers };
  }

  // needs_review 조건
  const reviewReasons: string[] = [];
  if (!recommendation.preferredVendorId) {
    reviewReasons.push("우선 공급사 미지정");
  }
  if (
    recommendation.budgetImpactEstimate &&
    recommendation.budgetImpactEstimate.budgetRemainingPercent !== undefined &&
    recommendation.budgetImpactEstimate.budgetRemainingPercent < 20
  ) {
    reviewReasons.push("잔여 예산 20% 미만");
  }

  if (reviewReasons.length > 0) {
    return { readiness: "needs_review", blockers: reviewReasons };
  }

  return { readiness: "ready", blockers: [] };
}

// ---------------------------------------------------------------------------
// 13. 중복 재주문 추천 감지
// ---------------------------------------------------------------------------

/** 중복 감지 대상 상태 */
const ACTIVE_RECOMMENDATION_STATUSES: ReorderRecommendationStatus[] = [
  "open",
  "under_review",
  "approved_for_quote",
];

/**
 * 동일 품목·위치에서 활성 상태인 재주문 추천 중복을 감지
 *
 * @param recommendations 재주문 추천 목록 (최소 필드)
 * @returns 중복 쌍 목록
 */
export function detectDuplicateReorderRecommendations(
  recommendations: {
    id: string;
    inventoryItemId: string;
    locationId: string;
    status: ReorderRecommendationStatus;
  }[],
): { recommendationA: string; recommendationB: string; reason: string }[] {
  const duplicates: {
    recommendationA: string;
    recommendationB: string;
    reason: string;
  }[] = [];

  const activeRecs = recommendations.filter((r) =>
    ACTIVE_RECOMMENDATION_STATUSES.includes(r.status),
  );

  for (let i = 0; i < activeRecs.length; i++) {
    for (let j = i + 1; j < activeRecs.length; j++) {
      const a = activeRecs[i]!;
      const b = activeRecs[j]!;
      if (
        a.inventoryItemId === b.inventoryItemId &&
        a.locationId === b.locationId
      ) {
        duplicates.push({
          recommendationA: a.id,
          recommendationB: b.id,
          reason: `동일 품목(${a.inventoryItemId}) · 위치(${a.locationId})에 활성 추천 중복`,
        });
      }
    }
  }

  return duplicates;
}

// ---------------------------------------------------------------------------
// 14. 스냅샷 톤 해석
// ---------------------------------------------------------------------------

/**
 * 재고 위험 스냅샷의 전체 톤을 판단
 *
 * - critical: criticalRiskIds 존재
 * - attention: lowStockItemIds 또는 expiringLotRefs 존재
 * - calm: 그 외
 */
export function resolveSnapshotTone(
  snapshot: StockRiskSnapshotContract,
): "calm" | "attention" | "critical" {
  if (snapshot.criticalRiskIds.length > 0) return "critical";
  if (
    snapshot.lowStockItemIds.length > 0 ||
    snapshot.expiringLotRefs.length > 0
  ) {
    return "attention";
  }
  return "calm";
}

// ---------------------------------------------------------------------------
// 15. 커버리지 요약 포맷
// ---------------------------------------------------------------------------

/**
 * 커버리지 일수와 소비율을 한국어 요약 문자열로 변환
 *
 * @param coverageDays 커버리지 일수
 * @param consumptionRate 평균 소비율 (단위/일)
 * @returns 한국어 요약 문자열
 */
export function formatCoverageSummary(
  coverageDays: number | undefined,
  consumptionRate: number | undefined,
): string {
  if (coverageDays === undefined || consumptionRate === undefined) {
    return "소비 데이터 없음";
  }
  if (consumptionRate <= 0) {
    return "소비 기록 없음";
  }
  return `현재 소비율 기준 ${coverageDays}일분`;
}
