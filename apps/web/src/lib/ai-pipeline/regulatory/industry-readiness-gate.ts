/**
 * @module industry-readiness-gate
 * @description 산업 준비도 게이트 — 10개 점검 항목을 기준으로 규제 대응 준비 상태를 평가하고 차단 요인을 식별하는 엔진
 */

/** 준비도 영역 */
export type ReadinessArea = 'CONTROLS' | 'EVIDENCE' | 'TESTING' | 'EXCEPTIONS' | 'REVIEWS' | 'DRIFT' | 'TRAINING';

/** 개별 점검 결과 */
export interface ReadinessCheck {
  /** 점검 ID */
  id: string;
  /** 점검 영역 */
  area: ReadinessArea;
  /** 점검 설명 */
  description: string;
  /** 통과 여부 */
  passed: boolean;
  /** 현재 값 */
  currentValue: number;
  /** 요구 값 */
  requiredValue: number;
  /** 상세 메시지 */
  message: string;
}

/** 차단 요인 */
export interface ReadinessBlocker {
  /** 차단 영역 */
  area: ReadinessArea;
  /** 차단 설명 */
  description: string;
  /** 심각도 */
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

/** 산업 준비도 평가 결과 */
export interface IndustryReadinessResult {
  /** 준비 완료 여부 */
  ready: boolean;
  /** 종합 점수 (0-100) */
  score: number;
  /** 개별 점검 결과 목록 */
  checks: ReadinessCheck[];
  /** 차단 요인 목록 */
  blockers: ReadinessBlocker[];
}

/** 준비도 타임라인 항목 */
export interface ReadinessTimelineEntry {
  /** 평가 일시 */
  evaluatedAt: Date;
  /** 종합 점수 */
  score: number;
  /** 준비 완료 여부 */
  ready: boolean;
  /** 통과 점검 수 */
  passedChecks: number;
  /** 총 점검 수 */
  totalChecks: number;
}

/** 준비도 입력 데이터 (외부에서 주입) */
export interface ReadinessInput {
  /** 통제 커버리지 (%) */
  controlCoverage: number;
  /** 크리티컬 예외 수 */
  criticalExceptions: number;
  /** 테스트 최신 여부 (현재 테스트 완료 비율 %) */
  testCurrentPercent: number;
  /** 증거 최신 여부 (최신 증거 비율 %) */
  evidenceFreshPercent: number;
  /** 독립 검토 완료 여부 */
  independentReviewComplete: boolean;
  /** 미해결 드리프트 수 */
  unresolvedDrifts: number;
  /** 교육 완료 여부 */
  trainingComplete: boolean;
  /** 사고 대응 테스트 완료 여부 */
  incidentResponseTested: boolean;
  /** BCP 테스트 완료 여부 */
  bcpTested: boolean;
  /** 컴플라이언스 매핑 완료 여부 */
  complianceMappingComplete: boolean;
}

/** 인메모리 타임라인 저장소 */
const timelineStore: ReadinessTimelineEntry[] = [];

/**
 * 산업 준비도를 평가한다 — 10개 점검 항목을 기준으로 종합 평가를 수행한다.
 * @param input 준비도 입력 데이터
 * @returns 산업 준비도 평가 결과
 */
export function evaluateReadiness(input: ReadinessInput): IndustryReadinessResult {
  const checks: ReadinessCheck[] = [
    {
      id: 'RG-01',
      area: 'CONTROLS',
      description: '통제 커버리지 >= 90%',
      passed: input.controlCoverage >= 90,
      currentValue: input.controlCoverage,
      requiredValue: 90,
      message: input.controlCoverage >= 90
        ? '통제 커버리지 충족'
        : `통제 커버리지 미달 (${input.controlCoverage}% < 90%)`,
    },
    {
      id: 'RG-02',
      area: 'EXCEPTIONS',
      description: '크리티컬 예외 없음',
      passed: input.criticalExceptions === 0,
      currentValue: input.criticalExceptions,
      requiredValue: 0,
      message: input.criticalExceptions === 0
        ? '크리티컬 예외 없음'
        : `크리티컬 예외 ${input.criticalExceptions}건 존재`,
    },
    {
      id: 'RG-03',
      area: 'TESTING',
      description: '모든 테스트 최신 상태',
      passed: input.testCurrentPercent >= 100,
      currentValue: input.testCurrentPercent,
      requiredValue: 100,
      message: input.testCurrentPercent >= 100
        ? '모든 테스트 최신 상태'
        : `테스트 완료율 ${input.testCurrentPercent}%`,
    },
    {
      id: 'RG-04',
      area: 'EVIDENCE',
      description: '증거 최신 상태',
      passed: input.evidenceFreshPercent >= 100,
      currentValue: input.evidenceFreshPercent,
      requiredValue: 100,
      message: input.evidenceFreshPercent >= 100
        ? '모든 증거 최신 상태'
        : `증거 최신율 ${input.evidenceFreshPercent}%`,
    },
    {
      id: 'RG-05',
      area: 'REVIEWS',
      description: '독립 검토 완료',
      passed: input.independentReviewComplete,
      currentValue: input.independentReviewComplete ? 1 : 0,
      requiredValue: 1,
      message: input.independentReviewComplete
        ? '독립 검토 완료'
        : '독립 검토 미완료',
    },
    {
      id: 'RG-06',
      area: 'DRIFT',
      description: '드리프트 해결 완료',
      passed: input.unresolvedDrifts === 0,
      currentValue: input.unresolvedDrifts,
      requiredValue: 0,
      message: input.unresolvedDrifts === 0
        ? '모든 드리프트 해결 완료'
        : `미해결 드리프트 ${input.unresolvedDrifts}건`,
    },
    {
      id: 'RG-07',
      area: 'TRAINING',
      description: '교육 완료',
      passed: input.trainingComplete,
      currentValue: input.trainingComplete ? 1 : 0,
      requiredValue: 1,
      message: input.trainingComplete
        ? '교육 완료'
        : '교육 미완료',
    },
    {
      id: 'RG-08',
      area: 'CONTROLS',
      description: '사고 대응 테스트 완료',
      passed: input.incidentResponseTested,
      currentValue: input.incidentResponseTested ? 1 : 0,
      requiredValue: 1,
      message: input.incidentResponseTested
        ? '사고 대응 테스트 완료'
        : '사고 대응 테스트 미완료',
    },
    {
      id: 'RG-09',
      area: 'CONTROLS',
      description: 'BCP 테스트 완료',
      passed: input.bcpTested,
      currentValue: input.bcpTested ? 1 : 0,
      requiredValue: 1,
      message: input.bcpTested
        ? 'BCP 테스트 완료'
        : 'BCP 테스트 미완료',
    },
    {
      id: 'RG-10',
      area: 'CONTROLS',
      description: '컴플라이언스 매핑 완료',
      passed: input.complianceMappingComplete,
      currentValue: input.complianceMappingComplete ? 1 : 0,
      requiredValue: 1,
      message: input.complianceMappingComplete
        ? '컴플라이언스 매핑 완료'
        : '컴플라이언스 매핑 미완료',
    },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);

  const blockers: ReadinessBlocker[] = checks
    .filter((c) => !c.passed)
    .map((c) => ({
      area: c.area,
      description: c.message,
      severity: c.id === 'RG-01' || c.id === 'RG-02' ? 'CRITICAL' as const : 'HIGH' as const,
    }));

  const result: IndustryReadinessResult = {
    ready: passedCount === checks.length,
    score,
    checks,
    blockers,
  };

  // 타임라인에 기록
  timelineStore.push({
    evaluatedAt: new Date(),
    score,
    ready: result.ready,
    passedChecks: passedCount,
    totalChecks: checks.length,
  });

  return result;
}

/**
 * 준비도 평가 타임라인을 반환한다.
 * @returns 타임라인 항목 배열 (시간순)
 */
export function getReadinessTimeline(): ReadinessTimelineEntry[] {
  return [...timelineStore].sort((a, b) => a.evaluatedAt.getTime() - b.evaluatedAt.getTime());
}
