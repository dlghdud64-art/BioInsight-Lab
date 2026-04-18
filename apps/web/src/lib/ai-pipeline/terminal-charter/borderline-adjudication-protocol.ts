/**
 * @module borderline-adjudication-protocol
 * @description 경계선 판정 프로토콜 — 침해와 합법 갱신의 모호한 경계선 케이스를
 * 자동 실행 금지하고 SUSPECT_BREACH_REQUIRES_REVIEW로 분류하여
 * 헌법 해석 위원회에 회부한다.
 *
 * Zero-Tolerance 원칙:
 * - False-positive 부담 때문에 가드레일을 느슨하게 풀지 않는다
 * - 모호하면 차단 → 리뷰 (fail-close)
 * - 자동 승인(fail-open) 경로 없음
 */

// ─────────────────────────────────────────────
// 1. 경계선 분류
// ─────────────────────────────────────────────

/** 경계선 판정 상태 */
export type AdjudicationStatus =
  | "PENDING_REVIEW"         // 리뷰 대기
  | "UNDER_REVIEW"           // 리뷰 진행 중
  | "CLEARED_LEGITIMATE"     // 합법 판정
  | "CONFIRMED_BREACH"       // 침해 확정
  | "REQUIRES_CHARTER_CLARIFICATION" // 헌장 명확화 필요
  | "TIMED_OUT_BLOCKED";     // 타임아웃 → 차단 유지

/** 경계선 유형 */
export type BorderlineType =
  | "THRESHOLD_RELAXATION"      // 임계값 완화
  | "SCOPE_INCREMENTAL_EXPANSION" // 점진적 범위 확장
  | "SEMANTIC_REINTERPRETATION" // 의미론적 재해석
  | "COMBINED_PARAMETER_EFFECT" // 복합 파라미터 효과
  | "EXCEPTION_SCOPE_WIDENING"  // 예외 범위 확대
  | "TEMPORAL_BOUNDARY_SHIFT";  // 시간적 경계 이동

/** 경계선 판정 케이스 */
export interface AdjudicationCase {
  /** 케이스 ID */
  caseId: string;
  /** 경계선 유형 */
  type: BorderlineType;
  /** 원본 요청 ID */
  originalRequestId: string;
  /** 상태 */
  status: AdjudicationStatus;
  /** 요청 내용 요약 */
  requestSummary: string;
  /** 모호성 설명 */
  ambiguityDescription: string;
  /** 영향 받는 코어 원칙 */
  affectedCorePrinciples: string[];
  /** 회부 대상 */
  referredTo: string;
  /** 임시 보류(Hold) 범위 */
  holdScope: string;
  /** 제출 시각 */
  submittedAt: Date;
  /** 타임아웃 시각 */
  timeoutAt: Date;
  /** 해소 시각 */
  resolvedAt: Date | null;
  /** 판정 근거 */
  rationale: string | null;
  /** 자동 실행 차단 여부 (항상 true) */
  autoExecutionBlocked: true;
}

// ─────────────────────────────────────────────
// 2. 경계선 감지 규칙
// ─────────────────────────────────────────────

/** 경계선 감지 규칙 */
interface BorderlineDetectionRule {
  /** 규칙 ID */
  ruleId: string;
  /** 감지 패턴 */
  pattern: RegExp;
  /** 경계선 유형 */
  type: BorderlineType;
  /** 설명 */
  description: string;
}

const DETECTION_RULES: BorderlineDetectionRule[] = [
  {
    ruleId: "BL-001",
    pattern: /relax|loosen|lower.*threshold|increase.*tolerance/i,
    type: "THRESHOLD_RELAXATION",
    description: "임계값 완화 시도 — 코어 보호 경계 약화 가능성",
  },
  {
    ruleId: "BL-002",
    pattern: /expand.*scope|widen.*range|include.*additional/i,
    type: "SCOPE_INCREMENTAL_EXPANSION",
    description: "점진적 범위 확장 — 코어 경계 침범 가능성",
  },
  {
    ruleId: "BL-003",
    pattern: /redefine|reinterpret|alternative.*meaning/i,
    type: "SEMANTIC_REINTERPRETATION",
    description: "의미론적 재해석 — 코어 원칙 약화 가능성",
  },
  {
    ruleId: "BL-004",
    pattern: /combined|aggregate|cumulative.*effect/i,
    type: "COMBINED_PARAMETER_EFFECT",
    description: "복합 파라미터 효과 — 개별은 합법이나 조합은 침해",
  },
  {
    ruleId: "BL-005",
    pattern: /exception.*expand|except.*widen|carve.*out/i,
    type: "EXCEPTION_SCOPE_WIDENING",
    description: "예외 범위 확대 — 코어 보호 우회 가능성",
  },
  {
    ruleId: "BL-006",
    pattern: /extend.*deadline|postpone.*expiry|defer.*renewal/i,
    type: "TEMPORAL_BOUNDARY_SHIFT",
    description: "시간적 경계 이동 — 만료 보호 약화 가능성",
  },
];

// ─────────────────────────────────────────────
// 3. 케이스 저장소 (production: DB-backed)
// ─────────────────────────────────────────────

const caseStore: AdjudicationCase[] = [];

/** 리뷰 타임아웃 (기본 48시간) */
const REVIEW_TIMEOUT_MS = 48 * 60 * 60 * 1000;

// ─────────────────────────────────────────────
// 4. 경계선 감지 및 케이스 생성
// ─────────────────────────────────────────────

/**
 * 요청이 경계선 케이스인지 감지한다.
 * 경계선으로 판정되면 자동 실행을 차단하고 리뷰 케이스를 생성한다.
 */
export function detectBorderlineCase(params: {
  requestId: string;
  targetField: string;
  mutationType: string;
  requestSummary: string;
  affectedCorePrinciples: string[];
}): {
  isBorderline: boolean;
  case_: AdjudicationCase | null;
  matchedRules: string[];
} {
  const combined = `${params.targetField} ${params.mutationType} ${params.requestSummary}`;
  const matchedRules = DETECTION_RULES.filter((r) => r.pattern.test(combined));

  if (matchedRules.length === 0) {
    return { isBorderline: false, case_: null, matchedRules: [] };
  }

  const now = new Date();
  const primaryRule = matchedRules[0];

  const adjCase: AdjudicationCase = {
    caseId: `ADJ-${Date.now()}-${caseStore.length}`,
    type: primaryRule.type,
    originalRequestId: params.requestId,
    status: "PENDING_REVIEW",
    requestSummary: params.requestSummary,
    ambiguityDescription: matchedRules.map((r) => r.description).join("; "),
    affectedCorePrinciples: params.affectedCorePrinciples,
    referredTo: "charter-interpretation-council",
    holdScope: params.targetField,
    submittedAt: now,
    timeoutAt: new Date(now.getTime() + REVIEW_TIMEOUT_MS),
    resolvedAt: null,
    rationale: null,
    autoExecutionBlocked: true, // ★ 항상 차단 ★
  };

  caseStore.push(adjCase);
  return {
    isBorderline: true,
    case_: adjCase,
    matchedRules: matchedRules.map((r) => r.ruleId),
  };
}

/**
 * 경계선 케이스를 판정한다.
 * ★ CRITICAL: 타임아웃 시 TIMED_OUT_BLOCKED (fail-close) — fail-open 절대 불가 ★
 */
export function resolveAdjudicationCase(
  caseId: string,
  decision: "CLEARED_LEGITIMATE" | "CONFIRMED_BREACH" | "REQUIRES_CHARTER_CLARIFICATION",
  rationale: string
): {
  resolved: boolean;
  case_: AdjudicationCase | null;
  error: string | null;
} {
  const adjCase = caseStore.find((c) => c.caseId === caseId);
  if (!adjCase) {
    return { resolved: false, case_: null, error: "케이스를 찾을 수 없음" };
  }
  if (adjCase.resolvedAt) {
    return { resolved: false, case_: adjCase, error: "이미 해소된 케이스" };
  }

  adjCase.status = decision;
  adjCase.resolvedAt = new Date();
  adjCase.rationale = rationale;

  return { resolved: true, case_: { ...adjCase }, error: null };
}

/**
 * 타임아웃된 케이스를 처리한다.
 * ★ 타임아웃 = TIMED_OUT_BLOCKED (차단 유지, 자동 승인 없음) ★
 */
export function processTimeouts(): {
  timedOutCount: number;
  timedOutCases: AdjudicationCase[];
} {
  const now = new Date();
  const timedOut: AdjudicationCase[] = [];

  for (const c of caseStore) {
    if (c.status === "PENDING_REVIEW" && now >= c.timeoutAt) {
      c.status = "TIMED_OUT_BLOCKED"; // ★ fail-close ★
      c.resolvedAt = now;
      c.rationale = "리뷰 타임아웃 — 차단 유지 (fail-open 불허)";
      timedOut.push({ ...c });
    }
  }

  return { timedOutCount: timedOut.length, timedOutCases: timedOut };
}

// ─────────────────────────────────────────────
// 5. 조회 함수
// ─────────────────────────────────────────────

/** 전체 케이스 조회 */
export function getAdjudicationCases(): AdjudicationCase[] {
  return [...caseStore];
}

/** 대기 중 케이스 조회 */
export function getPendingCases(): AdjudicationCase[] {
  return caseStore.filter((c) => c.status === "PENDING_REVIEW" || c.status === "UNDER_REVIEW");
}

/** 감지 규칙 조회 */
export function getDetectionRules(): BorderlineDetectionRule[] {
  return [...DETECTION_RULES];
}
