/**
 * Quote Approval Governance Engine
 *
 * Quote Management → Approval → PO Conversion 체인에
 * 기존 governance grammar (permission + policy surface + workbench + conflict diagnostics)를 적용.
 *
 * CHAIN STAGES:
 * 1. quote_review — 견적 검토/비교 (Tier 1, operator 자체)
 * 2. quote_shortlist — 견적 후보 선정 (Tier 1)
 * 3. quote_approval — 견적 승인 (Tier 2, 금액 기준)
 * 4. po_conversion — PO 전환 (Tier 2, locked fields)
 * 5. po_approval — PO 승인 (Tier 2~3, 금액/제한품목 기준)
 * 6. po_send_readiness — PO 발송 준비 (Tier 1)
 *
 * 기존 governance substrate 재사용:
 * - checkPermission → StageActionKey 확장
 * - buildWorkspacePolicySurface → workspace registry 확장
 * - PolicyApprovalConflictPayload → 동일 single truth
 * - center/rail/dock workbench grammar 동일
 */

import type { ActorContext, PolicyEvaluationContext, ProcurementRole, ActionRiskTier } from "./dispatch-v2-permission-policy-engine";

// ══════════════════════════════════════════════
// Quote Chain Stage Definitions
// ══════════════════════════════════════════════

export type QuoteChainStage =
  | "quote_review"
  | "quote_shortlist"
  | "quote_approval"
  | "po_conversion"
  | "po_approval"
  | "po_send_readiness"
  | "po_created"
  | "dispatch_prep"
  // Future slots — type만 선언, config/UI는 해당 배치에서 추가
  | "sent"
  | "supplier_confirmed"
  | "receiving_prep"
  | "stock_release"
  | "reorder_decision";

export interface QuoteChainStageConfig {
  stage: QuoteChainStage;
  label: string;
  description: string;
  riskTier: ActionRiskTier;
  approvalRequired: boolean;
  approvalThresholdAmount: number | null;
  policyConstraints: string[];
  lockedFieldsFromPrevious: string[];
}

export const QUOTE_CHAIN_STAGES: QuoteChainStageConfig[] = [
  {
    stage: "quote_review",
    label: "견적 검토",
    description: "공급사 견적 비교/분석",
    riskTier: "tier1_routine",
    approvalRequired: false,
    approvalThresholdAmount: null,
    policyConstraints: [],
    lockedFieldsFromPrevious: [],
  },
  {
    stage: "quote_shortlist",
    label: "견적 후보 선정",
    description: "비교 후 최종 후보 선정",
    riskTier: "tier1_routine",
    approvalRequired: false,
    approvalThresholdAmount: null,
    policyConstraints: [],
    lockedFieldsFromPrevious: [],
  },
  {
    stage: "quote_approval",
    label: "견적 승인",
    description: "선정된 견적 승인 (금액 기준)",
    riskTier: "tier2_org_impact",
    approvalRequired: true,
    approvalThresholdAmount: 1000000, // 100만원 이상 승인 필요
    policyConstraints: ["budget_threshold", "vendor_rule", "restricted_item"],
    lockedFieldsFromPrevious: ["vendorId", "selectedItems", "unitPrices"],
  },
  {
    stage: "po_conversion",
    label: "PO 전환",
    description: "승인된 견적 → PO 초안 전환",
    riskTier: "tier2_org_impact",
    approvalRequired: false,
    approvalThresholdAmount: null,
    policyConstraints: ["budget_threshold"],
    lockedFieldsFromPrevious: ["vendorId", "approvedItems", "approvedPrices", "approvalSnapshotId"],
  },
  {
    stage: "po_approval",
    label: "PO 승인",
    description: "PO 최종 승인 (발행 전)",
    riskTier: "tier2_org_impact",
    approvalRequired: true,
    approvalThresholdAmount: 500000,
    policyConstraints: ["budget_threshold", "restricted_item", "vendor_rule"],
    lockedFieldsFromPrevious: ["vendorId", "lineItems", "totalAmount", "quoteRef"],
  },
  {
    stage: "po_send_readiness",
    label: "PO 발송 준비",
    description: "PO 발송 전 최종 점검",
    riskTier: "tier1_routine",
    approvalRequired: false,
    approvalThresholdAmount: null,
    policyConstraints: [],
    lockedFieldsFromPrevious: ["vendorId", "lineItems", "totalAmount", "approvalSnapshotId", "poNumber"],
  },
  {
    stage: "po_created",
    label: "PO 생성",
    description: "PO 확정 — dispatch preparation 진입점",
    riskTier: "tier1_routine",
    approvalRequired: false,
    approvalThresholdAmount: null,
    policyConstraints: [],
    lockedFieldsFromPrevious: ["vendorId", "lineItems", "totalAmount", "approvalSnapshotId", "poNumber", "conversionSnapshotId"],
  },
  {
    stage: "dispatch_prep",
    label: "발송 준비",
    description: "공급사 발송 전 최종 검증/차단/스케줄링",
    riskTier: "tier2_org_impact",
    approvalRequired: false,
    approvalThresholdAmount: null,
    policyConstraints: ["snapshot_validity", "commercial_terms", "document_completeness"],
    lockedFieldsFromPrevious: ["vendorId", "lineItems", "totalAmount", "approvalSnapshotId", "poNumber", "conversionSnapshotId", "poCreatedObjectId"],
  },
  {
    stage: "sent",
    label: "발송 완료",
    description: "공급사에 PO 발송 완료 — 실행 결과 terminal",
    riskTier: "tier1_routine",
    approvalRequired: false,
    approvalThresholdAmount: null,
    policyConstraints: [],
    lockedFieldsFromPrevious: ["vendorId", "lineItems", "totalAmount", "approvalSnapshotId", "poNumber", "conversionSnapshotId", "poCreatedObjectId", "payloadSnapshotId"],
  },
  {
    stage: "supplier_confirmed",
    label: "공급사 확인",
    description: "공급사 응답 수신 + operator review 완료",
    riskTier: "tier1_routine",
    approvalRequired: false,
    approvalThresholdAmount: null,
    policyConstraints: ["supplier_response_delta"],
    lockedFieldsFromPrevious: ["vendorId", "lineItems", "totalAmount", "approvalSnapshotId", "poNumber", "conversionSnapshotId", "poCreatedObjectId", "payloadSnapshotId", "executionId"],
  },
  {
    stage: "receiving_prep",
    label: "입고 준비",
    description: "실물 입고 준비 — inbound blocker 계산 + site/handling 확인",
    riskTier: "tier1_routine",
    approvalRequired: false,
    approvalThresholdAmount: null,
    policyConstraints: ["inbound_readiness", "site_handling"],
    lockedFieldsFromPrevious: ["vendorId", "lineItems", "totalAmount", "approvalSnapshotId", "poNumber", "conversionSnapshotId", "poCreatedObjectId", "payloadSnapshotId", "executionId", "confirmationGovernanceId"],
  },
  {
    stage: "stock_release",
    label: "재고 릴리즈",
    description: "품질/안전/준법 게이트 통과 후 가용 재고 전환 — received ≠ available",
    riskTier: "tier2_org_impact",
    approvalRequired: false,
    approvalThresholdAmount: null,
    policyConstraints: ["quality_gate", "safety_gate", "compliance_gate", "lot_traceability", "expiry_validity"],
    lockedFieldsFromPrevious: ["vendorId", "lineItems", "totalAmount", "approvalSnapshotId", "poNumber", "conversionSnapshotId", "poCreatedObjectId", "payloadSnapshotId", "executionId", "confirmationGovernanceId", "receivingPrepStateId", "receivingExecutionId"],
  },
  {
    stage: "reorder_decision",
    label: "재주문 판단",
    description: "released 기준 gap 평가 + supply context 분석 + 재주문/감시/불필요 판단 + procurement re-entry handoff",
    riskTier: "tier2_org_impact",
    approvalRequired: false,
    approvalThresholdAmount: null,
    policyConstraints: ["coverage_analysis", "safety_stock_gate", "lead_time_gate", "loss_accounting"],
    lockedFieldsFromPrevious: ["vendorId", "lineItems", "totalAmount", "approvalSnapshotId", "poNumber", "conversionSnapshotId", "poCreatedObjectId", "payloadSnapshotId", "executionId", "confirmationGovernanceId", "receivingPrepStateId", "receivingExecutionId", "stockReleaseGovernanceId"],
  },
];

// ══════════════════════════════════════════════
// Quote Chain Gate — 단계 진입 가능 여부
// ══════════════════════════════════════════════

export interface QuoteChainGateResult {
  stage: QuoteChainStage;
  eligible: boolean;
  blockers: string[];
  warnings: string[];
  approvalRequired: boolean;
  approvalReason: string;
  lockedFields: string[];
  nextStage: QuoteChainStage | null;
}

export function evaluateQuoteChainGate(
  stage: QuoteChainStage,
  totalAmount: number,
  isRestrictedItem: boolean,
  previousStageCompleted: boolean,
  approvalSnapshotValid: boolean,
): QuoteChainGateResult {
  const config = QUOTE_CHAIN_STAGES.find(s => s.stage === stage);
  if (!config) {
    return { stage, eligible: false, blockers: [`Unknown stage: ${stage}`], warnings: [], approvalRequired: false, approvalReason: "", lockedFields: [], nextStage: null };
  }

  const blockers: string[] = [];
  const warnings: string[] = [];

  // Previous stage check
  if (!previousStageCompleted && stage !== "quote_review") {
    blockers.push("이전 단계 미완료");
  }

  // Approval check
  let approvalRequired = config.approvalRequired;
  let approvalReason = "";

  if (config.approvalRequired) {
    approvalReason = `${config.label} 승인 필요`;
  }

  if (config.approvalThresholdAmount && totalAmount >= config.approvalThresholdAmount) {
    approvalRequired = true;
    approvalReason = `금액 ${totalAmount.toLocaleString()}원 ≥ 임계값 ${config.approvalThresholdAmount.toLocaleString()}원`;
  }

  if (isRestrictedItem && config.policyConstraints.includes("restricted_item")) {
    approvalRequired = true;
    approvalReason = approvalReason ? `${approvalReason} + 제한 품목` : "제한 품목";
  }

  // Approval snapshot for stages after approval
  if (stage === "po_conversion" || stage === "po_send_readiness" || stage === "po_created" || stage === "dispatch_prep" || stage === "sent" || stage === "supplier_confirmed" || stage === "receiving_prep" || stage === "stock_release" || stage === "reorder_decision") {
    if (!approvalSnapshotValid) {
      blockers.push("승인 snapshot 미유효 — 재승인 필요");
    }
  }

  // Next stage
  const stageOrder: QuoteChainStage[] = ["quote_review", "quote_shortlist", "quote_approval", "po_conversion", "po_approval", "po_send_readiness", "po_created", "dispatch_prep", "sent", "supplier_confirmed", "receiving_prep", "stock_release", "reorder_decision"];
  const currentIdx = stageOrder.indexOf(stage);
  const nextStage = currentIdx < stageOrder.length - 1 ? stageOrder[currentIdx + 1] : null;

  return {
    stage,
    eligible: blockers.length === 0,
    blockers, warnings,
    approvalRequired,
    approvalReason,
    lockedFields: config.lockedFieldsFromPrevious,
    nextStage,
  };
}

// ══════════════════════════════════════════════
// Quote Chain Policy Surface — registry 확장
// ══════════════════════════════════════════════

export interface QuoteChainPolicySurface {
  stage: QuoteChainStage;
  label: string;
  riskTier: ActionRiskTier;
  statusBadge: "allowed" | "approval_needed" | "blocked";
  statusColor: "emerald" | "blue" | "red";
  primaryMessage: string;
  blockerMessages: string[];
  approvalInfo: { required: boolean; reason: string; thresholdAmount: number | null } | null;
  lockedFields: string[];
  nextAction: string;
}

export function buildQuoteChainPolicySurface(
  stage: QuoteChainStage,
  totalAmount: number,
  isRestrictedItem: boolean,
  previousCompleted: boolean,
  snapshotValid: boolean,
): QuoteChainPolicySurface {
  const gate = evaluateQuoteChainGate(stage, totalAmount, isRestrictedItem, previousCompleted, snapshotValid);
  const config = QUOTE_CHAIN_STAGES.find(s => s.stage === stage)!;

  let statusBadge: QuoteChainPolicySurface["statusBadge"];
  let statusColor: QuoteChainPolicySurface["statusColor"];

  if (!gate.eligible) {
    statusBadge = "blocked";
    statusColor = "red";
  } else if (gate.approvalRequired) {
    statusBadge = "approval_needed";
    statusColor = "blue";
  } else {
    statusBadge = "allowed";
    statusColor = "emerald";
  }

  const nextAction = !gate.eligible
    ? gate.blockers[0] || "차단됨"
    : gate.approvalRequired
      ? `${gate.approvalReason} — 승인 요청 필요`
      : `${config.label} 진행 가능`;

  return {
    stage, label: config.label, riskTier: config.riskTier,
    statusBadge, statusColor,
    primaryMessage: `${config.label} — ${statusBadge === "allowed" ? "진행 가능" : statusBadge === "approval_needed" ? "승인 필요" : "차단"}`,
    blockerMessages: gate.blockers,
    approvalInfo: gate.approvalRequired ? { required: true, reason: gate.approvalReason, thresholdAmount: config.approvalThresholdAmount } : null,
    lockedFields: gate.lockedFields,
    nextAction,
  };
}

// ══════════════════════════════════════════════
// Quote Chain Full Surface (모든 단계 한 번에)
// ══════════════════════════════════════════════

export interface QuoteChainFullSurface {
  stages: QuoteChainPolicySurface[];
  currentStage: QuoteChainStage | null;
  completedStages: QuoteChainStage[];
  blockedStage: QuoteChainStage | null;
  overallProgress: number; // 0-100
}

export function buildQuoteChainFullSurface(
  completedStages: QuoteChainStage[],
  totalAmount: number,
  isRestrictedItem: boolean,
  snapshotValid: boolean,
): QuoteChainFullSurface {
  const allStages: QuoteChainStage[] = ["quote_review", "quote_shortlist", "quote_approval", "po_conversion", "po_approval", "po_send_readiness", "po_created", "dispatch_prep", "sent", "supplier_confirmed", "receiving_prep", "stock_release", "reorder_decision"];

  const surfaces: QuoteChainPolicySurface[] = allStages.map(stage => {
    const prevCompleted = stage === "quote_review" || completedStages.includes(allStages[allStages.indexOf(stage) - 1]);
    return buildQuoteChainPolicySurface(stage, totalAmount, isRestrictedItem, prevCompleted, snapshotValid);
  });

  const currentIdx = completedStages.length;
  const currentStage = currentIdx < allStages.length ? allStages[currentIdx] : null;
  const blockedStage = surfaces.find(s => s.statusBadge === "blocked")?.stage || null;

  return {
    stages: surfaces,
    currentStage,
    completedStages,
    blockedStage,
    overallProgress: Math.round((completedStages.length / allStages.length) * 100),
  };
}

// ══════════════════════════════════════════════
// Events
// ══════════════════════════════════════════════

export type QuoteChainEventType = "quote_stage_entered" | "quote_stage_completed" | "quote_stage_blocked" | "quote_approval_requested" | "quote_approval_granted" | "po_conversion_started" | "po_approval_requested" | "po_send_ready";
export interface QuoteChainEvent { type: QuoteChainEventType; stage: QuoteChainStage; caseId: string; actorId: string; reason: string; timestamp: string; }
