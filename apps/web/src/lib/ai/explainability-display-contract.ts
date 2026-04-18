/**
 * Explainability Display Contract — 전 surface 설명 문법/우선순위 통일
 *
 * PolicyApprovalConflictPayload를 각 surface에서 어떤 순서와 우선순위로 표시할지 고정.
 *
 * DISPLAY PRIORITY (모든 surface 동일):
 * 1. operatorSafeSummary — 항상 최상단 (1줄)
 * 2. blockReasonCodes — blocked 시 즉시 다음 (red)
 * 3. escalationReasonCodes — escalation 시 (amber)
 * 4. dualApprovalReasonCodes — dual 시 (amber)
 * 5. effectiveApprovalSource — source badge
 * 6. effectiveEscalationSource — escalation source badge
 * 7. whyThisEffect — detail (center only)
 * 8. whyThisApprovalPath — path detail (center only)
 * 9. winningPolicyRules — applied rules (rail only)
 * 10. overriddenPolicyRules — overridden rules (rail only, collapsed)
 * 11. conflictDiagnostics — conflicts (rail only, expandable)
 *
 * SURFACE-SPECIFIC DISPLAY LEVEL:
 * - dashboard: level 1-2 (summary + blockers)
 * - inbox row: level 1-4 (summary + blockers + escalation + dual)
 * - inbox rail: level 1-8 (summary through path detail)
 * - workbench center: level 1-8
 * - workbench rail: level 1-11 (full)
 * - export: auditSafeTrace only (separate from display)
 */

import type { PolicyApprovalConflictPayload } from "./policy-approval-conflict-diagnostics-engine";
import type { ConsumptionSurface } from "./conflict-payload-consumption-contract";
import { formatReasonCodesToLabels } from "./conflict-payload-consumption-contract";

// ══════════════════════════════════════════════
// Display Level
// ══════════════════════════════════════════════

export type ExplainabilityDisplayLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

const SURFACE_MAX_LEVEL: Record<ConsumptionSurface, ExplainabilityDisplayLevel> = {
  dashboard_kpi: 2,
  dashboard_bottleneck: 2,
  inbox_item_row: 4,
  inbox_item_rail: 8,
  workbench_center_strip: 4,
  workbench_center_detail: 8,
  workbench_rail_explanation: 11,
  workbench_rail_approver: 6,
  workbench_dock_actions: 1,
  audit_export: 1, // uses auditSafeTrace separately
  history_timeline: 6,
};

// ══════════════════════════════════════════════
// Display Slot
// ══════════════════════════════════════════════

export interface ExplainabilityDisplaySlot {
  level: ExplainabilityDisplayLevel;
  slotKey: string;
  label: string;
  content: string;
  contentList: string[];
  variant: "primary" | "blocker" | "escalation" | "dual" | "source" | "detail" | "rule" | "conflict";
  visible: boolean;
}

// ══════════════════════════════════════════════
// Build Display Slots
// ══════════════════════════════════════════════

export function buildExplainabilityDisplaySlots(
  payload: PolicyApprovalConflictPayload,
  surface: ConsumptionSurface,
): ExplainabilityDisplaySlot[] {
  const maxLevel = SURFACE_MAX_LEVEL[surface] || 4;
  const slots: ExplainabilityDisplaySlot[] = [];

  // Level 1: operator summary
  slots.push({
    level: 1, slotKey: "operator_summary", label: "상태",
    content: payload.operatorSafeSummary, contentList: [],
    variant: "primary", visible: true,
  });

  // Level 2: block reasons
  if (payload.blockReasonCodes.length > 0) {
    slots.push({
      level: 2, slotKey: "block_reasons", label: "차단 이유",
      content: "", contentList: formatReasonCodesToLabels(payload.blockReasonCodes),
      variant: "blocker", visible: maxLevel >= 2,
    });
  }

  // Level 3: escalation reasons
  if (payload.escalationReasonCodes.length > 0) {
    slots.push({
      level: 3, slotKey: "escalation_reasons", label: "에스컬레이션 이유",
      content: "", contentList: formatReasonCodesToLabels(payload.escalationReasonCodes),
      variant: "escalation", visible: maxLevel >= 3,
    });
  }

  // Level 4: dual approval reasons
  if (payload.dualApprovalReasonCodes.length > 0) {
    slots.push({
      level: 4, slotKey: "dual_approval_reasons", label: "이중 승인 이유",
      content: "", contentList: formatReasonCodesToLabels(payload.dualApprovalReasonCodes),
      variant: "dual", visible: maxLevel >= 4,
    });
  }

  // Level 5: approval source
  if (payload.effectiveApprovalSource !== "none") {
    slots.push({
      level: 5, slotKey: "approval_source", label: "승인 근거",
      content: payload.effectiveApprovalSource, contentList: [],
      variant: "source", visible: maxLevel >= 5,
    });
  }

  // Level 6: escalation source
  if (payload.effectiveEscalationSource !== "none") {
    slots.push({
      level: 6, slotKey: "escalation_source", label: "에스컬레이션 원인",
      content: payload.effectiveEscalationSource, contentList: [],
      variant: "source", visible: maxLevel >= 6,
    });
  }

  // Level 7: why this effect
  slots.push({
    level: 7, slotKey: "why_effect", label: "판단 이유",
    content: payload.whyThisEffect, contentList: [],
    variant: "detail", visible: maxLevel >= 7,
  });

  // Level 8: why this approval path
  slots.push({
    level: 8, slotKey: "why_path", label: "승인 경로",
    content: payload.whyThisApprovalPath, contentList: [],
    variant: "detail", visible: maxLevel >= 8,
  });

  // Level 9: winning rules
  if (payload.winningPolicyRules.length > 0) {
    slots.push({
      level: 9, slotKey: "winning_rules", label: "적용 규칙",
      content: "", contentList: payload.winningPolicyRules.map(r => `${r.domain} (${r.scopeType}): ${r.detail}`),
      variant: "rule", visible: maxLevel >= 9,
    });
  }

  // Level 10: overridden rules
  if (payload.overriddenPolicyRules.length > 0) {
    slots.push({
      level: 10, slotKey: "overridden_rules", label: "Override된 규칙",
      content: "", contentList: payload.overriddenPolicyRules.map(r => `${r.domain} (${r.scopeType}) → ${r.reason}`),
      variant: "rule", visible: maxLevel >= 10,
    });
  }

  // Level 11: conflict diagnostics
  if (payload.conflictDiagnostics.hasConflicts) {
    slots.push({
      level: 11, slotKey: "conflict_diagnostics", label: "충돌 진단",
      content: payload.conflictDiagnostics.conflictSummary, contentList: [],
      variant: "conflict", visible: maxLevel >= 11,
    });
  }

  return slots.filter(s => s.visible);
}

// ══════════════════════════════════════════════
// Operator vs Audit Separation
// ══════════════════════════════════════════════

/**
 * getOperatorFacingContent — operator에게 보여줄 content만 추출
 * auditSafeTrace는 절대 포함하지 않음
 */
export function getOperatorFacingContent(payload: PolicyApprovalConflictPayload): {
  summary: string;
  blockers: string[];
  escalations: string[];
  dualReasons: string[];
  whyEffect: string;
  whyPath: string;
} {
  return {
    summary: payload.operatorSafeSummary,
    blockers: formatReasonCodesToLabels(payload.blockReasonCodes),
    escalations: formatReasonCodesToLabels(payload.escalationReasonCodes),
    dualReasons: formatReasonCodesToLabels(payload.dualApprovalReasonCodes),
    whyEffect: payload.whyThisEffect,
    whyPath: payload.whyThisApprovalPath,
  };
}

/**
 * getAuditFacingContent — 감사용 전체 trace (UI 직접 표시 금지)
 */
export function getAuditFacingContent(payload: PolicyApprovalConflictPayload): {
  trace: string[];
  winningRules: PolicyApprovalConflictPayload["winningPolicyRules"];
  overriddenRules: PolicyApprovalConflictPayload["overriddenPolicyRules"];
  diagnostics: PolicyApprovalConflictPayload["conflictDiagnostics"];
} {
  return {
    trace: payload.auditSafeTrace,
    winningRules: payload.winningPolicyRules,
    overriddenRules: payload.overriddenPolicyRules,
    diagnostics: payload.conflictDiagnostics,
  };
}
