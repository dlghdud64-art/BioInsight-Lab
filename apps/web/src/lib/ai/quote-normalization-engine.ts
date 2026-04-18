/**
 * Quote Normalization Engine — 견적 정규화 상태 모델 + 라인 매핑 + 상업 조건 정규화 + validator + canonical object
 *
 * 고정 규칙:
 * 1. quote normalization = raw quote → canonical normalized quote로 변환하는 운영 단계.
 * 2. request line 기준 mapping이 canonical compare basis.
 * 3. raw quote text를 바로 compare field로 쓰지 말 것.
 * 4. canonical normalized quote object 없이 compare review 진입 금지.
 * 5. normalization completeness가 compare gate를 결정.
 */

import type { QuoteNormalizationHandoff } from "./quote-workqueue-engine";

// ══════════════════════════════════════════════════════════════════════════════
// Normalization Status
// ══════════════════════════════════════════════════════════════════════════════

export type QuoteNormalizationStatus =
  | "quote_normalization_open"
  | "quote_normalization_in_progress"
  | "quote_normalized_recorded";

export type QuoteNormalizationSubstatus =
  | "awaiting_line_mapping"
  | "awaiting_commercial_fields"
  | "normalization_incomplete"
  | "normalization_blocked"
  | "ready_for_compare_handoff";

// ══════════════════════════════════════════════════════════════════════════════
// Normalization State
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteNormalizationState {
  quoteNormalizationStatus: QuoteNormalizationStatus;
  substatus: QuoteNormalizationSubstatus;
  quoteNormalizationOpenedAt: string;
  quoteNormalizationOpenedBy: "queue_handoff" | "manual";
  quoteWorkqueueRowId: string;
  requestSubmissionEventId: string;
  vendorTargetId: string;
  rawQuoteReferenceId: string | null;
  expectedRequestLineCount: number;
  mappedLineCount: number;
  missingFieldCount: number;
  normalizationBlockedFlag: boolean;
  normalizationBlockedReason: string | null;
  normalizedQuoteObjectId: string | null;
  // ── Mapping + Lines ──
  lineMapping: QuoteLineMapping;
  normalizedLines: NormalizedQuoteLine[];
}

export function createInitialNormalizationState(
  handoff: QuoteNormalizationHandoff,
  rawLines: RawQuoteLine[],
): QuoteNormalizationState {
  const mapping = buildQuoteLineMapping(rawLines, handoff.expectedRequestLineCount);
  const normalizedLines = rawLines.map((rl) => buildInitialNormalizedLine(rl));

  return {
    quoteNormalizationStatus: "quote_normalization_open",
    substatus: mapping.unmappedRawLines.length > 0 || mapping.uncoveredRequestLines.length > 0 ? "awaiting_line_mapping" : "awaiting_commercial_fields",
    quoteNormalizationOpenedAt: new Date().toISOString(),
    quoteNormalizationOpenedBy: "queue_handoff",
    quoteWorkqueueRowId: handoff.quoteWorkqueueRowId,
    requestSubmissionEventId: handoff.requestSubmissionEventId,
    vendorTargetId: handoff.vendorTargetId,
    rawQuoteReferenceId: handoff.rawQuoteReference,
    expectedRequestLineCount: handoff.expectedRequestLineCount,
    mappedLineCount: mapping.mappedPairs.length,
    missingFieldCount: normalizedLines.filter((l) => l.missingFields.length > 0).length,
    normalizationBlockedFlag: false,
    normalizationBlockedReason: null,
    normalizedQuoteObjectId: null,
    lineMapping: mapping,
    normalizedLines,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Raw Quote Line (vendor response 원문 단위)
// ══════════════════════════════════════════════════════════════════════════════

export interface RawQuoteLine {
  rawLineId: string;
  itemDescription: string;
  catalogNumber: string;
  rawUnitPrice: string;
  rawCurrency: string;
  rawLeadTime: string;
  rawMOQ: string;
  rawStockAvailability: string;
  rawSubstituteNote: string;
  rawNote: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Quote Line Mapping
// ══════════════════════════════════════════════════════════════════════════════

export interface QuoteLineMappingPair {
  requestLineId: string;
  rawLineId: string;
  mappedStatus: "confirmed" | "ambiguous" | "substitute";
}

export interface QuoteLineMapping {
  expectedRequestLineIds: string[];
  mappedPairs: QuoteLineMappingPair[];
  unmappedRawLines: string[];
  uncoveredRequestLines: string[];
  ambiguousMatches: string[];
}

export function buildQuoteLineMapping(
  rawLines: RawQuoteLine[],
  expectedCount: number,
): QuoteLineMapping {
  // Auto-map by index (simplistic — real impl would match by catalog/name)
  const expectedIds = Array.from({ length: expectedCount }, (_, i) => `reqline_${i}`);
  const mappedPairs: QuoteLineMappingPair[] = [];
  const unmappedRawLines: string[] = [];
  const uncoveredRequestLines: string[] = [];

  rawLines.forEach((rl, idx) => {
    if (idx < expectedCount) {
      mappedPairs.push({
        requestLineId: expectedIds[idx],
        rawLineId: rl.rawLineId,
        mappedStatus: "confirmed",
      });
    } else {
      unmappedRawLines.push(rl.rawLineId);
    }
  });

  expectedIds.forEach((reqId, idx) => {
    if (idx >= rawLines.length) {
      uncoveredRequestLines.push(reqId);
    }
  });

  return {
    expectedRequestLineIds: expectedIds,
    mappedPairs,
    unmappedRawLines,
    uncoveredRequestLines,
    ambiguousMatches: [],
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Normalized Quote Line
// ══════════════════════════════════════════════════════════════════════════════

export interface NormalizedQuoteLine {
  normalizedLineId: string;
  rawLineId: string;
  requestLineId: string | null;
  normalizedUnitPrice: number | null;
  normalizedCurrency: string;
  normalizedPackBasis: string;
  normalizedLeadTimeDays: number | null;
  normalizedMOQ: number | null;
  normalizedStockAvailability: "in_stock" | "out_of_stock" | "limited" | "unknown";
  substituteOffered: boolean;
  vendorCommercialNote: string;
  // ── Raw evidence ──
  rawUnitPriceText: string;
  rawLeadTimeText: string;
  rawMOQText: string;
  // ── Completeness ──
  missingFields: string[];
  isComplete: boolean;
}

function buildInitialNormalizedLine(raw: RawQuoteLine): NormalizedQuoteLine {
  const missingFields: string[] = [];
  const price = parseFloat(raw.rawUnitPrice.replace(/[^\d.]/g, ""));
  const leadTime = parseInt(raw.rawLeadTime.replace(/[^\d]/g, ""), 10);
  const moq = parseInt(raw.rawMOQ.replace(/[^\d]/g, ""), 10);

  if (!price || isNaN(price)) missingFields.push("단가");
  if (!leadTime || isNaN(leadTime)) missingFields.push("납기");
  if (!moq || isNaN(moq)) missingFields.push("MOQ");
  if (!raw.rawStockAvailability) missingFields.push("재고");

  return {
    normalizedLineId: `nql_${raw.rawLineId}_${Date.now().toString(36)}`,
    rawLineId: raw.rawLineId,
    requestLineId: null,
    normalizedUnitPrice: isNaN(price) ? null : price,
    normalizedCurrency: raw.rawCurrency || "KRW",
    normalizedPackBasis: "",
    normalizedLeadTimeDays: isNaN(leadTime) ? null : leadTime,
    normalizedMOQ: isNaN(moq) ? null : moq,
    normalizedStockAvailability: raw.rawStockAvailability ? "in_stock" : "unknown",
    substituteOffered: !!raw.rawSubstituteNote,
    vendorCommercialNote: raw.rawNote,
    rawUnitPriceText: raw.rawUnitPrice,
    rawLeadTimeText: raw.rawLeadTime,
    rawMOQText: raw.rawMOQ,
    missingFields,
    isComplete: missingFields.length === 0,
  };
}

export function normalizeQuoteCommercialFields(
  line: NormalizedQuoteLine,
  overrides: Partial<Pick<NormalizedQuoteLine, "normalizedUnitPrice" | "normalizedLeadTimeDays" | "normalizedMOQ" | "normalizedStockAvailability">>,
): NormalizedQuoteLine {
  const updated = { ...line, ...overrides };
  const missingFields: string[] = [];
  if (updated.normalizedUnitPrice === null) missingFields.push("단가");
  if (updated.normalizedLeadTimeDays === null) missingFields.push("납기");
  if (updated.normalizedMOQ === null) missingFields.push("MOQ");
  if (updated.normalizedStockAvailability === "unknown") missingFields.push("재고");
  return { ...updated, missingFields, isComplete: missingFields.length === 0 };
}

// ══════════════════════════════════════════════════════════════════════════════
// Normalization Completeness Validator
// ══════════════════════════════════════════════════════════════════════════════

export interface NormalizationValidation {
  canRecordNormalizedQuote: boolean;
  blockingIssues: string[];
  warnings: string[];
  missingFields: string[];
  compareReady: boolean;
  recommendedNextAction: string;
}

export function validateQuoteNormalizationBeforeRecord(
  state: QuoteNormalizationState,
): NormalizationValidation {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const missingFields: string[] = [];

  if (state.lineMapping.uncoveredRequestLines.length > 0) {
    blockingIssues.push(`${state.lineMapping.uncoveredRequestLines.length}개 요청 라인이 매핑되지 않았습니다`);
  }

  if (state.lineMapping.ambiguousMatches.length > 0) {
    warnings.push(`${state.lineMapping.ambiguousMatches.length}개 모호한 매핑이 있습니다`);
  }

  const incompleteLines = state.normalizedLines.filter((l) => !l.isComplete);
  if (incompleteLines.length > 0) {
    warnings.push(`${incompleteLines.length}개 라인의 상업 조건이 불완전합니다`);
    incompleteLines.forEach((l) => l.missingFields.forEach((f) => missingFields.push(`${l.rawLineId}: ${f}`)));
  }

  if (state.normalizedLines.length === 0) {
    blockingIssues.push("정규화된 라인이 없습니다");
  }

  const priceCount = state.normalizedLines.filter((l) => l.normalizedUnitPrice !== null).length;
  if (priceCount === 0 && state.normalizedLines.length > 0) {
    blockingIssues.push("모든 라인의 단가가 누락되었습니다");
  }

  return {
    canRecordNormalizedQuote: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    missingFields,
    compareReady: blockingIssues.length === 0 && incompleteLines.length === 0,
    recommendedNextAction: blockingIssues.length > 0
      ? "차단 사항을 먼저 해결하세요"
      : warnings.length > 0
        ? "경고 항목을 검토하고 정규화를 완료하세요"
        : "정규화를 완료하고 비교 준비로 넘기세요",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Canonical Normalized Quote Object
// ══════════════════════════════════════════════════════════════════════════════

export interface NormalizedQuoteObject {
  id: string;
  requestSubmissionEventId: string;
  quoteWorkqueueRowId: string;
  vendorTargetId: string;
  rawQuoteReferenceId: string | null;
  mappedRequestLineIds: string[];
  normalizedQuoteLines: NormalizedQuoteLine[];
  missingFieldSummary: string[];
  ambiguitySummary: string[];
  compareReadinessSummary: string;
  recordedAt: string;
  recordedBy: string;
}

export function buildNormalizedQuoteObject(
  state: QuoteNormalizationState,
): NormalizedQuoteObject {
  const validation = validateQuoteNormalizationBeforeRecord(state);
  return {
    id: `nqobj_${Date.now().toString(36)}`,
    requestSubmissionEventId: state.requestSubmissionEventId,
    quoteWorkqueueRowId: state.quoteWorkqueueRowId,
    vendorTargetId: state.vendorTargetId,
    rawQuoteReferenceId: state.rawQuoteReferenceId,
    mappedRequestLineIds: state.lineMapping.mappedPairs.map((p) => p.requestLineId),
    normalizedQuoteLines: state.normalizedLines,
    missingFieldSummary: validation.missingFields,
    ambiguitySummary: state.lineMapping.ambiguousMatches,
    compareReadinessSummary: validation.compareReady ? "비교 준비 완료" : "비교 준비 미완료",
    recordedAt: new Date().toISOString(),
    recordedBy: "operator",
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Compare Review Handoff (from normalized quote)
// ══════════════════════════════════════════════════════════════════════════════

export interface NormalizedQuoteCompareHandoff {
  normalizedQuoteObjectId: string;
  requestSubmissionEventId: string;
  vendorTargetId: string;
  mappedRequestLineIds: string[];
  compareBasisSummary: string;
  missingFieldSummary: string[];
  warnings: string[];
  compareReadinessSummary: string;
}

export function buildNormalizedQuoteCompareHandoff(
  normalizedQuote: NormalizedQuoteObject,
): NormalizedQuoteCompareHandoff {
  return {
    normalizedQuoteObjectId: normalizedQuote.id,
    requestSubmissionEventId: normalizedQuote.requestSubmissionEventId,
    vendorTargetId: normalizedQuote.vendorTargetId,
    mappedRequestLineIds: normalizedQuote.mappedRequestLineIds,
    compareBasisSummary: `${normalizedQuote.vendorTargetId} — ${normalizedQuote.normalizedQuoteLines.length}개 라인`,
    missingFieldSummary: normalizedQuote.missingFieldSummary,
    warnings: normalizedQuote.ambiguitySummary.length > 0 ? [`모호 매핑 ${normalizedQuote.ambiguitySummary.length}개`] : [],
    compareReadinessSummary: normalizedQuote.compareReadinessSummary,
  };
}
