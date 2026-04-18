/**
 * LabAxis AI Decision Option Set — 3-option 반자동 운영형 decision support
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * AI 기본 출력 = single answer가 아니라 3-option set.
 * 각 안은 이름만 다른 게 아니라 비교 가능한 decision package.
 * 운영자가 최종 선택/수정/승인. AI는 선택을 강제하지 않음.
 *
 * Option A: 보수형 — 리스크 최소화, 현재 기준 유지
 * Option B: 균형형 — 비용·납기·적합성 균형
 * Option C: 대안형 — 속도, 비용 절감, 대체 가능성 탐색
 *
 * UI 참조: mission-grade operating surface
 *   queue/list = 우선 검토 대상
 *   center work = 현재 decision object
 *   right rail = 근거 / 리스크 / 보조 해석
 *   bottom dock = 운영자 승인 / 다음 단계 commit
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ── Core option types ──

export type DecisionOptionFrame = "conservative" | "balanced" | "alternative";

export interface DecisionOptionRisk {
  id: string;
  label: string;
  severity: "low" | "medium" | "high";
}

export interface DecisionOption {
  id: string;
  frame: DecisionOptionFrame;
  title: string;
  rationale: string;
  strengths: string[];
  risks: DecisionOptionRisk[];
  recommendedUseCase: string;
  nextAction: string;
  confidence: number; // 0-1
}

export interface DecisionOptionSet {
  id: string;
  scope: DecisionOptionScope;
  targetId: string;
  contextHash: string;
  options: [DecisionOption, DecisionOption, DecisionOption]; // 항상 3개
  defaultHighlight: DecisionOptionFrame; // 초기 강조 (선택 아님)
  generatedAt: string;
}

// ── Scope ──

export type DecisionOptionScope =
  | "sourcing_strategy"
  | "compare_decision"
  | "request_strategy";

// ── Sourcing strategy options ──

export interface SourcingStrategyContext {
  query: string;
  products: Array<{
    id: string;
    name: string;
    brand?: string;
    priceKRW?: number;
    leadTimeDays?: number;
    specMatchScore?: number;
  }>;
  compareIds: string[];
  requestIds: string[];
}

export const SOURCING_STRATEGY_FRAMES = {
  conservative: {
    title: "최저가 우선",
    description: "가격이 가장 낮은 후보를 비교 대상으로 묶어 비용 리스크를 최소화합니다.",
    emphasis: "cost",
  },
  balanced: {
    title: "납기·가격 균형",
    description: "비용과 납기를 함께 고려해 실무 운영에 가장 균형 잡힌 후보를 묶습니다.",
    emphasis: "balanced",
  },
  alternative: {
    title: "규격 안정성 우선",
    description: "규격 일치도가 높은 후보를 우선 묶어 실험 결과 재현성과 안정성을 확보합니다.",
    emphasis: "spec",
  },
} as const;

// ── Compare decision options ──

export interface CompareDecisionContext {
  compareSessionId: string;
  products: Array<{
    id: string;
    name: string;
    brand?: string;
    priceKRW?: number;
    leadTimeDays?: number;
    specMatchScore?: number;
  }>;
  compareMode: string;
  selectedDecisionItemId: string | null;
}

export const COMPARE_DECISION_FRAMES = {
  conservative: {
    title: "비용 중심안",
    description: "총 비용이 가장 낮은 제품을 기준안으로 제안합니다. 예산 리스크를 최소화합니다.",
    emphasis: "cost",
  },
  balanced: {
    title: "균형형 기준안",
    description: "비용, 납기, 규격 적합성을 종합적으로 고려한 기준안을 제안합니다.",
    emphasis: "balanced",
  },
  alternative: {
    title: "규격·안정성 중심안",
    description: "규격 일치도와 공급 안정성을 최우선으로 한 기준안을 제안합니다.",
    emphasis: "spec",
  },
} as const;

// ── Request strategy options ──

export interface RequestStrategyContext {
  vendorName: string;
  items: Array<{ productName: string; quantity: number; catalogNumber?: string }>;
  messageBody: string;
  leadTimeIncluded: boolean;
  substituteIncluded: boolean;
  missingFields: string[];
}

export const REQUEST_STRATEGY_FRAMES = {
  conservative: {
    title: "간단 확인안",
    description: "최소 문의만 포함합니다. 빠른 회신이 필요하거나 기존 거래처에 적합합니다.",
    emphasis: "minimal",
  },
  balanced: {
    title: "표준 견적안",
    description: "납기 문의, 대체 가능 여부, 주요 스펙 확인을 포함한 표준 견적 요청입니다.",
    emphasis: "standard",
  },
  alternative: {
    title: "확장 검토안",
    description: "납기/대체/첨부/추가 질문을 모두 포함합니다. 신규 공급사나 고가 품목에 적합합니다.",
    emphasis: "extended",
  },
} as const;

// ── Builder helpers ──

let _counter = 0;
function uid(): string {
  return `dopt_${Date.now()}_${++_counter}`;
}

export function createOptionSetId(): string {
  return `dset_${Date.now()}_${++_counter}`;
}

export function buildEmptyDecisionOption(
  frame: DecisionOptionFrame,
  frameDef: { title: string; description: string }
): DecisionOption {
  return {
    id: uid(),
    frame,
    title: frameDef.title,
    rationale: frameDef.description,
    strengths: [],
    risks: [],
    recommendedUseCase: "",
    nextAction: "",
    confidence: 0,
  };
}

// ── Operator actions ──

export type OperatorDecisionAction =
  | { type: "select_as_baseline"; optionId: string }
  | { type: "send_to_request"; optionId: string }
  | { type: "keep_in_compare"; optionId: string }
  | { type: "apply_request_strategy"; optionId: string }
  | { type: "dismiss_option_set" }
  | { type: "modify_and_apply"; optionId: string };

// ── Completion criteria ──

export const DECISION_OPTION_SET_COMPLETION_CRITERIA = [
  "단일 추천이 아니라 3안이 구조적으로 비교 가능",
  "각 안의 rationale/strength/risk가 읽힘",
  "operator selection boundary가 유지됨",
  "right rail / center work / dock과 역할 충돌이 없음",
  "AI가 recommendation gimmick이 아니라 operating decision support처럼 보임",
] as const;

// ── Human-in-the-loop invariants ──

export const HUMAN_IN_THE_LOOP_INVARIANTS = [
  "AI는 선택을 강제하지 않는다",
  "자동 선택/자동 확정/자동 전송 금지",
  "최종 선택/수정/승인은 항상 운영자",
  "AI는 반자동으로 다음 단계를 준비할 뿐",
  "선택안을 제시하되 기본 선택 없이 운영자가 직접 고른다",
] as const;
