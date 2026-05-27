/**
 * 직접 검색 결과 → Review Queue Item normalize + status mapping
 *
 * 검색 결과 카드 1개를 ReviewQueueItem으로 변환한다.
 * sourceType은 항상 "search".
 */

import type {
  ReviewQueueItem,
  ReviewStatus,
  ConfidenceLevel,
  MatchCandidate,
} from "./types";

// ── 검색 결과 원본 타입 (API 응답 기준) ──
export interface SearchResultProduct {
  id: string;
  name: string;
  nameEn?: string | null;
  brand?: string | null;
  catalogNumber?: string | null;
  lotNumber?: string | null;
  spec?: string | null;
  unit?: string | null;
  price?: number | null;
  currency?: string | null;
  description?: string | null;
  imageUrl?: string | null;
}

// ── ID 생성 ──
function generateQueueId(index: number): string {
  return `search-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── normalize: 검색 결과 → 공통 필드 추출 ──
function normalizeSearchResult(
  searchInput: string,
  result: SearchResultProduct,
  index: number
): Omit<ReviewQueueItem, "status" | "confidence" | "needsReview" | "reviewReason"> {
  const candidate: MatchCandidate = {
    productId: result.id,
    productName: result.name,
    brand: result.brand ?? null,
    catalogNumber: result.catalogNumber ?? null,
    score: 1.0, // 단일 카드이므로 1.0
  };

  return {
    id: result.id || generateQueueId(index),
    sourceType: "search",
    rawInput: searchInput,
    parsedItemName: result.name,
    manufacturer: result.brand ?? null,
    catalogNumber: result.catalogNumber ?? null,
    spec: result.spec ?? null,
    quantity: 1, // 직접 검색 단계에서는 기본 1
    unit: result.unit ?? null,
    matchCandidates: [candidate],
    selectedProduct: null, // status mapping에서 결정
    addedAt: new Date().toISOString(),
  };
}

// ── reviewReason 수집 ──
type ReviewReasonCode =
  | "no_match"
  | "candidate_missing"
  | "low_relevance"
  | "multiple_candidates"
  | "close_match_scores"
  | "comparison_recommended"
  | "manufacturer_missing"
  | "catalog_missing"
  | "spec_unclear"
  | "unit_missing"
  | "quantity_inferred"
  | "packaging_unclear"
  | "name_missing";

function collectReviewReasons(
  normalized: ReturnType<typeof normalizeSearchResult>
): ReviewReasonCode[] {
  const reasons: ReviewReasonCode[] = [];

  if (!normalized.parsedItemName) reasons.push("name_missing");
  if (!normalized.manufacturer) reasons.push("manufacturer_missing");
  if (!normalized.catalogNumber) reasons.push("catalog_missing");
  if (!normalized.spec) reasons.push("spec_unclear");
  if (!normalized.unit) reasons.push("unit_missing");

  return reasons;
}

// ── status mapping ──
function mapStatus(
  normalized: ReturnType<typeof normalizeSearchResult>,
  reasons: ReviewReasonCode[],
  candidateCount: number
): ReviewStatus {
  // 1순위: 매칭 실패
  if (!normalized.parsedItemName || candidateCount === 0) {
    return "match_failed";
  }

  // 2순위: 후보 비교 필요
  if (candidateCount > 1) {
    return "compare_needed";
  }

  // 3순위: 검토 필요
  if (reasons.length > 0) {
    return "needs_review";
  }

  // 4순위: 확정 가능
  return "confirmed";
}

// ── confidence mapping ──
function mapConfidence(
  normalized: ReturnType<typeof normalizeSearchResult>,
  status: ReviewStatus,
  reasons: ReviewReasonCode[]
): ConfidenceLevel {
  if (status === "match_failed") return "low";

  const hasManufacturer = !!normalized.manufacturer;
  const hasCatalog = !!normalized.catalogNumber;
  const hasSpec = !!normalized.spec;

  // high: 제조사 + Cat.No + spec 모두 있고, 검토 사유 없음
  if (hasManufacturer && hasCatalog && hasSpec && reasons.length === 0) {
    return "high";
  }

  // low: 핵심 필드 2개 이상 누락
  const missingCount = [hasManufacturer, hasCatalog, hasSpec].filter((v) => !v).length;
  if (missingCount >= 2) {
    return "low";
  }

  return "medium";
}

// ── 단일 검색 결과 → ReviewQueueItem 변환 ──
export function mapSearchResultToQueueItem(
  searchInput: string,
  result: SearchResultProduct,
  index: number = 0
): ReviewQueueItem {
  const normalized = normalizeSearchResult(searchInput, result, index);
  const reasons = collectReviewReasons(normalized);
  const candidateCount = normalized.matchCandidates.length;

  const status = mapStatus(normalized, reasons, candidateCount);
  const confidence = mapConfidence(normalized, status, reasons);
  const needsReview = status !== "confirmed";

  // confirmed일 때만 자동으로 selectedProduct 설정
  const selectedProduct =
    status === "confirmed" && normalized.matchCandidates.length === 1
      ? normalized.matchCandidates[0]
      : null;

  return {
    ...normalized,
    status,
    confidence,
    needsReview,
    reviewReason: reasons.length > 0 ? reasons.join(", ") : null,
    selectedProduct,
  };
}

// ── 검색 결과 배열 → ReviewQueueItem 배열 변환 ──
export function mapSearchResultsToQueueItems(
  searchInput: string,
  results: SearchResultProduct[]
): ReviewQueueItem[] {
  if (!results || results.length === 0) {
    // 검색 결과 없음 → match_failed 1건 생성
    return [
      {
        id: generateQueueId(0),
        sourceType: "search",
        rawInput: searchInput,
        parsedItemName: searchInput,
        manufacturer: null,
        catalogNumber: null,
        spec: null,
        quantity: 1,
        unit: null,
        confidence: "low",
        status: "match_failed",
        matchCandidates: [],
        selectedProduct: null,
        needsReview: true,
        reviewReason: "no_match",
        addedAt: new Date().toISOString(),
      },
    ];
  }

  return results.map((result, index) =>
    mapSearchResultToQueueItem(searchInput, result, index)
  );
}

// ── reviewReason 한글 라벨 매핑 ──
export const REVIEW_REASON_LABELS: Record<ReviewReasonCode, string> = {
  no_match: "매칭 결과 없음",
  candidate_missing: "후보 제품 없음",
  low_relevance: "관련성 낮음",
  multiple_candidates: "후보 복수 — 비교 필요",
  close_match_scores: "유사 후보 충돌",
  comparison_recommended: "비교 권장",
  manufacturer_missing: "제조사 정보 없음",
  catalog_missing: "카탈로그 번호 없음",
  spec_unclear: "규격 정보 불명확",
  unit_missing: "단위 정보 없음",
  quantity_inferred: "수량 추정값",
  packaging_unclear: "포장 단위 불명확",
  name_missing: "품목명 누락",
};
