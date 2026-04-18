/**
 * Organization Policy Engine — 조직 단위 정책 룰셋
 *
 * approval control plane 위에 조직 특화 정책을 얹는 레이어.
 * generic permission/approval 규칙을 조직/팀/부서/사이트 단위로 세분화.
 *
 * POLICY SCOPE HIERARCHY (좁은 범위가 우선):
 * 1. site/location (가장 구체적)
 * 2. team/department
 * 3. organization
 * 4. system default (가장 일반적)
 *
 * POLICY DOMAINS:
 * Batch 1: budget_policy, vendor_policy, release_policy
 * Batch 2: restricted_item, reorder_policy, sod_exception_policy
 *
 * POLICY EVALUATION:
 * - 모든 scope에서 rule 수집
 * - narrowest scope wins (conflict precedence)
 * - 결과: allowed / warning / blocked + governing rule reference
 */

import type { StageActionKey, ActionRiskTier, ProcurementRole } from "./dispatch-v2-permission-policy-engine";

// ══════════════════════════════════════════════
// Policy Scope
// ══════════════════════════════════════════════

export type OrgPolicyScopeType = "system" | "organization" | "team" | "department" | "site" | "location";

export interface OrgPolicyScope {
  scopeType: OrgPolicyScopeType;
  scopeId: string;
  scopeLabel: string;
  /** 우선순위 (높을수록 구체적, 우선) */
  precedence: number;
}

const SCOPE_PRECEDENCE: Record<OrgPolicyScopeType, number> = {
  system: 0,
  organization: 10,
  department: 20,
  team: 30,
  site: 40,
  location: 50,
};

export function createScope(type: OrgPolicyScopeType, id: string, label: string): OrgPolicyScope {
  return { scopeType: type, scopeId: id, scopeLabel: label, precedence: SCOPE_PRECEDENCE[type] };
}

// ══════════════════════════════════════════════
// Policy Rule
// ══════════════════════════════════════════════

export type OrgPolicyDomain = "budget" | "vendor" | "release" | "restricted_item" | "reorder" | "sod_exception";

// ══════════════════════════════════════════════
// Policy Explanation (Batch 2 — explainability)
// ══════════════════════════════════════════════

export interface PolicyExplanation {
  domain: OrgPolicyDomain;
  effectiveEffect: OrgPolicyEffect;
  /** 사람이 읽을 수 있는 한 줄 설명 */
  summary: string;
  /** 이긴 규칙의 scope source */
  governingScopeSource: string;
  /** 이긴 규칙의 ID */
  governingRuleId: string | null;
  /** 매칭된 규칙 수 */
  matchedRuleCount: number;
  /** 무시된(overridden) 규칙들 */
  overriddenRules: Array<{ ruleId: string; scope: string; effect: OrgPolicyEffect; reason: string }>;
  /** 왜 이 effect가 적용됐는지 */
  whyThisEffect: string;
}

export function buildPolicyExplanation(decision: OrgPolicyDecision): PolicyExplanation {
  const matched = decision.matchedRules.filter(m => m.matched);
  const overridden = matched
    .filter(m => m.rule.ruleId !== decision.governingRule?.ruleId)
    .map(m => ({
      ruleId: m.rule.ruleId,
      scope: `${m.rule.scope.scopeType}:${m.rule.scope.scopeId}`,
      effect: m.rule.effect,
      reason: `더 넓은 scope (precedence ${m.rule.scope.precedence}) — 더 좁은 scope 정책이 우선`,
    }));

  const governingSource = decision.governingScope
    ? `${decision.governingScope.scopeType}:${decision.governingScope.scopeId} (${decision.governingScope.scopeLabel})`
    : "시스템 기본값";

  let whyThisEffect: string;
  if (!decision.governingRule) {
    whyThisEffect = "해당 도메인에 적용되는 조직 정책이 없어 기본 허용";
  } else if (decision.effectiveEffect === "block") {
    whyThisEffect = `${governingSource} 정책이 이 작업을 차단: ${decision.effectiveDetail}`;
  } else if (decision.effectiveEffect === "require_approval" || decision.effectiveEffect === "require_dual_approval") {
    whyThisEffect = `${governingSource} 정책이 승인을 요구: ${decision.effectiveDetail}`;
  } else if (decision.effectiveEffect === "warn") {
    whyThisEffect = `${governingSource} 정책이 주의 표시: ${decision.effectiveDetail}`;
  } else if (decision.effectiveEffect === "escalate") {
    whyThisEffect = `${governingSource} 정책이 에스컬레이션 요구: ${decision.effectiveDetail}`;
  } else {
    whyThisEffect = `${governingSource} 정책이 허용`;
  }

  return {
    domain: decision.domain,
    effectiveEffect: decision.effectiveEffect,
    summary: decision.effectiveDetail || "해당 정책 없음",
    governingScopeSource: governingSource,
    governingRuleId: decision.governingRule?.ruleId || null,
    matchedRuleCount: matched.length,
    overriddenRules: overridden,
    whyThisEffect,
  };
}

export type OrgPolicyEffect = "allow" | "warn" | "block" | "require_approval" | "require_dual_approval" | "escalate";

export interface OrgPolicyRule {
  ruleId: string;
  domain: OrgPolicyDomain;
  scope: OrgPolicyScope;
  // Condition
  conditionType: string;
  conditionValue: string | number | boolean;
  conditionOperator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in" | "contains";
  // Effect
  effect: OrgPolicyEffect;
  effectDetail: string;
  // Approval override
  approvalEscalationRole: ProcurementRole | null;
  dualApprovalRequired: boolean;
  overrideAllowed: boolean;
  overrideRequiresReason: boolean;
  // Metadata
  active: boolean;
  validFrom: string;
  validUntil: string | null;
  createdBy: string;
  createdAt: string;
  reason: string;
}

// ══════════════════════════════════════════════
// Policy Decision
// ══════════════════════════════════════════════

export interface OrgPolicyDecision {
  domain: OrgPolicyDomain;
  matchedRules: MatchedRule[];
  effectiveEffect: OrgPolicyEffect;
  effectiveDetail: string;
  governingRule: OrgPolicyRule | null;
  governingScope: OrgPolicyScope | null;
  overrideAvailable: boolean;
  overrideRequiresReason: boolean;
  escalationRole: ProcurementRole | null;
  dualApprovalRequired: boolean;
}

export interface MatchedRule {
  rule: OrgPolicyRule;
  matched: boolean;
  reason: string;
}

// ══════════════════════════════════════════════
// Policy Evaluation Context
// ══════════════════════════════════════════════

export interface OrgPolicyEvaluationContext {
  organizationId: string;
  departmentId: string;
  teamId: string;
  siteId: string;
  locationId: string;
  // Action context
  actionKey: StageActionKey;
  riskTier: ActionRiskTier;
  // Domain-specific
  totalAmount: number;
  vendorId: string;
  vendorName: string;
  itemCategoryId: string;
  itemClassification: string;
  releaseLocationId: string;
  releaseBinId: string;
  reorderQty: number;
}

// ══════════════════════════════════════════════
// Budget Policy
// ══════════════════════════════════════════════

export function evaluateBudgetPolicy(
  rules: OrgPolicyRule[],
  context: OrgPolicyEvaluationContext,
): OrgPolicyDecision {
  const budgetRules = rules
    .filter(r => r.domain === "budget" && r.active)
    .filter(r => isRuleInScope(r, context))
    .sort((a, b) => b.scope.precedence - a.scope.precedence);

  const matched: MatchedRule[] = [];
  let governing: OrgPolicyRule | null = null;

  for (const rule of budgetRules) {
    const threshold = typeof rule.conditionValue === "number" ? rule.conditionValue : Number(rule.conditionValue);
    let isMatch = false;

    switch (rule.conditionOperator) {
      case "gt": isMatch = context.totalAmount > threshold; break;
      case "gte": isMatch = context.totalAmount >= threshold; break;
      case "lt": isMatch = context.totalAmount < threshold; break;
      case "lte": isMatch = context.totalAmount <= threshold; break;
      default: isMatch = false;
    }

    matched.push({ rule, matched: isMatch, reason: isMatch ? `${context.totalAmount.toLocaleString()}원 ${rule.conditionOperator} ${threshold.toLocaleString()}원` : "" });

    if (isMatch && !governing) {
      governing = rule; // narrowest scope wins
    }
  }

  return buildDecision("budget", matched, governing);
}

// ══════════════════════════════════════════════
// Vendor Policy
// ══════════════════════════════════════════════

export function evaluateVendorPolicy(
  rules: OrgPolicyRule[],
  context: OrgPolicyEvaluationContext,
): OrgPolicyDecision {
  const vendorRules = rules
    .filter(r => r.domain === "vendor" && r.active)
    .filter(r => isRuleInScope(r, context))
    .sort((a, b) => b.scope.precedence - a.scope.precedence);

  const matched: MatchedRule[] = [];
  let governing: OrgPolicyRule | null = null;

  for (const rule of vendorRules) {
    let isMatch = false;
    const target = String(rule.conditionValue);

    switch (rule.conditionType) {
      case "vendor_id":
        isMatch = evaluateCondition(context.vendorId, rule.conditionOperator, target);
        break;
      case "vendor_status":
        isMatch = evaluateCondition(context.vendorName, rule.conditionOperator, target);
        break;
    }

    matched.push({ rule, matched: isMatch, reason: isMatch ? `Vendor ${context.vendorId}: ${rule.effectDetail}` : "" });
    if (isMatch && !governing) governing = rule;
  }

  return buildDecision("vendor", matched, governing);
}

// ══════════════════════════════════════════════
// Release Policy
// ══════════════════════════════════════════════

export function evaluateReleasePolicy(
  rules: OrgPolicyRule[],
  context: OrgPolicyEvaluationContext,
): OrgPolicyDecision {
  const releaseRules = rules
    .filter(r => r.domain === "release" && r.active)
    .filter(r => isRuleInScope(r, context))
    .sort((a, b) => b.scope.precedence - a.scope.precedence);

  const matched: MatchedRule[] = [];
  let governing: OrgPolicyRule | null = null;

  for (const rule of releaseRules) {
    let isMatch = false;

    switch (rule.conditionType) {
      case "release_location":
        isMatch = evaluateCondition(context.releaseLocationId, rule.conditionOperator, String(rule.conditionValue));
        break;
      case "release_bin":
        isMatch = evaluateCondition(context.releaseBinId, rule.conditionOperator, String(rule.conditionValue));
        break;
      case "release_qty":
        isMatch = evaluateCondition(String(context.reorderQty), rule.conditionOperator, String(rule.conditionValue));
        break;
    }

    matched.push({ rule, matched: isMatch, reason: isMatch ? `Release at ${context.releaseLocationId}: ${rule.effectDetail}` : "" });
    if (isMatch && !governing) governing = rule;
  }

  return buildDecision("release", matched, governing);
}

// ══════════════════════════════════════════════
// Restricted Item Policy (Batch 2)
// ══════════════════════════════════════════════

export function evaluateRestrictedItemPolicy(
  rules: OrgPolicyRule[],
  context: OrgPolicyEvaluationContext,
): OrgPolicyDecision {
  const itemRules = rules
    .filter(r => r.domain === "restricted_item" && r.active)
    .filter(r => isRuleInScope(r, context))
    .sort((a, b) => b.scope.precedence - a.scope.precedence);

  const matched: MatchedRule[] = [];
  let governing: OrgPolicyRule | null = null;

  for (const rule of itemRules) {
    let isMatch = false;

    switch (rule.conditionType) {
      case "item_category":
        isMatch = evaluateCondition(context.itemCategoryId, rule.conditionOperator, String(rule.conditionValue));
        break;
      case "item_classification":
        isMatch = evaluateCondition(context.itemClassification, rule.conditionOperator, String(rule.conditionValue));
        break;
    }

    matched.push({ rule, matched: isMatch, reason: isMatch ? `Item ${context.itemCategoryId}/${context.itemClassification}: ${rule.effectDetail}` : "" });
    if (isMatch && !governing) governing = rule;
  }

  return buildDecision("restricted_item", matched, governing);
}

// ══════════════════════════════════════════════
// Reorder Policy (Batch 2)
// ══════════════════════════════════════════════

export function evaluateReorderPolicy(
  rules: OrgPolicyRule[],
  context: OrgPolicyEvaluationContext,
): OrgPolicyDecision {
  const reorderRules = rules
    .filter(r => r.domain === "reorder" && r.active)
    .filter(r => isRuleInScope(r, context))
    .sort((a, b) => b.scope.precedence - a.scope.precedence);

  const matched: MatchedRule[] = [];
  let governing: OrgPolicyRule | null = null;

  for (const rule of reorderRules) {
    let isMatch = false;

    switch (rule.conditionType) {
      case "reorder_qty":
        isMatch = evaluateCondition(String(context.reorderQty), rule.conditionOperator, String(rule.conditionValue));
        break;
      case "reorder_amount":
        isMatch = evaluateCondition(String(context.totalAmount), rule.conditionOperator, String(rule.conditionValue));
        break;
      case "reorder_vendor":
        isMatch = evaluateCondition(context.vendorId, rule.conditionOperator, String(rule.conditionValue));
        break;
    }

    matched.push({ rule, matched: isMatch, reason: isMatch ? `Reorder ${context.reorderQty}: ${rule.effectDetail}` : "" });
    if (isMatch && !governing) governing = rule;
  }

  return buildDecision("reorder", matched, governing);
}

// ══════════════════════════════════════════════
// SoD Exception Policy (Batch 2)
// ══════════════════════════════════════════════

export function evaluateSoDExceptionPolicy(
  rules: OrgPolicyRule[],
  context: OrgPolicyEvaluationContext,
): OrgPolicyDecision {
  const sodRules = rules
    .filter(r => r.domain === "sod_exception" && r.active)
    .filter(r => isRuleInScope(r, context))
    .sort((a, b) => b.scope.precedence - a.scope.precedence);

  const matched: MatchedRule[] = [];
  let governing: OrgPolicyRule | null = null;

  for (const rule of sodRules) {
    let isMatch = false;

    switch (rule.conditionType) {
      case "risk_tier":
        isMatch = evaluateCondition(context.riskTier, rule.conditionOperator, String(rule.conditionValue));
        break;
      case "action_key":
        isMatch = evaluateCondition(context.actionKey, rule.conditionOperator, String(rule.conditionValue));
        break;
      case "amount_threshold":
        isMatch = evaluateCondition(String(context.totalAmount), rule.conditionOperator, String(rule.conditionValue));
        break;
    }

    matched.push({ rule, matched: isMatch, reason: isMatch ? `SoD exception for ${context.actionKey}: ${rule.effectDetail}` : "" });
    if (isMatch && !governing) governing = rule;
  }

  return buildDecision("sod_exception", matched, governing);
}

// ══════════════════════════════════════════════
// Unified Evaluation
// ══════════════════════════════════════════════

export function evaluateAllOrgPolicies(
  rules: OrgPolicyRule[],
  context: OrgPolicyEvaluationContext,
): OrgPolicyDecision[] {
  return [
    evaluateBudgetPolicy(rules, context),
    evaluateVendorPolicy(rules, context),
    evaluateReleasePolicy(rules, context),
    evaluateRestrictedItemPolicy(rules, context),
    evaluateReorderPolicy(rules, context),
    evaluateSoDExceptionPolicy(rules, context),
  ];
}

/**
 * buildAllPolicyExplanations — 모든 decision에 대한 설명 생성
 */
export function buildAllPolicyExplanations(decisions: OrgPolicyDecision[]): PolicyExplanation[] {
  return decisions.map(buildPolicyExplanation);
}

/**
 * mergeOrgPolicyDecisions — 여러 domain 결과를 하나의 effective decision으로 병합
 * 가장 restrictive effect가 최종 결과.
 */
export function mergeOrgPolicyDecisions(decisions: OrgPolicyDecision[]): {
  effectiveEffect: OrgPolicyEffect;
  effectiveDetail: string;
  allDecisions: OrgPolicyDecision[];
  hasBlock: boolean;
  hasWarning: boolean;
  requiresApproval: boolean;
  requiresDualApproval: boolean;
  escalationRole: ProcurementRole | null;
} {
  const EFFECT_PRIORITY: Record<OrgPolicyEffect, number> = {
    allow: 0, warn: 1, require_approval: 2, require_dual_approval: 3, escalate: 4, block: 5,
  };

  let maxEffect: OrgPolicyEffect = "allow";
  let maxDetail = "";
  let escalation: ProcurementRole | null = null;
  let dualRequired = false;

  for (const d of decisions) {
    if (EFFECT_PRIORITY[d.effectiveEffect] > EFFECT_PRIORITY[maxEffect]) {
      maxEffect = d.effectiveEffect;
      maxDetail = d.effectiveDetail;
    }
    if (d.escalationRole) escalation = d.escalationRole;
    if (d.dualApprovalRequired) dualRequired = true;
  }

  return {
    effectiveEffect: maxEffect,
    effectiveDetail: maxDetail,
    allDecisions: decisions,
    hasBlock: maxEffect === "block",
    hasWarning: maxEffect === "warn",
    requiresApproval: ["require_approval", "require_dual_approval", "escalate"].includes(maxEffect),
    requiresDualApproval: dualRequired || maxEffect === "require_dual_approval",
    escalationRole: escalation,
  };
}

// ══════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════

function isRuleInScope(rule: OrgPolicyRule, context: OrgPolicyEvaluationContext): boolean {
  switch (rule.scope.scopeType) {
    case "system": return true;
    case "organization": return rule.scope.scopeId === context.organizationId;
    case "department": return rule.scope.scopeId === context.departmentId;
    case "team": return rule.scope.scopeId === context.teamId;
    case "site": return rule.scope.scopeId === context.siteId;
    case "location": return rule.scope.scopeId === context.locationId;
    default: return false;
  }
}

function evaluateCondition(actual: string, operator: OrgPolicyRule["conditionOperator"], expected: string): boolean {
  switch (operator) {
    case "eq": return actual === expected;
    case "neq": return actual !== expected;
    case "gt": return Number(actual) > Number(expected);
    case "gte": return Number(actual) >= Number(expected);
    case "lt": return Number(actual) < Number(expected);
    case "lte": return Number(actual) <= Number(expected);
    case "in": return expected.split(",").map(s => s.trim()).includes(actual);
    case "not_in": return !expected.split(",").map(s => s.trim()).includes(actual);
    case "contains": return actual.includes(expected);
    default: return false;
  }
}

function buildDecision(domain: OrgPolicyDomain, matched: MatchedRule[], governing: OrgPolicyRule | null): OrgPolicyDecision {
  if (!governing) {
    return {
      domain, matchedRules: matched,
      effectiveEffect: "allow", effectiveDetail: "해당 정책 없음",
      governingRule: null, governingScope: null,
      overrideAvailable: false, overrideRequiresReason: false,
      escalationRole: null, dualApprovalRequired: false,
    };
  }

  return {
    domain, matchedRules: matched,
    effectiveEffect: governing.effect,
    effectiveDetail: governing.effectDetail,
    governingRule: governing,
    governingScope: governing.scope,
    overrideAvailable: governing.overrideAllowed,
    overrideRequiresReason: governing.overrideRequiresReason,
    escalationRole: governing.approvalEscalationRole,
    dualApprovalRequired: governing.dualApprovalRequired,
  };
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type OrgPolicyEventType = "org_policy_evaluated" | "org_policy_blocked" | "org_policy_warning" | "org_policy_override_attempted";
export interface OrgPolicyEvent { type: OrgPolicyEventType; domain: OrgPolicyDomain; scopeType: OrgPolicyScopeType; ruleId: string; effect: OrgPolicyEffect; caseId: string; actorId: string; detail: string; timestamp: string; }
