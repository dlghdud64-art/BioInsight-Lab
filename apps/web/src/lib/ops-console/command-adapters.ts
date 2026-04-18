/**
 * ops-console/command-adapters.ts
 *
 * 도메인별 CommandSurface 생성 어댑터.
 * entity 상태 → readiness → available commands → blocked reasons → handoff 를
 * 일관된 구조로 계산합니다.
 *
 * @module ops-console/command-adapters
 */

import type { QuoteRequestContract, QuoteResponseContract, QuoteComparisonContract } from '../review-queue/quote-rfq-contract';
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

import type { CommandSurface, InboxQuickAction } from './action-model';
import {
  createExecuteCommand,
  createReviewCommand,
  createHandoffCommand,
  createBlockerCommand,
} from './action-model';
import type { ReentryContext } from './reentry-context';
import { buildReentryCommand, buildReentryDecisionSummary } from './reentry-context';

// ---------------------------------------------------------------------------
// 1. Quote Command Surface
// ---------------------------------------------------------------------------

export interface QuoteCommandContext {
  quoteRequest: QuoteRequestContract;
  responses: QuoteResponseContract[];
  comparison: QuoteComparisonContract | null;
  vendorMap: Record<string, string>;
  onSelectVendor: (vendorId: string) => void;
  onConvertToPO: () => void;
}

export function buildQuoteCommandSurface(ctx: QuoteCommandContext): CommandSurface {
  const { quoteRequest: qr, responses, comparison, vendorMap, onSelectVendor, onConvertToPO } = ctx;

  const isVendorSelected = qr.status === 'vendor_selected' || qr.status === 'converted_to_po';
  const isConverted = qr.status === 'converted_to_po';
  const hasSubstitute = responses.some((r) => r.responseItems.some((ri) => ri.substituteOffered));
  const conversionBlockers = (comparison as any)?.conversionBlockers ?? [];
  const respondedCount = responses.filter((r) => r.responseStatus === 'responded' || r.responseStatus === 'incomplete').length;

  const blockedReasons: string[] = [];
  const reviewReasons: string[] = [];

  if (!isVendorSelected && !isConverted) {
    blockedReasons.push('공급사 미선정 — 비교 검토 후 선정 필요');
  }
  if (conversionBlockers.length > 0) {
    blockedReasons.push(...conversionBlockers);
  }
  if (hasSubstitute) {
    reviewReasons.push('대체품 제안 포함 — 스펙 적합성 확인 필요');
  }
  if (comparison?.missingResponses?.length) {
    reviewReasons.push(`미응답 공급사 ${comparison.missingResponses.length}곳`);
  }

  // Primary: convert to PO
  const primaryCommand = createExecuteCommand(
    'quote-convert-to-po',
    isConverted ? '✓ 발주 전환 완료' : '발주 전환',
    onConvertToPO,
    {
      canExecute: isVendorSelected && !isConverted,
      blockedReasons: !isVendorSelected ? ['먼저 공급사를 선택하세요'] : isConverted ? ['이미 전환됨'] : [],
      confirmRequired: true,
      confirmMessage: '선정된 공급사로 발주를 생성합니다. 계속하시겠습니까?',
      nextRoute: '/dashboard/purchase-orders',
      nextOwner: '구매 담당자',
      postActionSummary: '발주 생성 → 승인 프로세스 진입',
    },
  );

  // Secondary: vendor select (추천 공급사)
  const secondaryCommands = [];
  if (!isVendorSelected && !isConverted && comparison?.recommendedVendorId) {
    secondaryCommands.push(
      createReviewCommand(
        'quote-select-recommended',
        `추천 공급사 선정 (${vendorMap[comparison.recommendedVendorId] ?? '추천'})`,
        () => onSelectVendor(comparison.recommendedVendorId!),
        reviewReasons,
        { priority: 'secondary' },
      ),
    );
  }

  // Triage: individual vendor selects
  const triageCommands = [];
  if (!isVendorSelected && !isConverted) {
    for (const r of responses) {
      if (r.responseStatus === 'responded' && r.vendorId !== comparison?.recommendedVendorId) {
        triageCommands.push(
          createReviewCommand(
            `quote-select-${r.vendorId}`,
            `${vendorMap[r.vendorId] ?? r.vendorId} 선정`,
            () => onSelectVendor(r.vendorId),
            [],
            { priority: 'triage' },
          ),
        );
      }
    }
  }

  // Context: handoff
  const contextCommands = [];
  if (isConverted) {
    contextCommands.push(
      createHandoffCommand(
        'quote-goto-po',
        '발주 관리 이동',
        '/dashboard/purchase-orders',
        () => {},
      ),
    );
  }

  return {
    readinessSummary: isConverted
      ? '발주 전환 완료'
      : isVendorSelected
        ? '발주 전환 가능'
        : comparison
          ? `${respondedCount}곳 응답 검토 필요`
          : '비교 데이터 생성 대기',
    isReady: isVendorSelected || isConverted,
    primaryCommand,
    secondaryCommands,
    triageCommands,
    contextCommands,
    aggregatedBlockers: blockedReasons,
    handoffTarget: isConverted
      ? { label: '발주 관리', href: '/dashboard/purchase-orders' }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// 2. PO Command Surface
// ---------------------------------------------------------------------------

export interface POCommandContext {
  po: PurchaseOrderContract;
  approval: ApprovalExecutionContract | undefined;
  ack: PurchaseOrderAcknowledgementContract | undefined;
  vendorName: string;
  onIssuePO: () => void;
  onAcknowledgePO: () => void;
  onGoToReceiving: () => void;
}

export function buildPOCommandSurface(ctx: POCommandContext): CommandSurface {
  const { po, approval, ack, onIssuePO, onAcknowledgePO, onGoToReceiving } = ctx;

  const isApproved = po.status === 'approved' || po.status === 'ready_to_issue';
  const isIssued = po.status === 'issued' || po.status === 'acknowledged';
  const isAcknowledged = po.status === 'acknowledged';
  const ackPending = po.status === 'issued' && (!ack || ack.status === 'sent' || ack.status === 'not_sent');

  const blockedReasons: string[] = [];
  if (!isApproved && !isIssued) {
    blockedReasons.push('승인 프로세스 미완료');
  }

  // Primary: issue PO (when approved) or post to receiving (when acknowledged)
  const primaryCommand = isAcknowledged
    ? createExecuteCommand(
        'po-go-receiving',
        '입고 시작',
        onGoToReceiving,
        {
          nextRoute: '/dashboard/receiving',
          nextOwner: '입고 담당자',
          postActionSummary: '입고 배치 확인 → 검수 → 재고 반영',
        },
      )
    : createExecuteCommand(
        'po-issue',
        '발주 발행',
        onIssuePO,
        {
          canExecute: isApproved,
          blockedReasons: !isApproved ? ['승인 완료 후 발행 가능'] : [],
          confirmRequired: true,
          confirmMessage: '공급사에게 발주서를 발행합니다. 계속하시겠습니까?',
          nextOwner: '공급사',
          postActionSummary: '발주서 발행 → 공급사 확인 대기',
        },
      );

  // Secondary: acknowledge PO
  const secondaryCommands = [];
  if (po.status === 'issued') {
    secondaryCommands.push(
      createExecuteCommand(
        'po-ack',
        '공급사 확인 수신',
        onAcknowledgePO,
        {
          canExecute: true,
          priority: 'secondary',
          postActionSummary: '공급사 확인 완료 → 입고 대기',
        },
      ),
    );
  }

  // Triage: follow-up when ack pending
  const triageCommands = [];
  if (ackPending) {
    triageCommands.push(
      createBlockerCommand(
        'po-ack-followup',
        '공급사 확인 독촉',
        () => {},
        ['공급사 발주 확인 미응답'],
        { canExecute: false, priority: 'triage' },
      ),
    );
  }

  // Context: navigation
  const contextCommands = [];
  if (po.quoteRequestId) {
    contextCommands.push(
      createHandoffCommand(
        'po-goto-quote',
        '견적 이동',
        `/dashboard/quotes/${po.quoteRequestId}`,
        () => {},
      ),
    );
  }
  if (isAcknowledged) {
    contextCommands.push(
      createHandoffCommand(
        'po-goto-receiving',
        '입고 관리 이동',
        '/dashboard/receiving',
        () => {},
      ),
    );
  }

  return {
    readinessSummary: isApproved
      ? '발행 가능'
      : isIssued
        ? ackPending ? '공급사 확인 대기 중' : '입고 핸드오프 가능'
        : '승인 완료 후 발행 가능',
    isReady: isApproved || isAcknowledged,
    primaryCommand,
    secondaryCommands,
    triageCommands,
    contextCommands,
    aggregatedBlockers: blockedReasons,
    handoffTarget: isAcknowledged
      ? { label: '입고 관리', href: '/dashboard/receiving' }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// 3. Receiving Command Surface
// ---------------------------------------------------------------------------

export interface ReceivingCommandContext {
  rb: ReceivingBatchContract;
  onCompleteInspection: (lineId: string) => void;
  onPostToInventory: () => void;
}

export function buildReceivingCommandSurface(ctx: ReceivingCommandContext): CommandSurface {
  const { rb, onCompleteInspection, onPostToInventory } = ctx;

  const hasDocMissing = rb.lineReceipts.some((l) => l.documentStatus === 'partial' || l.documentStatus === 'missing');
  const hasQuarantine = rb.lineReceipts.some((l) => l.lotRecords.some((lot) => lot.quarantineStatus === 'quarantined'));
  const hasInspectionPending = rb.lineReceipts.some(
    (l) => l.inspectionRequired && (l.inspectionStatus === 'pending' || l.inspectionStatus === 'in_progress'),
  );
  const isPosted = rb.status === 'posted' || rb.status === 'closed';
  const canPost = !hasDocMissing && !hasQuarantine && !hasInspectionPending && !isPosted;

  const blockedReasons: string[] = [];
  if (hasDocMissing) blockedReasons.push('문서 미첨부 라인 존재');
  if (hasQuarantine) blockedReasons.push('격리 품목 미해결');
  if (hasInspectionPending) blockedReasons.push('검수 미완료');

  // Primary: post to inventory
  const primaryCommand = createExecuteCommand(
    'rcv-post',
    isPosted ? '✓ 반영 완료' : '재고 반영',
    onPostToInventory,
    {
      canExecute: canPost && !isPosted,
      blockedReasons: isPosted ? ['이미 반영됨'] : !canPost ? blockedReasons : [],
      confirmRequired: true,
      confirmMessage: '수령 품목을 재고에 반영합니다. 계속하시겠습니까?',
      nextRoute: '/dashboard/stock-risk',
      nextOwner: '재고 관리자',
      postActionSummary: '재고 반영 → 재고 위험 재평가',
    },
  );

  // Secondary: inspection complete per line
  const secondaryCommands = rb.lineReceipts
    .filter((l) => l.inspectionRequired && l.inspectionStatus !== 'passed' && l.inspectionStatus !== 'failed')
    .map((l) =>
      createExecuteCommand(
        `rcv-inspect-${l.id}`,
        `라인 ${l.lineNumber} 검수 완료`,
        () => onCompleteInspection(l.id),
        { priority: 'secondary', postActionSummary: `라인 ${l.lineNumber} 검수 합격 처리` },
      ),
    );

  // Triage: blocker resolution
  const triageCommands = [];
  if (hasDocMissing) {
    triageCommands.push(
      createBlockerCommand(
        'rcv-resolve-docs',
        '문서 확보 요청',
        () => {},
        ['필수 문서 미첨부 — 검수 진행 불가'],
        { canExecute: false },
      ),
    );
  }
  if (hasQuarantine) {
    triageCommands.push(
      createBlockerCommand(
        'rcv-resolve-quarantine',
        '격리 검사 판정',
        () => {},
        ['온도 이탈/손상 품목 격리 중'],
        { canExecute: false },
      ),
    );
  }

  // Context: navigation
  const contextCommands = [];
  if (rb.poId) {
    contextCommands.push(
      createHandoffCommand(
        'rcv-goto-po',
        '발주 이동',
        `/dashboard/purchase-orders/${rb.poId}`,
        () => {},
      ),
    );
  }
  if (isPosted) {
    contextCommands.push(
      createHandoffCommand(
        'rcv-goto-stock',
        '재고 위험 관리 이동',
        '/dashboard/stock-risk',
        () => {},
      ),
    );
  }

  return {
    readinessSummary: isPosted
      ? '재고 반영 완료'
      : canPost
        ? '재고 반영 가능'
        : '차단 요인 해소 필요',
    isReady: canPost,
    primaryCommand,
    secondaryCommands,
    triageCommands,
    contextCommands,
    aggregatedBlockers: blockedReasons,
    handoffTarget: isPosted
      ? { label: '재고 위험 관리', href: '/dashboard/stock-risk' }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// 4. Stock Risk Command Surface
// ---------------------------------------------------------------------------

export interface StockRiskCommandContext {
  stockPositions: InventoryStockPositionContract[];
  reorderRecommendations: ReorderRecommendationContract[];
  expiryActions: ExpiryActionContract[];
  onCreateQuoteFromReorder: (id: string) => void;
  onCompleteExpiryAction: (id: string) => void;
  onResolveReorderBlocker: (id: string) => void;
}

export function buildStockRiskCommandSurface(ctx: StockRiskCommandContext): CommandSurface {
  const { reorderRecommendations, expiryActions, onCreateQuoteFromReorder, onCompleteExpiryAction, onResolveReorderBlocker } = ctx;

  const criticalReorders = reorderRecommendations.filter((r) => r.urgency === 'urgent' || r.urgency === 'high');
  const blockedReorders = reorderRecommendations.filter((r) => r.status === 'blocked');
  const pendingExpiry = expiryActions.filter((e) => e.status === 'open' || e.status === 'in_progress');
  const hasCritical = criticalReorders.length > 0;
  const hasBlocked = blockedReorders.length > 0;

  const blockedReasons: string[] = [];
  for (const br of blockedReorders) {
    blockedReasons.push(...br.blockedReasons);
  }

  // Primary: process critical reorder
  const primaryReorder = criticalReorders.find((r) => r.status !== 'blocked' && r.status !== 'converted_to_quote' && r.status !== 'converted_to_po');
  const primaryCommand = primaryReorder
    ? createExecuteCommand(
        'stock-reorder-critical',
        `긴급 재주문 견적 요청 (${primaryReorder.inventoryItemId})`,
        () => onCreateQuoteFromReorder(primaryReorder.id),
        {
          confirmRequired: true,
          confirmMessage: '긴급 재주문을 위한 견적 요청을 생성합니다.',
          nextRoute: '/dashboard/quotes',
          postActionSummary: '견적 요청 생성 → 공급사 응답 대기',
        },
      )
    : createExecuteCommand(
        'stock-no-critical',
        '긴급 재주문 없음',
        () => {},
        { canExecute: false, blockedReasons: ['현재 긴급 재주문 대상 없음'] },
      );

  // Secondary: pending reorders
  const secondaryCommands = reorderRecommendations
    .filter((r) => (r.status === 'open' || r.status === 'under_review') && (r.urgency === 'normal' || r.urgency === 'low'))
    .slice(0, 3)
    .map((r) =>
      createExecuteCommand(
        `stock-reorder-${r.id}`,
        `${r.inventoryItemId} 견적 요청`,
        () => onCreateQuoteFromReorder(r.id),
        { priority: 'secondary', postActionSummary: '견적 요청 생성' },
      ),
    );

  // Triage: blocked reorder resolvers + expiry actions
  const triageCommands = [];
  for (const br of blockedReorders) {
    triageCommands.push(
      createBlockerCommand(
        `stock-blocker-${br.id}`,
        `${br.inventoryItemId} 차단 해소`,
        () => onResolveReorderBlocker(br.id),
        br.blockedReasons,
        { canExecute: true },
      ),
    );
  }
  for (const ea of pendingExpiry.slice(0, 3)) {
    triageCommands.push(
      createExecuteCommand(
        `stock-expiry-${ea.id}`,
        `${ea.inventoryItemId} ${ea.actionType === 'dispose' ? '폐기' : ea.actionType === 'consume_first' ? '우선 사용' : '만료 조치'}`,
        () => onCompleteExpiryAction(ea.id),
        { priority: 'triage', postActionSummary: '만료 조치 완료' },
      ),
    );
  }

  // Context
  const contextCommands = [
    createHandoffCommand('stock-goto-quotes', '견적 관리 이동', '/dashboard/quotes', () => {}),
    createHandoffCommand('stock-goto-receiving', '입고 관리 이동', '/dashboard/receiving', () => {}),
  ];

  return {
    readinessSummary: hasBlocked
      ? `차단 ${blockedReorders.length}건 — 조치 필요`
      : hasCritical
        ? `긴급 재주문 ${criticalReorders.length}건 대기`
        : pendingExpiry.length > 0
          ? `만료 조치 ${pendingExpiry.length}건 대기`
          : '현재 긴급 위험 없음',
    isReady: !hasBlocked && !hasCritical,
    primaryCommand,
    secondaryCommands,
    triageCommands,
    contextCommands,
    aggregatedBlockers: [...new Set(blockedReasons)],
    handoffTarget: hasCritical
      ? { label: '견적 관리', href: '/dashboard/quotes' }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// 5. Inbox Quick Action Adapter
// ---------------------------------------------------------------------------

export function buildInboxQuickAction(
  item: { workType: string; entityId: string; entityRoute: string; blockedReason?: string },
  store: {
    issuePO: (id: string) => void;
    acknowledgePO: (id: string) => void;
    createQuoteFromReorder: (id: string) => void;
    completeExpiryAction: (id: string) => void;
  },
): InboxQuickAction | null {
  switch (item.workType) {
    case 'po_ready_to_issue':
      return {
        label: '발주서 발행',
        canExecute: true,
        requiresDetail: false,
        onExecute: () => store.issuePO(item.entityId),
      };
    case 'po_ack_pending':
      return {
        label: '확인 완료 처리',
        canExecute: true,
        requiresDetail: false,
        onExecute: () => store.acknowledgePO(item.entityId),
      };
    case 'reorder_due':
      return item.blockedReason
        ? {
            label: '차단 해소 필요',
            canExecute: false,
            requiresDetail: true,
            detailRoute: '/dashboard/stock-risk',
          }
        : {
            label: '견적 요청 생성',
            canExecute: true,
            requiresDetail: false,
            onExecute: () => store.createQuoteFromReorder(item.entityId),
          };
    case 'expiry_action_due':
      return {
        label: '조치 완료 처리',
        canExecute: true,
        requiresDetail: false,
        onExecute: () => store.completeExpiryAction(item.entityId),
      };
    case 'quote_review_required':
    case 'quote_response_pending':
      return {
        label: '상세 검토',
        canExecute: true,
        requiresDetail: true,
        detailRoute: item.entityRoute,
      };
    case 'receiving_issue':
    case 'quarantine_constrained':
    case 'posting_blocked':
      return {
        label: '상세 확인',
        canExecute: true,
        requiresDetail: true,
        detailRoute: item.entityRoute,
      };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// 6. Re-entry Command Injection
// ---------------------------------------------------------------------------

/**
 * 기존 CommandSurface에 re-entry context command를 주입한다.
 * detail page에서 re-entry 버튼을 command bar에 노출할 때 사용.
 */
export function injectReentryCommand(
  surface: CommandSurface,
  reentryCtx: ReentryContext | undefined,
): CommandSurface {
  if (!reentryCtx) return surface;

  const cmd = buildReentryCommand(reentryCtx);
  const decision = buildReentryDecisionSummary(reentryCtx);

  const reentryCommand = createHandoffCommand(
    `reentry-${reentryCtx.sourceType}`,
    cmd.label,
    cmd.href,
    () => {},
  );

  // Re-entry commands go into context commands (navigation tier)
  return {
    ...surface,
    contextCommands: [
      ...surface.contextCommands,
      reentryCommand,
    ],
  };
}
