/**
 * ops-console/reentry-context.ts
 *
 * 공통 re-entry context model 및 도메인별 re-entry 빌더.
 * 검색/비교/견적 생성 재진입 시 운영 문맥을 유지하기 위한 adapter layer.
 *
 * contract layer를 오염시키지 않고, 기존 계약의 필드를 조합하여
 * upstream operational context -> prefilled search intent ->
 * compare-ready candidate set -> quote draft creation ->
 * downstream workflow handoff 흐름을 일관되게 지원한다.
 *
 * @module ops-console/reentry-context
 */

import type { ReorderRecommendationContract, ExpiryActionContract, InventoryStockPositionContract } from '../review-queue/reorder-expiry-stock-risk-contract';
import type { ReceivingBatchContract } from '../review-queue/receiving-inbound-contract';
import type { QuoteRequestContract, QuoteResponseContract } from '../review-queue/quote-rfq-contract';
import type { PurchaseOrderContract, PurchaseOrderAcknowledgementContract } from '../review-queue/po-approval-contract';

// ---------------------------------------------------------------------------
// 1. Re-entry Source Type
// ---------------------------------------------------------------------------

export type ReentrySourceType =
  | 'stock_risk_reorder'
  | 'expiry_replacement'
  | 'receiving_exception'
  | 'quote_review_followup'
  | 'po_issue_context_recovery'
  | 'manual_procurement_search';

// ---------------------------------------------------------------------------
// 2. Re-entry Reason Code
// ---------------------------------------------------------------------------

export type ReentryReasonCode =
  // stock risk
  | 'critical_shortage'
  | 'reorder_due'
  | 'duplicate_resolved_retry'
  | 'preferred_vendor_unavailable'
  | 'budget_resolved_retry'
  // expiry
  | 'expiring_soon_replacement'
  | 'consume_first_impossible'
  | 'substitute_sourcing_needed'
  // receiving
  | 'damaged_receipt_replacement'
  | 'spec_mismatch_replacement'
  | 'document_mismatch_replacement'
  | 'partial_receipt_supplement'
  // quote followup
  | 'no_exact_match_retry'
  | 'substitute_review_retry'
  | 'missing_vendor_coverage'
  | 'additional_comparison_needed'
  // po recovery
  | 'vendor_unavailable_alternate'
  | 'ack_timeout_alternate'
  | 'vendor_failure_fallback'
  // manual
  | 'manual_catalog_search';

// ---------------------------------------------------------------------------
// 3. Re-entry Urgency
// ---------------------------------------------------------------------------

export type ReentryUrgency = 'critical' | 'high' | 'normal' | 'low';

// ---------------------------------------------------------------------------
// 4. Requested Item Hint
// ---------------------------------------------------------------------------

export interface RequestedItemHint {
  /** 품목명 */
  itemName?: string;
  /** 제조사 */
  manufacturer?: string;
  /** 카탈로그 번호 */
  catalogNumber?: string;
  /** CAS No. */
  casNumber?: string;
  /** 스펙 요구사항 (예: "ACS grade", "순도 ≥99%") */
  specRequirements?: string[];
  /** 수량 힌트 */
  quantity?: number;
  /** 단위 */
  unit?: string;
}

// ---------------------------------------------------------------------------
// 5. Re-entry Context (공통 모델)
// ---------------------------------------------------------------------------

export interface ReentryContext {
  /** 재진입 소스 유형 */
  sourceType: ReentrySourceType;
  /** 소스 엔티티 ID */
  sourceEntityId: string;
  /** 소스 화면 경로 */
  sourceRoute: string;
  /** 소스 요약 (한국어) */
  sourceSummary: string;
  /** 재진입 사유 코드 목록 */
  reasonCodes: ReentryReasonCode[];
  /** 검색할 품목 힌트 목록 */
  requestedItemHints: RequestedItemHint[];
  /** 선호 공급사 ID */
  preferredVendorId?: string;
  /** 제외 공급사 ID 목록 */
  blockedVendorIds?: string[];
  /** 필요 문서 목록 */
  requiredDocuments?: string[];
  /** 목표 납기 (영업일) */
  targetLeadTimeDays?: number;
  /** 목표 단가 */
  targetUnitPrice?: number;
  /** 대체품 허용 여부 */
  substituteAllowed: boolean;
  /** 긴급도 */
  urgency: ReentryUrgency;
  /** 예산 컨텍스트 ID */
  budgetContextId?: string;
  /** 연결 재고 품목 ID */
  linkedInventoryItemId?: string;
  /** 연결 프로젝트 ID */
  linkedProjectId?: string;
  /** 복귀 경로 */
  returnRoute?: string;
}

// ---------------------------------------------------------------------------
// 6. Re-entry Decision Summary
// ---------------------------------------------------------------------------

export type ReentryReadiness = 'ready' | 'needs_review' | 'blocked';
export type RecommendedEntryPath = 'search' | 'compare' | 'quote_draft';
export type QuoteCreateMode = 'quick_quote_create' | 'compare_first' | 'review_first';

export interface ReentryDecisionSummary {
  /** 재진입 준비 상태 */
  reentryReadiness: ReentryReadiness;
  /** 추천 진입 경로 */
  recommendedEntryPath: RecommendedEntryPath;
  /** 추천 견적 생성 모드 */
  quoteCreateMode: QuoteCreateMode;
  /** 사유 요약 (한국어) */
  reasonSummary: string;
  /** 차단 사유 목록 */
  blockedReasons: string[];
  /** compare-ready 후보 수 */
  preferredCandidateCount: number;
  /** review-required 후보 수 */
  reviewRequiredCount: number;
  /** 다음 담당자 */
  nextOwner?: string;
  /** 복귀 경로 */
  returnRoute?: string;
}

// ---------------------------------------------------------------------------
// 7. Compare-Ready Assessment
// ---------------------------------------------------------------------------

export interface CompareReadyAssessment {
  /** compare-ready 여부 */
  isCompareReady: boolean;
  /** exact/compatible match 여부 */
  hasExactOrCompatibleMatch: boolean;
  /** required docs 충족 가능성 */
  hasRequiredDocs: boolean;
  /** vendor not blocked */
  vendorNotBlocked: boolean;
  /** 수량/규격 해석 가능 */
  quantityInterpretable: boolean;
  /** lead time 또는 availability 힌트 존재 */
  hasAvailabilityHint: boolean;
  /** review-required 사유 */
  reviewReasons: string[];
}

// ---------------------------------------------------------------------------
// 8. Quote Bootstrap Summary
// ---------------------------------------------------------------------------

export interface QuoteBootstrapSummary {
  /** 소스 유형 */
  sourceType: ReentrySourceType;
  /** 소스 요약 */
  sourceSummary: string;
  /** 제안 품목 힌트 */
  itemHints: RequestedItemHint[];
  /** 공급사 shortlist IDs */
  vendorShortlistIds: string[];
  /** 제외 공급사 IDs */
  excludedVendorIds: string[];
  /** 필요 문서 */
  requiredDocuments: string[];
  /** 대체품 허용 */
  substituteAllowed: boolean;
  /** 긴급도 */
  urgency: ReentryUrgency;
  /** 예산 컨텍스트 */
  budgetContextId?: string;
  /** 목표 납기 */
  targetLeadTimeDays?: number;
  /** 운영 사유 노트 (한국어, 견적 draft summary에 반영) */
  operationalNote: string;
  /** 연결 재고 lineage */
  linkedInventoryItemId?: string;
  /** 연결 소스 경로 */
  linkedSourceRoute: string;
}

// ---------------------------------------------------------------------------
// 9. Stock Risk → Re-entry Builder
// ---------------------------------------------------------------------------

export function buildStockRiskReentryContext(
  recommendation: ReorderRecommendationContract,
  stockPosition: InventoryStockPositionContract | undefined,
): ReentryContext {
  const isCritical = recommendation.urgency === 'urgent' || recommendation.urgency === 'critical';
  const isBlocked = recommendation.status === 'blocked';
  const reasonCodes: ReentryReasonCode[] = [];

  if (isCritical) reasonCodes.push('critical_shortage');
  if (!isCritical) reasonCodes.push('reorder_due');
  if (isBlocked && recommendation.blockedReasons.some((r) => r.includes('중복'))) {
    reasonCodes.push('duplicate_resolved_retry');
  }
  if (!recommendation.preferredVendorId) {
    reasonCodes.push('preferred_vendor_unavailable');
  }

  return {
    sourceType: 'stock_risk_reorder',
    sourceEntityId: recommendation.id,
    sourceRoute: '/dashboard/stock-risk',
    sourceSummary: `${recommendation.inventoryItemId} 재주문 — ${recommendation.recommendationType.replace(/_/g, ' ')} (${recommendation.urgency})`,
    reasonCodes,
    requestedItemHints: [{
      itemName: recommendation.inventoryItemId,
      quantity: recommendation.recommendedOrderQuantity,
      unit: recommendation.recommendedUnit,
    }],
    preferredVendorId: recommendation.preferredVendorId ?? undefined,
    blockedVendorIds: undefined,
    requiredDocuments: undefined,
    targetLeadTimeDays: undefined,
    targetUnitPrice: recommendation.budgetImpactEstimate?.amount
      ? recommendation.budgetImpactEstimate.amount / recommendation.recommendedOrderQuantity
      : undefined,
    substituteAllowed: true,
    urgency: isCritical ? 'critical' : recommendation.urgency === 'high' ? 'high' : 'normal',
    budgetContextId: recommendation.budgetImpactEstimate?.budgetId ?? undefined,
    linkedInventoryItemId: recommendation.inventoryItemId,
    returnRoute: '/dashboard/stock-risk',
  };
}

// ---------------------------------------------------------------------------
// 10. Expiry Replacement → Re-entry Builder
// ---------------------------------------------------------------------------

export function buildExpiryReentryContext(
  expiryAction: ExpiryActionContract,
  stockPosition: InventoryStockPositionContract | undefined,
): ReentryContext {
  const isConsumeFirstImpossible = expiryAction.actionType === 'dispose';
  const reasonCodes: ReentryReasonCode[] = ['expiring_soon_replacement'];
  if (isConsumeFirstImpossible) reasonCodes.push('consume_first_impossible');

  return {
    sourceType: 'expiry_replacement',
    sourceEntityId: expiryAction.id,
    sourceRoute: '/dashboard/stock-risk',
    sourceSummary: `${expiryAction.inventoryItemId} Lot ${expiryAction.lotNumber} — 만료 ${expiryAction.daysToExpiry}일 후, ${expiryAction.actionType === 'dispose' ? '폐기' : '우선 사용'} 필요`,
    reasonCodes,
    requestedItemHints: [{
      itemName: expiryAction.inventoryItemId,
      quantity: expiryAction.affectedQuantity,
      unit: expiryAction.unit,
    }],
    substituteAllowed: true,
    urgency: expiryAction.daysToExpiry <= 7 ? 'critical' : expiryAction.daysToExpiry <= 30 ? 'high' : 'normal',
    linkedInventoryItemId: expiryAction.inventoryItemId,
    returnRoute: '/dashboard/stock-risk',
  };
}

// ---------------------------------------------------------------------------
// 11. Receiving Exception → Re-entry Builder
// ---------------------------------------------------------------------------

export function buildReceivingExceptionReentryContext(
  rb: ReceivingBatchContract,
  lineId?: string,
): ReentryContext {
  const line = lineId ? rb.lineReceipts.find((l) => l.id === lineId) : undefined;
  const hasDocMissing = line ? (line.documentStatus === 'partial' || line.documentStatus === 'missing') : rb.lineReceipts.some((l) => l.documentStatus === 'partial' || l.documentStatus === 'missing');
  const hasDamage = line ? line.conditionStatus !== 'ok' : rb.lineReceipts.some((l) => l.conditionStatus !== 'ok');
  const hasQuarantine = line ? line.lotRecords.some((lot) => lot.quarantineStatus === 'quarantined') : rb.lineReceipts.some((l) => l.lotRecords.some((lot) => lot.quarantineStatus === 'quarantined'));

  const reasonCodes: ReentryReasonCode[] = [];
  if (hasDamage) reasonCodes.push('damaged_receipt_replacement');
  if (hasDocMissing) reasonCodes.push('document_mismatch_replacement');
  if (hasQuarantine) reasonCodes.push('spec_mismatch_replacement');
  if (reasonCodes.length === 0) reasonCodes.push('partial_receipt_supplement');

  const targetLine = line ?? rb.lineReceipts.find((l) => l.conditionStatus !== 'ok' || l.documentStatus !== 'complete');

  return {
    sourceType: 'receiving_exception',
    sourceEntityId: rb.id,
    sourceRoute: `/dashboard/receiving/${rb.id}`,
    sourceSummary: `${rb.receivingNumber} — ${targetLine?.itemName ?? '입고 예외'} 대체 소싱 필요`,
    reasonCodes,
    requestedItemHints: targetLine ? [{
      itemName: targetLine.itemName,
      quantity: targetLine.orderedQuantity - targetLine.receivedQuantity,
      unit: undefined,
    }] : [],
    requiredDocuments: hasDocMissing ? ['COA', 'MSDS'] : undefined,
    substituteAllowed: !hasDocMissing, // doc 문제면 동일 품목, 품질 문제면 대체 가능
    urgency: hasQuarantine ? 'high' : 'normal',
    linkedInventoryItemId: targetLine?.itemName,
    returnRoute: `/dashboard/receiving/${rb.id}`,
  };
}

// ---------------------------------------------------------------------------
// 12. Quote Follow-up → Re-entry Builder
// ---------------------------------------------------------------------------

export function buildQuoteFollowupReentryContext(
  qr: QuoteRequestContract,
  responses: QuoteResponseContract[],
): ReentryContext {
  const respondedCount = responses.filter((r) => r.responseStatus === 'responded' || r.responseStatus === 'incomplete').length;
  const hasSubstitute = responses.some((r) => r.responseItems.some((ri) => ri.substituteOffered));
  const hasMissingCoverage = respondedCount < qr.vendorIds.length;

  const reasonCodes: ReentryReasonCode[] = [];
  if (hasSubstitute) reasonCodes.push('substitute_review_retry');
  if (hasMissingCoverage) reasonCodes.push('missing_vendor_coverage');
  if (respondedCount === 0) reasonCodes.push('no_exact_match_retry');
  if (reasonCodes.length === 0) reasonCodes.push('additional_comparison_needed');

  return {
    sourceType: 'quote_review_followup',
    sourceEntityId: qr.id,
    sourceRoute: `/dashboard/quotes/${qr.id}`,
    sourceSummary: `${qr.requestNumber} — ${respondedCount}/${qr.vendorIds.length} 응답, ${hasSubstitute ? '대체품 포함' : '추가 비교 필요'}`,
    reasonCodes,
    requestedItemHints: qr.items.map((item) => ({
      itemName: item.requestedName,
      manufacturer: item.manufacturer ?? undefined,
      catalogNumber: item.catalogNumber ?? undefined,
      quantity: item.quantity,
      unit: item.unit,
      specRequirements: item.specRequirements ?? undefined,
    })),
    blockedVendorIds: undefined,
    requiredDocuments: qr.requiredDocuments ?? undefined,
    substituteAllowed: qr.substituteAllowed ?? true,
    urgency: qr.priority === 'urgent' ? 'high' : 'normal',
    budgetContextId: qr.budgetContextId ?? undefined,
    returnRoute: `/dashboard/quotes/${qr.id}`,
  };
}

// ---------------------------------------------------------------------------
// 13. PO Recovery → Re-entry Builder
// ---------------------------------------------------------------------------

export function buildPORecoveryReentryContext(
  po: PurchaseOrderContract,
  ack: PurchaseOrderAcknowledgementContract | undefined,
): ReentryContext {
  const isAckTimeout = po.status === 'issued' && (!ack || ack.status === 'sent' || ack.status === 'not_sent');
  const reasonCodes: ReentryReasonCode[] = [];

  if (isAckTimeout) reasonCodes.push('ack_timeout_alternate');
  else reasonCodes.push('vendor_unavailable_alternate');

  return {
    sourceType: 'po_issue_context_recovery',
    sourceEntityId: po.id,
    sourceRoute: `/dashboard/purchase-orders/${po.id}`,
    sourceSummary: `${po.poNumber} — ${isAckTimeout ? '공급사 확인 장기 미응답' : '발행 불가'}, 대체 공급사 검토 필요`,
    reasonCodes,
    requestedItemHints: po.lines.map((line) => ({
      itemName: line.itemName,
      catalogNumber: line.catalogNumber ?? undefined,
      quantity: line.orderedQuantity,
      unit: line.orderedUnit,
    })),
    blockedVendorIds: [po.vendorId], // 기존 공급사 제외
    substituteAllowed: false, // 동일 spec 유지
    urgency: 'high',
    linkedInventoryItemId: undefined,
    returnRoute: `/dashboard/purchase-orders/${po.id}`,
  };
}

// ---------------------------------------------------------------------------
// 14. Manual Search → Re-entry Builder
// ---------------------------------------------------------------------------

export function buildManualSearchReentryContext(): ReentryContext {
  return {
    sourceType: 'manual_procurement_search',
    sourceEntityId: '',
    sourceRoute: '/dashboard',
    sourceSummary: '카탈로그 검색에서 견적 시작',
    reasonCodes: ['manual_catalog_search'],
    requestedItemHints: [],
    substituteAllowed: true,
    urgency: 'normal',
    returnRoute: '/dashboard',
  };
}

// ---------------------------------------------------------------------------
// 15. Re-entry Decision Summary Builder
// ---------------------------------------------------------------------------

export function buildReentryDecisionSummary(
  ctx: ReentryContext,
): ReentryDecisionSummary {
  const blockedReasons: string[] = [];
  let readiness: ReentryReadiness = 'ready';

  // Check for blocked conditions
  if (ctx.blockedVendorIds && ctx.blockedVendorIds.length > 0 && !ctx.preferredVendorId) {
    // All known vendors blocked, no preferred
    blockedReasons.push('모든 기존 공급사 제외됨 — 신규 공급사 탐색 필요');
  }

  // Determine readiness
  const hasItemHints = ctx.requestedItemHints.length > 0 && ctx.requestedItemHints.some((h) => h.itemName);
  if (!hasItemHints && ctx.sourceType !== 'manual_procurement_search') {
    readiness = 'needs_review';
    blockedReasons.push('검색할 품목 정보 부족');
  }

  if (blockedReasons.length > 0 && readiness === 'ready') {
    readiness = 'needs_review';
  }

  // Determine quote create mode
  let quoteCreateMode: QuoteCreateMode;
  const isHighRisk = ctx.urgency === 'critical' ||
    ctx.reasonCodes.includes('damaged_receipt_replacement') ||
    ctx.reasonCodes.includes('spec_mismatch_replacement') ||
    (ctx.requiredDocuments && ctx.requiredDocuments.length > 0 && !ctx.substituteAllowed);
  const isSimple = ctx.sourceType === 'manual_procurement_search' ||
    (hasItemHints && ctx.substituteAllowed && !isHighRisk && ctx.requestedItemHints.length === 1);
  const needsCompare = !isSimple && (ctx.substituteAllowed || ctx.requestedItemHints.length > 1 || isHighRisk);

  if (isHighRisk) {
    quoteCreateMode = 'review_first';
  } else if (needsCompare) {
    quoteCreateMode = 'compare_first';
  } else {
    quoteCreateMode = 'quick_quote_create';
  }

  // Determine recommended entry path
  let recommendedEntryPath: RecommendedEntryPath;
  if (quoteCreateMode === 'review_first' || quoteCreateMode === 'compare_first') {
    recommendedEntryPath = hasItemHints ? 'compare' : 'search';
  } else if (hasItemHints && ctx.preferredVendorId) {
    recommendedEntryPath = 'quote_draft';
  } else {
    recommendedEntryPath = 'search';
  }

  // Reason summary
  const reasonSummary = buildReasonSummary(ctx);

  return {
    reentryReadiness: readiness,
    recommendedEntryPath,
    quoteCreateMode,
    reasonSummary,
    blockedReasons,
    preferredCandidateCount: ctx.preferredVendorId ? 1 : 0,
    reviewRequiredCount: ctx.requiredDocuments?.length ?? 0,
    nextOwner: ctx.urgency === 'critical' ? '구매 담당자' : undefined,
    returnRoute: ctx.returnRoute,
  };
}

function buildReasonSummary(ctx: ReentryContext): string {
  const parts: string[] = [];
  const source = SOURCE_TYPE_LABELS[ctx.sourceType];
  parts.push(source);

  if (ctx.requestedItemHints.length > 0 && ctx.requestedItemHints[0]?.itemName) {
    parts.push(`품목: ${ctx.requestedItemHints[0].itemName}`);
  }
  if (ctx.urgency === 'critical') parts.push('긴급');
  if (!ctx.substituteAllowed) parts.push('동일 품목만');
  if (ctx.requiredDocuments && ctx.requiredDocuments.length > 0) {
    parts.push(`문서: ${ctx.requiredDocuments.join(', ')}`);
  }

  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// 16. Quote Bootstrap Builder
// ---------------------------------------------------------------------------

export function buildQuoteBootstrapSummary(ctx: ReentryContext): QuoteBootstrapSummary {
  const operationalNote = buildOperationalNote(ctx);

  return {
    sourceType: ctx.sourceType,
    sourceSummary: ctx.sourceSummary,
    itemHints: ctx.requestedItemHints,
    vendorShortlistIds: ctx.preferredVendorId ? [ctx.preferredVendorId] : [],
    excludedVendorIds: ctx.blockedVendorIds ?? [],
    requiredDocuments: ctx.requiredDocuments ?? [],
    substituteAllowed: ctx.substituteAllowed,
    urgency: ctx.urgency,
    budgetContextId: ctx.budgetContextId,
    targetLeadTimeDays: ctx.targetLeadTimeDays,
    operationalNote,
    linkedInventoryItemId: ctx.linkedInventoryItemId,
    linkedSourceRoute: ctx.sourceRoute,
  };
}

function buildOperationalNote(ctx: ReentryContext): string {
  const parts: string[] = [];

  switch (ctx.sourceType) {
    case 'stock_risk_reorder':
      parts.push(`재주문 사유: ${ctx.sourceSummary}`);
      if (ctx.linkedInventoryItemId) parts.push(`연결 재고: ${ctx.linkedInventoryItemId}`);
      break;
    case 'expiry_replacement':
      parts.push(`만료 대체: ${ctx.sourceSummary}`);
      break;
    case 'receiving_exception':
      parts.push(`입고 예외 대체: ${ctx.sourceSummary}`);
      break;
    case 'quote_review_followup':
      parts.push(`견적 후속: ${ctx.sourceSummary}`);
      break;
    case 'po_issue_context_recovery':
      parts.push(`발주 복구: ${ctx.sourceSummary}`);
      break;
    case 'manual_procurement_search':
      parts.push('수동 카탈로그 검색');
      break;
  }

  if (ctx.urgency === 'critical') parts.push('[긴급]');
  if (!ctx.substituteAllowed) parts.push('[동일 품목만]');
  if (ctx.budgetContextId) parts.push(`예산: ${ctx.budgetContextId}`);

  return parts.join(' | ');
}

// ---------------------------------------------------------------------------
// 17. Compare-Ready Assessment Builder
// ---------------------------------------------------------------------------

export function assessCompareReadiness(
  itemHint: RequestedItemHint,
  ctx: ReentryContext,
): CompareReadyAssessment {
  const hasName = !!itemHint.itemName;
  const hasCatalog = !!itemHint.catalogNumber;
  const hasManufacturer = !!itemHint.manufacturer;
  const hasQuantity = (itemHint.quantity ?? 0) > 0;

  const hasExactOrCompatibleMatch = hasCatalog || (hasName && hasManufacturer);
  const hasRequiredDocs = !ctx.requiredDocuments || ctx.requiredDocuments.length === 0;
  const vendorNotBlocked = !ctx.blockedVendorIds || ctx.blockedVendorIds.length === 0 || !!ctx.preferredVendorId;
  const quantityInterpretable = hasQuantity;
  const hasAvailabilityHint = !!ctx.targetLeadTimeDays || ctx.urgency !== 'low';

  const reviewReasons: string[] = [];
  if (!hasExactOrCompatibleMatch) reviewReasons.push('정확한 품목 식별 정보 부족');
  if (!hasRequiredDocs) reviewReasons.push('필수 문서 확인 필요');
  if (!vendorNotBlocked) reviewReasons.push('공급사 제약 확인 필요');
  if (!quantityInterpretable) reviewReasons.push('수량 확인 필요');

  const isCompareReady = hasExactOrCompatibleMatch && vendorNotBlocked && quantityInterpretable;

  return {
    isCompareReady,
    hasExactOrCompatibleMatch,
    hasRequiredDocs,
    vendorNotBlocked,
    quantityInterpretable,
    hasAvailabilityHint,
    reviewReasons,
  };
}

// ---------------------------------------------------------------------------
// 18. Source Type Labels & Tones
// ---------------------------------------------------------------------------

export const SOURCE_TYPE_LABELS: Record<ReentrySourceType, string> = {
  stock_risk_reorder: '재고 재주문',
  expiry_replacement: '만료 대체',
  receiving_exception: '입고 예외',
  quote_review_followup: '견적 후속',
  po_issue_context_recovery: '발주 복구',
  manual_procurement_search: '카탈로그 검색',
};

export const SOURCE_TYPE_TONES: Record<ReentrySourceType, string> = {
  stock_risk_reorder: 'bg-amber-500/10 text-amber-400',
  expiry_replacement: 'bg-orange-500/10 text-orange-400',
  receiving_exception: 'bg-red-500/10 text-red-400',
  quote_review_followup: 'bg-blue-500/10 text-blue-400',
  po_issue_context_recovery: 'bg-purple-500/10 text-purple-400',
  manual_procurement_search: 'bg-slate-700 text-slate-300',
};

export const URGENCY_LABELS: Record<ReentryUrgency, string> = {
  critical: '긴급',
  high: '높음',
  normal: '보통',
  low: '낮음',
};

export const URGENCY_TONES: Record<ReentryUrgency, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-amber-500/10 text-amber-400',
  normal: 'bg-slate-700 text-slate-300',
  low: 'bg-slate-700 text-slate-400',
};

export const ENTRY_PATH_LABELS: Record<RecommendedEntryPath, string> = {
  search: '검색',
  compare: '비교',
  quote_draft: '견적 초안',
};

export const QUOTE_CREATE_MODE_LABELS: Record<QuoteCreateMode, string> = {
  quick_quote_create: '빠른 견적 생성',
  compare_first: '비교 후 견적',
  review_first: '검토 후 견적',
};

// ---------------------------------------------------------------------------
// 19. Re-entry Context Serialization (URL state)
// ---------------------------------------------------------------------------

export function serializeReentryContext(ctx: ReentryContext): string {
  return encodeURIComponent(JSON.stringify(ctx));
}

export function deserializeReentryContext(encoded: string): ReentryContext | null {
  try {
    return JSON.parse(decodeURIComponent(encoded)) as ReentryContext;
  } catch {
    return null;
  }
}

/**
 * Re-entry context를 URL searchParams로 인코딩.
 * 전체 context를 `reentry` param에 JSON으로 저장.
 */
export function buildReentrySearchParams(ctx: ReentryContext): URLSearchParams {
  const params = new URLSearchParams();
  params.set('reentry', serializeReentryContext(ctx));
  // 검색 편의를 위해 핵심 필드도 개별 param으로 추가
  if (ctx.requestedItemHints[0]?.itemName) {
    params.set('q', ctx.requestedItemHints[0].itemName);
  }
  if (ctx.sourceType) {
    params.set('source', ctx.sourceType);
  }
  return params;
}

// ---------------------------------------------------------------------------
// 20. Re-entry Command Helpers (action surface 연결)
// ---------------------------------------------------------------------------

export interface ReentryCommand {
  /** 버튼 라벨 (한국어) */
  label: string;
  /** 이동 경로 (with searchParams) */
  href: string;
  /** 소스 유형 */
  sourceType: ReentrySourceType;
  /** 긴급도 */
  urgency: ReentryUrgency;
  /** 진입 경로 */
  entryPath: RecommendedEntryPath;
}

export function buildReentryCommand(ctx: ReentryContext): ReentryCommand {
  const decision = buildReentryDecisionSummary(ctx);
  const params = buildReentrySearchParams(ctx);

  let basePath: string;
  switch (decision.recommendedEntryPath) {
    case 'search':
      basePath = '/test/search';
      break;
    case 'compare':
      basePath = '/compare';
      break;
    case 'quote_draft':
      basePath = '/dashboard/quotes';
      break;
  }

  const label = REENTRY_COMMAND_LABELS[ctx.sourceType] ?? '검색';

  return {
    label,
    href: `${basePath}?${params.toString()}`,
    sourceType: ctx.sourceType,
    urgency: ctx.urgency,
    entryPath: decision.recommendedEntryPath,
  };
}

export const REENTRY_COMMAND_LABELS: Record<ReentrySourceType, string> = {
  stock_risk_reorder: '재주문 견적 검색',
  expiry_replacement: '대체 품목 검색',
  receiving_exception: '대체 품목 검색',
  quote_review_followup: '후보 다시 비교',
  po_issue_context_recovery: '대체 공급사 검토',
  manual_procurement_search: '카탈로그 검색',
};

// ---------------------------------------------------------------------------
// 21. Fallback / Invalid Re-entry Handling
// ---------------------------------------------------------------------------

export type ReentryFallbackType =
  | 'source_entity_missing'
  | 'stale_linked_item'
  | 'blocked_vendor_only'
  | 'no_compare_ready_candidate'
  | 'budget_context_missing'
  | 'invalid_return_route';

export interface ReentryFallback {
  type: ReentryFallbackType;
  /** 왜 재진입이 약한지 */
  reason: string;
  /** 대안 경로 */
  alternativePath?: string;
  /** 대안 라벨 */
  alternativeLabel?: string;
  /** 수동 작성 가능 여부 */
  canFallbackToManual: boolean;
}

export function checkReentryFallbacks(ctx: ReentryContext): ReentryFallback[] {
  const fallbacks: ReentryFallback[] = [];

  if (!ctx.sourceEntityId && ctx.sourceType !== 'manual_procurement_search') {
    fallbacks.push({
      type: 'source_entity_missing',
      reason: '원본 엔티티를 찾을 수 없습니다',
      alternativePath: '/test/search',
      alternativeLabel: '수동 검색으로 전환',
      canFallbackToManual: true,
    });
  }

  if (ctx.blockedVendorIds && ctx.blockedVendorIds.length > 0 && !ctx.preferredVendorId) {
    fallbacks.push({
      type: 'blocked_vendor_only',
      reason: '기존 공급사가 모두 제외되어 신규 공급사 탐색이 필요합니다',
      alternativePath: '/test/search',
      alternativeLabel: '공급사 제약 없이 검색',
      canFallbackToManual: true,
    });
  }

  if (ctx.requestedItemHints.length === 0 || !ctx.requestedItemHints[0]?.itemName) {
    fallbacks.push({
      type: 'no_compare_ready_candidate',
      reason: '검색할 품목 정보가 부족하여 비교 후보를 구성할 수 없습니다',
      alternativePath: '/test/search',
      alternativeLabel: '수동 검색으로 시작',
      canFallbackToManual: true,
    });
  }

  return fallbacks;
}
