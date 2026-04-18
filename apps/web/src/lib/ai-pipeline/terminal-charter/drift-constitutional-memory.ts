/**
 * @module drift-constitutional-memory
 * @description 시나리오 9 교훈을 헌법적 메모리에 기록한다.
 * 가장 침식에 취약한 루프, 최초 등장 드리프트 벡터, 최적 예측 신호,
 * 실질 복원 강화 조치, 안전하지 않은 carry-forward 패턴,
 * 재건 압력 증가 백로그 패턴을 기록한다.
 */

import type {
  OperatingLoopDriftSimulationResult,
  ErosionScenarioResult,
  DriftLevel,
  DriftVector,
} from "./operating-loop-drift-resistance";

// ─────────────────────────────────────────────
// 헌법적 메모리 유형
// ─────────────────────────────────────────────

/** 메모리 항목 카테고리 */
export type Scenario9MemoryCategory =
  | "MOST_EROSION_PRONE_LOOP"
  | "EARLIEST_DRIFT_VECTOR"
  | "BEST_PREDICTIVE_SIGNAL"
  | "EFFECTIVE_HARDENING"
  | "UNSAFE_CARRY_FORWARD_PATTERN"
  | "REFOUNDATION_PRESSURE_PATTERN";

/** 헌법적 메모리 항목 */
export interface ConstitutionalMemoryEntry {
  /** 항목 ID */
  entryId: string;
  /** 카테고리 */
  category: Scenario9MemoryCategory;
  /** 제목 */
  title: string;
  /** 상세 설명 */
  description: string;
  /** 관련 드리프트 벡터 */
  relatedDriftVectors: DriftVector[];
  /** 관련 드리프트 수준 */
  observedDriftLevel: DriftLevel;
  /** 교훈 */
  lesson: string;
  /** 권고 */
  recommendation: string;
  /** 기록 시각 */
  recordedAt: Date;
  /** 시뮬레이션 ID */
  sourceSimulationId: string;
}

/** 메모리 저장소 (production: DB-backed) */
const memoryStore: Map<string, ConstitutionalMemoryEntry> = new Map();

// ─────────────────────────────────────────────
// 교훈 기록 함수
// ─────────────────────────────────────────────

/**
 * 시나리오 9 교훈을 헌법적 메모리에 기록한다.
 * 6가지 관점에서 시뮬레이션 결과를 분석하여 교훈을 추출한다.
 */
export function recordScenario9Lessons(
  results: OperatingLoopDriftSimulationResult
): ConstitutionalMemoryEntry[] {
  const entries: ConstitutionalMemoryEntry[] = [];
  const now = new Date();
  let seq = 0;

  const makeId = (): string => {
    seq++;
    return `S9M-${Date.now()}-${seq}`;
  };

  // 1. 가장 침식에 취약한 루프
  const severeResults = results.erosionResults
    .filter((r) => r.hardeningRequired)
    .sort((a, b) => driftLevelSeverity(b.driftLevel) - driftLevelSeverity(a.driftLevel));

  if (severeResults.length > 0) {
    const worst = severeResults[0];
    const entry: ConstitutionalMemoryEntry = {
      entryId: makeId(),
      category: "MOST_EROSION_PRONE_LOOP",
      title: `가장 침식에 취약한 시나리오: ${worst.name}`,
      description: worst.description,
      relatedDriftVectors: extractDriftVectors(worst),
      observedDriftLevel: worst.driftLevel,
      lesson: `${worst.name} 시나리오가 가장 높은 드리프트 수준(${worst.driftLevel})을 기록하여 즉시 강화 필요`,
      recommendation: "해당 루프의 리뷰 주기를 단축하고 증거 요건을 강화해야 한다",
      recordedAt: now,
      sourceSimulationId: results.simulationId,
    };
    memoryStore.set(entry.entryId, entry);
    entries.push(entry);
  }

  // 2. 최초 등장 드리프트 벡터
  const formingResults = results.erosionResults
    .filter((r) => r.driftLevel === "DRIFT_FORMING");

  if (formingResults.length > 0) {
    const earliest = formingResults[0];
    const entry: ConstitutionalMemoryEntry = {
      entryId: makeId(),
      category: "EARLIEST_DRIFT_VECTOR",
      title: `최초 등장 드리프트: ${earliest.name}`,
      description: `DRIFT_FORMING 단계에서 탐지된 최초 드리프트 벡터`,
      relatedDriftVectors: extractDriftVectors(earliest),
      observedDriftLevel: earliest.driftLevel,
      lesson: "조기 탐지 단계(DRIFT_FORMING)에서 발견된 드리프트 벡터는 조기 개입 시 저비용으로 해소 가능",
      recommendation: "DRIFT_FORMING 탐지 시 즉시 모니터링 강화 트리거를 설정해야 한다",
      recordedAt: now,
      sourceSimulationId: results.simulationId,
    };
    memoryStore.set(entry.entryId, entry);
    entries.push(entry);
  }

  // 3. 최적 예측 신호
  const bestPredictiveEntry: ConstitutionalMemoryEntry = {
    entryId: makeId(),
    category: "BEST_PREDICTIVE_SIGNAL",
    title: "침식 최적 예측 신호 분석",
    description: analyzeBestPredictiveSignals(results.erosionResults),
    relatedDriftVectors: [],
    observedDriftLevel: results.scorecard.verdict === "LOOP_CONSTITUTIONALLY_SOUND"
      ? "DRIFT_LOW" : "DRIFT_ACTIVE",
    lesson: "repeatedCarryForwardCount와 renewalWithoutFreshEvidenceCount가 침식 가장 빠른 예측 지표",
    recommendation: "이 두 지표에 대한 조기 경보 임계값을 1로 설정하여 최초 발생 시 즉시 알림",
    recordedAt: now,
    sourceSimulationId: results.simulationId,
  };
  memoryStore.set(bestPredictiveEntry.entryId, bestPredictiveEntry);
  entries.push(bestPredictiveEntry);

  // 4. 실질 복원 강화 조치
  if (results.hardeningItems.length > 0) {
    const entry: ConstitutionalMemoryEntry = {
      entryId: makeId(),
      category: "EFFECTIVE_HARDENING",
      title: `강화 조치 ${results.hardeningItems.length}건 생성`,
      description: `시뮬레이션에서 ${results.hardeningItems.length}건의 강화 백로그가 생성됨`,
      relatedDriftVectors: Array.from(
        new Set(results.hardeningItems.map((h) => h.relatedDriftVector))
      ),
      observedDriftLevel: results.scorecard.verdict === "REFOUNDATION_WATCH_ESCALATE"
        ? "REFOUNDATION_PRESSURE_INCREASING"
        : "DRIFT_ACTIVE",
      lesson: "강화 백로그의 즉시 처리가 드리프트 진행을 차단하는 가장 효과적인 수단",
      recommendation: "IMMEDIATE_FIX 등급 항목은 72시간 내 처리, PROCESS_REDESIGN은 45일 내 완료",
      recordedAt: now,
      sourceSimulationId: results.simulationId,
    };
    memoryStore.set(entry.entryId, entry);
    entries.push(entry);
  }

  // 5. 안전하지 않은 carry-forward 패턴
  const staleRenewal = results.erosionResults.find((r) => r.scenarioId === "EROSION-A");
  if (staleRenewal && staleRenewal.detected) {
    const entry: ConstitutionalMemoryEntry = {
      entryId: makeId(),
      category: "UNSAFE_CARRY_FORWARD_PATTERN",
      title: "Stale Carry-Forward 패턴 탐지",
      description: `carry-forward ${staleRenewal.driftSignals.repeatedCarryForwardCount}회, 증거 미갱신 ${staleRenewal.driftSignals.renewalWithoutFreshEvidenceCount}회`,
      relatedDriftVectors: ["STALE_RENEWAL_ACCEPTANCE" as DriftVector],
      observedDriftLevel: staleRenewal.driftLevel,
      lesson: "carry-forward 2회 이상은 안전하지 않음 — 각 갱신 시 반드시 독립 증거 필요",
      recommendation: "carry-forward 제한을 1회로 강화하고, 2회 이상 시 자동 강등 트리거",
      recordedAt: now,
      sourceSimulationId: results.simulationId,
    };
    memoryStore.set(entry.entryId, entry);
    entries.push(entry);
  }

  // 6. 재건 압력 증가 백로그 패턴
  if (results.decision === "ESCALATE_TO_REFOUNDATION_WATCH" || results.decision === "HOLD_FOR_RENEWAL_REALIGNMENT") {
    const entry: ConstitutionalMemoryEntry = {
      entryId: makeId(),
      category: "REFOUNDATION_PRESSURE_PATTERN",
      title: `재건 압력 패턴: ${results.decision}`,
      description: `스코어카드 가중 평균 ${results.scorecard.weightedAverage.toFixed(1)}, 판정 ${results.scorecard.verdict}`,
      relatedDriftVectors: [],
      observedDriftLevel: "REFOUNDATION_PRESSURE_INCREASING",
      lesson: "다수 루프에서 동시에 DRIFT_ACTIVE 이상이 발생하면 재건 압력이 비선형적으로 증가",
      recommendation: "3개 이상 루프에서 동시 DRIFT_ACTIVE 탐지 시 즉시 refoundation watch 에스컬레이션",
      recordedAt: now,
      sourceSimulationId: results.simulationId,
    };
    memoryStore.set(entry.entryId, entry);
    entries.push(entry);
  }

  return entries;
}

/**
 * 기록된 메모리를 조회한다.
 */
export function getScenario9Memory(): ConstitutionalMemoryEntry[] {
  return Array.from(memoryStore.values());
}

/**
 * 카테고리별 메모리를 조회한다.
 */
export function getScenario9MemoryByCategory(
  category: Scenario9MemoryCategory
): ConstitutionalMemoryEntry[] {
  return Array.from(memoryStore.values()).filter((e) => e.category === category);
}

// ─────────────────────────────────────────────
// 내부 유틸리티
// ─────────────────────────────────────────────

function driftLevelSeverity(level: DriftLevel): number {
  switch (level) {
    case "DRIFT_LOW": return 0;
    case "DRIFT_FORMING": return 1;
    case "DRIFT_ACTIVE": return 2;
    case "CONSTITUTIONAL_EROSION_RISK": return 3;
    case "REFOUNDATION_PRESSURE_INCREASING": return 4;
  }
}

function extractDriftVectors(result: ErosionScenarioResult): DriftVector[] {
  const mapping: Record<string, DriftVector[]> = {
    "EROSION-A": ["STALE_RENEWAL_ACCEPTANCE" as DriftVector],
    "EROSION-B": ["TEMPORARY_EXCEPTION_NORMALIZATION" as DriftVector],
    "EROSION-C": ["AMENDMENT_SCOPE_CREEP" as DriftVector],
    "EROSION-D": ["DASHBOARD_NORMALIZATION_OF_RISK" as DriftVector],
    "EROSION-E": ["OBLIGATION_CONTINUITY_DECAY" as DriftVector],
    "EROSION-F": ["SUNSET_DELAY_ACCUMULATION" as DriftVector],
    "EROSION-G": ["PURPOSE_REINTERPRETATION_DRIFT" as DriftVector],
    "EROSION-H": ["HUMAN_REVIEW_FORMALITY_DRIFT" as DriftVector],
  };
  return mapping[result.scenarioId] ?? [];
}

function analyzeBestPredictiveSignals(erosionResults: ErosionScenarioResult[]): string {
  const detectedResults = erosionResults.filter((r) => r.detected);
  if (detectedResults.length === 0) return "탐지된 침식 시나리오 없음";

  const signalFrequency: Record<string, number> = {};
  for (const result of detectedResults) {
    const signals = result.driftSignals;
    if (signals.repeatedCarryForwardCount > 0) {
      signalFrequency["repeatedCarryForwardCount"] = (signalFrequency["repeatedCarryForwardCount"] ?? 0) + 1;
    }
    if (signals.renewalWithoutFreshEvidenceCount > 0) {
      signalFrequency["renewalWithoutFreshEvidenceCount"] = (signalFrequency["renewalWithoutFreshEvidenceCount"] ?? 0) + 1;
    }
    if (signals.exceptionExtensionCount > 0) {
      signalFrequency["exceptionExtensionCount"] = (signalFrequency["exceptionExtensionCount"] ?? 0) + 1;
    }
    if (signals.amendmentCumulativeSemanticDelta > 0) {
      signalFrequency["amendmentCumulativeSemanticDelta"] = (signalFrequency["amendmentCumulativeSemanticDelta"] ?? 0) + 1;
    }
    if (signals.purposeLanguageDivergenceScore > 0) {
      signalFrequency["purposeLanguageDivergenceScore"] = (signalFrequency["purposeLanguageDivergenceScore"] ?? 0) + 1;
    }
  }

  const sorted = Object.entries(signalFrequency)
    .sort(([, a], [, b]) => b - a);

  return `최적 예측 신호: ${sorted.map(([k, v]) => `${k}(${v}건)`).join(", ")}`;
}
