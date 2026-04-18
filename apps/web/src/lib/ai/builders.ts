/**
 * AI Suggestion Builders — 화면별 deterministic suggestion 생성
 *
 * 실제 LLM 호출 없이 현재 app state 기반으로 생성.
 * 이번 단계는 "AI 엔진 완성"이 아니라 "반자동 suggestion operating surface 삽입".
 */
import type { AiSuggestion, AiSuggestionAction, AiSuggestionReason } from "./suggestion-engine";
import type { SupplierDraftPatch } from "./request-draft-patch";
import type { RequestDraftSuggestion } from "./request-suggestion-store";

// Legacy compat
type RequestDraftPatch = SupplierDraftPatch;
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
  let reasons: AiSuggestionReason[] = [];
  let confidence = 0.7;

  if (withoutPrice.length >= 2 && compareIds.length === 0) {
    // request_first
    title = "요청 전환이 필요한 항목이 있습니다";
    message = `가격 미등록 ${withoutPrice.length}건은 견적 요청으로 전환하는 것이 적절합니다.`;
    const candidateIds = withoutPrice.slice(0, 3).map(p => p.id);
    reasons = [
      { id: uid(), label: `가격 미등록 ${withoutPrice.length}건`, type: "missing" },
      { id: uid(), label: `가격 확인된 ${withPrice.length}건`, type: "positive" },
      ...(withoutPrice.slice(0, 2).map(p => ({ id: uid(), label: `${p.name?.substring(0, 20)} — 가격 없음`, type: "warning" as const }))),
    ];
    actions = [
      { id: uid(), type: "apply_request_candidates", label: "요청 후보 담기", payload: { itemIds: candidateIds } },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.8;
  } else if (notInCompare.length >= 2 && compareIds.length < 2) {
    // compare_first
    const candidateIds = notInCompare.slice(0, 3).map(p => p.id);
    const candidateNames = notInCompare.slice(0, 3).map(p => p.name?.substring(0, 15) || "?");
    title = "비교 후보를 정리했습니다";
    message = `${candidateNames.join(", ")} — ${candidateIds.length}개를 비교 대상으로 묶는 것이 적절합니다.`;
    reasons = [
      { id: uid(), label: `비교 가능 후보 ${notInCompare.length}건`, type: "positive" },
      { id: uid(), label: `현재 비교 후보 ${compareIds.length}건`, type: compareIds.length === 0 ? "missing" : "positive" },
      ...(notInCompare.slice(0, 2).map(p => ({
        id: uid(),
        label: `${p.name?.substring(0, 20)} · ₩${(p.vendors?.[0]?.priceInKRW || 0).toLocaleString()}`,
        type: "positive" as const,
      }))),
    ];
    actions = [
      { id: uid(), type: "apply_compare_candidates", label: "비교 후보 담기", payload: { itemIds: candidateIds } },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.75;
  } else if (compareIds.length >= 1 && withoutPrice.length >= 1) {
    // mixed_flow
    title = "비교 후 요청 전환이 적절합니다";
    message = `비교 후보 ${compareIds.length}개 유지 중. 납기 불확실 항목 ${withoutPrice.length}건은 요청 후보에 유지합니다.`;
    reasons = [
      { id: uid(), label: `비교 후보 ${compareIds.length}건 유지`, type: "positive" },
      { id: uid(), label: `납기 불확실 ${withoutPrice.length}건`, type: "warning" },
    ];
    actions = [
      { id: uid(), type: "open_review", label: "검토" },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.6;
  } else if (products.length > 0 && withPrice.length < products.length) {
    // warning
    title = "납기 확인이 필요한 항목이 있습니다";
    message = `${products.length - withPrice.length}건의 가격/납기 정보가 불완전합니다.`;
    reasons = [
      { id: uid(), label: `정보 불완전 ${products.length - withPrice.length}건`, type: "warning" },
    ];
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
    reasons,
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
  let reasons: AiSuggestionReason[] = [];
  let preview: AiSuggestion["preview"];
  let confidence = 0.7;

  const recommended = recommendedItemId ? products.find(p => p.id === recommendedItemId) : null;
  const selected = selectedDecisionItemId ? products.find(p => p.id === selectedDecisionItemId) : null;
  const modeLabel = compareMode === "cost" ? "비용" : compareMode === "leadtime" ? "납기" : compareMode === "spec_match" ? "규격" : "수동";

  if (selectedDecisionItemId && recommendedItemId && selectedDecisionItemId !== recommendedItemId) {
    title = `${modeLabel} 기준 추천안과 현재 기준안이 다릅니다`;
    message = `${modeLabel} 기준으로는 ${recommended?.name?.substring(0, 20) || "다른 항목"}이 유리합니다. 확정 전 스펙 차이를 확인하세요.`;
    reasons = [
      { id: uid(), label: `${modeLabel} 기준 ${recommended?.name?.substring(0, 15) || "A안"} 유리`, type: "positive" },
      { id: uid(), label: `현재 기준안: ${selected?.name?.substring(0, 15) || "B안"}`, type: "difference" },
    ];
    preview = {
      beforeLabel: `현재 선택: ${selected?.name?.substring(0, 15) || "B안"}`,
      afterLabel: `적용 시 선택안: ${recommended?.name?.substring(0, 15) || "A안"}`,
      summary: `${modeLabel} 기준 추천으로 반영`,
    };
    actions = [
      { id: uid(), type: "apply_selected_decision", label: "현재 선택안 반영", payload: { itemId: recommendedItemId } },
      { id: uid(), type: "open_review", label: "요청 단계로 이동" },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.7;
  } else if (selectedDecisionItemId) {
    title = "요청 단계로 이동할 수 있습니다";
    message = `기준안이 설정되어 있습니다. 견적 요청 단계로 이동하세요.`;
    reasons = [
      { id: uid(), label: `기준안: ${selected?.name?.substring(0, 15) || "선택됨"}`, type: "positive" },
    ];
    actions = [
      { id: uid(), type: "open_review", label: "요청 단계로 이동" },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.8;
  } else if (recommendedItemId) {
    title = `${modeLabel} 기준으로 ${recommended?.name?.substring(0, 20) || "A안"}이 유리합니다`;
    message = "기준안을 반영하면 요청 단계로 이동할 수 있습니다.";
    reasons = [
      { id: uid(), label: `${modeLabel} 기준 추천`, type: "positive" },
      { id: uid(), label: "기준안 미선택", type: "missing" },
    ];
    preview = {
      afterLabel: `적용 시 선택안: ${recommended?.name?.substring(0, 15) || "A안"}`,
      summary: `${modeLabel} 기준 추천 반영`,
    };
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
    reasons,
    preview,
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
  // field provenance — user edited fields are protected from AI patches
  userEditedFields?: string[];
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
  let reasons: AiSuggestionReason[] = [];
  let preview: AiSuggestion["preview"];
  let confidence = 0.7;

  const fieldLabel = (f: string) =>
    f === "message_missing" ? "메시지" :
    f === "delivery_location_missing" ? "납품지" :
    f === "attachment_missing" ? "첨부파일" :
    f === "requester_missing" ? "담당자" : f;

  // readiness 추정 (0-100)
  const baseReadiness = Math.min(100, Math.round(
    (messageBody.length >= 20 ? 40 : messageBody.length * 2) +
    (missingFields.length === 0 ? 30 : Math.max(0, 30 - missingFields.length * 10)) +
    (leadTimeIncluded ? 15 : 0) +
    (substituteIncluded ? 15 : 0)
  ));

  // 우선순위: missing_check > draft_update > draft_create > ready
  if (missingFields.length > 0) {
    title = "전송 전 확인이 필요합니다";
    message = `누락 ${missingFields.length}건 확인 후 전송 준비로 이동할 수 있습니다.`;
    reasons = missingFields.slice(0, 3).map(f => ({
      id: uid(), label: `${fieldLabel(f)} 누락`, type: "missing" as const,
    }));
    if (leadTimeIncluded) reasons.push({ id: uid(), label: "납기 확인 질문 포함됨", type: "positive" });
    const afterReadiness = Math.min(100, baseReadiness + missingFields.length * 10);
    preview = {
      beforeLabel: `전송 준비 ${baseReadiness}%`,
      afterLabel: `확인 후 ${afterReadiness}%`,
      summary: `누락 ${missingFields.length}건 보완`,
    };
    actions = [
      { id: uid(), type: "open_review", label: "누락 확인" },
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.85;
  } else if (!messageBody || messageBody.length < 20) {
    title = "요청 초안을 준비했습니다";
    const draftParts: string[] = [];
    if (!leadTimeIncluded) draftParts.push("납기 문의");
    if (!substituteIncluded) draftParts.push("대체품 문의");
    reasons = [
      { id: uid(), label: `${vendorName} 대상 ${items.length}건`, type: "positive" },
      ...(!leadTimeIncluded ? [{ id: uid(), label: "납기 문의 누락", type: "missing" as const }] : []),
      ...(!substituteIncluded ? [{ id: uid(), label: "대체품 문의 누락", type: "missing" as const }] : []),
    ];
    message = draftParts.length > 0
      ? `${draftParts.join(", ")} 포함하여 초안을 생성할 수 있습니다.`
      : `${vendorName} 대상 ${items.length}건 초안을 생성할 수 있습니다.`;
    const draftMessage = generateSimpleDraft(vendorName, items, leadTimeIncluded, substituteIncluded);
    const afterReadiness = Math.min(100, baseReadiness + 40);

    // grouped patches — field-group 단위로 세분화 (최대 2개 group)
    const groupedPatches: Array<{ group: string; supplierId: string; value: any }> = [];
    // user-edited messageBody는 AI가 건드리지 않음
    const userEdited = input.userEditedFields || [];
    if (!userEdited.includes("messageBody")) {
      groupedPatches.push({ group: "messageBody", supplierId: activeSupplierRequestId!, value: draftMessage });
    }
    // followup flag 보완
    const flagPatch: { leadTimeQuestionIncluded?: boolean; substituteQuestionIncluded?: boolean } = {};
    if (!leadTimeIncluded) flagPatch.leadTimeQuestionIncluded = true;
    if (!substituteIncluded) flagPatch.substituteQuestionIncluded = true;
    if (Object.keys(flagPatch).length > 0) {
      groupedPatches.push({ group: "followupFlags", supplierId: activeSupplierRequestId!, value: flagPatch });
    }

    preview = {
      beforeLabel: `전송 준비 ${baseReadiness}%`,
      afterLabel: `적용 시 ${afterReadiness}%`,
      summary: `초안${draftParts.length > 0 ? ` + ${draftParts.join("/")}` : ""} 추가`,
    };
    // 첫 grouped patch를 primary action payload로 사용
    const primaryPatch = groupedPatches[0];
    actions = [
      { id: uid(), type: "apply_request_draft_patch", label: "초안 적용", payload: {
        supplierId: activeSupplierRequestId!,
        patch: primaryPatch ? { [primaryPatch.group]: primaryPatch.group === "messageBody" ? (primaryPatch as { value: string }).value : true } : { messageBody: draftMessage },
      }},
      { id: uid(), type: "dismiss", label: "무시" },
    ];
    confidence = 0.75;
  } else if (messageBody.length >= 20 && missingFields.length === 0) {
    title = "검토 후 전송";
    message = `${vendorName} 대상 ${items.length}건 요청이 준비되었습니다.`;
    reasons = [
      { id: uid(), label: `전송 준비 완료`, type: "positive" },
      { id: uid(), label: `${items.length}건 품목 포함`, type: "positive" },
    ];
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
    reasons,
    preview,
    status: "generated",
    confidence,
    sourceContext: { requestAssemblyId, vendorName, itemCount: items.length, missingFields },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * AiSuggestion → RequestDraftSuggestion 변환 어댑터.
 * builder의 일반 AiSuggestion을 store의 lifecycle 관리형으로 변환.
 * accepted 시 반환되는 patch는 applySupplierDraftPatch()에 그대로 전달 가능.
 */
export function toRequestDraftSuggestion(
  base: AiSuggestion,
  requestAssemblyId: string,
  supplierId: string,
  itemIds: string[],
  draftFingerprint: string,
  draftPatch: SupplierDraftPatch
): RequestDraftSuggestion {
  return {
    id: base.id,
    scope: "request_draft",
    targetId: base.targetId,
    title: base.title,
    message: base.message,
    actions: ["accept", "dismiss", "review"],
    status: "generated",
    confidence: base.confidence,
    sourceContext: {
      requestAssemblyId,
      supplierId,
      contextHash: base.contextHash,
      itemIds,
      draftFingerprint,
    },
    payload: {
      supplierId,
      requestAssemblyId,
      patch: draftPatch,
      preview: {
        messageBody: typeof draftPatch.fields.messageBody === "string" ? draftPatch.fields.messageBody?.substring(0, 100) : undefined,
        leadTimeQuestionIncluded: draftPatch.fields.leadTimeQuestionIncluded,
        substituteQuestionIncluded: draftPatch.fields.substituteQuestionIncluded,
        itemCount: itemIds.length,
      },
      rationale: (base.reasons || []).map(r => r.label),
    },
    generatedAt: base.createdAt,
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
