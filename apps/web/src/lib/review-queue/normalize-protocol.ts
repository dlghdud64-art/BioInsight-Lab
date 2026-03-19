/**
 * 프로토콜 업로드 결과 → Review Queue Item normalize + evidence mapping + status mapping
 *
 * 프로토콜 문서에서 추출된 품목 후보를 근거 문장(evidence)과 함께
 * ReviewQueueItem으로 변환한다. sourceType은 항상 "protocol".
 */

import type {
  ReviewQueueItem,
  ReviewStatus,
  ConfidenceLevel,
  MatchCandidate,
} from "./types";

// ── Evidence 타입 ──
export type EvidenceType =
  | "direct_mention"       // 품목명이 직접 언급됨
  | "implicit_requirement" // 실험 절차상 암묵적으로 필요
  | "quantity_hint"        // 수량/용량 힌트
  | "condition_hint";      // 조건/농도 힌트

export interface EvidenceSegment {
  segmentId: string;
  pageNumber: number | null;
  sectionTitle: string | null;
  stepLabel: string | null;
  text: string;
  charStart: number | null;
  charEnd: number | null;
  evidenceType: EvidenceType;
  highlightText: string; // 근거 문장 중 핵심 부분
}

// ── 프로토콜 source 전용 메타 ──
export interface ProtocolSourceMeta {
  sourceFileName: string;
  documentId: string;
  protocolTitle: string | null;
  sectionTitle: string | null;
  stepLabel: string | null;
  evidenceSegments: EvidenceSegment[];
  documentPage: number | null;
  rawParagraph: string;
  extractionMethod: "text_parse" | "ai_extract" | "regex_match";
}

// ── 프로토콜 추출 항목 (AI/파서 출력) ──
export interface ProtocolExtract {
  /** 추출된 품목명 */
  itemName: string | null;
  /** 제조사 (문서에 명시된 경우만) */
  manufacturer: string | null;
  /** 카탈로그 번호 (문서에 명시된 경우만) */
  catalogNumber: string | null;
  /** 규격/농도/용량 힌트 */
  spec: string | null;
  /** 수량 (문서에 명시된 경우만) */
  quantity: number | null;
  /** 단위 */
  unit: string | null;
  /** 근거 문장들 */
  evidenceSegments: EvidenceSegment[];
  /** 후보 매칭 결과 */
  matchCandidates: MatchCandidate[];
}

// ── 프로토콜 파싱 컨텍스트 ──
export interface ProtocolParseContext {
  fileName: string;
  documentId: string;
  protocolTitle: string | null;
  extractionMethod: "text_parse" | "ai_extract" | "regex_match";
}

// ── ID 생성 ──
function generateProtocolQueueId(documentId: string, index: number): string {
  const hash = Math.random().toString(36).slice(2, 6);
  return `protocol-${documentId}-${hash}-${index}`;
}

// ── reviewReason 코드 ──
type ProtocolReviewReasonCode =
  | "name_missing"
  | "manufacturer_missing"
  | "catalog_missing"
  | "spec_unclear"
  | "quantity_missing"
  | "unit_missing"
  | "multiple_candidates"
  | "category_level_only"
  | "spec_collision"
  | "brand_ambiguous"
  | "packaging_unclear"
  | "protocol_to_product_gap"
  | "no_match"
  | "evidence_only";

// ── rawInput 생성 (근거 문장 요약) ──
function buildProtocolRawInput(extract: ProtocolExtract): string {
  // primary evidence의 highlightText 사용
  const primary = extract.evidenceSegments[0];
  if (primary?.highlightText) return primary.highlightText;
  if (primary?.text) return primary.text.slice(0, 120);
  // fallback: 품목명 + spec
  const parts: string[] = [];
  if (extract.itemName) parts.push(extract.itemName);
  if (extract.spec) parts.push(extract.spec);
  return parts.join(" · ") || "(근거 없음)";
}

// ── reviewReason 수집 ──
function collectProtocolReviewReasons(extract: ProtocolExtract): ProtocolReviewReasonCode[] {
  const reasons: ProtocolReviewReasonCode[] = [];

  if (!extract.itemName) reasons.push("name_missing");
  if (!extract.manufacturer) reasons.push("manufacturer_missing");
  if (!extract.catalogNumber) reasons.push("catalog_missing");
  if (!extract.spec) reasons.push("spec_unclear");
  if (extract.quantity == null) reasons.push("quantity_missing");
  if (!extract.unit) reasons.push("unit_missing");
  if (!extract.evidenceSegments?.length) reasons.push("evidence_only");

  return reasons;
}

// ── status mapping ──
function mapProtocolStatus(
  parsedItemName: string | null,
  reasons: ProtocolReviewReasonCode[],
  candidateCount: number
): ReviewStatus {
  // 1순위: match_failed
  if (!parsedItemName || candidateCount === 0) {
    return "match_failed";
  }
  // 2순위: compare_needed
  if (candidateCount > 1) {
    return "compare_needed";
  }
  // 3순위: review_needed
  if (reasons.length > 0) {
    return "needs_review";
  }
  // 4순위: ready
  return "confirmed";
}

// ── confidence mapping ──
function mapProtocolConfidence(
  extract: ProtocolExtract,
  status: ReviewStatus,
  reasons: ProtocolReviewReasonCode[]
): ConfidenceLevel {
  if (status === "match_failed") return "low";

  const hasEvidence = (extract.evidenceSegments?.length ?? 0) > 0;
  const hasManufacturer = !!extract.manufacturer;
  const hasCatalog = !!extract.catalogNumber;
  const hasSpec = !!extract.spec;

  // high: evidence + 제조사/Cat.No + spec + 사유 없음
  if (hasEvidence && (hasManufacturer || hasCatalog) && hasSpec && reasons.length === 0) {
    return "high";
  }

  // low: 핵심 필드 대부분 누락
  const presentCount = [hasManufacturer, hasCatalog, hasSpec].filter(Boolean).length;
  if (presentCount === 0) return "low";

  return "medium";
}

// ── 단일 프로토콜 추출 항목 → ReviewQueueItem 변환 ──
export function mapProtocolExtractToQueueItem(
  context: ProtocolParseContext,
  extract: ProtocolExtract,
  index: number = 0
): ReviewQueueItem {
  const reasons = collectProtocolReviewReasons(extract);
  const candidateCount = extract.matchCandidates.length;

  // 후보가 여러 개면 reason 추가
  if (candidateCount > 1 && !reasons.includes("multiple_candidates")) {
    reasons.push("multiple_candidates");
  }

  const status = mapProtocolStatus(extract.itemName, reasons, candidateCount);
  const confidence = mapProtocolConfidence(extract, status, reasons);
  const needsReview = status !== "confirmed";

  // confirmed + 후보 1개이면 자동 선택
  const selectedProduct =
    status === "confirmed" && extract.matchCandidates.length === 1
      ? extract.matchCandidates[0]
      : null;

  return {
    id: generateProtocolQueueId(context.documentId, index),
    sourceType: "protocol",
    rawInput: buildProtocolRawInput(extract),
    parsedItemName: extract.itemName ?? "",
    manufacturer: extract.manufacturer,
    catalogNumber: extract.catalogNumber,
    spec: extract.spec,
    quantity: extract.quantity,
    unit: extract.unit,
    confidence,
    status,
    matchCandidates: extract.matchCandidates,
    selectedProduct,
    needsReview,
    reviewReason: reasons.length > 0 ? [...new Set(reasons)].join(", ") : null,
    addedAt: new Date().toISOString(),
  };
}

// ── 프로토콜 추출 배열 → ReviewQueueItem 배열 변환 ──
export function mapProtocolExtractsToQueueItems(
  context: ProtocolParseContext,
  extracts: ProtocolExtract[]
): ReviewQueueItem[] {
  if (!extracts || extracts.length === 0) {
    return [{
      id: generateProtocolQueueId(context.documentId, 0),
      sourceType: "protocol",
      rawInput: `${context.fileName} — 추출된 품목이 없습니다`,
      parsedItemName: "",
      manufacturer: null,
      catalogNumber: null,
      spec: null,
      quantity: null,
      unit: null,
      confidence: "low",
      status: "match_failed",
      matchCandidates: [],
      selectedProduct: null,
      needsReview: true,
      reviewReason: "no_match",
      addedAt: new Date().toISOString(),
    }];
  }

  return extracts.map((extract, index) =>
    mapProtocolExtractToQueueItem(context, extract, index)
  );
}

// ── reviewReason 한글 라벨 매핑 ──
export const PROTOCOL_REVIEW_REASON_LABELS: Record<ProtocolReviewReasonCode, string> = {
  name_missing: "품목명 확인 필요",
  manufacturer_missing: "제조사 확인 필요",
  catalog_missing: "카탈로그 번호 확인 필요",
  spec_unclear: "규격 확인 필요",
  quantity_missing: "수량 확인 필요",
  unit_missing: "단위 확인 필요",
  multiple_candidates: "후보 비교 필요",
  category_level_only: "제품군 수준으로만 추출되었습니다",
  spec_collision: "규격이 유사한 후보가 여러 개 있습니다",
  brand_ambiguous: "제조사 구분이 필요합니다",
  packaging_unclear: "판매 단위 확인 필요",
  protocol_to_product_gap: "문서 표현과 실제 구매 단위 연결 검토가 필요합니다",
  no_match: "일치하는 후보를 찾지 못했습니다",
  evidence_only: "근거 문장은 있으나 제품 후보를 특정하지 못했습니다",
};
