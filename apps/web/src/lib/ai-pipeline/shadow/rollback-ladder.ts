/**
 * Rollback Ladder — 단계적 롤백 + 심각도별 depth 결정
 *
 * 허용 경로:
 *   ACTIVE_100 → ACTIVE_50 → ACTIVE_25 → ACTIVE_5 → SHADOW_ONLY → OFF
 *
 * 심각도별 롤백 depth:
 *   CRITICAL (invariant 위반):  즉시 SHADOW_ONLY
 *   HIGH     (error spike):     현재 - 2단계 (최소 ACTIVE_5)
 *   MEDIUM   (반복 anomaly):    현재 - 1단계 (hold 후 review)
 *   LOW      (marginal 지표):   hold (롤백 없음, 모니터링 강화)
 */

import type { CanaryStage, MismatchCategory } from "./types";
import { CANARY_STAGES } from "./types";

export type RollbackSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface RollbackDecision {
  shouldRollback: boolean;
  severity: RollbackSeverity;
  currentStage: CanaryStage;
  targetStage: CanaryStage | null;
  reason: string;
  action: "ROLLBACK" | "HOLD_AND_REVIEW" | "MONITOR";
}

export interface RollbackLadderConfig {
  /** CRITICAL: invariant 위반 → 즉시 SHADOW_ONLY */
  criticalCategories: MismatchCategory[];
  /** HIGH: error spike → 2단계 강등 */
  highCategories: MismatchCategory[];
  /** MEDIUM: 반복 anomaly → 1단계 강등 */
  mediumCategories: MismatchCategory[];
}

const DEFAULT_LADDER_CONFIG: RollbackLadderConfig = {
  criticalCategories: [
    "AUTO_VERIFY_RISK",
    "ORG_SCOPE_BLOCKED",
    "TASK_MAPPING_DIFF",
    "UNKNOWN_CLASSIFICATION",
  ],
  highCategories: [
    "PROVIDER_ERROR_FALLBACK",
    "TIMEOUT_FALLBACK",
  ],
  mediumCategories: [
    "DOC_TYPE_DIFF",
    "VERIFICATION_DIFF",
    "EXTRACTION_DIFF",
    "SCHEMA_INVALID_FALLBACK",
  ],
};

/**
 * 이벤트 심각도에 따른 롤백 대상 Stage를 결정.
 */
export function resolveRollbackTarget(
  currentStage: CanaryStage,
  mismatchCategory: MismatchCategory,
  config: RollbackLadderConfig = DEFAULT_LADDER_CONFIG,
): RollbackDecision {
  const currentIdx = CANARY_STAGES.indexOf(currentStage);

  // OFF/SHADOW_ONLY → 롤백 불필요
  if (currentIdx <= 1) {
    return {
      shouldRollback: false,
      severity: "LOW",
      currentStage,
      targetStage: null,
      reason: "이미 SHADOW_ONLY 이하",
      action: "MONITOR",
    };
  }

  // ── CRITICAL: 즉시 SHADOW_ONLY ──
  if (config.criticalCategories.includes(mismatchCategory)) {
    return {
      shouldRollback: true,
      severity: "CRITICAL",
      currentStage,
      targetStage: "SHADOW_ONLY",
      reason: `Invariant 위반 (${mismatchCategory}) — 즉시 SHADOW_ONLY 강등`,
      action: "ROLLBACK",
    };
  }

  // ── HIGH: 2단계 강등 (최소 ACTIVE_5) ──
  if (config.highCategories.includes(mismatchCategory)) {
    const targetIdx = Math.max(currentIdx - 2, 2); // 최소 ACTIVE_5(idx=2)
    return {
      shouldRollback: true,
      severity: "HIGH",
      currentStage,
      targetStage: CANARY_STAGES[targetIdx],
      reason: `Error spike (${mismatchCategory}) — ${currentStage} → ${CANARY_STAGES[targetIdx]}`,
      action: "ROLLBACK",
    };
  }

  // ── MEDIUM: 1단계 강등 + review ──
  if (config.mediumCategories.includes(mismatchCategory)) {
    const targetIdx = Math.max(currentIdx - 1, 1); // 최소 SHADOW_ONLY(idx=1)
    return {
      shouldRollback: false, // 즉시 롤백 아닌 hold 후 review
      severity: "MEDIUM",
      currentStage,
      targetStage: CANARY_STAGES[targetIdx],
      reason: `반복 anomaly (${mismatchCategory}) — hold 후 review 권고 (${currentStage} → ${CANARY_STAGES[targetIdx]})`,
      action: "HOLD_AND_REVIEW",
    };
  }

  // ── LOW: 모니터링 ──
  return {
    shouldRollback: false,
    severity: "LOW",
    currentStage,
    targetStage: null,
    reason: `저위험 (${mismatchCategory}) — 모니터링 유지`,
    action: "MONITOR",
  };
}

/** 전체 Rollback Ladder 매트릭스 반환 (문서화용) */
export function getRollbackLadderMatrix(): {
  stage: CanaryStage;
  critical: CanaryStage;
  high: CanaryStage;
  medium: CanaryStage;
  low: string;
}[] {
  return CANARY_STAGES.filter((s) => s !== "OFF" && s !== "SHADOW_ONLY").map((stage) => {
    const idx = CANARY_STAGES.indexOf(stage);
    return {
      stage,
      critical: "SHADOW_ONLY",
      high: CANARY_STAGES[Math.max(idx - 2, 2)] as CanaryStage,
      medium: CANARY_STAGES[Math.max(idx - 1, 1)] as CanaryStage,
      low: "MONITOR (유지)",
    };
  });
}

/**
 * 다음 문서 타입 확장 가능 여부 판정.
 * 첫 문서 타입이 ACTIVE_50에서 안정화되어야만 두 번째 문서 타입 ACTIVE_5 시작 가능.
 */
export interface ExpansionEligibility {
  eligible: boolean;
  currentPrimaryDocType: string;
  currentPrimaryStage: CanaryStage;
  reasons: string[];
  suggestedNextDocType: string | null;
}

export function evaluateExpansionEligibility(
  primaryDocType: string,
  primaryStage: CanaryStage,
  primaryHaltCount: number,
  primaryHighRiskCount: number,
  allDocTypeStages: Record<string, CanaryStage>,
): ExpansionEligibility {
  const reasons: string[] = [];
  let eligible = true;

  // 1. 첫 문서 타입이 ACTIVE_50 이상이어야 함
  const stageIdx = CANARY_STAGES.indexOf(primaryStage);
  if (stageIdx < 4) { // ACTIVE_50 = index 4
    eligible = false;
    reasons.push(`${primaryDocType} 현재 ${primaryStage} — ACTIVE_50 이상 필요`);
  }

  // 2. Halt 이력 0
  if (primaryHaltCount > 0) {
    eligible = false;
    reasons.push(`${primaryDocType} Halt 이력 ${primaryHaltCount}건 — 안정화 미달`);
  }

  // 3. High-risk 0
  if (primaryHighRiskCount > 0) {
    eligible = false;
    reasons.push(`${primaryDocType} High-risk ${primaryHighRiskCount}건 — 안정화 미달`);
  }

  // 4. 동시에 여러 새 문서 타입이 Active가 아니어야 함
  const activeDocTypes = Object.entries(allDocTypeStages)
    .filter(([dt, stage]) => dt !== primaryDocType && CANARY_STAGES.indexOf(stage) >= 2);
  if (activeDocTypes.length > 0) {
    eligible = false;
    reasons.push(`이미 Active 중인 다른 문서 타입: ${activeDocTypes.map(([dt, s]) => `${dt}(${s})`).join(", ")}`);
  }

  if (eligible) {
    reasons.push("확장 가능 — 두 번째 문서 타입 ACTIVE_5 시작 가능");
  }

  return {
    eligible,
    currentPrimaryDocType: primaryDocType,
    currentPrimaryStage: primaryStage,
    reasons,
    suggestedNextDocType: eligible ? "INVOICE" : null, // 가장 안전한 차순위
  };
}
