/**
 * Step 1 공통 Review Queue — 직접 검색 / 엑셀 업로드 / 프로토콜 업로드가 공유하는 item schema
 *
 * 모든 입력 방식은 ReviewQueueItem으로 정규화되어 review queue에 적재된다.
 * 승인된 항목만 Step 2(비교) / Step 3(견적)으로 handoff된다.
 */

// ── 입력 소스 ──
export type SourceType = "search" | "excel" | "protocol";

// ── 검토 상태 ──
export type ReviewStatus =
  | "confirmed"      // 확정 가능 — 바로 비교/견적으로 이동 가능
  | "needs_review"   // 검토 필요 — 사용자 확인 후 진행
  | "match_failed"   // 매칭 실패 — 수동 선택 필요
  | "excluded";      // 제외됨 — 사용자가 명시적으로 제외

// ── confidence 수준 ──
export type ConfidenceLevel = "high" | "medium" | "low";

// ── 매칭 후보 ──
export interface MatchCandidate {
  productId: string;
  productName: string;
  brand: string | null;
  catalogNumber: string | null;
  score: number; // 0~1
}

// ── 핵심: Review Queue Item ──
export interface ReviewQueueItem {
  /** 고유 ID (uuid) */
  id: string;

  /** 입력 소스 */
  sourceType: SourceType;

  /** 원본 입력값 (검색어, 엑셀 행 텍스트, 프로토콜 추출 텍스트) */
  rawInput: string;

  /** 파싱된 품목명 */
  parsedItemName: string;

  /** 파싱된 제조사 */
  manufacturer: string | null;

  /** 파싱된 카탈로그 번호 */
  catalogNumber: string | null;

  /** 파싱된 규격 */
  spec: string | null;

  /** 필요 수량 */
  quantity: number | null;

  /** 단위 */
  unit: string | null;

  /** AI confidence */
  confidence: ConfidenceLevel;

  /** 검토 상태 */
  status: ReviewStatus;

  /** 매칭 후보 목록 (score 내림차순) */
  matchCandidates: MatchCandidate[];

  /** 사용자가 최종 선택한 제품 */
  selectedProduct: MatchCandidate | null;

  /** 검토가 필요한 이유 */
  needsReview: boolean;
  reviewReason: string | null;

  /** 타임스탬프 */
  addedAt: string; // ISO
}

// ── Row Action ──
export type ReviewAction =
  | "approve"           // 승인 → status: confirmed
  | "edit"              // 수정 → 사용자가 필드 편집
  | "exclude"           // 제외 → status: excluded
  | "add_to_compare"    // 비교 리스트에 담기 → Step 2
  | "add_to_quote";     // 견적 초안에 담기 → Step 3

// ── Step 2/3 Handoff Contract ──
export interface HandoffItem {
  /** review queue item ID */
  reviewItemId: string;

  /** 확정된 제품 */
  productId: string;
  productName: string;
  brand: string | null;
  catalogNumber: string | null;

  /** 수량/규격 */
  quantity: number | null;
  unit: string | null;
  spec: string | null;

  /** 원본 소스 */
  sourceType: SourceType;
}

/**
 * Handoff 규칙:
 * - selectedProduct가 확정된 항목만 Step 2 비교로 이동 가능
 * - quantity/spec 검토 완료 항목만 Step 3 견적 가능
 * - status === "needs_review" 또는 "match_failed" 항목은 Step 1에 남김
 * - status === "excluded" 항목은 handoff 대상에서 제외
 */
export function canHandoffToCompare(item: ReviewQueueItem): boolean {
  return item.status === "confirmed" && item.selectedProduct !== null;
}

export function canHandoffToQuote(item: ReviewQueueItem): boolean {
  return (
    item.status === "confirmed" &&
    item.selectedProduct !== null &&
    item.quantity !== null &&
    item.quantity > 0
  );
}

export function toHandoffItem(item: ReviewQueueItem): HandoffItem | null {
  if (!item.selectedProduct) return null;
  return {
    reviewItemId: item.id,
    productId: item.selectedProduct.productId,
    productName: item.selectedProduct.productName,
    brand: item.selectedProduct.brand,
    catalogNumber: item.selectedProduct.catalogNumber,
    quantity: item.quantity,
    unit: item.unit,
    spec: item.spec,
    sourceType: item.sourceType,
  };
}
