/**
 * AI Suggestion Builders — 화면별 deterministic suggestion 생성
 *
 * 실제 LLM 호출 없이 현재 app state 기반으로 생성.
 * 이번 단계는 "AI 엔진 완성"이 아니라 "반자동 suggestion operating surface 삽입".
 */
import type { AiSuggestion, AiSuggestionAction } from "./suggestion-engine";
import { buildSourcingContextHash, buildCompareContextHash, buildRequestContextHash } from "./context-hash";

function uid(): string {
  return `sg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ═══ A. Sourcing Builder ═══════════════════════════════════════════════════

export interface SourcingBuilderInput {
  query: string;
  products: Array<{ id: string; name: string; brand?: string; vendors?: Array<{ priceInKRW?: number }>; specification?: string }>;
  compareIds: string[];
  requestIds: string[];
  activeResultId: string | null;
}

export function buildSourcingSuggestion(input: SourcingBuilderInput): AiSuggestion | null {
  const { query, products, compareIds, requestIds, activeResultId } = input;
  if (!query || products.length === 0) return null;

  const contextHash = buildSourcingContextHash({
    query,
    resultCount: products.length,
    compareIds,
    requestIds,
    activeResultId,
  });

  // 이미 후보가 충분하면 제안 불필요
  if (compareIds.length >= 3 && requestIds.length >= 1) return null;

  const withPrice = products.filter(p => p.vendors?.[0]?.priceInKRW && p.vendors[0].priceInKRW > 0);
  const withoutPrice = products.filter(p => !p.vendors?.[0]?.priceInKRW || p.vendors[0].priceInKRW === 0);
  const notInCompare = withPrice.filter(p => !compareIds.includes(p.id));

  // 우선순위: request_first > compare_first > mixed_flow > warning
  let title: string;
  let message: string;
  let actions: AiSuggestionAction[] = [];
  let confidence = 0.7;

  if (withoutPrice.length >= 2 && compareIds.length === 0) {
    // request_first: 가격 미등록 항목이 많아 요청 전환 필요
    title = "요청 전환이 필요한 항목이 있습니다";
    message = `가격 미등록 ${withoutPrice.length}건은 견적 요청으로 전환하는 것이 적절합니다.`;
    const candidateIds = withoutPrice.slice(0, 3).map(p => p.id);
    actions = [
      { id: uid(), type: "apply_request_candidates", label: "요청 후보 담기", payload: { itemIds: candidateIds } },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.8;
  } else if (notInCompare.length >= 2 && compareIds.length < 2) {
    // compare_first: 비교 가능한 후보가 있음
    title = "비교 후보를 정리했습니다";
    message = `동일 규격 후보 ${Math.min(notInCompare.length, 3)}개를 비교 대상으로 묶는 것이 적절합니다.`;
    const candidateIds = notInCompare.slice(0, 3).map(p => p.id);
    actions = [
      { id: uid(), type: "apply_compare_candidates", label: "비교 후보 담기", payload: { itemIds: candidateIds } },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.75;
  } else if (compareIds.length >= 1 && withoutPrice.length >= 1) {
    // mixed_flow
    title = "비교 후 요청 전환이 적절합니다";
    message = `비교 후보 ${compareIds.length}개 유지 중. 납기 불확실 항목 ${withoutPrice.length}건은 요청 후보에 유지합니다.`;
    actions = [
      { id: uid(), type: "open_review", label: "검토" },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.6;
  } else if (products.length > 0 && withPrice.length < products.length) {
    // warning
    title = "납기 확인이 필요한 항목이 있습니다";
    message = `${products.length - withPrice.length}건의 가격/납기 정보가 불완전합니다.`;
    actions = [
      { id: uid(), type: "dismiss", label: "확인" },
    ];
    confidence = 0.5;
  } else {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: uid(),
    scope: "sourcing_summary",
    targetId: query,
    contextHash,
    title,
    message,
    actions,
    status: "generated",
    confidence,
    sourceContext: { query, productCount: products.length, compareCount: compareIds.length, requestCount: requestIds.length },
    createdAt: now,
    updatedAt: now,
  };
}

// ═══ B. Compare Builder ═══════════════════════════════════════════════════

export interface CompareBuilderInput {
  compareSessionId: string;
  products: Array<{ id: string; name: string; vendors?: Array<{ priceInKRW?: number; leadTimeDays?: number }> }>;
  compareMode: string;
  activeCompareItemId: string | null;
  selectedDecisionItemId: string | null;
  recommendedItemId: string | null;
}

export function buildCompareSuggestion(input: CompareBuilderInput): AiSuggestion | null {
  const { compareSessionId, products, compareMode, activeCompareItemId, selectedDecisionItemId, recommendedItemId } = input;
  if (products.length < 2) return null;

  const contextHash = buildCompareContextHash({
    compareSessionId,
    comparedItemIds: products.map(p => p.id),
    compareMode,
    activeCompareItemId,
    selectedDecisionItemId,
  });

  let title: string;
  let message: string;
  let actions: AiSuggestionAction[] = [];
  let confidence = 0.7;

  const recommended = recommendedItemId ? products.find(p => p.id === recommendedItemId) : null;
  const modeLabel = compareMode === "cost" ? "비용" : compareMode === "leadtime" ? "납기" : compareMode === "spec_match" ? "규격" : "수동";

  if (selectedDecisionItemId && recommendedItemId && selectedDecisionItemId !== recommendedItemId) {
    // selection_prompt: 추천과 기준안이 다름
    title = `${modeLabel} 기준 추천안과 현재 기준안이 다릅니다`;
    message = `현재 선택안은 유지 중입니다. ${modeLabel} 기준으로는 ${recommended?.name?.substring(0, 20) || "다른 항목"}이 유리합니다.`;
    actions = [
      { id: uid(), type: "apply_selected_decision", label: "현재 선택안 반영", payload: { itemId: recommendedItemId } },
      { id: uid(), type: "open_review", label: "요청 단계로 이동" },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.7;
  } else if (selectedDecisionItemId) {
    // request_handoff: 기준안이 정해졌으니 다음 단계로
    title = "요청 단계로 이동할 수 있습니다";
    message = `기준안이 설정되어 있습니다. 견적 요청 단계로 이동하세요.`;
    actions = [
      { id: uid(), type: "open_review", label: "요청 단계로 이동" },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.8;
  } else if (recommendedItemId) {
    // selection_prompt: 기준안 미선택
    title = `${modeLabel} 기준으로 ${recommended?.name?.substring(0, 20) || "A안"}이 유리합니다`;
    message = "기준안을 반영하면 요청 단계로 이동할 수 있습니다.";
    actions = [
      { id: uid(), type: "apply_selected_decision", label: "현재 선택안 반영", payload: { itemId: recommendedItemId } },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.75;
  } else {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: uid(),
    scope: "compare_recommendation",
    targetId: compareSessionId,
    contextHash,
    title,
    message,
    actions,
    status: "generated",
    confidence,
    sourceContext: { compareSessionId, compareMode, productCount: products.length, selectedDecisionItemId },
    createdAt: now,
    updatedAt: now,
  };
}

// ═══ C. Request Builder ═══════════════════════════════════════════════════

export interface RequestBuilderInput {
  requestAssemblyId: string;
  activeSupplierRequestId: string | null;
  vendorName: string;
  items: Array<{ productName: string; quantity: number; catalogNumber?: string }>;
  messageBody: string;
  missingFields: string[];
  leadTimeIncluded: boolean;
  substituteIncluded: boolean;
}

export function buildRequestSuggestion(input: RequestBuilderInput): AiSuggestion | null {
  const { requestAssemblyId, activeSupplierRequestId, vendorName, items, messageBody, missingFields, leadTimeIncluded, substituteIncluded } = input;
  if (!activeSupplierRequestId || items.length === 0) return null;

  const contextHash = buildRequestContextHash({
    requestAssemblyId,
    activeSupplierRequestId,
    missingFields,
    itemIds: items.map(i => i.productName),
    leadTimeIncluded,
    substituteIncluded,
  });

  let title: string;
  let message: string;
  let actions: AiSuggestionAction[] = [];
  let confidence = 0.7;

  // 우선순위: missing_check > draft_update > draft_create > ready
  if (missingFields.length > 0) {
    // missing_check
    title = "전송 전 확인이 필요합니다";
    const fieldLabels = missingFields.map(f =>
      f === "message_missing" ? "메시지" :
      f === "delivery_location_missing" ? "납품지" :
      f === "attachment_missing" ? "첨부파일" :
      f === "requester_missing" ? "담당자" : f
    );
    message = `누락 항목: ${fieldLabels.join(", ")}. 확인 후 전송 준비로 이동할 수 있습니다.`;
    actions = [
      { id: uid(), type: "open_review", label: "누락 확인" },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.85;
  } else if (!messageBody || messageBody.length < 20) {
    // draft_create
    title = "요청 초안을 준비했습니다";
    const draftParts: string[] = [];
    if (!leadTimeIncluded) draftParts.push("납기 문의");
    if (!substituteIncluded) draftParts.push("대체품 문의");
    message = draftParts.length > 0
      ? `${draftParts.join(", ")} 포함하여 초안을 생성할 수 있습니다.`
      : `${vendorName} 대상 ${items.length}건 초안을 생성할 수 있습니다.`;

    // 초안 patch 생성
    const draftMessage = generateSimpleDraft(vendorName, items, leadTimeIncluded, substituteIncluded);
    actions = [
      { id: uid(), type: "apply_request_draft_patch", label: "초안 적용", payload: { supplierId: activeSupplierRequestId, patch: { messageBody: draftMessage } } },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.75;
  } else if (messageBody.length >= 20 && missingFields.length === 0) {
    // ready
    title = "검토 후 전송";
    message = `${vendorName} 대상 ${items.length}건 요청이 준비되었습니다.`;
    actions = [
      { id: uid(), type: "open_review", label: "검토" },
      { id: uid(), type: "dismiss", label: "확인" },
    ];
    confidence = 0.9;
  } else {
    return null;
  }

  const now = new Date().toISOString();
  return {
    id: uid(),
    scope: "request_draft",
    targetId: activeSupplierRequestId,
    contextHash,
    title,
    message,
    actions,
    status: "generated",
    confidence,
    sourceContext: { requestAssemblyId, vendorName, itemCount: items.length, missingFields },
    createdAt: now,
    updatedAt: now,
  };
}

// ── Simple draft generator (deterministic, no LLM) ──
function generateSimpleDraft(
  vendorName: string,
  items: Array<{ productName: string; quantity: number; catalogNumber?: string }>,
  leadTimeIncluded: boolean,
  substituteIncluded: boolean,
): string {
  const lines: string[] = [];
  lines.push(`${vendorName} 담당자님께,`);
  lines.push("");
  lines.push("아래 품목에 대한 견적을 요청드립니다.");
  lines.push("");
  items.forEach((item, i) => {
    const cat = item.catalogNumber ? ` (${item.catalogNumber})` : "";
    lines.push(`${i + 1}. ${item.productName}${cat} — ${item.quantity}개`);
  });
  lines.push("");
  if (!leadTimeIncluded) lines.push("- 예상 납기일을 안내해 주시기 바랍니다.");
  if (!substituteIncluded) lines.push("- 재고 부족 시 대체 가능 품목이 있으면 함께 안내 부탁드립니다.");
  lines.push("");
  lines.push("감사합니다.");
  return lines.join("\n");
}
