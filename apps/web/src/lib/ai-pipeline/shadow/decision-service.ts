/**
 * Decision Service — 최종 운영 판정 + Ops Approval + Stage 실행
 *
 * 6단계 FinalDecision Matrix:
 *   GO_RESTRICTED                 → ACTIVE_50 + restricted auto-verify on
 *   GO_ACTIVE_50_NO_AUTOVERIFY    → ACTIVE_50 + auto-verify off
 *   HOLD                          → 현 Stage 유지
 *   ROLLBACK_TO_ACTIVE_5          → ACTIVE_5 강등
 *   ROLLBACK_TO_SHADOW            → SHADOW_ONLY 강등
 *   DISABLE_RESTRICTED_AUTOVERIFY_ONLY → stage 유지, auto-verify만 off
 *
 * 판정 우선순위:
 *   P0: invariant violation → ROLLBACK_TO_SHADOW
 *   P1: halt 이력 → ROLLBACK_TO_ACTIVE_5
 *   P2: false-safe confirmed → DISABLE or ROLLBACK
 *   P3: high-risk 0 + eligible → GO_RESTRICTED / GO_NO_AUTOVERIFY
 *   P4: marginal → HOLD
 */

import type {
  FinalDecision,
  CanaryStage,
  OpsApproval,
  AutoVerifyEligibilityDecision,
} from "./types";

// ── Decision Input ──

export interface DecisionInput {
  documentType: string;
  currentStage: CanaryStage;

  // Promotion Gate 결과
  totalProcessed: number;
  minVolumeRequired: number;

  // High-risk 지표
  highRiskTotal: number;
  unknownClassificationCount: number;
  haltCount: number;

  // 품질 지표
  fallbackRate: number;
  mismatchRate: number;
  timeoutRate: number;
  providerErrorRate: number;
  latencyP95Ms: number;

  // Auto-verify eligibility
  autoVerifyEligibility: AutoVerifyEligibilityDecision;
  falseSafeCandidateCount: number;
  falseSafeConfirmedCount: number;

  // 임계치
  maxFallbackRate: number;
  maxMismatchRate: number;
  maxTimeoutRate: number;
  maxProviderErrorRate: number;
  maxLatencyP95Ms: number;
  marginalFallbackRate: number;
  marginalMismatchRate: number;
}

export interface DecisionResult {
  decision: FinalDecision;
  reasons: string[];
  targetStage: CanaryStage;
  targetAllowAutoVerify: boolean;
  requiresOpsApproval: boolean;
}

/**
 * 최종 운영 판정 — FinalDecision 6종 중 1개 반환.
 * 판정 우선순위: P0 > P1 > P2 > P3 > P4.
 */
export function resolveDecision(input: DecisionInput): DecisionResult {
  const reasons: string[] = [];

  // ── P0: Invariant violation → ROLLBACK_TO_SHADOW ──
  if (input.highRiskTotal > 0 || input.unknownClassificationCount > 0) {
    if (input.highRiskTotal > 0) reasons.push(`High-risk ${input.highRiskTotal}건 감지`);
    if (input.unknownClassificationCount > 0) reasons.push(`Unknown Classification ${input.unknownClassificationCount}건`);
    return {
      decision: "ROLLBACK_TO_SHADOW",
      reasons,
      targetStage: "SHADOW_ONLY",
      targetAllowAutoVerify: false,
      requiresOpsApproval: false,
    };
  }

  // ── P1: Halt 이력 → ROLLBACK_TO_ACTIVE_5 ──
  if (input.haltCount > 0) {
    reasons.push(`Circuit Breaker Halt ${input.haltCount}건 발동`);
    return {
      decision: "ROLLBACK_TO_ACTIVE_5",
      reasons,
      targetStage: "ACTIVE_5",
      targetAllowAutoVerify: false,
      requiresOpsApproval: false,
    };
  }

  // ── P2: False-safe confirmed → DISABLE or ROLLBACK ──
  if (input.falseSafeConfirmedCount > 0) {
    reasons.push(`False-safe 확인 ${input.falseSafeConfirmedCount}건`);
    if (input.falseSafeConfirmedCount >= 3) {
      reasons.push("3건 이상 — ACTIVE_5 강등");
      return {
        decision: "ROLLBACK_TO_ACTIVE_5",
        reasons,
        targetStage: "ACTIVE_5",
        targetAllowAutoVerify: false,
        requiresOpsApproval: false,
      };
    }
    return {
      decision: "DISABLE_RESTRICTED_AUTOVERIFY_ONLY",
      reasons,
      targetStage: input.currentStage,
      targetAllowAutoVerify: false,
      requiresOpsApproval: true,
    };
  }

  // ── Volume check ──
  if (input.totalProcessed < input.minVolumeRequired) {
    reasons.push(`평가 모수 부족: ${input.totalProcessed}건 < ${input.minVolumeRequired}건`);
    return {
      decision: "HOLD",
      reasons,
      targetStage: input.currentStage,
      targetAllowAutoVerify: false,
      requiresOpsApproval: false,
    };
  }

  // ── 품질 지표 검사 ──
  const fallbackOk = input.fallbackRate <= input.maxFallbackRate;
  const mismatchOk = input.mismatchRate <= input.maxMismatchRate;
  const timeoutOk = input.timeoutRate <= input.maxTimeoutRate;
  const providerOk = input.providerErrorRate <= input.maxProviderErrorRate;
  const latencyOk = input.latencyP95Ms <= input.maxLatencyP95Ms;

  const allGreen = fallbackOk && mismatchOk && timeoutOk && providerOk && latencyOk;

  if (!allGreen) {
    // Marginal 판정
    const isMarginal =
      input.fallbackRate <= input.marginalFallbackRate &&
      input.mismatchRate <= input.marginalMismatchRate &&
      timeoutOk && providerOk && latencyOk;

    if (!fallbackOk) reasons.push(`Fallback ${(input.fallbackRate * 100).toFixed(1)}%`);
    if (!mismatchOk) reasons.push(`Mismatch ${(input.mismatchRate * 100).toFixed(1)}%`);
    if (!timeoutOk) reasons.push(`Timeout ${(input.timeoutRate * 100).toFixed(1)}%`);
    if (!providerOk) reasons.push(`Provider Error ${(input.providerErrorRate * 100).toFixed(1)}%`);
    if (!latencyOk) reasons.push(`P95 ${input.latencyP95Ms}ms > ${input.maxLatencyP95Ms}ms`);

    if (isMarginal) {
      reasons.push("경계선 — HOLD 판정");
      return {
        decision: "HOLD",
        reasons,
        targetStage: input.currentStage,
        targetAllowAutoVerify: false,
        requiresOpsApproval: false,
      };
    }

    // Marginal 초과 → ROLLBACK_TO_ACTIVE_5
    reasons.push("Marginal 초과 — ROLLBACK");
    return {
      decision: "ROLLBACK_TO_ACTIVE_5",
      reasons,
      targetStage: "ACTIVE_5",
      targetAllowAutoVerify: false,
      requiresOpsApproval: false,
    };
  }

  // ── P3: 모든 지표 Green → GO 판정 ──
  reasons.push("모든 Zero-risk 조건 충족");

  // Auto-verify eligibility 평가
  const eligible = ["ELIGIBLE_RESTRICTED", "ELIGIBLE_WITH_TEMPLATE_EXCLUSIONS", "ELIGIBLE_WITH_VENDOR_EXCLUSIONS"];
  if (eligible.includes(input.autoVerifyEligibility) && input.falseSafeCandidateCount === 0) {
    reasons.push(`Auto-verify eligibility: ${input.autoVerifyEligibility}`);
    return {
      decision: "GO_RESTRICTED",
      reasons,
      targetStage: "ACTIVE_50",
      targetAllowAutoVerify: true,
      requiresOpsApproval: true,
    };
  }

  reasons.push(`Auto-verify 미활성 (eligibility: ${input.autoVerifyEligibility})`);
  return {
    decision: "GO_ACTIVE_50_NO_AUTOVERIFY",
    reasons,
    targetStage: "ACTIVE_50",
    targetAllowAutoVerify: false,
    requiresOpsApproval: true,
  };
}

// ── Ops Approval Validator ──

export function validateOpsApproval(approval: OpsApproval): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!approval.approvedBy) errors.push("approvedBy 필수");
  if (!approval.basisReportId) errors.push("basisReportId 필수");
  if (!approval.documentType) errors.push("documentType 필수");

  // 판정 일관성 검증
  const stageMap: Record<FinalDecision, CanaryStage | null> = {
    GO_RESTRICTED: "ACTIVE_50",
    GO_ACTIVE_50_NO_AUTOVERIFY: "ACTIVE_50",
    HOLD: null,
    ROLLBACK_TO_ACTIVE_5: "ACTIVE_5",
    ROLLBACK_TO_SHADOW: "SHADOW_ONLY",
    DISABLE_RESTRICTED_AUTOVERIFY_ONLY: null,
  };

  const expectedStage = stageMap[approval.decision];
  if (expectedStage && approval.nextStage !== expectedStage) {
    errors.push(`${approval.decision} 판정 시 nextStage는 ${expectedStage}이어야 함 (현재: ${approval.nextStage})`);
  }

  if (approval.decision === "GO_RESTRICTED" && !approval.restrictedAutoVerifyEnabled) {
    errors.push("GO_RESTRICTED 판정 시 restrictedAutoVerifyEnabled=true 필요");
  }

  return { valid: errors.length === 0, errors };
}

// ── Ops Approval Log ──

export interface OpsApprovalLog {
  approval: OpsApproval;
  executedAt: string;
  executedStage: CanaryStage;
  executedAutoVerify: boolean;
}

export function createApprovalLog(
  approval: OpsApproval,
  executedStage: CanaryStage,
  executedAutoVerify: boolean,
): OpsApprovalLog {
  return {
    approval,
    executedAt: new Date().toISOString(),
    executedStage,
    executedAutoVerify,
  };
}
