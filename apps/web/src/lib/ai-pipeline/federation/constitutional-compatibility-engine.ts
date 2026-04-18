/**
 * @module constitutional-compatibility-engine
 * @description 헌법적 적합성 검증 엔진
 *
 * 기관이 연합에 가입하거나 범위를 확장할 때
 * 헌법적 최소 요건(안전·감사·승계 등)을 충족하는지 검증한다.
 * 필수 항목 미통과 시 INCOMPATIBLE, 선택 항목만 미통과 시 LIMITED_SCOPE_ONLY.
 */

/** 적합성 판정 결과 */
export type CompatibilityVerdict =
  | 'FULLY_COMPATIBLE'
  | 'LIMITED_SCOPE_ONLY'
  | 'INCOMPATIBLE';

/** 개별 검증 항목 */
export interface CompatibilityCheck {
  /** 검증 항목 ID */
  checkId: string;
  /** 검증 카테고리 */
  category: string;
  /** 통과 여부 */
  passed: boolean;
  /** 상세 설명 */
  details: string;
  /** 가중치 (0–1) */
  weight: number;
}

/** 적합성 보고서 */
export interface CompatibilityReport {
  /** 대상 기관 ID */
  institutionId: string;
  /** 최종 판정 */
  verdict: CompatibilityVerdict;
  /** 종합 점수 (0–100) */
  overallScore: number;
  /** 개별 검증 결과 */
  checks: CompatibilityCheck[];
  /** 차단 사유 목록 (필수 항목 미통과) */
  blockers: string[];
  /** 제한 범위 목록 (선택 항목 미통과) */
  limitedScopes: string[];
}

/** 적합성 평가 입력 데이터 */
export interface CompatibilityInput {
  /** 대상 기관 ID */
  institutionId: string;
  /** 승인 계보 존재 여부 */
  hasApprovalLineage: boolean;
  /** 제한된 자동화 시행 여부 */
  boundedAutomationEnforced: boolean;
  /** 증적 무결성 보장 여부 */
  evidenceIntegrity: boolean;
  /** 감사 추적 불변성 보장 여부 */
  auditTrailImmutable: boolean;
  /** 사고 대응 SLA 충족 여부 */
  incidentResponseSLA: boolean;
  /** 승계 계획 존재 여부 */
  successionPlanExists: boolean;
  /** 데이터 주권 준수 여부 */
  dataSovereigntyCompliant: boolean;
  /** 안전 의무 이행 여부 */
  safetyObligationsMet: boolean;
}

/** 필수 검증 항목 정의 */
const MANDATORY_CHECKS: Array<{
  checkId: string;
  category: string;
  field: keyof Omit<CompatibilityInput, 'institutionId'>;
  description: string;
  weight: number;
}> = [
  {
    checkId: 'CHK_APPROVAL_LINEAGE',
    category: '거버넌스',
    field: 'hasApprovalLineage',
    description: '승인 계보 존재 확인',
    weight: 0.15,
  },
  {
    checkId: 'CHK_BOUNDED_AUTOMATION',
    category: '자동화 제어',
    field: 'boundedAutomationEnforced',
    description: '제한된 자동화 시행 여부',
    weight: 0.15,
  },
  {
    checkId: 'CHK_EVIDENCE_INTEGRITY',
    category: '증적 품질',
    field: 'evidenceIntegrity',
    description: '증적 무결성 보장',
    weight: 0.15,
  },
  {
    checkId: 'CHK_AUDIT_TRAIL',
    category: '감사',
    field: 'auditTrailImmutable',
    description: '감사 추적 불변성',
    weight: 0.15,
  },
  {
    checkId: 'CHK_SAFETY_OBLIGATIONS',
    category: '안전',
    field: 'safetyObligationsMet',
    description: '안전 의무 이행',
    weight: 0.15,
  },
];

/** 선택 검증 항목 정의 */
const OPTIONAL_CHECKS: Array<{
  checkId: string;
  category: string;
  field: keyof Omit<CompatibilityInput, 'institutionId'>;
  description: string;
  weight: number;
  scopeRestriction: string;
}> = [
  {
    checkId: 'CHK_INCIDENT_SLA',
    category: '사고 대응',
    field: 'incidentResponseSLA',
    description: '사고 대응 SLA 충족',
    weight: 0.1,
    scopeRestriction: 'CRISIS_COORDINATION 참여 불가',
  },
  {
    checkId: 'CHK_SUCCESSION_PLAN',
    category: '승계',
    field: 'successionPlanExists',
    description: '승계 계획 존재',
    weight: 0.075,
    scopeRestriction: 'STEWARDSHIP_COVERAGE 평가 제외',
  },
  {
    checkId: 'CHK_DATA_SOVEREIGNTY',
    category: '데이터 주권',
    field: 'dataSovereigntyCompliant',
    description: '데이터 주권 준수',
    weight: 0.075,
    scopeRestriction: 'RAW 데이터 교환 불가',
  },
];

/**
 * 기관의 헌법적 적합성을 평가한다.
 *
 * - 필수 항목 중 하나라도 미통과 → INCOMPATIBLE
 * - 선택 항목만 미통과 → LIMITED_SCOPE_ONLY
 * - 전부 통과 → FULLY_COMPATIBLE
 *
 * @param input 평가 입력 데이터
 * @returns 적합성 보고서
 */
export function evaluateCompatibility(input: CompatibilityInput): CompatibilityReport {
  const checks: CompatibilityCheck[] = [];
  const blockers: string[] = [];
  const limitedScopes: string[] = [];

  // 필수 항목 검증
  for (const def of MANDATORY_CHECKS) {
    const passed = Boolean(input[def.field]);
    checks.push({
      checkId: def.checkId,
      category: def.category,
      passed,
      details: passed ? `${def.description}: 통과` : `${def.description}: 미통과 (필수)`,
      weight: def.weight,
    });
    if (!passed) {
      blockers.push(def.description);
    }
  }

  // 선택 항목 검증
  for (const def of OPTIONAL_CHECKS) {
    const passed = Boolean(input[def.field]);
    checks.push({
      checkId: def.checkId,
      category: def.category,
      passed,
      details: passed ? `${def.description}: 통과` : `${def.description}: 미통과 (선택)`,
      weight: def.weight,
    });
    if (!passed) {
      limitedScopes.push(def.scopeRestriction);
    }
  }

  // 종합 점수 계산
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const passedWeight = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const overallScore = totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) : 0;

  // 판정
  let verdict: CompatibilityVerdict;
  if (blockers.length > 0) {
    verdict = 'INCOMPATIBLE';
  } else if (limitedScopes.length > 0) {
    verdict = 'LIMITED_SCOPE_ONLY';
  } else {
    verdict = 'FULLY_COMPATIBLE';
  }

  return {
    institutionId: input.institutionId,
    verdict,
    overallScore,
    checks,
    blockers,
    limitedScopes,
  };
}
