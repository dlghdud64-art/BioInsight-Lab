/**
 * @module commons-neutrality-guard
 * @description 중립성 방어기
 *
 * 보증 생태계의 중립성을 감시하고 포획(capture) 위험을 탐지한다.
 * 발행 집중, 분쟁 편향, 접근 비대칭, 거버넌스 독점을 감지하며,
 * CAPTURE_DETECTED 상태 시 거버넌스 위원회에 자동 에스컬레이션한다.
 */

/** 포획 위험 유형 */
export type CaptureRisk =
  | "ISSUANCE_CONCENTRATION"
  | "DISPUTE_BIAS"
  | "ACCESS_ASYMMETRY"
  | "GOVERNANCE_DOMINATION";

/** 중립성 상태 */
export type NeutralityStatus =
  | "HEALTHY"
  | "NEUTRALITY_STRAINED"
  | "CAPTURE_DETECTED";

/** 심각도 */
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/** 중립성 경고 */
export interface NeutralityAlert {
  /** 경고 고유 식별자 */
  id: string;
  /** 포획 위험 유형 */
  risk: CaptureRisk;
  /** 심각도 */
  severity: Severity;
  /** 증거 설명 */
  evidence: string;
  /** 탐지 시각 */
  detectedAt: number;
  /** 거버넌스 에스컬레이션 여부 */
  escalatedToGovernance: boolean;
}

/** 집중도 메트릭 */
export interface ConcentrationMetrics {
  /** 허핀달-허쉬만 지수 (0~1, 높을수록 집중) */
  herfindahlIndex: number;
  /** 상위 참여자 점유율 */
  topParticipantShare: number;
  /** 총 참여자 수 */
  totalParticipants: number;
  /** 위험 수준 */
  risk: CaptureRisk | null;
}

/** 중립성 평가 보고서 */
export interface NeutralityReport {
  /** 전체 중립성 상태 */
  status: NeutralityStatus;
  /** 활성 경고 목록 */
  alerts: NeutralityAlert[];
  /** 집중도 메트릭 */
  concentrationMetrics: ConcentrationMetrics;
  /** 평가 시각 */
  assessedAt: number;
}

// --- 인메모리 저장소 ---
const alertStore: NeutralityAlert[] = [];

/** 집중도 위험 문턱 */
const CONCENTRATION_THRESHOLD = 0.25; // HHI 0.25 이상 시 집중 감지
const DOMINATION_THRESHOLD = 0.4; // 상위 참여자 40% 이상 점유 시

/**
 * 허핀달-허쉬만 지수를 계산한다.
 * @param shares - 각 참여자의 점유율 배열 (합계 = 1)
 * @returns HHI 값 (0~1)
 */
function calculateHHI(shares: number[]): number {
  return shares.reduce((sum, s) => sum + s * s, 0);
}

/**
 * 생태계의 중립성을 종합 평가한다.
 * @param issuanceCounts - 참여자별 발행 건수 맵
 * @param disputeOutcomes - 참여자별 분쟁 결과 (유리/불리 건수)
 * @param governanceVotes - 참여자별 거버넌스 투표 건수 맵
 * @returns 중립성 평가 보고서
 */
export function assessNeutrality(
  issuanceCounts: Record<string, number>,
  disputeOutcomes: Record<string, { favorable: number; unfavorable: number }>,
  governanceVotes: Record<string, number>
): NeutralityReport {
  const alerts: NeutralityAlert[] = [];

  // 1. 발행 집중도
  const concentrationMetrics = detectConcentration(issuanceCounts);
  if (concentrationMetrics.risk) {
    const alert = createAlert(
      concentrationMetrics.risk,
      concentrationMetrics.herfindahlIndex > CONCENTRATION_THRESHOLD ? "HIGH" : "MEDIUM",
      `발행 집중도 HHI: ${concentrationMetrics.herfindahlIndex.toFixed(4)}, 상위 점유율: ${(concentrationMetrics.topParticipantShare * 100).toFixed(1)}%`
    );
    alerts.push(alert);
  }

  // 2. 분쟁 편향
  const biasAlert = detectBias(disputeOutcomes);
  if (biasAlert) alerts.push(biasAlert);

  // 3. 거버넌스 독점
  const govConcentration = detectConcentration(governanceVotes);
  if (govConcentration.herfindahlIndex > CONCENTRATION_THRESHOLD) {
    const alert = createAlert(
      "GOVERNANCE_DOMINATION",
      govConcentration.herfindahlIndex > 0.5 ? "CRITICAL" : "HIGH",
      `거버넌스 투표 집중도 HHI: ${govConcentration.herfindahlIndex.toFixed(4)}`
    );
    alerts.push(alert);
  }

  // 전체 상태 판정
  const hasCritical = alerts.some((a) => a.severity === "CRITICAL");
  const hasHigh = alerts.some((a) => a.severity === "HIGH");
  let status: NeutralityStatus = "HEALTHY";
  if (hasCritical) {
    status = "CAPTURE_DETECTED";
  } else if (hasHigh) {
    status = "NEUTRALITY_STRAINED";
  }

  // CAPTURE_DETECTED 시 자동 에스컬레이션
  if (status === "CAPTURE_DETECTED") {
    for (const alert of alerts) {
      if (!alert.escalatedToGovernance) {
        alert.escalatedToGovernance = true;
      }
    }
  }

  alertStore.push(...alerts);

  return {
    status,
    alerts,
    concentrationMetrics,
    assessedAt: Date.now(),
  };
}

/**
 * 참여자별 수치에서 집중도를 탐지한다.
 * @param counts - 참여자별 수치 맵
 * @returns 집중도 메트릭
 */
export function detectConcentration(
  counts: Record<string, number>
): ConcentrationMetrics {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return { herfindahlIndex: 0, topParticipantShare: 0, totalParticipants: 0, risk: null };
  }

  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) {
    return { herfindahlIndex: 0, topParticipantShare: 0, totalParticipants: entries.length, risk: null };
  }

  const shares = entries.map(([, v]) => v / total);
  const hhi = calculateHHI(shares);
  const topShare = Math.max(...shares);

  let risk: CaptureRisk | null = null;
  if (hhi > CONCENTRATION_THRESHOLD || topShare > DOMINATION_THRESHOLD) {
    risk = "ISSUANCE_CONCENTRATION";
  }

  return {
    herfindahlIndex: hhi,
    topParticipantShare: topShare,
    totalParticipants: entries.length,
    risk,
  };
}

/**
 * 분쟁 결과에서 편향을 탐지한다.
 * @param outcomes - 참여자별 분쟁 결과
 * @returns 편향 경고 또는 null
 */
export function detectBias(
  outcomes: Record<string, { favorable: number; unfavorable: number }>
): NeutralityAlert | null {
  const entries = Object.entries(outcomes);
  if (entries.length < 2) return null;

  for (const [participantId, outcome] of entries) {
    const total = outcome.favorable + outcome.unfavorable;
    if (total < 3) continue;
    const favorableRate = outcome.favorable / total;
    if (favorableRate > 0.9 || favorableRate < 0.1) {
      return createAlert(
        "DISPUTE_BIAS",
        favorableRate > 0.9 ? "HIGH" : "MEDIUM",
        `참여자 ${participantId}의 분쟁 유리 비율: ${(favorableRate * 100).toFixed(1)}% (총 ${total}건)`
      );
    }
  }

  return null;
}

/**
 * 집중도 메트릭을 반환한다.
 * @param counts - 참여자별 수치 맵
 * @returns 집중도 메트릭
 */
export function getConcentrationMetrics(
  counts: Record<string, number>
): ConcentrationMetrics {
  return detectConcentration(counts);
}

/**
 * 경고를 거버넌스 위원회에 에스컬레이션한다.
 * @param alertId - 경고 ID
 * @returns 에스컬레이션된 경고 또는 null
 */
export function escalateToGovernance(alertId: string): NeutralityAlert | null {
  const alert = alertStore.find((a) => a.id === alertId);
  if (!alert) return null;
  alert.escalatedToGovernance = true;
  return alert;
}

/**
 * 경고를 생성한다 (내부 헬퍼).
 */
function createAlert(
  risk: CaptureRisk,
  severity: Severity,
  evidence: string
): NeutralityAlert {
  return {
    id: `na-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    risk,
    severity,
    evidence,
    detectedAt: Date.now(),
    escalatedToGovernance: false,
  };
}
