/**
 * AI Suggestion Engine — P1 반자동 운영 레이어
 *
 * 모든 문구는 행동 방향형. 설명하지 않고 다음 행동을 보여준다.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type AiSuggestionScope = "sourcing_summary" | "compare_recommendation" | "request_draft";
export type AiSuggestionStatus = "generated" | "accepted" | "edited" | "dismissed";

export type AiSuggestionAction =
  | { id: string; type: "apply_compare_candidates"; label: string; payload: { itemIds: string[] } }
  | { id: string; type: "apply_request_candidates"; label: string; payload: { itemIds: string[] } }
  | { id: string; type: "apply_selected_decision"; label: string; payload: { itemId: string } }
  | { id: string; type: "apply_request_draft_patch"; label: string; payload: { supplierId: string; patch: Record<string, unknown> } }
  | { id: string; type: "open_review"; label: string; payload?: Record<string, never> }
  | { id: string; type: "dismiss"; label: string; payload?: Record<string, never> };

export interface AiSuggestionReason {
  id: string;
  label: string;
  type: "positive" | "warning" | "missing" | "difference";
}

export interface AiSuggestionPreview {
  beforeLabel?: string;
  afterLabel?: string;
  summary?: string;
}

export interface AiSuggestion {
  id: string;
  scope: AiSuggestionScope;
  targetId: string;
  contextHash: string;
  title: string;
  message: string;
  actions: AiSuggestionAction[];
  status: AiSuggestionStatus;
  confidence: number; // 0-1
  reasons?: AiSuggestionReason[];
  preview?: AiSuggestionPreview;
  sourceContext: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ── Backward compat aliases ──
export type SuggestionScope = AiSuggestionScope;
export type SuggestionStatus = AiSuggestionStatus;
export type SuggestionAction = AiSuggestionAction;
export type AISuggestion = AiSuggestion;
export type Confidence = "low" | "medium" | "high";
/** @deprecated */ export type SuggestionType = AiSuggestionScope;

// ── Suggestion Orchestration Layer ────────────────────────────────────────

/** contextHash: 현재 화면 상태를 대표하는 해시 */
export function computeContextHash(scope: SuggestionScope, inputs: Record<string, unknown>): string {
  const sorted = JSON.stringify(inputs, Object.keys(inputs).sort());
  // Simple hash for dedup (not crypto)
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    hash = ((hash << 5) - hash + sorted.charCodeAt(i)) | 0;
  }
  return `${scope}_${Math.abs(hash).toString(36)}`;
}

/** Suggestion lifecycle store — 화면당 1개 active suggestion 관리 */
export interface SuggestionStore {
  active: AISuggestion | null;
  contextHash: string | null;
  dismissedHashes: Set<string>;
  acceptedHashes: Set<string>;
}

export function createSuggestionStore(): SuggestionStore {
  return { active: null, contextHash: null, dismissedHashes: new Set(), acceptedHashes: new Set() };
}

/**
 * shouldRegenerate — contextHash가 바뀌었고, dismissed/accepted가 아닌 경우에만 true
 */
export function shouldRegenerate(store: SuggestionStore, newHash: string): boolean {
  if (store.contextHash === newHash) return false; // 같은 context → 재생성 금지
  if (store.dismissedHashes.has(newHash)) return false; // 이미 dismissed
  if (store.acceptedHashes.has(newHash)) return false; // 이미 accepted
  return true;
}

/**
 * acceptSuggestion — suggestion 수락 처리
 */
export function acceptSuggestion(store: SuggestionStore): SuggestionStore {
  if (!store.active || !store.contextHash) return store;
  trackSuggestionEvent("suggestion_accepted", store.active, store.contextHash);
  return {
    ...store,
    active: { ...store.active, status: "accepted", updatedAt: new Date().toISOString() },
    acceptedHashes: new Set([...store.acceptedHashes, store.contextHash]),
  };
}

/**
 * dismissSuggestion — suggestion 무시 처리
 */
export function dismissSuggestion(store: SuggestionStore): SuggestionStore {
  if (!store.active || !store.contextHash) return store;
  trackSuggestionEvent("suggestion_dismissed", store.active, store.contextHash);
  return {
    ...store,
    active: null,
    dismissedHashes: new Set([...store.dismissedHashes, store.contextHash]),
  };
}

/**
 * invalidateSuggestion — source 변경으로 기존 suggestion 무효화
 */
export function invalidateSuggestion(store: SuggestionStore): SuggestionStore {
  return { ...store, active: null, contextHash: null };
}

// ── Suggestion Priority ──────────────────────────────────────────────────

export type SourcingSuggestionType = "request_first" | "compare_first" | "mixed_flow" | "warning";
export type CompareSuggestionType = "request_handoff" | "selection_prompt" | "dual_request" | "need_more_review";
export type RequestSuggestionType = "missing_check" | "draft_update" | "draft_create" | "ready";

/** sourcing 우선순위: request_first > compare_first > mixed_flow > warning */
const SOURCING_PRIORITY: SourcingSuggestionType[] = ["request_first", "compare_first", "mixed_flow", "warning"];
/** compare 우선순위: request_handoff > selection_prompt > dual_request > need_more_review */
const COMPARE_PRIORITY: CompareSuggestionType[] = ["request_handoff", "selection_prompt", "dual_request", "need_more_review"];
/** request 우선순위: missing_check > draft_update > draft_create > ready */
const REQUEST_PRIORITY: RequestSuggestionType[] = ["missing_check", "draft_update", "draft_create", "ready"];

export function pickHighestPriority<T extends string>(candidates: T[], priorityOrder: T[]): T | null {
  for (const p of priorityOrder) {
    if (candidates.includes(p)) return p;
  }
  return candidates[0] || null;
}

export { SOURCING_PRIORITY, COMPARE_PRIORITY, REQUEST_PRIORITY };

// ── Telemetry ────────────────────────────────────────────────────────────

type SuggestionEventType = "suggestion_generated" | "suggestion_viewed" | "suggestion_accepted" | "suggestion_dismissed" | "suggestion_edited";

export function trackSuggestionEvent(
  event: SuggestionEventType,
  suggestion: AISuggestion | null,
  contextHash: string | null,
  action?: string,
): void {
  if (typeof window === "undefined") return;
  try {
    // analytics integration point — trackEvent 연동 시 여기 확장
    const payload = {
      event,
      scope: suggestion?.scope,
      contextHash,
      suggestionType: suggestion?.title,
      targetId: suggestion?.targetId,
      action,
      timestamp: new Date().toISOString(),
    };
    // console.debug("[AI Telemetry]", payload);
    // 향후: trackEvent(event, payload);
  } catch {
    // silent
  }
}

// ── P1-A: Search Next Step Summary ─────────────────────────────────────────

export interface SearchSummaryInput {
  query: string;
  products: any[];
  compareIds: string[];
  quoteItemIds: string[];
}

export interface SearchSummaryLine {
  text: string;
  signal: "info" | "compare" | "request" | "caution";
}

export function generateSearchSummary(input: SearchSummaryInput): SearchSummaryLine[] {
  const { products, compareIds, quoteItemIds } = input;
  const lines: SearchSummaryLine[] = [];
  if (products.length === 0) return lines;

  // 가격 분석
  const prices = products
    .map((p: any) => p.vendors?.[0]?.priceInKRW)
    .filter((p: number | undefined): p is number => !!p && p > 0);

  if (prices.length >= 2) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const diffPct = Math.round(((max - min) / min) * 100);
    if (diffPct > 30) {
      lines.push({ text: `비교 권장 · 가격차 ${diffPct}%`, signal: "compare" });
    }
  }

  // 비교 적합 후보
  const compareCandidates = products.filter((p: any) => {
    return p.vendors?.[0]?.priceInKRW > 0 && !compareIds.includes(p.id);
  });

  if (compareCandidates.length >= 2 && compareIds.length === 0) {
    lines.push({ text: `비교 권장 · 후보 ${Math.min(compareCandidates.length, 5)}개`, signal: "compare" });
  }

  // 납기 불완전
  const missingLeadTime = products.filter((p: any) => {
    const vendors = p.vendors || [];
    return vendors.length > 0 && !vendors[0]?.leadTime;
  });
  if (missingLeadTime.length > 0) {
    lines.push({ text: `납기 확인 필요 · ${missingLeadTime.length}개`, signal: "caution" });
  }

  // 공급사 다양성
  const vendorNames = [...new Set(products.flatMap((p: any) => (p.vendors || []).map((v: any) => v.vendor?.name)).filter(Boolean))];
  if (vendorNames.length === 1 && products.length > 1) {
    lines.push({ text: "공급사 확인 필요 · 단일 공급사", signal: "caution" });
  }

  // 이미 비교 중
  if (compareIds.length >= 2 && quoteItemIds.length === 0) {
    lines.push({ text: `비교 ${compareIds.length}개 준비 · 비교 시작`, signal: "compare" });
  }

  // 견적 담기 완료
  if (quoteItemIds.length > 0) {
    lines.push({ text: `바로 요청 가능 · ${quoteItemIds.length}건`, signal: "request" });
  }

  return lines.slice(0, 3);
}

// ── P1-A2: Dock-level Next Action Recommendation ──────────────────────────

export interface DockRecommendationInput {
  compareIds: string[];
  quoteItemIds: string[];
  products: any[];
}

export function generateDockRecommendation(input: DockRecommendationInput): string | null {
  const { compareIds, quoteItemIds, products } = input;

  const compareProducts = products.filter((p: any) => compareIds.includes(p.id));
  const compareCategories = [...new Set(compareProducts.map((p: any) => p.category).filter(Boolean))];
  const requestProducts = products.filter((p: any) => quoteItemIds.includes(p.id));
  const missingLeadTime = requestProducts.filter((p: any) => !(p.vendors?.[0]?.leadTime));

  if (compareIds.length >= 2 && quoteItemIds.length > 0) {
    return "비교 후 요청 권장";
  }
  if (compareIds.length >= 2 && quoteItemIds.length === 0) {
    if (compareCategories.length > 1) return "규격 확인 후 비교 시작";
    return "비교 시작";
  }
  if (quoteItemIds.length > 0) {
    if (missingLeadTime.length > 0) return `납기 확인 필요 · ${missingLeadTime.length}건`;
    return "요청서 생성으로 이동";
  }
  if (compareIds.length === 1) {
    return "비교 후보 1개 더 추가";
  }
  return null;
}

// ── P1-B: Compare Decision Summary ─────────────────────────────────────────

export interface CompareDecisionInput {
  products: any[];
  scenario: string;
  getAverageLeadTime: (product: any) => number;
  quoteItemsCount: number;
}

export interface CompareDecisionSummary {
  recommendation: string;
  details: string[];
  nextAction: string;
  confidence: Confidence;
}

export function generateCompareDecision(input: CompareDecisionInput): CompareDecisionSummary | null {
  const { products, scenario, getAverageLeadTime, quoteItemsCount } = input;
  if (products.length < 2) return null;

  const details: string[] = [];
  let recommendation = "";
  let nextAction = "";
  let confidence: Confidence = "medium";

  const priced = products
    .map((p: any) => ({ product: p, price: p.vendors?.[0]?.priceInKRW || 0 }))
    .filter((x) => x.price > 0)
    .sort((a, b) => a.price - b.price);

  const withLeadTime = products
    .map((p: any) => ({ product: p, leadTime: getAverageLeadTime(p) }))
    .filter((x) => x.leadTime > 0)
    .sort((a, b) => a.leadTime - b.leadTime);

  const cheapest = priced[0];
  const fastest = withLeadTime[0];

  if (scenario === "cost" && cheapest) {
    const name = cheapest.product.name?.substring(0, 18) || "—";
    recommendation = `기준안으로 설정 · ${name}`;
    if (priced.length >= 2) {
      const diff = Math.round(((priced[priced.length - 1].price - cheapest.price) / cheapest.price) * 100);
      details.push(`최저가 ₩${cheapest.price.toLocaleString()} · ${diff}% 차이`);
    }
    if (fastest && fastest.product.id !== cheapest.product.id) {
      details.push(`납기 우선이면 ${fastest.product.name?.substring(0, 12)} (${fastest.leadTime}일)`);
    }
    confidence = priced.length >= 2 ? "high" : "medium";
  } else if (scenario === "leadtime" && fastest) {
    const name = fastest.product.name?.substring(0, 18) || "—";
    recommendation = `기준안으로 설정 · ${name}`;
    details.push(`납기 ${fastest.leadTime}일`);
    if (cheapest && cheapest.product.id !== fastest.product.id) {
      details.push(`가격 우선이면 ${cheapest.product.name?.substring(0, 12)}`);
    }
    confidence = withLeadTime.length >= 2 ? "high" : "medium";
  } else if (scenario === "spec_match") {
    recommendation = "현재 선택안 유지";
    const categories = [...new Set(products.map((p: any) => p.category).filter(Boolean))];
    if (categories.length > 1) {
      details.push(`카테고리 ${categories.length}개 · 규격 직접 확인`);
    }
    confidence = "medium";
  } else {
    recommendation = "현재 선택안 유지";
    if (cheapest) details.push(`참고: 최저가 ${cheapest.product.name?.substring(0, 12)} ₩${cheapest.price.toLocaleString()}`);
    confidence = "low";
  }

  if (quoteItemsCount > 0) {
    nextAction = `요청 단계로 이동 · ${quoteItemsCount}건`;
  } else if (priced.length >= 2) {
    nextAction = "2개 함께 요청 권장";
  } else if (cheapest) {
    nextAction = "비교 후 요청 권장";
  } else {
    nextAction = "요청 전환 권장 · 가격 미확인";
  }

  return { recommendation, details, nextAction, confidence };
}

// ── P1-C: Request Draft Generator ──────────────────────────────────────────

export interface RequestDraftInput {
  vendorName: string;
  items: Array<{
    productName: string;
    quantity: number;
    specification?: string;
    catalogNumber?: string;
  }>;
  purpose?: string;
}

export interface RequestDraft {
  message: string;
  checklist: Array<{ label: string; status: "included" | "missing" }>;
  confidence: Confidence;
}

export function generateRequestDraft(input: RequestDraftInput): RequestDraft {
  const { vendorName, items, purpose } = input;

  const itemLines = items.map((item, i) =>
    `${i + 1}. ${item.productName}${item.catalogNumber ? ` (Cat. ${item.catalogNumber})` : ""} — ${item.quantity}개`
  ).join("\n");

  const purposeLine = purpose || "연구용 시약/소모품 구매";

  const message = [
    `${vendorName} 담당자님께,`,
    ``,
    `아래 품목에 대한 견적을 요청드립니다.`,
    ``,
    `■ 요청 목적: ${purposeLine}`,
    ``,
    `■ 요청 품목:`,
    itemLines,
    ``,
    `■ 납기 요청: 가능한 빠른 납기 일정을 안내해 주시기 바랍니다.`,
    ``,
    `■ 대체 가능 여부: 요청 품목과 동등 규격의 대체품이 있을 경우 함께 안내해 주시면 검토하겠습니다.`,
    ``,
    `■ 첨부: 별도 첨부 문서가 있을 경우 회신 시 함께 전달해 주시기 바랍니다.`,
    ``,
    `감사합니다.`,
  ].join("\n");

  const checklist: RequestDraft["checklist"] = [
    { label: "요청 목적", status: purpose ? "included" : "missing" },
    { label: "품목 목록", status: items.length > 0 ? "included" : "missing" },
    { label: "납기 요청", status: "included" },
    { label: "대체 가능 여부 문의", status: "included" },
    { label: "첨부 안내", status: "included" },
  ];

  return {
    message,
    checklist,
    confidence: items.length > 0 ? "high" : "low",
  };
}
