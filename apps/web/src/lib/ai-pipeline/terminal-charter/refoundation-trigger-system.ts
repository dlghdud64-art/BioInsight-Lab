/**
 * @module refoundation-trigger-system
 * @description 재창설 트리거 시스템 — 시스템이 복구 불가능한 상태에 도달했을 때
 * 통제된 재초기화를 발동한다. 혼란스러운 붕괴가 아닌 통제된 셧다운을 보장한다.
 * 예외 부채 임계, 헌법적 위반 반복, 목적 이탈, 복잡성 임계, 신뢰 붕괴를 감시한다.
 */

/** 재창설 상태 */
export type RefoundationStatus = "STABLE" | "WARNING" | "REFOUNDATION_REQUIRED";

/** 재창설 지표 */
export type RefoundationIndicator =
  | "EXCEPTION_DEBT_CRITICAL"
  | "CONSTITUTIONAL_VIOLATIONS_REPEATED"
  | "PURPOSE_BREACH"
  | "COMPLEXITY_THRESHOLD"
  | "TRUST_COLLAPSE";

/** 재창설 지표 평가 */
export interface IndicatorAssessment {
  /** 지표 유형 */
  indicator: RefoundationIndicator;
  /** 활성 여부 */
  active: boolean;
  /** 현재 값 */
  currentValue: number;
  /** 임계값 */
  threshold: number;
  /** 설명 */
  description: string;
}

/** 안전 조치 단계 */
export interface SafeguardStep {
  /** 단계 순서 */
  order: number;
  /** 설명 */
  description: string;
  /** 완료 여부 */
  completed: boolean;
}

/** 아카이브 계획 */
export interface ArchivalPlan {
  /** 보존 대상 */
  preserveTargets: string[];
  /** 아카이브 형식 */
  format: string;
  /** 보존 기간 */
  retentionPeriod: string;
}

/** 재창설 계획 */
export interface RefoundationPlan {
  /** 발동 일시 */
  triggeredAt: Date;
  /** 활성 지표 목록 */
  indicators: RefoundationIndicator[];
  /** 안전 조치 단계 */
  safeguardSteps: SafeguardStep[];
  /** 아카이브 계획 */
  archivalPlan: ArchivalPlan;
}

/** 인메모리 지표 값 저장소 */
const indicatorValues: Map<RefoundationIndicator, number> = new Map([
  ["EXCEPTION_DEBT_CRITICAL", 0],
  ["CONSTITUTIONAL_VIOLATIONS_REPEATED", 0],
  ["PURPOSE_BREACH", 0],
  ["COMPLEXITY_THRESHOLD", 0],
  ["TRUST_COLLAPSE", 0],
]);

/** 지표별 임계값 */
const THRESHOLDS: Record<RefoundationIndicator, number> = {
  EXCEPTION_DEBT_CRITICAL: 100,
  CONSTITUTIONAL_VIOLATIONS_REPEATED: 5,
  PURPOSE_BREACH: 1,
  COMPLEXITY_THRESHOLD: 500,
  TRUST_COLLAPSE: 3,
};

/** 재창설 계획 저장소 */
let currentPlan: RefoundationPlan | null = null;

/** 재창설 이력 */
const refoundationHistory: RefoundationPlan[] = [];

/**
 * 재창설 필요성을 평가한다.
 * @param overrides - 지표 값 오버라이드 (테스트용)
 * @returns { status, assessments } — 재창설 상태와 지표 평가
 */
export function assessRefoundationNeed(
  overrides?: Partial<Record<RefoundationIndicator, number>>
): { status: RefoundationStatus; assessments: IndicatorAssessment[] } {
  const assessments: IndicatorAssessment[] = [];

  for (const [indicator, threshold] of Object.entries(THRESHOLDS)) {
    const ind = indicator as RefoundationIndicator;
    const value = overrides?.[ind] ?? indicatorValues.get(ind) ?? 0;
    assessments.push({
      indicator: ind,
      active: value >= threshold,
      currentValue: value,
      threshold,
      description: getIndicatorDescription(ind),
    });
  }

  const activeCount = assessments.filter((a) => a.active).length;

  let status: RefoundationStatus;
  if (activeCount >= 2) {
    status = "REFOUNDATION_REQUIRED";
  } else if (activeCount === 1) {
    status = "WARNING";
  } else {
    status = "STABLE";
  }

  return { status, assessments };
}

/**
 * 재창설을 발동한다. 통제된 재초기화 절차를 시작한다.
 * @param indicators - 발동 원인 지표
 * @returns 재창설 계획
 */
export function triggerRefoundation(
  indicators: RefoundationIndicator[]
): RefoundationPlan {
  const plan: RefoundationPlan = {
    triggeredAt: new Date(),
    indicators: [...indicators],
    safeguardSteps: [
      { order: 1, description: "모든 진행 중인 트랜잭션 안전 종료", completed: false },
      { order: 2, description: "감사 로그 최종 스냅샷 생성", completed: false },
      { order: 3, description: "불변 코어 원칙 아카이브", completed: false },
      { order: 4, description: "영구 의무 이전 준비", completed: false },
      { order: 5, description: "신뢰 자산 상태 동결", completed: false },
      { order: 6, description: "재창설 공지 발행", completed: false },
      { order: 7, description: "통제된 시스템 셧다운 실행", completed: false },
    ],
    archivalPlan: {
      preserveTargets: [
        "감사 로그 전체",
        "불변 코어 레지스트리",
        "헌법적 기억 인덱스",
        "의무 원장",
        "위반 로그",
      ],
      format: "JSON + 암호화 백업",
      retentionPeriod: "영구 보존",
    },
  };

  currentPlan = plan;
  refoundationHistory.push(plan);
  return { ...plan };
}

/**
 * 현재 재창설 계획을 반환한다.
 * @returns 재창설 계획 또는 null
 */
export function getRefoundationPlan(): RefoundationPlan | null {
  return currentPlan ? { ...currentPlan } : null;
}

/**
 * 통제된 셧다운을 실행한다. 각 안전 조치 단계를 순서대로 완료 처리한다.
 * @returns 완료된 단계 수
 */
export function executeControlledShutdown(): number {
  if (!currentPlan) return 0;

  let completed = 0;
  for (const step of currentPlan.safeguardSteps) {
    if (!step.completed) {
      step.completed = true;
      completed++;
    }
  }
  return completed;
}

/**
 * 지표 값을 업데이트한다.
 * @param indicator - 지표 유형
 * @param value - 새 값
 */
export function updateIndicatorValue(
  indicator: RefoundationIndicator,
  value: number
): void {
  indicatorValues.set(indicator, value);
}

/**
 * 재창설 이력을 반환한다.
 * @returns 재창설 이력 배열
 */
export function getRefoundationHistory(): RefoundationPlan[] {
  return [...refoundationHistory];
}

/** 지표별 설명 */
function getIndicatorDescription(indicator: RefoundationIndicator): string {
  const descriptions: Record<RefoundationIndicator, string> = {
    EXCEPTION_DEBT_CRITICAL: "예외 부채가 임계치를 초과함",
    CONSTITUTIONAL_VIOLATIONS_REPEATED: "헌법적 위반이 반복적으로 발생함",
    PURPOSE_BREACH: "시스템 목적 이탈이 감지됨",
    COMPLEXITY_THRESHOLD: "시스템 복잡도가 관리 가능 임계치를 초과함",
    TRUST_COLLAPSE: "신뢰 지표가 붕괴 수준으로 하락함",
  };
  return descriptions[indicator];
}
