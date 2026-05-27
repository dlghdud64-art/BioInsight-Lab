/**
 * LabAxis Public Narrative Spine — AI + non-AI 통합 서사 구조
 *
 * 제품 본체는 연구 구매 운영 OS.
 * AI는 그 위의 operating layer.
 * operator boundary는 모든 surface에서 유지.
 *
 * 모든 페이지 문장은 이 backbone을 확장하거나 구체화한다.
 * backbone과 충돌하는 표현은 제거한다.
 */

// ══════════════════════════════════════════════════════════════════════════════
// Narrative Spine — 4문장 backbone
// ══════════════════════════════════════════════════════════════════════════════

export const NARRATIVE_SPINE = {
  productDefinition:
    "LabAxis는 시약·장비 검색, 비교, 요청, 구매 운영을 연결하는 연구 구매 운영 OS다.",
  workflowProblem:
    "연구팀의 실제 문제는 검색 자체가 아니라, 무엇을 먼저 검토하고 어떻게 비교하고 언제 요청으로 넘길지 흐름이 끊기는 데 있다.",
  workflowSolution:
    "LabAxis는 검색 결과를 작업 가능한 후보로 정리하고, 비교와 요청 준비를 같은 workbench 흐름 안에서 이어지게 만든다.",
  aiLayerPosition:
    "AI는 이 흐름 안에서 3개의 전략안/판단안을 제안해 다음 단계를 더 빠르게 검토할 수 있게 돕지만, 시작·선택·반영·전송은 운영자가 직접 결정한다.",
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Non-AI Product Sentence Bank
// ══════════════════════════════════════════════════════════════════════════════

export const PRODUCT_NARRATIVE_BANK = {
  productDefinition: [
    "LabAxis는 시약·장비 검색, 비교, 요청, 구매 운영을 연결하는 연구 구매 운영 OS입니다.",
    "연구팀의 구매 검토와 운영 흐름을 한 workbench 안에서 이어지게 합니다.",
  ],
  workflowProblem: [
    "실제 병목은 검색 자체보다, 무엇을 먼저 검토하고 어떻게 비교하고 언제 요청으로 넘길지 흐름이 끊기는 데 있습니다.",
    "연구 구매는 결과를 찾는 것보다, 검토와 다음 단계 handoff를 일관되게 만드는 것이 더 어렵습니다.",
  ],
  workflowSolution: [
    "LabAxis는 검색 결과를 작업 가능한 후보로 정리하고 compare와 request 준비를 같은 흐름으로 연결합니다.",
    "검색 이후의 비교 판단과 요청 준비를 separate task가 아니라 하나의 운영 흐름으로 다룹니다.",
  ],
  workbenchExplanation: [
    "각 단계는 결과 조회가 아니라 실제로 다음 결정을 준비하는 작업면으로 구성됩니다.",
    "list, detail, review, request preparation이 하나의 operating surface 안에서 이어집니다.",
  ],
  teamOperationalValue: [
    "팀은 같은 후보군과 같은 판단 기준을 바탕으로 검토를 이어갈 수 있습니다.",
    "요청 준비와 운영 판단을 더 일관된 기준으로 관리할 수 있습니다.",
  ],
  operatorDecisionBoundary: [
    "최종 시작, 선택, 반영, 전송은 운영자가 직접 결정합니다.",
    "LabAxis는 판단을 대신하는 것이 아니라 더 빠르게 구조화하는 방향으로 설계되었습니다.",
  ],
  pricingScope: [
    "플랜별로 검색 정리, 비교 판단, 요청 준비, 조직 운영 범위를 넓혀갈 수 있습니다.",
    "가격 차이는 자동화 수준이 아니라 운영 범위와 관리 깊이의 차이를 반영합니다.",
  ],
  supportExpectation: [
    "현재 운영 흐름과 도입 범위에 맞는 사용 방식을 안내합니다.",
    "지금 가능한 범위와 운영자가 직접 결정해야 하는 지점을 함께 설명합니다.",
  ],
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Section Composition Rule
// ══════════════════════════════════════════════════════════════════════════════

/**
 * 한 section은 가능하면 아래 3층으로 구성한다.
 * 1. non-AI product statement (무엇을 위한 surface인가)
 * 2. AI operating layer statement (AI가 무엇을 돕는가)
 * 3. operator boundary statement (operator가 무엇을 결정하는가)
 *
 * 금지:
 * - AI sentence만 단독으로 section 채우기
 * - operator boundary 없는 AI capability 문장 단독 사용
 * - non-AI 설명 없이 AI headline만 세우기
 */
export const SECTION_COMPOSITION_RULE = {
  layer1: "non-AI product/workflow statement",
  layer2: "AI operating layer statement",
  layer3: "operator boundary statement",
  requirement: "layer1 필수, layer2+layer3는 AI 관련 section에서만",
  forbidden: [
    "AI sentence만 단독 section",
    "operator boundary 없는 AI capability 단독",
    "non-AI 설명 없는 AI headline",
  ],
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Page Role Definitions
// ══════════════════════════════════════════════════════════════════════════════

export const PAGE_NARRATIVE_ROLES = {
  landing: {
    role: "product definition + category creation + operating promise",
    core: "LabAxis는 검색 툴이 아니라 운영 OS다",
    aiPosition: "operating layer — 제품 본체 뒤에 위치",
  },
  intro: {
    role: "workflow explanation + workbench structure",
    core: "sourcing/compare/request가 어떻게 이어지는가",
    aiPosition: "각 stage 안에서 전략안/판단안 제안",
  },
  pricing: {
    role: "capability scope + operational maturity alignment",
    core: "운영 범위가 어떻게 넓어지는가 (automation ladder 아님)",
    aiPosition: "해당 범위 안의 operating assistance",
  },
  support: {
    role: "expectation setting + boundary explanation",
    core: "지금 무엇이 가능하고 무엇은 운영자가 직접 하는가",
    aiPosition: "current implementation 이내 설명",
  },
  sales: {
    role: "current capability + future scope 분리",
    core: "public truth 이내, 과장 금지",
    aiPosition: "current implementation 이내 + enterprise는 협의 수준",
  },
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// Cross-Page Narrative Regression Watchouts
// ══════════════════════════════════════════════════════════════════════════════

export const NARRATIVE_REGRESSION_WATCHOUTS = [
  "랜딩은 OS인데 pricing은 협업 SaaS처럼 보임",
  "소개는 workflow product인데 sales는 AI assistant처럼 설명",
  "지원/FAQ가 public보다 더 과장됨",
  "AI가 본체처럼 보이고 workflow 설명이 약해짐",
  "operator boundary가 hero에만 있고 pricing/support에서 사라짐",
  "Enterprise가 autonomous tier처럼 읽힘",
  "sourcing/compare/request stage 의미가 퍼블릭 narrative에서 섞임",
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// Polish Gate
// ══════════════════════════════════════════════════════════════════════════════

export interface PublicNarrativePolishGate {
  productDefinitionConsistent: boolean;
  workflowStoryConsistent: boolean;
  aiLayerPositionCorrect: boolean;
  operatorBoundaryExplicit: boolean;
  pricingAsScopeNotAutomation: boolean;
  supportSalesStayWithinTruth: boolean;
  canonicalBanksAligned: boolean;
  noNarrativeDriftAcrossPages: boolean;
}

export interface PublicNarrativePolishResult {
  polished: boolean;
  failedChecks: string[];
}

export function evaluatePublicNarrativePolish(
  input: PublicNarrativePolishGate
): PublicNarrativePolishResult {
  const failedChecks: string[] = [];
  const entries = Object.entries(input) as [keyof PublicNarrativePolishGate, boolean][];
  for (const [key, value] of entries) {
    if (!value) failedChecks.push(key);
  }
  return { polished: failedChecks.length === 0, failedChecks };
}

// ══════════════════════════════════════════════════════════════════════════════
// Current Evaluation
// ══════════════════════════════════════════════════════════════════════════════

export const CURRENT_NARRATIVE_POLISH_EVALUATION: PublicNarrativePolishGate = {
  productDefinitionConsistent: true,    // 모든 페이지가 '연구 구매 운영 OS' 정의 사용
  workflowStoryConsistent: true,        // sourcing→compare→request→send flow 유지
  aiLayerPositionCorrect: true,         // AI는 operating layer, 제품 본체가 아님
  operatorBoundaryExplicit: true,       // critical surface에 operator boundary 명시
  pricingAsScopeNotAutomation: true,    // 운영 범위 차이, automation ladder 아님
  supportSalesStayWithinTruth: true,    // public truth 이내 유지
  canonicalBanksAligned: true,          // AI bank + non-AI bank + composition rule 정렬
  noNarrativeDriftAcrossPages: true,    // cross-page 동일 제품 narrative
};
