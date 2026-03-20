/**
 * entity-operational-state.ts
 *
 * Cross-Module Operational Semantics Normalization Layer.
 *
 * contract.ts는 건드리지 않는다.
 * 각 도메인 contract의 raw 상태를 공통 운영 의미로 정규화하여
 * dashboard / inbox / module landing / detail / re-entry가
 * 동일한 truth로 같은 엔티티를 해석하게 한다.
 *
 * 계층:
 *   1. Domain Truth Selectors — contract 기반 원천 상태만 읽기
 *   2. Operational Normalization — 공통 semantics로 정규화
 *   3. Screen Adapters — 표현 생성 (dashboard-adapter, inbox-adapter 등)
 *
 * @module ops-console/entity-operational-state
 */

import type {
  QuoteRequestContract,
  QuoteResponseContract,
  QuoteComparisonContract,
} from '../review-queue/quote-rfq-contract';

import type {
  PurchaseOrderContract,
  ApprovalExecutionContract,
  PurchaseOrderAcknowledgementContract,
} from '../review-queue/po-approval-contract';

import type { ReceivingBatchContract } from '../review-queue/receiving-inbound-contract';

import type {
  InventoryStockPositionContract,
  ReorderRecommendationContract,
  ExpiryActionContract,
} from '../review-queue/reorder-expiry-stock-risk-contract';

// ===========================================================================
// 1. Common Operational Semantics Types
// ===========================================================================

/**
 * 전 화면에서 동일한 뜻으로 사용되는 5대 운영 상태.
 * 각 도메인 고유 상태는 이 5가지 + terminal로 정규화된다.
 */
export type OperationalReadiness =
  | 'ready'             // main execute action 가능
  | 'blocked'           // hard blocker → main action 불가
  | 'needs_review'      // 사람 판단/검토 필요
  | 'waiting_external'  // 외부 응답 대기
  | 'handoff_ready'     // 현재 단계 완료, 다음 단계 인계 가능
  | 'terminal';         // 완료/취소/종료

/**
 * Blocker 분류 taxonomy.
 * 같은 blocker type → 같은 class → 같은 UI 배치 원칙.
 */
export type BlockerClass =
  | 'hard_block'     // 실행 불가
  | 'review_gate'    // 검토 후 진행
  | 'external_wait'  // 외부 응답 대기
  | 'soft_warning';  // 참고/경고

/**
 * Due/SLA 의미 체계.
 * 내부 overdue와 외부 대기 overdue를 구분한다.
 */
export type DueSemantic =
  | 'on_track'
  | 'due_soon'
  | 'overdue_internal'
  | 'overdue_external'
  | 'escalation_required';

/**
 * Handoff 상태.
 * current stage complete + downstream target usable 둘 다 있을 때만 true.
 */
export interface HandoffState {
  ready: boolean;
  targetModule: string | null;
  targetRoute: string | null;
  targetOwner: string | null;
  downstreamEntityId: string | null;
}

/**
 * 공통 Operational State Summary.
 * dashboard / inbox / landing / detail header / action surface에서 재사용.
 */
export interface EntityOperationalState {
  entityType: 'quote' | 'po' | 'receiving' | 'stock_risk';
  entityId: string;

  /** 정규화된 운영 상태 */
  readiness: OperationalReadiness;
  /** 도메인별 세부 상태 (예: 'inspection_in_progress') */
  domainPhase: string;
  /** 한국어 라벨 */
  domainPhaseLabel: string;

  /** Blocker 분류 (없으면 null) */
  blockerClass: BlockerClass | null;
  blockerReasons: string[];

  /** Review 필요 사유 (없으면 빈 배열) */
  reviewReasons: string[];

  /** 외부 대기 사유 (없으면 null) */
  waitingExternalSummary: string | null;

  /** Handoff 상태 */
  handoff: HandoffState;

  /** Due/SLA */
  dueSemantic: DueSemantic;
  dueLabel: string;
  isOverdue: boolean;

  /** Priority */
  priorityClass: 'p0' | 'p1' | 'p2' | 'p3';

  /** Ownership */
  currentOwnerName: string | null;
  nextOwnerName: string | null;
  /** 외부 대기 중 follow-up 담당 */
  followUpOwnerName: string | null;

  /** Next action */
  nextActionSummary: string;
  nextRoute: string | null;
}

// ===========================================================================
// 2. Shared Due/SLA Resolution
// ===========================================================================

export function resolveDueSemantic(
  dueAt: string | undefined | null,
  isWaitingExternal: boolean,
): { semantic: DueSemantic; label: string; isOverdue: boolean } {
  if (!dueAt) return { semantic: 'on_track', label: '기한 없음', isOverdue: false };

  const now = Date.now();
  const due = new Date(dueAt).getTime();
  const diffMs = due - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    const absDays = Math.abs(Math.floor(diffDays));
    if (absDays >= 3 && !isWaitingExternal) {
      return { semantic: 'escalation_required', label: `${absDays}일 초과 (에스컬레이션)`, isOverdue: true };
    }
    if (isWaitingExternal) {
      return { semantic: 'overdue_external', label: `${absDays}일 초과 (외부)`, isOverdue: true };
    }
    return { semantic: 'overdue_internal', label: `${absDays}일 초과`, isOverdue: true };
  }

  if (diffDays <= 3) {
    const remaining = Math.ceil(diffDays);
    return {
      semantic: 'due_soon',
      label: remaining === 0 ? '오늘 마감' : `${remaining}일 남음`,
      isOverdue: false,
    };
  }

  return { semantic: 'on_track', label: `${Math.ceil(diffDays)}일 남음`, isOverdue: false };
}

// ===========================================================================
// 3. Shared Priority Engine
// ===========================================================================

/**
 * 기본 priority 계산.
 * 모든 모듈이 같은 기본축을 공유한다.
 * module별 가중치는 operationalImpact 파라미터로 조절 가능.
 */
export function resolveSharedPriority(params: {
  readiness: OperationalReadiness;
  blockerClass: BlockerClass | null;
  dueSemantic: DueSemantic;
  isOverdue: boolean;
  /** 모듈별 운영 영향도 보정 (0~500) */
  operationalImpact?: number;
}): 'p0' | 'p1' | 'p2' | 'p3' {
  const { readiness, blockerClass, dueSemantic, isOverdue, operationalImpact = 0 } = params;

  let score = operationalImpact;

  // Ready + overdue = urgent
  if (readiness === 'ready' && isOverdue) score += 1000;
  // Blocked + overdue = escalation
  if (readiness === 'blocked' && isOverdue) score += 900;
  // Hard block = high
  if (blockerClass === 'hard_block') score += 400;
  // Escalation required
  if (dueSemantic === 'escalation_required') score += 500;
  // Ready to execute = actionable
  if (readiness === 'ready') score += 300;
  // Review gate
  if (readiness === 'needs_review') score += 200;
  // Due soon
  if (dueSemantic === 'due_soon') score += 150;
  // Waiting external overdue
  if (dueSemantic === 'overdue_external') score += 250;

  if (score >= 800) return 'p0';
  if (score >= 400) return 'p1';
  if (score >= 150) return 'p2';
  return 'p3';
}

// ===========================================================================
// 4. Domain-Specific Resolvers
// ===========================================================================

// ── 4A. Quote ───────────────────────────────────────────────────────

export function resolveQuoteOperationalState(
  qr: QuoteRequestContract,
  responses: QuoteResponseContract[],
  comparison: QuoteComparisonContract | undefined,
): EntityOperationalState {
  const qrResponses = responses.filter((r) => r.quoteRequestId === qr.id);
  const respondedCount = qrResponses.filter(
    (r) => r.responseStatus === 'responded' || r.responseStatus === 'incomplete',
  ).length;
  const totalVendors = qr.vendorIds.length;
  const hasSubstitute = qrResponses.some((r) =>
    r.responseItems.some((ri) => ri.substituteOffered),
  );
  const hasReviewItems = comparison?.comparableItemRows.some((r) => r.requiresReview) ?? false;
  const isVendorSelected = qr.status === 'vendor_selected';
  const isConverted = qr.status === 'converted_to_po';
  const isCancelled = qr.status === 'cancelled' || qr.status === 'expired';

  // Terminal
  if (isCancelled) {
    return makeTerminal('quote', qr.id, qr.status, qr.status === 'cancelled' ? '취소' : '만료');
  }
  if (isConverted) {
    return makeTerminal('quote', qr.id, 'converted_to_po', 'PO 전환 완료');
  }

  // Handoff ready: vendor selected but not yet converted
  if (isVendorSelected) {
    const due = resolveDueSemantic(qr.dueAt, false);
    return {
      entityType: 'quote',
      entityId: qr.id,
      readiness: 'handoff_ready',
      domainPhase: 'vendor_selected',
      domainPhaseLabel: '공급사 선정 완료',
      blockerClass: null,
      blockerReasons: [],
      reviewReasons: [],
      waitingExternalSummary: null,
      handoff: {
        ready: true,
        targetModule: 'po',
        targetRoute: `/dashboard/purchase-orders`,
        targetOwner: '구매 담당자',
        downstreamEntityId: null,
      },
      dueSemantic: due.semantic,
      dueLabel: due.label,
      isOverdue: due.isOverdue,
      priorityClass: resolveSharedPriority({
        readiness: 'handoff_ready',
        blockerClass: null,
        dueSemantic: due.semantic,
        isOverdue: due.isOverdue,
        operationalImpact: 200,
      }),
      currentOwnerName: null,
      nextOwnerName: '구매 담당자',
      followUpOwnerName: null,
      nextActionSummary: 'PO 생성',
      nextRoute: `/dashboard/quotes/${qr.id}`,
    };
  }

  // Needs review: comparison ready + review items or substitutes
  const reviewReasons: string[] = [];
  if (hasReviewItems) reviewReasons.push('검토 필요 항목');
  if (hasSubstitute) reviewReasons.push('대체품 검토');

  if (
    (qr.status === 'comparison_ready' || qr.status === 'responded') &&
    comparison &&
    reviewReasons.length > 0
  ) {
    const due = resolveDueSemantic(qr.dueAt, false);
    return {
      entityType: 'quote',
      entityId: qr.id,
      readiness: 'needs_review',
      domainPhase: 'comparison_review',
      domainPhaseLabel: '비교 검토 필요',
      blockerClass: 'review_gate',
      blockerReasons: [],
      reviewReasons,
      waitingExternalSummary: null,
      handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
      dueSemantic: due.semantic,
      dueLabel: due.label,
      isOverdue: due.isOverdue,
      priorityClass: resolveSharedPriority({
        readiness: 'needs_review',
        blockerClass: 'review_gate',
        dueSemantic: due.semantic,
        isOverdue: due.isOverdue,
      }),
      currentOwnerName: null,
      nextOwnerName: null,
      followUpOwnerName: null,
      nextActionSummary: '비교표 검토 후 공급사 선정',
      nextRoute: `/dashboard/quotes/${qr.id}`,
    };
  }

  // Ready: comparison ready, no review blockers
  if (
    (qr.status === 'comparison_ready' || qr.status === 'responded') &&
    comparison &&
    reviewReasons.length === 0
  ) {
    const due = resolveDueSemantic(qr.dueAt, false);
    return {
      entityType: 'quote',
      entityId: qr.id,
      readiness: 'ready',
      domainPhase: 'ready_to_select',
      domainPhaseLabel: '선정 가능',
      blockerClass: null,
      blockerReasons: [],
      reviewReasons: [],
      waitingExternalSummary: null,
      handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
      dueSemantic: due.semantic,
      dueLabel: due.label,
      isOverdue: due.isOverdue,
      priorityClass: resolveSharedPriority({
        readiness: 'ready',
        blockerClass: null,
        dueSemantic: due.semantic,
        isOverdue: due.isOverdue,
        operationalImpact: 100,
      }),
      currentOwnerName: null,
      nextOwnerName: null,
      followUpOwnerName: null,
      nextActionSummary: '공급사 선정',
      nextRoute: `/dashboard/quotes/${qr.id}`,
    };
  }

  // Waiting external: partially responded or sent
  if (qr.status === 'partially_responded' || qr.status === 'sent') {
    const due = resolveDueSemantic(qr.dueAt, true);
    return {
      entityType: 'quote',
      entityId: qr.id,
      readiness: 'waiting_external',
      domainPhase: qr.status,
      domainPhaseLabel: `공급사 응답 대기 (${respondedCount}/${totalVendors})`,
      blockerClass: null,
      blockerReasons: [],
      reviewReasons: [],
      waitingExternalSummary: `${totalVendors - respondedCount}곳 미응답`,
      handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
      dueSemantic: due.semantic,
      dueLabel: due.label,
      isOverdue: due.isOverdue,
      priorityClass: resolveSharedPriority({
        readiness: 'waiting_external',
        blockerClass: null,
        dueSemantic: due.semantic,
        isOverdue: due.isOverdue,
      }),
      currentOwnerName: null,
      nextOwnerName: null,
      followUpOwnerName: null,
      nextActionSummary: '미응답 공급사 독촉 또는 마감',
      nextRoute: `/dashboard/quotes/${qr.id}`,
    };
  }

  // Fallback: draft / other
  const due = resolveDueSemantic(qr.dueAt, false);
  return {
    entityType: 'quote',
    entityId: qr.id,
    readiness: 'needs_review',
    domainPhase: qr.status,
    domainPhaseLabel: qr.status === 'draft' ? '초안' : qr.status,
    blockerClass: null,
    blockerReasons: [],
    reviewReasons: [],
    waitingExternalSummary: null,
    handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
    dueSemantic: due.semantic,
    dueLabel: due.label,
    isOverdue: due.isOverdue,
    priorityClass: 'p3',
    currentOwnerName: null,
    nextOwnerName: null,
    followUpOwnerName: null,
    nextActionSummary: '견적 검토',
    nextRoute: `/dashboard/quotes/${qr.id}`,
  };
}

// ── 4B. Purchase Order ──────────────────────────────────────────────

export function resolvePOOperationalState(
  po: PurchaseOrderContract,
  approval: ApprovalExecutionContract | undefined,
  ack: PurchaseOrderAcknowledgementContract | undefined,
): EntityOperationalState {
  const isWaitingExternal = po.status === 'issued' && (!ack || ack.status === 'sent' || ack.status === 'not_sent');
  const due = resolveDueSemantic(po.requiredByAt, isWaitingExternal);

  // Terminal
  if (po.status === 'cancelled') return makeTerminal('po', po.id, 'cancelled', '취소');
  if (po.status === 'closed') return makeTerminal('po', po.id, 'closed', '마감');

  // Handoff ready: acknowledged + delivery context
  if (po.status === 'issued' && ack && (ack.status === 'acknowledged' || ack.status === 'confirmed' || ack.status === 'partially_confirmed')) {
    const hasLineIssues = ack.lineAcknowledgements?.some(
      (la) => la.ackLineStatus === 'backorder' || la.ackLineStatus === 'substitute_offered' || la.ackLineStatus === 'issue_flagged',
    ) ?? false;

    if (hasLineIssues) {
      return {
        entityType: 'po', entityId: po.id,
        readiness: 'needs_review',
        domainPhase: 'ack_needs_review',
        domainPhaseLabel: '확인 검토 필요',
        blockerClass: 'review_gate',
        blockerReasons: [],
        reviewReasons: ['공급사 라인 이슈 검토'],
        waitingExternalSummary: null,
        handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
        ...due, dueSemantic: due.semantic, dueLabel: due.label, isOverdue: due.isOverdue,
        priorityClass: resolveSharedPriority({ readiness: 'needs_review', blockerClass: 'review_gate', dueSemantic: due.semantic, isOverdue: due.isOverdue }),
        currentOwnerName: po.ownerId ?? null,
        nextOwnerName: null, followUpOwnerName: null,
        nextActionSummary: '공급사 확인 라인 검토',
        nextRoute: `/dashboard/purchase-orders/${po.id}`,
      };
    }

    return {
      entityType: 'po', entityId: po.id,
      readiness: 'handoff_ready',
      domainPhase: 'receiving_handoff',
      domainPhaseLabel: '입고 인계 준비',
      blockerClass: null, blockerReasons: [], reviewReasons: [],
      waitingExternalSummary: null,
      handoff: {
        ready: true,
        targetModule: 'receiving',
        targetRoute: '/dashboard/receiving',
        targetOwner: '입고 담당자',
        downstreamEntityId: null,
      },
      ...due, dueSemantic: due.semantic, dueLabel: due.label, isOverdue: due.isOverdue,
      priorityClass: resolveSharedPriority({ readiness: 'handoff_ready', blockerClass: null, dueSemantic: due.semantic, isOverdue: due.isOverdue, operationalImpact: 150 }),
      currentOwnerName: po.ownerId ?? null,
      nextOwnerName: '입고 담당자', followUpOwnerName: null,
      nextActionSummary: '입고 인계',
      nextRoute: `/dashboard/purchase-orders/${po.id}`,
    };
  }

  // Waiting external: issued + ack pending
  if (isWaitingExternal) {
    return {
      entityType: 'po', entityId: po.id,
      readiness: 'waiting_external',
      domainPhase: 'ack_pending',
      domainPhaseLabel: '공급사 확인 대기',
      blockerClass: null, blockerReasons: [], reviewReasons: [],
      waitingExternalSummary: '공급사 확인 미응답',
      handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
      dueSemantic: due.semantic, dueLabel: due.label, isOverdue: due.isOverdue,
      priorityClass: resolveSharedPriority({ readiness: 'waiting_external', blockerClass: null, dueSemantic: due.semantic, isOverdue: due.isOverdue }),
      currentOwnerName: po.ownerId ?? null,
      nextOwnerName: null, followUpOwnerName: po.ownerId ?? null,
      nextActionSummary: '공급사 확인 독촉',
      nextRoute: `/dashboard/purchase-orders/${po.id}`,
    };
  }

  // Ready: approved, ready to issue
  if (po.status === 'approved' || po.status === 'ready_to_issue') {
    return {
      entityType: 'po', entityId: po.id,
      readiness: 'ready',
      domainPhase: 'ready_to_issue',
      domainPhaseLabel: '발행 가능',
      blockerClass: null, blockerReasons: [], reviewReasons: [],
      waitingExternalSummary: null,
      handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
      dueSemantic: due.semantic, dueLabel: due.label, isOverdue: due.isOverdue,
      priorityClass: resolveSharedPriority({ readiness: 'ready', blockerClass: null, dueSemantic: due.semantic, isOverdue: due.isOverdue, operationalImpact: 200 }),
      currentOwnerName: po.ownerId ?? null,
      nextOwnerName: null, followUpOwnerName: null,
      nextActionSummary: '발주서 발행',
      nextRoute: `/dashboard/purchase-orders/${po.id}`,
    };
  }

  // Blocked: approval pending
  if (po.status === 'pending_approval' || po.status === 'approval_in_progress') {
    const currentStep = approval?.steps.find((s) => s.status === 'active');
    return {
      entityType: 'po', entityId: po.id,
      readiness: 'blocked',
      domainPhase: po.status,
      domainPhaseLabel: '승인 대기',
      blockerClass: 'hard_block',
      blockerReasons: ['승인 미완료'],
      reviewReasons: currentStep ? [`${currentStep.stepType} 검토 중`] : [],
      waitingExternalSummary: null,
      handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
      dueSemantic: due.semantic, dueLabel: due.label, isOverdue: due.isOverdue,
      priorityClass: resolveSharedPriority({ readiness: 'blocked', blockerClass: 'hard_block', dueSemantic: due.semantic, isOverdue: due.isOverdue }),
      currentOwnerName: po.ownerId ?? null,
      nextOwnerName: currentStep ? `${currentStep.stepType} 승인자` : null,
      followUpOwnerName: null,
      nextActionSummary: '승인 진행 확인',
      nextRoute: `/dashboard/purchase-orders/${po.id}`,
    };
  }

  // Fallback: draft
  return {
    entityType: 'po', entityId: po.id,
    readiness: 'needs_review',
    domainPhase: po.status,
    domainPhaseLabel: po.status === 'draft' ? '초안' : po.status,
    blockerClass: null, blockerReasons: [], reviewReasons: [],
    waitingExternalSummary: null,
    handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
    dueSemantic: due.semantic, dueLabel: due.label, isOverdue: due.isOverdue,
    priorityClass: 'p3',
    currentOwnerName: po.ownerId ?? null,
    nextOwnerName: null, followUpOwnerName: null,
    nextActionSummary: '발주 검토',
    nextRoute: `/dashboard/purchase-orders/${po.id}`,
  };
}

// ── 4C. Receiving ───────────────────────────────────────────────────

export function resolveReceivingOperationalState(
  rb: ReceivingBatchContract,
): EntityOperationalState {
  // Shared domain truth selectors
  const { hasDocMissing, hasQuarantine, hasInspectionPending, canPost, isPosted } =
    extractReceivingTruth(rb);

  const isWaitingExternal = hasDocMissing; // docs missing = external resend
  const due = resolveDueSemantic(undefined, isWaitingExternal);

  // Terminal
  if (rb.status === 'cancelled') return makeTerminal('receiving', rb.id, 'cancelled', '취소');
  if (rb.status === 'closed') return makeTerminal('receiving', rb.id, 'closed', '마감');

  // Handoff ready: posted → stock risk
  if (isPosted) {
    const hasRemainingQuarantine = rb.lineReceipts.some((l) =>
      l.lotRecords.some((lot) => lot.quarantineStatus === 'quarantined' || lot.quarantineStatus === 'blocked'),
    );
    return {
      entityType: 'receiving', entityId: rb.id,
      readiness: 'handoff_ready',
      domainPhase: 'posted',
      domainPhaseLabel: '반영 완료',
      blockerClass: null, blockerReasons: [],
      reviewReasons: hasRemainingQuarantine ? ['격리 잔여 확인'] : [],
      waitingExternalSummary: null,
      handoff: {
        ready: true,
        targetModule: 'stock_risk',
        targetRoute: '/dashboard/stock-risk',
        targetOwner: '재고 관리자',
        downstreamEntityId: null,
      },
      dueSemantic: 'on_track', dueLabel: '완료', isOverdue: false,
      priorityClass: 'p3',
      currentOwnerName: rb.receivedBy ?? null,
      nextOwnerName: '재고 관리자', followUpOwnerName: null,
      nextActionSummary: '재고 위험 확인',
      nextRoute: `/dashboard/receiving/${rb.id}`,
    };
  }

  // Blocked: docs missing or quarantine
  const blockerReasons: string[] = [];
  if (hasDocMissing) blockerReasons.push('문서 미첨부');
  if (hasQuarantine) blockerReasons.push('격리 품목 미해결');

  if (blockerReasons.length > 0 && !canPost) {
    return {
      entityType: 'receiving', entityId: rb.id,
      readiness: hasDocMissing ? 'waiting_external' : 'blocked',
      domainPhase: hasDocMissing ? 'docs_missing' : 'quarantine_active',
      domainPhaseLabel: hasDocMissing ? '문서 누락' : '격리 활성',
      blockerClass: hasDocMissing ? 'external_wait' : 'hard_block',
      blockerReasons,
      reviewReasons: [],
      waitingExternalSummary: hasDocMissing ? '공급사 문서 재요청 대기' : null,
      handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
      dueSemantic: due.semantic, dueLabel: due.label, isOverdue: due.isOverdue,
      priorityClass: resolveSharedPriority({
        readiness: hasDocMissing ? 'waiting_external' : 'blocked',
        blockerClass: hasDocMissing ? 'external_wait' : 'hard_block',
        dueSemantic: due.semantic, isOverdue: due.isOverdue,
        operationalImpact: hasQuarantine ? 200 : 100,
      }),
      currentOwnerName: rb.receivedBy ?? null,
      nextOwnerName: hasQuarantine ? 'QC 담당자' : null,
      followUpOwnerName: hasDocMissing ? rb.receivedBy ?? null : null,
      nextActionSummary: hasDocMissing ? '문서 확보' : '격리 검사',
      nextRoute: `/dashboard/receiving/${rb.id}`,
    };
  }

  // Needs review: inspection pending
  if (hasInspectionPending) {
    const pendingCount = rb.lineReceipts.filter(
      (l) => l.inspectionRequired && (l.inspectionStatus === 'pending' || l.inspectionStatus === 'in_progress'),
    ).length;
    return {
      entityType: 'receiving', entityId: rb.id,
      readiness: 'needs_review',
      domainPhase: 'inspection_in_progress',
      domainPhaseLabel: '검수 진행',
      blockerClass: 'review_gate',
      blockerReasons: [`검수 대기 ${pendingCount}건`],
      reviewReasons: [`검수 완료 대기 ${pendingCount}건`],
      waitingExternalSummary: null,
      handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
      dueSemantic: due.semantic, dueLabel: due.label, isOverdue: due.isOverdue,
      priorityClass: resolveSharedPriority({ readiness: 'needs_review', blockerClass: 'review_gate', dueSemantic: due.semantic, isOverdue: due.isOverdue }),
      currentOwnerName: rb.receivedBy ?? null,
      nextOwnerName: '검수 담당자', followUpOwnerName: null,
      nextActionSummary: '검수 완료',
      nextRoute: `/dashboard/receiving/${rb.id}`,
    };
  }

  // Ready: can post
  if (canPost) {
    return {
      entityType: 'receiving', entityId: rb.id,
      readiness: 'ready',
      domainPhase: 'ready_to_post',
      domainPhaseLabel: '반영 준비',
      blockerClass: null, blockerReasons: [], reviewReasons: [],
      waitingExternalSummary: null,
      handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
      dueSemantic: due.semantic, dueLabel: due.label, isOverdue: due.isOverdue,
      priorityClass: resolveSharedPriority({ readiness: 'ready', blockerClass: null, dueSemantic: due.semantic, isOverdue: due.isOverdue, operationalImpact: 100 }),
      currentOwnerName: rb.receivedBy ?? null,
      nextOwnerName: null, followUpOwnerName: null,
      nextActionSummary: '재고 반영',
      nextRoute: `/dashboard/receiving/${rb.id}`,
    };
  }

  // Fallback: arrived/expected
  return {
    entityType: 'receiving', entityId: rb.id,
    readiness: 'needs_review',
    domainPhase: rb.status,
    domainPhaseLabel: rb.status === 'expected' ? '입고 예정' : '도착',
    blockerClass: null, blockerReasons: [], reviewReasons: [],
    waitingExternalSummary: null,
    handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
    dueSemantic: 'on_track', dueLabel: '기한 없음', isOverdue: false,
    priorityClass: 'p3',
    currentOwnerName: rb.receivedBy ?? null,
    nextOwnerName: null, followUpOwnerName: null,
    nextActionSummary: '수령 확인',
    nextRoute: `/dashboard/receiving/${rb.id}`,
  };
}

// ── 4D. Stock Risk ──────────────────────────────────────────────────

export function resolveStockRiskOperationalState(
  recommendation: ReorderRecommendationContract,
  position: InventoryStockPositionContract | undefined,
): EntityOperationalState {
  const isCritical = position?.riskStatus === 'critical_shortage' || recommendation.urgency === 'urgent';
  const isBlocked = recommendation.status === 'blocked';
  const isConverted = recommendation.status === 'converted_to_quote' || recommendation.status === 'converted_to_po';
  const isDismissed = recommendation.status === 'dismissed';

  const due = resolveDueSemantic(undefined, false);

  // Terminal
  if (isDismissed) return makeTerminal('stock_risk', recommendation.id, 'dismissed', '기각');
  if (isConverted) {
    return {
      entityType: 'stock_risk', entityId: recommendation.id,
      readiness: 'handoff_ready',
      domainPhase: recommendation.status,
      domainPhaseLabel: recommendation.status === 'converted_to_quote' ? '견적 전환' : 'PO 전환',
      blockerClass: null, blockerReasons: [], reviewReasons: [],
      waitingExternalSummary: null,
      handoff: {
        ready: true,
        targetModule: recommendation.status === 'converted_to_quote' ? 'quote' : 'po',
        targetRoute: recommendation.status === 'converted_to_quote' ? '/dashboard/quotes' : '/dashboard/purchase-orders',
        targetOwner: '구매 담당자',
        downstreamEntityId: recommendation.linkedQuoteRequestId ?? null,
      },
      dueSemantic: 'on_track', dueLabel: '전환 완료', isOverdue: false,
      priorityClass: 'p3',
      currentOwnerName: null, nextOwnerName: '구매 담당자', followUpOwnerName: null,
      nextActionSummary: '소싱 흐름 확인',
      nextRoute: '/dashboard/stock-risk',
    };
  }

  // Blocked
  if (isBlocked) {
    const blockerReasons = [...recommendation.blockedReasons];
    const hasBudget = blockerReasons.some((r) => r.includes('예산') || r.includes('budget'));
    const hasDuplicate = blockerReasons.some((r) => r.includes('중복') || r.includes('duplicate'));

    return {
      entityType: 'stock_risk', entityId: recommendation.id,
      readiness: 'blocked',
      domainPhase: 'blocked',
      domainPhaseLabel: '재주문 차단',
      blockerClass: 'hard_block',
      blockerReasons,
      reviewReasons: hasBudget ? ['예산 검토 필요'] : [],
      waitingExternalSummary: null,
      handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
      dueSemantic: isCritical ? 'escalation_required' : due.semantic,
      dueLabel: isCritical ? '긴급 처리' : due.label,
      isOverdue: isCritical,
      priorityClass: resolveSharedPriority({
        readiness: 'blocked', blockerClass: 'hard_block',
        dueSemantic: isCritical ? 'escalation_required' : due.semantic,
        isOverdue: isCritical,
        operationalImpact: isCritical ? 300 : 0,
      }),
      currentOwnerName: null,
      nextOwnerName: hasBudget ? '예산 관리자' : hasDuplicate ? '구매 담당자' : null,
      followUpOwnerName: null,
      nextActionSummary: '차단 사유 해소',
      nextRoute: '/dashboard/stock-risk',
    };
  }

  // Ready: open recommendation, not blocked
  if (recommendation.status === 'open' || recommendation.status === 'review_required') {
    const isReview = recommendation.status === 'review_required';
    return {
      entityType: 'stock_risk', entityId: recommendation.id,
      readiness: isReview ? 'needs_review' : 'ready',
      domainPhase: recommendation.status,
      domainPhaseLabel: isReview ? '재주문 검토' : '재주문 가능',
      blockerClass: isReview ? 'review_gate' : null,
      blockerReasons: [],
      reviewReasons: isReview ? ['재주문 조건 검토'] : [],
      waitingExternalSummary: null,
      handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
      dueSemantic: isCritical ? 'overdue_internal' : due.semantic,
      dueLabel: isCritical ? '긴급' : due.label,
      isOverdue: isCritical,
      priorityClass: resolveSharedPriority({
        readiness: isReview ? 'needs_review' : 'ready',
        blockerClass: isReview ? 'review_gate' : null,
        dueSemantic: isCritical ? 'overdue_internal' : due.semantic,
        isOverdue: isCritical,
        operationalImpact: isCritical ? 200 : 0,
      }),
      currentOwnerName: null, nextOwnerName: null, followUpOwnerName: null,
      nextActionSummary: isReview ? '재주문 검토 후 실행' : '견적 요청 또는 직접 발주',
      nextRoute: '/dashboard/stock-risk',
    };
  }

  // Fallback
  return {
    entityType: 'stock_risk', entityId: recommendation.id,
    readiness: 'needs_review',
    domainPhase: recommendation.status,
    domainPhaseLabel: recommendation.status,
    blockerClass: null, blockerReasons: [], reviewReasons: [],
    waitingExternalSummary: null,
    handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
    dueSemantic: due.semantic, dueLabel: due.label, isOverdue: due.isOverdue,
    priorityClass: 'p3',
    currentOwnerName: null, nextOwnerName: null, followUpOwnerName: null,
    nextActionSummary: '확인',
    nextRoute: '/dashboard/stock-risk',
  };
}

export function resolveExpiryOperationalState(
  ea: ExpiryActionContract,
): EntityOperationalState {
  const due = resolveDueSemantic(ea.dueAt, false);
  const isTerminalStatus = ea.status === 'completed' || ea.status === 'dismissed';

  if (isTerminalStatus) {
    return makeTerminal('stock_risk', ea.id, ea.status, ea.status === 'completed' ? '완료' : '기각');
  }

  const isOverdueAction = ea.status === 'overdue' || due.isOverdue;
  return {
    entityType: 'stock_risk', entityId: ea.id,
    readiness: isOverdueAction ? 'ready' : 'needs_review',
    domainPhase: ea.status,
    domainPhaseLabel: isOverdueAction ? '만료 조치 기한 초과' : '만료 조치 필요',
    blockerClass: null, blockerReasons: [], reviewReasons: isOverdueAction ? [] : ['유효기한 조치 검토'],
    waitingExternalSummary: null,
    handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
    dueSemantic: due.semantic, dueLabel: due.label, isOverdue: due.isOverdue,
    priorityClass: resolveSharedPriority({
      readiness: isOverdueAction ? 'ready' : 'needs_review',
      blockerClass: null, dueSemantic: due.semantic, isOverdue: due.isOverdue,
    }),
    currentOwnerName: ea.ownerId ?? null, nextOwnerName: null, followUpOwnerName: null,
    nextActionSummary: ea.actionType === 'replace_order' ? '교체 발주' : ea.actionType === 'dispose' ? '폐기 절차' : '상태 확인',
    nextRoute: '/dashboard/stock-risk',
  };
}

// ===========================================================================
// 5. Shared Receiving Truth Selectors (reusable)
// ===========================================================================

export interface ReceivingTruth {
  hasDocMissing: boolean;
  hasQuarantine: boolean;
  hasInspectionPending: boolean;
  canPost: boolean;
  isPosted: boolean;
}

export function extractReceivingTruth(rb: ReceivingBatchContract): ReceivingTruth {
  const hasDocMissing = rb.lineReceipts.some(
    (l) => l.documentStatus === 'partial' || l.documentStatus === 'missing',
  );
  const hasQuarantine = rb.lineReceipts.some((l) =>
    l.lotRecords.some((lot) => lot.quarantineStatus === 'quarantined' || lot.quarantineStatus === 'blocked'),
  );
  const hasInspectionPending = rb.lineReceipts.some(
    (l) => l.inspectionRequired && (l.inspectionStatus === 'pending' || l.inspectionStatus === 'in_progress'),
  );
  const isPosted = rb.status === 'posted' || rb.status === 'closed';
  const canPost = !hasDocMissing && !hasQuarantine && !hasInspectionPending && !isPosted;

  return { hasDocMissing, hasQuarantine, hasInspectionPending, canPost, isPosted };
}

// ===========================================================================
// 6. Terminal State Helper
// ===========================================================================

function makeTerminal(
  entityType: EntityOperationalState['entityType'],
  entityId: string,
  domainPhase: string,
  label: string,
): EntityOperationalState {
  return {
    entityType, entityId,
    readiness: 'terminal',
    domainPhase,
    domainPhaseLabel: label,
    blockerClass: null, blockerReasons: [], reviewReasons: [],
    waitingExternalSummary: null,
    handoff: { ready: false, targetModule: null, targetRoute: null, targetOwner: null, downstreamEntityId: null },
    dueSemantic: 'on_track', dueLabel: '—', isOverdue: false,
    priorityClass: 'p3',
    currentOwnerName: null, nextOwnerName: null, followUpOwnerName: null,
    nextActionSummary: '—',
    nextRoute: null,
  };
}

// ===========================================================================
// 7. Readiness Label Map (screen adapters 공용)
// ===========================================================================

export const READINESS_LABELS: Record<OperationalReadiness, string> = {
  ready: '실행 가능',
  blocked: '차단',
  needs_review: '검토 필요',
  waiting_external: '외부 대기',
  handoff_ready: '인계 준비',
  terminal: '완료',
};

export const READINESS_TONES: Record<OperationalReadiness, string> = {
  ready: 'text-emerald-400',
  blocked: 'text-red-400',
  needs_review: 'text-amber-400',
  waiting_external: 'text-blue-400',
  handoff_ready: 'text-teal-400',
  terminal: 'text-slate-500',
};

export const BLOCKER_CLASS_LABELS: Record<BlockerClass, string> = {
  hard_block: '차단',
  review_gate: '검토 필요',
  external_wait: '외부 대기',
  soft_warning: '주의',
};
