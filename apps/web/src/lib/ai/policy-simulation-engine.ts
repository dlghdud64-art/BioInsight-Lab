/**
 * Policy Simulation Engine — 정책 변경 전 영향 미리보기
 *
 * "이 정책을 publish하면 어떻게 되는가?"를 실행 전에 시뮬레이션.
 *
 * SIMULATION MODES:
 * 1. rule_precedence_preview — draft rules의 scope 우선순위 미리보기
 * 2. winning_rule_simulation — 특정 context에서 어떤 rule이 이기는지
 * 3. approval_impact_simulation — 정책 변경이 approval requirement에 미치는 영향
 * 4. escalation_impact_simulation — 정책 변경이 escalation에 미치는 영향
 * 5. before_after_comparison — 현재 active vs draft 적용 결과 비교
 */

import {
  evaluateAllOrgPolicies,
  mergeOrgPolicyDecisions,
  buildAllPolicyExplanations,
  type OrgPolicyRule,
  type OrgPolicyDomain,
  type OrgPolicyDecision,
  type OrgPolicyEffect,
  type OrgPolicyEvaluationContext,
  type PolicyExplanation,
} from "./organization-policy-engine";
import type { PolicyVersion } from "./policy-admin-lifecycle-engine";

// ══════════════════════════════════════════════
// Simulation Request
// ══════════════════════════════════════════════

export interface PolicySimulationRequest {
  simulationId: string;
  mode: "rule_precedence" | "winning_rule" | "approval_impact" | "escalation_impact" | "before_after";
  // Draft rules to simulate
  draftRules: OrgPolicyRule[];
  // Current active rules (for comparison)
  activeRules: OrgPolicyRule[];
  // Test context
  testContext: OrgPolicyEvaluationContext;
  // Test cases (for batch simulation)
  testCases?: OrgPolicyEvaluationContext[];
  requestedBy: string;
  requestedAt: string;
}

// ══════════════════════════════════════════════
// Simulation Results
// ══════════════════════════════════════════════

// 1. Rule Precedence Preview
export interface RulePrecedencePreview {
  rules: Array<{
    ruleId: string;
    domain: OrgPolicyDomain;
    scopeType: string;
    scopePrecedence: number;
    effect: OrgPolicyEffect;
    conditionSummary: string;
    wouldWin: boolean;
    wouldBeOverridden: boolean;
    overriddenBy: string | null;
  }>;
  winnerRuleId: string | null;
  winnerScope: string;
  totalRules: number;
}

// 2. Winning Rule Simulation
export interface WinningRuleSimulation {
  context: OrgPolicyEvaluationContext;
  decisions: OrgPolicyDecision[];
  explanations: PolicyExplanation[];
  effectiveEffect: OrgPolicyEffect;
  winningDomain: OrgPolicyDomain | null;
  winningRuleId: string | null;
  winningScope: string;
}

// 3. Approval Impact
export interface ApprovalImpactSimulation {
  beforeApprovalRequired: boolean;
  afterApprovalRequired: boolean;
  beforeDualRequired: boolean;
  afterDualRequired: boolean;
  beforeEscalationRequired: boolean;
  afterEscalationRequired: boolean;
  impactSummary: string;
  impactLevel: "no_change" | "relaxed" | "tightened" | "mixed";
}

// 4. Before/After Comparison
export interface BeforeAfterComparison {
  testCaseCount: number;
  results: Array<{
    context: OrgPolicyEvaluationContext;
    beforeEffect: OrgPolicyEffect;
    afterEffect: OrgPolicyEffect;
    changed: boolean;
    changeDirection: "relaxed" | "tightened" | "no_change";
    beforeExplanation: string;
    afterExplanation: string;
  }>;
  summary: {
    totalChanged: number;
    relaxedCount: number;
    tightenedCount: number;
    noChangeCount: number;
  };
}

// ══════════════════════════════════════════════
// Full Simulation Result
// ══════════════════════════════════════════════

export interface PolicySimulationResult {
  simulationId: string;
  mode: PolicySimulationRequest["mode"];
  precedencePreview: RulePrecedencePreview | null;
  winningRuleSimulation: WinningRuleSimulation | null;
  approvalImpact: ApprovalImpactSimulation | null;
  beforeAfter: BeforeAfterComparison | null;
  warnings: string[];
  generatedAt: string;
}

// ══════════════════════════════════════════════
// Run Simulation
// ══════════════════════════════════════════════

export function runPolicySimulation(request: PolicySimulationRequest): PolicySimulationResult {
  const warnings: string[] = [];
  let precedencePreview: RulePrecedencePreview | null = null;
  let winningRuleSimulation: WinningRuleSimulation | null = null;
  let approvalImpact: ApprovalImpactSimulation | null = null;
  let beforeAfter: BeforeAfterComparison | null = null;

  // 1. Rule Precedence Preview
  if (request.mode === "rule_precedence" || request.mode === "before_after") {
    precedencePreview = simulateRulePrecedence(request.draftRules, request.testContext);
  }

  // 2. Winning Rule Simulation
  if (request.mode === "winning_rule" || request.mode === "before_after") {
    winningRuleSimulation = simulateWinningRule(request.draftRules, request.testContext);
  }

  // 3. Approval Impact
  if (request.mode === "approval_impact" || request.mode === "before_after") {
    approvalImpact = simulateApprovalImpact(request.activeRules, request.draftRules, request.testContext);
  }

  // 4. Before/After
  if (request.mode === "before_after") {
    const testCases = request.testCases || [request.testContext];
    beforeAfter = simulateBeforeAfter(request.activeRules, request.draftRules, testCases);

    if (beforeAfter.summary.tightenedCount > 0) {
      warnings.push(`${beforeAfter.summary.tightenedCount}건의 테스트 케이스에서 통제가 강화됩니다`);
    }
    if (beforeAfter.summary.relaxedCount > 0) {
      warnings.push(`${beforeAfter.summary.relaxedCount}건의 테스트 케이스에서 통제가 완화됩니다`);
    }
  }

  return {
    simulationId: request.simulationId,
    mode: request.mode,
    precedencePreview,
    winningRuleSimulation,
    approvalImpact,
    beforeAfter,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════
// Internal Simulation Functions
// ══════════════════════════════════════════════

function simulateRulePrecedence(
  rules: OrgPolicyRule[],
  context: OrgPolicyEvaluationContext,
): RulePrecedencePreview {
  const sorted = [...rules]
    .filter(r => r.active)
    .sort((a, b) => b.scope.precedence - a.scope.precedence);

  let winnerId: string | null = null;

  const preview = sorted.map((rule, idx) => {
    const isFirst = idx === 0;
    if (isFirst) winnerId = rule.ruleId;

    return {
      ruleId: rule.ruleId,
      domain: rule.domain,
      scopeType: rule.scope.scopeType,
      scopePrecedence: rule.scope.precedence,
      effect: rule.effect,
      conditionSummary: `${rule.conditionType} ${rule.conditionOperator} ${rule.conditionValue}`,
      wouldWin: isFirst,
      wouldBeOverridden: !isFirst,
      overriddenBy: isFirst ? null : winnerId,
    };
  });

  return {
    rules: preview,
    winnerRuleId: winnerId,
    winnerScope: sorted[0]?.scope.scopeType || "none",
    totalRules: preview.length,
  };
}

function simulateWinningRule(
  rules: OrgPolicyRule[],
  context: OrgPolicyEvaluationContext,
): WinningRuleSimulation {
  const decisions = evaluateAllOrgPolicies(rules, context);
  const explanations = buildAllPolicyExplanations(decisions);
  const merged = mergeOrgPolicyDecisions(decisions);

  const winningDecision = decisions.find(d => d.effectiveEffect === merged.effectiveEffect && d.governingRule);

  return {
    context,
    decisions,
    explanations,
    effectiveEffect: merged.effectiveEffect,
    winningDomain: winningDecision?.domain || null,
    winningRuleId: winningDecision?.governingRule?.ruleId || null,
    winningScope: winningDecision?.governingScope ? `${winningDecision.governingScope.scopeType}:${winningDecision.governingScope.scopeId}` : "none",
  };
}

function simulateApprovalImpact(
  activeRules: OrgPolicyRule[],
  draftRules: OrgPolicyRule[],
  context: OrgPolicyEvaluationContext,
): ApprovalImpactSimulation {
  const beforeMerge = mergeOrgPolicyDecisions(evaluateAllOrgPolicies(activeRules, context));
  const afterMerge = mergeOrgPolicyDecisions(evaluateAllOrgPolicies(draftRules, context));

  let impactLevel: ApprovalImpactSimulation["impactLevel"] = "no_change";
  const changes: string[] = [];

  if (beforeMerge.requiresApproval !== afterMerge.requiresApproval) {
    changes.push(afterMerge.requiresApproval ? "승인 필요 추가" : "승인 필요 해제");
  }
  if (beforeMerge.requiresDualApproval !== afterMerge.requiresDualApproval) {
    changes.push(afterMerge.requiresDualApproval ? "이중 승인 추가" : "이중 승인 해제");
  }
  if (beforeMerge.hasBlock !== afterMerge.hasBlock) {
    changes.push(afterMerge.hasBlock ? "차단 추가" : "차단 해제");
  }

  if (changes.length === 0) {
    impactLevel = "no_change";
  } else {
    const EFFECT_SEVERITY: Record<OrgPolicyEffect, number> = { allow: 0, warn: 1, require_approval: 2, require_dual_approval: 3, escalate: 4, block: 5 };
    const beforeSev = EFFECT_SEVERITY[beforeMerge.effectiveEffect] || 0;
    const afterSev = EFFECT_SEVERITY[afterMerge.effectiveEffect] || 0;
    impactLevel = afterSev > beforeSev ? "tightened" : afterSev < beforeSev ? "relaxed" : "mixed";
  }

  return {
    beforeApprovalRequired: beforeMerge.requiresApproval,
    afterApprovalRequired: afterMerge.requiresApproval,
    beforeDualRequired: beforeMerge.requiresDualApproval,
    afterDualRequired: afterMerge.requiresDualApproval,
    beforeEscalationRequired: beforeMerge.escalationRole !== null,
    afterEscalationRequired: afterMerge.escalationRole !== null,
    impactSummary: changes.length > 0 ? changes.join(", ") : "변경 없음",
    impactLevel,
  };
}

function simulateBeforeAfter(
  activeRules: OrgPolicyRule[],
  draftRules: OrgPolicyRule[],
  testCases: OrgPolicyEvaluationContext[],
): BeforeAfterComparison {
  const EFFECT_SEVERITY: Record<OrgPolicyEffect, number> = { allow: 0, warn: 1, require_approval: 2, require_dual_approval: 3, escalate: 4, block: 5 };

  const results = testCases.map(context => {
    const beforeMerge = mergeOrgPolicyDecisions(evaluateAllOrgPolicies(activeRules, context));
    const afterMerge = mergeOrgPolicyDecisions(evaluateAllOrgPolicies(draftRules, context));

    const beforeSev = EFFECT_SEVERITY[beforeMerge.effectiveEffect] || 0;
    const afterSev = EFFECT_SEVERITY[afterMerge.effectiveEffect] || 0;

    return {
      context,
      beforeEffect: beforeMerge.effectiveEffect,
      afterEffect: afterMerge.effectiveEffect,
      changed: beforeMerge.effectiveEffect !== afterMerge.effectiveEffect,
      changeDirection: (afterSev > beforeSev ? "tightened" : afterSev < beforeSev ? "relaxed" : "no_change") as "relaxed" | "tightened" | "no_change",
      beforeExplanation: beforeMerge.effectiveDetail,
      afterExplanation: afterMerge.effectiveDetail,
    };
  });

  return {
    testCaseCount: testCases.length,
    results,
    summary: {
      totalChanged: results.filter(r => r.changed).length,
      relaxedCount: results.filter(r => r.changeDirection === "relaxed").length,
      tightenedCount: results.filter(r => r.changeDirection === "tightened").length,
      noChangeCount: results.filter(r => r.changeDirection === "no_change").length,
    },
  };
}
