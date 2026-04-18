/**
 * @module mission-drift-monitor
 * @description 미션 드리프트 모니터 — 범위 확장, 가치 불일치, 우선순위 변경, 자원 전용, 지표 게이밍 등 미션 이탈 징후를 감지하고 교정합니다.
 */

/** 드리프트 지표 */
export type DriftIndicator =
  | 'SCOPE_CREEP'
  | 'VALUE_MISALIGNMENT'
  | 'PRIORITY_SHIFT'
  | 'RESOURCE_DIVERSION'
  | 'METRIC_GAMING';

/** 심각도 */
export type DriftSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** 드리프트 평가 */
export interface DriftAssessment {
  /** 고유 식별자 */
  id: string;
  /** 드리프트 지표 */
  indicator: DriftIndicator;
  /** 심각도 */
  severity: DriftSeverity;
  /** 근거 */
  evidence: string;
  /** 감지 일시 */
  detectedAt: Date;
  /** 인지 일시 */
  acknowledgedAt: Date | null;
  /** 교정 일시 */
  correctedAt: Date | null;
}

/** 미션 정렬 결과 */
export interface MissionAlignmentResult {
  /** 전체 정렬 점수 (0-100) */
  alignmentScore: number;
  /** 활성 드리프트 수 */
  activeDriftCount: number;
  /** 지표별 요약 */
  indicatorSummary: Record<DriftIndicator, { count: number; maxSeverity: DriftSeverity }>;
  /** 평가 일시 */
  assessedAt: Date;
}

/** 인메모리 평가 저장소 */
const assessmentStore: DriftAssessment[] = [];

const severityWeight: Record<DriftSeverity, number> = {
  LOW: 5,
  MEDIUM: 15,
  HIGH: 30,
  CRITICAL: 50,
};

const severityOrder: Record<DriftSeverity, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

/**
 * 미션 정렬 상태를 평가합니다.
 * @returns 미션 정렬 결과
 */
export function assessMissionAlignment(): MissionAlignmentResult {
  const active = assessmentStore.filter((a) => a.correctedAt === null);
  const indicators: DriftIndicator[] = [
    'SCOPE_CREEP',
    'VALUE_MISALIGNMENT',
    'PRIORITY_SHIFT',
    'RESOURCE_DIVERSION',
    'METRIC_GAMING',
  ];

  const indicatorSummary = {} as Record<
    DriftIndicator,
    { count: number; maxSeverity: DriftSeverity }
  >;

  let totalPenalty = 0;

  for (const ind of indicators) {
    const items = active.filter((a) => a.indicator === ind);
    let maxSeverity: DriftSeverity = 'LOW';
    for (const item of items) {
      if (severityOrder[item.severity] > severityOrder[maxSeverity]) {
        maxSeverity = item.severity;
      }
      totalPenalty += severityWeight[item.severity];
    }
    indicatorSummary[ind] = { count: items.length, maxSeverity };
  }

  const alignmentScore = Math.max(0, 100 - totalPenalty);

  return {
    alignmentScore,
    activeDriftCount: active.length,
    indicatorSummary,
    assessedAt: new Date(),
  };
}

/**
 * 드리프트를 감지하고 기록합니다.
 * @param indicator - 드리프트 지표
 * @param severity - 심각도
 * @param evidence - 근거
 * @returns 기록된 드리프트 평가
 */
export function detectDrift(
  indicator: DriftIndicator,
  severity: DriftSeverity,
  evidence: string
): DriftAssessment {
  const assessment: DriftAssessment = {
    id: `da-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    indicator,
    severity,
    evidence,
    detectedAt: new Date(),
    acknowledgedAt: null,
    correctedAt: null,
  };
  assessmentStore.push(assessment);
  return { ...assessment };
}

/**
 * 드리프트 보고서를 생성합니다.
 * @param includeResolved - 해결된 항목 포함 여부
 * @returns 드리프트 보고서
 */
export function generateDriftReport(includeResolved: boolean = false): {
  reportGeneratedAt: Date;
  totalAssessments: number;
  activeCount: number;
  resolvedCount: number;
  assessments: DriftAssessment[];
  alignment: MissionAlignmentResult;
} {
  const filtered = includeResolved
    ? assessmentStore
    : assessmentStore.filter((a) => a.correctedAt === null);

  return {
    reportGeneratedAt: new Date(),
    totalAssessments: assessmentStore.length,
    activeCount: assessmentStore.filter((a) => a.correctedAt === null).length,
    resolvedCount: assessmentStore.filter((a) => a.correctedAt !== null).length,
    assessments: filtered.map((a) => ({ ...a })),
    alignment: assessMissionAlignment(),
  };
}

/**
 * 드리프트에 대한 교정 조치를 제안합니다.
 * @param assessmentId - 평가 ID
 * @param correction - 교정 설명
 * @returns 교정 결과
 */
export function proposeCorrection(
  assessmentId: string,
  correction: string
): {
  success: boolean;
  assessment: DriftAssessment | null;
  correction: string;
} {
  const assessment = assessmentStore.find((a) => a.id === assessmentId);
  if (!assessment) {
    return {
      success: false,
      assessment: null,
      correction: '해당 평가를 찾을 수 없습니다.',
    };
  }

  if (!assessment.acknowledgedAt) {
    assessment.acknowledgedAt = new Date();
  }
  assessment.correctedAt = new Date();

  return {
    success: true,
    assessment: { ...assessment },
    correction,
  };
}
