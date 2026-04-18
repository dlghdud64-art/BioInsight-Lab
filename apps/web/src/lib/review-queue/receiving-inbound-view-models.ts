/**
 * Receiving / Inventory Inbound ViewModel 계층
 *
 * receiving-inbound-contract.ts의 운영 객체를 UI 표현용으로 변환하는
 * ViewModel과 헬퍼 함수를 정의한다.
 *
 * 원칙:
 * - 모든 라벨·요약·톤은 한국어
 * - contract 상태를 직접 노출하지 않고 ViewModel로 해석
 * - 도착 상태, 검수 상태, 반영 상태, 만료 위험은 각각 독립 계산
 */

import type {
  ReceivingBatchContract,
  ReceivingLineReceiptContract,
  ReceivedLotRecordContract,
  ReceivingInspectionContract,
  InventoryInboundPostingContract,
} from "./receiving-inbound-contract";

import { RECEIVING_SLA_DEFAULTS } from "./receiving-inbound-contract";

// ---------------------------------------------------------------------------
// 1. 입고 배치 리스트 아이템 ViewModel
// ---------------------------------------------------------------------------

/** 입고 배치 리스트에서 한 행을 표현하는 ViewModel */
export interface ReceivingBatchListItemVM {
  /** 입고 배치 ID */
  id: string;
  /** 입고 번호 */
  receivingNumber: string;
  /** 공급사명 */
  vendorName: string;
  /** 입고 배치 상태 라벨 (한국어) */
  batchStatusLabel: string;
  /** 상태 톤 */
  statusTone: "neutral" | "info" | "warning" | "danger" | "success";
  /** 도착 상태 */
  arrivalState: {
    label: string;
    isOverdue: boolean;
    tone: "normal" | "due_soon" | "overdue" | "arrived";
  };
  /** PO 참조 (한국어, 예: "PO-2041 기반") */
  poReference?: string;
  /** 라인 수령 진행 요약 (한국어, 예: "3/5 품목 수령") */
  lineProgressText: string;
  /** 검수 요약 (한국어, 예: "2건 검수 대기") */
  inspectionSummary: string;
  /** 재고 반영 요약 (한국어, 예: "1/5 반영 완료") */
  postingSummary: string;
  /** 위험 배지 목록 */
  riskBadges: string[];
  /** 반영 차단 사유 */
  blockedReason?: string;
  /** 상세 페이지 경로 */
  href: string;
}

// ---------------------------------------------------------------------------
// 2. 입고 배치 헤더 ViewModel
// ---------------------------------------------------------------------------

/** 입고 배치 상세 페이지 헤더 ViewModel */
export interface ReceivingBatchHeaderVM {
  /** 입고 번호 */
  receivingNumber: string;
  /** 공급사명 */
  vendorName: string;
  /** 원천 요약 (한국어, 예: "PO-2041 기반 · 5개 품목") */
  sourceSummary: string;
  /** 배치 상태 라벨 (한국어) */
  batchStatusLabel: string;
  /** 상태 톤 */
  statusTone: string;
  /** 도착 요약 (한국어) */
  arrivalSummary: string;
  /** 검수 요약 (한국어, 예: "4/5 검수 완료 · 1건 대기") */
  inspectionSummary: string;
  /** 재고 반영 요약 (한국어, 예: "3/5 반영 완료 · 2건 대기") */
  postingSummary: string;
  /** 문서 구비율 요약 (한국어, 예: "COA 4/5 · MSDS 5/5") */
  documentCoverageSummary: string;
  /** 다음 조치 */
  nextAction: { label: string; actionKey: string; isEnabled: boolean };
  /** 다음 담당자 */
  nextOwner?: string;
}

// ---------------------------------------------------------------------------
// 3. 입고 라인 수령 ViewModel
// ---------------------------------------------------------------------------

/** 입고 라인 수령 상세 ViewModel */
export interface ReceivingLineReceiptVM {
  /** 라인 수령 ID */
  id: number;
  /** 라인 번호 */
  lineNumber: number;
  /** 품목 라벨 (한국어) */
  itemLabel: string;
  /** 주문 대비 수령 요약 (한국어, 예: "주문 10 / 수령 8 / 부족 2") */
  orderedVsReceivedSummary: string;
  /** 물품 상태 요약 (한국어, 예: "정상" 또는 "손상 발견") */
  conditionSummary: string;
  /** 물품 상태 톤 */
  conditionTone: "ok" | "warning" | "danger";
  /** 문서 요약 (한국어, 예: "COA ✓ · MSDS ✓ · Validation ✗") */
  documentSummary: string;
  /** 검수 요약 (한국어, 예: "검수 완료 · 합격") */
  inspectionSummary: string;
  /** 검수 톤 */
  inspectionTone: "pass" | "fail" | "pending" | "not_required";
  /** Lot 요약 (한국어, 예: "2개 lot · LOT-A, LOT-B") */
  lotSummary: string;
  /** 만료 위험 요약 (한국어, 예: "LOT-A 만료 30일 이내") */
  expiryRiskSummary?: string;
  /** 만료 위험 톤 */
  expiryTone?: "normal" | "warning" | "danger";
  /** 재고 반영 준비 상태 */
  postingReadiness: "ready" | "blocked" | "posted";
  /** 반영 차단 사유 목록 */
  postingBlockers?: string[];
  /** 이슈 요약 */
  issueSummary?: string;
}

// ---------------------------------------------------------------------------
// 4. 수령 Lot 기록 ViewModel
// ---------------------------------------------------------------------------

/** 수령 Lot 기록 ViewModel */
export interface ReceivedLotRecordVM {
  /** Lot 기록 ID */
  id: string;
  /** Lot 번호 */
  lotNumber: string;
  /** 수량 요약 (한국어, 예: "500mL × 2") */
  quantitySummary: string;
  /** 유효기한 상태 */
  expiryState: {
    label: string;
    tone: "normal" | "warning" | "danger" | "expired";
  };
  /** 문서 구비율 요약 (한국어) */
  documentCoverageSummary: string;
  /** 격리 상태 라벨 (한국어) */
  quarantineLabel: string;
  /** 격리 상태 톤 */
  quarantineTone: "released" | "quarantined" | "blocked" | "pending" | "not_applicable";
  /** 재고 반영 상태 */
  inventoryPostingState: { label: string; isPosted: boolean };
  /** 라벨 상태 라벨 (한국어) */
  labelStatusLabel: string;
  /** 위험 배지 목록 */
  riskBadges: string[];
}

// ---------------------------------------------------------------------------
// 5. 재고 반영 ViewModel
// ---------------------------------------------------------------------------

/** 재고 반영(Inventory Inbound Posting) ViewModel */
export interface InventoryInboundPostingVM {
  /** 반영 번호 */
  postingNumber: string;
  /** 반영 상태 라벨 (한국어) */
  postingStatusLabel: string;
  /** 반영 톤 */
  postingTone: string;
  /** 목적지 위치명 */
  destinationLocationName: string;
  /** 반영 가능 라인 수 */
  postableLineCount: number;
  /** 차단된 라인 수 */
  blockedLineCount: number;
  /** 격리 라인 수 */
  quarantineLineCount: number;
  /** 반영 준비 상태 */
  postingReadiness: "ready" | "partial" | "blocked";
  /** 반영 차단 사유 목록 */
  postingBlockers: string[];
}

// ---------------------------------------------------------------------------
// 6. 입고 판정 요약 ViewModel
// ---------------------------------------------------------------------------

/** 입고 전체 판정 요약 ViewModel — 검수/반영/출고 준비 상태 집계 */
export interface ReceivingDecisionSummaryVM {
  /** 검수 준비 상태 */
  inspectionReadiness: "ready" | "needs_review" | "blocked";
  /** 재고 반영 준비 상태 */
  postingReadiness: "ready" | "partial" | "blocked";
  /** 재고 출고 준비 상태 */
  inventoryReleaseReadiness: "ready" | "partial" | "blocked";
  /** 미해결 이슈 수 */
  openIssueCount: number;
  /** 격리 lot 수 */
  quarantineLotCount: number;
  /** 누락 문서 수 */
  missingDocumentCount: number;
  /** 만료 위험 lot 수 */
  expiryRiskLotCount: number;
  /** 권장 다음 조치 */
  recommendedNextAction: { label: string; actionKey: string };
  /** 권장 다음 담당자 */
  recommendedNextOwner?: string;
}

// ---------------------------------------------------------------------------
// 7. 입고 페이지 ViewModel (최상위)
// ---------------------------------------------------------------------------

/** 입고 상세 페이지 전체를 구성하는 최상위 ViewModel */
export interface ReceivingPageViewModel {
  /** 헤더 정보 */
  header: ReceivingBatchHeaderVM;
  /** 라인별 수령 ViewModel */
  lines: ReceivingLineReceiptVM[];
  /** Lot 기록 ViewModel */
  lots: ReceivedLotRecordVM[];
  /** 재고 반영 ViewModel */
  posting?: InventoryInboundPostingVM;
  /** 판정 요약 */
  decision: ReceivingDecisionSummaryVM;
  /** 배송 기대 요약 */
  shipmentExpectation?: {
    statusLabel: string;
    arrivalLabel: string;
    trackingLabel?: string;
  };
  /** 페이지 상태 (빈 상태/에러/접근 불가) */
  pageState: { isEmpty: boolean; hasError: boolean; isUnavailable: boolean };
}

// ===========================================================================
// 헬퍼 함수
// ===========================================================================

// ---------------------------------------------------------------------------
// 8. 도착 상태 계산
// ---------------------------------------------------------------------------

/**
 * 배송 약속일과 실제 도착일로 도착 상태를 계산한다.
 *
 * - actualArrivalAt이 있으면 "arrived"
 * - promisedDeliveryAt이 지났으면 "overdue"
 * - promisedDeliveryAt이 2일 이내면 "due_soon"
 * - 그 외 "normal"
 */
export function resolveArrivalState(
  promisedDeliveryAt: string | undefined,
  actualArrivalAt: string | undefined,
  now?: Date,
): { label: string; isOverdue: boolean; tone: "normal" | "due_soon" | "overdue" | "arrived" } {
  const current = now ?? new Date();

  if (actualArrivalAt) {
    return { label: "도착 완료", isOverdue: false, tone: "arrived" };
  }

  if (!promisedDeliveryAt) {
    return { label: "도착 예정일 미정", isOverdue: false, tone: "normal" };
  }

  const promised = new Date(promisedDeliveryAt);
  const diffMs = promised.getTime() - current.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return { label: "도착 지연", isOverdue: true, tone: "overdue" };
  }

  if (diffDays <= 2) {
    return { label: "도착 임박", isOverdue: false, tone: "due_soon" };
  }

  return { label: "도착 대기", isOverdue: false, tone: "normal" };
}

// ---------------------------------------------------------------------------
// 9. 라인 수령 진행률 계산
// ---------------------------------------------------------------------------

/**
 * 입고 라인 목록에서 수령 진행률을 계산한다.
 *
 * - receiptStatus가 "received" | "over_received" | "posted"이면 수령 완료로 간주
 * - 한국어 라벨 예: "3/5 품목 수령"
 */
export function calculateReceivingLineProgress(
  lines: ReceivingLineReceiptContract[],
): { received: number; total: number; label: string } {
  const total = lines.length;
  const receivedStatuses: string[] = ["received", "over_received", "posted"];
  const received = lines.filter((l) => receivedStatuses.includes(l.receiptStatus)).length;

  return {
    received,
    total,
    label: `${received}/${total} 품목 수령`,
  };
}

// ---------------------------------------------------------------------------
// 10. 재고 반영 준비 상태 계산
// ---------------------------------------------------------------------------

/**
 * 입고 배치와 검수 결과로 재고 반영 준비 상태를 계산한다.
 *
 * - blocked: lot 누락, 검수 불합격, 배치 미수령
 * - partial: 일부 라인만 반영 가능
 * - ready: 모든 라인 반영 가능
 */
export function resolvePostingReadiness(
  batch: ReceivingBatchContract,
  inspections: ReceivingInspectionContract[],
): { readiness: "ready" | "partial" | "blocked"; blockers: string[] } {
  const blockers: string[] = [];

  // 배치가 수령 완료 이전이면 차단
  const receivedStatuses: string[] = [
    "received",
    "inspection_in_progress",
    "ready_to_post",
    "posted",
    "closed",
  ];
  if (!receivedStatuses.includes(batch.status)) {
    blockers.push("입고 배치가 수령 완료 상태가 아닙니다");
  }

  // 검수 불합격 라인 확인
  const failedInspections = inspections.filter((i) => i.decision === "fail");
  if (failedInspections.length > 0) {
    blockers.push(`검수 불합격 ${failedInspections.length}건`);
  }

  // lot 누락 라인 확인
  const linesWithoutLot = batch.lineReceipts.filter(
    (l) => l.lotRecords.length === 0 && l.receiptStatus !== "missing" && l.receiptStatus !== "rejected",
  );
  if (linesWithoutLot.length > 0) {
    blockers.push(`lot 기록 누락 ${linesWithoutLot.length}건`);
  }

  if (blockers.length > 0) {
    // 일부 라인은 준비 가능한지 확인
    const readyLines = batch.lineReceipts.filter((l) => {
      if (l.lotRecords.length === 0) return false;
      const lineInspections = inspections.filter(
        (i) => i.receivingLineReceiptId === l.id,
      );
      const hasFailed = lineInspections.some((i) => i.decision === "fail");
      if (hasFailed) return false;
      const needsInspection = l.inspectionRequired;
      if (needsInspection) {
        const allPassed = lineInspections.every(
          (i) => i.decision === "pass" || i.decision === "conditional",
        );
        return lineInspections.length > 0 && allPassed;
      }
      return true;
    });

    if (readyLines.length > 0 && readyLines.length < batch.lineReceipts.length) {
      return { readiness: "partial", blockers };
    }

    return { readiness: "blocked", blockers };
  }

  // 검수 필요한 라인 모두 통과 확인
  for (const line of batch.lineReceipts) {
    if (!line.inspectionRequired) continue;
    const lineInspections = inspections.filter(
      (i) => i.receivingLineReceiptId === line.id,
    );
    if (lineInspections.length === 0) {
      blockers.push(`라인 ${line.lineNumber} 검수 미완료`);
      continue;
    }
    const hasPending = lineInspections.some(
      (i) => i.decision !== "pass" && i.decision !== "conditional",
    );
    if (hasPending) {
      blockers.push(`라인 ${line.lineNumber} 검수 미통과`);
    }
  }

  if (blockers.length > 0) {
    return { readiness: "partial", blockers };
  }

  return { readiness: "ready", blockers: [] };
}

// ---------------------------------------------------------------------------
// 11. 재고 출고 준비 상태 계산
// ---------------------------------------------------------------------------

/**
 * 재고 반영 결과로 출고(release) 준비 상태를 계산한다.
 *
 * - blocked: 미반영, quarantine blocked, 검수 불합격, 만료 위험, 문서 누락
 * - partial: 일부 라인만 available
 * - ready: 전체 라인 available
 */
export function resolveInventoryReleaseReadiness(
  posting: InventoryInboundPostingContract,
): { readiness: "ready" | "partial" | "blocked"; blockers: string[] } {
  const blockers: string[] = [];

  if (posting.status !== "posted" && posting.status !== "partially_posted") {
    blockers.push("재고 반영이 완료되지 않았습니다");
    return { readiness: "blocked", blockers };
  }

  const quarantineBlocked = posting.postingLines.filter(
    (l) => l.inventoryStatusAfterPosting === "quarantined" || l.inventoryStatusAfterPosting === "restricted",
  );
  if (quarantineBlocked.length > 0) {
    blockers.push(`격리/제한 상태 ${quarantineBlocked.length}건`);
  }

  const expired = posting.postingLines.filter(
    (l) => l.inventoryStatusAfterPosting === "expired",
  );
  if (expired.length > 0) {
    blockers.push(`만료 상태 ${expired.length}건`);
  }

  const needsFollowUp = posting.postingLines.filter((l) => l.requiresFollowUp);
  if (needsFollowUp.length > 0) {
    blockers.push(`후속 조치 필요 ${needsFollowUp.length}건`);
  }

  if (posting.blockedReasons.length > 0) {
    blockers.push(...posting.blockedReasons);
  }

  if (blockers.length === 0) {
    return { readiness: "ready", blockers: [] };
  }

  const availableLines = posting.postingLines.filter(
    (l) => l.inventoryStatusAfterPosting === "available",
  );
  if (availableLines.length > 0 && availableLines.length < posting.postingLines.length) {
    return { readiness: "partial", blockers };
  }

  return { readiness: "blocked", blockers };
}

// ---------------------------------------------------------------------------
// 12. 유효기한 상태 계산
// ---------------------------------------------------------------------------

/**
 * 유효기한으로 만료 상태를 계산한다.
 *
 * - expired: 이미 만료됨
 * - danger: 30일 이내 만료
 * - warning: 90일 이내 만료
 * - normal: 정상
 */
export function resolveExpiryState(
  expiryDate: string | undefined,
  now?: Date,
): { label: string; tone: "normal" | "warning" | "danger" | "expired" } {
  if (!expiryDate) {
    return { label: "유효기한 미등록", tone: "normal" };
  }

  const current = now ?? new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - current.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return { label: "만료됨", tone: "expired" };
  }

  if (diffDays <= RECEIVING_SLA_DEFAULTS.expiryDangerDays) {
    return { label: "30일 이내 만료", tone: "danger" };
  }

  if (diffDays <= RECEIVING_SLA_DEFAULTS.expiryWarningDays) {
    return { label: "90일 이내 만료", tone: "warning" };
  }

  return { label: "정상", tone: "normal" };
}

// ---------------------------------------------------------------------------
// 13. 라인 수령 상태로 배치 상태 집계
// ---------------------------------------------------------------------------

/**
 * 라인 수령 상태 목록으로 배치 수준 상태를 집계한다.
 *
 * - 하나라도 issue_flagged → issue_flagged
 * - 전체 received/over_received/posted → received
 * - 일부만 수령 → partially_received
 * - 그 외 → pending
 */
export function aggregateBatchStatusFromLines(
  lines: ReceivingLineReceiptContract[],
): "pending" | "partially_received" | "received" | "issue_flagged" {
  if (lines.length === 0) return "pending";

  const hasIssue = lines.some((l) => l.receiptStatus === "issue_flagged");
  if (hasIssue) return "issue_flagged";

  const completedStatuses: string[] = ["received", "over_received", "posted"];
  const allCompleted = lines.every((l) => completedStatuses.includes(l.receiptStatus));
  if (allCompleted) return "received";

  const someCompleted = lines.some((l) => completedStatuses.includes(l.receiptStatus));
  if (someCompleted) return "partially_received";

  return "pending";
}

// ---------------------------------------------------------------------------
// 14. 문서 구비율 계산
// ---------------------------------------------------------------------------

/**
 * Lot 기록 목록에서 COA/MSDS 문서 구비율을 계산한다.
 *
 * - 한국어 라벨 예: "COA 4/5 · MSDS 5/5"
 */
export function calculateDocumentCoverage(
  lots: ReceivedLotRecordContract[],
): { coaRate: string; msdsRate: string; overallLabel: string } {
  const total = lots.length;
  if (total === 0) {
    return { coaRate: "0/0", msdsRate: "0/0", overallLabel: "문서 없음" };
  }

  const coaCount = lots.filter((l) => l.coaAttached).length;
  const msdsCount = lots.filter((l) => l.msdsAttached).length;

  const coaRate = `${coaCount}/${total}`;
  const msdsRate = `${msdsCount}/${total}`;

  return {
    coaRate,
    msdsRate,
    overallLabel: `COA ${coaRate} · MSDS ${msdsRate}`,
  };
}
