/**
 * Reorder / Expiry / Stock Risk 중앙 계약
 *
 * 핵심 원칙:
 * - Receiving/Inventory Inbound 계약 위에 위치하는 재고 위험·재주문·만료 관리 레이어
 * - item-level 재고 상태와 lot-level 만료 상태는 절대 혼합하지 않는다
 * - usable/quarantined/reserved/expiring 수량은 항상 분리 가능해야 한다
 * - 재주문 추천(reorder recommendation)과 만료 조치(expiry action)는 별도 흐름
 * - UI 라벨 없음 — 오직 구조와 상태만 정의
 * - 향후 disposal/recall/cycle count/forecasting 확장 가능
 *
 * 흐름: inventory state → stock risk detection → reorder recommendation
 *       → approval/procurement handoff → expiry/disposal follow-up
 */

// ---------------------------------------------------------------------------
// 1. 재고 위험 상태 (item-level)
// ---------------------------------------------------------------------------

/**
 * 재고 위험 상태 — 품목 수준의 종합 재고 위험도
 *
 * - healthy: 재고 수준이 안전 기준 이상
 * - watch: 재고가 감소 추세이나 아직 재주문 기준 이상
 * - reorder_due: 가용 재고가 재주문 기준 이하
 * - critical_shortage: 가용 재고가 안전 재고 이하로 운영에 즉시 영향
 * - expiry_risk: 사용 가능 재고 중 만료 임박 비율이 높음
 * - quarantine_constrained: 물리적 재고는 있으나 격리로 가용 불가
 * - blocked: 재고 운영이 차단됨
 */
export type InventoryStockRiskStatus =
  | "healthy"
  | "watch"
  | "reorder_due"
  | "critical_shortage"
  | "expiry_risk"
  | "quarantine_constrained"
  | "blocked";

// ---------------------------------------------------------------------------
// 2. 로트 사용 가능 상태 (lot-level)
// ---------------------------------------------------------------------------

/**
 * 로트 사용 가능 상태 — 개별 로트의 물리적·운영적 사용 가능 여부
 *
 * - usable: 정상 사용 가능
 * - restricted: 제한 사용 (조건부 승인 등)
 * - quarantined: 격리 보관 중 (사용 불가)
 * - expired: 유효기간 만료
 * - damaged: 손상
 * - blocked: 운영 차단
 */
export type InventoryLotUsabilityStatus =
  | "usable"
  | "restricted"
  | "quarantined"
  | "expired"
  | "damaged"
  | "blocked";

// ---------------------------------------------------------------------------
// 3. 재주문 정책 상태
// ---------------------------------------------------------------------------

/**
 * 재주문 정책 상태 — 품목별 재주문 정책의 활성 상태
 *
 * - active: 정책 활성, 자동 추천 생성 가능
 * - paused: 일시 중지 (수동 재활성 필요)
 * - manual_override: 수동 관리 전환 (자동 추천 비활성)
 * - archived: 보관 (더 이상 사용하지 않음)
 */
export type ReorderPolicyStatus =
  | "active"
  | "paused"
  | "manual_override"
  | "archived";

// ---------------------------------------------------------------------------
// 4. 재주문 추천 상태
// ---------------------------------------------------------------------------

/**
 * 재주문 추천 상태 — 시스템 생성 또는 수동 생성된 재주문 추천의 진행 상태
 *
 * - open: 추천 생성됨, 검토 대기
 * - under_review: 검토 중
 * - approved_for_quote: 견적 요청 승인됨
 * - converted_to_quote: 견적 요청으로 전환됨
 * - converted_to_po: 구매 발주로 전환됨
 * - deferred: 보류
 * - dismissed: 기각
 * - blocked: 차단 (예산/정책 등)
 */
export type ReorderRecommendationStatus =
  | "open"
  | "under_review"
  | "approved_for_quote"
  | "converted_to_quote"
  | "converted_to_po"
  | "deferred"
  | "dismissed"
  | "blocked";

// ---------------------------------------------------------------------------
// 5. 만료 조치 상태
// ---------------------------------------------------------------------------

/**
 * 만료 조치 상태 — 만료 임박/만료 로트에 대한 후속 조치 진행 상태
 *
 * - open: 조치 생성됨, 실행 대기
 * - in_progress: 조치 진행 중
 * - completed: 조치 완료
 * - dismissed: 기각 (조치 불필요 판단)
 * - blocked: 차단 (외부 요인으로 진행 불가)
 * - overdue: 기한 초과
 */
export type ExpiryActionStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "dismissed"
  | "blocked"
  | "overdue";

// ---------------------------------------------------------------------------
// 6. 재고 포지션 계약 (item-level)
// ---------------------------------------------------------------------------

/**
 * 재고 포지션 계약 — 특정 품목·위치의 수량 스냅샷 및 위험 상태
 *
 * item-level 수량 분해: onHand = available + reserved + quarantined + expired + damaged
 * coverageDays / averageConsumptionRate로 소비 기반 커버리지 판단
 * incomingQuantity / openReorderRequestIds로 중복 재주문 감지
 */
export interface InventoryStockPositionContract {
  /** 포지션 고유 ID */
  id: string;
  /** 워크스페이스 ID */
  workspaceId: string;
  /** 재고 품목 ID */
  inventoryItemId: string;
  /** 카탈로그 품목 ID (연결된 경우) */
  catalogItemId?: string;
  /** 보관 위치 ID */
  locationId: string;
  /** 스냅샷 시점 (ISO 8601) */
  snapshotAt: string;
  /** 실물 보유 수량 (전체) */
  onHandQuantity: number;
  /** 가용 수량 (즉시 사용 가능) */
  availableQuantity: number;
  /** 예약 수량 (프로젝트·실험 등에 배정됨) */
  reservedQuantity: number;
  /** 격리 수량 */
  quarantinedQuantity: number;
  /** 만료 수량 */
  expiredQuantity: number;
  /** 손상 수량 */
  damagedQuantity: number;
  /** 단위 */
  unit: string;
  /** 현재 소비율 기준 커버리지 일수 */
  coverageDays?: number;
  /** 평균 소비율 (단위/일) */
  averageConsumptionRate?: number;
  /** 입고 예정 수량 */
  incomingQuantity?: number;
  /** 진행 중인 재주문 요청 ID 목록 — 중복 감지용 */
  openReorderRequestIds?: string[];
  /** 종합 위험 상태 */
  riskStatus: InventoryStockRiskStatus;
  /** 위험 플래그 목록 (세부 사유) */
  riskFlags: string[];
}

// ---------------------------------------------------------------------------
// 7. 로트 위험 계약 (lot-level)
// ---------------------------------------------------------------------------

/**
 * 로트 위험 계약 — 개별 로트의 수량·만료·격리·사용 가능 상태
 *
 * lot-level 수량 분해: quantityOnHand = quantityAvailable + quantityQuarantined + quantityReserved + quantityExpired
 * 격리 상태(quarantineStatus)와 사용 가능 상태(usabilityStatus) 분리
 * receiving lot / posting line과의 연결로 입고 추적
 */
export interface InventoryLotRiskContract {
  /** 로트 위험 레코드 ID */
  id: string;
  /** 워크스페이스 ID */
  workspaceId: string;
  /** 재고 품목 ID */
  inventoryItemId: string;
  /** 보관 위치 ID */
  locationId: string;
  /** 로트 번호 */
  lotNumber: string;
  /** 유효기간 (ISO 8601 date) */
  expiryDate?: string;
  /** 제조일 (ISO 8601 date) */
  manufacturedAt?: string;
  /** 로트 보유 수량 */
  quantityOnHand: number;
  /** 로트 가용 수량 */
  quantityAvailable: number;
  /** 로트 격리 수량 */
  quantityQuarantined: number;
  /** 로트 예약 수량 */
  quantityReserved: number;
  /** 로트 만료 수량 */
  quantityExpired: number;
  /** 단위 */
  unit: string;
  /** 격리 상태 */
  quarantineStatus:
    | "not_applicable"
    | "pending"
    | "quarantined"
    | "released"
    | "blocked";
  /** 사용 가능 상태 */
  usabilityStatus: InventoryLotUsabilityStatus;
  /** 위험 플래그 목록 */
  riskFlags: string[];
  /** 만료까지 남은 일수 */
  daysToExpiry?: number;
  /** 연결된 입고 로트 ID */
  linkedReceivingLotId?: string;
  /** 연결된 재고 반영 라인 ID */
  linkedPostingLineId?: string;
}

// ---------------------------------------------------------------------------
// 8. 재주문 정책 계약
// ---------------------------------------------------------------------------

/**
 * 재주문 정책 계약 — 품목별 재주문 기준·목표·우선 공급사·예산 연결 정의
 *
 * policyType으로 판단 방식 구분 (threshold / coverage / forecast / project)
 * 정책 비활성이면 자동 추천 생성 안 함
 */
export interface ReorderPolicyContract {
  /** 정책 ID */
  id: string;
  /** 워크스페이스 ID */
  workspaceId: string;
  /** 재고 품목 ID */
  inventoryItemId: string;
  /** 적용 위치 범위 ID (없으면 전체 위치) */
  locationScopeId?: string;
  /** 정책 유형 */
  policyType:
    | "manual_threshold"
    | "coverage_days"
    | "forecast_assisted"
    | "project_based";
  /** 정책 상태 */
  status: ReorderPolicyStatus;
  /** 재주문 기준점 (이 수량 이하이면 재주문 추천) */
  reorderPoint: number;
  /** 목표 재고 수준 */
  targetStockLevel?: number;
  /** 안전 재고 수준 */
  safetyStockLevel?: number;
  /** 최소 주문 수량 */
  minimumOrderQuantity?: number;
  /** 선호 주문 수량 */
  preferredOrderQuantity?: number;
  /** 리드타임 가정 (일) */
  leadTimeDaysAssumption?: number;
  /** 소비 윈도우 (일) — 소비율 계산 기간 */
  consumptionWindowDays?: number;
  /** 우선 공급사 ID */
  preferredVendorId?: string;
  /** 선호 포장 단위 */
  preferredPackSize?: string;
  /** 예산 컨텍스트 ID (예산 영향 계산용) */
  budgetContextId?: string;
  /** 승인 정책 ID (재주문 승인 워크플로) */
  approvalPolicyId?: string;
  /** 대체품 허용 여부 */
  substituteAllowed: boolean;
  /** 비고 */
  notes?: string;
}

// ---------------------------------------------------------------------------
// 9. 재주문 추천 계약
// ---------------------------------------------------------------------------

/**
 * 재주문 추천 계약 — 재고 상태·정책 기반으로 생성된 재주문 추천
 *
 * 추천 → 견적 요청 → PO 전환 lineage 유지
 * 중복 감지용 inventoryItemId + locationId + status 조합 확인
 * 예산 영향·긴급도·차단 사유 포함
 */
export interface ReorderRecommendationContract {
  /** 추천 ID */
  id: string;
  /** 워크스페이스 ID */
  workspaceId: string;
  /** 재고 품목 ID */
  inventoryItemId: string;
  /** 보관 위치 ID */
  locationId: string;
  /** 추천 생성 시점 (ISO 8601) */
  generatedAt: string;
  /** 추천 유형 */
  recommendationType:
    | "below_reorder_point"
    | "coverage_risk"
    | "incoming_gap"
    | "expiry_replacement"
    | "project_demand"
    | "manual_review";
  /** 추천 상태 */
  status: ReorderRecommendationStatus;
  /** 현재 가용 수량 */
  currentAvailableQuantity: number;
  /** 권장 주문 수량 */
  recommendedOrderQuantity: number;
  /** 권장 단위 */
  recommendedUnit: string;
  /** 추천 생성 주체 */
  recommendedBy: "system" | "manual";
  /** 추천 사유 코드 목록 */
  reasonCodes: string[];
  /** 연관 로트 위험 ID 목록 */
  supportingLotRiskIds?: string[];
  /** 근거 재고 포지션 ID */
  supportingStockPositionId: string;
  /** 우선 공급사 ID */
  preferredVendorId?: string;
  /** 우선 소싱 유형 */
  preferredSourceType: "vendor" | "catalog" | "last_po" | "manual";
  /** 연결된 견적 요청 ID */
  linkedQuoteRequestId?: string;
  /** 연결된 구매 발주 ID */
  linkedPurchaseOrderId?: string;
  /** 예산 영향 추정 */
  budgetImpactEstimate?: {
    /** 예상 금액 */
    amount: number;
    /** 통화 코드 */
    currency: string;
    /** 잔여 예산 비율 (%) */
    budgetRemainingPercent?: number;
  };
  /** 긴급도 */
  urgency: "low" | "normal" | "high" | "urgent";
  /** 차단 사유 목록 */
  blockedReasons: string[];
}

// ---------------------------------------------------------------------------
// 10. 만료 조치 계약
// ---------------------------------------------------------------------------

/**
 * 만료 조치 계약 — 만료 임박/만료 로트에 대한 후속 조치 정의
 *
 * lot 기준 운영: lotNumber로 대상 식별
 * 조치 유형별 분리: monitor / consume_first / transfer / quarantine / dispose / replace_order / review
 * 재주문 추천·예외와 연결 가능
 */
export interface ExpiryActionContract {
  /** 조치 ID */
  id: string;
  /** 워크스페이스 ID */
  workspaceId: string;
  /** 재고 품목 ID */
  inventoryItemId: string;
  /** 보관 위치 ID */
  locationId: string;
  /** 로트 번호 */
  lotNumber: string;
  /** 조치 유형 */
  actionType:
    | "monitor"
    | "consume_first"
    | "transfer"
    | "quarantine"
    | "dispose"
    | "replace_order"
    | "review";
  /** 조치 상태 */
  status: ExpiryActionStatus;
  /** 트리거 시점 (ISO 8601) */
  triggeredAt: string;
  /** 트리거 사유 코드 */
  triggerReasonCodes: string[];
  /** 만료까지 남은 일수 */
  daysToExpiry?: number;
  /** 영향받는 수량 */
  affectedQuantity: number;
  /** 단위 */
  unit: string;
  /** 담당자 ID */
  ownerId?: string;
  /** 기한 (ISO 8601) */
  dueAt?: string;
  /** 완료 시점 (ISO 8601) */
  completedAt?: string;
  /** 연결된 예외 ID */
  linkedExceptionId?: string;
  /** 연결된 재주문 추천 ID */
  linkedReorderRecommendationId?: string;
  /** 비고 */
  notes?: string;
}

// ---------------------------------------------------------------------------
// 11. 재고 위험 스냅샷 계약
// ---------------------------------------------------------------------------

/**
 * 재고 위험 스냅샷 계약 — 특정 시점의 전체 재고 위험 요약
 *
 * 위험 분류별 카운트 + 주요 위험 항목 참조 포함
 * dashboard KPI / queue 우선순위에 사용
 */
export interface StockRiskSnapshotContract {
  /** 스냅샷 ID */
  id: string;
  /** 워크스페이스 ID */
  workspaceId: string;
  /** 생성 시점 (ISO 8601) */
  generatedAt: string;
  /** 위치 범위 (없으면 전체) */
  locationId?: string;
  /** 대상 품목 ID 목록 */
  inventoryItemIds: string[];
  /** 위험 요약 카운트 */
  riskSummary: {
    /** 전체 품목 수 */
    totalItems: number;
    /** 정상 품목 수 */
    healthyCount: number;
    /** 관찰 품목 수 */
    watchCount: number;
    /** 재주문 필요 품목 수 */
    reorderDueCount: number;
    /** 긴급 부족 품목 수 */
    criticalShortageCount: number;
    /** 만료 위험 품목 수 */
    expiryRiskCount: number;
    /** 격리 제약 품목 수 */
    quarantineConstrainedCount: number;
    /** 차단 품목 수 */
    blockedCount: number;
  };
  /** 재고 부족 품목 ID 목록 */
  lowStockItemIds: string[];
  /** 만료 임박 로트 참조 목록 */
  expiringLotRefs: StockLotReferenceContract[];
  /** 격리 로트 참조 목록 */
  quarantineLotRefs: StockLotReferenceContract[];
  /** 차단된 재주문 추천 ID 목록 */
  blockedReorderIds: string[];
  /** 긴급 위험 품목 ID 목록 */
  criticalRiskIds: string[];
}

// ---------------------------------------------------------------------------
// 12. 로트 참조 계약
// ---------------------------------------------------------------------------

/**
 * 로트 참조 계약 — 스냅샷에서 사용하는 로트 요약 참조
 */
export interface StockLotReferenceContract {
  /** 재고 품목 ID */
  inventoryItemId: string;
  /** 보관 위치 ID */
  locationId: string;
  /** 로트 번호 */
  lotNumber: string;
  /** 유효기간 (ISO 8601 date) */
  expiryDate?: string;
  /** 수량 */
  quantity: number;
  /** 단위 */
  unit: string;
  /** 위험 플래그 */
  riskFlags: string[];
}

// ---------------------------------------------------------------------------
// 13. 재고 위험 상태 설명 (한국어)
// ---------------------------------------------------------------------------

/** 재고 위험 상태별 라벨·설명·다음 조치 정의 */
export const STOCK_RISK_STATUS_DESCRIPTIONS: Record<
  InventoryStockRiskStatus,
  { label: string; description: string; nextActions: string[] }
> = {
  healthy: {
    label: "정상",
    description: "재고 수준이 안전 기준 이상",
    nextActions: ["모니터링 유지"],
  },
  watch: {
    label: "관찰",
    description: "재고가 감소 추세이나 아직 재주문 기준 이상",
    nextActions: ["소비 추이 확인"],
  },
  reorder_due: {
    label: "재주문 필요",
    description: "가용 재고가 재주문 기준 이하",
    nextActions: ["재주문 추천 확인", "견적 요청"],
  },
  critical_shortage: {
    label: "긴급 부족",
    description: "가용 재고가 안전 재고 이하로 운영에 즉시 영향",
    nextActions: ["긴급 발주", "대체품 확인"],
  },
  expiry_risk: {
    label: "유효기간 위험",
    description: "사용 가능 재고 중 만료 임박 비율이 높음",
    nextActions: ["우선 사용", "교체 발주"],
  },
  quarantine_constrained: {
    label: "격리 제약",
    description: "물리적 재고는 있으나 격리로 가용 불가",
    nextActions: ["격리 해제 검토", "대체품 확인"],
  },
  blocked: {
    label: "차단",
    description: "재고 운영이 차단됨",
    nextActions: ["이슈 해결", "관리자 검토"],
  },
} as const;

// ---------------------------------------------------------------------------
// 14. 재주문 추천 유형 설명 (한국어)
// ---------------------------------------------------------------------------

/** 재주문 추천 유형별 라벨·설명 정의 */
export const REORDER_RECOMMENDATION_TYPE_DESCRIPTIONS: Record<
  ReorderRecommendationContract["recommendationType"],
  { label: string; description: string }
> = {
  below_reorder_point: {
    label: "재주문 기준 도달",
    description: "가용 재고가 설정된 재주문 기준 이하",
  },
  coverage_risk: {
    label: "커버리지 부족",
    description: "현재 소비율 기준 목표 일수 미달",
  },
  incoming_gap: {
    label: "입고 공백",
    description: "예정 입고가 없거나 부족",
  },
  expiry_replacement: {
    label: "만료 대체",
    description: "만료 임박 재고의 교체 필요",
  },
  project_demand: {
    label: "프로젝트 수요",
    description: "프로젝트 계획 기반 추가 수요",
  },
  manual_review: {
    label: "수동 검토",
    description: "자동 판단이 어려워 수동 검토 필요",
  },
} as const;

// ---------------------------------------------------------------------------
// 15. 만료 조치 유형 설명 (한국어)
// ---------------------------------------------------------------------------

/** 만료 조치 유형별 라벨·설명 정의 */
export const EXPIRY_ACTION_TYPE_DESCRIPTIONS: Record<
  ExpiryActionContract["actionType"],
  { label: string; description: string }
> = {
  monitor: {
    label: "모니터링",
    description: "만료까지 여유가 있어 관찰",
  },
  consume_first: {
    label: "우선 사용",
    description: "만료 전 우선 소비 권장",
  },
  transfer: {
    label: "이관",
    description: "다른 위치/팀으로 이관",
  },
  quarantine: {
    label: "격리",
    description: "사용 제한 및 격리 보관",
  },
  dispose: {
    label: "폐기",
    description: "만료/손상으로 폐기 처리",
  },
  replace_order: {
    label: "교체 발주",
    description: "만료 재고 교체를 위한 재발주",
  },
  review: {
    label: "검토",
    description: "상태 확인 및 판단 필요",
  },
} as const;

// ---------------------------------------------------------------------------
// 16. 재고 위험 임계값
// ---------------------------------------------------------------------------

/** 재고 위험 판단 임계값 상수 */
export const STOCK_RISK_THRESHOLDS = {
  /** 만료 위험 (일) — 이 이하이면 danger */
  expiryDangerDays: 30,
  /** 만료 경고 (일) — 이 이하이면 warning */
  expiryWarningDays: 90,
  /** 커버리지 위험 (일) — 이 이하이면 danger */
  coverageDangerDays: 7,
  /** 커버리지 경고 (일) — 이 이하이면 warning */
  coverageWarningDays: 14,
  /** 격리 제약 비율 (%) — onHand 중 quarantined가 이 비율 이상이면 제약 */
  quarantineConstraintPercent: 50,
} as const;

// ---------------------------------------------------------------------------
// 17. 상태 문구 (한국어 — Empty / Error / Unavailable)
// ---------------------------------------------------------------------------

/** 재고 위험 항목 없음 상태 문구 */
export const STOCK_RISK_EMPTY_COPY = {
  title: "재고 위험 항목이 없습니다",
  description: "현재 모든 품목의 재고 수준이 정상입니다",
  actionLabel: "재고 현황 보기",
  actionHref: "/dashboard/inventory",
} as const;

/** 재고 위험 정보 로딩 실패 상태 문구 */
export const STOCK_RISK_ERROR_COPY = {
  title: "재고 위험 정보를 불러오지 못했습니다",
  description: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
} as const;

/** 재고 위험 접근 불가 상태 문구 */
export const STOCK_RISK_UNAVAILABLE_COPY = {
  title: "현재 권한으로 재고 위험 관리에 접근할 수 없습니다",
  description: "재고 관리자 권한이 필요합니다",
  actionLabel: "권한 요청하기",
  actionHref: "/dashboard/support",
} as const;

// ---------------------------------------------------------------------------
// 18. 안티패턴 목록 (한국어)
// ---------------------------------------------------------------------------

/** 재고 위험 관리에서 피해야 할 안티패턴 */
export const STOCK_RISK_ANTI_PATTERNS: string[] = [
  "isLowStock: boolean 하나로 재고 위험을 판단",
  "item-level과 lot-level 위험을 하나의 상태로 혼합",
  "quarantine/expired/damaged를 available과 구분하지 못함",
  "입고 예정(incoming)을 고려하지 않는 재주문 추천",
  "중복 재주문 감지가 불가능한 구조",
  "만료 교체와 부족 재주문을 같은 상태로 처리",
  "preferred vendor/MOQ/lead time을 고려하지 않는 추천",
  "예산 영향 없이 재주문을 추천",
];

// ---------------------------------------------------------------------------
// 19. 코드 리뷰 체크리스트 (한국어)
// ---------------------------------------------------------------------------

/** 재고 위험 관련 코드 리뷰 시 확인 항목 */
export const stockRiskCodeReviewChecklist: string[] = [
  "item stock position과 lot risk가 분리되어 있는가",
  "usable/quarantined/expired/damaged 수량을 구분할 수 있는가",
  "reorder recommendation이 inventory state와 policy를 기반으로 생성되는가",
  "expiry action이 lot 기준으로 운영 가능한가",
  "duplicate reorder/incoming coverage/budget blocker를 계산할 수 있는가",
  "linked quote/po 전환 lineage를 유지할 수 있는가",
  "quarantine 제약과 실제 shortage를 구분할 수 있는가",
  "coverage days와 consumption rate를 반영한 재주문 판단이 가능한가",
  "expiry replacement와 shortage reorder가 분리되는가",
  "이후 disposal/recall/cycle count으로 확장 가능한가",
];
