/**
 * Policy-Approval Conflict Diagnostics Engine
 *
 * org policy / risk tier / approval rule / escalation rule이 동시에 걸릴 때
 * 최종 승자와 이유를 한 번에 설명하는 canonical payload 생성.
 *
 * SINGLE TRUTH CONTRACT:
 * - dashboard / inbox / workbench / export가 같은 explanation payload 참조
 * - UI가 approval reason을 재계산하지 않음
 * - 같은 case에서 "왜 blocked / 왜 dual / 왜 escalation"을 1개 payload로 설명
 *
 * CONFLICT AXES:
 * 1. policy_vs_policy — 서로 다른 org policy domain 간 충돌
 * 2. policy_vs_risk — org policy effect vs risk tier requirement 충돌
 * 3. approval_vs_sod — approval 가능 vs SoD 위반
 * 4. scope_precedence — 동일 domain 내 narrowest wins 적용 trace
 */

import type {
  OrgPolicyDecision,
  OrgPolicyDomain,
  OrgPolicyEffect,
  OrgPolicyScopeType,
  PolicyExplanation,
  OrgPolicyRule,
} from "./organization-policy-engine";
import type {
  PermissionCheckResult,
  ApprovalRequirementV2,
  StageActionKey,
  ActionRiskTier,
  ProcurementRole,
} from "./dispatch-v2-permission-policy-engine";
import type { SoDCheckResult } from "./separation-of-duties-engine";

// ══════════════════════════════════════════════
// Effective Source Types
// ══════════════════════════════════════════════

export type EffectiveApprovalSource = "risk_tier" | "org_policy" | "combined" | "none";
export type EffectiveEscalationSource =
  | "budget_policy" | "vendor_policy" | "release_policy"
  | "restricted_item" | "reorder_policy" | "sod_exception"
  | "risk_tier" | "combined" | "none";

// ══════════════════════════════════════════════
// Conflict Diagnostic Types
// ══════════════════════════════════════════════

export interface PolicyVsPolicyConflict {
  domainA: OrgPolicyDomain;
  effectA: OrgPolicyEffect;
  scopeA: string;
  domainB: OrgPolicyDomain;
  effectB: OrgPolicyEffect;
  scopeB: string;
  resolution: string;
  winner: OrgPolicyDomain;
}

export interface PolicyVsRiskConflict {
  policyEffect: OrgPolicyEffect;
  policyDomain: OrgPolicyDomain;
  policyScope: string;
  riskTierRequirement: string;
  riskTier: ActionRiskTier;
  resolution: string;
  effectiveSource: EffectiveApprovalSource;
}

export interface ApprovalVsSoDConflict {
  approvalAllowed: boolean;
  sodAllowed: boolean;
  sodViolations: string[];
  resolution: string;
  effectiveResult: "blocked_by_sod" | "allowed" | "approval_needed_plus_sod_check";
}

export interface ScopePrecedenceTrace {
  domain: OrgPolicyDomain;
  matchedScopes: Array<{
    scopeType: OrgPolicyScopeType;
    scopeId: string;
    precedence: number;
    effect: OrgPolicyEffect;
    isWinner: boolean;
  }>;
  winnerScope: string;
  winnerEffect: OrgPolicyEffect;
}

export interface ConflictDiagnostics {
  policyVsPolicy: PolicyVsPolicyConflict[];
  policyVsRisk: PolicyVsRiskConflict[];
  approvalVsSod: ApprovalVsSoDConflict | null;
  scopePrecedence: ScopePrecedenceTrace[];
  hasConflicts: boolean;
  conflictCount: number;
  conflictSummary: string;
}

// ══════════════════════════════════════════════
// Winning/Overridden Rule Tracking
// ══════════════════════════════════════════════

export interface WinningPolicyRule {
  ruleId: string;
  domain: OrgPolicyDomain;
  scopeType: OrgPolicyScopeType;
  scopeId: string;
  effect: OrgPolicyEffect;
  detail: string;
  source: "org_policy" | "risk_tier";
}

export interface OverriddenPolicyRule {
  ruleId: string;
  domain: OrgPolicyDomain;
  scopeType: OrgPolicyScopeType;
  effect: OrgPolicyEffect;
  overriddenBy: string;
  reason: string;
}

// ══════════════════════════════════════════════
// Canonical Conflict Diagnostics Payload
// ══════════════════════════════════════════════

export interface PolicyApprovalConflictPayload {
  // Identity
  caseId: string;
  actionKey: StageActionKey;
  riskTier: ActionRiskTier;

  // Effective sources
  effectiveApprovalSource: EffectiveApprovalSource;
  effectiveEscalationSource: EffectiveEscalationSource;

  // Rule tracking
  winningPolicyRules: WinningPolicyRule[];
  overriddenPolicyRules: OverriddenPolicyRule[];

  // Reason codes
  dualApprovalReasonCodes: string[];
  escalationReasonCodes: string[];
  blockReasonCodes: string[];

  // Explanations
  whyThisEffect: string;
  whyThisApprovalPath: string;

  // Conflict diagnostics
  conflictDiagnostics: ConflictDiagnostics;

  // Operator-safe summary (한 줄 설명)
  operatorSafeSummary: string;

  // Audit-safe trace (감사용 전체 trace)
  auditSafeTrace: string[];

  // Final effective state
  effectivePermitted: boolean;
  effectiveRequiresApproval: boolean;
  effectiveRequiresDualApproval: boolean;
  effectiveRequiresEscalation: boolean;
  effectiveApproverRole: ProcurementRole | null;
  effectiveEscalationRole: ProcurementRole | null;

  generatedAt: string;
}

// ══════════════════════════════════════════════
// Build Conflict Diagnostics
// ══════════════════════════════════════════════

export function buildPolicyApprovalConflictPayload(
  caseId: string,
  actionKey: StageActionKey,
  permissionResult: PermissionCheckResult,
  orgPolicyDecisions: OrgPolicyDecision[],
  orgPolicyExplanations: PolicyExplanation[],
  sodResult: SoDCheckResult | null,
): PolicyApprovalConflictPayload {
  const riskTier = permissionResult.approvalRequirement.actionRiskTier;
  const auditTrace: string[] = [];

  // ── 1. Identify effective approval source ──
  const orgRequiresApproval = orgPolicyDecisions.some(d =>
    d.effectiveEffect === "require_approval" || d.effectiveEffect === "require_dual_approval" || d.effectiveEffect === "escalate"
  );
  const riskRequiresApproval = permissionResult.requiresApproval;

  let effectiveApprovalSource: EffectiveApprovalSource;
  if (orgRequiresApproval && riskRequiresApproval) {
    effectiveApprovalSource = "combined";
    auditTrace.push(`Approval source: combined (org policy + risk tier ${riskTier})`);
  } else if (orgRequiresApproval) {
    effectiveApprovalSource = "org_policy";
    auditTrace.push(`Approval source: org policy`);
  } else if (riskRequiresApproval) {
    effectiveApprovalSource = "risk_tier";
    auditTrace.push(`Approval source: risk tier ${riskTier}`);
  } else {
    effectiveApprovalSource = "none";
    auditTrace.push("No approval required");
  }

  // ── 2. Identify escalation source ──
  let effectiveEscalationSource: EffectiveEscalationSource = "none";
  const escalationDomains: OrgPolicyDomain[] = [];

  for (const d of orgPolicyDecisions) {
    if (d.effectiveEffect === "escalate" || d.escalationRole) {
      escalationDomains.push(d.domain);
    }
  }
  if (permissionResult.escalationRequired && escalationDomains.length > 0) {
    effectiveEscalationSource = "combined";
  } else if (escalationDomains.length === 1) {
    effectiveEscalationSource = escalationDomains[0] as EffectiveEscalationSource;
  } else if (escalationDomains.length > 1) {
    effectiveEscalationSource = "combined";
  } else if (permissionResult.escalationRequired) {
    effectiveEscalationSource = "risk_tier";
  }

  auditTrace.push(`Escalation source: ${effectiveEscalationSource}${escalationDomains.length > 0 ? ` (${escalationDomains.join(", ")})` : ""}`);

  // ── 3. Winning / overridden rules ──
  const winningRules: WinningPolicyRule[] = [];
  const overriddenRules: OverriddenPolicyRule[] = [];

  for (const d of orgPolicyDecisions) {
    if (d.governingRule) {
      winningRules.push({
        ruleId: d.governingRule.ruleId,
        domain: d.domain,
        scopeType: d.governingRule.scope.scopeType,
        scopeId: d.governingRule.scope.scopeId,
        effect: d.governingRule.effect,
        detail: d.effectiveDetail,
        source: "org_policy",
      });
    }
    for (const m of d.matchedRules) {
      if (m.matched && m.rule.ruleId !== d.governingRule?.ruleId) {
        overriddenRules.push({
          ruleId: m.rule.ruleId,
          domain: d.domain,
          scopeType: m.rule.scope.scopeType,
          effect: m.rule.effect,
          overriddenBy: d.governingRule?.ruleId || "narrowest_scope",
          reason: `Scope precedence: ${m.rule.scope.scopeType}(${m.rule.scope.precedence}) < ${d.governingRule?.scope.scopeType || "none"}(${d.governingRule?.scope.precedence || 0})`,
        });
      }
    }
  }

  // Risk tier as winning rule if applicable
  if (riskRequiresApproval) {
    winningRules.push({
      ruleId: `risk_tier_${riskTier}`,
      domain: "budget" as OrgPolicyDomain, // placeholder
      scopeType: "system",
      scopeId: "system",
      effect: riskTier === "tier3_irreversible" ? "require_dual_approval" : "require_approval",
      detail: `Risk tier ${riskTier} requires approval`,
      source: "risk_tier",
    });
  }

  // ── 4. Reason codes ──
  const dualApprovalReasons: string[] = [];
  const escalationReasons: string[] = [];
  const blockReasons: string[] = [];

  if (permissionResult.approvalRequirement.dualApprovalRequired) {
    dualApprovalReasons.push(`risk_tier:${riskTier}`);
  }
  for (const d of orgPolicyDecisions) {
    if (d.dualApprovalRequired) dualApprovalReasons.push(`org_policy:${d.domain}`);
    if (d.effectiveEffect === "escalate" || d.escalationRole) escalationReasons.push(`${d.domain}:${d.effectiveDetail}`);
    if (d.effectiveEffect === "block") blockReasons.push(`${d.domain}:${d.effectiveDetail}`);
  }
  if (permissionResult.blockedByPolicy) {
    for (const pr of permissionResult.policyResults) {
      if (pr.status === "block") blockReasons.push(`permission_policy:${pr.constraintKey}:${pr.reason}`);
    }
  }

  auditTrace.push(`Dual approval reasons: ${dualApprovalReasons.length > 0 ? dualApprovalReasons.join("; ") : "none"}`);
  auditTrace.push(`Escalation reasons: ${escalationReasons.length > 0 ? escalationReasons.join("; ") : "none"}`);
  auditTrace.push(`Block reasons: ${blockReasons.length > 0 ? blockReasons.join("; ") : "none"}`);

  // ── 5. Conflict diagnostics ──
  const conflictDiagnostics = buildConflictDiagnostics(
    orgPolicyDecisions, orgPolicyExplanations, permissionResult, riskTier, sodResult
  );
  if (conflictDiagnostics.hasConflicts) {
    auditTrace.push(`Conflicts detected: ${conflictDiagnostics.conflictCount} (${conflictDiagnostics.conflictSummary})`);
  }

  // ── 6. Explanations ──
  const whyThisEffect = buildWhyThisEffect(
    effectiveApprovalSource, effectiveEscalationSource,
    orgPolicyDecisions, permissionResult, blockReasons
  );

  const whyThisApprovalPath = buildWhyThisApprovalPath(
    effectiveApprovalSource, dualApprovalReasons, escalationReasons, sodResult
  );

  // ── 7. Operator-safe summary ──
  const operatorSafeSummary = buildOperatorSafeSummary(
    blockReasons, dualApprovalReasons, escalationReasons, permissionResult, orgPolicyDecisions
  );

  // ── 8. Effective final state ──
  const orgBlocked = orgPolicyDecisions.some(d => d.effectiveEffect === "block");
  const permBlocked = permissionResult.blockedByPolicy || !permissionResult.permitted;
  const sodBlocked = sodResult ? !sodResult.allowed : false;

  const effectivePermitted = !orgBlocked && !permBlocked && !sodBlocked;
  const effectiveRequiresApproval = orgRequiresApproval || riskRequiresApproval;
  const effectiveRequiresDualApproval = dualApprovalReasons.length > 0;
  const effectiveRequiresEscalation = escalationReasons.length > 0;

  const effectiveApproverRole = permissionResult.approvalRole
    || orgPolicyDecisions.find(d => d.escalationRole)?.escalationRole
    || null;
  const effectiveEscalationRole = permissionResult.escalationRole
    || orgPolicyDecisions.find(d => d.escalationRole)?.escalationRole
    || null;

  auditTrace.push(`Final: permitted=${effectivePermitted}, approval=${effectiveRequiresApproval}, dual=${effectiveRequiresDualApproval}, escalation=${effectiveRequiresEscalation}`);

  return {
    caseId, actionKey, riskTier,
    effectiveApprovalSource, effectiveEscalationSource,
    winningPolicyRules: winningRules, overriddenPolicyRules: overriddenRules,
    dualApprovalReasonCodes: dualApprovalReasons,
    escalationReasonCodes: escalationReasons,
    blockReasonCodes: blockReasons,
    whyThisEffect, whyThisApprovalPath,
    conflictDiagnostics,
    operatorSafeSummary,
    auditSafeTrace: auditTrace,
    effectivePermitted, effectiveRequiresApproval,
    effectiveRequiresDualApproval, effectiveRequiresEscalation,
    effectiveApproverRole, effectiveEscalationRole,
    generatedAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════
// Conflict Diagnostics Builder
// ══════════════════════════════════════════════

function buildConflictDiagnostics(
  orgDecisions: OrgPolicyDecision[],
  orgExplanations: PolicyExplanation[],
  permResult: PermissionCheckResult,
  riskTier: ActionRiskTier,
  sodResult: SoDCheckResult | null,
): ConflictDiagnostics {
  const policyVsPolicy: PolicyVsPolicyConflict[] = [];
  const policyVsRisk: PolicyVsRiskConflict[] = [];
  let approvalVsSod: ApprovalVsSoDConflict | null = null;
  const scopePrecedence: ScopePrecedenceTrace[] = [];

  // Policy vs Policy conflicts
  const blockingPolicies = orgDecisions.filter(d => d.effectiveEffect === "block");
  const allowingPolicies = orgDecisions.filter(d => d.effectiveEffect === "allow");
  for (const bp of blockingPolicies) {
    for (const ap of allowingPolicies) {
      if (bp.domain !== ap.domain) {
        policyVsPolicy.push({
          domainA: bp.domain, effectA: bp.effectiveEffect,
          scopeA: bp.governingScope ? `${bp.governingScope.scopeType}:${bp.governingScope.scopeId}` : "system",
          domainB: ap.domain, effectB: ap.effectiveEffect,
          scopeB: ap.governingScope ? `${ap.governingScope.scopeType}:${ap.governingScope.scopeId}` : "system",
          resolution: "most_restrictive_wins",
          winner: bp.domain,
        });
      }
    }
  }

  // Policy vs Risk conflicts
  for (const d of orgDecisions) {
    if (d.effectiveEffect !== "allow" && permResult.requiresApproval) {
      policyVsRisk.push({
        policyEffect: d.effectiveEffect, policyDomain: d.domain,
        policyScope: d.governingScope ? `${d.governingScope.scopeType}:${d.governingScope.scopeId}` : "system",
        riskTierRequirement: permResult.approvalRequirement.dualApprovalRequired ? "dual_approval" : "single_approval",
        riskTier,
        resolution: "combined — both policy constraint and risk tier requirement apply",
        effectiveSource: "combined",
      });
    }
  }

  // Approval vs SoD
  if (sodResult) {
    const approvalAllowed = permResult.permitted || permResult.permissionLevel === "requires_approval";
    approvalVsSod = {
      approvalAllowed,
      sodAllowed: sodResult.allowed,
      sodViolations: sodResult.violations.map(v => v.reason),
      resolution: !sodResult.allowed
        ? "SoD violation blocks execution even if approval is granted"
        : "SoD check passed",
      effectiveResult: !sodResult.allowed ? "blocked_by_sod" : approvalAllowed ? "allowed" : "approval_needed_plus_sod_check",
    };
  }

  // Scope precedence traces
  for (const d of orgDecisions) {
    const matchedScopes = d.matchedRules
      .filter(m => m.matched)
      .map(m => ({
        scopeType: m.rule.scope.scopeType,
        scopeId: m.rule.scope.scopeId,
        precedence: m.rule.scope.precedence,
        effect: m.rule.effect,
        isWinner: m.rule.ruleId === d.governingRule?.ruleId,
      }));
    if (matchedScopes.length > 1) {
      scopePrecedence.push({
        domain: d.domain,
        matchedScopes,
        winnerScope: d.governingScope ? `${d.governingScope.scopeType}:${d.governingScope.scopeId}` : "none",
        winnerEffect: d.effectiveEffect,
      });
    }
  }

  const conflictCount = policyVsPolicy.length + policyVsRisk.length + (approvalVsSod && !approvalVsSod.sodAllowed ? 1 : 0);
  const parts: string[] = [];
  if (policyVsPolicy.length > 0) parts.push(`policy충돌 ${policyVsPolicy.length}`);
  if (policyVsRisk.length > 0) parts.push(`policy-risk충돌 ${policyVsRisk.length}`);
  if (approvalVsSod && !approvalVsSod.sodAllowed) parts.push("SoD충돌 1");

  return {
    policyVsPolicy, policyVsRisk, approvalVsSod, scopePrecedence,
    hasConflicts: conflictCount > 0,
    conflictCount,
    conflictSummary: parts.length > 0 ? parts.join(", ") : "충돌 없음",
  };
}

// ══════════════════════════════════════════════
// Explanation Builders
// ══════════════════════════════════════════════

function buildWhyThisEffect(
  approvalSource: EffectiveApprovalSource,
  escalationSource: EffectiveEscalationSource,
  orgDecisions: OrgPolicyDecision[],
  permResult: PermissionCheckResult,
  blockReasons: string[],
): string {
  if (blockReasons.length > 0) {
    return `차단됨: ${blockReasons[0]}`;
  }
  if (approvalSource === "combined") {
    return `조직 정책과 위험 등급(${permResult.approvalRequirement.actionRiskTier}) 모두 승인을 요구합니다`;
  }
  if (approvalSource === "org_policy") {
    const domain = orgDecisions.find(d => d.effectiveEffect !== "allow")?.domain;
    return `조직 정책(${domain})이 승인을 요구합니다`;
  }
  if (approvalSource === "risk_tier") {
    return `위험 등급 ${permResult.approvalRequirement.actionRiskTier}에 의해 승인이 필요합니다`;
  }
  return "승인 없이 실행 가능합니다";
}

function buildWhyThisApprovalPath(
  approvalSource: EffectiveApprovalSource,
  dualReasons: string[],
  escalationReasons: string[],
  sodResult: SoDCheckResult | null,
): string {
  const parts: string[] = [];

  if (dualReasons.length > 0) {
    const sources = dualReasons.map(r => r.split(":")[0]).join("+");
    parts.push(`이중 승인 필요 (${sources})`);
  }
  if (escalationReasons.length > 0) {
    parts.push(`에스컬레이션 필요 (${escalationReasons.length}건)`);
  }
  if (sodResult && !sodResult.allowed) {
    parts.push(`SoD 위반으로 동일인 승인/실행 불가`);
  }

  return parts.length > 0 ? parts.join(" + ") : "일반 승인 경로";
}

function buildOperatorSafeSummary(
  blockReasons: string[],
  dualReasons: string[],
  escalationReasons: string[],
  permResult: PermissionCheckResult,
  orgDecisions: OrgPolicyDecision[],
): string {
  if (blockReasons.length > 0) {
    return `차단: ${blockReasons[0].split(":").slice(1).join(":")}`;
  }
  if (escalationReasons.length > 0) {
    return `에스컬레이션 필요 — ${permResult.escalationRole || "상위 승인자"} 확인 필요`;
  }
  if (dualReasons.length > 0) {
    return `이중 승인 필요 — 2인 승인 후 실행 가능`;
  }
  if (permResult.requiresApproval) {
    return `${permResult.approvalRole || "approver"} 승인 후 실행 가능`;
  }
  return "바로 실행 가능";
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type ConflictDiagnosticsEventType =
  | "conflict_diagnostics_generated"
  | "conflict_detected"
  | "policy_vs_policy_conflict"
  | "policy_vs_risk_conflict"
  | "approval_vs_sod_conflict";

export interface ConflictDiagnosticsEvent {
  type: ConflictDiagnosticsEventType;
  caseId: string;
  actionKey: StageActionKey;
  conflictCount: number;
  summary: string;
  timestamp: string;
}
