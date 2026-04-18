/**
 * @module resilience-scorecard
 * @description 회복력 스코어카드 — 시나리오 종료 후 차단 견고성, 스코프 정밀도,
 * 증적 생존성, 역할 명확성을 수치화하여 RESILIENT / RESILIENT_WITH_GAPS /
 * FRAGILE_UNDER_STRESS 중 하나를 판정한다.
 *
 * 사후 판정 매트릭스:
 * - PROCEED_TO_SCENARIO_9: 모든 지표 통과
 * - PROCEED_WITH_HARDENING_BACKLOG: 통과하나 갭 존재
 * - ESCALATE_TO_REFOUNDATION_WATCH: 심각한 취약점 발견
 */

import type { ScenarioExecutionResult } from "./resilience-stress-tester";
import type { RoleMisalignmentIncident } from "./role-misalignment-detector";
import type { AdjudicationCase } from "./borderline-adjudication-protocol";
import type { CoreInvariantCheck } from "./systemic-resilience-simulation";

// ─────────────────────────────────────────────
// 1. 스코어카드 유형
// ─────────────────────────────────────────────

/** 전체 판정 */
export type ResilienceVerdict =
  | "RESILIENT"                   // 모든 지표 통과
  | "RESILIENT_WITH_GAPS"         // 통과하나 보완 필요
  | "FRAGILE_UNDER_STRESS";       // 스트레스 하 취약

/** 사후 진행 결정 */
export type PostScenarioDecision =
  | "PROCEED_TO_SCENARIO_9"
  | "PROCEED_WITH_HARDENING_BACKLOG"
  | "ESCALATE_TO_REFOUNDATION_WATCH";

/** 개별 차원 점수 */
export interface DimensionScore {
  /** 차원 이름 */
  dimension: string;
  /** 점수 (0~100) */
  score: number;
  /** 가중치 */
  weight: number;
  /** 세부 내역 */
  breakdown: string[];
}

/** 스코어카드 */
export interface ResilienceScorecard {
  /** 스코어카드 ID */
  scorecardId: string;
  /** 생성 시각 */
  generatedAt: Date;

  // ── 차원별 점수 ──
  /** 차단 견고성 (Containment Robustness) */
  containmentRobustness: DimensionScore;
  /** 스코프 정밀도 (Scope Precision) */
  scopePrecision: DimensionScore;
  /** 증적 생존성 (Evidence Survivability) */
  evidenceSurvivability: DimensionScore;
  /** 역할 명확성 (Role Clarity) */
  roleClarity: DimensionScore;
  /** 경계선 판정 품질 (Borderline Adjudication Quality) */
  borderlineQuality: DimensionScore;
  /** 코어 불변량 유지 (Core Invariant Maintenance) */
  coreInvariantMaintenance: DimensionScore;

  // ── 종합 ──
  /** 가중 평균 점수 */
  weightedAverage: number;
  /** 전체 판정 */
  verdict: ResilienceVerdict;
  /** 사후 진행 결정 */
  decision: PostScenarioDecision;
  /** 강화 백로그 항목 */
  hardeningBacklog: string[];
}

// ─────────────────────────────────────────────
// 2. 점수 계산 함수
// ─────────────────────────────────────────────

/**
 * 스코어카드를 생성한다.
 */
export function generateResilienceScorecard(params: {
  stressResults: ScenarioExecutionResult[];
  roleMisalignments: RoleMisalignmentIncident[];
  borderlineCases: AdjudicationCase[];
  coreInvariantChecks: CoreInvariantCheck[];
}): ResilienceScorecard {
  const { stressResults, roleMisalignments, borderlineCases, coreInvariantChecks } = params;

  // ── 1. 차단 견고성 ──
  const totalIllegitimateRequests = stressResults.reduce(
    (sum, sr) => sum + sr.requestResults.filter((r) => r.classification !== "LEGITIMATE").length, 0
  );
  const blockedRequests = stressResults.reduce(
    (sum, sr) => sum + sr.requestResults.filter((r) => r.blocked && r.classification !== "LEGITIMATE").length, 0
  );
  const blockRate = totalIllegitimateRequests > 0
    ? (blockedRequests / totalIllegitimateRequests) * 100
    : 100;
  const failOpenCount = stressResults.reduce(
    (sum, sr) => sum + sr.requestResults.filter((r) => r.failOpenOccurred).length, 0
  );

  const containmentRobustness: DimensionScore = {
    dimension: "차단 견고성",
    score: Math.max(0, blockRate - failOpenCount * 20),
    weight: 0.25,
    breakdown: [
      `차단율: ${blockRate.toFixed(1)}% (${blockedRequests}/${totalIllegitimateRequests})`,
      `fail-open 발생: ${failOpenCount}건`,
      `시나리오 통과: ${stressResults.filter((r) => r.passed).length}/${stressResults.length}`,
    ],
  };

  // ── 2. 스코프 정밀도 ──
  const legitimateResults = stressResults.flatMap(
    (sr) => sr.requestResults.filter((r) => r.classification === "LEGITIMATE")
  );
  const falsePositives = legitimateResults.filter((r) => r.blocked).length;
  const scopeScore = legitimateResults.length > 0
    ? ((legitimateResults.length - falsePositives) / legitimateResults.length) * 100
    : 100;

  const scopePrecision: DimensionScore = {
    dimension: "스코프 정밀도",
    score: scopeScore,
    weight: 0.15,
    breakdown: [
      `합법 요청 처리: ${legitimateResults.length - falsePositives}/${legitimateResults.length}`,
      `false positive: ${falsePositives}건`,
    ],
  };

  // ── 3. 증적 생존성 ──
  const totalBlockedWithEvidence = stressResults.reduce(
    (sum, sr) => sum + sr.requestResults.filter((r) => r.blocked && r.evidencePreserved).length, 0
  );
  const evidenceRate = blockedRequests > 0
    ? (totalBlockedWithEvidence / blockedRequests) * 100
    : 100;

  const evidenceSurvivability: DimensionScore = {
    dimension: "증적 생존성",
    score: evidenceRate,
    weight: 0.20,
    breakdown: [
      `증적 보존율: ${evidenceRate.toFixed(1)}%`,
      `증적 보존: ${totalBlockedWithEvidence}/${blockedRequests}건`,
    ],
  };

  // ── 4. 역할 명확성 ──
  const roleScore = roleMisalignments.length === 0 ? 100
    : Math.max(0, 100 - roleMisalignments.length * 15);
  const allRoleMisalignmentsBlocked = roleMisalignments.every((r) => r.blocked);

  const roleClarity: DimensionScore = {
    dimension: "역할 명확성",
    score: allRoleMisalignmentsBlocked ? Math.max(roleScore, 70) : roleScore,
    weight: 0.15,
    breakdown: [
      `역할 혼선 탐지: ${roleMisalignments.length}건`,
      `전체 차단: ${allRoleMisalignmentsBlocked ? "YES" : "NO"}`,
      `유형: ${Array.from(new Set(roleMisalignments.map((r) => r.type))).join(", ") || "없음"}`,
    ],
  };

  // ── 5. 경계선 판정 품질 ──
  const autoExecutedBorderline = borderlineCases.filter(
    (c) => !c.autoExecutionBlocked
  ).length;
  const borderlineScore = autoExecutedBorderline === 0 ? 100
    : Math.max(0, 100 - autoExecutedBorderline * 25);

  const borderlineQuality: DimensionScore = {
    dimension: "경계선 판정 품질",
    score: borderlineScore,
    weight: 0.10,
    breakdown: [
      `경계선 케이스: ${borderlineCases.length}건`,
      `자동 실행 차단: ${borderlineCases.length - autoExecutedBorderline}/${borderlineCases.length}`,
      `타임아웃 차단: ${borderlineCases.filter((c) => c.status === "TIMED_OUT_BLOCKED").length}건`,
    ],
  };

  // ── 6. 코어 불변량 유지 ──
  const corePassCount = coreInvariantChecks.filter((c) => c.passed).length;
  const coreScore = coreInvariantChecks.length > 0
    ? (corePassCount / coreInvariantChecks.length) * 100
    : 100;

  const coreInvariantMaintenance: DimensionScore = {
    dimension: "코어 불변량 유지",
    score: coreScore,
    weight: 0.15,
    breakdown: [
      `불변량 검증: ${corePassCount}/${coreInvariantChecks.length} PASS`,
      `fail-open 탐지: ${coreInvariantChecks.filter((c) => c.failOpenDetected).length}건`,
      `코어 bypass 탐지: ${coreInvariantChecks.filter((c) => c.coreBypassDetected).length}건`,
    ],
  };

  // ── 가중 평균 ──
  const dimensions = [
    containmentRobustness, scopePrecision, evidenceSurvivability,
    roleClarity, borderlineQuality, coreInvariantMaintenance,
  ];
  const weightedAverage = dimensions.reduce(
    (sum, d) => sum + d.score * d.weight, 0
  );

  // ── 판정 ──
  let verdict: ResilienceVerdict;
  if (weightedAverage >= 90 && failOpenCount === 0 && coreScore === 100) {
    verdict = "RESILIENT";
  } else if (weightedAverage >= 70 && failOpenCount === 0) {
    verdict = "RESILIENT_WITH_GAPS";
  } else {
    verdict = "FRAGILE_UNDER_STRESS";
  }

  // ── 사후 결정 ──
  let decision: PostScenarioDecision;
  const hardeningBacklog: string[] = [];

  if (verdict === "RESILIENT") {
    decision = "PROCEED_TO_SCENARIO_9";
  } else if (verdict === "RESILIENT_WITH_GAPS") {
    decision = "PROCEED_WITH_HARDENING_BACKLOG";
    if (containmentRobustness.score < 95) hardeningBacklog.push("차단 견고성 강화 필요");
    if (scopePrecision.score < 90) hardeningBacklog.push("false positive 감소 필요");
    if (evidenceSurvivability.score < 95) hardeningBacklog.push("증적 보존 경로 강화 필요");
    if (roleClarity.score < 85) hardeningBacklog.push("역할 경계 명확화 필요");
    if (borderlineQuality.score < 90) hardeningBacklog.push("경계선 판정 프로토콜 강화 필요");
  } else {
    decision = "ESCALATE_TO_REFOUNDATION_WATCH";
    hardeningBacklog.push("구조적 취약점 — refoundation watch 에스컬레이션 필요");
  }

  return {
    scorecardId: `RSC-${Date.now()}`,
    generatedAt: new Date(),
    containmentRobustness,
    scopePrecision,
    evidenceSurvivability,
    roleClarity,
    borderlineQuality,
    coreInvariantMaintenance,
    weightedAverage,
    verdict,
    decision,
    hardeningBacklog,
  };
}
