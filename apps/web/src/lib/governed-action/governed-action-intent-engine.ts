/**
 * Governed Action Composer — Intent Resolution Engine
 *
 * 사용자의 자연어 의도(또는 구조화된 명령)를 해석하여
 * 실행 가능한 ResolvedActionIntent로 변환한다.
 *
 * 규칙:
 *   1. intent는 canonical truth를 직접 변경하지 않음
 *   2. 모호하면 실행 금지 — structured interpretation candidate만 반환
 *   3. current page / current selection이 있으면 전역 검색보다 우선
 *   4. ACTION_REGISTRY에 등록된 action만 참조
 *   5. chat UX가 아님 — ambiguity는 대화가 아니라 structured card로 해결
 */

import { ACTION_REGISTRY, type ActionRegistryEntry, type ActionRiskLevel } from "@/lib/ontology/actions";
import { parseNaturalLanguageAction, type NLActionParseResult, type SuggestedActionType } from "@/lib/ontology/ai/ontology-ai-service";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

/** Composer가 열릴 때 주입받는 현재 컨텍스트 */
export interface ComposerWorkbenchContext {
  /** 현재 라우트 (e.g. "/dashboard/purchases") */
  currentRoute: string;
  /** 현재 선택된 entity ID (dock에서 열릴 때) */
  selectedEntityIds: string[];
  /** 현재 선택된 entity 타입 */
  selectedEntityType: "quote" | "purchase_order" | "dispatch" | "inventory" | null;
  /** 현재 workbench 상태 요약 */
  workbenchStage:
    | "quote_comparison"
    | "approval_pending"
    | "po_conversion"
    | "po_created"
    | "dispatch_preparation"
    | "dispatch_execution"
    | "receiving"
    | "stock_management"
    | null;
  /** 현재 entity의 canonical status */
  currentStatus: string | null;
  /** 연결된 PO 번호 (있으면) */
  linkedPoNumber: string | null;
  /** 연결된 공급사 이름 (있으면) */
  linkedSupplierName: string | null;
}

/** 해석된 단일 intent */
export interface ResolvedActionIntent {
  /** 고유 ID */
  intentId: string;
  /** 해석된 intent 유형 */
  intentType: GovernedIntentType;
  /** 매핑된 ACTION_REGISTRY action 이름 */
  registryActionName: string;
  /** 대상 entity 타입 */
  targetEntityType: string;
  /** 대상 entity ID 목록 */
  targetEntityIds: string[];
  /** 해석 신뢰도 (0.0 ~ 1.0) */
  confidence: number;
  /** 위험 수준 (registry에서 조회) */
  riskLevel: ActionRiskLevel;
  /** 비가역 여부 */
  irreversible: boolean;
  /** 사용자에게 보여줄 한글 라벨 */
  displayLabel: string;
  /** 부가 설명 */
  displayDescription: string;
  /** 필요한 추가 컨텍스트 키 */
  requiredContext: string[];
  /** 모호한 경우 이유 */
  ambiguityReason: string | null;
  /** 다음 단계 (dry-run 가능 여부) */
  availableNextStep: "dry_run" | "needs_clarification" | "needs_selection";
}

/** 전체 해석 결과 */
export interface IntentResolutionResult {
  /** 해석 성공 여부 */
  resolved: boolean;
  /** 단일 intent가 확정된 경우 */
  primaryIntent: ResolvedActionIntent | null;
  /** 모호한 경우 후보 목록 (2~3개) */
  candidates: ResolvedActionIntent[];
  /** 원본 입력 */
  rawInput: string;
  /** 사용된 컨텍스트 */
  usedContext: ComposerWorkbenchContext | null;
  /** 해석 실패 사유 */
  failureReason: string | null;
}

/** 지원 intent 유형 */
export type GovernedIntentType =
  | "prepare_quote_request"
  | "send_quote_request"
  | "finalize_approval"
  | "convert_quote_to_po"
  | "reopen_po_conversion"
  | "dispatch_now"
  | "schedule_dispatch"
  | "request_correction"
  | "cancel_dispatch_prep"
  | "receive_order"
  | "trigger_reorder"
  | "reserve_budget"
  | "release_budget";

// ══════════════════════════════════════════════════════════════
// Intent → Registry 매핑
// ══════════════════════════════════════════════════════════════

interface IntentMapping {
  intentType: GovernedIntentType;
  registryActionName: string;
  /** NL parser의 SuggestedActionType과의 매핑 */
  nlActionTypes: SuggestedActionType[];
  /** 한글 라벨 */
  label: string;
  description: string;
  /** 이 intent가 유효하려면 현재 컨텍스트가 어떤 stage여야 하는지 */
  validStages: ComposerWorkbenchContext["workbenchStage"][];
  /** 이 intent에 필요한 추가 컨텍스트 */
  requiredContext: string[];
  /** 한글 패턴 (NL 보강) */
  koreanPatterns: RegExp[];
}

const INTENT_MAPPINGS: readonly IntentMapping[] = [
  {
    intentType: "prepare_quote_request",
    registryActionName: "SubmitQuoteRequest",
    nlActionTypes: [],
    label: "견적 요청 준비",
    description: "선택한 품목에 대해 공급사 견적 요청서를 준비합니다",
    validStages: ["quote_comparison", null],
    requiredContext: ["selectedEntityIds"],
    koreanPatterns: [/견적\s*요청\s*(?:준비|작성|만들)/, /rfq\s*(?:준비|작성)/i],
  },
  {
    intentType: "send_quote_request",
    registryActionName: "SubmitQuoteRequest",
    nlActionTypes: ["SEND_VENDOR_EMAIL"],
    label: "견적 요청 발송",
    description: "준비된 견적 요청서를 공급사에 발송합니다",
    validStages: ["quote_comparison"],
    requiredContext: ["selectedEntityIds"],
    koreanPatterns: [/견적\s*요청\s*(?:발송|보내|전송)/, /rfq\s*(?:발송|보내)/i],
  },
  {
    intentType: "finalize_approval",
    registryActionName: "FinalizeApproval",
    nlActionTypes: ["APPROVE"],
    label: "구매 승인",
    description: "선택한 주문을 승인하고 예산을 확정합니다",
    validStages: ["approval_pending", null],
    requiredContext: ["selectedEntityIds"],
    koreanPatterns: [/승인/, /결재/, /허가/],
  },
  {
    intentType: "convert_quote_to_po",
    registryActionName: "ConvertQuoteToPO",
    nlActionTypes: [],
    label: "PO 전환",
    description: "승인된 견적을 발주서로 전환합니다",
    validStages: ["po_conversion"],
    requiredContext: ["selectedEntityIds"],
    koreanPatterns: [/po\s*전환/i, /발주서\s*(?:전환|생성|만들)/, /발주\s*전환/],
  },
  {
    intentType: "reopen_po_conversion",
    registryActionName: "ConvertQuoteToPO",
    nlActionTypes: [],
    label: "PO 전환 재개",
    description: "중단된 PO 전환 작업을 재개합니다",
    validStages: ["po_created", "dispatch_preparation"],
    requiredContext: ["selectedEntityIds"],
    koreanPatterns: [/po\s*전환\s*재개/i, /전환\s*다시/, /재전환/],
  },
  {
    intentType: "dispatch_now",
    registryActionName: "AuthorizeDispatch",
    nlActionTypes: ["DISPATCH_NOW"],
    label: "즉시 발송",
    description: "발주서를 공급사에 즉시 발송합니다 (되돌릴 수 없습니다)",
    validStages: ["dispatch_preparation", "po_created"],
    requiredContext: ["selectedEntityIds"],
    koreanPatterns: [/즉시\s*발송/, /바로\s*(?:발송|보내)/, /지금\s*(?:발송|보내)/],
  },
  {
    intentType: "schedule_dispatch",
    registryActionName: "AuthorizeDispatch",
    nlActionTypes: ["SCHEDULE_DISPATCH"],
    label: "발송 예약",
    description: "발주서 발송을 특정 일시에 예약합니다",
    validStages: ["dispatch_preparation", "po_created"],
    requiredContext: ["selectedEntityIds", "scheduledAt"],
    koreanPatterns: [/발송\s*예약/, /예약\s*발송/, /\d+시.*발송/, /내일.*발송/],
  },
  {
    intentType: "request_correction",
    registryActionName: "ConvertQuoteToPO",
    nlActionTypes: ["REQUEST_CORRECTION"],
    label: "교정 요청",
    description: "발송 전 PO 내용 교정을 요청합니다",
    validStages: ["dispatch_preparation", "po_created"],
    requiredContext: ["selectedEntityIds"],
    koreanPatterns: [/교정\s*요청/, /수정\s*요청/, /정정/, /고쳐/],
  },
  {
    intentType: "cancel_dispatch_prep",
    registryActionName: "AuthorizeDispatch",
    nlActionTypes: [],
    label: "발송 준비 취소",
    description: "진행 중인 발송 준비를 취소합니다",
    validStages: ["dispatch_preparation"],
    requiredContext: ["selectedEntityIds"],
    koreanPatterns: [/발송\s*(?:준비\s*)?취소/, /디스패치\s*취소/],
  },
  {
    intentType: "receive_order",
    registryActionName: "ReceiveOrder",
    nlActionTypes: ["RECEIVE_ORDER"],
    label: "수령 처리",
    description: "도착한 물품을 수령 처리합니다",
    validStages: ["receiving", null],
    requiredContext: ["selectedEntityIds"],
    koreanPatterns: [/수령/, /입고/, /받았/, /도착/],
  },
  {
    intentType: "trigger_reorder",
    registryActionName: "ExecuteReorderDecision",
    nlActionTypes: ["TRIGGER_REORDER"],
    label: "재주문 실행",
    description: "재고 부족 품목의 재주문을 실행합니다",
    validStages: ["stock_management", null],
    requiredContext: ["selectedEntityIds"],
    koreanPatterns: [/재주문/, /재발주/, /보충\s*주문/],
  },
  {
    intentType: "reserve_budget",
    registryActionName: "ReserveBudget",
    nlActionTypes: ["REQUEST_BUDGET_INCREASE"],
    label: "예산 예약",
    description: "PO 승인을 위해 예산을 예약합니다",
    validStages: [null],
    requiredContext: ["selectedEntityIds", "budgetId"],
    koreanPatterns: [/예산\s*예약/, /예산\s*확보/],
  },
  {
    intentType: "release_budget",
    registryActionName: "ReleaseBudget",
    nlActionTypes: [],
    label: "예산 해제",
    description: "PO 취소로 인한 예산 예약을 해제합니다",
    validStages: [null],
    requiredContext: ["selectedEntityIds", "budgetId"],
    koreanPatterns: [/예산\s*해제/, /예산\s*반환/],
  },
] as const;

// ══════════════════════════════════════════════════════════════
// Core: resolveIntent
// ══════════════════════════════════════════════════════════════

let idCounter = 0;
function nextIntentId(): string {
  return `intent_${Date.now()}_${++idCounter}`;
}

/**
 * 사용자 의도를 해석한다.
 *
 * 1) current context가 있으면 context-aware 해석 우선
 * 2) NL parser로 action type 식별
 * 3) Korean pattern으로 보강
 * 4) 모호하면 candidate 2~3개 반환, 확정이면 primaryIntent 반환
 */
export function resolveIntent(
  userIntentText: string,
  context: ComposerWorkbenchContext | null,
): IntentResolutionResult {
  const normalized = userIntentText.trim().toLowerCase();

  if (!normalized) {
    return {
      resolved: false,
      primaryIntent: null,
      candidates: [],
      rawInput: userIntentText,
      usedContext: context,
      failureReason: "입력이 비어 있습니다",
    };
  }

  // ── Step 1: NL parser로 기본 action type 식별 ──
  const nlResult = parseNaturalLanguageAction(normalized);

  // ── Step 2: Korean pattern + NL 결과 + context로 intent 후보 점수 계산 ──
  const scored = INTENT_MAPPINGS.map((mapping) => {
    let score = 0;

    // 2a. Korean pattern 매칭
    for (const pattern of mapping.koreanPatterns) {
      if (pattern.test(normalized)) {
        score += 40;
        break;
      }
    }

    // 2b. NL parser action type 매칭
    if (nlResult.parsed && nlResult.actionType) {
      if (mapping.nlActionTypes.includes(nlResult.actionType)) {
        score += 30 * nlResult.confidence;
      }
    }

    // 2c. Context stage 매칭 (current workbench stage와 일치하면 보너스)
    if (context?.workbenchStage) {
      if (mapping.validStages.includes(context.workbenchStage)) {
        score += 20;
      } else if (!mapping.validStages.includes(null)) {
        // stage가 맞지 않으면 감점
        score -= 10;
      }
    }

    // 2d. 선택된 entity가 있으면 보너스
    if (context?.selectedEntityIds && context.selectedEntityIds.length > 0) {
      score += 5;
    }

    return { mapping, score };
  });

  // 점수 내림차순 정렬 + 0점 이하 제거
  const ranked = scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return {
      resolved: false,
      primaryIntent: null,
      candidates: [],
      rawInput: userIntentText,
      usedContext: context,
      failureReason: "인식할 수 있는 작업 유형이 없습니다. 예: '견적 요청 발송', '즉시 발송', '승인' 등",
    };
  }

  // ── Step 3: 확정 vs 모호 판정 ──
  const top = ranked[0];
  const second = ranked[1];
  const registryEntry = ACTION_REGISTRY.find((a) => a.actionName === top.mapping.registryActionName);

  // 1등과 2등의 점수 차이가 크면 확정
  const isUnambiguous = !second || (top.score - second.score) >= 15;
  const confidence = Math.min(top.score / 60, 1.0);

  const targetIds = context?.selectedEntityIds ?? [];

  const buildIntent = (m: IntentMapping, conf: number, ambiguity: string | null): ResolvedActionIntent => {
    const entry = ACTION_REGISTRY.find((a) => a.actionName === m.registryActionName);
    const missingContext = m.requiredContext.filter((key) => {
      if (key === "selectedEntityIds") return targetIds.length === 0;
      if (key === "scheduledAt") return !/\d+시|\d+일|내일|모레/.test(normalized);
      if (key === "budgetId") return true; // 항상 별도 선택 필요
      return false;
    });

    let nextStep: ResolvedActionIntent["availableNextStep"] = "dry_run";
    if (ambiguity) nextStep = "needs_clarification";
    if (missingContext.includes("selectedEntityIds") && targetIds.length === 0) nextStep = "needs_selection";

    return {
      intentId: nextIntentId(),
      intentType: m.intentType,
      registryActionName: m.registryActionName,
      targetEntityType: entry?.targetObjectType ?? "PurchaseOrder",
      targetEntityIds: targetIds,
      confidence: Math.round(conf * 100) / 100,
      riskLevel: entry?.riskLevel ?? "reviewed",
      irreversible: entry?.irreversible ?? false,
      displayLabel: m.label,
      displayDescription: m.description,
      requiredContext: missingContext,
      ambiguityReason: ambiguity,
      availableNextStep: nextStep,
    };
  };

  if (isUnambiguous && confidence >= 0.5) {
    return {
      resolved: true,
      primaryIntent: buildIntent(top.mapping, confidence, null),
      candidates: [],
      rawInput: userIntentText,
      usedContext: context,
      failureReason: null,
    };
  }

  // 모호 → 상위 3개 candidate 반환
  const candidates = ranked.slice(0, 3).map((r, idx) =>
    buildIntent(
      r.mapping,
      Math.round((r.score / 60) * 100) / 100,
      idx === 0 ? null : `"${r.mapping.label}" 해석도 가능합니다`,
    ),
  );

  return {
    resolved: false,
    primaryIntent: null,
    candidates,
    rawInput: userIntentText,
    usedContext: context,
    failureReason: "여러 해석이 가능합니다. 아래에서 원하는 작업을 선택하세요.",
  };
}

// ══════════════════════════════════════════════════════════════
// Context-aware shortcut: 현재 page에서 가능한 intent 목록
// ══════════════════════════════════════════════════════════════

export function getAvailableIntentsForContext(
  context: ComposerWorkbenchContext,
): IntentMapping[] {
  return INTENT_MAPPINGS.filter((m) =>
    m.validStages.includes(context.workbenchStage) || m.validStages.includes(null),
  ) as IntentMapping[];
}

/**
 * 특정 intent를 직접 선택 (disambiguation card 클릭 시).
 * NL 파싱 없이 바로 확정 intent를 반환한다.
 */
export function selectIntent(
  intentType: GovernedIntentType,
  context: ComposerWorkbenchContext | null,
): IntentResolutionResult {
  const mapping = INTENT_MAPPINGS.find((m) => m.intentType === intentType);
  if (!mapping) {
    return {
      resolved: false,
      primaryIntent: null,
      candidates: [],
      rawInput: intentType,
      usedContext: context,
      failureReason: `알 수 없는 intent: ${intentType}`,
    };
  }

  const targetIds = context?.selectedEntityIds ?? [];
  const entry = ACTION_REGISTRY.find((a) => a.actionName === mapping.registryActionName);

  const missingContext = mapping.requiredContext.filter((key) => {
    if (key === "selectedEntityIds") return targetIds.length === 0;
    return false;
  });

  return {
    resolved: true,
    primaryIntent: {
      intentId: nextIntentId(),
      intentType: mapping.intentType,
      registryActionName: mapping.registryActionName,
      targetEntityType: entry?.targetObjectType ?? "PurchaseOrder",
      targetEntityIds: targetIds,
      confidence: 1.0,
      riskLevel: entry?.riskLevel ?? "reviewed",
      irreversible: entry?.irreversible ?? false,
      displayLabel: mapping.label,
      displayDescription: mapping.description,
      requiredContext: missingContext,
      ambiguityReason: null,
      availableNextStep: missingContext.length > 0 ? "needs_selection" : "dry_run",
    },
    candidates: [],
    rawInput: intentType,
    usedContext: context,
    failureReason: null,
  };
}
