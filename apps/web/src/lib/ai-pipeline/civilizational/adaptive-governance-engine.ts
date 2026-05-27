/**
 * 적응형 거버넌스 엔진 (Adaptive Governance Engine)
 *
 * 시스템 상태에 따라 거버넌스 규칙을 동적으로 평가·제안·채택·폐기합니다.
 * 안정/진화/위기/전환 네 가지 거버넌스 모드를 지원합니다.
 */

/** 거버넌스 모드 */
export type GovernanceMode = "STABLE" | "EVOLVING" | "CRISIS" | "TRANSITION";

/** 규칙 상태 */
export type RuleStatus = "PROPOSED" | "ACTIVE" | "RETIRED";

/** 거버넌스 규칙 */
export interface GovernanceRule {
  id: string;
  /** 규칙 범주 (예: "security", "compliance", "performance") */
  category: string;
  /** 규칙이 적용되는 조건 */
  condition: string;
  /** 조건 충족 시 수행할 조치 */
  action: string;
  /** 우선순위 (높을수록 우선) */
  priority: number;
  /** 규칙 버전 */
  version: number;
  /** 발효 시작일 */
  effectiveFrom: Date;
  /** 발효 종료일 (null이면 무기한) */
  effectiveTo: Date | null;
  status: RuleStatus;
}

/** 거버넌스 상태 평가 결과 */
export interface GovernanceState {
  mode: GovernanceMode;
  activeRules: number;
  proposedRules: number;
  retiredRules: number;
  healthScore: number;
  recommendation: string;
}

/** 거버넌스 변경 이력 */
export interface GovernanceHistoryEntry {
  ruleId: string;
  action: "PROPOSED" | "ADOPTED" | "RETIRED";
  timestamp: Date;
  reason: string;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const rules: GovernanceRule[] = [];
const history: GovernanceHistoryEntry[] = [];

let nextId = 1;
function genId(): string {
  return `gr-${Date.now()}-${nextId++}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 현재 거버넌스 상태를 평가합니다.
 */
export function evaluateGovernanceState(): GovernanceState {
  const now = new Date();
  const active = rules.filter(
    (r) =>
      r.status === "ACTIVE" &&
      r.effectiveFrom <= now &&
      (r.effectiveTo === null || r.effectiveTo >= now)
  );
  const proposed = rules.filter((r) => r.status === "PROPOSED");
  const retired = rules.filter((r) => r.status === "RETIRED");

  let mode: GovernanceMode;
  const ratio = active.length === 0 ? 0 : proposed.length / active.length;

  if (active.length === 0) mode = "CRISIS";
  else if (ratio > 0.5) mode = "TRANSITION";
  else if (proposed.length > 0) mode = "EVOLVING";
  else mode = "STABLE";

  const healthScore =
    active.length === 0
      ? 0
      : Math.min(1, active.length / (active.length + proposed.length));

  let recommendation: string;
  switch (mode) {
    case "CRISIS":
      recommendation = "즉시 핵심 규칙을 채택하십시오.";
      break;
    case "TRANSITION":
      recommendation = "제안된 규칙의 검토와 채택을 가속하십시오.";
      break;
    case "EVOLVING":
      recommendation = "제안 규칙을 순차적으로 검토하십시오.";
      break;
    default:
      recommendation = "현재 거버넌스가 안정 상태입니다.";
  }

  return {
    mode,
    activeRules: active.length,
    proposedRules: proposed.length,
    retiredRules: retired.length,
    healthScore: Math.round(healthScore * 100) / 100,
    recommendation,
  };
}

/**
 * 새 규칙 변경을 제안합니다.
 * @param params 규칙 파라미터
 * @param reason 제안 사유
 */
export function proposeRuleChange(
  params: {
    category: string;
    condition: string;
    action: string;
    priority?: number;
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
  },
  reason: string
): GovernanceRule {
  const rule: GovernanceRule = {
    id: genId(),
    category: params.category,
    condition: params.condition,
    action: params.action,
    priority: params.priority ?? 0,
    version: 1,
    effectiveFrom: params.effectiveFrom ?? new Date(),
    effectiveTo: params.effectiveTo ?? null,
    status: "PROPOSED",
  };
  rules.push(rule);
  history.push({
    ruleId: rule.id,
    action: "PROPOSED",
    timestamp: new Date(),
    reason,
  });
  return rule;
}

/**
 * 제안된 규칙을 채택합니다.
 * @param ruleId 규칙 ID
 * @param reason 채택 사유
 */
export function adoptRule(
  ruleId: string,
  reason: string
): { success: boolean; rule: GovernanceRule | null } {
  const rule = rules.find((r) => r.id === ruleId);
  if (!rule) return { success: false, rule: null };
  if (rule.status !== "PROPOSED") return { success: false, rule };

  rule.status = "ACTIVE";
  history.push({
    ruleId: rule.id,
    action: "ADOPTED",
    timestamp: new Date(),
    reason,
  });
  return { success: true, rule };
}

/**
 * 규칙을 폐기합니다.
 * @param ruleId 규칙 ID
 * @param reason 폐기 사유
 */
export function retireRule(
  ruleId: string,
  reason: string
): { success: boolean; rule: GovernanceRule | null } {
  const rule = rules.find((r) => r.id === ruleId);
  if (!rule) return { success: false, rule: null };

  rule.status = "RETIRED";
  rule.effectiveTo = new Date();
  history.push({
    ruleId: rule.id,
    action: "RETIRED",
    timestamp: new Date(),
    reason,
  });
  return { success: true, rule };
}

/**
 * 거버넌스 변경 이력을 반환합니다.
 * @param ruleId 특정 규칙 ID (생략 시 전체)
 */
export function getGovernanceHistory(
  ruleId?: string
): GovernanceHistoryEntry[] {
  const entries = ruleId
    ? history.filter((h) => h.ruleId === ruleId)
    : [...history];
  return entries.sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
}
