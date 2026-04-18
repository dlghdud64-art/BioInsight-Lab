/**
 * 범용 보증 빌더 (Universal Assurance Builder)
 *
 * 보증 프레임워크를 구축하고, 대상 시스템을 프레임워크 기준으로 평가하며,
 * 보증 보고서를 발행하고, 여러 프레임워크 간 교차 참조를 수행합니다.
 */

/** 보증 프레임워크 */
export interface AssuranceFramework {
  id: string;
  name: string;
  /** 프레임워크가 보장하는 원칙 목록 */
  principles: string[];
  /** 보증 등급 목록 (낮은 순) */
  tiers: string[];
  /** 평가 기준 */
  assessmentCriteria: string[];
  /** 적용 가능 대상 유형 목록 */
  applicableTo: string[];
}

/** 보증 보고서 */
export interface AssuranceReport {
  frameworkId: string;
  /** 평가 대상 ID */
  subjectId: string;
  /** 달성 등급 */
  tier: string;
  /** 근거 증거 목록 */
  evidence: string[];
  assessedAt: Date;
  /** 유효 기한 */
  validUntil: Date;
  /** 검토자 */
  reviewer: string;
}

/** 교차 참조 결과 */
export interface CrossReferenceResult {
  frameworkA: string;
  frameworkB: string;
  /** 공통 원칙 */
  sharedPrinciples: string[];
  /** 공통 기준 */
  sharedCriteria: string[];
  /** 호환성 점수 (0–1) */
  compatibilityScore: number;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------
const frameworks: AssuranceFramework[] = [];
const reports: AssuranceReport[] = [];

let nextId = 1;
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${nextId++}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 보증 프레임워크를 구축합니다.
 * @param params 프레임워크 파라미터
 */
export function buildFramework(params: {
  name: string;
  principles: string[];
  tiers: string[];
  assessmentCriteria: string[];
  applicableTo: string[];
}): AssuranceFramework {
  const fw: AssuranceFramework = {
    id: genId("fw"),
    ...params,
  };
  frameworks.push(fw);
  return fw;
}

/**
 * 대상을 프레임워크 기준으로 평가합니다.
 * @param frameworkId 프레임워크 ID
 * @param subjectId 평가 대상 ID
 * @param evidence 제출 증거
 * @param reviewer 검토자
 * @param validityDays 유효 기간 (일)
 */
export function assessAgainstFramework(
  frameworkId: string,
  subjectId: string,
  evidence: string[],
  reviewer: string,
  validityDays: number = 365
): AssuranceReport | null {
  const fw = frameworks.find((f) => f.id === frameworkId);
  if (!fw) return null;

  // 증거 수에 따라 등급 결정
  const criteriaCount = fw.assessmentCriteria.length;
  const coverage = criteriaCount === 0 ? 0 : evidence.length / criteriaCount;
  let tierIndex: number;
  if (coverage >= 1) tierIndex = fw.tiers.length - 1;
  else tierIndex = Math.floor(coverage * fw.tiers.length);
  tierIndex = Math.max(0, Math.min(fw.tiers.length - 1, tierIndex));

  const now = new Date();
  const validUntil = new Date(now.getTime() + validityDays * 86_400_000);

  const report: AssuranceReport = {
    frameworkId,
    subjectId,
    tier: fw.tiers[tierIndex] ?? "UNRATED",
    evidence,
    assessedAt: now,
    validUntil,
    reviewer,
  };
  reports.push(report);
  return report;
}

/**
 * 보증 보고서를 발행(조회)합니다.
 * @param subjectId 대상 ID
 * @param frameworkId 프레임워크 ID (선택)
 */
export function issueAssurance(
  subjectId: string,
  frameworkId?: string
): AssuranceReport[] {
  return reports.filter(
    (r) =>
      r.subjectId === subjectId &&
      (!frameworkId || r.frameworkId === frameworkId)
  );
}

/**
 * 두 프레임워크 간 교차 참조를 수행합니다.
 * @param frameworkIdA 프레임워크 A ID
 * @param frameworkIdB 프레임워크 B ID
 */
export function crossReferenceFrameworks(
  frameworkIdA: string,
  frameworkIdB: string
): CrossReferenceResult | null {
  const a = frameworks.find((f) => f.id === frameworkIdA);
  const b = frameworks.find((f) => f.id === frameworkIdB);
  if (!a || !b) return null;

  const sharedPrinciples = a.principles.filter((p) =>
    b.principles.includes(p)
  );
  const sharedCriteria = a.assessmentCriteria.filter((c) =>
    b.assessmentCriteria.includes(c)
  );

  const totalUnique = new Set([...a.principles, ...b.principles]).size;
  const compatibilityScore =
    totalUnique === 0 ? 0 : sharedPrinciples.length / totalUnique;

  return {
    frameworkA: frameworkIdA,
    frameworkB: frameworkIdB,
    sharedPrinciples,
    sharedCriteria,
    compatibilityScore: Math.round(compatibilityScore * 100) / 100,
  };
}
