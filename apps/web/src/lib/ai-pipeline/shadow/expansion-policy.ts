/**
 * Expansion Policy — 포트폴리오 모드 및 확장 정책
 *
 * 하드코딩 정책:
 * - 동시 신규 ACTIVE_5 최대 1개
 * - ACTIVE_25 이상 승격 동시 최대 2개
 *
 * 포트폴리오 모드:
 * NORMAL ↔ SLOWDOWN ↔ FREEZE ↔ INCIDENT_CONTAINMENT
 */

import type { LifecycleState } from "./rollout-state-machine";
import type { RiskTier } from "./doctype-tiering";

// ── Portfolio Mode ──

export type PortfolioMode = "NORMAL" | "SLOWDOWN" | "FREEZE" | "INCIDENT_CONTAINMENT";

export interface PortfolioModeState {
  current: PortfolioMode;
  changedAt: Date;
  changedBy: string;
  reason: string;
  containedDocTypes?: string[]; // only for INCIDENT_CONTAINMENT
}

// In-memory state (production: DB-backed)
let portfolioModeState: PortfolioModeState = {
  current: "NORMAL",
  changedAt: new Date(),
  changedBy: "system",
  reason: "초기 상태",
};

export function getPortfolioMode(): PortfolioModeState {
  return { ...portfolioModeState };
}

export function setPortfolioMode(params: {
  mode: PortfolioMode;
  changedBy: string;
  reason: string;
  containedDocTypes?: string[];
}): PortfolioModeState {
  portfolioModeState = {
    current: params.mode,
    changedAt: new Date(),
    changedBy: params.changedBy,
    reason: params.reason,
    containedDocTypes: params.containedDocTypes,
  };
  return { ...portfolioModeState };
}

// ── Expansion Limits (하드코딩 정책) ──

export const EXPANSION_LIMITS = {
  maxConcurrentNewActive5: 1,           // 동시 신규 ACTIVE_5 최대 1개
  maxConcurrentPromotionsAbove25: 2,    // ACTIVE_25 이상 승격 동시 최대 2개
  maxTotalActiveDocTypes: 5,            // 총 active DocType 수 제한
  coolingPeriodDays: 14,                // 롤백 후 재승격 대기 기간
  coolingPeriodAfterFalseSafeDays: 30,  // False-safe 후 재승격 대기 기간
} as const;

// ── Policy Checks ──

export interface ExpansionPolicyResult {
  allowed: boolean;
  reason: string | null;
  mode: PortfolioMode;
  constraints: string[];
}

/**
 * 승격 허용 여부 판정 — 모든 정책 검증
 */
export function checkExpansionPolicy(params: {
  documentType: string;
  targetStage: LifecycleState;
  riskTier: RiskTier;
  currentlyPromotingToActive5: number;
  currentlyPromotingAbove25: number;
  totalActiveDocTypes: number;
  lastRollbackDate: Date | null;
  lastFalseSafeDate: Date | null;
}): ExpansionPolicyResult {
  const mode = portfolioModeState.current;
  const constraints: string[] = [];

  // ── Mode-based blocks ──
  if (mode === "FREEZE") {
    return {
      allowed: false,
      reason: `Portfolio FREEZE — ${portfolioModeState.reason}`,
      mode,
      constraints: ["FREEZE"],
    };
  }

  if (mode === "INCIDENT_CONTAINMENT") {
    const isContained = portfolioModeState.containedDocTypes?.includes(params.documentType);
    if (isContained) {
      return {
        allowed: false,
        reason: `INCIDENT_CONTAINMENT — ${params.documentType} 격리 중`,
        mode,
        constraints: ["INCIDENT_CONTAINMENT"],
      };
    }
    constraints.push("INCIDENT_CONTAINMENT_ACTIVE");
  }

  if (mode === "SLOWDOWN") {
    // SLOWDOWN: Low-risk만 승격
    const isLowRisk = params.riskTier === "TIER_1_STABLE" || params.riskTier === "TIER_2_MODERATE";
    if (!isLowRisk) {
      return {
        allowed: false,
        reason: `Portfolio SLOWDOWN — Low-risk만 승격 가능 (현재: ${params.riskTier})`,
        mode,
        constraints: ["SLOWDOWN_HIGH_RISK_BLOCKED"],
      };
    }
    constraints.push("SLOWDOWN_LOW_RISK_ONLY");
  }

  // ── Hard limits ──

  // 동시 신규 ACTIVE_5 최대 1개
  if (params.targetStage === "ACTIVE_5" && params.currentlyPromotingToActive5 >= EXPANSION_LIMITS.maxConcurrentNewActive5) {
    return {
      allowed: false,
      reason: `동시 신규 ACTIVE_5 최대 ${EXPANSION_LIMITS.maxConcurrentNewActive5}개 초과`,
      mode,
      constraints: ["MAX_CONCURRENT_ACTIVE_5"],
    };
  }

  // ACTIVE_25 이상 승격 동시 최대 2개
  const isAbove25 = ["ACTIVE_25", "ACTIVE_50", "ACTIVE_100"].includes(params.targetStage);
  if (isAbove25 && params.currentlyPromotingAbove25 >= EXPANSION_LIMITS.maxConcurrentPromotionsAbove25) {
    return {
      allowed: false,
      reason: `ACTIVE_25 이상 동시 승격 최대 ${EXPANSION_LIMITS.maxConcurrentPromotionsAbove25}개 초과`,
      mode,
      constraints: ["MAX_CONCURRENT_ABOVE_25"],
    };
  }

  // 총 active DocType 수 제한
  if (params.targetStage === "ACTIVE_5" && params.totalActiveDocTypes >= EXPANSION_LIMITS.maxTotalActiveDocTypes) {
    return {
      allowed: false,
      reason: `총 active DocType 수 ${EXPANSION_LIMITS.maxTotalActiveDocTypes}개 초과`,
      mode,
      constraints: ["MAX_TOTAL_ACTIVE"],
    };
  }

  // Cooling period — 롤백 후 재승격 대기
  if (params.lastRollbackDate) {
    const daysSinceRollback = (Date.now() - params.lastRollbackDate.getTime()) / (24 * 3600_000);
    if (daysSinceRollback < EXPANSION_LIMITS.coolingPeriodDays) {
      return {
        allowed: false,
        reason: `Cooling period — 롤백 후 ${EXPANSION_LIMITS.coolingPeriodDays}일 대기 필요 (잔여 ${Math.ceil(EXPANSION_LIMITS.coolingPeriodDays - daysSinceRollback)}일)`,
        mode,
        constraints: ["COOLING_PERIOD"],
      };
    }
  }

  // Cooling period — false-safe 후 재승격 대기
  if (params.lastFalseSafeDate) {
    const daysSinceFalseSafe = (Date.now() - params.lastFalseSafeDate.getTime()) / (24 * 3600_000);
    if (daysSinceFalseSafe < EXPANSION_LIMITS.coolingPeriodAfterFalseSafeDays) {
      return {
        allowed: false,
        reason: `False-safe cooling — ${EXPANSION_LIMITS.coolingPeriodAfterFalseSafeDays}일 대기 필요 (잔여 ${Math.ceil(EXPANSION_LIMITS.coolingPeriodAfterFalseSafeDays - daysSinceFalseSafe)}일)`,
        mode,
        constraints: ["FALSE_SAFE_COOLING"],
      };
    }
  }

  return { allowed: true, reason: null, mode, constraints };
}

// ── Auto Mode Transition ──

/**
 * 시스템 상태에 따라 자동으로 모드 전환
 */
export function evaluateAutoModeTransition(params: {
  recentRollbackCount: number;      // last 7 days
  reviewBacklogOverflow: boolean;   // capacity > 90%
  openSev0Count: number;
  openSev1Count: number;
  currentMode: PortfolioMode;
}): { shouldTransition: boolean; targetMode: PortfolioMode; reason: string } | null {
  const { currentMode } = params;

  // → FREEZE: SEV0 open 또는 rollback 3+ in 7 days
  if (params.openSev0Count > 0 && currentMode !== "FREEZE") {
    return { shouldTransition: true, targetMode: "FREEZE", reason: `SEV0 인시던트 ${params.openSev0Count}건 미해결` };
  }
  if (params.recentRollbackCount >= 3 && currentMode !== "FREEZE") {
    return { shouldTransition: true, targetMode: "FREEZE", reason: `7일간 롤백 ${params.recentRollbackCount}회 — 전면 동결` };
  }

  // → SLOWDOWN: SEV1 open 또는 review backlog overflow
  if ((params.openSev1Count > 0 || params.reviewBacklogOverflow) && currentMode === "NORMAL") {
    const reason = params.openSev1Count > 0
      ? `SEV1 인시던트 ${params.openSev1Count}건`
      : "리뷰 백로그 오버플로우";
    return { shouldTransition: true, targetMode: "SLOWDOWN", reason };
  }

  // → NORMAL: all clear
  if (currentMode !== "NORMAL"
    && params.openSev0Count === 0
    && params.openSev1Count === 0
    && !params.reviewBacklogOverflow
    && params.recentRollbackCount < 2
  ) {
    return { shouldTransition: true, targetMode: "NORMAL", reason: "모든 지표 정상 — 정상 모드 복귀" };
  }

  return null;
}

// ── Third DocType Admission Gate ──

/**
 * 세 번째 문서 타입 진입 게이트
 */
export function checkThirdDocTypeAdmission(params: {
  firstDocTypeStable: boolean;
  secondDocTypeControlled: boolean; // at least ACTIVE_25 stable
  capacityOk: boolean;
  noActiveFreezeWindow: boolean;
  portfolioMode: PortfolioMode;
}): { admitted: boolean; blockers: string[] } {
  const blockers: string[] = [];

  if (!params.firstDocTypeStable) blockers.push("First DocType이 FULL_ACTIVE_STABLE이 아닙니다");
  if (!params.secondDocTypeControlled) blockers.push("Second DocType이 안정 상태가 아닙니다");
  if (!params.capacityOk) blockers.push("운영 용량이 부족합니다 (CAPACITY_OK 필요)");
  if (!params.noActiveFreezeWindow) blockers.push("활성 Freeze Window가 존재합니다");
  if (params.portfolioMode !== "NORMAL") blockers.push(`Portfolio 모드가 NORMAL이 아닙니다 (현재: ${params.portfolioMode})`);

  return { admitted: blockers.length === 0, blockers };
}
