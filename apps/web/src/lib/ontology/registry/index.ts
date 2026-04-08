/**
 * Ontology Object Registry — Phase 1
 *
 * Domain Object 메타데이터 중앙 등록소.
 * AI가 "어떤 객체가 있고, 각 객체에 어떤 Action을 할 수 있으며,
 * 어떤 상태 전이가 가능한가"를 이 registry에서 조회한다.
 *
 * Phase 2에서 runtime link graph 관리 추가 예정.
 */

import type { OntologyObjectType, StateTransitionRule } from "../types";
import type { ActionRegistryEntry } from "../actions";
import { ACTION_REGISTRY } from "../actions";

// ══════════════════════════════════════════════════════════════════════════════
// Object Registry Entry
// ══════════════════════════════════════════════════════════════════════════════

export interface ObjectRegistryEntry {
  objectType: OntologyObjectType;
  /** 운영자 표시용 이름 */
  displayName: string;
  /** 설명 (AI 참조) */
  description: string;
  /** 상태 전이 규칙 */
  stateTransitions: StateTransitionRule<string>[];
  /** governance domain 연결 */
  governanceDomain: string | null;
  /** 가능한 Link 대상 */
  linkTargets: Array<{
    targetType: OntologyObjectType;
    linkType: string;
    cardinality: "one" | "many";
  }>;
}

// ══════════════════════════════════════════════════════════════════════════════
// Registry Data
// ══════════════════════════════════════════════════════════════════════════════

export const OBJECT_REGISTRY: readonly ObjectRegistryEntry[] = [
  {
    objectType: "Product",
    displayName: "제품",
    description: "연구실 시약, 장비, 소모품. 재고·견적·발주의 기본 단위.",
    governanceDomain: null,
    stateTransitions: [],
    linkTargets: [
      { targetType: "Vendor", linkType: "supplied_by", cardinality: "many" },
      { targetType: "Inventory", linkType: "stocked_as", cardinality: "many" },
    ],
  },
  {
    objectType: "Vendor",
    displayName: "공급사",
    description: "제품 공급 파트너. 견적 요청·발주·발송의 대상.",
    governanceDomain: null,
    stateTransitions: [
      { from: "active", to: "suspended", requires: ["admin_action"], actionName: "SuspendVendor", irreversible: false },
      { from: "suspended", to: "active", requires: ["admin_action"], actionName: "ReactivateVendor", irreversible: false },
    ],
    linkTargets: [
      { targetType: "Product", linkType: "supplies", cardinality: "many" },
      { targetType: "Quote", linkType: "quoted_by", cardinality: "many" },
    ],
  },
  {
    objectType: "Budget",
    displayName: "예산",
    description: "부서/프로젝트별 구매 예산. 예약→확정→집행 생명주기.",
    governanceDomain: null,
    stateTransitions: [
      { from: "safe", to: "warning", requires: ["usage_threshold_80"], actionName: "BudgetWarningTriggered", irreversible: false },
      { from: "warning", to: "critical", requires: ["usage_threshold_95"], actionName: "BudgetCriticalTriggered", irreversible: false },
      { from: "critical", to: "over", requires: ["over_allocation"], actionName: "BudgetOverTriggered", irreversible: false },
    ],
    linkTargets: [
      { targetType: "PurchaseOrder", linkType: "funds", cardinality: "many" },
    ],
  },
  {
    objectType: "Quote",
    displayName: "견적",
    description: "견적 요청/응답. 비교→선정→승인 프로세스의 시작점.",
    governanceDomain: "quote_chain",
    stateTransitions: [
      { from: "draft", to: "sent_to_vendor", requires: ["vendor_selected"], actionName: "SubmitQuoteRequest", irreversible: false },
      { from: "vendor_responded", to: "under_review", requires: ["response_received"], actionName: "StartQuoteReview", irreversible: false },
      { from: "under_review", to: "shortlisted", requires: ["reviewer_decision"], actionName: "ShortlistQuote", irreversible: false },
      { from: "shortlisted", to: "approved", requires: ["approver_decision", "budget_available"], actionName: "ApproveQuote", irreversible: false },
      { from: "approved", to: "cancelled", requires: ["cancel_reason"], actionName: "CancelQuote", irreversible: true },
    ],
    linkTargets: [
      { targetType: "Product", linkType: "quote_for_product", cardinality: "many" },
      { targetType: "Vendor", linkType: "quote_from_vendor", cardinality: "one" },
      { targetType: "PurchaseOrder", linkType: "converted_to", cardinality: "one" },
    ],
  },
  {
    objectType: "PurchaseOrder",
    displayName: "발주서",
    description: "승인된 견적에서 생성된 발주. Dispatch→Receiving→Stock Release까지의 실행 단위.",
    governanceDomain: "dispatch_prep",
    stateTransitions: [
      { from: "draft", to: "pending_approval", requires: ["conversion_complete"], actionName: "ConvertQuoteToPO", irreversible: false },
      { from: "pending_approval", to: "approved", requires: ["approver_decision"], actionName: "ApprovePO", irreversible: false },
      { from: "approved", to: "po_created", requires: ["po_identity_generated"], actionName: "FinalizePOCreation", irreversible: false },
      { from: "po_created", to: "dispatch_prep", requires: ["dispatch_prep_opened"], actionName: "OpenDispatchPreparation", irreversible: false },
      { from: "dispatch_prep", to: "ready_to_send", requires: ["all_blockers_resolved", "snapshot_valid"], actionName: "CompleteDispatchPrep", irreversible: false },
      { from: "ready_to_send", to: "sent", requires: ["dispatch_authorized", "send_executed"], actionName: "AuthorizeDispatch", irreversible: true },
    ],
    linkTargets: [
      { targetType: "Quote", linkType: "po_from_quote", cardinality: "one" },
      { targetType: "Vendor", linkType: "po_to_vendor", cardinality: "one" },
      { targetType: "Budget", linkType: "po_funded_by_budget", cardinality: "one" },
      { targetType: "DispatchPackage", linkType: "dispatch_for_po", cardinality: "one" },
    ],
  },
  {
    objectType: "Inventory",
    displayName: "재고",
    description: "실물 재고. LOT/유효기간 관리, 재주문점 기반 자동 보충.",
    governanceDomain: "stock_release",
    stateTransitions: [
      { from: "in_stock", to: "low_stock", requires: ["below_reorder_point"], actionName: "LowStockTriggered", irreversible: false },
      { from: "low_stock", to: "out_of_stock", requires: ["quantity_zero"], actionName: "OutOfStockTriggered", irreversible: false },
      { from: "out_of_stock", to: "on_order", requires: ["reorder_initiated"], actionName: "ExecuteReorderDecision", irreversible: false },
      { from: "on_order", to: "in_stock", requires: ["stock_received"], actionName: "RecordStockReceipt", irreversible: false },
    ],
    linkTargets: [
      { targetType: "Product", linkType: "inventory_of_product", cardinality: "one" },
    ],
  },
  {
    objectType: "DispatchPackage",
    displayName: "발송 패키지",
    description: "공급사 발송 단위. 수신자/첨부/발송 채널 관리.",
    governanceDomain: "dispatch_execution",
    stateTransitions: [],
    linkTargets: [
      { targetType: "PurchaseOrder", linkType: "dispatch_for_po", cardinality: "one" },
    ],
  },
  {
    objectType: "ReceivingRecord",
    displayName: "입고 기록",
    description: "입고 검수 결과. 수량/품질 검증 후 재고 반영.",
    governanceDomain: "receiving_execution",
    stateTransitions: [],
    linkTargets: [
      { targetType: "DispatchPackage", linkType: "receiving_for_dispatch", cardinality: "one" },
      { targetType: "Inventory", linkType: "inventory_from_receiving", cardinality: "many" },
    ],
  },
  {
    objectType: "QuoteComparison",
    displayName: "견적 비교",
    description: "AI 다중 견적 비교 세션. 공급사별 가격/납기 비교 후 선정→견적 요청 조립으로 handoff.",
    governanceDomain: "quote_chain",
    stateTransitions: [
      { from: "comparison_complete", to: "vendor_selected", requires: ["vendor_selection"], actionName: "SelectVendorFromComparison", irreversible: false },
      { from: "vendor_selected", to: "handed_off_to_request", requires: ["handoff_executed"], actionName: "HandoffToRequestAssembly", irreversible: false },
    ],
    linkTargets: [
      { targetType: "Quote", linkType: "comparison_produces_quote", cardinality: "many" },
      { targetType: "Vendor", linkType: "comparison_includes_vendor", cardinality: "many" },
    ],
  },
  {
    objectType: "BomParseSession",
    displayName: "BOM 파싱",
    description: "AI BOM 텍스트 파싱 세션. 비정형 품목 리스트를 구조화하여 발주 대기열에 일괄 등록.",
    governanceDomain: null,
    stateTransitions: [
      { from: "parsed", to: "items_confirmed", requires: ["item_selection_confirmed"], actionName: "ConfirmBomItems", irreversible: false },
      { from: "items_confirmed", to: "registered_to_queue", requires: ["queue_registration_executed"], actionName: "RegisterToOrderQueue", irreversible: false },
    ],
    linkTargets: [
      { targetType: "Product", linkType: "bom_matched_product", cardinality: "many" },
    ],
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// Lookup Functions
// ══════════════════════════════════════════════════════════════════════════════

export function lookupObjectType(objectType: OntologyObjectType): ObjectRegistryEntry | undefined {
  return OBJECT_REGISTRY.find((e) => e.objectType === objectType);
}

export function getStateTransitions(objectType: OntologyObjectType): StateTransitionRule<string>[] {
  return lookupObjectType(objectType)?.stateTransitions ?? [];
}

export function getAvailableTransitions(
  objectType: OntologyObjectType,
  currentState: string,
): StateTransitionRule<string>[] {
  return getStateTransitions(objectType).filter((t) => t.from === currentState);
}

export function getActionsForObject(objectType: OntologyObjectType): readonly ActionRegistryEntry[] {
  return ACTION_REGISTRY.filter((a) => a.targetObjectType === objectType);
}

/**
 * AI용 — 특정 객체에 대해 "지금 할 수 있는 Action"을 반환
 * 상태 전이 규칙 + Action Registry를 조합
 */
export function getAvailableActionsForState(
  objectType: OntologyObjectType,
  currentState: string,
): Array<{ actionName: string; description: string; riskLevel: string; irreversible: boolean }> {
  const transitions = getAvailableTransitions(objectType, currentState);
  const actionNames = new Set(transitions.map((t) => t.actionName));

  return ACTION_REGISTRY
    .filter((a) => a.targetObjectType === objectType && actionNames.has(a.actionName))
    .map((a) => ({
      actionName: a.actionName,
      description: a.description,
      riskLevel: a.riskLevel,
      irreversible: a.irreversible,
    }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Schema Export — AI Function Calling용
// ══════════════════════════════════════════════════════════════════════════════

export interface OntologySchemaForAI {
  objectTypes: Array<{
    type: OntologyObjectType;
    displayName: string;
    description: string;
    availableActions: string[];
  }>;
  actions: Array<{
    name: string;
    targetType: OntologyObjectType;
    description: string;
    riskLevel: string;
    irreversible: boolean;
  }>;
}

/**
 * AI가 ontology를 이해하는 데 필요한 최소 스키마.
 * Gemini Function Calling의 tool description으로 사용 가능.
 */
export function buildOntologySchemaForAI(): OntologySchemaForAI {
  return {
    objectTypes: OBJECT_REGISTRY.map((entry) => ({
      type: entry.objectType,
      displayName: entry.displayName,
      description: entry.description,
      availableActions: ACTION_REGISTRY
        .filter((a) => a.targetObjectType === entry.objectType)
        .map((a) => a.actionName),
    })),
    actions: ACTION_REGISTRY.map((a) => ({
      name: a.actionName,
      targetType: a.targetObjectType,
      description: a.description,
      riskLevel: a.riskLevel,
      irreversible: a.irreversible,
    })),
  };
}
