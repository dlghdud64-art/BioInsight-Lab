/**
 * @module continuity-of-purpose-lock
 * @description 목적 연속성 잠금 — 시스템이 공익 목적에서 이탈하는지 감시한다.
 * 목적 이탈 감지 시 모든 기능 확장을 동결하며,
 * 공익 의무 축소 시도는 헌법적 위반(CONSTITUTIONAL_BREACH)으로 처리된다.
 */

/** 목적 상태 */
export type PurposeStatus =
  | "ALIGNED"
  | "PURPOSE_DRIFT_ACTIVE"
  | "CONSTITUTIONAL_BREACH";

/** 목적 점검 항목 */
export interface PurposeCheck {
  /** 점검 차원 */
  dimension: string;
  /** 점수 (0~100) */
  score: number;
  /** 임계값 */
  threshold: number;
  /** 정렬 여부 */
  aligned: boolean;
}

/** 이탈 지표 */
export interface DriftIndicator {
  /** 지표 ID */
  id: string;
  /** 설명 */
  description: string;
  /** 감지 일시 */
  detectedAt: Date;
  /** 심각도 */
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/** 목적 평가 결과 */
export interface PurposeAssessment {
  /** 현재 목적 상태 */
  status: PurposeStatus;
  /** 점검 항목 결과 */
  checks: PurposeCheck[];
  /** 이탈 지표 목록 */
  driftIndicators: DriftIndicator[];
  /** 확장 동결 필요 여부 */
  freezeRequired: boolean;
}

/** 목적 이력 항목 */
export interface PurposeHistoryEntry {
  /** 평가 일시 */
  assessedAt: Date;
  /** 상태 */
  status: PurposeStatus;
  /** 이탈 지표 수 */
  driftCount: number;
}

/** 기본 점검 차원 정의 */
const DEFAULT_DIMENSIONS: Array<{ dimension: string; threshold: number }> = [
  { dimension: "공익 기여도", threshold: 70 },
  { dimension: "투명성 수준", threshold: 75 },
  { dimension: "데이터 보호 준수", threshold: 80 },
  { dimension: "접근성 보장", threshold: 65 },
  { dimension: "의무 이행률", threshold: 70 },
];

/** 인메모리 이탈 지표 저장소 */
const driftIndicators: DriftIndicator[] = [];

/** 목적 평가 이력 */
const purposeHistory: PurposeHistoryEntry[] = [];

/** 확장 동결 상태 */
let expansionFrozen = false;

/**
 * 목적 정렬 상태를 평가한다.
 * @param scores - 각 차원별 점수 맵 (차원명 → 점수). 미제공 시 기본값 사용.
 * @returns 목적 평가 결과
 */
export function assessPurposeAlignment(
  scores?: Record<string, number>
): PurposeAssessment {
  const checks: PurposeCheck[] = DEFAULT_DIMENSIONS.map((dim) => {
    const score = scores?.[dim.dimension] ?? 100;
    return {
      dimension: dim.dimension,
      score,
      threshold: dim.threshold,
      aligned: score >= dim.threshold,
    };
  });

  const unaligned = checks.filter((c) => !c.aligned);
  const activeDrifts = driftIndicators.filter(
    (d) => d.severity === "CRITICAL"
  );

  let status: PurposeStatus;
  let freezeRequired = false;

  if (activeDrifts.length > 0) {
    // CRITICAL 이탈 지표 존재 → 헌법적 위반
    status = "CONSTITUTIONAL_BREACH";
    freezeRequired = true;
  } else if (unaligned.length > 0) {
    status = "PURPOSE_DRIFT_ACTIVE";
    freezeRequired = true;
  } else {
    status = "ALIGNED";
    freezeRequired = false;
  }

  if (freezeRequired) {
    expansionFrozen = true;
  }

  // 이력 기록
  purposeHistory.push({
    assessedAt: new Date(),
    status,
    driftCount: driftIndicators.length,
  });

  return {
    status,
    checks,
    driftIndicators: [...driftIndicators],
    freezeRequired,
  };
}

/**
 * 목적 이탈을 감지하고 지표를 등록한다.
 * 공익 의무 축소 시도 시 CRITICAL 심각도로 등록된다.
 * @param description - 이탈 설명
 * @param severity - 심각도
 * @param isPublicInterestReduction - 공익 의무 축소 여부
 * @returns 등록된 이탈 지표
 */
export function detectPurposeDrift(
  description: string,
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  isPublicInterestReduction: boolean = false
): DriftIndicator {
  // 공익 의무 축소 → CRITICAL로 강제 상향
  const finalSeverity = isPublicInterestReduction ? "CRITICAL" : severity;

  const indicator: DriftIndicator = {
    id: `DRIFT-${Date.now()}-${driftIndicators.length}`,
    description: isPublicInterestReduction
      ? `[공익 의무 축소 감지] ${description}`
      : description,
    detectedAt: new Date(),
    severity: finalSeverity,
  };

  driftIndicators.push(indicator);

  if (finalSeverity === "CRITICAL") {
    expansionFrozen = true;
  }

  return indicator;
}

/**
 * 모든 기능 확장을 동결한다.
 * PURPOSE_DRIFT_ACTIVE 상태에서 자동 호출된다.
 * @returns 동결 상태
 */
export function freezeExpansion(): { frozen: boolean; reason: string } {
  expansionFrozen = true;
  return {
    frozen: true,
    reason: "목적 이탈 감지로 인한 기능 확장 동결",
  };
}

/**
 * 현재 확장 동결 상태를 확인한다.
 * @returns 동결 여부
 */
export function isExpansionFrozen(): boolean {
  return expansionFrozen;
}

/**
 * 목적 평가 이력을 반환한다.
 * @returns 이력 배열
 */
export function getPurposeHistory(): PurposeHistoryEntry[] {
  return [...purposeHistory];
}
