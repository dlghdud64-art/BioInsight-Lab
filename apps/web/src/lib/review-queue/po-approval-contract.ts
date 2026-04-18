/**
 * PO / Approval Execution 운영 흐름 중앙 계약
 *
 * 핵심 원칙:
 * - Quote/RFQ 계약 위에 위치하는 발주·승인 실행 레이어
 * - 승인 상태(approval)와 발주 상태(PO)는 절대 혼합하지 않는다
 * - approved ≠ issued — 승인 완료와 발행은 별도 상태
 * - 공급사 확인(acknowledgement)은 독립 상태로 관리
 * - line fulfillment는 header status와 분리, 집계로 partially_received 계산
 * - UI 라벨 없음 — 오직 구조와 상태만 정의
 *
 * 흐름: 견적 선택 → 승인 실행 → approved/rejected → PO 발행 → 공급사 확인 → 입고 인수인계
 */

// ---------------------------------------------------------------------------
// 1. 발주서 상태
// ---------------------------------------------------------------------------

/**
 * 발주서 상태 — draft → cancelled 까지 운영 흐름 전체를 표현
 *
 * - draft: 발주서 작성 중
 * - pending_approval: 승인 절차 시작 전
 * - approval_in_progress: 단계별 승인 검토 중
 * - approved: 모든 승인 단계 통과
 * - rejected: 승인 과정에서 반려됨
 * - ready_to_issue: 승인 완료, 발행 가능 상태
 * - issued: 공급사에 발주서 전달 완료
 * - acknowledged: 공급사가 발주를 확인함
 * - partially_received: 일부 품목만 입고됨
 * - received: 모든 품목 입고 완료
 * - closed: 발주 처리 완료
 * - cancelled: 발주 취소됨
 * - on_hold: 일시 보류 상태
 */
export type PurchaseOrderStatus =
  | "draft"
  | "pending_approval"
  | "approval_in_progress"
  | "approved"
  | "rejected"
  | "ready_to_issue"
  | "issued"
  | "acknowledged"
  | "partially_received"
  | "received"
  | "closed"
  | "cancelled"
  | "on_hold";

// ---------------------------------------------------------------------------
// 2. 발주 라인 이행 상태
// ---------------------------------------------------------------------------

/**
 * 발주 라인 이행 상태 — 개별 품목의 입고·이행 진행 상황
 *
 * - open: 미처리
 * - confirmed: 공급사 확인 완료
 * - partially_received: 부분 입고
 * - received: 입고 완료
 * - backordered: 재입고 대기
 * - cancelled: 라인 취소
 * - issue_flagged: 이슈 발생 (수량 불일치, 품질 등)
 */
export type PurchaseOrderLineFulfillmentStatus =
  | "open"
  | "confirmed"
  | "partially_received"
  | "received"
  | "backordered"
  | "cancelled"
  | "issue_flagged";

// ---------------------------------------------------------------------------
// 3. 승인 실행 상태
// ---------------------------------------------------------------------------

/**
 * 승인 실행 상태 — 전체 승인 흐름의 진행 상태
 *
 * - not_started: 승인 절차 미시작
 * - in_progress: 승인 진행 중
 * - approved: 전체 승인 완료
 * - rejected: 반려됨
 * - returned: 수정 요청으로 반송됨
 * - cancelled: 승인 절차 취소됨
 * - expired: 승인 기한 초과
 */
export type ApprovalExecutionStatus =
  | "not_started"
  | "in_progress"
  | "approved"
  | "rejected"
  | "returned"
  | "cancelled"
  | "expired";

// ---------------------------------------------------------------------------
// 4. 승인 단계 상태
// ---------------------------------------------------------------------------

/**
 * 승인 단계 상태 — 개별 승인 단계의 진행 상태
 *
 * - waiting: 이전 단계 완료 대기
 * - active: 현재 활성 단계 (검토 중)
 * - approved: 단계 승인 완료
 * - rejected: 단계 반려
 * - returned: 수정 요청으로 반송
 * - skipped: 조건에 의해 건너뜀
 * - expired: 단계 기한 초과
 */
export type ApprovalStepStatus =
  | "waiting"
  | "active"
  | "approved"
  | "rejected"
  | "returned"
  | "skipped"
  | "expired";

// ---------------------------------------------------------------------------
// 5. 공급사 발주 확인 상태
// ---------------------------------------------------------------------------

/**
 * 공급사 발주 확인 상태 — 발주서에 대한 공급사 응답 상태
 *
 * - not_sent: 아직 전달되지 않음
 * - sent: 공급사에 전달됨
 * - viewed: 공급사가 열람함
 * - acknowledged: 공급사 확인 완료
 * - partially_confirmed: 일부 항목만 확인
 * - declined: 공급사 거절
 * - needs_review: 검토 필요 사항 발생
 */
export type PurchaseOrderAcknowledgementStatus =
  | "not_sent"
  | "sent"
  | "viewed"
  | "acknowledged"
  | "partially_confirmed"
  | "declined"
  | "needs_review";

// ---------------------------------------------------------------------------
// 6. 발주서 계약 인터페이스
// ---------------------------------------------------------------------------

/** 발주서 첨부 파일 */
export interface PurchaseOrderAttachment {
  /** 첨부 파일 고유 ID */
  id: string;
  /** 파일명 */
  name: string;
  /** 파일 유형 (pdf, xlsx 등) */
  type: string;
}

/** 발주서 중앙 계약 — 견적 선정 결과를 기반으로 생성되는 발주서 전체 구조 */
export interface PurchaseOrderContract {
  /** 발주서 고유 ID */
  id: string;
  /** 워크스페이스 ID */
  workspaceId: string;
  /** 발주 번호 (표시용) */
  poNumber: string;
  /** 발주 상태 */
  status: PurchaseOrderStatus;
  /** 발주 원본 유형 */
  sourceType: "quote" | "manual" | "reorder" | "contract";
  /** 원본 견적 요청 ID */
  quoteRequestId?: string;
  /** 원본 견적 비교 ID */
  quoteComparisonId?: string;
  /** 선정된 공급사 응답 ID 목록 */
  selectedResponseIds?: string[];
  /** 공급사 ID */
  vendorId: string;
  /** 통화 (KRW, USD 등) */
  currency: string;
  /** 결제 조건 */
  paymentTerms?: string;
  /** 무역 조건 (FOB, CIF 등) */
  incoterms?: string;
  /** 배송 지역 */
  shippingRegion: string;
  /** 청구 대상 법인 */
  billToEntity: string;
  /** 배송지 */
  shipToLocation: string;
  /** 요청자 ID */
  requestedBy: string;
  /** 발주 책임자 ID */
  ownerId: string;
  /** 생성 일시 (ISO 8601) */
  createdAt: string;
  /**
   * 마지막 수정 일시 (ISO 8601, optional).
   * - approval 이후 PO 본문/라인/금액 등 canonical 값이 변경될 때마다 갱신.
   * - dispatch readiness 재계산의 1차 신호 (`dataChangedAfterApproval`).
   * - undefined 또는 createdAt 과 동일하면 "무변경"으로 해석.
   */
  updatedAt?: string;
  /** 생성자 ID */
  createdBy: string;
  /** 발행 일시 (ISO 8601) */
  issuedAt?: string;
  /** 필요 납기일 (ISO 8601) */
  requiredByAt?: string;
  /** 공급사 확인 일시 (ISO 8601) */
  acknowledgedAt?: string;
  /** 연결된 예산 컨텍스트 ID */
  budgetContextId?: string;
  /** 연결된 승인 실행 ID */
  approvalExecutionId?: string;
  /** 비고 */
  notes?: string;
  /** 첨부 파일 목록 */
  attachments?: PurchaseOrderAttachment[];
  /** 소계 금액 */
  subtotalAmount: number;
  /** 배송비 */
  shippingAmount?: number;
  /** 세금 */
  taxAmount?: number;
  /** 할인 금액 */
  discountAmount?: number;
  /** 총 금액 */
  totalAmount: number;
  /** 발주 라인 목록 */
  lines: PurchaseOrderLineContract[];
}

// ---------------------------------------------------------------------------
// 7. 발주 라인 계약 인터페이스
// ---------------------------------------------------------------------------

/** 발주 라인 필수 문서 유형 */
export type RequiredDocumentType = "coa" | "msds" | "validation" | "warranty";

/** 발주 라인 계약 — 개별 품목의 주문·이행·추적 정보 */
export interface PurchaseOrderLineContract {
  /** 라인 고유 ID */
  id: string;
  /** 발주서 ID */
  poId: string;
  /** 원본 견적 요청 항목 ID */
  sourceRequestItemId?: string;
  /** 원본 견적 응답 항목 ID */
  sourceResponseItemId?: string;
  /** 카탈로그 항목 ID */
  catalogItemId?: string;
  /** 재고 항목 ID */
  inventoryItemId?: string;
  /** 라인 번호 */
  lineNumber: number;
  /** 품명 */
  itemName: string;
  /** 제조사 */
  manufacturer?: string;
  /** 카탈로그 번호 */
  catalogNumber?: string;
  /** 사양 요약 */
  specSummary?: string;
  /** 주문 수량 */
  orderedQuantity: number;
  /** 주문 단위 */
  orderedUnit: string;
  /** 포장 규격 */
  packSize?: string;
  /** 단가 */
  unitPrice: number;
  /** 라인 합계 */
  lineTotal: number;
  /** 필수 문서 유형 목록 */
  requiredDocuments?: RequiredDocumentType[];
  /** 예상 리드타임 (일) */
  expectedLeadTimeDays?: number;
  /** 예상 납품일 (ISO 8601) */
  expectedDeliveryAt?: string;
  /** 이행 상태 */
  fulfillmentStatus: PurchaseOrderLineFulfillmentStatus;
  /** 입고 수량 */
  receivedQuantity: number;
  /** 잔여 수량 */
  remainingQuantity: number;
  /** 대체품 승인 여부 */
  substituteApproved: boolean;
  /** 리스크 플래그 목록 */
  riskFlags: string[];
}

// ---------------------------------------------------------------------------
// 8. 승인 실행 계약 인터페이스
// ---------------------------------------------------------------------------

/** 승인 실행 계약 — 발주서 또는 견적 선정에 대한 단계별 승인 흐름 */
export interface ApprovalExecutionContract {
  /** 승인 실행 고유 ID */
  id: string;
  /** 워크스페이스 ID */
  workspaceId: string;
  /** 대상 엔티티 유형 */
  entityType: "purchase_order" | "quote_selection";
  /** 대상 엔티티 ID */
  entityId: string;
  /** 승인 정책 ID */
  policyId?: string;
  /** 승인 실행 상태 */
  status: ApprovalExecutionStatus;
  /** 승인 시작 일시 (ISO 8601) */
  initiatedAt: string;
  /** 승인 시작자 ID */
  initiatedBy: string;
  /** 현재 활성 단계 순서 */
  currentStepOrder: number;
  /** 승인 단계 목록 */
  steps: ApprovalStepContract[];
  /** 최종 결정 일시 (ISO 8601) */
  finalDecisionAt?: string;
  /** 최종 결정자 ID */
  finalDecisionBy?: string;
  /** 차단 사유 목록 */
  blockers: string[];
  /** 감사 추적 ID 목록 */
  auditTrailIds?: string[];
}

// ---------------------------------------------------------------------------
// 9. 승인 단계 계약 인터페이스
// ---------------------------------------------------------------------------

/** 승인 단계 유형 */
export type ApprovalStepType =
  | "budget"
  | "manager"
  | "procurement"
  | "finance"
  | "compliance"
  | "admin";

/** 승인 단계 계약 — 개별 승인 단계의 담당자·조건·결정 기록 */
export interface ApprovalStepContract {
  /** 단계 고유 ID */
  id: string;
  /** 승인 실행 ID */
  executionId: string;
  /** 단계 순서 */
  stepOrder: number;
  /** 단계 유형 */
  stepType: ApprovalStepType;
  /** 단계 상태 */
  status: ApprovalStepStatus;
  /** 담당자 ID 목록 */
  assigneeIds: string[];
  /** 최소 승인 필요 수 */
  minimumApprovalsRequired: number;
  /** 결정 기록 목록 */
  decisions: ApprovalDecisionContract[];
  /** 단계 시작 일시 (ISO 8601) */
  startedAt?: string;
  /** 단계 완료 일시 (ISO 8601) */
  completedAt?: string;
  /** SLA 기한 (ISO 8601) */
  slaDueAt?: string;
  /** 에스컬레이션 규칙 ID */
  escalationRuleId?: string;
  /** 비고 */
  notes?: string;
}

// ---------------------------------------------------------------------------
// 10. 승인 결정 계약 인터페이스
// ---------------------------------------------------------------------------

/** 승인 결정 계약 — 개별 승인자의 결정 기록 */
export interface ApprovalDecisionContract {
  /** 결정 고유 ID */
  id: string;
  /** 단계 ID */
  stepId: string;
  /** 결정 유형 */
  decision: "approved" | "rejected" | "returned" | "conditional";
  /** 결정 일시 (ISO 8601) */
  decidedAt: string;
  /** 결정자 ID */
  decidedBy: string;
  /** 코멘트 */
  comment?: string;
  /** 조건부 승인 조건 목록 */
  conditions?: string[];
}

// ---------------------------------------------------------------------------
// 11. 공급사 발주 확인 계약 인터페이스
// ---------------------------------------------------------------------------

/** 공급사 발주 확인 계약 — 발주서에 대한 공급사 전체 응답 */
export interface PurchaseOrderAcknowledgementContract {
  /** 확인 고유 ID */
  id: string;
  /** 발주서 ID */
  poId: string;
  /** 공급사 ID */
  vendorId: string;
  /** 확인 상태 */
  status: PurchaseOrderAcknowledgementStatus;
  /** 확인 일시 (ISO 8601) */
  acknowledgedAt?: string;
  /** 약속 출하일 (ISO 8601) */
  promisedShipAt?: string;
  /** 약속 납품일 (ISO 8601) */
  promisedDeliveryAt?: string;
  /** 공급사 참조 번호 */
  vendorReferenceNumber?: string;
  /** 비고 */
  notes?: string;
  /** 라인별 확인 목록 */
  lineConfirmations: PurchaseOrderLineAcknowledgementContract[];
}

// ---------------------------------------------------------------------------
// 12. 공급사 라인 확인 계약 인터페이스
// ---------------------------------------------------------------------------

/** 공급사 라인별 확인 계약 — 개별 품목에 대한 공급사 응답 */
export interface PurchaseOrderLineAcknowledgementContract {
  /** 발주 라인 ID */
  poLineId: string;
  /** 라인 확인 상태 */
  status: "confirmed" | "backordered" | "substituted" | "declined" | "pending";
  /** 확인된 수량 */
  confirmedQuantity?: number;
  /** 확인된 단가 */
  confirmedUnitPrice?: number;
  /** 확인된 납품일 (ISO 8601) */
  confirmedDeliveryAt?: string;
  /** 재입고 대기 수량 */
  backorderQuantity?: number;
  /** 대체품 제안 여부 */
  substituteSuggested: boolean;
  /** 이슈 사항 목록 */
  issues?: string[];
}

// ---------------------------------------------------------------------------
// 13. 발주 상태 설명 (Korean)
// ---------------------------------------------------------------------------

/** 발주 상태별 라벨·설명·다음 조치 — UI 레이어에서 참조하는 운영 설명 */
export const PO_STATUS_DESCRIPTIONS: Record<
  PurchaseOrderStatus,
  { label: string; description: string; nextActions: string[] }
> = {
  draft: {
    label: "초안",
    description: "발주서 작성 중",
    nextActions: ["항목 확인", "승인 요청"],
  },
  pending_approval: {
    label: "승인 대기",
    description: "승인 절차 시작 전",
    nextActions: ["승인 절차 시작"],
  },
  approval_in_progress: {
    label: "승인 진행 중",
    description: "단계별 승인 검토 중",
    nextActions: ["승인 대기", "에스컬레이션"],
  },
  approved: {
    label: "승인 완료",
    description: "모든 승인 단계 통과",
    nextActions: ["발행 준비", "발행"],
  },
  rejected: {
    label: "반려",
    description: "승인 과정에서 반려됨",
    nextActions: ["수정 후 재요청", "취소"],
  },
  ready_to_issue: {
    label: "발행 준비",
    description: "승인 완료, 발행 가능 상태",
    nextActions: ["발행", "최종 검토"],
  },
  issued: {
    label: "발행됨",
    description: "공급사에 발주서 전달 완료",
    nextActions: ["공급사 확인 대기"],
  },
  acknowledged: {
    label: "공급사 확인",
    description: "공급사가 발주를 확인함",
    nextActions: ["입고 대기", "납기 추적"],
  },
  partially_received: {
    label: "부분 입고",
    description: "일부 품목만 입고됨",
    nextActions: ["나머지 입고 대기", "잔량 확인"],
  },
  received: {
    label: "입고 완료",
    description: "모든 품목 입고 완료",
    nextActions: ["마감 처리"],
  },
  closed: {
    label: "마감",
    description: "발주 처리 완료",
    nextActions: [],
  },
  cancelled: {
    label: "취소",
    description: "발주 취소됨",
    nextActions: [],
  },
  on_hold: {
    label: "보류",
    description: "일시 보류 상태",
    nextActions: ["보류 해제", "취소"],
  },
};

// ---------------------------------------------------------------------------
// 14. 승인 단계 유형 설명 (Korean)
// ---------------------------------------------------------------------------

/** 승인 단계 유형별 라벨·설명 */
export const APPROVAL_STEP_TYPE_DESCRIPTIONS: Record<
  ApprovalStepType,
  { label: string; description: string }
> = {
  budget: {
    label: "예산 검토",
    description: "예산 한도 및 통제 규칙 확인",
  },
  manager: {
    label: "관리자 승인",
    description: "직속 관리자 또는 팀 리더 승인",
  },
  procurement: {
    label: "구매 검토",
    description: "구매 운영팀 검토 및 승인",
  },
  finance: {
    label: "재무 승인",
    description: "재무팀 예산 집행 승인",
  },
  compliance: {
    label: "규정 검토",
    description: "규정 준수 및 문서 요건 확인",
  },
  admin: {
    label: "관리자 최종 승인",
    description: "조직 관리자 최종 승인",
  },
};

// ---------------------------------------------------------------------------
// 15. PO SLA 기본값
// ---------------------------------------------------------------------------

/** 발주 SLA 기본값 — 단계별 기한 기준 */
export const PO_SLA_DEFAULTS = {
  /** 승인 단계별 SLA (시간) */
  approvalStepHours: 24,
  /** 승인 완료 후 발행까지 허용 시간 */
  issueAfterApprovalHours: 8,
  /** 공급사 확인 기한 (영업일) */
  vendorAcknowledgementDays: 3,
  /** 초과 경고 배지 표시 기준 (시간) */
  overdueBadgeAfterHours: 48,
} as const;

// ---------------------------------------------------------------------------
// 16. 빈 상태 / 에러 / 접근 불가 문구 (Korean)
// ---------------------------------------------------------------------------

/** 발주 목록 비어있을 때 안내 문구 */
export const PO_EMPTY_COPY = {
  title: "발주서가 없습니다",
  description: "견적 선택 후 발주서를 생성할 수 있습니다",
  actionLabel: "견적 목록 보기",
  actionHref: "/dashboard/quotes",
} as const;

/** 발주 정보 로드 실패 시 에러 문구 */
export const PO_ERROR_COPY = {
  title: "발주 정보를 불러오지 못했습니다",
  description: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
} as const;

/** 발주 관리 접근 권한 없음 문구 */
export const PO_UNAVAILABLE_COPY = {
  title: "현재 권한으로 발주 관리에 접근할 수 없습니다",
  description: "구매 관리자 권한이 필요합니다",
  actionLabel: "권한 요청하기",
  actionHref: "/dashboard/support-center?tab=ticket",
} as const;

// ---------------------------------------------------------------------------
// 17. 안티 패턴 목록
// ---------------------------------------------------------------------------

/** PO/승인 모델링 안티 패턴 — 코드 리뷰 시 경고 대상 */
export const PO_ANTI_PATTERNS: string[] = [
  "approved와 issued를 같은 상태로 취급",
  "header level만 있고 line lineage가 없는 PO 모델",
  "승인 흐름 없이 바로 발행만 가능한 구조",
  "isApproved: boolean 같은 단순 플래그로 승인 관리",
  "공급사 확인을 hasAcknowledgement: boolean으로 처리",
  "line-level receiving 준비도 계산이 불가능한 구조",
  "부분 승인/조건부 승인/반송을 표현할 수 없는 구조",
  "예산/승인 정책 연결 없이 발주 발행 가능",
];

// ---------------------------------------------------------------------------
// 18. 코드 리뷰 체크리스트
// ---------------------------------------------------------------------------

/** PO/승인 구현 코드 리뷰 체크리스트 — PR 리뷰 시 확인 항목 */
export const poCodeReviewChecklist: string[] = [
  "견적 선택 결과에서 PO 생성 연결이 가능한가",
  "approval execution과 PO header 상태가 분리되어 있는가",
  "step 단위 승인 진행과 decision 기록이 가능한가",
  "approved → ready_to_issue → issued 흐름이 자연스러운가",
  "공급사 확인(acknowledged)이 별도 상태로 관리되는가",
  "line 단위 fulfillment와 header 집계가 가능한가",
  "receiving handoff readiness를 계산할 수 있는가",
  "부분 승인/조건부 승인/반송/보류가 구분되는가",
  "예산/승인 정책/Vendor/Quote 계약과 연결되는가",
  "line별 source lineage(request→response→PO)가 추적되는가",
];
