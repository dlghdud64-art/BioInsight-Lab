/**
 * ops-console/blocker-adapter.ts
 *
 * 공통 blocker summary model 및 도메인별 blocker 해석/해결 어댑터.
 * 기존 exception-handling-contract와 충돌하지 않으면서
 * UI adapter 레이어에서 blocker를 일관된 구조로 계산합니다.
 *
 * @module ops-console/blocker-adapter
 */

import type { QuoteRequestContract, QuoteResponseContract, QuoteComparisonContract } from '../review-queue/quote-rfq-contract';
import type {
  PurchaseOrderContract,
  ApprovalExecutionContract,
  PurchaseOrderAcknowledgementContract,
} from '../review-queue/po-approval-contract';
import type { ReceivingBatchContract } from '../review-queue/receiving-inbound-contract';
import type {
  ReorderRecommendationContract,
  ExpiryActionContract,
  InventoryStockPositionContract,
} from '../review-queue/reorder-expiry-stock-risk-contract';

// ---------------------------------------------------------------------------
// 1. Blocker Type Taxonomy
// ---------------------------------------------------------------------------

export type BlockerType =
  | 'missing_document'
  | 'missing_lot_or_expiry'
  | 'inspection_pending'
  | 'approval_pending'
  | 'budget_blocked'
  | 'duplicate_open_flow'
  | 'vendor_response_missing'
  | 'vendor_ack_missing'
  | 'quarantine_active'
  | 'spec_mismatch'
  | 'substitute_requires_review'
  | 'policy_locked'
  | 'owner_unassigned'
  | 'external_followup_required'
  | 'invalid_state_linkage';

// ---------------------------------------------------------------------------
// 2. Severity / Handling Class
// ---------------------------------------------------------------------------

export type BlockerSeverity =
  | 'hard_block'
  | 'review_gate'
  | 'soft_warning'
  | 'external_wait';

// ---------------------------------------------------------------------------
// 3. Resolution Action Type
// ---------------------------------------------------------------------------

export type ResolutionActionType =
  | 'provide_missing_input'
  | 'request_internal_review'
  | 'request_approval'
  | 'follow_up_external'
  | 'assign_owner'
  | 'clear_duplicate_or_conflict'
  | 'accept_partial_path'
  | 'escalate_issue'
  | 'open_linked_entity'
  | 'dismiss_non_blocking_warning';

// ---------------------------------------------------------------------------
// 4. Blocker Summary Model
// ---------------------------------------------------------------------------

export interface BlockerSummary {
  /** blocker 유형 */
  blockerType: BlockerType;
  /** 심각도 / 처리 유형 */
  severity: BlockerSeverity;
  /** 고유 key (dedup용) */
  summaryKey: string;
  /** 무엇이 막혔는지 */
  whatIsBlocked: string;
  /** 왜 막혔는지 */
  whyBlocked: string;
  /** 어떻게 풀 수 있는지 */
  whatCanResolveIt: string;
  /** 해결 담당자 */
  resolutionOwnerName?: string;
  /** 해결 담당자 역할 */
  resolutionOwnerRole?: string;
  /** 외부 대기 라벨 */
  waitingExternalLabel?: string;
  /** 부분 진행 가능 여부 */
  canPartiallyContinue: boolean;
  /** 부분 진행 가능 시 무엇이 가능한지 */
  partialContinuationLabel?: string;
  /** 추천 해결 액션 유형 */
  recommendedResolutionAction: ResolutionActionType;
  /** 추천 해결 액션 라벨 */
  recommendedResolutionLabel: string;
  /** 연결 엔티티 경로 */
  linkedEntityRoute?: string;
  /** 에스컬레이션 필요 여부 */
  escalationRequired: boolean;
  /** 해결 후 복귀 대상 상태 */
  resolvedStateTarget?: string;
  /** 해결 후 다음 핸드오프 */
  afterResolutionHandoff?: string;
}

// ---------------------------------------------------------------------------
// 5. Aggregated Blocker View
// ---------------------------------------------------------------------------

export interface AggregatedBlockerView {
  /** hard_block 목록 */
  hardBlocks: BlockerSummary[];
  /** review_gate 목록 */
  reviewGates: BlockerSummary[];
  /** soft_warning 목록 */
  softWarnings: BlockerSummary[];
  /** external_wait 목록 */
  externalWaits: BlockerSummary[];
  /** 전체 blocker 수 */
  totalCount: number;
  /** hard_block 존재 여부 */
  hasHardBlock: boolean;
  /** 부분 진행 가능 여부 (hard_block이 있어도) */
  canPartiallyContinue: boolean;
  /** 부분 진행 가능 라벨 */
  partialContinuationLabel?: string;
  /** 전체 해결 가능 여부 */
  allResolvable: boolean;
}

function aggregate(blockers: BlockerSummary[]): AggregatedBlockerView {
  const hardBlocks = blockers.filter((b) => b.severity === 'hard_block');
  const reviewGates = blockers.filter((b) => b.severity === 'review_gate');
  const softWarnings = blockers.filter((b) => b.severity === 'soft_warning');
  const externalWaits = blockers.filter((b) => b.severity === 'external_wait');
  const canPartial = blockers.some((b) => b.canPartiallyContinue);
  const partialLabel = blockers.find((b) => b.canPartiallyContinue)?.partialContinuationLabel;
  return {
    hardBlocks,
    reviewGates,
    softWarnings,
    externalWaits,
    totalCount: blockers.length,
    hasHardBlock: hardBlocks.length > 0,
    canPartiallyContinue: canPartial,
    partialContinuationLabel: partialLabel,
    allResolvable: blockers.every(
      (b) => b.severity !== 'hard_block' || b.recommendedResolutionAction !== 'escalate_issue',
    ),
  };
}

// ---------------------------------------------------------------------------
// 6. Quote Blockers
// ---------------------------------------------------------------------------

export function buildQuoteBlockers(
  qr: QuoteRequestContract,
  responses: QuoteResponseContract[],
  comparison: QuoteComparisonContract | null,
): AggregatedBlockerView {
  const blockers: BlockerSummary[] = [];
  const isVendorSelected = qr.status === 'vendor_selected' || qr.status === 'converted_to_po';

  // vendor response missing
  const respondedCount = responses.filter(
    (r) => r.responseStatus === 'responded' || r.responseStatus === 'incomplete',
  ).length;
  if (respondedCount < qr.vendorIds.length && !isVendorSelected) {
    blockers.push({
      blockerType: 'vendor_response_missing',
      severity: respondedCount === 0 ? 'external_wait' : 'soft_warning',
      summaryKey: `qr-${qr.id}-vendor-missing`,
      whatIsBlocked: '공급사 비교 불완전',
      whyBlocked: `${qr.vendorIds.length - respondedCount}곳 공급사 미응답`,
      whatCanResolveIt: '공급사에 응답 요청 또는 현재 응답 기준으로 진행',
      waitingExternalLabel: `미응답 ${qr.vendorIds.length - respondedCount}곳`,
      canPartiallyContinue: respondedCount > 0,
      partialContinuationLabel: respondedCount > 0 ? '현재 응답 기준 비교/선정 가능' : undefined,
      recommendedResolutionAction: 'follow_up_external',
      recommendedResolutionLabel: '공급사 응답 독촉',
      escalationRequired: false,
      resolvedStateTarget: 'comparison_ready',
    });
  }

  // substitute requires review
  const hasSubstitute = responses.some((r) => r.responseItems.some((ri) => ri.substituteOffered));
  if (hasSubstitute && !isVendorSelected) {
    blockers.push({
      blockerType: 'substitute_requires_review',
      severity: 'review_gate',
      summaryKey: `qr-${qr.id}-substitute`,
      whatIsBlocked: '공급사 선정',
      whyBlocked: '대체품 제안 포함 — 스펙 적합성 미확인',
      whatCanResolveIt: '대체품 스펙 검토 후 적합 여부 판단',
      resolutionOwnerRole: '스펙 검토자',
      canPartiallyContinue: true,
      partialContinuationLabel: '비교 검토 가능, 선정은 검토 후',
      recommendedResolutionAction: 'request_internal_review',
      recommendedResolutionLabel: '대체품 스펙 검토',
      escalationRequired: false,
      resolvedStateTarget: 'vendor_selected',
    });
  }

  // missing docs in comparison
  if (comparison) {
    const hasMissingDocs = comparison.comparableItemRows.some((row) =>
      row.vendorColumns.some((vc) => vc.warningBadges?.length > 0),
    );
    if (hasMissingDocs) {
      blockers.push({
        blockerType: 'missing_document',
        severity: 'review_gate',
        summaryKey: `qr-${qr.id}-docs`,
        whatIsBlocked: '일부 공급사 비교 정확도',
        whyBlocked: '필수 문서 미첨부 공급사 존재',
        whatCanResolveIt: '공급사에 문서 재요청 또는 현재 정보 기준 판단',
        canPartiallyContinue: true,
        partialContinuationLabel: '문서 없이도 비교/선정 가능',
        recommendedResolutionAction: 'follow_up_external',
        recommendedResolutionLabel: '문서 재요청',
        escalationRequired: false,
      });
    }

    // conversion blockers
    for (const cb of comparison.conversionBlockers ?? []) {
      blockers.push({
        blockerType: 'policy_locked',
        severity: 'hard_block',
        summaryKey: `qr-${qr.id}-conv-${cb.slice(0, 20)}`,
        whatIsBlocked: '발주 전환',
        whyBlocked: cb,
        whatCanResolveIt: '차단 조건 해소 후 전환 재시도',
        canPartiallyContinue: false,
        recommendedResolutionAction: 'request_internal_review',
        recommendedResolutionLabel: '전환 조건 검토',
        escalationRequired: false,
        resolvedStateTarget: 'converted_to_po',
      });
    }
  }

  // vendor not selected
  if (!isVendorSelected && qr.status !== 'converted_to_po' && respondedCount > 0) {
    blockers.push({
      blockerType: 'owner_unassigned',
      severity: 'review_gate',
      summaryKey: `qr-${qr.id}-no-vendor`,
      whatIsBlocked: '발주 전환',
      whyBlocked: '공급사 미선정',
      whatCanResolveIt: '비교 검토 후 공급사 선택',
      canPartiallyContinue: false,
      recommendedResolutionAction: 'provide_missing_input',
      recommendedResolutionLabel: '공급사 선정',
      escalationRequired: false,
      resolvedStateTarget: 'vendor_selected',
      afterResolutionHandoff: '발주 전환 → PO 발행',
    });
  }

  return aggregate(blockers);
}

// ---------------------------------------------------------------------------
// 7. PO Blockers
// ---------------------------------------------------------------------------

export function buildPOBlockers(
  po: PurchaseOrderContract,
  approval: ApprovalExecutionContract | undefined,
  ack: PurchaseOrderAcknowledgementContract | undefined,
): AggregatedBlockerView {
  const blockers: BlockerSummary[] = [];
  const isApproved = po.status === 'approved' || po.status === 'ready_to_issue';
  const isIssued = po.status === 'issued' || po.status === 'acknowledged';

  // approval pending
  if (!isApproved && !isIssued && approval?.status !== 'approved') {
    const activeStep = approval?.steps.find((s) => s.status === 'active');
    blockers.push({
      blockerType: 'approval_pending',
      severity: 'hard_block',
      summaryKey: `po-${po.id}-approval`,
      whatIsBlocked: '발주 발행',
      whyBlocked: '승인 프로세스 미완료',
      whatCanResolveIt: activeStep
        ? `${activeStep.stepType} 단계 승인 완료`
        : '승인 워크플로 진행',
      resolutionOwnerName: activeStep?.assigneeIds[0],
      resolutionOwnerRole: '승인 담당자',
      canPartiallyContinue: true,
      partialContinuationLabel: '발주 상세 검토 가능, 발행은 승인 후',
      recommendedResolutionAction: 'request_approval',
      recommendedResolutionLabel: '승인 요청',
      escalationRequired: false,
      resolvedStateTarget: 'approved',
      afterResolutionHandoff: '발행 → 공급사 확인 대기',
    });
  }

  // vendor ack missing
  const ackPending =
    po.status === 'issued' && (!ack || ack.status === 'sent' || ack.status === 'not_sent');
  if (ackPending) {
    blockers.push({
      blockerType: 'vendor_ack_missing',
      severity: 'external_wait',
      summaryKey: `po-${po.id}-ack`,
      whatIsBlocked: '입고 핸드오프',
      whyBlocked: '공급사 발주 확인 미응답',
      whatCanResolveIt: '공급사에 확인 독촉 또는 확인 직접 등록',
      waitingExternalLabel: '공급사 확인 대기',
      canPartiallyContinue: false,
      recommendedResolutionAction: 'follow_up_external',
      recommendedResolutionLabel: '공급사 확인 독촉',
      escalationRequired: false,
      resolvedStateTarget: 'acknowledged',
      afterResolutionHandoff: '입고 준비',
    });
  }

  // due date risk
  if (po.requiredByAt) {
    const diffMs = new Date(po.requiredByAt).getTime() - Date.now();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 0) {
      blockers.push({
        blockerType: 'external_followup_required',
        severity: 'soft_warning',
        summaryKey: `po-${po.id}-overdue`,
        whatIsBlocked: '납기 준수',
        whyBlocked: `납기 ${Math.abs(Math.floor(diffDays))}일 초과`,
        whatCanResolveIt: '공급사와 납기 재협의',
        canPartiallyContinue: true,
        recommendedResolutionAction: 'follow_up_external',
        recommendedResolutionLabel: '납기 재확인',
        escalationRequired: diffDays < -3,
      });
    }
  }

  return aggregate(blockers);
}

// ---------------------------------------------------------------------------
// 8. Receiving Blockers
// ---------------------------------------------------------------------------

export function buildReceivingBlockers(rb: ReceivingBatchContract): AggregatedBlockerView {
  const blockers: BlockerSummary[] = [];
  const isPosted = rb.status === 'posted' || rb.status === 'closed';
  if (isPosted) return aggregate(blockers);

  // missing documents
  const docMissingLines = rb.lineReceipts.filter(
    (l) => l.documentStatus === 'partial' || l.documentStatus === 'missing',
  );
  if (docMissingLines.length > 0) {
    blockers.push({
      blockerType: 'missing_document',
      severity: 'hard_block',
      summaryKey: `rb-${rb.id}-docs`,
      whatIsBlocked: '검수 진행 및 재고 반영',
      whyBlocked: `${docMissingLines.length}건 라인 필수 문서(COA/MSDS) 미첨부`,
      whatCanResolveIt: '공급사에 문서 재요청 후 첨부',
      waitingExternalLabel: '공급사 문서 대기',
      resolutionOwnerRole: '입고 담당자',
      canPartiallyContinue: false,
      recommendedResolutionAction: 'follow_up_external',
      recommendedResolutionLabel: '공급사 문서 재요청',
      escalationRequired: false,
      resolvedStateTarget: 'inspection_ready',
      afterResolutionHandoff: '검수 실행 → 재고 반영',
    });
  }

  // quarantine
  const quarantineLines = rb.lineReceipts.filter((l) =>
    l.lotRecords.some((lot) => lot.quarantineStatus === 'quarantined'),
  );
  if (quarantineLines.length > 0) {
    blockers.push({
      blockerType: 'quarantine_active',
      severity: 'hard_block',
      summaryKey: `rb-${rb.id}-quarantine`,
      whatIsBlocked: '재고 반영 (격리 품목)',
      whyBlocked: `${quarantineLines.length}건 라인 온도 이탈/손상 — 격리 중`,
      whatCanResolveIt: '격리 검사 실행 후 해제/폐기 판정',
      resolutionOwnerRole: '품질/준법 검토자',
      canPartiallyContinue: true,
      partialContinuationLabel: '격리 외 라인은 검수 가능',
      recommendedResolutionAction: 'request_internal_review',
      recommendedResolutionLabel: '격리 검사 판정',
      escalationRequired: false,
      resolvedStateTarget: 'ready_to_post',
    });
  }

  // inspection pending
  const inspPendingLines = rb.lineReceipts.filter(
    (l) =>
      l.inspectionRequired &&
      (l.inspectionStatus === 'pending' || l.inspectionStatus === 'in_progress'),
  );
  if (inspPendingLines.length > 0) {
    blockers.push({
      blockerType: 'inspection_pending',
      severity: 'review_gate',
      summaryKey: `rb-${rb.id}-inspection`,
      whatIsBlocked: '재고 반영',
      whyBlocked: `검수 대기 ${inspPendingLines.length}건`,
      whatCanResolveIt: '각 라인 검수 실행 후 합격/불합격 판정',
      resolutionOwnerRole: '검수 담당자',
      canPartiallyContinue: true,
      partialContinuationLabel: '검수 완료 라인은 반영 대기',
      recommendedResolutionAction: 'provide_missing_input',
      recommendedResolutionLabel: '검수 실행',
      escalationRequired: false,
      resolvedStateTarget: 'ready_to_post',
      afterResolutionHandoff: '재고 반영 → 재고 위험 재평가',
    });
  }

  // partial receipt
  const totalReceived = rb.lineReceipts.reduce((sum, l) => sum + l.receivedQuantity, 0);
  const totalOrdered = rb.lineReceipts.reduce((sum, l) => sum + l.orderedQuantity, 0);
  if (totalReceived < totalOrdered) {
    blockers.push({
      blockerType: 'external_followup_required',
      severity: 'soft_warning',
      summaryKey: `rb-${rb.id}-partial`,
      whatIsBlocked: '전량 입고',
      whyBlocked: `${totalOrdered - totalReceived}건 미도착`,
      whatCanResolveIt: '운송 추적 또는 공급사 확인',
      canPartiallyContinue: true,
      partialContinuationLabel: '도착분 먼저 처리 가능',
      recommendedResolutionAction: 'follow_up_external',
      recommendedResolutionLabel: '미도착 분 확인',
      escalationRequired: false,
    });
  }

  return aggregate(blockers);
}

// ---------------------------------------------------------------------------
// 9. Stock Risk Blockers
// ---------------------------------------------------------------------------

export function buildStockRiskBlockers(
  stockPositions: InventoryStockPositionContract[],
  reorderRecommendations: ReorderRecommendationContract[],
  expiryActions: ExpiryActionContract[],
): AggregatedBlockerView {
  const blockers: BlockerSummary[] = [];

  // blocked reorders
  for (const rr of reorderRecommendations.filter((r) => r.status === 'blocked')) {
    for (const reason of rr.blockedReasons) {
      const isBudget = reason.includes('예산') || reason.includes('한도');
      const isDuplicate = reason.includes('중복') || reason.includes('이미');
      blockers.push({
        blockerType: isBudget ? 'budget_blocked' : isDuplicate ? 'duplicate_open_flow' : 'policy_locked',
        severity: 'hard_block',
        summaryKey: `rr-${rr.id}-${reason.slice(0, 15)}`,
        whatIsBlocked: `${rr.inventoryItemId} 재주문 견적 생성`,
        whyBlocked: reason,
        whatCanResolveIt: isBudget
          ? '예산 검토 요청 또는 승인자 확인'
          : isDuplicate
            ? '기존 진행 중 건 확인 및 정리'
            : '정책 검토 후 해제',
        resolutionOwnerRole: isBudget ? '재무 검토자' : '구매 관리자',
        canPartiallyContinue: true,
        partialContinuationLabel: '다른 품목 재주문은 진행 가능',
        recommendedResolutionAction: isBudget
          ? 'request_approval'
          : isDuplicate
            ? 'clear_duplicate_or_conflict'
            : 'request_internal_review',
        recommendedResolutionLabel: isBudget
          ? '예산 검토 요청'
          : isDuplicate
            ? '중복 건 정리'
            : '정책 검토',
        escalationRequired: false,
        resolvedStateTarget: 'open',
        afterResolutionHandoff: '견적 요청 생성 가능',
      });
    }
  }

  // critical shortage
  for (const sp of stockPositions.filter((s) => s.riskStatus === 'critical_shortage')) {
    blockers.push({
      blockerType: 'external_followup_required',
      severity: 'hard_block',
      summaryKey: `sp-${sp.id}-critical`,
      whatIsBlocked: `${sp.inventoryItemId} 가용 재고`,
      whyBlocked: `긴급 부족 — 가용 ${sp.availableQuantity}${sp.unit}`,
      whatCanResolveIt: '긴급 재주문 견적 요청 또는 대체품 확인',
      canPartiallyContinue: false,
      recommendedResolutionAction: 'open_linked_entity',
      recommendedResolutionLabel: '긴급 견적 요청',
      linkedEntityRoute: '/dashboard/quotes',
      escalationRequired: true,
      resolvedStateTarget: 'reorder_due',
    });
  }

  // overdue expiry actions
  for (const ea of expiryActions.filter(
    (e) => e.status === 'open' || e.status === 'overdue',
  )) {
    const isOverdue = ea.status === 'overdue' || (ea.daysToExpiry !== undefined && ea.daysToExpiry <= 0);
    blockers.push({
      blockerType: 'missing_lot_or_expiry',
      severity: isOverdue ? 'hard_block' : 'review_gate',
      summaryKey: `ea-${ea.id}`,
      whatIsBlocked: `${ea.inventoryItemId} 만료 로트 조치`,
      whyBlocked: `${ea.lotNumber} — ${ea.daysToExpiry ?? 0}일 후 만료`,
      whatCanResolveIt: ea.actionType === 'dispose' ? '폐기 처리' : '우선 사용 또는 이전 처리',
      resolutionOwnerRole: '재고 관리자',
      canPartiallyContinue: true,
      partialContinuationLabel: '다른 로트 사용 가능',
      recommendedResolutionAction: 'provide_missing_input',
      recommendedResolutionLabel: ea.actionType === 'dispose' ? '폐기 완료' : '만료 조치 완료',
      escalationRequired: isOverdue,
      resolvedStateTarget: 'completed',
    });
  }

  // quarantine constrained
  for (const sp of stockPositions.filter((s) => s.riskStatus === 'quarantine_constrained')) {
    blockers.push({
      blockerType: 'quarantine_active',
      severity: 'review_gate',
      summaryKey: `sp-${sp.id}-quarantine`,
      whatIsBlocked: `${sp.inventoryItemId} 가용량 제한`,
      whyBlocked: `격리 ${sp.quarantinedQuantity}${sp.unit} — 사용 불가`,
      whatCanResolveIt: '격리 검사 판정 후 해제 또는 폐기',
      resolutionOwnerRole: '품질 관리자',
      canPartiallyContinue: true,
      partialContinuationLabel: `가용 ${sp.availableQuantity}${sp.unit} 사용 가능`,
      recommendedResolutionAction: 'request_internal_review',
      recommendedResolutionLabel: '격리 검사 판정',
      escalationRequired: false,
    });
  }

  return aggregate(blockers);
}

// ---------------------------------------------------------------------------
// 10. Inbox Blocker Summary
// ---------------------------------------------------------------------------

export function buildInboxItemBlockers(item: {
  workType: string;
  blockedReason?: string;
  riskBadges: string[];
}): BlockerSummary[] {
  const blockers: BlockerSummary[] = [];

  if (item.blockedReason) {
    // Classify based on content
    const reason = item.blockedReason;
    const isBudget = reason.includes('예산') || reason.includes('한도');
    const isDoc = reason.includes('문서') || reason.includes('COA');
    const isQuarantine = reason.includes('격리');
    const isInspection = reason.includes('검수') || reason.includes('검사');
    const isDuplicate = reason.includes('중복');

    blockers.push({
      blockerType: isBudget
        ? 'budget_blocked'
        : isDoc
          ? 'missing_document'
          : isQuarantine
            ? 'quarantine_active'
            : isInspection
              ? 'inspection_pending'
              : isDuplicate
                ? 'duplicate_open_flow'
                : 'policy_locked',
      severity: 'hard_block',
      summaryKey: `inbox-${item.workType}-${reason.slice(0, 20)}`,
      whatIsBlocked: '다음 단계 진행',
      whyBlocked: reason,
      whatCanResolveIt: '차단 조건 해소 필요',
      canPartiallyContinue: false,
      recommendedResolutionAction: isBudget
        ? 'request_approval'
        : isDoc
          ? 'follow_up_external'
          : isInspection
            ? 'provide_missing_input'
            : 'request_internal_review',
      recommendedResolutionLabel: '차단 해소',
      escalationRequired: false,
    });
  }

  // Waiting external types
  if (
    item.workType === 'vendor_response_missing' ||
    item.workType === 'quote_response_pending' ||
    item.workType === 'po_ack_pending'
  ) {
    blockers.push({
      blockerType:
        item.workType === 'po_ack_pending' ? 'vendor_ack_missing' : 'vendor_response_missing',
      severity: 'external_wait',
      summaryKey: `inbox-${item.workType}-ext`,
      whatIsBlocked: '외부 응답 대기',
      whyBlocked: '공급사 응답/확인 미도착',
      whatCanResolveIt: '공급사 독촉 또는 대기',
      waitingExternalLabel: '외부 응답 대기',
      canPartiallyContinue: false,
      recommendedResolutionAction: 'follow_up_external',
      recommendedResolutionLabel: '외부 독촉',
      escalationRequired: false,
    });
  }

  return blockers;
}

// ---------------------------------------------------------------------------
// 11. Severity Labels & Tones
// ---------------------------------------------------------------------------

export const SEVERITY_LABELS: Record<BlockerSeverity, string> = {
  hard_block: '차단',
  review_gate: '검토 필요',
  soft_warning: '주의',
  external_wait: '외부 대기',
};

export const SEVERITY_TONES: Record<BlockerSeverity, string> = {
  hard_block: 'text-red-400 bg-red-500/10',
  review_gate: 'text-amber-400 bg-amber-500/10',
  soft_warning: 'text-slate-400 bg-slate-700',
  external_wait: 'text-purple-400 bg-purple-500/10',
};

export const SEVERITY_DOT_COLORS: Record<BlockerSeverity, string> = {
  hard_block: 'bg-red-400',
  review_gate: 'bg-amber-400',
  soft_warning: 'bg-slate-500',
  external_wait: 'bg-purple-400',
};

export const RESOLUTION_ACTION_LABELS: Record<ResolutionActionType, string> = {
  provide_missing_input: '입력 제공',
  request_internal_review: '내부 검토 요청',
  request_approval: '승인 요청',
  follow_up_external: '외부 독촉',
  assign_owner: '담당자 지정',
  clear_duplicate_or_conflict: '중복/충돌 정리',
  accept_partial_path: '부분 진행',
  escalate_issue: '에스컬레이션',
  open_linked_entity: '연결 화면 이동',
  dismiss_non_blocking_warning: '무시',
};
