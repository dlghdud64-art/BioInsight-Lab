/**
 * @module succession-dashboard-cards
 * @description 승계 무결성 대시보드 카드 — closure-dashboard와 통합하여
 * 이전 프로토콜 상태, 준비도 게이트, 판단 연속성, 의무 인계,
 * 메모리 무결성, 권한 모니터링을 시각화한다.
 */

import type {
  SuccessionSimulationReport,
} from "./succession-integrity-simulation";

// ─────────────────────────────────────────────
// 대시보드 카드 유형
// ─────────────────────────────────────────────

/** 대시보드 메트릭 상태 */
export type SuccessionMetricStatus = "GREEN" | "YELLOW" | "RED";

/** 대시보드 메트릭 */
export interface SuccessionDashboardMetric {
  /** 라벨 */
  label: string;
  /** 값 */
  value: string | number;
  /** 상태 */
  status: SuccessionMetricStatus;
}

/** 승계 대시보드 카드 */
export interface SuccessionDashboardCard {
  /** 카드 ID */
  id: string;
  /** 제목 */
  title: string;
  /** 카테고리 */
  category: string;
  /** 메트릭 목록 */
  metrics: SuccessionDashboardMetric[];
  /** 최종 갱신 시각 */
  lastUpdated: string;
}

// ─────────────────────────────────────────────
// 대시보드 카드 생성
// ─────────────────────────────────────────────

/**
 * 승계 대시보드 카드 6종을 생성한다.
 * 시뮬레이션 보고서를 기반으로 각 카드의 메트릭을 산출한다.
 */
export function getSuccessionDashboardCards(
  report: SuccessionSimulationReport
): SuccessionDashboardCard[] {
  const now = new Date().toISOString();
  const cards: SuccessionDashboardCard[] = [];

  // 1. Transfer Protocol Status
  const allSteps = report.scenarioResults.flatMap((r) => r.transferStepResults);
  const completedSteps = allSteps.filter((s) => s.status === "COMPLETED").length;
  const failedSteps = allSteps.filter((s) => s.status === "FAILED").length;
  const currentStepEntry = allSteps.find((s) => s.status === "IN_PROGRESS");
  const blockerCount = allSteps.filter((s) => s.status === "FAILED" || s.status === "ROLLED_BACK").length;

  cards.push({
    id: "SDC-TRANSFER-PROTOCOL",
    title: "이전 프로토콜 상태",
    category: "TRANSFER_PROTOCOL",
    metrics: [
      {
        label: "완료/전체 단계",
        value: `${completedSteps}/${allSteps.length}`,
        status: failedSteps === 0 ? "GREEN" : failedSteps <= 2 ? "YELLOW" : "RED",
      },
      {
        label: "현재 단계",
        value: currentStepEntry?.step ?? "N/A",
        status: "GREEN",
      },
      {
        label: "차단 요인",
        value: blockerCount,
        status: blockerCount === 0 ? "GREEN" : "RED",
      },
    ],
    lastUpdated: now,
  });

  // 2. Readiness Gate
  const gateResults = report.scenarioResults.map((r) => r.readinessGate);
  const totalCriteria = gateResults.reduce((sum, g) => sum + g.totalCount, 0);
  const passedCriteria = gateResults.reduce((sum, g) => sum + g.passedCount, 0);
  const blockedGates = gateResults.filter((g) => g.status === "GATE_BLOCKED").length;

  cards.push({
    id: "SDC-READINESS-GATE",
    title: "준비도 게이트",
    category: "READINESS_GATE",
    metrics: [
      {
        label: "기준 통과/전체",
        value: `${passedCriteria}/${totalCriteria}`,
        status: passedCriteria === totalCriteria ? "GREEN" : "YELLOW",
      },
      {
        label: "차단된 게이트",
        value: blockedGates,
        status: blockedGates === 0 ? "GREEN" : "RED",
      },
      {
        label: "게이트 상태",
        value: blockedGates === 0 ? "ALL_PASSED" : "BLOCKED",
        status: blockedGates === 0 ? "GREEN" : "RED",
      },
    ],
    lastUpdated: now,
  });

  // 3. Judgment Continuity
  const avgDivergence = report.scenarioResults.reduce(
    (sum, r) => sum + r.judgmentContinuity.divergenceScore, 0
  ) / report.scenarioResults.length;
  const totalCriticalDivergences = report.scenarioResults.reduce(
    (sum, r) => sum + r.judgmentContinuity.criticalDivergences.length, 0
  );

  cards.push({
    id: "SDC-JUDGMENT-CONTINUITY",
    title: "판단 연속성",
    category: "JUDGMENT_CONTINUITY",
    metrics: [
      {
        label: "평균 발산 점수",
        value: avgDivergence.toFixed(1),
        status: avgDivergence <= 25 ? "GREEN" : avgDivergence <= 50 ? "YELLOW" : "RED",
      },
      {
        label: "심각 발산 수",
        value: totalCriticalDivergences,
        status: totalCriticalDivergences === 0 ? "GREEN" : "RED",
      },
      {
        label: "판정",
        value: avgDivergence <= 25 ? "MAINTAINED" : avgDivergence <= 50 ? "RISK" : "FAILED",
        status: avgDivergence <= 25 ? "GREEN" : avgDivergence <= 50 ? "YELLOW" : "RED",
      },
    ],
    lastUpdated: now,
  });

  // 4. Obligation Handoff
  const totalObligations = report.scenarioResults.reduce(
    (sum, r) => sum + r.obligationHandoff.totalObligations, 0
  );
  const acknowledgedObligations = report.scenarioResults.reduce(
    (sum, r) => sum + r.obligationHandoff.acknowledgedCount, 0
  );
  const pendingObligations = totalObligations - acknowledgedObligations;

  cards.push({
    id: "SDC-OBLIGATION-HANDOFF",
    title: "의무 인계",
    category: "OBLIGATION_HANDOFF",
    metrics: [
      {
        label: "전체 의무",
        value: totalObligations,
        status: "GREEN",
      },
      {
        label: "인수 확인",
        value: acknowledgedObligations,
        status: acknowledgedObligations === totalObligations ? "GREEN" : "YELLOW",
      },
      {
        label: "미인수",
        value: pendingObligations,
        status: pendingObligations === 0 ? "GREEN" : "RED",
      },
    ],
    lastUpdated: now,
  });

  // 5. Memory Integrity
  const totalMemories = report.scenarioResults.reduce(
    (sum, r) => sum + r.memoryHandoff.totalMemories, 0
  );
  const verifiedMemories = report.scenarioResults.reduce(
    (sum, r) => sum + r.memoryHandoff.verifiedCount, 0
  );
  const corruptedMemories = report.scenarioResults.reduce(
    (sum, r) => sum + r.memoryHandoff.corruptedCount, 0
  );

  cards.push({
    id: "SDC-MEMORY-INTEGRITY",
    title: "메모리 무결성",
    category: "MEMORY_INTEGRITY",
    metrics: [
      {
        label: "전체 메모리",
        value: totalMemories,
        status: "GREEN",
      },
      {
        label: "검증 완료",
        value: verifiedMemories,
        status: verifiedMemories === totalMemories ? "GREEN" : "YELLOW",
      },
      {
        label: "손상",
        value: corruptedMemories,
        status: corruptedMemories === 0 ? "GREEN" : "RED",
      },
    ],
    lastUpdated: now,
  });

  // 6. Privilege Monitor
  const totalEscalationAttempts = report.scenarioResults.reduce(
    (sum, r) => sum + r.privilegeEscalation.signalsDetected, 0
  );
  const frozenTransfers = report.scenarioResults.filter(
    (r) => r.privilegeEscalation.transferFrozen
  ).length;

  cards.push({
    id: "SDC-PRIVILEGE-MONITOR",
    title: "권한 모니터",
    category: "PRIVILEGE_MONITOR",
    metrics: [
      {
        label: "상승 시도 탐지",
        value: totalEscalationAttempts,
        status: totalEscalationAttempts === 0 ? "GREEN" : "RED",
      },
      {
        label: "동결된 이전",
        value: frozenTransfers,
        status: frozenTransfers === 0 ? "GREEN" : "RED",
      },
      {
        label: "감시 상태",
        value: totalEscalationAttempts === 0 ? "CLEAR" : "ALERT",
        status: totalEscalationAttempts === 0 ? "GREEN" : "RED",
      },
    ],
    lastUpdated: now,
  });

  return cards;
}
