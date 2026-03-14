/**
 * 포획 방지 가드
 *
 * 지배적 행위자가 거버넌스를 포획하는 패턴을 탐지하고,
 * 포획 위험이 감지되면 즉시 경보를 발동한다.
 * 투표 독점·의무 축소·접근 비대칭·거버넌스 적재·부담 외부화 패턴을 감시한다.
 */

/** 포획 패턴 유형 */
export type CapturePattern =
  | 'VOTING_MONOPOLY'
  | 'OBLIGATION_QUIET_REDUCTION'
  | 'ACCESS_ASYMMETRY'
  | 'GOVERNANCE_STACKING'
  | 'BURDEN_EXTERNALIZATION';

/** 포획 경보 상태 */
export type CaptureAlertStatus = 'OPEN' | 'INVESTIGATING' | 'CONFIRMED' | 'RESOLVED' | 'FALSE_POSITIVE';

/** 포획 경보 심각도 */
export type CaptureSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** 포획 경보 */
export interface CaptureAlert {
  /** 경보 ID */
  id: string;
  /** 포획 패턴 유형 */
  pattern: CapturePattern;
  /** 심각도 */
  severity: CaptureSeverity;
  /** 가해자 ID */
  perpetratorId: string;
  /** 증거 */
  evidence: string[];
  /** 감지 시점 */
  detectedAt: string;
  /** 경보 상태 */
  status: CaptureAlertStatus;
}

/** 포획 위험 상태 */
export type CaptureRiskStatus =
  | 'HEALTHY'
  | 'CAPTURE_RISK_ACTIVE'
  | 'CAPTURE_CONFIRMED';

/** 포획 탐지 입력 */
export interface CaptureDetectionInput {
  /** 참여자 ID */
  participantId: string;
  /** 투표 점유율 (0~1) */
  votingShare: number;
  /** 의무 감소 이력 횟수 */
  obligationReductionCount: number;
  /** 접근 비대칭 점수 (0~1) */
  accessAsymmetryScore: number;
  /** 거버넌스 위원회 점유율 (0~1) */
  governanceCommitteeShare: number;
  /** 부담 외부화 점수 (0~1) */
  burdenExternalizationScore: number;
}

/** 포획 위험 평가 결과 */
export interface CaptureRiskAssessment {
  status: CaptureRiskStatus;
  detectedPatterns: CapturePattern[];
  alerts: CaptureAlert[];
  assessedAt: string;
}

// ─── 인메모리 저장소 ───

const captureAlerts: CaptureAlert[] = [];
let nextAlertId = 1;

/**
 * 포획 패턴을 탐지한다.
 * 임계값 초과 시 자동으로 CAPTURE_RISK_ACTIVE 경보를 발동한다.
 * @param input 포획 탐지 입력
 * @returns 감지된 포획 패턴 목록
 */
export function detectCapturePatterns(
  input: CaptureDetectionInput
): CapturePattern[] {
  const detected: CapturePattern[] = [];

  if (input.votingShare > 0.33) {
    detected.push('VOTING_MONOPOLY');
  }
  if (input.obligationReductionCount >= 3) {
    detected.push('OBLIGATION_QUIET_REDUCTION');
  }
  if (input.accessAsymmetryScore > 0.6) {
    detected.push('ACCESS_ASYMMETRY');
  }
  if (input.governanceCommitteeShare > 0.4) {
    detected.push('GOVERNANCE_STACKING');
  }
  if (input.burdenExternalizationScore > 0.5) {
    detected.push('BURDEN_EXTERNALIZATION');
  }

  // 패턴 감지 시 자동 경보 발동
  for (let i = 0; i < detected.length; i++) {
    const pattern = detected[i];
    const severity = determineSeverity(pattern, input);
    const alert: CaptureAlert = {
      id: `CAP-${String(nextAlertId++).padStart(6, '0')}`,
      pattern,
      severity,
      perpetratorId: input.participantId,
      evidence: buildEvidence(pattern, input),
      detectedAt: new Date().toISOString(),
      status: 'OPEN',
    };
    captureAlerts.push(alert);
  }

  return detected;
}

/**
 * 전체 포획 위험을 평가한다.
 * @param participantId 참여자 ID
 * @returns 포획 위험 평가 결과
 */
export function assessCaptureRisk(
  participantId: string
): CaptureRiskAssessment {
  const participantAlerts = captureAlerts.filter(
    (a) => a.perpetratorId === participantId && a.status !== 'RESOLVED' && a.status !== 'FALSE_POSITIVE'
  );

  const detectedPatterns = Array.from(
    new Set(participantAlerts.map((a) => a.pattern))
  );

  let status: CaptureRiskStatus = 'HEALTHY';
  if (participantAlerts.some((a) => a.status === 'CONFIRMED')) {
    status = 'CAPTURE_CONFIRMED';
  } else if (participantAlerts.length > 0) {
    status = 'CAPTURE_RISK_ACTIVE';
  }

  return {
    status,
    detectedPatterns,
    alerts: participantAlerts.map((a) => ({ ...a })),
    assessedAt: new Date().toISOString(),
  };
}

/**
 * 포획 경보를 에스컬레이션한다.
 * @param alertId 경보 ID
 * @param newStatus 새 상태
 * @returns 업데이트된 경보, 없으면 null
 */
export function escalateCapture(
  alertId: string,
  newStatus: CaptureAlertStatus
): CaptureAlert | null {
  const alert = captureAlerts.find((a) => a.id === alertId);
  if (!alert) return null;

  alert.status = newStatus;
  return { ...alert };
}

/**
 * 포획 경보 이력을 반환한다.
 * @param participantId 선택적 가해자 ID 필터
 * @returns 포획 경보 이력
 */
export function getCaptureHistory(
  participantId?: string
): ReadonlyArray<CaptureAlert> {
  if (participantId) {
    return captureAlerts
      .filter((a) => a.perpetratorId === participantId)
      .map((a) => ({ ...a }));
  }
  return captureAlerts.map((a) => ({ ...a }));
}

// ─── 내부 헬퍼 ───

function determineSeverity(
  pattern: CapturePattern,
  input: CaptureDetectionInput
): CaptureSeverity {
  switch (pattern) {
    case 'VOTING_MONOPOLY':
      return input.votingShare > 0.5 ? 'CRITICAL' : 'HIGH';
    case 'GOVERNANCE_STACKING':
      return input.governanceCommitteeShare > 0.6 ? 'CRITICAL' : 'HIGH';
    case 'BURDEN_EXTERNALIZATION':
      return input.burdenExternalizationScore > 0.8 ? 'HIGH' : 'MEDIUM';
    case 'OBLIGATION_QUIET_REDUCTION':
      return input.obligationReductionCount >= 5 ? 'HIGH' : 'MEDIUM';
    case 'ACCESS_ASYMMETRY':
      return input.accessAsymmetryScore > 0.8 ? 'HIGH' : 'LOW';
    default:
      return 'LOW';
  }
}

function buildEvidence(
  pattern: CapturePattern,
  input: CaptureDetectionInput
): string[] {
  const evidence: string[] = [];
  switch (pattern) {
    case 'VOTING_MONOPOLY':
      evidence.push(`투표 점유율: ${(input.votingShare * 100).toFixed(1)}%`);
      break;
    case 'OBLIGATION_QUIET_REDUCTION':
      evidence.push(`의무 감소 이력: ${input.obligationReductionCount}회`);
      break;
    case 'ACCESS_ASYMMETRY':
      evidence.push(`접근 비대칭 점수: ${input.accessAsymmetryScore}`);
      break;
    case 'GOVERNANCE_STACKING':
      evidence.push(`거버넌스 위원회 점유율: ${(input.governanceCommitteeShare * 100).toFixed(1)}%`);
      break;
    case 'BURDEN_EXTERNALIZATION':
      evidence.push(`부담 외부화 점수: ${input.burdenExternalizationScore}`);
      break;
  }
  return evidence;
}
