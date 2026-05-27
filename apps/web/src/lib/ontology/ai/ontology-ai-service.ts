/**
 * Ontology-Aware AI Service — Phase 3
 *
 * AI가 단순 텍스트 분석이 아닌, Object Link Graph를 직접 인식하여
 * 연결된 Budget/Inventory 컨텍스트를 통합 분석하고 실행 가능한 Action을 제안.
 *
 * Type C (Object-aware) → Type D (Action-aware) 바인딩 구현.
 *
 * 규칙:
 * 1. AI 제안은 ACTION_REGISTRY에 등록된 Action만 참조
 * 2. confidence score는 데이터 기반 계산 (AI hallucination 방지)
 * 3. 제안된 Action은 pre-condition을 만족해야 실행 가능
 * 4. ARCHITECTURE.md immutable rule: AI 제안 ≠ 자동 실행 (operator 확인 필수)
 */

import { supabase } from "@/lib/supabase";
import { buildOntologySchemaForAI } from "../registry";
import { ACTION_REGISTRY } from "../actions";
import type { BudgetRiskLevel, InventoryStockStatus } from "../types";

// ══════════════════════════════════════════════════════════════════════════════
// AI Analysis Types
// ══════════════════════════════════════════════════════════════════════════════

export interface OntologyAnalysisContext {
  /** 분석 대상 주문 */
  order: OrderContext;
  /** 연결된 예산 컨텍스트 (Object Link) */
  linkedBudget: BudgetContext | null;
  /** 연결된 재고 컨텍스트 (Object Link) */
  linkedInventory: InventoryContext | null;
}

export interface OrderContext {
  orderId: string;
  poNumber: string;
  productName: string;
  vendorName: string;
  status: string;
  totalAmount: number;
  currency: string;
  quantity: number;
  unit: string;
  requestedBy: string;
  createdAt: string;
}

export interface BudgetContext {
  budgetId: string;
  budgetName: string;
  allocatedAmount: number;
  totalSpent: number;
  burnRate: number;
  riskLevel: BudgetRiskLevel;
  remainingAmount: number;
  /** 이 주문 금액 대비 잔액 비율 */
  orderToRemainingRatio: number;
}

export interface InventoryContext {
  inventoryId: string;
  productName: string;
  currentQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  unit: string;
  stockStatus: InventoryStockStatus;
  reorderPoint: number | null;
  /** 주문 수량 대비 현재 재고 비율 */
  stockCoverageRatio: number;
  expiryDate: string | null;
  daysUntilExpiry: number | null;
}

// ══════════════════════════════════════════════════════════════════════════════
// AI Suggested Action
// ══════════════════════════════════════════════════════════════════════════════

export type SuggestedActionType =
  | "APPROVE"
  | "REJECT"
  | "REQUEST_BUDGET_INCREASE"
  | "HOLD_FOR_REVIEW"
  | "DISPATCH_NOW"
  | "SCHEDULE_DISPATCH"
  | "RECEIVE_ORDER"
  | "TRIGGER_REORDER"
  | "SEND_VENDOR_EMAIL"
  | "REQUEST_CORRECTION";

export interface AiSuggestedAction {
  /** Action 유형 */
  actionType: SuggestedActionType;
  /** 표시 레이블 */
  label: string;
  /** AI가 이 Action을 제안하는 이유 */
  reason: string;
  /** 신뢰도 (0.0 ~ 1.0) — 데이터 기반 계산 */
  confidence: number;
  /** 우선순위 (1 = 최우선) */
  priority: number;
  /** 연결된 ontology action 이름 (ACTION_REGISTRY 참조) */
  ontologyActionName: string | null;
  /** 실행에 필요한 파라미터 힌트 */
  parameterHints: Record<string, unknown>;
  /** UI 색상 힌트 */
  colorHint: "green" | "blue" | "amber" | "red" | "gray";
}

export interface OntologyAnalysisResult {
  /** 분석 요약 (1~2문장) */
  summary: string;
  /** 위험 수준 */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** AI 제안 Action 배열 (우선순위순) */
  suggestedActions: AiSuggestedAction[];
  /** 분석에 사용된 컨텍스트 */
  context: OntologyAnalysisContext;
  /** 분석 시각 */
  analyzedAt: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// Core: analyzeOrderOntology
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 주문 + 연결 Budget + 연결 Inventory를 통합 분석하여
 * 실행 가능한 AI Action 제안을 반환.
 */
export async function analyzeOrderOntology(
  orderId: string,
): Promise<OntologyAnalysisResult> {
  // 1. Order 컨텍스트 수집
  const { data: orderRow } = await supabase
    .from("order_queue")
    .select("*")
    .eq("id", orderId)
    .single();

  if (!orderRow) {
    return buildEmptyResult(orderId, "주문을 찾을 수 없습니다");
  }

  const order: OrderContext = {
    orderId: orderRow.id,
    poNumber: orderRow.po_number,
    productName: orderRow.product_name ?? "",
    vendorName: orderRow.vendor_name ?? "",
    status: orderRow.status,
    totalAmount: orderRow.total_amount ?? 0,
    currency: orderRow.currency ?? "KRW",
    quantity: orderRow.quantity ?? 0,
    unit: orderRow.unit ?? "EA",
    requestedBy: orderRow.requested_by ?? "",
    createdAt: orderRow.created_at,
  };

  // 2. Budget 컨텍스트 수집 (Object Link)
  let linkedBudget: BudgetContext | null = null;
  if (orderRow.budget_id) {
    const { data: budgetRow } = await supabase
      .from("budgets")
      .select("*")
      .eq("id", orderRow.budget_id)
      .single();

    if (budgetRow) {
      const remaining = Math.max(budgetRow.amount - (budgetRow.total_spent ?? 0), 0);
      linkedBudget = {
        budgetId: budgetRow.id,
        budgetName: budgetRow.name,
        allocatedAmount: budgetRow.amount,
        totalSpent: budgetRow.total_spent ?? 0,
        burnRate: budgetRow.burn_rate ?? 0,
        riskLevel: (budgetRow.status as BudgetRiskLevel) ?? "safe",
        remainingAmount: remaining,
        orderToRemainingRatio: remaining > 0 ? order.totalAmount / remaining : Infinity,
      };
    }
  }

  // 3. Inventory 컨텍스트 수집 (Object Link)
  let linkedInventory: InventoryContext | null = null;
  if (orderRow.inventory_id) {
    const { data: invRow } = await supabase
      .from("inventory")
      .select("*")
      .eq("id", orderRow.inventory_id)
      .single();

    if (invRow) {
      const available = Math.max((invRow.quantity ?? 0) - (invRow.reserved_quantity ?? 0), 0);
      let daysUntilExpiry: number | null = null;
      if (invRow.expiry_date) {
        daysUntilExpiry = Math.floor(
          (new Date(invRow.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
      }
      linkedInventory = {
        inventoryId: invRow.id,
        productName: invRow.product_name ?? order.productName,
        currentQuantity: invRow.quantity ?? 0,
        reservedQuantity: invRow.reserved_quantity ?? 0,
        availableQuantity: available,
        unit: invRow.unit ?? "EA",
        stockStatus: (invRow.status as InventoryStockStatus) ?? "in_stock",
        reorderPoint: invRow.reorder_point ?? null,
        stockCoverageRatio: order.quantity > 0 ? available / order.quantity : 0,
        expiryDate: invRow.expiry_date ?? null,
        daysUntilExpiry,
      };
    }
  }

  // 4. 컨텍스트 기반 분석 + Action 제안
  const context: OntologyAnalysisContext = { order, linkedBudget, linkedInventory };
  const suggestedActions = buildSuggestedActions(context);
  const riskLevel = assessOverallRisk(context);
  const summary = buildSummary(context, riskLevel);

  return {
    summary,
    riskLevel,
    suggestedActions: suggestedActions.sort((a, b) => a.priority - b.priority),
    context,
    analyzedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Suggestion Engine — 규칙 기반 + 컨텍스트 분석
// ══════════════════════════════════════════════════════════════════════════════

function buildSuggestedActions(ctx: OntologyAnalysisContext): AiSuggestedAction[] {
  const actions: AiSuggestedAction[] = [];
  const { order, linkedBudget, linkedInventory } = ctx;

  // ── 승인 대기 상태 분석 ──
  if (order.status === "pending_approval") {
    // 예산 확인
    if (linkedBudget) {
      if (linkedBudget.riskLevel === "over" || linkedBudget.orderToRemainingRatio > 1) {
        // 예산 초과 → 거절 또는 증액 요청
        actions.push({
          actionType: "REJECT",
          label: "예산 초과 거절",
          reason: `예산 잔액(${linkedBudget.remainingAmount.toLocaleString()}원)이 주문 금액(${order.totalAmount.toLocaleString()}원)보다 부족합니다`,
          confidence: 0.85,
          priority: 1,
          ontologyActionName: null,
          parameterHints: { orderId: order.orderId },
          colorHint: "red",
        });
        actions.push({
          actionType: "REQUEST_BUDGET_INCREASE",
          label: "예산 증액 요청",
          reason: `부족 금액: ${(order.totalAmount - linkedBudget.remainingAmount).toLocaleString()}원. 증액 후 재승인 가능`,
          confidence: 0.7,
          priority: 2,
          ontologyActionName: null,
          parameterHints: { budgetId: linkedBudget.budgetId, shortfall: order.totalAmount - linkedBudget.remainingAmount },
          colorHint: "amber",
        });
      } else if (linkedBudget.riskLevel === "critical") {
        // 예산 위험 수준 높음 → 주의 승인
        actions.push({
          actionType: "APPROVE",
          label: "주의 승인",
          reason: `예산 소진율 ${linkedBudget.burnRate.toFixed(1)}%. 승인 후 잔액 ${(linkedBudget.remainingAmount - order.totalAmount).toLocaleString()}원`,
          confidence: 0.6,
          priority: 2,
          ontologyActionName: "FinalizeApproval",
          parameterHints: { orderId: order.orderId, budgetId: linkedBudget.budgetId },
          colorHint: "amber",
        });
      } else {
        // 예산 정상 → 승인 권장
        const confidence = linkedBudget.riskLevel === "safe" ? 0.95 : 0.8;
        actions.push({
          actionType: "APPROVE",
          label: "즉시 승인",
          reason: `예산 여유 충분 (잔액 ${linkedBudget.remainingAmount.toLocaleString()}원, 소진율 ${linkedBudget.burnRate.toFixed(1)}%)`,
          confidence,
          priority: 1,
          ontologyActionName: "FinalizeApproval",
          parameterHints: { orderId: order.orderId, budgetId: linkedBudget.budgetId },
          colorHint: "green",
        });
      }
    } else {
      // 예산 미연결 → 검토 필요
      actions.push({
        actionType: "HOLD_FOR_REVIEW",
        label: "예산 연결 후 검토",
        reason: "연결된 예산이 없습니다. 예산을 지정한 후 승인해주세요",
        confidence: 0.9,
        priority: 1,
        ontologyActionName: null,
        parameterHints: { orderId: order.orderId },
        colorHint: "amber",
      });
    }

    // 재고 확인 (이미 재고가 충분하면 발주 불필요 경고)
    if (linkedInventory && linkedInventory.stockCoverageRatio > 2) {
      actions.push({
        actionType: "HOLD_FOR_REVIEW",
        label: "재고 과잉 주의",
        reason: `현재 재고(${linkedInventory.availableQuantity}${linkedInventory.unit})가 주문 수량의 ${(linkedInventory.stockCoverageRatio * 100).toFixed(0)}%. 추가 발주 필요성을 검토하세요`,
        confidence: 0.75,
        priority: 3,
        ontologyActionName: null,
        parameterHints: { inventoryId: linkedInventory.inventoryId },
        colorHint: "amber",
      });
    }
  }

  // ── 승인 완료 → Dispatch 준비 ──
  if (order.status === "approved" || order.status === "po_created") {
    actions.push({
      actionType: "DISPATCH_NOW",
      label: "즉시 발송 준비",
      reason: "승인 완료. 공급사 발송 준비를 시작하세요",
      confidence: 0.9,
      priority: 1,
      ontologyActionName: "AuthorizeDispatch",
      parameterHints: { orderId: order.orderId, sendMode: "immediate" },
      colorHint: "blue",
    });
    actions.push({
      actionType: "SCHEDULE_DISPATCH",
      label: "발송 예약",
      reason: "특정 일시에 발송을 예약할 수 있습니다",
      confidence: 0.7,
      priority: 2,
      ontologyActionName: "AuthorizeDispatch",
      parameterHints: { orderId: order.orderId, sendMode: "scheduled" },
      colorHint: "gray",
    });
  }

  // ── 발송 완료 → 수령 대기 ──
  if (order.status === "sent" || order.status === "confirmed") {
    actions.push({
      actionType: "RECEIVE_ORDER",
      label: "물품 수령 처리",
      reason: "공급사 발송 완료. 물품 도착 시 수령 처리하세요",
      confidence: 0.85,
      priority: 1,
      ontologyActionName: "ReceiveOrder",
      parameterHints: { orderId: order.orderId },
      colorHint: "green",
    });
  }

  // ── 수령 완료 → 재주문 판단 ──
  if (order.status === "received" && linkedInventory) {
    if (linkedInventory.stockStatus === "low_stock" ||
        (linkedInventory.reorderPoint !== null && linkedInventory.availableQuantity <= linkedInventory.reorderPoint)) {
      actions.push({
        actionType: "TRIGGER_REORDER",
        label: "재주문 실행",
        reason: `재고가 재주문점(${linkedInventory.reorderPoint}${linkedInventory.unit}) 이하입니다. 자동 재주문을 실행하세요`,
        confidence: 0.8,
        priority: 1,
        ontologyActionName: "ExecuteReorderDecision",
        parameterHints: { inventoryId: linkedInventory.inventoryId },
        colorHint: "amber",
      });
    }

    if (linkedInventory.daysUntilExpiry !== null && linkedInventory.daysUntilExpiry <= 30) {
      actions.push({
        actionType: "TRIGGER_REORDER",
        label: "유효기간 임박 재주문",
        reason: `유효기간 ${linkedInventory.daysUntilExpiry}일 남음. 대체 재고 확보를 검토하세요`,
        confidence: 0.75,
        priority: 2,
        ontologyActionName: "ExecuteReorderDecision",
        parameterHints: { inventoryId: linkedInventory.inventoryId, reason: "expiry" },
        colorHint: "red",
      });
    }
  }

  return actions;
}

function assessOverallRisk(ctx: OntologyAnalysisContext): OntologyAnalysisResult["riskLevel"] {
  const risks: number[] = [];

  // 예산 위험
  if (ctx.linkedBudget) {
    const budgetRiskMap: Record<string, number> = {
      safe: 0, upcoming: 0, warning: 1, critical: 2, over: 3, ended: 3,
    };
    risks.push(budgetRiskMap[ctx.linkedBudget.riskLevel] ?? 0);
  }

  // 재고 위험
  if (ctx.linkedInventory) {
    const stockRiskMap: Record<string, number> = {
      in_stock: 0, on_order: 0, reserved: 1, low_stock: 2, out_of_stock: 3, expired: 3,
    };
    risks.push(stockRiskMap[ctx.linkedInventory.stockStatus] ?? 0);
  }

  // 주문 상태 위험
  const statusAge = Date.now() - new Date(ctx.order.createdAt).getTime();
  const daysOld = statusAge / (1000 * 60 * 60 * 24);
  if (daysOld > 14 && ctx.order.status === "pending_approval") risks.push(2);
  if (daysOld > 30) risks.push(1);

  const maxRisk = Math.max(...risks, 0);
  if (maxRisk >= 3) return "critical";
  if (maxRisk >= 2) return "high";
  if (maxRisk >= 1) return "medium";
  return "low";
}

function buildSummary(
  ctx: OntologyAnalysisContext,
  riskLevel: OntologyAnalysisResult["riskLevel"],
): string {
  const parts: string[] = [];

  parts.push(`${ctx.order.productName} (${ctx.order.poNumber})`);

  if (ctx.linkedBudget) {
    parts.push(`예산 소진율 ${ctx.linkedBudget.burnRate.toFixed(1)}%`);
  }

  if (ctx.linkedInventory) {
    parts.push(`재고 ${ctx.linkedInventory.availableQuantity}${ctx.linkedInventory.unit}`);
  }

  const riskLabel = { low: "정상", medium: "주의", high: "경고", critical: "위험" }[riskLevel];
  return `[${riskLabel}] ${parts.join(" / ")}`;
}

function buildEmptyResult(orderId: string, message: string): OntologyAnalysisResult {
  return {
    summary: message,
    riskLevel: "low",
    suggestedActions: [],
    context: {
      order: {
        orderId, poNumber: "", productName: "", vendorName: "",
        status: "", totalAmount: 0, currency: "KRW", quantity: 0,
        unit: "EA", requestedBy: "", createdAt: "",
      },
      linkedBudget: null,
      linkedInventory: null,
    },
    analyzedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Natural Language Action Parser
// ══════════════════════════════════════════════════════════════════════════════

export interface NLActionParseResult {
  /** 파싱 성공 여부 */
  parsed: boolean;
  /** 인식된 Action 유형 */
  actionType: SuggestedActionType | null;
  /** 대상 필터 조건 */
  targetFilter: NLTargetFilter;
  /** 원본 입력 */
  rawInput: string;
  /** 파싱 신뢰도 */
  confidence: number;
}

export interface NLTargetFilter {
  /** 상태 필터 */
  statusFilter: string | null;
  /** 금액 조건 */
  amountCondition: { operator: "lt" | "gt" | "eq" | "lte" | "gte"; value: number } | null;
  /** 대상 범위 */
  scope: "all" | "selected" | "single";
}

/**
 * 자연어 명령을 파싱하여 ontology action으로 변환.
 *
 * 지원 패턴:
 * - "승인 대기 중인 모든 주문 승인해줘" → APPROVE + statusFilter: pending_approval
 * - "10만원 이하 주문 모두 발주해" → DISPATCH_NOW + amountCondition: lte 100000
 * - "재고 부족 품목 재주문해줘" → TRIGGER_REORDER + statusFilter: low_stock
 */
export function parseNaturalLanguageAction(input: string): NLActionParseResult {
  const normalized = input.trim().toLowerCase();

  // Action 유형 인식
  let actionType: SuggestedActionType | null = null;
  let confidence = 0;

  const actionPatterns: Array<{ pattern: RegExp; action: SuggestedActionType; conf: number }> = [
    // 승인 계열 — "승인해줘", "결재", "허가", "ok해" 등
    { pattern: /승인|결재|허가|오케이|ok/, action: "APPROVE", conf: 0.9 },
    // 거절 계열 — "거절", "반송", "취소" 등
    { pattern: /거절|거부|반려|반송|취소/, action: "REJECT", conf: 0.85 },
    // 발송 계열 — "보내", "발송", "전달", "배송" 등
    { pattern: /발송|디스패치|보내|전달|배송|출고/, action: "DISPATCH_NOW", conf: 0.85 },
    // 발주(주문 생성) — 발송과 구분: "발주서", "주문 넣어" 등
    { pattern: /발주|주문\s*(?:넣|생성|작성)/, action: "DISPATCH_NOW", conf: 0.8 },
    // 수령 계열 — "받았", "도착", "검수" 등
    { pattern: /수령|받았|입고|도착|검수/, action: "RECEIVE_ORDER", conf: 0.8 },
    // 재주문 계열 — "다시 주문", "재발주", "보충" 등
    { pattern: /재주문|재발주|추가\s*주문|다시\s*주문|보충\s*주문|리오더/, action: "TRIGGER_REORDER", conf: 0.8 },
    // 메일 계열
    { pattern: /메일|이메일|email|연락/, action: "SEND_VENDOR_EMAIL", conf: 0.75 },
    // 보류 계열 — "나중에", "미루" 등
    { pattern: /보류|홀드|나중에|미루|잠깐|킵/, action: "HOLD_FOR_REVIEW", conf: 0.7 },
    // 예산 증액
    { pattern: /예산.*(?:증액|늘|올|추가)|증액.*요청/, action: "REQUEST_BUDGET_INCREASE", conf: 0.8 },
    // 예약 발송 — 일반 발송과 구분
    { pattern: /예약\s*발송|스케줄|예약.*보내/, action: "SCHEDULE_DISPATCH", conf: 0.8 },
    // 수정/정정
    { pattern: /수정|정정|교정|변경|고쳐/, action: "REQUEST_CORRECTION", conf: 0.7 },
  ];

  for (const { pattern, action, conf } of actionPatterns) {
    if (pattern.test(normalized)) {
      actionType = action;
      confidence = conf;
      break;
    }
  }

  // 상태 필터 인식
  let statusFilter: string | null = null;
  const statusPatterns: Array<{ pattern: RegExp; status: string }> = [
    { pattern: /승인\s*대기|결재\s*대기|미승인/, status: "pending_approval" },
    { pattern: /발송\s*완료|보낸|전달\s*완료|배송\s*중/, status: "sent" },
    { pattern: /수령\s*완료|입고\s*완료|도착\s*완료|받은/, status: "received" },
    { pattern: /승인\s*완료|승인된|결재\s*완료|허가된/, status: "approved" },
    { pattern: /초안|드래프트|작성\s*중/, status: "draft" },
    { pattern: /재고\s*부족|품절|소진/, status: "low_stock" },
    { pattern: /발주\s*완료|po\s*생성/, status: "po_created" },
  ];

  for (const { pattern, status } of statusPatterns) {
    if (pattern.test(normalized)) {
      statusFilter = status;
      break;
    }
  }

  // 금액 조건 인식 — "N만원", "N백만원", "N천만원", "N억원" 지원
  let amountCondition: NLTargetFilter["amountCondition"] = null;

  // 패턴 1: "N억(원)" → N * 100,000,000
  const amountBillion = normalized.match(/(\d+)\s*억\s*원?\s*(이하|이상|미만|초과)/);
  // 패턴 2: "N천만(원)" → N * 10,000,000
  const amountTenMil = normalized.match(/(\d+)\s*천\s*만\s*원?\s*(이하|이상|미만|초과)/);
  // 패턴 3: "N백만(원)" → N * 1,000,000
  const amountMil = normalized.match(/(\d+)\s*백\s*만\s*원?\s*(이하|이상|미만|초과)/);
  // 패턴 4: "N만(원)" → N * 10,000
  const amountTenK = normalized.match(/(\d+)\s*만\s*원?\s*(이하|이상|미만|초과)/);

  const opMap: Record<string, "lte" | "gte" | "lt" | "gt"> = {
    "이하": "lte", "이상": "gte", "미만": "lt", "초과": "gt",
  };

  if (amountBillion) {
    amountCondition = { operator: opMap[amountBillion[2]] ?? "lte", value: parseInt(amountBillion[1]) * 100_000_000 };
  } else if (amountTenMil) {
    amountCondition = { operator: opMap[amountTenMil[2]] ?? "lte", value: parseInt(amountTenMil[1]) * 10_000_000 };
  } else if (amountMil) {
    amountCondition = { operator: opMap[amountMil[2]] ?? "lte", value: parseInt(amountMil[1]) * 1_000_000 };
  } else if (amountTenK) {
    amountCondition = { operator: opMap[amountTenK[2]] ?? "lte", value: parseInt(amountTenK[1]) * 10_000 };
  }

  // 범위 인식
  let scope: NLTargetFilter["scope"] = "single";
  if (/모든|모두|전부|일괄|다\s|전체|싹/.test(normalized)) scope = "all";

  return {
    parsed: actionType !== null,
    actionType,
    targetFilter: { statusFilter, amountCondition, scope },
    rawInput: input,
    confidence: actionType ? confidence : 0,
  };
}

/**
 * 로컬 store/overlay가 주입할 수 있는 fallback 대상 공급자.
 *
 * Supabase가 비어 있거나(개발/프리뷰 환경) 쿼리가 실패한 경우,
 * 이 공급자가 설정되어 있으면 로컬 canonical state(order-queue-store 등)에서
 * 현재 가시적인 주문을 기반으로 target을 계산한다.
 *
 * 제공자는 이 모듈에 직접 store를 import하지 않고(순환 의존 방지),
 * overlay/page에서 주입한다.
 */
export interface NLLocalOrderSnapshot {
  id: string;
  status: string;
  totalAmount: number;
}
type LocalOrderProvider = () => NLLocalOrderSnapshot[];
let localOrderProvider: LocalOrderProvider | null = null;
export function setNLLocalOrderProvider(provider: LocalOrderProvider | null): void {
  localOrderProvider = provider;
}

function matchLocalSnapshot(
  snap: NLLocalOrderSnapshot,
  filter: NLTargetFilter,
): boolean {
  if (filter.statusFilter && snap.status !== filter.statusFilter) return false;
  if (filter.amountCondition) {
    const { operator, value } = filter.amountCondition;
    switch (operator) {
      case "lt":  if (!(snap.totalAmount <  value)) return false; break;
      case "lte": if (!(snap.totalAmount <= value)) return false; break;
      case "gt":  if (!(snap.totalAmount >  value)) return false; break;
      case "gte": if (!(snap.totalAmount >= value)) return false; break;
      case "eq":  if (!(snap.totalAmount === value)) return false; break;
    }
  }
  return true;
}

/**
 * 파싱된 NL Action 결과에 맞는 주문 목록을 필터링하여 반환.
 *
 * Supabase가 정상 응답하면 우선 사용하고, 빈 결과/에러/미설정 환경에서는
 * `setNLLocalOrderProvider`로 주입된 로컬 canonical snapshot을 대체로 사용한다.
 * 이 함수는 절대 throw 하지 않는다 — UI는 에러 대신 dry-run preview로 이어져야 한다.
 */
export async function resolveNLActionTargets(
  parseResult: NLActionParseResult,
): Promise<{ targetOrderIds: string[]; matchCount: number }> {
  if (!parseResult.parsed) return { targetOrderIds: [], matchCount: 0 };

  // 1) Supabase 시도 (실패해도 throw 하지 않음)
  try {
    let query: any = supabase.from("order_queue").select("id, status, total_amount");

    if (parseResult.targetFilter.statusFilter && typeof query?.eq === "function") {
      query = query.eq("status", parseResult.targetFilter.statusFilter);
    }

    if (parseResult.targetFilter.amountCondition && typeof query?.filter === "function") {
      const { operator, value } = parseResult.targetFilter.amountCondition;
      const opMap: Record<string, string> = { lt: "lt", gt: "gt", lte: "lte", gte: "gte", eq: "eq" };
      query = query.filter("total_amount", opMap[operator] ?? "lte", value);
    }

    const { data } = await query;
    const rows = Array.isArray(data) ? data : [];
    if (rows.length > 0) {
      const ids = rows.map((r: any) => r.id).filter(Boolean);
      return { targetOrderIds: ids, matchCount: ids.length };
    }
  } catch (err) {
    // swallow — 로컬 fallback으로 이어짐
    if (typeof console !== "undefined") {
      console.warn("[resolveNLActionTargets] supabase query 실패, 로컬 fallback 사용:", err);
    }
  }

  // 2) 로컬 canonical snapshot fallback
  if (localOrderProvider) {
    try {
      const snaps = localOrderProvider();
      const matched = snaps.filter((s) => matchLocalSnapshot(s, parseResult.targetFilter));
      return {
        targetOrderIds: matched.map((m) => m.id),
        matchCount: matched.length,
      };
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[resolveNLActionTargets] local provider 실패:", err);
      }
    }
  }

  return { targetOrderIds: [], matchCount: 0 };
}

// ══════════════════════════════════════════════════════════════════════════════
// Phase 5: AI Agent Execution Plan — 복합 명령 → 도구 바인딩 실행 계획
// ══════════════════════════════════════════════════════════════════════════════

export interface ExecutionStep {
  /** 실행 순서 (1-based) */
  order: number;
  /** 바인딩된 ontology action */
  actionType: SuggestedActionType;
  /** 표시 레이블 */
  label: string;
  /** 대상 주문 ID 목록 */
  targetIds: string[];
  /** 부가 컨텍스트 */
  context: Record<string, unknown>;
  /** 이 단계에 메일 발송이 포함되는지 */
  includesNotification: boolean;
  /** 이전 단계 실행 필수 여부 */
  dependsOnPrevious: boolean;
}

export interface ExecutionPlan {
  /** 원본 자연어 입력 */
  rawInput: string;
  /** 실행 계획 단계들 */
  steps: ExecutionStep[];
  /** 전체 대상 주문 수 */
  totalTargetCount: number;
  /** 파싱 신뢰도 */
  confidence: number;
  /** 실행 전 확인 필요 항목 */
  confirmationRequired: string[];
  /** 계획 생성 시각 */
  createdAt: string;
}

/**
 * 자연어 명령을 분석하여 복합 실행 계획을 생성.
 *
 * 단순 패턴 매칭이 아닌, 복합 명령을 분해하여
 * 순서가 있는 실행 단계로 변환.
 *
 * 예시:
 * - "10만원 이하 주문 모두 승인하고 공급사에 메일 보내줘"
 *   → Step 1: APPROVE (10만원 이하, 승인대기) + Step 2: SEND_VENDOR_EMAIL
 * - "재고 부족 품목 전부 재주문 넣어줘"
 *   → Step 1: TRIGGER_REORDER (low_stock 품목)
 */
export async function buildExecutionPlan(input: string): Promise<ExecutionPlan> {
  const normalized = input.trim().toLowerCase();
  const steps: ExecutionStep[] = [];
  const confirmationRequired: string[] = [];
  let overallConfidence = 0;

  // 복합 명령 분해: "~하고", "~한 다음", "~후에", "~해서", "~해 주고" 등
  const clauseSplitters = /(?:하고|한\s*다음|한\s*후에?|그리고|이후에?|다음에|해서|하면|해\s*주고|한\s*뒤에?)/;
  const clauses = normalized.split(clauseSplitters).map(c => c.trim()).filter(Boolean);

  let stepOrder = 1;
  for (const clause of clauses) {
    const parseResult = parseNaturalLanguageAction(clause.length < 3 ? input : clause);

    if (!parseResult.parsed || !parseResult.actionType) continue;

    // 메일 발송 여부 감지
    const includesNotification = /메일|이메일|email|알림|통보|연락/.test(clause);

    // 대상 주문 해석
    const targets = await resolveNLActionTargets(parseResult);

    // 고위험 작업 확인 요청
    if (parseResult.actionType === "APPROVE" && targets.matchCount > 5) {
      confirmationRequired.push(`${targets.matchCount}건의 주문을 일괄 승인합니다.`);
    }
    if (parseResult.actionType === "DISPATCH_NOW" && targets.matchCount > 0) {
      confirmationRequired.push(`${targets.matchCount}건을 공급사에 발송합니다. 되돌릴 수 없습니다.`);
    }
    if (includesNotification) {
      confirmationRequired.push("공급사에 이메일이 발송됩니다.");
    }

    steps.push({
      order: stepOrder++,
      actionType: parseResult.actionType,
      label: buildStepLabel(parseResult.actionType, targets.matchCount, includesNotification),
      targetIds: targets.targetOrderIds,
      context: {
        statusFilter: parseResult.targetFilter.statusFilter,
        amountCondition: parseResult.targetFilter.amountCondition,
        scope: parseResult.targetFilter.scope,
      },
      includesNotification,
      dependsOnPrevious: stepOrder > 2, // 2단계부터는 이전 단계 의존
    });

    overallConfidence = Math.max(overallConfidence, parseResult.confidence);
  }

  // 복합 명령에서 별도로 메일 발송만 언급된 경우
  if (steps.length > 0 && /메일|이메일|email/.test(normalized) && !steps.some(s => s.actionType === "SEND_VENDOR_EMAIL")) {
    const primaryStep = steps[0];
    steps.push({
      order: stepOrder++,
      actionType: "SEND_VENDOR_EMAIL",
      label: `공급사 메일 발송 (${primaryStep.targetIds.length}건)`,
      targetIds: primaryStep.targetIds,
      context: { parentAction: primaryStep.actionType },
      includesNotification: true,
      dependsOnPrevious: true,
    });
    confirmationRequired.push("공급사에 이메일이 발송됩니다.");
  }

  return {
    rawInput: input,
    steps,
    totalTargetCount: steps.reduce((sum, s) => sum + s.targetIds.length, 0),
    confidence: overallConfidence,
    confirmationRequired: [...new Set(confirmationRequired)],
    createdAt: new Date().toISOString(),
  };
}

function buildStepLabel(actionType: SuggestedActionType, count: number, withNotification: boolean): string {
  const actionLabels: Record<SuggestedActionType, string> = {
    APPROVE: "주문 승인",
    REJECT: "주문 거절",
    REQUEST_BUDGET_INCREASE: "예산 증액 요청",
    HOLD_FOR_REVIEW: "검토 보류",
    DISPATCH_NOW: "즉시 발송",
    SCHEDULE_DISPATCH: "발송 예약",
    RECEIVE_ORDER: "수령 처리",
    TRIGGER_REORDER: "재주문 실행",
    SEND_VENDOR_EMAIL: "공급사 메일 발송",
    REQUEST_CORRECTION: "수정 요청",
  };

  // 내부 actionType 코드가 UI에 노출되지 않도록 fallback은 "작업 실행"
  let label = `${actionLabels[actionType] ?? "작업 실행"} (${count}건)`;
  if (withNotification && actionType !== "SEND_VENDOR_EMAIL") {
    label += " + 알림";
  }
  return label;
}

// ══════════════════════════════════════════════════════════════════════════════
// AI Schema Export — Gemini Function Calling 연동용
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Gemini/GPT에 전달할 ontology-aware tool description.
 * AI가 이 스키마를 읽고 어떤 객체에 어떤 Action을 수행할 수 있는지 이해.
 *
 * Phase 5: 도구(Tool) 중심 재설계 — 각 도구의 사전조건, 부작용, 확인 필요 여부 명시.
 */
export function buildGeminiToolDescription(): object {
  const schema = buildOntologySchemaForAI();

  return {
    name: "labaxis_ontology_actions",
    description: "LabAxis 연구 구매 운영 시스템의 객체(Product, Budget, PurchaseOrder, Inventory)에 대해 비즈니스 액션을 수행합니다. 각 액션은 사전 조건(pre-condition)을 검증한 후 실행되며, 관련 객체의 상태를 원자적으로 업데이트합니다.",
    parameters: {
      type: "object",
      properties: {
        actionName: {
          type: "string",
          enum: schema.actions.map((a) => a.name),
          description: "실행할 비즈니스 액션. " +
            schema.actions.map((a) => `${a.name}: ${a.description}`).join(". "),
        },
        targetObjectId: {
          type: "string",
          description: "대상 객체 ID",
        },
        parameters: {
          type: "object",
          description: "액션별 추가 파라미터",
        },
        confirmationRequired: {
          type: "boolean",
          description: "true면 실행 전 운영자 확인 필요 (비가역적 작업, 메일 발송, 일괄 처리 등)",
        },
        notifyVendor: {
          type: "boolean",
          description: "true면 공급사에 이메일 알림 발송. 발송/승인 등 공급사 관련 액션 시 판단",
        },
      },
      required: ["actionName", "targetObjectId"],
    },
  };
}
