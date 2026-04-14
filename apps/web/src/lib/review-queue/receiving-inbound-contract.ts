/**
 * Receiving / Inventory Inbound 운영 흐름 중앙 계약
 *
 * 핵심 원칙:
 * - PO/Approval 계약 위에 위치하는 입고·재고 반영 레이어
 * - 입고 상태(receiving)와 재고 반영 상태(inventory posting)는 절대 혼합하지 않는다
 * - arrived ≠ posted — 도착과 재고 반영은 별도 상태
 * - 검수(inspection) 통과 후에만 출고 가능, 중간 상태는 quarantine
 * - line-level partial/over/rejected는 header 집계와 분리
 * - Lot 중심 구조 — 향후 stock risk/reorder/expiry 관리 연결
 * - UI 라벨 없음 — 오직 구조와 상태만 정의
 *
 * 흐름: PO 발행 → 배송/도착 추적 → 수령 기록 → 검수 완료 → 재고 반영 → 예외 후속 처리
 */

// ---------------------------------------------------------------------------
// 1. 입고 배치 상태
// ---------------------------------------------------------------------------

/**
 * 입고 배치 상태 — expected → cancelled 까지 운영 흐름 전체를 표현
 *
 * - expected: 공급사 출하 확인됨, 도착 대기
 * - arrived: 물품 도착, 수량 확인 필요
 * - partially_received: 일부 품목만 수령됨
 * - received: 모든 품목 수령 확인
 * - inspection_in_progress: 품질/문서/수량 검수 진행 중
 * - ready_to_post: 검수 완료, 재고 반영 가능
 * - posted: 재고 시스템에 반영 완료
 * - issue_flagged: 손상/문서 누락/수량 불일치 등 이슈 발생
 * - closed: 입고 처리 완료 (마감)
 * - cancelled: 입고 취소됨
 */
export type ReceivingBatchStatus =
  | "expected"
  | "arrived"
  | "partially_received"
  | "received"
  | "inspection_in_progress"
  | "ready_to_post"
  | "posted"
  | "issue_flagged"
  | "closed"
  | "cancelled";

// ---------------------------------------------------------------------------
// 2. 입고 라인 수령 상태
// ---------------------------------------------------------------------------

/**
 * 입고 라인 수령 상태 — 개별 품목의 수령 진행 상황
 *
 * - pending: 수령 대기
 * - received: 정상 수령
 * - partially_received: 부분 수령
 * - over_received: 초과 수령
 * - missing: 누락
 * - rejected: 반품/거부
 * - posted: 재고 반영 완료
 * - issue_flagged: 이슈 발생
 */
export type ReceivingLineReceiptStatus =
  | "pending"
  | "received"
  | "partially_received"
  | "over_received"
  | "missing"
  | "rejected"
  | "posted"
  | "issue_flagged";

// ---------------------------------------------------------------------------
// 3. 수령 상태(컨디션)
// ---------------------------------------------------------------------------

/**
 * 수령 물품 상태 — 물리적 상태 기록
 *
 * - ok: 정상
 * - damaged: 파손
 * - leaking: 누수
 * - temperature_excursion: 온도 이탈
 * - packaging_issue: 포장 불량
 * - label_issue: 라벨 문제
 * - unknown: 미확인
 */
export type ReceivedConditionStatus =
  | "ok"
  | "damaged"
  | "leaking"
  | "temperature_excursion"
  | "packaging_issue"
  | "label_issue"
  | "unknown";

// ---------------------------------------------------------------------------
// 4. 입고 문서 상태
// ---------------------------------------------------------------------------

/**
 * 입고 관련 문서 상태 — COA, MSDS, Validation 등 문서 구비 여부
 *
 * - complete: 모든 문서 구비
 * - partial: 일부 문서만 있음
 * - missing: 문서 누락
 * - not_required: 문서 불요
 * - needs_review: 문서 검토 필요
 */
export type ReceivingDocumentStatus =
  | "complete"
  | "partial"
  | "missing"
  | "not_required"
  | "needs_review";

// ---------------------------------------------------------------------------
// 5. 입고 검수 상태
// ---------------------------------------------------------------------------

/**
 * 입고 검수 상태 — 검수 절차 진행 상태
 *
 * - not_required: 검수 불요
 * - pending: 검수 대기
 * - in_progress: 검수 진행 중
 * - passed: 합격
 * - failed: 불합격
 * - conditional_pass: 조건부 합격
 * - reinspect_required: 재검수 필요
 */
export type ReceivingInspectionStatus =
  | "not_required"
  | "pending"
  | "in_progress"
  | "passed"
  | "failed"
  | "conditional_pass"
  | "reinspect_required";

// ---------------------------------------------------------------------------
// 6. Lot 격리(검역) 상태
// ---------------------------------------------------------------------------

/**
 * Lot 격리 상태 — lot 단위 quarantine 관리
 *
 * - not_applicable: 격리 불요
 * - pending: 격리 판정 대기
 * - quarantined: 격리 중
 * - released: 출고 허가
 * - blocked: 출고 차단
 */
export type LotQuarantineStatus =
  | "not_applicable"
  | "pending"
  | "quarantined"
  | "released"
  | "blocked";

// ---------------------------------------------------------------------------
// 7. 재고 반영 상태
// ---------------------------------------------------------------------------

/**
 * 재고 반영(Inventory Inbound Posting) 상태
 *
 * - pending: 반영 대기
 * - ready: 반영 가능
 * - partially_posted: 부분 반영
 * - posted: 반영 완료
 * - blocked: 반영 차단
 * - cancelled: 반영 취소
 */
export type InventoryInboundPostingStatus =
  | "pending"
  | "ready"
  | "partially_posted"
  | "posted"
  | "blocked"
  | "cancelled";

// ---------------------------------------------------------------------------
// 8. 배송 기대 상태
// ---------------------------------------------------------------------------

/**
 * 배송 기대(Shipment Expectation) 상태 — PO 발행 후 배송 추적
 *
 * - awaiting_vendor_confirmation: 공급사 출하 확인 대기
 * - scheduled: 출하 예정
 * - in_transit: 배송 중
 * - arrived: 도착 완료
 * - delayed: 지연
 * - partially_arrived: 부분 도착
 * - cancelled: 취소
 */
export type ShipmentExpectationStatus =
  | "awaiting_vendor_confirmation"
  | "scheduled"
  | "in_transit"
  | "arrived"
  | "delayed"
  | "partially_arrived"
  | "cancelled";

// ---------------------------------------------------------------------------
// 9. 배송 기대 라인 상태
// ---------------------------------------------------------------------------

/**
 * 배송 기대 라인 상태 — 개별 품목의 배송 진행 상태
 *
 * - scheduled: 출하 예정
 * - in_transit: 배송 중
 * - arrived: 도착
 * - partial: 부분 도착
 * - backordered: 재입고 대기
 * - delayed: 지연
 * - cancelled: 취소
 */
export type ShipmentExpectationLineStatus =
  | "scheduled"
  | "in_transit"
  | "arrived"
  | "partial"
  | "backordered"
  | "delayed"
  | "cancelled";

// ---------------------------------------------------------------------------
// 10. 입고 배치 계약
// ---------------------------------------------------------------------------

/**
 * 입고 배치 계약 — 하나의 배송 단위에 대한 입고 기록 전체
 *
 * - sourceType으로 입고 원천 구분 (발주, 반품, 이관, 샘플)
 * - lineReceipts로 품목별 수령 상세 관리
 * - exceptionIds로 예외 처리 연동
 */
export interface ReceivingBatchContract {
  /** 입고 배치 고유 ID */
  id: string;
  /** 워크스페이스 ID */
  workspaceId: string;
  /** 입고 번호 (시스템 채번) */
  receivingNumber: string;
  /** 입고 배치 상태 */
  status: ReceivingBatchStatus;
  /** 입고 원천 유형 */
  sourceType: "purchase_order" | "manual_return" | "transfer" | "sample";
  /** 연결된 발주서 ID */
  poId?: string;
  /** 공급사 ID */
  vendorId?: string;
  /** 입고 장소 */
  shipToLocation: string;
  /** 수령 일시 (ISO 8601) */
  receivedAt: string;
  /** 수령자 ID */
  receivedBy: string;
  /** 확인자 ID */
  checkedBy?: string;
  /** 운송사 이름 */
  carrierName?: string;
  /** 운송 추적 번호 */
  trackingNumber?: string;
  /** 배송 참조 번호 */
  deliveryReference?: string;
  /** 비고 */
  notes?: string;
  /** 첨부 파일 목록 */
  attachments?: { id: string; name: string; type: string }[];
  /** 품목별 수령 기록 */
  lineReceipts: ReceivingLineReceiptContract[];
  /** 연결된 예외 처리 ID 목록 */
  exceptionIds?: string[];
}

// ---------------------------------------------------------------------------
// 11. 입고 라인 수령 계약
// ---------------------------------------------------------------------------

/**
 * 입고 라인 수령 계약 — 개별 품목의 수령 상세
 *
 * - PO line 기준 lineage 추적 가능
 * - lot 단위 기록으로 expiry/quarantine 관리
 * - 검수 요구/결과, 문서 상태, 컨디션 상태 분리
 */
export interface ReceivingLineReceiptContract {
  /** 라인 수령 고유 ID */
  id: string;
  /** 입고 배치 ID */
  receivingBatchId: string;
  /** 연결된 PO 라인 ID */
  poLineId?: string;
  /** 연결된 재고 항목 ID */
  inventoryItemId?: string;
  /** 연결된 카탈로그 항목 ID */
  catalogItemId?: string;
  /** 라인 번호 */
  lineNumber: number;
  /** 품목명 */
  itemName: string;
  /** 제조사 */
  manufacturer?: string;
  /** 카탈로그 번호 */
  catalogNumber?: string;
  /** 주문 수량 */
  orderedQuantity?: number;
  /** 수령 수량 */
  receivedQuantity: number;
  /** 수령 단위 */
  receivedUnit: string;
  /** 포장 단위 */
  packSize?: string;
  /** 수령 상태 */
  receiptStatus: ReceivingLineReceiptStatus;
  /** 물품 상태 */
  conditionStatus: ReceivedConditionStatus;
  /** 온도 상태 */
  temperatureStatus?: "normal" | "excursion_minor" | "excursion_major" | "unknown";
  /** 문서 상태 */
  documentStatus: ReceivingDocumentStatus;
  /** 검수 필요 여부 */
  inspectionRequired: boolean;
  /** 검수 상태 */
  inspectionStatus: ReceivingInspectionStatus;
  /** Lot 기록 목록 */
  lotRecords: ReceivedLotRecordContract[];
  /** 편차 메모 */
  deviationNotes?: string[];
  /** 위험 플래그 */
  riskFlags: string[];
}

// ---------------------------------------------------------------------------
// 12. 수령 Lot 기록 계약
// ---------------------------------------------------------------------------

/**
 * 수령 Lot 기록 계약 — lot 단위 상세 기록
 *
 * - lot/serial 번호, 유효기한, 제조일 관리
 * - COA/MSDS/Validation/Warranty 문서 첨부 여부
 * - quarantine 상태로 출고 가능 여부 관리
 * - inventoryPostingId로 재고 반영 연동
 */
export interface ReceivedLotRecordContract {
  /** Lot 기록 고유 ID */
  id: string;
  /** 입고 라인 수령 ID */
  receivingLineReceiptId: string;
  /** Lot 번호 */
  lotNumber: string;
  /** 시리얼 번호 */
  serialNumber?: string;
  /** 유효기한 (ISO 8601) */
  expiryDate?: string;
  /** 제조일 (ISO 8601) */
  manufacturedAt?: string;
  /** 수량 */
  quantity: number;
  /** 단위 */
  unit: string;
  /** 보관 조건 */
  storageCondition?: string;
  /** COA 첨부 여부 */
  coaAttached: boolean;
  /** MSDS 첨부 여부 */
  msdsAttached: boolean;
  /** Validation 문서 첨부 여부 */
  validationAttached: boolean;
  /** Warranty 문서 첨부 여부 */
  warrantyAttached: boolean;
  /** 라벨 상태 */
  labelStatus: "ok" | "missing" | "mismatch";
  /** Lot 격리 상태 */
  quarantineStatus: LotQuarantineStatus;
  /** 연결된 재고 반영 ID */
  inventoryPostingId?: string;
  /** 비고 */
  notes?: string;
}

// ---------------------------------------------------------------------------
// 13. 입고 검수 계약
// ---------------------------------------------------------------------------

/**
 * 입고 검수 계약 — 검수 항목별 결과 기록
 *
 * - inspectionType으로 검수 유형 구분 (수량/문서/품질/포장/온도/규정)
 * - decision과 status 분리 — 검수 진행 상태와 판정 결과는 별개
 * - followUpActionIds로 후속 조치 연동
 */
export interface ReceivingInspectionContract {
  /** 검수 고유 ID */
  id: string;
  /** 입고 라인 수령 ID */
  receivingLineReceiptId: string;
  /** 검수 유형 */
  inspectionType: "quantity" | "document" | "quality" | "packaging" | "temperature" | "compliance";
  /** 검수 상태 */
  status: ReceivingInspectionStatus;
  /** 검수 일시 (ISO 8601) */
  inspectedAt?: string;
  /** 검수자 ID */
  inspectedBy?: string;
  /** 검수 소견 */
  findings?: string[];
  /** 검수 판정 */
  decision: "pass" | "fail" | "conditional" | "reinspect_required";
  /** 후속 조치 ID 목록 */
  followUpActionIds?: string[];
}

// ---------------------------------------------------------------------------
// 14. 재고 반영 계약
// ---------------------------------------------------------------------------

/**
 * 재고 반영(Inventory Inbound Posting) 계약 — 입고 → 재고 시스템 반영
 *
 * - receivingBatchId로 입고 배치와 연결
 * - postingLines로 라인별 반영 상세 관리
 * - blockedReasons로 반영 차단 사유 추적
 */
export interface InventoryInboundPostingContract {
  /** 재고 반영 고유 ID */
  id: string;
  /** 워크스페이스 ID */
  workspaceId: string;
  /** 재고 반영 번호 (시스템 채번) */
  postingNumber: string;
  /** 반영 상태 */
  status: InventoryInboundPostingStatus;
  /** 연결된 입고 배치 ID */
  receivingBatchId: string;
  /** 반영 일시 (ISO 8601) */
  postedAt?: string;
  /** 반영자 ID */
  postedBy?: string;
  /** 입고 목적지 위치 ID */
  destinationLocationId: string;
  /** 반영 라인 목록 */
  postingLines: InventoryInboundPostingLineContract[];
  /** 반영 차단 사유 목록 */
  blockedReasons: string[];
}

// ---------------------------------------------------------------------------
// 15. 재고 반영 라인 계약
// ---------------------------------------------------------------------------

/**
 * 재고 반영 라인 계약 — lot 단위 재고 반영 상세
 *
 * - lot/expiry 정보 포함
 * - inventoryStatusAfterPosting으로 반영 후 재고 상태 구분
 * - followUpReasonCodes로 후속 조치 필요 사유 추적
 */
export interface InventoryInboundPostingLineContract {
  /** 반영 라인 고유 ID */
  id: string;
  /** 재고 반영 ID */
  postingId: string;
  /** 입고 라인 수령 ID */
  receivingLineReceiptId: string;
  /** Lot 기록 ID */
  lotRecordId: string;
  /** 재고 항목 ID */
  inventoryItemId: string;
  /** 보관 위치 ID */
  locationId: string;
  /** 반영 수량 */
  quantityPosted: number;
  /** 단위 */
  unit: string;
  /** 반영 후 재고 상태 */
  inventoryStatusAfterPosting: "available" | "quarantined" | "restricted" | "expired";
  /** Lot 번호 */
  lotNumber: string;
  /** 유효기한 (ISO 8601) */
  expiryDate?: string;
  /** 후속 조치 필요 여부 */
  requiresFollowUp: boolean;
  /** 후속 조치 사유 코드 목록 */
  followUpReasonCodes: string[];
}

// ---------------------------------------------------------------------------
// 16. 배송 기대 계약
// ---------------------------------------------------------------------------

/**
 * 배송 기대(Shipment Expectation) 계약 — PO 발행 후 배송 추적
 *
 * - PO/공급사 연결
 * - 예정 출하일/도착일/실제 도착일 관리
 * - lineExpectations로 품목별 배송 상태 추적
 * - riskFlags로 배송 위험 표시
 */
export interface ShipmentExpectationContract {
  /** 배송 기대 고유 ID */
  id: string;
  /** 발주서 ID */
  poId: string;
  /** 공급사 ID */
  vendorId: string;
  /** 배송 기대 상태 */
  status: ShipmentExpectationStatus;
  /** 예정 출하일 (ISO 8601) */
  promisedShipAt?: string;
  /** 예정 도착일 (ISO 8601) */
  promisedDeliveryAt?: string;
  /** 실제 도착일 (ISO 8601) */
  actualArrivalAt?: string;
  /** 운송사 이름 */
  carrierName?: string;
  /** 운송 추적 번호 */
  trackingNumber?: string;
  /** 품목별 배송 기대 */
  lineExpectations: ShipmentExpectationLineContract[];
  /** 배송 위험 플래그 */
  riskFlags: string[];
}

// ---------------------------------------------------------------------------
// 17. 배송 기대 라인 계약
// ---------------------------------------------------------------------------

/**
 * 배송 기대 라인 계약 — 개별 품목의 배송 진행 상세
 *
 * - PO 라인 연결
 * - 기대 수량/도착일/배송 상태 관리
 * - backorder/대체품 추적
 */
export interface ShipmentExpectationLineContract {
  /** PO 라인 ID */
  poLineId: string;
  /** 기대 수량 */
  expectedQuantity: number;
  /** 기대 도착일 (ISO 8601) */
  expectedDeliveryAt?: string;
  /** 배송 라인 상태 */
  shipmentStatus: ShipmentExpectationLineStatus;
  /** 미입고(백오더) 수량 */
  backorderQuantity?: number;
  /** 대체품 배송 중 여부 */
  substituteInTransit: boolean;
  /** 이슈 목록 */
  issues?: string[];
}

// ---------------------------------------------------------------------------
// 18. 입고 배치 상태 설명 (한국어)
// ---------------------------------------------------------------------------

/** 입고 배치 상태별 라벨·설명·다음 조치 매핑 */
export const RECEIVING_BATCH_STATUS_DESCRIPTIONS: Record<
  ReceivingBatchStatus,
  { label: string; description: string; nextActions: string[] }
> = {
  expected: {
    label: "입고 예정",
    description: "공급사 출하 확인됨, 도착 대기",
    nextActions: ["도착 확인", "배송 추적"],
  },
  arrived: {
    label: "도착",
    description: "물품이 도착함, 수량 확인 필요",
    nextActions: ["수령 확인", "검수 시작"],
  },
  partially_received: {
    label: "부분 수령",
    description: "일부 품목만 수령됨",
    nextActions: ["나머지 대기", "부분 검수"],
  },
  received: {
    label: "수령 완료",
    description: "모든 품목 수령 확인됨",
    nextActions: ["검수 시작", "재고 반영 준비"],
  },
  inspection_in_progress: {
    label: "검수 중",
    description: "품질/문서/수량 검수 진행 중",
    nextActions: ["검수 완료", "이슈 등록"],
  },
  ready_to_post: {
    label: "반영 준비",
    description: "검수 완료, 재고 반영 가능",
    nextActions: ["재고 반영", "최종 확인"],
  },
  posted: {
    label: "반영 완료",
    description: "재고 시스템에 반영됨",
    nextActions: ["마감"],
  },
  issue_flagged: {
    label: "이슈 발생",
    description: "손상, 문서 누락, 수량 불일치 등 이슈",
    nextActions: ["이슈 해결", "반품 처리"],
  },
  closed: {
    label: "마감",
    description: "입고 처리 완료",
    nextActions: [],
  },
  cancelled: {
    label: "취소",
    description: "입고 취소됨",
    nextActions: [],
  },
} as const;

// ---------------------------------------------------------------------------
// 19. 입고 SLA 기본값
// ---------------------------------------------------------------------------

/** 입고 관련 SLA 기본값 — 검수/반영/만료 경고 기준 */
export const RECEIVING_SLA_DEFAULTS = {
  /** 도착 후 검수 완료까지 허용 시간(시간) */
  inspectionHoursAfterArrival: 24,
  /** 검수 후 재고 반영까지 허용 시간(시간) */
  postingHoursAfterInspection: 8,
  /** 유효기한 경고 기준 일수 */
  expiryWarningDays: 90,
  /** 유효기한 위험 기준 일수 */
  expiryDangerDays: 30,
  /** 초과 시 overdue 배지 표시 기준 시간 */
  overdueBadgeAfterHours: 48,
} as const;

// ---------------------------------------------------------------------------
// 20. 입고 빈 상태 / 에러 / 권한 없음 문구 (한국어)
// ---------------------------------------------------------------------------

/** 입고 대기 항목 없음 문구 */
export const RECEIVING_EMPTY_COPY = {
  title: "입고 대기 항목이 없습니다",
  body: "발주 후 공급사 출하가 확인되면 입고 대기 목록에 표시됩니다",
  actionLabel: "발주 목록 보기",
  actionHref: "/dashboard/orders",
} as const;

/** 입고 정보 로드 오류 문구 */
export const RECEIVING_ERROR_COPY = {
  title: "입고 정보를 불러오지 못했습니다",
  body: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
} as const;

/** 입고 관리 접근 불가 문구 */
export const RECEIVING_UNAVAILABLE_COPY = {
  title: "현재 권한으로 입고 관리에 접근할 수 없습니다",
  body: "재고 관리자 권한이 필요합니다",
  actionLabel: "권한 요청하기",
  actionHref: "/dashboard/support-center?tab=ticket",
} as const;

// ---------------------------------------------------------------------------
// 21. 입고 안티패턴 목록 (한국어)
// ---------------------------------------------------------------------------

/** 입고 모델링 시 반드시 피해야 할 안티패턴 */
export const RECEIVING_ANTI_PATTERNS: string[] = [
  "received와 posted를 같은 상태로 취급",
  "lot 없는 입고 모델",
  "line-level receipt 없이 header만 있는 구조",
  "isInspected: boolean 같은 단순 플래그로 검수 관리",
  "quarantine와 available 재고를 구분할 수 없는 구조",
  "문서 누락/손상/expiry risk를 구분하지 못하는 구조",
  "부분 입고/초과 입고/반품을 표현할 수 없는 구조",
  "입고 이벤트와 재고 반영 이벤트를 분리하지 않는 구조",
];

// ---------------------------------------------------------------------------
// 22. 입고 코드 리뷰 체크리스트 (한국어)
// ---------------------------------------------------------------------------

/** 입고 구현 시 코드 리뷰에서 확인해야 할 체크리스트 */
export const receivingCodeReviewChecklist: string[] = [
  "PO line 기준으로 입고 lineage 추적이 가능한가",
  "partial/over/rejected/issue flagged receipt를 표현할 수 있는가",
  "lot/expiry/document/quarantine 상태를 line 및 lot level에서 표현할 수 있는가",
  "inspection과 inventory posting이 분리되어 있는가",
  "posting blocked/quarantine/release readiness를 계산할 수 있는가",
  "damaged/temperature excursion/label mismatch를 개별 이슈로 분리하는가",
  "inspection required와 inspection result를 구분하는가",
  "일부 수량만 정상이고 일부는 quarantine/reject 가능한가",
  "exception handling으로 넘길 수 있는 linkage가 있는가",
  "이후 stock risk/reorder/expiry 관리로 이어질 수 있는가",
];
