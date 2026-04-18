/**
 * Step 1 공통 Review Queue + Step 2/3 Handoff Contract
 *
 * 모든 입력 방식(검색/엑셀/프로토콜)은 ReviewQueueItem으로 정규화.
 * 승인된 항목만 Step 2(비교) / Step 3(견적)으로 handoff.
 * handoff 후에도 source lineage + reviewReason 유지.
 */

// ── 입력 소스 ──
export type SourceType = "search" | "excel" | "protocol";

// ── 검토 상태 ──
export type ReviewStatus =
  | "confirmed"        // 확정 가능 — 바로 비교/견적으로 이동 가능
  | "needs_review"     // 검토 필요 — 사용자 확인 후 진행
  | "match_failed"     // 매칭 실패 — 수동 선택 필요
  | "compare_needed"   // 비교 필요 — Step 2 compare queue 대상
  | "approved"         // 승인 완료 — Step 3 견적 대상
  | "excluded";        // 제외됨

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
  id: string;
  sourceType: SourceType;
  rawInput: string;
  parsedItemName: string;
  manufacturer: string | null;
  catalogNumber: string | null;
  spec: string | null;
  quantity: number | null;
  unit: string | null;
  confidence: ConfidenceLevel;
  status: ReviewStatus;
  matchCandidates: MatchCandidate[];
  selectedProduct: MatchCandidate | null;
  needsReview: boolean;
  reviewReason: string | null;
  addedAt: string; // ISO

  // ── downstream link (중복 전송 방지) ──
  linkedCompareItemId?: string | null;
  linkedQuoteDraftItemId?: string | null;
}

// ── Row Action ──
export type ReviewAction =
  | "approve"
  | "edit"
  | "exclude"
  | "add_to_compare"
  | "add_to_quote";

// ── reviewReason 내부 코드 → 사용자 문구 매핑 ──
export const REVIEW_REASON_LABELS: Record<string, string> = {
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
  packaging_unclear: "포장 단위 확인 필요",
  spec_mismatch: "원문 규격과 후보 규격이 다를 수 있습니다",
  protocol_to_product_gap: "문서 표현과 실제 구매 단위 연결 검토가 필요합니다",
  no_match: "일치하는 후보를 찾지 못했습니다",
  evidence_only: "근거 문장은 있으나 제품 후보를 특정하지 못했습니다",
  row_empty: "유효한 입력 행이 아닙니다",
};

// ═══════════════════════════════════════════════════
// Step 2: Compare Queue Item
// ═══════════════════════════════════════════════════

export type CompareStatus =
  | "pending_comparison"    // 비교 대기
  | "selection_needed"      // 후보 선택 필요
  | "selection_confirmed"   // 선택 확정
  | "removed";              // 제거됨

export interface CompareQueueItem {
  compareItemId: string;
  sourceQueueItemId: string;
  sourceType: SourceType;
  parsedItemName: string;
  normalizedNeed: string;
  candidateProducts: MatchCandidate[];
  selectedProductId: string | null;
  manufacturer: string | null;
  catalogNumber: string | null;
  spec: string | null;
  quantity: number | null;
  unit: string | null;
  comparisonReason: string | null;
  reviewReason: string | null;
  confidence: ConfidenceLevel;
  sourceContext: string;
  evidenceSummary: string | null;
  status: CompareStatus;
}

// ═══════════════════════════════════════════════════
// Step 3: Quote Draft Item
// ═══════════════════════════════════════════════════

export type QuoteDraftStatus =
  | "draft_ready"             // 견적 요청 가능
  | "missing_required_fields" // 필수 필드 누락
  | "awaiting_review"         // 추가 검토 대기
  | "removed";                // 제거됨

export interface QuoteDraftItem {
  quoteDraftItemId: string;
  sourceQueueItemId: string;
  sourceType: SourceType;
  selectedProductId: string;
  parsedItemName: string;
  manufacturer: string | null;
  catalogNumber: string | null;
  spec: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
  sourceContext: string;
  evidenceSummary: string | null;
  budgetHint: string | null;
  inventoryHint: string | null;
  status: QuoteDraftStatus;
}

// ═══════════════════════════════════════════════════
// Handoff: Step 1 → Step 2 (Compare)
// ═══════════════════════════════════════════════════

/** Step 2로 보낼 수 있는지 판정 */
export function canHandoffToCompare(item: ReviewQueueItem): boolean {
  if (item.status === "excluded" || item.status === "match_failed") return false;
  if (!item.parsedItemName) return false;
  if ((item.matchCandidates?.length ?? 0) < 1) return false;
  // compare_needed는 기본 Step 2 대상
  if (item.status === "compare_needed") return true;
  // approved 또는 confirmed도 후보가 있으면 compare 가능
  if (item.status === "approved" || item.status === "confirmed") return true;
  // needs_review도 후보가 있고 사용자가 명시적으로 요청 시 가능
  if (item.status === "needs_review" && (item.matchCandidates?.length ?? 0) >= 1) return true;
  return false;
}

/** Review Queue Item → Compare Queue Item 변환 */
export function mapQueueItemToCompareItem(item: ReviewQueueItem): CompareQueueItem {
  const normalizedNeed = [item.parsedItemName, item.spec].filter(Boolean).join(" · ");
  const sourceContext = item.sourceType === "search"
    ? `검색어: "${item.rawInput}"`
    : item.sourceType === "excel"
    ? `엑셀: ${item.rawInput}`
    : `프로토콜: ${item.rawInput}`;

  return {
    compareItemId: `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceQueueItemId: item.id,
    sourceType: item.sourceType,
    parsedItemName: item.parsedItemName,
    normalizedNeed,
    candidateProducts: item.matchCandidates,
    selectedProductId: item.selectedProduct?.productId ?? null,
    manufacturer: item.manufacturer,
    catalogNumber: item.catalogNumber,
    spec: item.spec,
    quantity: item.quantity,
    unit: item.unit,
    comparisonReason: item.matchCandidates.length > 1 ? "후보 비교 필요" : null,
    reviewReason: item.reviewReason,
    confidence: item.confidence,
    sourceContext,
    evidenceSummary: null, // protocol source일 때 evidence summary 가능
    status: item.matchCandidates.length > 1 ? "selection_needed" : "pending_comparison",
  };
}

// ═══════════════════════════════════════════════════
// Handoff: Step 1 → Step 3 (Quote Draft)
// ═══════════════════════════════════════════════════

/** Step 3로 보낼 수 있는지 판정 — 가장 엄격한 조건 */
export function canHandoffToQuote(item: ReviewQueueItem): boolean {
  if (item.status !== "approved" && item.status !== "confirmed") return false;
  if (!item.selectedProduct) return false;
  if (item.quantity == null || item.quantity <= 0) return false;
  if (!item.unit) return false;
  if (!item.parsedItemName) return false;
  return true;
}

/** Review Queue Item → Quote Draft Item 변환 */
export function mapQueueItemToQuoteDraftItem(item: ReviewQueueItem): QuoteDraftItem | null {
  if (!item.selectedProduct || item.quantity == null || !item.unit) return null;

  const sourceContext = item.sourceType === "search"
    ? `검색어: "${item.rawInput}"`
    : item.sourceType === "excel"
    ? `엑셀: ${item.rawInput}`
    : `프로토콜: ${item.rawInput}`;

  const missingFields: string[] = [];
  if (!item.manufacturer && !item.catalogNumber) missingFields.push("제조사/카탈로그 번호 누락");
  if (!item.spec) missingFields.push("규격 누락");

  return {
    quoteDraftItemId: `qd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceQueueItemId: item.id,
    sourceType: item.sourceType,
    selectedProductId: item.selectedProduct.productId,
    parsedItemName: item.parsedItemName,
    manufacturer: item.manufacturer,
    catalogNumber: item.catalogNumber,
    spec: item.spec,
    quantity: item.quantity,
    unit: item.unit,
    notes: item.rawInput,
    sourceContext,
    evidenceSummary: null,
    budgetHint: null,
    inventoryHint: null,
    status: missingFields.length > 0 ? "missing_required_fields" : "draft_ready",
  };
}

// ── 기존 호환 HandoffItem ──
export interface HandoffItem {
  reviewItemId: string;
  productId: string;
  productName: string;
  brand: string | null;
  catalogNumber: string | null;
  quantity: number | null;
  unit: string | null;
  spec: string | null;
  sourceType: SourceType;
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

// ═══════════════════════════════════════════════════
// Step 2 → Step 3 Handoff (Compare → Quote Draft)
// ═══════════════════════════════════════════════════

/** Compare item을 Step 3로 보낼 수 있는지 판정 */
export function canPromoteCompareItemToQuote(item: CompareQueueItem): boolean {
  if (item.status !== "selection_confirmed") return false;
  if (!item.selectedProductId) return false;
  if (item.quantity == null || item.quantity <= 0) return false;
  if (!item.unit) return false;
  if (!item.parsedItemName) return false;
  return true;
}

/** Compare Queue Item → Quote Draft Item 변환 */
export function mapCompareItemToQuoteDraftItem(item: CompareQueueItem): QuoteDraftItem | null {
  if (!item.selectedProductId || item.quantity == null || !item.unit) return null;

  const missingFields: string[] = [];
  if (!item.manufacturer && !item.catalogNumber) missingFields.push("제조사/카탈로그 번호 누락");
  if (!item.spec) missingFields.push("규격 누락");

  return {
    quoteDraftItemId: `qd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceQueueItemId: item.sourceQueueItemId,
    sourceType: item.sourceType,
    selectedProductId: item.selectedProductId,
    parsedItemName: item.parsedItemName,
    manufacturer: item.manufacturer,
    catalogNumber: item.catalogNumber,
    spec: item.spec,
    quantity: item.quantity,
    unit: item.unit,
    notes: `${item.sourceContext}${item.comparisonReason ? ` / ${item.comparisonReason}` : ""}`,
    sourceContext: item.sourceContext,
    evidenceSummary: item.evidenceSummary,
    budgetHint: null,
    inventoryHint: null,
    status: missingFields.length > 0 ? "missing_required_fields" : "draft_ready",
  };
}

// ═══════════════════════════════════════════════════
// Step 3 Quote Draft 상태 판정 + 제출 가능 함수
// ═══════════════════════════════════════════════════

/** Quote Draft 상태 자동 판정 */
export function evaluateQuoteDraftStatus(item: QuoteDraftItem): QuoteDraftStatus {
  if (item.status === "removed") return "removed";
  if (!item.selectedProductId || !item.parsedItemName || !item.quantity || !item.unit) {
    return "missing_required_fields";
  }
  // 예산/재고 경고가 있으면 awaiting_review
  if (item.budgetHint === "budgetCheckRequired" || item.inventoryHint === "possibleDuplicatePurchase") {
    return "awaiting_review";
  }
  return "draft_ready";
}

/** 단건 제출 가능 여부 */
export function canSubmitQuoteDraftItem(item: QuoteDraftItem): boolean {
  return item.status === "draft_ready" && !!item.selectedProductId && !!item.quantity && !!item.unit;
}

/** 일괄 제출 가능 여부 — 모든 항목이 제출 가능해야 true */
export function canBulkSubmitQuoteDraftItems(items: QuoteDraftItem[]): boolean {
  return items.length > 0 && items.every(canSubmitQuoteDraftItem);
}

/** 경고 메시지 수집 */
export function mapQuoteDraftWarnings(item: QuoteDraftItem): string[] {
  const warnings: string[] = [];
  if (!item.selectedProductId) warnings.push("제품 선택이 필요합니다");
  if (!item.quantity) warnings.push("수량을 입력해주세요");
  if (!item.unit) warnings.push("단위를 입력해주세요");
  if (!item.manufacturer && !item.catalogNumber) warnings.push("제조사 또는 카탈로그 번호가 없습니다");
  if (!item.spec) warnings.push("규격 정보가 없습니다");
  if (item.budgetHint === "budgetCheckRequired") warnings.push("예산 확인이 필요합니다");
  if (item.budgetHint === "noBudgetContext") warnings.push("예산 정보가 연결되지 않았습니다");
  if (item.inventoryHint === "possibleDuplicatePurchase") warnings.push("동일 또는 유사 재고가 존재할 수 있습니다");
  if (item.inventoryHint === "inventoryCheckRequired") warnings.push("현재 보유 재고와 대조가 필요합니다");
  return warnings;
}

// ── Bulk 필터 헬퍼 ──
export function filterEligibleCompareItems(items: ReviewQueueItem[]): ReviewQueueItem[] {
  return items.filter(canHandoffToCompare);
}

export function filterEligibleQuoteItems(items: ReviewQueueItem[]): ReviewQueueItem[] {
  return items.filter(canHandoffToQuote);
}

export function filterEligibleCompareToQuote(items: CompareQueueItem[]): CompareQueueItem[] {
  return items.filter(canPromoteCompareItemToQuote);
}

export function filterSubmittableQuoteDrafts(items: QuoteDraftItem[]): QuoteDraftItem[] {
  return items.filter(canSubmitQuoteDraftItem);
}

// ═══════════════════════════════════════════════════
// Queue Priority / Blocked / SLA Model
// ═══════════════════════════════════════════════════

/** 우선순위 — 정렬 기준 */
export type QueuePriority = "urgent" | "today" | "normal" | "low";

/** 차단 여부 + 사유 */
export interface BlockedInfo {
  isBlocked: boolean;
  reason: string | null;       // "필수 문서 누락" / "선행 승인 미완료"
  unblockAction: string | null; // "문서 업로드" / "승인 요청"
  unblockHref: string | null;
}

/** SLA / 기한 정보 */
export interface DueInfo {
  dueDate: string | null;        // ISO
  isOverdue: boolean;
  overdueLabel: string | null;   // "24시간 초과" / "3일 지연"
  dueLabel: string | null;       // "오늘 18:00 마감" / "D-2"
}

/** Queue Summary — 상단 backlog 요약 */
export interface QueueSummary {
  total: number;
  urgent: number;
  todayRecommended: number;
  blocked: number;
  overdue: number;
}

/** Queue item에 우선순위/차단/기한 신호를 부착하는 wrapper */
export interface QueueItemSignals {
  priority: QueuePriority;
  blocked: BlockedInfo;
  due: DueInfo;
}

/** 우선순위 점수 계산 — 정렬용 */
export function computePriorityScore(signals: QueueItemSignals): number {
  let score = 0;
  // 우선순위 기본 점수
  if (signals.priority === "urgent") score += 1000;
  else if (signals.priority === "today") score += 500;
  else if (signals.priority === "normal") score += 100;
  // overdue 가산
  if (signals.due.isOverdue) score += 300;
  // blocked 감산 (처리 가능한 것이 먼저)
  if (signals.blocked.isBlocked) score -= 50;
  return score;
}

/** Queue items 정렬 — 운영 우선순위 기준 */
export function sortByPriority<T extends { signals: QueueItemSignals }>(items: T[]): T[] {
  return [...items].sort((a, b) => computePriorityScore(b.signals) - computePriorityScore(a.signals));
}

/** Queue Summary 계산 */
export function computeQueueSummary<T extends { signals: QueueItemSignals }>(items: T[]): QueueSummary {
  return {
    total: items.length,
    urgent: items.filter(i => i.signals.priority === "urgent").length,
    todayRecommended: items.filter(i => i.signals.priority === "today" || i.signals.priority === "urgent").length,
    blocked: items.filter(i => i.signals.blocked.isBlocked).length,
    overdue: items.filter(i => i.signals.due.isOverdue).length,
  };
}

// ═══════════════════════════════════════════════════
// Drill-down / Cross-page Context
// ═══════════════════════════════════════════════════

/** 페이지 간 문맥 전달 객체 */
export interface DrilldownContext {
  sourcePageId: string;          // "dashboard" / "approval-queue" / "inventory"
  sourceLabel: string;           // "승인 대기 큐" / "재고 부족 알림"
  dataFilters: Record<string, string>; // { status: "pending", urgency: "high" }
  viewContext: {
    sort?: string;
    tab?: string;
    page?: number;
    density?: string;
  };
  returnHref: string;            // 복귀 URL
  returnLabel: string;           // "승인 대기 큐로 돌아가기"
}
