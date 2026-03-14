/**
 * Portfolio Governor — 최상위 거버넌스 레이어
 *
 * 개별 문서 타입의 지표와 무관하게, 전체 포트폴리오 관점에서
 * 운영 용량(Ops Capacity)과 인시던트 부하(Incident Load)를 계산하여
 * 확장을 통제합니다.
 *
 * 원칙: 개별 지표가 완벽해도 용량 부족 시 승격 불가
 */

import { assessCapacity, collectCapacityInput } from "./capacity-manager";
import { classifyDocTypeTier, validateConcurrentPromotion } from "./doctype-tiering";
import { checkExpansionPolicy, getPortfolioMode } from "./expansion-policy";
import { checkExclusion, applyExclusionsToDocType } from "./shared-exclusion-registry";
import { checkFreezeBlock, isInFreezeWindow } from "./launch-readiness-gate";
import { getAllRegistryEntries } from "./doctype-registry";
import type { LifecycleState } from "./rollout-state-machine";
import type { CapacityStatus, CapacityAssessment } from "./capacity-manager";
import type { RiskTier, TieringResult } from "./doctype-tiering";
import type { ExpansionPolicyResult } from "./expansion-policy";

// ── Types ──

export interface GovernorDecision {
  documentType: string;
  targetStage: LifecycleState;
  allowed: boolean;
  decision: "APPROVED" | "QUEUED" | "BLOCKED";
  reason: string | null;
  capacityAssessment: CapacityAssessment;
  tieringResult: TieringResult;
  expansionPolicy: ExpansionPolicyResult;
  freezeCheck: { blocked: boolean; reason: string | null };
  concurrentCheck: { allowed: boolean; reason: string | null };
  exclusionsApplied: string[];
  evaluatedAt: string;
}

/**
 * 신규 확장(승격) 허용 여부 최종 판정
 *
 * 판정 순서:
 * 1. Freeze window 확인
 * 2. Portfolio mode 확인
 * 3. Capacity 평가
 * 4. Risk tier 분류
 * 5. Concurrent promotion 제한
 * 6. Expansion policy 검증
 * 7. Shared exclusion 적용
 */
export function evaluateExpansionRequest(params: {
  documentType: string;
  targetStage: LifecycleState;
  tieringInput: {
    templateDiversity: number;
    vendorDiversity: number;
    historicalConflictRate: number;
    falseSafeHistory: number;
    rollbackHistory: number;
    avgConfidence: number;
    totalVolume: number;
  };
  oncallAvailable: boolean;
  oncallOverloaded?: boolean;
  lastRollbackDate: Date | null;
  lastFalseSafeDate: Date | null;
}): GovernorDecision {
  const now = new Date().toISOString();

  // 1. Freeze window
  const freezeCheck = checkFreezeBlock("PROMOTION");
  if (freezeCheck.blocked) {
    return buildDecision(params, "BLOCKED", freezeCheck.reason, now);
  }

  // 2. Capacity assessment
  const capacityInput = collectCapacityInput({
    oncallAvailable: params.oncallAvailable,
    oncallOverloaded: params.oncallOverloaded,
    activeFreezeWindowExists: isInFreezeWindow(),
  });
  const capacityAssessment = assessCapacity(capacityInput);

  // 3. Tiering
  const tieringResult = classifyDocTypeTier({
    documentType: params.documentType,
    ...params.tieringInput,
  });

  // 4. Concurrent promotion check
  const entries = getAllRegistryEntries();
  const currentlyPromoting = entries
    .filter((e) => ["ACTIVE_5", "ACTIVE_25", "ACTIVE_50"].includes(e.lifecycleState))
    .map((e) => ({
      documentType: e.documentType,
      tier: "TIER_2_MODERATE" as RiskTier, // simplified; in production, read from tiering cache
    }));
  const concurrentCheck = validateConcurrentPromotion(tieringResult.tier, currentlyPromoting);

  // 5. Expansion policy
  const currentlyPromotingToActive5 = entries.filter((e) => e.lifecycleState === "ACTIVE_5").length;
  const currentlyPromotingAbove25 = entries.filter((e) =>
    ["ACTIVE_25", "ACTIVE_50", "ACTIVE_100"].includes(e.lifecycleState),
  ).length;
  const totalActive = entries.filter((e) => e.lifecycleState !== "OFF" && e.lifecycleState !== "SHADOW_ONLY").length;

  const expansionPolicy = checkExpansionPolicy({
    documentType: params.documentType,
    targetStage: params.targetStage,
    riskTier: tieringResult.tier,
    currentlyPromotingToActive5,
    currentlyPromotingAbove25,
    totalActiveDocTypes: totalActive,
    lastRollbackDate: params.lastRollbackDate,
    lastFalseSafeDate: params.lastFalseSafeDate,
  });

  // 6. Shared exclusions
  const exclusionsApplied = applyExclusionsToDocType(params.documentType);

  // ── Final decision ──
  if (capacityAssessment.status === "CAPACITY_BLOCKED") {
    return buildDecisionFull(params, "BLOCKED", "Portfolio capacity BLOCKED — 전면 동결",
      capacityAssessment, tieringResult, expansionPolicy, freezeCheck, concurrentCheck, exclusionsApplied, now);
  }

  if (!concurrentCheck.allowed) {
    return buildDecisionFull(params, "BLOCKED", concurrentCheck.reason,
      capacityAssessment, tieringResult, expansionPolicy, freezeCheck, concurrentCheck, exclusionsApplied, now);
  }

  if (!expansionPolicy.allowed) {
    return buildDecisionFull(params, "BLOCKED", expansionPolicy.reason,
      capacityAssessment, tieringResult, expansionPolicy, freezeCheck, concurrentCheck, exclusionsApplied, now);
  }

  if (capacityAssessment.status === "CAPACITY_TIGHT") {
    // TIGHT = queue, will be processed when capacity improves
    return buildDecisionFull(params, "QUEUED", "Capacity TIGHT — 대기열에 추가됨",
      capacityAssessment, tieringResult, expansionPolicy, freezeCheck, concurrentCheck, exclusionsApplied, now);
  }

  // All clear
  return buildDecisionFull(params, "APPROVED", null,
    capacityAssessment, tieringResult, expansionPolicy, freezeCheck, concurrentCheck, exclusionsApplied, now);
}

// ── Portfolio Risk Summary ──

export interface PortfolioRiskSummary {
  mode: string;
  capacityStatus: CapacityStatus;
  totalDocTypes: number;
  activeDocTypes: number;
  tierDistribution: Record<string, number>;
  blockedPromotions: number;
  queuedPromotions: number;
  recommendations: string[];
}

export function getPortfolioRiskSummary(params: {
  oncallAvailable: boolean;
}): PortfolioRiskSummary {
  const mode = getPortfolioMode();
  const capacityInput = collectCapacityInput({
    oncallAvailable: params.oncallAvailable,
    activeFreezeWindowExists: isInFreezeWindow(),
  });
  const capacity = assessCapacity(capacityInput);
  const entries = getAllRegistryEntries();

  const recommendations: string[] = [];
  if (capacity.status === "CAPACITY_BLOCKED") recommendations.push("운영 용량 동결 — 인시던트 해결 우선");
  if (capacity.status === "CAPACITY_TIGHT") recommendations.push("용량 제한 — 저위험 승격만 허용");
  if (mode.current !== "NORMAL") recommendations.push(`Portfolio 모드: ${mode.current} — ${mode.reason}`);

  return {
    mode: mode.current,
    capacityStatus: capacity.status,
    totalDocTypes: entries.length,
    activeDocTypes: entries.filter((e) => e.lifecycleState !== "OFF" && e.lifecycleState !== "SHADOW_ONLY").length,
    tierDistribution: {}, // would be populated from tiering cache
    blockedPromotions: 0, // would come from promotion queue
    queuedPromotions: 0,  // would come from promotion queue
    recommendations,
  };
}

// ── Helpers ──

function buildDecision(
  params: { documentType: string; targetStage: LifecycleState },
  decision: GovernorDecision["decision"],
  reason: string | null,
  evaluatedAt: string,
): GovernorDecision {
  return {
    documentType: params.documentType,
    targetStage: params.targetStage,
    allowed: decision === "APPROVED",
    decision,
    reason,
    capacityAssessment: { status: "CAPACITY_BLOCKED", score: 0, factors: [], allowedActions: [], blockedActions: [] },
    tieringResult: { documentType: params.documentType, tier: "TIER_2_MODERATE", score: 0, factors: [] },
    expansionPolicy: { allowed: false, reason, mode: "FREEZE", constraints: [] },
    freezeCheck: { blocked: true, reason },
    concurrentCheck: { allowed: true, reason: null },
    exclusionsApplied: [],
    evaluatedAt,
  };
}

function buildDecisionFull(
  params: { documentType: string; targetStage: LifecycleState },
  decision: GovernorDecision["decision"],
  reason: string | null,
  capacityAssessment: CapacityAssessment,
  tieringResult: TieringResult,
  expansionPolicy: ExpansionPolicyResult,
  freezeCheck: { blocked: boolean; reason: string | null },
  concurrentCheck: { allowed: boolean; reason: string | null },
  exclusionsApplied: string[],
  evaluatedAt: string,
): GovernorDecision {
  return {
    documentType: params.documentType,
    targetStage: params.targetStage,
    allowed: decision === "APPROVED",
    decision,
    reason,
    capacityAssessment,
    tieringResult,
    expansionPolicy,
    freezeCheck,
    concurrentCheck,
    exclusionsApplied,
    evaluatedAt,
  };
}
