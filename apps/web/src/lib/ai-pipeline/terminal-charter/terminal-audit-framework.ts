/**
 * @module terminal-audit-framework
 * @description 터미널 감사 프레임워크 — 시스템의 최종 건전성을 평가한다.
 * 불변 코어 무결성, 목적 정렬, 갱신 준수 상태를 종합 판정하여
 * TERMINALLY_SOUND, CONCERNS_IDENTIFIED, STRUCTURALLY_COMPROMISED 중 하나로 판정한다.
 */

/** 감사 판정 */
export type AuditVerdict =
  | "TERMINALLY_SOUND"
  | "CONCERNS_IDENTIFIED"
  | "STRUCTURALLY_COMPROMISED";

/** 터미널 감사 점검 항목 */
export interface TerminalAuditCheck {
  /** 점검 고유 ID */
  id: string;
  /** 점검 질문 */
  question: string;
  /** 카테고리 */
  category: string;
  /** 통과 여부 */
  passed: boolean;
  /** 근거 */
  evidence: string;
}

/** 터미널 감사 보고서 */
export interface TerminalAuditReport {
  /** 최종 판정 */
  verdict: AuditVerdict;
  /** 점검 항목 결과 */
  checks: TerminalAuditCheck[];
  /** 코어 무결성 점수 (0~100) */
  coreIntegrity: number;
  /** 목적 정렬 점수 (0~100) */
  purposeAlignment: number;
  /** 갱신 준수 점수 (0~100) */
  renewalCompliance: number;
  /** 감사 일시 */
  auditedAt: Date;
}

/** 감사 입력 데이터 */
export interface AuditInputs {
  /** 불변 코어 손상 여부 */
  coreIntact: boolean;
  /** 위반 로그 건수 */
  violationCount: number;
  /** 목적 이탈 여부 */
  purposeDriftAbsent: boolean;
  /** 갱신 루프 활성 여부 */
  renewalLoopsActive: boolean;
  /** 만기 초과 항목 수 */
  overdueRenewals: number;
  /** 미이행 의무 수 */
  unfulfilledObligations: number;
  /** 미해결 모호성 수 */
  unresolvedAmbiguities: number;
  /** 재창설 필요 여부 */
  refoundationRequired: boolean;
  /** 개정 프로토콜 준수 여부 */
  amendmentProtocolCompliant: boolean;
  /** 확장 동결 상태 */
  expansionFrozen: boolean;
}

/** 감사 이력 */
const auditHistory: TerminalAuditReport[] = [];

/** 기본 점검 항목 정의 */
const DEFAULT_CHECKS: Array<{
  id: string;
  question: string;
  category: string;
  evaluate: (inputs: AuditInputs) => { passed: boolean; evidence: string };
}> = [
  {
    id: "TA-001",
    question: "불변 코어가 손상되지 않았는가?",
    category: "코어 무결성",
    evaluate: (i) => ({
      passed: i.coreIntact,
      evidence: i.coreIntact ? "코어 무결" : "코어 손상 감지",
    }),
  },
  {
    id: "TA-002",
    question: "위반 로그가 허용 범위 내인가?",
    category: "코어 무결성",
    evaluate: (i) => ({
      passed: i.violationCount < 5,
      evidence: `위반 ${i.violationCount}건 기록`,
    }),
  },
  {
    id: "TA-003",
    question: "목적 이탈이 없는가?",
    category: "목적 정렬",
    evaluate: (i) => ({
      passed: i.purposeDriftAbsent,
      evidence: i.purposeDriftAbsent ? "목적 정렬 유지" : "목적 이탈 감지",
    }),
  },
  {
    id: "TA-004",
    question: "갱신 루프가 활성 상태인가?",
    category: "갱신 준수",
    evaluate: (i) => ({
      passed: i.renewalLoopsActive,
      evidence: i.renewalLoopsActive ? "갱신 루프 활성" : "갱신 루프 비활성",
    }),
  },
  {
    id: "TA-005",
    question: "만기 초과 갱신 항목이 없는가?",
    category: "갱신 준수",
    evaluate: (i) => ({
      passed: i.overdueRenewals === 0,
      evidence: `만기 초과 ${i.overdueRenewals}건`,
    }),
  },
  {
    id: "TA-006",
    question: "모든 의무가 이행되고 있는가?",
    category: "의무 이행",
    evaluate: (i) => ({
      passed: i.unfulfilledObligations === 0,
      evidence: `미이행 의무 ${i.unfulfilledObligations}건`,
    }),
  },
  {
    id: "TA-007",
    question: "모든 모호성이 해결되었는가?",
    category: "종결 준비",
    evaluate: (i) => ({
      passed: i.unresolvedAmbiguities === 0,
      evidence: `미해결 모호성 ${i.unresolvedAmbiguities}건`,
    }),
  },
  {
    id: "TA-008",
    question: "재창설이 불필요한 상태인가?",
    category: "안정성",
    evaluate: (i) => ({
      passed: !i.refoundationRequired,
      evidence: i.refoundationRequired ? "재창설 필요" : "안정 상태",
    }),
  },
  {
    id: "TA-009",
    question: "개정 프로토콜이 준수되고 있는가?",
    category: "거버넌스",
    evaluate: (i) => ({
      passed: i.amendmentProtocolCompliant,
      evidence: i.amendmentProtocolCompliant
        ? "프로토콜 준수"
        : "프로토콜 미준수",
    }),
  },
  {
    id: "TA-010",
    question: "부적절한 확장 동결이 없는가?",
    category: "운영",
    evaluate: (i) => ({
      passed: !i.expansionFrozen,
      evidence: i.expansionFrozen ? "확장 동결 상태" : "정상 운영",
    }),
  },
];

/**
 * 터미널 감사를 실행한다.
 * @param inputs - 감사 입력 데이터
 * @returns 터미널 감사 보고서
 */
export function runTerminalAudit(inputs: AuditInputs): TerminalAuditReport {
  const checks: TerminalAuditCheck[] = DEFAULT_CHECKS.map((def) => {
    const result = def.evaluate(inputs);
    return {
      id: def.id,
      question: def.question,
      category: def.category,
      passed: result.passed,
      evidence: result.evidence,
    };
  });

  const passedCount = checks.filter((c) => c.passed).length;
  const failedCount = checks.length - passedCount;

  // 카테고리별 점수 계산
  const coreChecks = checks.filter((c) => c.category === "코어 무결성");
  const purposeChecks = checks.filter((c) => c.category === "목적 정렬");
  const renewalChecks = checks.filter((c) => c.category === "갱신 준수");

  const coreIntegrity = computeScore(coreChecks);
  const purposeAlignment = computeScore(purposeChecks);
  const renewalCompliance = computeScore(renewalChecks);

  let verdict: AuditVerdict;
  if (failedCount === 0) {
    verdict = "TERMINALLY_SOUND";
  } else if (failedCount <= 3) {
    verdict = "CONCERNS_IDENTIFIED";
  } else {
    verdict = "STRUCTURALLY_COMPROMISED";
  }

  const report: TerminalAuditReport = {
    verdict,
    checks,
    coreIntegrity,
    purposeAlignment,
    renewalCompliance,
    auditedAt: new Date(),
  };

  auditHistory.push(report);
  return report;
}

/**
 * 코어 무결성 점수를 반환한다 (마지막 감사 기준).
 * @returns 코어 무결성 점수 (0~100), 감사 이력 없으면 0
 */
export function getCoreIntegrity(): number {
  const latest = auditHistory[auditHistory.length - 1];
  return latest?.coreIntegrity ?? 0;
}

/**
 * 목적 정렬 점수를 반환한다 (마지막 감사 기준).
 * @returns 목적 정렬 점수 (0~100), 감사 이력 없으면 0
 */
export function getPurposeAlignment(): number {
  const latest = auditHistory[auditHistory.length - 1];
  return latest?.purposeAlignment ?? 0;
}

/**
 * 감사 이력을 반환한다.
 * @returns 감사 보고서 이력 배열
 */
export function getAuditHistory(): TerminalAuditReport[] {
  return [...auditHistory];
}

/** 점검 항목 배열에서 점수 계산 */
function computeScore(checks: TerminalAuditCheck[]): number {
  if (checks.length === 0) return 100;
  const passed = checks.filter((c) => c.passed).length;
  return Math.round((passed / checks.length) * 100);
}
