/**
 * PO / Approval Execution 뷰 모델 및 헬퍼 함수
 *
 * - po-approval-contract.ts 의 운영 계약을 UI 렌더링용으로 변환
 * - 상태 해석, 준비도 판정, 금액 포매팅, 라인 집계 로직 포함
 * - 모든 라벨·요약은 한국어
 */

import type {
  PurchaseOrderStatus,
  PurchaseOrderLineFulfillmentStatus,
  ApprovalExecutionStatus,
  ApprovalStepStatus,
  PurchaseOrderContract,
  PurchaseOrderLineContract,
  PurchaseOrderAcknowledgementContract,
} from "./po-approval-contract";

// ---------------------------------------------------------------------------
// 1. 발주 목록 아이템 뷰 모델
// ---------------------------------------------------------------------------

/** 발주 목록 화면에서 사용하는 요약 뷰 모델 */
export interface PurchaseOrderListItemVM {
  /** 발주서 고유 ID */
  id: string;
  /** 발주 번호 */
  poNumber: string;
  /** 공급사명 */
  vendorName: string;
  /** 발주 상태 라벨 (Korean) */
  statusLabel: string;
  /** 발주 상태 톤 */
  statusTone: "neutral" | "info" | "warning" | "danger" | "success";
  /** 승인 상태 라벨 (Korean) */
  approvalStatusLabel: string;
  /** 승인 상태 톤 */
  approvalTone: string;
  /** 총 금액 표시 (통화 포함, e.g. "₩2,450,000") */
  totalAmountText: string;
  /** 납기 상태 */
  requiredByState: {
    label: string;
    isOverdue: boolean;
    tone: "normal" | "due_soon" | "overdue";
  };
  /** 공급사 확인 상태 */
  acknowledgementState: {
    label: string;
    tone: "pending" | "confirmed" | "issue";
  };
  /** 라인 입고 진행 요약 (Korean, e.g. "3/5 품목 입고") */
  lineProgressText: string;
  /** 발주 책임자명 */
  ownerName: string;
  /** 차단 사유 (있을 경우) */
  blockedReason?: string;
  /** 리스크 배지 목록 */
  riskBadges: string[];
  /** 발주 원본 라벨 (Korean, e.g. "견적 기반" | "수동 생성" | "재발주") */
  sourceLabel: string;
  /** 상세 페이지 링크 */
  href: string;
}

// ---------------------------------------------------------------------------
// 2. 발주 헤더 뷰 모델
// ---------------------------------------------------------------------------

/** 발주 상세 페이지 헤더 영역 뷰 모델 */
export interface PurchaseOrderHeaderVM {
  /** 발주 번호 */
  poNumber: string;
  /** 공급사명 */
  vendorName: string;
  /** 주문 요약 (Korean, e.g. "5개 품목 · ₩2,450,000") */
  orderSummary: string;
  /** 발주 상태 라벨 */
  statusLabel: string;
  /** 발주 상태 톤 */
  statusTone: string;
  /** 승인 요약 (Korean, e.g. "3단계 중 2단계 완료") */
  approvalSummary: string;
  /** 발행 상태 */
  issueState: {
    label: string;
    canIssue: boolean;
    blockers: string[];
  };
  /** 공급사 확인 요약 (Korean) */
  acknowledgementSummary: string;
  /** 입고 진행 요약 (Korean, e.g. "3/5 입고 완료 · 2건 대기") */
  receivingProgressSummary: string;
  /** 예산 영향 요약 (Korean) */
  budgetImpactSummary?: string;
  /** 다음 조치 */
  nextAction: {
    label: string;
    actionKey: string;
    isEnabled: boolean;
  };
}

// ---------------------------------------------------------------------------
// 3. 승인 실행 뷰 모델
// ---------------------------------------------------------------------------

/** 승인 타임라인 단계 뷰 모델 */
export interface ApprovalStepTimelineVM {
  /** 단계 순서 */
  stepOrder: number;
  /** 단계 유형 라벨 (Korean) */
  stepTypeLabel: string;
  /** 단계 상태 라벨 (Korean) */
  statusLabel: string;
  /** 상태 톤 */
  tone: string;
  /** 담당자 라벨 목록 */
  assigneeLabels: string[];
  /** 결정 요약 */
  decisionSummary?: string;
  /** 소요 시간 라벨 */
  durationLabel?: string;
}

/** 승인 실행 뷰 모델 — 승인 흐름 전체 시각화 데이터 */
export interface ApprovalExecutionVM {
  /** 전체 상태 라벨 (Korean) */
  overallStatusLabel: string;
  /** 전체 상태 톤 */
  overallTone: string;
  /** 현재 단계 라벨 (Korean, e.g. "재무 승인 단계") */
  currentStepLabel: string;
  /** 대기 중인 승인자 이름 목록 */
  pendingApproverNames: string[];
  /** 완료된 단계 수 */
  completedStepCount: number;
  /** 전체 단계 수 */
  totalStepCount: number;
  /** 기한 초과 단계 수 */
  overdueStepCount: number;
  /** 반송 사유 (있을 경우) */
  returnReason?: string;
  /** 조건부 승인 조건 목록 */
  conditionalNotes?: string[];
  /** 발행 가능 여부 */
  canIssue: boolean;
  /** 에스컬레이션 가능 여부 */
  canEscalate: boolean;
  /** 재개 가능 여부 */
  canReopen: boolean;
  /** 단계 타임라인 */
  stepTimeline: ApprovalStepTimelineVM[];
}

// ---------------------------------------------------------------------------
// 4. 발주 라인 뷰 모델
// ---------------------------------------------------------------------------

/** 발주 라인 뷰 모델 — 개별 품목의 표시용 데이터 */
export interface PurchaseOrderLineVM {
  /** 라인 고유 ID */
  id: string;
  /** 라인 번호 */
  lineNumber: number;
  /** 품목 라벨 (Korean, e.g. "DMEM 배지 (Gibco)") */
  itemLabel: string;
  /** 주문 요약 (Korean, e.g. "10 x 500mL") */
  orderedSummary: string;
  /** 가격 요약 (Korean, e.g. "₩25,000 × 10 = ₩250,000") */
  priceSummary: string;
  /** 납기 요약 (Korean) */
  deliverySummary: string;
  /** 이행 상태 라벨 (Korean) */
  fulfillmentLabel: string;
  /** 이행 상태 톤 */
  fulfillmentTone: string;
  /** 문서 충족 요약 (Korean, e.g. "COA ✓ · MSDS ✓ · Validation ✗") */
  documentCoverageSummary: string;
  /** 대체품 플래그 (Korean) */
  substituteFlag?: string;
  /** 이슈 요약 */
  issueSummary?: string;
  /** 입고 준비 완료 여부 */
  receivingReady: boolean;
  /** 원본 추적 라벨 (Korean, e.g. "견적 #Q-2041 → Thermo Fisher 응답") */
  sourceLineageLabel?: string;
}

// ---------------------------------------------------------------------------
// 5. 발주 결정 요약 뷰 모델
// ---------------------------------------------------------------------------

/** 준비도 수준 */
export type ReadinessLevel = "ready" | "needs_review" | "blocked";

/** 입고 준비도 수준 */
export type ReceivingReadinessLevel = "ready" | "partial" | "blocked";

/** 발주 결정 요약 뷰 모델 — 승인/발행/입고 준비도 통합 판정 */
export interface PurchaseOrderDecisionSummaryVM {
  /** 승인 준비도 */
  approvalReadiness: ReadinessLevel;
  /** 발행 준비도 */
  issueReadiness: ReadinessLevel;
  /** 입고 인수인계 준비도 */
  receivingHandoffReadiness: ReceivingReadinessLevel;
  /** 승인 차단 사유 목록 */
  approvalBlockers: string[];
  /** 발행 차단 사유 목록 */
  issueBlockers: string[];
  /** 입고 차단 사유 목록 */
  receivingBlockers: string[];
  /** 추천 다음 조치 */
  recommendedNextAction: {
    label: string;
    actionKey: string;
  };
  /** 추천 다음 담당자 */
  recommendedNextOwner?: string;
}

// ---------------------------------------------------------------------------
// 6. 발주 페이지 최상위 뷰 모델
// ---------------------------------------------------------------------------

/** 발주 상세 페이지 최상위 뷰 모델 — 모든 섹션 통합 */
export interface PurchaseOrderPageViewModel {
  /** 헤더 영역 */
  header: PurchaseOrderHeaderVM;
  /** 승인 실행 영역 */
  approval: ApprovalExecutionVM;
  /** 라인 목록 */
  lines: PurchaseOrderLineVM[];
  /** 공급사 확인 영역 (선택) */
  acknowledgement?: {
    statusLabel: string;
    tone: string;
    vendorRefLabel?: string;
    lineConfirmationSummary: string;
  };
  /** 결정 요약 */
  decision: PurchaseOrderDecisionSummaryVM;
  /** 페이지 상태 */
  pageState: {
    isEmpty: boolean;
    hasError: boolean;
    isUnavailable: boolean;
  };
}

// ===========================================================================
// 헬퍼 함수
// ===========================================================================

// ---------------------------------------------------------------------------
// 7. 납기 상태 판정
// ---------------------------------------------------------------------------

/**
 * 납기일 기준으로 상태를 판정한다.
 *
 * - 납기일 없으면 기본 "미지정" 표시
 * - 납기일 초과 시 overdue
 * - 3일 이내이면 due_soon
 * - 그 외 normal
 *
 * @param requiredByAt - 필요 납기일 (ISO 8601)
 * @param now - 기준 시점 (기본: 현재)
 */
export function resolveRequiredByState(
  requiredByAt: string | undefined,
  now?: Date,
): { label: string; isOverdue: boolean; tone: "normal" | "due_soon" | "overdue" } {
  if (!requiredByAt) {
    return { label: "납기 미지정", isOverdue: false, tone: "normal" };
  }

  const reference = now ?? new Date();
  const dueDate = new Date(requiredByAt);
  const diffMs = dueDate.getTime() - reference.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    const overdueDays = Math.ceil(Math.abs(diffDays));
    return {
      label: `납기 ${overdueDays}일 초과`,
      isOverdue: true,
      tone: "overdue",
    };
  }

  if (diffDays <= 3) {
    const remainDays = Math.ceil(diffDays);
    return {
      label: `납기 ${remainDays}일 이내`,
      isOverdue: false,
      tone: "due_soon",
    };
  }

  const remainDays = Math.ceil(diffDays);
  return {
    label: `납기 ${remainDays}일 남음`,
    isOverdue: false,
    tone: "normal",
  };
}

// ---------------------------------------------------------------------------
// 8. 라인 입고 진행률 계산
// ---------------------------------------------------------------------------

/**
 * 발주 라인 목록에서 입고 진행률을 계산한다.
 *
 * - received 상태인 라인 수 / 취소 제외 전체 라인 수
 * - 한국어 라벨 생성 (e.g. "3/5 품목 입고")
 *
 * @param lines - 발주 라인 목록
 */
export function calculateLineProgress(
  lines: PurchaseOrderLineContract[],
): { received: number; total: number; label: string } {
  const nonCancelledLines = lines.filter(
    (l) => l.fulfillmentStatus !== "cancelled",
  );
  const receivedLines = nonCancelledLines.filter(
    (l) => l.fulfillmentStatus === "received",
  );

  const received = receivedLines.length;
  const total = nonCancelledLines.length;

  return {
    received,
    total,
    label: `${received}/${total} 품목 입고`,
  };
}

// ---------------------------------------------------------------------------
// 9. 발행 준비도 판정
// ---------------------------------------------------------------------------

/**
 * PO 상태와 승인 상태를 기반으로 발행 준비도를 판정한다.
 *
 * - blocked: 승인 미완료 또는 PO가 approved/ready_to_issue 아님
 * - needs_review: 보류 상태
 * - ready: 승인 완료 + PO가 approved 또는 ready_to_issue
 *
 * @param poStatus - 발주 상태
 * @param approvalStatus - 승인 실행 상태
 */
export function resolveIssueReadiness(
  poStatus: PurchaseOrderStatus,
  approvalStatus: ApprovalExecutionStatus,
): { readiness: "ready" | "needs_review" | "blocked"; blockers: string[] } {
  const blockers: string[] = [];

  if (poStatus === "on_hold") {
    return {
      readiness: "needs_review",
      blockers: ["발주가 보류 상태입니다"],
    };
  }

  if (approvalStatus !== "approved") {
    blockers.push("승인이 완료되지 않았습니다");
  }

  if (poStatus !== "approved" && poStatus !== "ready_to_issue") {
    blockers.push("발주 상태가 발행 가능 상태가 아닙니다");
  }

  if (blockers.length > 0) {
    return { readiness: "blocked", blockers };
  }

  return { readiness: "ready", blockers: [] };
}

// ---------------------------------------------------------------------------
// 10. 입고 인수인계 준비도 판정
// ---------------------------------------------------------------------------

/**
 * 발주서와 공급사 확인 정보를 기반으로 입고 인수인계 준비도를 판정한다.
 *
 * - blocked: 미발행, 라인 없음, 배송지 누락
 * - partial: 발행됨이나 공급사 확인 미완료
 * - ready: 발행 + 확인 + 납품 정보 존재
 *
 * @param po - 발주서 계약
 * @param acknowledgement - 공급사 확인 계약 (선택)
 */
export function resolveReceivingHandoffReadiness(
  po: PurchaseOrderContract,
  acknowledgement?: PurchaseOrderAcknowledgementContract,
): { readiness: "ready" | "partial" | "blocked"; blockers: string[] } {
  const blockers: string[] = [];

  const issuedStatuses: PurchaseOrderStatus[] = [
    "issued",
    "acknowledged",
    "partially_received",
    "received",
  ];

  if (!issuedStatuses.includes(po.status)) {
    blockers.push("발주서가 아직 발행되지 않았습니다");
  }

  if (po.lines.length === 0) {
    blockers.push("발주 라인이 없습니다");
  }

  if (!po.shipToLocation) {
    blockers.push("배송지 정보가 누락되었습니다");
  }

  if (blockers.length > 0) {
    return { readiness: "blocked", blockers };
  }

  if (!acknowledgement) {
    return {
      readiness: "partial",
      blockers: ["공급사 확인이 아직 완료되지 않았습니다"],
    };
  }

  const hasDeliveryData =
    acknowledgement.promisedDeliveryAt || acknowledgement.promisedShipAt;

  if (!hasDeliveryData) {
    return {
      readiness: "partial",
      blockers: ["공급사 납품 일정 정보가 없습니다"],
    };
  }

  return { readiness: "ready", blockers: [] };
}

// ---------------------------------------------------------------------------
// 11. 승인 단계 톤 판정
// ---------------------------------------------------------------------------

/**
 * 승인 단계 상태에 따른 톤(색상 의미)을 반환한다.
 *
 * @param status - 승인 단계 상태
 */
export function resolveApprovalStepTone(status: ApprovalStepStatus): string {
  const toneMap: Record<ApprovalStepStatus, string> = {
    waiting: "neutral",
    active: "info",
    approved: "success",
    rejected: "danger",
    returned: "warning",
    skipped: "muted",
    expired: "danger",
  };
  return toneMap[status];
}

// ---------------------------------------------------------------------------
// 12. 라인 집계로 헤더 상태 판정
// ---------------------------------------------------------------------------

/**
 * 발주 라인 이행 상태를 집계하여 헤더 수준 상태를 반환한다.
 *
 * - issue_flagged가 하나라도 있으면 → issue_flagged
 * - 전부 received이면 → received
 * - 일부 received이면 → partially_received
 * - 그 외 → open
 *
 * @param lines - 발주 라인 목록
 */
export function aggregateHeaderStatusFromLines(
  lines: PurchaseOrderLineContract[],
): "open" | "partially_received" | "received" | "issue_flagged" {
  const nonCancelled = lines.filter(
    (l) => l.fulfillmentStatus !== "cancelled",
  );

  if (nonCancelled.length === 0) {
    return "open";
  }

  const hasIssueFlagged = nonCancelled.some(
    (l) => l.fulfillmentStatus === "issue_flagged",
  );
  if (hasIssueFlagged) {
    return "issue_flagged";
  }

  const allReceived = nonCancelled.every(
    (l) => l.fulfillmentStatus === "received",
  );
  if (allReceived) {
    return "received";
  }

  const someReceived = nonCancelled.some(
    (l) =>
      l.fulfillmentStatus === "received" ||
      l.fulfillmentStatus === "partially_received",
  );
  if (someReceived) {
    return "partially_received";
  }

  return "open";
}

// ---------------------------------------------------------------------------
// 13. PO 금액 요약 포매팅
// ---------------------------------------------------------------------------

/**
 * 발주서 금액 정보를 한국어 요약 문자열로 포매팅한다.
 *
 * @example
 * "소계 ₩2,300,000 + 배송 ₩50,000 + 세금 ₩100,000 = 총 ₩2,450,000"
 *
 * @param po - 발주서 계약
 */
export function formatPOAmountSummary(po: PurchaseOrderContract): string {
  const fmt = (amount: number): string => {
    const prefix = po.currency === "KRW" ? "₩" : po.currency === "USD" ? "$" : `${po.currency} `;
    return `${prefix}${amount.toLocaleString("ko-KR")}`;
  };

  const parts: string[] = [`소계 ${fmt(po.subtotalAmount)}`];

  if (po.shippingAmount && po.shippingAmount > 0) {
    parts.push(`배송 ${fmt(po.shippingAmount)}`);
  }

  if (po.taxAmount && po.taxAmount > 0) {
    parts.push(`세금 ${fmt(po.taxAmount)}`);
  }

  if (po.discountAmount && po.discountAmount > 0) {
    parts.push(`할인 -${fmt(po.discountAmount)}`);
  }

  return `${parts.join(" + ")} = 총 ${fmt(po.totalAmount)}`;
}
