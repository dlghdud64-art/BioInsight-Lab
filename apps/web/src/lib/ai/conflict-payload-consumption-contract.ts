/**
 * Conflict Payload Consumption Contract — 전 surface 동일 payload 참조 보장
 *
 * IMMUTABLE RULES:
 * 1. UI는 PolicyApprovalConflictPayload의 필드를 직접 projection만 함
 * 2. UI에서 approval reason / escalation source / dual approval reason을 재계산/재조합 금지
 * 3. badge/status를 component 내부에서 재판정 금지
 * 4. escalation source를 summary 문장으로 재생성 금지
 * 5. inbox과 workbench가 같은 payload를 다른 우선순위로 정렬하지 않음
 *
 * CONSUMPTION MAP:
 * 각 surface가 payload의 어떤 필드를 어떤 용도로 사용하는지 고정.
 *
 * FIELD → SURFACE → USAGE:
 * operatorSafeSummary     → all surfaces       → primary 1-line message
 * whyThisEffect           → workbench center   → detail explanation
 * whyThisApprovalPath     → workbench center   → approval path detail
 * effectiveApprovalSource → inbox/workbench     → ApprovalSourceTrace component
 * effectiveEscalationSource → inbox/workbench  → EscalationSourceTrace component
 * winningPolicyRules      → workbench rail      → PolicyExplanationCard
 * overriddenPolicyRules   → workbench rail      → OverriddenRuleList
 * conflictDiagnostics     → workbench rail      → WhyThisEffectPanel
 * dualApprovalReasonCodes → workbench/inbox     → dual approval badge/reason
 * escalationReasonCodes   → workbench/inbox     → escalation badge/reason
 * blockReasonCodes        → all surfaces        → PolicyMessageStack blockerMessages
 * auditSafeTrace          → export only         → compliance audit records
 * effectivePermitted      → dock                → action button enabled/disabled
 * effectiveApproverRole   → rail                → ApproverRequirementCard
 */

import type { PolicyApprovalConflictPayload } from "./policy-approval-conflict-diagnostics-engine";

// ══════════════════════════════════════════════
// Surface Type
// ══════════════════════════════════════════════

export type ConsumptionSurface =
  | "dashboard_kpi"
  | "dashboard_bottleneck"
  | "inbox_item_row"
  | "inbox_item_rail"
  | "workbench_center_strip"
  | "workbench_center_detail"
  | "workbench_rail_explanation"
  | "workbench_rail_approver"
  | "workbench_dock_actions"
  | "audit_export"
  | "history_timeline";

// ══════════════════════════════════════════════
// Field Consumption Spec
// ══════════════════════════════════════════════

export interface FieldConsumptionSpec {
  field: keyof PolicyApprovalConflictPayload;
  allowedSurfaces: ConsumptionSurface[];
  usage: string;
  /** UI에서 이 필드를 재계산/변환할 수 있는지 여부 — false = projection only */
  transformAllowed: boolean;
  /** projection 시 허용되는 변환 유형 */
  allowedTransforms: ("display_format" | "truncate" | "locale" | "none")[];
}

export const FIELD_CONSUMPTION_MAP: FieldConsumptionSpec[] = [
  {
    field: "operatorSafeSummary",
    allowedSurfaces: ["dashboard_kpi", "dashboard_bottleneck", "inbox_item_row", "inbox_item_rail", "workbench_center_strip"],
    usage: "Primary 1-line message — 가장 먼저 보이는 상태 설명",
    transformAllowed: false,
    allowedTransforms: ["none"],
  },
  {
    field: "whyThisEffect",
    allowedSurfaces: ["workbench_center_detail", "inbox_item_rail"],
    usage: "Detail explanation — 왜 이 effect인지",
    transformAllowed: false,
    allowedTransforms: ["none"],
  },
  {
    field: "whyThisApprovalPath",
    allowedSurfaces: ["workbench_center_detail"],
    usage: "Approval path detail — 왜 이 승인 경로인지",
    transformAllowed: false,
    allowedTransforms: ["none"],
  },
  {
    field: "effectiveApprovalSource",
    allowedSurfaces: ["inbox_item_row", "inbox_item_rail", "workbench_center_strip", "workbench_rail_explanation"],
    usage: "ApprovalSourceTrace component 렌더용",
    transformAllowed: false,
    allowedTransforms: ["none"],
  },
  {
    field: "effectiveEscalationSource",
    allowedSurfaces: ["inbox_item_row", "inbox_item_rail", "workbench_center_strip", "workbench_rail_explanation"],
    usage: "EscalationSourceTrace component 렌더용",
    transformAllowed: false,
    allowedTransforms: ["none"],
  },
  {
    field: "winningPolicyRules",
    allowedSurfaces: ["workbench_rail_explanation", "audit_export"],
    usage: "PolicyExplanationCard — 적용된 규칙 목록",
    transformAllowed: false,
    allowedTransforms: ["none"],
  },
  {
    field: "overriddenPolicyRules",
    allowedSurfaces: ["workbench_rail_explanation", "audit_export"],
    usage: "OverriddenRuleList — override된 규칙",
    transformAllowed: false,
    allowedTransforms: ["none"],
  },
  {
    field: "conflictDiagnostics",
    allowedSurfaces: ["workbench_rail_explanation", "audit_export"],
    usage: "WhyThisEffectPanel — 충돌 진단 상세",
    transformAllowed: false,
    allowedTransforms: ["none"],
  },
  {
    field: "dualApprovalReasonCodes",
    allowedSurfaces: ["inbox_item_row", "inbox_item_rail", "workbench_center_strip", "workbench_rail_approver"],
    usage: "Dual approval badge/reason",
    transformAllowed: true,
    allowedTransforms: ["display_format"], // code → label 변환만 허용
  },
  {
    field: "escalationReasonCodes",
    allowedSurfaces: ["inbox_item_row", "inbox_item_rail", "workbench_center_strip", "workbench_rail_explanation"],
    usage: "Escalation badge/reason",
    transformAllowed: true,
    allowedTransforms: ["display_format"],
  },
  {
    field: "blockReasonCodes",
    allowedSurfaces: ["dashboard_bottleneck", "inbox_item_row", "inbox_item_rail", "workbench_center_strip", "workbench_center_detail"],
    usage: "PolicyMessageStack blockerMessages",
    transformAllowed: true,
    allowedTransforms: ["display_format"],
  },
  {
    field: "auditSafeTrace",
    allowedSurfaces: ["audit_export", "history_timeline"],
    usage: "Compliance audit records — UI에서 직접 표시 금지",
    transformAllowed: false,
    allowedTransforms: ["none"],
  },
  {
    field: "effectivePermitted",
    allowedSurfaces: ["workbench_dock_actions", "inbox_item_row"],
    usage: "Action button enabled/disabled 제어",
    transformAllowed: false,
    allowedTransforms: ["none"],
  },
  {
    field: "effectiveApproverRole",
    allowedSurfaces: ["workbench_rail_approver", "inbox_item_rail"],
    usage: "ApproverRequirementCard 렌더용",
    transformAllowed: false,
    allowedTransforms: ["none"],
  },
];

// ══════════════════════════════════════════════
// Consumption Validation
// ══════════════════════════════════════════════

export interface ConsumptionViolation {
  field: string;
  surface: ConsumptionSurface;
  violationType: "unauthorized_surface" | "unauthorized_transform" | "recomputation_detected";
  detail: string;
}

/**
 * validateFieldConsumption — 특정 surface에서 특정 field 사용이 contract에 맞는지 검증
 *
 * 개발 시점에서 호출하여 contract 위반을 조기 감지.
 */
export function validateFieldConsumption(
  field: keyof PolicyApprovalConflictPayload,
  surface: ConsumptionSurface,
  transformType: "display_format" | "truncate" | "locale" | "none" = "none",
): ConsumptionViolation | null {
  const spec = FIELD_CONSUMPTION_MAP.find(s => s.field === field);
  if (!spec) return null; // unknown field — no spec yet

  if (!spec.allowedSurfaces.includes(surface)) {
    return {
      field, surface,
      violationType: "unauthorized_surface",
      detail: `${field}는 ${surface}에서 사용 불가 — 허용: ${spec.allowedSurfaces.join(", ")}`,
    };
  }

  if (transformType !== "none" && !spec.transformAllowed) {
    return {
      field, surface,
      violationType: "unauthorized_transform",
      detail: `${field}는 transform 금지 — projection only`,
    };
  }

  if (transformType !== "none" && !spec.allowedTransforms.includes(transformType)) {
    return {
      field, surface,
      violationType: "unauthorized_transform",
      detail: `${field}에 ${transformType} 변환 불가 — 허용: ${spec.allowedTransforms.join(", ")}`,
    };
  }

  return null;
}

/**
 * validateAllConsumptions — 전체 surface의 field 사용을 일괄 검증
 */
export function validateAllConsumptions(
  usages: Array<{ field: keyof PolicyApprovalConflictPayload; surface: ConsumptionSurface; transform?: "display_format" | "truncate" | "locale" | "none" }>,
): ConsumptionViolation[] {
  return usages
    .map(u => validateFieldConsumption(u.field, u.surface, u.transform))
    .filter((v): v is ConsumptionViolation => v !== null);
}

// ══════════════════════════════════════════════
// Display Format Contract
// ══════════════════════════════════════════════

/**
 * DISPLAY FORMAT RULES:
 *
 * operatorSafeSummary → 그대로 표시 (재작성 금지)
 * whyThisEffect → 그대로 표시
 * whyThisApprovalPath → 그대로 표시
 *
 * dualApprovalReasonCodes → 코드를 라벨로만 변환 허용:
 *   "risk_tier:tier3_irreversible" → "위험 등급 Tier 3"
 *   "org_policy:budget" → "조직 예산 정책"
 *
 * escalationReasonCodes → 코드를 라벨로만 변환 허용
 * blockReasonCodes → 코드를 라벨로만 변환 허용
 *
 * auditSafeTrace → UI 표시 금지 (export/history에서만)
 */

const REASON_CODE_LABELS: Record<string, string> = {
  "risk_tier:tier3_irreversible": "위험 등급 Tier 3 (비가역적)",
  "risk_tier:tier2_org_impact": "위험 등급 Tier 2 (조직 영향)",
  "org_policy:budget": "조직 예산 정책",
  "org_policy:vendor": "공급사 정책",
  "org_policy:release": "릴리스 정책",
  "org_policy:restricted_item": "제한 품목 정책",
  "org_policy:reorder": "재주문 정책",
  "org_policy:sod_exception": "SoD 예외 정책",
};

export function formatReasonCodeToLabel(code: string): string {
  return REASON_CODE_LABELS[code] || code.replace(/_/g, " ").replace(/:/g, " → ");
}

export function formatReasonCodesToLabels(codes: string[]): string[] {
  return codes.map(formatReasonCodeToLabel);
}
