/**
 * @module operating-loop-drift-resistance
 * @description Post-Z E2E 시나리오 9 — 운영 루프 드리프트 저항성.
 * 9가지 운영 루프의 점진적 침식(slow erosion)을 시뮬레이션하고,
 * 13가지 드리프트 벡터를 탐지하여 헌법적 건전성을 유지한다.
 *
 * 핵심 원칙:
 * 1. 신선 증거 없는 갱신은 무효 — stale carry-forward 즉시 탐지
 * 2. 임시 예외의 정규화 차단 — 예외 연장 횟수 제한
 * 3. 개정 범위 누적 점검 — semantic scope creep 탐지
 * 4. 목적 잠금 스트레스 테스트 — 목적 재해석 시도 차단
 * 5. 리뷰 형식화 탐지 — 실질적 심의 vs 의례적 통과 구분
 */

// ─────────────────────────────────────────────
// PART 2: Drift Vector Taxonomy (declared early for catalog reference)
// ─────────────────────────────────────────────

/** 드리프트 벡터 분류 */
export enum DriftVector {
  /** stale 갱신 수용 */
  STALE_RENEWAL_ACCEPTANCE = "STALE_RENEWAL_ACCEPTANCE",
  /** 임시 예외 정규화 */
  TEMPORARY_EXCEPTION_NORMALIZATION = "TEMPORARY_EXCEPTION_NORMALIZATION",
  /** 개정 범위 확장 */
  AMENDMENT_SCOPE_CREEP = "AMENDMENT_SCOPE_CREEP",
  /** 목적 재해석 드리프트 */
  PURPOSE_REINTERPRETATION_DRIFT = "PURPOSE_REINTERPRETATION_DRIFT",
  /** 의무 연속성 쇠퇴 */
  OBLIGATION_CONTINUITY_DECAY = "OBLIGATION_CONTINUITY_DECAY",
  /** 리뷰 주기 지연 */
  REVIEW_CADENCE_SLIPPAGE = "REVIEW_CADENCE_SLIPPAGE",
  /** 피로에 의한 감사 깊이 감소 */
  AUDIT_DEPTH_REDUCTION_BY_FATIGUE = "AUDIT_DEPTH_REDUCTION_BY_FATIGUE",
  /** 대시보드 위험 정상화 */
  DASHBOARD_NORMALIZATION_OF_RISK = "DASHBOARD_NORMALIZATION_OF_RISK",
  /** 일몰 지연 누적 */
  SUNSET_DELAY_ACCUMULATION = "SUNSET_DELAY_ACCUMULATION",
  /** 레거시 경로 보존 드리프트 */
  LEGACY_PATH_PRESERVATION_DRIFT = "LEGACY_PATH_PRESERVATION_DRIFT",
  /** 제한 공개 약화 */
  LIMITATION_DISCLOSURE_SOFTENING = "LIMITATION_DISCLOSURE_SOFTENING",
  /** 인간 리뷰 형식화 드리프트 */
  HUMAN_REVIEW_FORMALITY_DRIFT = "HUMAN_REVIEW_FORMALITY_DRIFT",
  /** 재건 신호 억압 */
  REFOUNDATION_SIGNAL_SUPPRESSION = "REFOUNDATION_SIGNAL_SUPPRESSION",
}

// ─────────────────────────────────────────────
// PART 1: Operating Loop Catalog
// ─────────────────────────────────────────────

/** 운영 루프 유형 */
export enum OperatingLoopType {
  /** 월간 갱신 심의 */
  MONTHLY_RENEWAL_REVIEW = "MONTHLY_RENEWAL_REVIEW",
  /** 분기 헌법 리뷰 */
  QUARTERLY_CONSTITUTIONAL_REVIEW = "QUARTERLY_CONSTITUTIONAL_REVIEW",
  /** 반기 신뢰 갱신 */
  SEMIANNUAL_TRUST_RENEWAL = "SEMIANNUAL_TRUST_RENEWAL",
  /** 연간 헌장 건강 리뷰 */
  ANNUAL_CHARTER_HEALTH_REVIEW = "ANNUAL_CHARTER_HEALTH_REVIEW",
  /** 개정 심의 사이클 */
  AMENDMENT_REVIEW_CYCLE = "AMENDMENT_REVIEW_CYCLE",
  /** 일몰 리팩터 리뷰 */
  SUNSET_REFACTOR_REVIEW = "SUNSET_REFACTOR_REVIEW",
  /** 의무 연속성 리뷰 */
  OBLIGATION_CONTINUITY_REVIEW = "OBLIGATION_CONTINUITY_REVIEW",
  /** 터미널 감사 사이클 */
  TERMINAL_AUDIT_CYCLE = "TERMINAL_AUDIT_CYCLE",
  /** 재건 감시 사이클 */
  REFOUNDATION_WATCH_CYCLE = "REFOUNDATION_WATCH_CYCLE",
}

/** 운영 루프 카탈로그 항목 */
export interface OperatingLoopCatalogEntry {
  /** 루프 유형 */
  loopType: OperatingLoopType;
  /** 목적 */
  purpose: string;
  /** 입력 */
  inputs: string[];
  /** 필수 산출물 */
  requiredArtifacts: string[];
  /** 필수 역할 */
  requiredRoles: string[];
  /** 승인 경로 */
  approvalPath: string[];
  /** 필수 산출 결정 */
  requiredOutputDecision: string;
  /** 드리프트 위험 */
  driftRisks: DriftVector[];
  /** 실패 결과 */
  failureConsequences: string[];
}

/** 운영 루프 카탈로그 (production: DB-backed) */
const operatingLoopCatalog: Map<OperatingLoopType, OperatingLoopCatalogEntry> = new Map([
  [OperatingLoopType.MONTHLY_RENEWAL_REVIEW, {
    loopType: OperatingLoopType.MONTHLY_RENEWAL_REVIEW,
    purpose: "만료 예정 신뢰 자산 및 예외 사항의 갱신 여부를 심의한다",
    inputs: ["갱신 대상 목록", "신선 증거 패키지", "이전 갱신 이력"],
    requiredArtifacts: ["갱신 심의 기록", "증거 검증 결과", "갱신/거부 결정문"],
    requiredRoles: ["APPROVER", "AUDITOR"],
    approvalPath: ["APPROVER 심의", "AUDITOR 검증"],
    requiredOutputDecision: "RENEW / REJECT / DOWNGRADE",
    driftRisks: [DriftVector.STALE_RENEWAL_ACCEPTANCE, DriftVector.HUMAN_REVIEW_FORMALITY_DRIFT],
    failureConsequences: ["stale 자산 무기한 존속", "증거 없는 신뢰 유지"],
  }],
  [OperatingLoopType.QUARTERLY_CONSTITUTIONAL_REVIEW, {
    loopType: OperatingLoopType.QUARTERLY_CONSTITUTIONAL_REVIEW,
    purpose: "헌법적 원칙의 준수 상태와 개정 필요성을 분기별로 점검한다",
    inputs: ["헌법 원칙 목록", "위반 로그", "개정 요청 큐"],
    requiredArtifacts: ["분기 헌법 건강 보고서", "위반 추세 분석", "개정 권고"],
    requiredRoles: ["ADMIN", "AUDITOR", "OWNER"],
    approvalPath: ["ADMIN 초안", "AUDITOR 검증", "OWNER 최종 승인"],
    requiredOutputDecision: "CONSTITUTIONAL_SOUND / AMENDMENT_NEEDED / ESCALATE",
    driftRisks: [DriftVector.AMENDMENT_SCOPE_CREEP, DriftVector.REVIEW_CADENCE_SLIPPAGE],
    failureConsequences: ["개정 누적 미점검", "범위 확장 미감지"],
  }],
  [OperatingLoopType.SEMIANNUAL_TRUST_RENEWAL, {
    loopType: OperatingLoopType.SEMIANNUAL_TRUST_RENEWAL,
    purpose: "시스템 전반의 신뢰 관계를 반기별로 재검증한다",
    inputs: ["신뢰 관계 목록", "사용 실적", "위반 이력"],
    requiredArtifacts: ["신뢰 재검증 보고서", "강등/유지 결정문"],
    requiredRoles: ["APPROVER", "OWNER"],
    approvalPath: ["APPROVER 심의", "OWNER 최종 확인"],
    requiredOutputDecision: "TRUST_RENEWED / TRUST_DOWNGRADED / TRUST_REVOKED",
    driftRisks: [DriftVector.STALE_RENEWAL_ACCEPTANCE, DriftVector.OBLIGATION_CONTINUITY_DECAY],
    failureConsequences: ["형식적 갱신 반복", "의무 이행 미확인 갱신"],
  }],
  [OperatingLoopType.ANNUAL_CHARTER_HEALTH_REVIEW, {
    loopType: OperatingLoopType.ANNUAL_CHARTER_HEALTH_REVIEW,
    purpose: "헌장 전체의 건강 상태를 연간 종합 점검한다",
    inputs: ["헌장 전문", "연간 운영 데이터", "사고 이력"],
    requiredArtifacts: ["헌장 건강 보고서", "구조적 갭 분석", "개선 로드맵"],
    requiredRoles: ["ADMIN", "AUDITOR", "OWNER"],
    approvalPath: ["ADMIN 분석", "AUDITOR 독립 검증", "OWNER 승인"],
    requiredOutputDecision: "CHARTER_HEALTHY / CHARTER_NEEDS_REVISION / REFOUNDATION_WATCH",
    driftRisks: [DriftVector.DASHBOARD_NORMALIZATION_OF_RISK, DriftVector.AUDIT_DEPTH_REDUCTION_BY_FATIGUE],
    failureConsequences: ["구조적 취약점 누적", "감사 깊이 저하"],
  }],
  [OperatingLoopType.AMENDMENT_REVIEW_CYCLE, {
    loopType: OperatingLoopType.AMENDMENT_REVIEW_CYCLE,
    purpose: "개정 요청을 심의하고 누적 영향을 분석한다",
    inputs: ["개정 요청", "이전 개정 이력", "누적 영향 분석"],
    requiredArtifacts: ["개정 심의 기록", "누적 영향 보고서", "승인/거부 결정문"],
    requiredRoles: ["APPROVER", "ADMIN"],
    approvalPath: ["APPROVER 심의", "ADMIN 누적 영향 검증"],
    requiredOutputDecision: "AMENDMENT_APPROVED / AMENDMENT_REJECTED / AMENDMENT_FREEZE",
    driftRisks: [DriftVector.AMENDMENT_SCOPE_CREEP, DriftVector.PURPOSE_REINTERPRETATION_DRIFT],
    failureConsequences: ["범위 확장 미감지", "목적 재해석 허용"],
  }],
  [OperatingLoopType.SUNSET_REFACTOR_REVIEW, {
    loopType: OperatingLoopType.SUNSET_REFACTOR_REVIEW,
    purpose: "일몰 대상 컴포넌트의 제거 일정을 관리한다",
    inputs: ["일몰 후보 목록", "의존성 분석", "제거 영향 평가"],
    requiredArtifacts: ["일몰 실행 계획", "의존성 해소 보고서"],
    requiredRoles: ["ADMIN", "APPROVER"],
    approvalPath: ["ADMIN 분석", "APPROVER 승인"],
    requiredOutputDecision: "SUNSET_EXECUTED / SUNSET_DEFERRED / LEGACY_CLEANUP_REQUIRED",
    driftRisks: [DriftVector.SUNSET_DELAY_ACCUMULATION, DriftVector.LEGACY_PATH_PRESERVATION_DRIFT],
    failureConsequences: ["레거시 복잡도 누적", "일몰 백로그 증가"],
  }],
  [OperatingLoopType.OBLIGATION_CONTINUITY_REVIEW, {
    loopType: OperatingLoopType.OBLIGATION_CONTINUITY_REVIEW,
    purpose: "영구 의무의 이행 연속성을 점검한다",
    inputs: ["의무 목록", "이행 기록", "미이행 알림"],
    requiredArtifacts: ["의무 이행 보고서", "백로그 현황"],
    requiredRoles: ["AUDITOR", "ADMIN"],
    approvalPath: ["AUDITOR 검증", "ADMIN 시정 조치"],
    requiredOutputDecision: "OBLIGATIONS_MET / OBLIGATIONS_DELAYED / CONTINUITY_FAILURE",
    driftRisks: [DriftVector.OBLIGATION_CONTINUITY_DECAY, DriftVector.LIMITATION_DISCLOSURE_SOFTENING],
    failureConsequences: ["의무 미이행 누적", "공개 의무 약화"],
  }],
  [OperatingLoopType.TERMINAL_AUDIT_CYCLE, {
    loopType: OperatingLoopType.TERMINAL_AUDIT_CYCLE,
    purpose: "터미널 감사를 수행하여 시스템 전체 건전성을 검증한다",
    inputs: ["감사 체크리스트", "이전 감사 결과", "사고 이력"],
    requiredArtifacts: ["감사 보고서", "시정 조치 계획", "불변량 검증 결과"],
    requiredRoles: ["AUDITOR", "OWNER"],
    approvalPath: ["AUDITOR 독립 감사", "OWNER 최종 수용"],
    requiredOutputDecision: "AUDIT_PASSED / AUDIT_FINDINGS / AUDIT_CRITICAL_FAILURE",
    driftRisks: [DriftVector.AUDIT_DEPTH_REDUCTION_BY_FATIGUE, DriftVector.REVIEW_CADENCE_SLIPPAGE],
    failureConsequences: ["감사 깊이 저하", "형식적 감사 반복"],
  }],
  [OperatingLoopType.REFOUNDATION_WATCH_CYCLE, {
    loopType: OperatingLoopType.REFOUNDATION_WATCH_CYCLE,
    purpose: "재건 지표를 모니터링하고 에스컬레이션 여부를 판단한다",
    inputs: ["재건 지표 값", "드리프트 추세", "구조적 갭 목록"],
    requiredArtifacts: ["재건 감시 보고서", "에스컬레이션 결정문"],
    requiredRoles: ["ADMIN", "AUDITOR", "OWNER"],
    approvalPath: ["ADMIN 분석", "AUDITOR 독립 검증", "OWNER 에스컬레이션 결정"],
    requiredOutputDecision: "WATCH_CONTINUED / REFOUNDATION_TRIGGERED / WATCH_CLOSED",
    driftRisks: [DriftVector.REFOUNDATION_SIGNAL_SUPPRESSION, DriftVector.DASHBOARD_NORMALIZATION_OF_RISK],
    failureConsequences: ["재건 신호 억압", "위험 정상화"],
  }],
]);

/**
 * 운영 루프 카탈로그를 조회한다.
 */
export function getOperatingLoopCatalog(): OperatingLoopCatalogEntry[] {
  return Array.from(operatingLoopCatalog.values());
}

/**
 * 특정 루프의 카탈로그 항목을 조회한다.
 */
export function getLoopCatalogEntry(loopType: OperatingLoopType): OperatingLoopCatalogEntry | undefined {
  return operatingLoopCatalog.get(loopType);
}

// ─────────────────────────────────────────────
// PART 3: Drift Level
// ─────────────────────────────────────────────

/** 드리프트 수준 */
export type DriftLevel =
  | "DRIFT_LOW"
  | "DRIFT_FORMING"
  | "DRIFT_ACTIVE"
  | "CONSTITUTIONAL_EROSION_RISK"
  | "REFOUNDATION_PRESSURE_INCREASING";

// ─────────────────────────────────────────────
// PART 4: Drift Detection Signals
// ─────────────────────────────────────────────

/** 드리프트 탐지 신호 */
export interface DriftSignals {
  /** 반복 carry-forward 횟수 */
  repeatedCarryForwardCount: number;
  /** stale 산출물 경과 일수 */
  staleArtifactAgeDays: number;
  /** 예외 연장 횟수 */
  exceptionExtensionCount: number;
  /** 개정 누적 의미론적 변화량 */
  amendmentCumulativeSemanticDelta: number;
  /** 미해결 의무 경과 일수 */
  unresolvedObligationAgeDays: number;
  /** 대시보드 경고 지속 일수 */
  dashboardWarningPersistenceDays: number;
  /** 리뷰 지연 추세 (일) */
  reviewDelayTrendDays: number;
  /** 감사 깊이 편차 */
  auditDepthVariance: number;
  /** 일몰 백로그 증가율 */
  sunsetBacklogGrowthRate: number;
  /** 목적 언어 발산 점수 */
  purposeLanguageDivergenceScore: number;
  /** 신선 증거 없는 갱신 횟수 */
  renewalWithoutFreshEvidenceCount: number;
}

/**
 * 드리프트 신호로부터 드리프트 수준을 계산한다.
 * 임계값 기반 다단계 판정 — 하나라도 상위 수준에 해당하면 상향 판정.
 */
export function calculateDriftLevel(signals: DriftSignals): DriftLevel {
  // REFOUNDATION_PRESSURE_INCREASING 임계값
  if (
    signals.repeatedCarryForwardCount >= 8 ||
    signals.amendmentCumulativeSemanticDelta >= 0.8 ||
    signals.unresolvedObligationAgeDays >= 180 ||
    signals.purposeLanguageDivergenceScore >= 0.7 ||
    signals.renewalWithoutFreshEvidenceCount >= 6
  ) {
    return "REFOUNDATION_PRESSURE_INCREASING";
  }

  // CONSTITUTIONAL_EROSION_RISK 임계값
  if (
    signals.repeatedCarryForwardCount >= 5 ||
    signals.staleArtifactAgeDays >= 120 ||
    signals.exceptionExtensionCount >= 5 ||
    signals.amendmentCumulativeSemanticDelta >= 0.6 ||
    signals.unresolvedObligationAgeDays >= 120 ||
    signals.dashboardWarningPersistenceDays >= 60 ||
    signals.purposeLanguageDivergenceScore >= 0.5
  ) {
    return "CONSTITUTIONAL_EROSION_RISK";
  }

  // DRIFT_ACTIVE 임계값
  if (
    signals.repeatedCarryForwardCount >= 3 ||
    signals.staleArtifactAgeDays >= 60 ||
    signals.exceptionExtensionCount >= 3 ||
    signals.amendmentCumulativeSemanticDelta >= 0.4 ||
    signals.unresolvedObligationAgeDays >= 60 ||
    signals.dashboardWarningPersistenceDays >= 30 ||
    signals.reviewDelayTrendDays >= 14 ||
    signals.auditDepthVariance >= 0.4 ||
    signals.sunsetBacklogGrowthRate >= 0.3
  ) {
    return "DRIFT_ACTIVE";
  }

  // DRIFT_FORMING 임계값
  if (
    signals.repeatedCarryForwardCount >= 1 ||
    signals.staleArtifactAgeDays >= 30 ||
    signals.exceptionExtensionCount >= 1 ||
    signals.amendmentCumulativeSemanticDelta >= 0.2 ||
    signals.unresolvedObligationAgeDays >= 30 ||
    signals.dashboardWarningPersistenceDays >= 14 ||
    signals.reviewDelayTrendDays >= 7 ||
    signals.auditDepthVariance >= 0.2 ||
    signals.sunsetBacklogGrowthRate >= 0.1 ||
    signals.purposeLanguageDivergenceScore >= 0.15 ||
    signals.renewalWithoutFreshEvidenceCount >= 1
  ) {
    return "DRIFT_FORMING";
  }

  return "DRIFT_LOW";
}

// ─────────────────────────────────────────────
// PART 5: 8 Slow Erosion Scenarios
// ─────────────────────────────────────────────

/** 침식 시나리오 결과 */
export interface ErosionScenarioResult {
  /** 시나리오 ID */
  scenarioId: string;
  /** 시나리오 이름 */
  name: string;
  /** 시나리오 설명 */
  description: string;
  /** 드리프트 신호 */
  driftSignals: DriftSignals;
  /** 드리프트 수준 */
  driftLevel: DriftLevel;
  /** 탐지 여부 */
  detected: boolean;
  /** 강화 필요 여부 */
  hardeningRequired: boolean;
}

/** 기본(비활성) 드리프트 신호를 생성한다 */
function createBaselineSignals(): DriftSignals {
  return {
    repeatedCarryForwardCount: 0,
    staleArtifactAgeDays: 0,
    exceptionExtensionCount: 0,
    amendmentCumulativeSemanticDelta: 0,
    unresolvedObligationAgeDays: 0,
    dashboardWarningPersistenceDays: 0,
    reviewDelayTrendDays: 0,
    auditDepthVariance: 0,
    sunsetBacklogGrowthRate: 0,
    purposeLanguageDivergenceScore: 0,
    renewalWithoutFreshEvidenceCount: 0,
  };
}

/**
 * 시나리오 A: stale 갱신 carry-forward.
 * 신선 증거 없이 이전 갱신 결과를 그대로 이월하는 패턴.
 */
function simulateStaleRenewalCarryForward(): ErosionScenarioResult {
  const signals: DriftSignals = {
    ...createBaselineSignals(),
    repeatedCarryForwardCount: 5,
    staleArtifactAgeDays: 90,
    renewalWithoutFreshEvidenceCount: 4,
  };
  const driftLevel = calculateDriftLevel(signals);
  return {
    scenarioId: "EROSION-A",
    name: "Stale Renewal Carry-Forward",
    description: "신선 증거 없이 이전 갱신 결과를 반복 이월하여 stale 자산이 무기한 존속하는 시나리오",
    driftSignals: signals,
    driftLevel,
    detected: driftLevel !== "DRIFT_LOW",
    hardeningRequired: driftLevel === "CONSTITUTIONAL_EROSION_RISK" || driftLevel === "REFOUNDATION_PRESSURE_INCREASING",
  };
}

/**
 * 시나리오 B: 반복 임시 예외.
 * 임시 예외가 반복 연장되어 사실상 정규화되는 패턴.
 */
function simulateRepeatedTemporaryException(): ErosionScenarioResult {
  const signals: DriftSignals = {
    ...createBaselineSignals(),
    exceptionExtensionCount: 6,
    dashboardWarningPersistenceDays: 45,
  };
  const driftLevel = calculateDriftLevel(signals);
  return {
    scenarioId: "EROSION-B",
    name: "Repeated Temporary Exception",
    description: "임시 예외가 6회 이상 연장되어 사실상 영구 예외로 정규화되는 시나리오",
    driftSignals: signals,
    driftLevel,
    detected: driftLevel !== "DRIFT_LOW",
    hardeningRequired: driftLevel === "CONSTITUTIONAL_EROSION_RISK" || driftLevel === "REFOUNDATION_PRESSURE_INCREASING",
  };
}

/**
 * 시나리오 C: 개정 범위 확대.
 * 소규모 개정이 누적되어 원래 범위를 크게 초과하는 패턴.
 */
function simulateAmendmentScopeBroadening(): ErosionScenarioResult {
  const signals: DriftSignals = {
    ...createBaselineSignals(),
    amendmentCumulativeSemanticDelta: 0.65,
    purposeLanguageDivergenceScore: 0.3,
  };
  const driftLevel = calculateDriftLevel(signals);
  return {
    scenarioId: "EROSION-C",
    name: "Amendment Scope Broadening",
    description: "소규모 개정이 누적되어 의미론적 범위가 원래 헌장 의도를 초과하는 시나리오",
    driftSignals: signals,
    driftLevel,
    detected: driftLevel !== "DRIFT_LOW",
    hardeningRequired: driftLevel === "CONSTITUTIONAL_EROSION_RISK" || driftLevel === "REFOUNDATION_PRESSURE_INCREASING",
  };
}

/**
 * 시나리오 D: 대시보드 정상화.
 * 경고가 장기간 지속되어 정상으로 인식되는 패턴.
 */
function simulateDashboardNormalization(): ErosionScenarioResult {
  const signals: DriftSignals = {
    ...createBaselineSignals(),
    dashboardWarningPersistenceDays: 75,
    auditDepthVariance: 0.5,
    reviewDelayTrendDays: 10,
  };
  const driftLevel = calculateDriftLevel(signals);
  return {
    scenarioId: "EROSION-D",
    name: "Dashboard Normalization",
    description: "대시보드 경고가 75일 이상 지속되어 운영자가 위험을 정상으로 인식하는 시나리오",
    driftSignals: signals,
    driftLevel,
    detected: driftLevel !== "DRIFT_LOW",
    hardeningRequired: driftLevel === "CONSTITUTIONAL_EROSION_RISK" || driftLevel === "REFOUNDATION_PRESSURE_INCREASING",
  };
}

/**
 * 시나리오 E: 의무 쇠퇴.
 * 영구 의무의 이행이 점진적으로 지연·누락되는 패턴.
 */
function simulateObligationDecay(): ErosionScenarioResult {
  const signals: DriftSignals = {
    ...createBaselineSignals(),
    unresolvedObligationAgeDays: 130,
    dashboardWarningPersistenceDays: 40,
  };
  const driftLevel = calculateDriftLevel(signals);
  return {
    scenarioId: "EROSION-E",
    name: "Obligation Decay",
    description: "영구 의무 이행이 130일 이상 지연되어 연속성이 붕괴되는 시나리오",
    driftSignals: signals,
    driftLevel,
    detected: driftLevel !== "DRIFT_LOW",
    hardeningRequired: driftLevel === "CONSTITUTIONAL_EROSION_RISK" || driftLevel === "REFOUNDATION_PRESSURE_INCREASING",
  };
}

/**
 * 시나리오 F: 일몰 회피.
 * 일몰 대상 컴포넌트의 제거가 반복 연기되는 패턴.
 */
function simulateSunsetAvoidance(): ErosionScenarioResult {
  const signals: DriftSignals = {
    ...createBaselineSignals(),
    sunsetBacklogGrowthRate: 0.45,
    reviewDelayTrendDays: 21,
  };
  const driftLevel = calculateDriftLevel(signals);
  return {
    scenarioId: "EROSION-F",
    name: "Sunset Avoidance",
    description: "일몰 대상이 반복 연기되어 레거시 복잡도가 누적되는 시나리오",
    driftSignals: signals,
    driftLevel,
    detected: driftLevel !== "DRIFT_LOW",
    hardeningRequired: driftLevel === "CONSTITUTIONAL_EROSION_RISK" || driftLevel === "REFOUNDATION_PRESSURE_INCREASING",
  };
}

/**
 * 시나리오 G: 목적 재해석.
 * 시스템 목적이 점진적으로 재해석되어 원래 의도에서 벗어나는 패턴.
 */
function simulatePurposeReinterpretation(): ErosionScenarioResult {
  const signals: DriftSignals = {
    ...createBaselineSignals(),
    purposeLanguageDivergenceScore: 0.55,
    amendmentCumulativeSemanticDelta: 0.35,
  };
  const driftLevel = calculateDriftLevel(signals);
  return {
    scenarioId: "EROSION-G",
    name: "Purpose Reinterpretation",
    description: "시스템 목적이 점진적으로 재해석되어 원래 공익 의도에서 벗어나는 시나리오",
    driftSignals: signals,
    driftLevel,
    detected: driftLevel !== "DRIFT_LOW",
    hardeningRequired: driftLevel === "CONSTITUTIONAL_EROSION_RISK" || driftLevel === "REFOUNDATION_PRESSURE_INCREASING",
  };
}

/**
 * 시나리오 H: 리뷰 피로.
 * 리뷰가 형식적으로 반복되어 실질적 심의가 사라지는 패턴.
 */
function simulateReviewFatigue(): ErosionScenarioResult {
  const signals: DriftSignals = {
    ...createBaselineSignals(),
    reviewDelayTrendDays: 18,
    auditDepthVariance: 0.6,
    repeatedCarryForwardCount: 4,
  };
  const driftLevel = calculateDriftLevel(signals);
  return {
    scenarioId: "EROSION-H",
    name: "Review Fatigue",
    description: "리뷰가 형식적으로 반복되어 감사 깊이가 저하되고 실질적 심의가 소멸하는 시나리오",
    driftSignals: signals,
    driftLevel,
    detected: driftLevel !== "DRIFT_LOW",
    hardeningRequired: driftLevel === "CONSTITUTIONAL_EROSION_RISK" || driftLevel === "REFOUNDATION_PRESSURE_INCREASING",
  };
}

/**
 * 8개 침식 시나리오를 모두 실행한다.
 */
export function runAllErosionScenarios(): ErosionScenarioResult[] {
  return [
    simulateStaleRenewalCarryForward(),
    simulateRepeatedTemporaryException(),
    simulateAmendmentScopeBroadening(),
    simulateDashboardNormalization(),
    simulateObligationDecay(),
    simulateSunsetAvoidance(),
    simulatePurposeReinterpretation(),
    simulateReviewFatigue(),
  ];
}

// ─────────────────────────────────────────────
// PART 6: Renewal Integrity Verification
// ─────────────────────────────────────────────

/** 갱신 판정 */
export type RenewalVerdict =
  | "VALID_RENEWAL"
  | "VALID_RENEWAL_WITH_TIGHTENING"
  | "INVALID_RENEWAL_STALE_EVIDENCE"
  | "INVALID_RENEWAL_HIDDEN_SCOPE_CHANGE"
  | "INVALID_RENEWAL_WITHOUT_OBLIGATION_CHECK"
  | "INVALID_RENEWAL_REQUIRES_DOWNGRADE";

/** 갱신 무결성 검증 결과 */
export interface RenewalIntegrityResult {
  /** 갱신 ID */
  renewalId: string;
  /** 판정 */
  verdict: RenewalVerdict;
  /** 판정 사유 */
  reasons: string[];
  /** 검증 시각 */
  verifiedAt: Date;
  /** 권고 조치 */
  recommendedActions: string[];
}

/**
 * 갱신 무결성을 검증한다.
 * 신선 증거 없는 갱신은 invalid로 판정한다.
 */
export function verifyRenewalIntegrity(params: {
  renewalId: string;
  hasFreshEvidence: boolean;
  evidenceAgeDays: number;
  scopeChangedSinceLastRenewal: boolean;
  scopeChangeMagnitude: number;
  obligationCheckPerformed: boolean;
  previousRenewalCount: number;
  carryForwardCount: number;
}): RenewalIntegrityResult {
  const reasons: string[] = [];
  const recommendedActions: string[] = [];
  let verdict: RenewalVerdict = "VALID_RENEWAL";

  // 신선 증거 부재 검증
  if (!params.hasFreshEvidence || params.evidenceAgeDays > 90) {
    verdict = "INVALID_RENEWAL_STALE_EVIDENCE";
    reasons.push(`신선 증거 부재 — 증거 경과 일수: ${params.evidenceAgeDays}일`);
    recommendedActions.push("신선 증거 수집 후 재심의 필요");
  }

  // 숨겨진 범위 변경 검증
  if (params.scopeChangedSinceLastRenewal && params.scopeChangeMagnitude > 0.3) {
    verdict = "INVALID_RENEWAL_HIDDEN_SCOPE_CHANGE";
    reasons.push(`숨겨진 범위 변경 탐지 — 변경량: ${(params.scopeChangeMagnitude * 100).toFixed(1)}%`);
    recommendedActions.push("범위 변경에 대한 별도 개정 심의 필요");
  }

  // 의무 점검 미수행 검증
  if (!params.obligationCheckPerformed) {
    if (verdict === "VALID_RENEWAL") {
      verdict = "INVALID_RENEWAL_WITHOUT_OBLIGATION_CHECK";
    }
    reasons.push("의무 이행 점검 미수행");
    recommendedActions.push("관련 의무 이행 상태 확인 후 재심의");
  }

  // carry-forward 누적 검증
  if (params.carryForwardCount >= 3) {
    if (verdict === "VALID_RENEWAL") {
      verdict = "INVALID_RENEWAL_REQUIRES_DOWNGRADE";
    }
    reasons.push(`carry-forward ${params.carryForwardCount}회 누적 — 강등 필요`);
    recommendedActions.push("자산 신뢰 등급 강등 후 재평가");
  }

  // 유효하지만 강화 필요한 경우
  if (verdict === "VALID_RENEWAL" && (params.carryForwardCount >= 1 || params.scopeChangeMagnitude > 0.1)) {
    verdict = "VALID_RENEWAL_WITH_TIGHTENING";
    reasons.push("유효하나 강화 필요 — carry-forward 이력 또는 미세 범위 변경 존재");
    recommendedActions.push("다음 갱신 시 증거 요건 강화");
  }

  if (verdict === "VALID_RENEWAL") {
    reasons.push("모든 검증 통과");
  }

  return {
    renewalId: params.renewalId,
    verdict,
    reasons,
    verifiedAt: new Date(),
    recommendedActions,
  };
}

// ─────────────────────────────────────────────
// PART 7: Amendment Accumulation Analysis
// ─────────────────────────────────────────────

/** 개정 누적 판정 */
export type AmendmentAccumulationVerdict =
  | "CUMULATIVE_IMPACT_ACCEPTABLE"
  | "IMPACT_REVIEW_REQUIRED"
  | "SEMANTIC_SCOPE_CREEP_DETECTED"
  | "AMENDMENT_FREEZE_RECOMMENDED";

/** 개정 누적 분석 결과 */
export interface AmendmentAccumulationResult {
  /** 분석 ID */
  analysisId: string;
  /** 판정 */
  verdict: AmendmentAccumulationVerdict;
  /** 누적 의미론적 변화량 */
  cumulativeSemanticDelta: number;
  /** 범위 확장 비율 */
  scopeExpansionRatio: number;
  /** 개정 횟수 */
  amendmentCount: number;
  /** 분석 사유 */
  reasons: string[];
  /** 권고 조치 */
  recommendedActions: string[];
  /** 분석 시각 */
  analyzedAt: Date;
}

/**
 * 개정 누적 영향을 분석한다.
 * 소규모 개정이 누적되어 원래 범위를 초과하는지 탐지한다.
 */
export function analyzeAmendmentAccumulation(params: {
  amendments: Array<{
    amendmentId: string;
    semanticDelta: number;
    scopeExpansion: number;
    timestamp: Date;
  }>;
  originalScopeBaseline: number;
  maxAcceptableDelta: number;
  scopeCreepThreshold: number;
}): AmendmentAccumulationResult {
  const { amendments, originalScopeBaseline, maxAcceptableDelta, scopeCreepThreshold } = params;

  const cumulativeSemanticDelta = amendments.reduce(
    (sum, a) => sum + a.semanticDelta, 0
  );
  const totalScopeExpansion = amendments.reduce(
    (sum, a) => sum + a.scopeExpansion, 0
  );
  const scopeExpansionRatio = originalScopeBaseline > 0
    ? totalScopeExpansion / originalScopeBaseline
    : 0;

  const reasons: string[] = [];
  const recommendedActions: string[] = [];
  let verdict: AmendmentAccumulationVerdict = "CUMULATIVE_IMPACT_ACCEPTABLE";

  // 개정 동결 권고 임계값
  if (cumulativeSemanticDelta >= maxAcceptableDelta * 1.5 || scopeExpansionRatio >= scopeCreepThreshold * 1.5) {
    verdict = "AMENDMENT_FREEZE_RECOMMENDED";
    reasons.push(`누적 변화량(${cumulativeSemanticDelta.toFixed(3)})이 동결 임계값 초과`);
    reasons.push(`범위 확장 비율(${(scopeExpansionRatio * 100).toFixed(1)}%)이 동결 임계값 초과`);
    recommendedActions.push("개정 동결 후 전체 영향 평가 수행");
    recommendedActions.push("헌장 재기준선(re-baseline) 검토");
  }
  // 범위 확장 탐지 임계값
  else if (scopeExpansionRatio >= scopeCreepThreshold) {
    verdict = "SEMANTIC_SCOPE_CREEP_DETECTED";
    reasons.push(`범위 확장 비율(${(scopeExpansionRatio * 100).toFixed(1)}%)이 임계값(${(scopeCreepThreshold * 100).toFixed(1)}%) 초과`);
    recommendedActions.push("범위 확장 원인 분석 및 제한 조치");
  }
  // 영향 검토 필요 임계값
  else if (cumulativeSemanticDelta >= maxAcceptableDelta) {
    verdict = "IMPACT_REVIEW_REQUIRED";
    reasons.push(`누적 의미론적 변화량(${cumulativeSemanticDelta.toFixed(3)})이 임계값(${maxAcceptableDelta}) 초과`);
    recommendedActions.push("누적 영향 심의 수행");
  } else {
    reasons.push("누적 영향 수용 가능 범위 내");
  }

  return {
    analysisId: `AMA-${Date.now()}`,
    verdict,
    cumulativeSemanticDelta,
    scopeExpansionRatio,
    amendmentCount: amendments.length,
    reasons,
    recommendedActions,
    analyzedAt: new Date(),
  };
}

// ─────────────────────────────────────────────
// PART 8: Obligation Continuity Pressure
// ─────────────────────────────────────────────

/** 의무 연속성 판정 */
export type ObligationContinuityVerdict =
  | "OBLIGATION_HEALTHY"
  | "OBLIGATION_DELAYED"
  | "OBLIGATION_BACKLOG_RISK"
  | "OBLIGATION_CONTINUITY_FAILURE";

/** 의무 연속성 평가 결과 */
export interface ObligationContinuityResult {
  /** 평가 ID */
  assessmentId: string;
  /** 판정 */
  verdict: ObligationContinuityVerdict;
  /** 총 의무 수 */
  totalObligations: number;
  /** 이행된 의무 수 */
  fulfilledCount: number;
  /** 지연된 의무 수 */
  delayedCount: number;
  /** 최대 미이행 경과 일수 */
  maxUnresolvedAgeDays: number;
  /** 평가 사유 */
  reasons: string[];
  /** 권고 조치 */
  recommendedActions: string[];
  /** 평가 시각 */
  assessedAt: Date;
}

/**
 * 의무 연속성 압력을 평가한다.
 */
export function assessObligationContinuity(params: {
  obligations: Array<{
    obligationId: string;
    fulfilled: boolean;
    lastFulfilledAt: Date | null;
    dueDays: number;
    unresolvedDays: number;
  }>;
}): ObligationContinuityResult {
  const { obligations } = params;
  const totalObligations = obligations.length;
  const fulfilledCount = obligations.filter((o) => o.fulfilled).length;
  const delayedObligations = obligations.filter((o) => !o.fulfilled && o.unresolvedDays > o.dueDays);
  const delayedCount = delayedObligations.length;
  const maxUnresolvedAgeDays = obligations.reduce(
    (max, o) => Math.max(max, o.unresolvedDays), 0
  );

  const reasons: string[] = [];
  const recommendedActions: string[] = [];
  let verdict: ObligationContinuityVerdict = "OBLIGATION_HEALTHY";

  const delayRatio = totalObligations > 0 ? delayedCount / totalObligations : 0;

  if (maxUnresolvedAgeDays >= 120 || delayRatio >= 0.5) {
    verdict = "OBLIGATION_CONTINUITY_FAILURE";
    reasons.push(`의무 연속성 실패 — 최대 미이행 ${maxUnresolvedAgeDays}일, 지연 비율 ${(delayRatio * 100).toFixed(1)}%`);
    recommendedActions.push("긴급 의무 이행 복구 계획 수립");
    recommendedActions.push("refoundation watch 에스컬레이션 검토");
  } else if (maxUnresolvedAgeDays >= 60 || delayRatio >= 0.3) {
    verdict = "OBLIGATION_BACKLOG_RISK";
    reasons.push(`의무 백로그 위험 — 최대 미이행 ${maxUnresolvedAgeDays}일, 지연 비율 ${(delayRatio * 100).toFixed(1)}%`);
    recommendedActions.push("의무 백로그 해소 계획 수립");
  } else if (delayedCount > 0) {
    verdict = "OBLIGATION_DELAYED";
    reasons.push(`의무 지연 ${delayedCount}건 — 최대 미이행 ${maxUnresolvedAgeDays}일`);
    recommendedActions.push("지연 의무 우선 이행");
  } else {
    reasons.push("모든 의무 정상 이행 중");
  }

  return {
    assessmentId: `OCA-${Date.now()}`,
    verdict,
    totalObligations,
    fulfilledCount,
    delayedCount,
    maxUnresolvedAgeDays,
    reasons,
    recommendedActions,
    assessedAt: new Date(),
  };
}

// ─────────────────────────────────────────────
// PART 9: Purpose Lock Stress Test
// ─────────────────────────────────────────────

/** 목적 잠금 판정 */
export type PurposeLockVerdict =
  | "PURPOSE_LOCK_HELD"
  | "PURPOSE_DRIFT_BLOCKED"
  | "PURPOSE_DRIFT_MISSED"
  | "PURPOSE_RESTORATION_REQUIRED";

/** 목적 압력 유형 */
export type PurposePressureType =
  | "COMMERCIAL_EXPANSION"
  | "SCOPE_REINTERPRETATION"
  | "OBLIGATION_REDUCTION"
  | "MISSION_DILUTION"
  | "STAKEHOLDER_PRESSURE";

/** 목적 잠금 스트레스 테스트 시나리오 */
export interface PurposePressureScenario {
  /** 압력 유형 */
  pressureType: PurposePressureType;
  /** 압력 설명 */
  description: string;
  /** 목적 언어 발산 점수 */
  divergenceScore: number;
  /** 의무 축소 시도 여부 */
  obligationReductionAttempted: boolean;
  /** 상업적 확장 시도 여부 */
  commercialExpansionAttempted: boolean;
}

/** 목적 잠금 스트레스 테스트 결과 */
export interface PurposeLockTestResult {
  /** 테스트 ID */
  testId: string;
  /** 전체 판정 */
  verdict: PurposeLockVerdict;
  /** 시나리오별 결과 */
  scenarioResults: Array<{
    pressureType: PurposePressureType;
    blocked: boolean;
    divergenceScore: number;
    detail: string;
  }>;
  /** 테스트 시각 */
  testedAt: Date;
  /** 권고 조치 */
  recommendedActions: string[];
}

/**
 * 목적 잠금 스트레스 테스트를 수행한다.
 * 5가지 목적 압력에 대해 잠금이 유지되는지 검증한다.
 */
export function stressTestPurposeLock(scenarios: PurposePressureScenario[]): PurposeLockTestResult {
  const scenarioResults: PurposeLockTestResult["scenarioResults"] = [];
  const recommendedActions: string[] = [];
  let anyMissed = false;
  let anyBlocked = false;
  let maxDivergence = 0;

  for (const scenario of scenarios) {
    const blocked = scenario.divergenceScore < 0.4 ||
      (!scenario.obligationReductionAttempted && !scenario.commercialExpansionAttempted);
    const isMissed = scenario.divergenceScore >= 0.4 && !blocked;

    if (isMissed) anyMissed = true;
    if (blocked && scenario.divergenceScore >= 0.2) anyBlocked = true;
    if (scenario.divergenceScore > maxDivergence) maxDivergence = scenario.divergenceScore;

    scenarioResults.push({
      pressureType: scenario.pressureType,
      blocked,
      divergenceScore: scenario.divergenceScore,
      detail: blocked
        ? `${scenario.pressureType} 압력 차단 완료`
        : `${scenario.pressureType} 압력이 목적 잠금을 침식 — 발산 점수: ${scenario.divergenceScore.toFixed(2)}`,
    });
  }

  let verdict: PurposeLockVerdict;
  if (anyMissed && maxDivergence >= 0.6) {
    verdict = "PURPOSE_RESTORATION_REQUIRED";
    recommendedActions.push("목적 원문 복원 및 재확인 절차 필요");
    recommendedActions.push("모든 파생 문서의 목적 정합성 재검증");
  } else if (anyMissed) {
    verdict = "PURPOSE_DRIFT_MISSED";
    recommendedActions.push("목적 드리프트 탐지 강화 필요");
  } else if (anyBlocked) {
    verdict = "PURPOSE_DRIFT_BLOCKED";
    recommendedActions.push("차단 성공 — 정기 모니터링 지속");
  } else {
    verdict = "PURPOSE_LOCK_HELD";
  }

  return {
    testId: `PLT-${Date.now()}`,
    verdict,
    scenarioResults,
    testedAt: new Date(),
    recommendedActions,
  };
}

// ─────────────────────────────────────────────
// PART 10: Review Fatigue / Ritualization
// ─────────────────────────────────────────────

/** 리뷰 실질성 판정 */
export type ReviewSubstanceVerdict =
  | "REVIEW_SUBSTANTIVE"
  | "REVIEW_RITUALIZING"
  | "GOVERNANCE_FORMALITY_RISK"
  | "SUBSTANCE_RESTORATION_REQUIRED";

/** 리뷰 실질성 평가 결과 */
export interface ReviewSubstanceResult {
  /** 평가 ID */
  assessmentId: string;
  /** 판정 */
  verdict: ReviewSubstanceVerdict;
  /** 평균 리뷰 소요 시간 (분) */
  averageReviewDurationMinutes: number;
  /** 리뷰 소요 시간 추세 (감소율) */
  durationDeclineTrend: number;
  /** 리뷰 질문/이의 제기 비율 */
  challengeRate: number;
  /** 변경 요청 비율 */
  changeRequestRate: number;
  /** 평가 사유 */
  reasons: string[];
  /** 권고 조치 */
  recommendedActions: string[];
  /** 평가 시각 */
  assessedAt: Date;
}

/**
 * 리뷰 실질성을 평가한다.
 * 리뷰가 형식적으로 변질되는지 탐지한다.
 */
export function assessReviewSubstance(params: {
  reviewDurationsMinutes: number[];
  challengeEvents: number;
  totalReviews: number;
  changeRequestCount: number;
  reviewDelayTrendDays: number;
  auditDepthVariance: number;
}): ReviewSubstanceResult {
  const { reviewDurationsMinutes, challengeEvents, totalReviews, changeRequestCount } = params;

  const averageReviewDurationMinutes = reviewDurationsMinutes.length > 0
    ? reviewDurationsMinutes.reduce((sum, d) => sum + d, 0) / reviewDurationsMinutes.length
    : 0;

  // 소요 시간 감소 추세 (첫 절반 vs 마지막 절반)
  let durationDeclineTrend = 0;
  if (reviewDurationsMinutes.length >= 4) {
    const mid = Math.floor(reviewDurationsMinutes.length / 2);
    const firstHalfAvg = reviewDurationsMinutes.slice(0, mid).reduce((s, d) => s + d, 0) / mid;
    const secondHalfAvg = reviewDurationsMinutes.slice(mid).reduce((s, d) => s + d, 0) / (reviewDurationsMinutes.length - mid);
    durationDeclineTrend = firstHalfAvg > 0 ? (firstHalfAvg - secondHalfAvg) / firstHalfAvg : 0;
  }

  const challengeRate = totalReviews > 0 ? challengeEvents / totalReviews : 0;
  const changeRequestRate = totalReviews > 0 ? changeRequestCount / totalReviews : 0;

  const reasons: string[] = [];
  const recommendedActions: string[] = [];
  let verdict: ReviewSubstanceVerdict = "REVIEW_SUBSTANTIVE";

  // 실질 복원 필요
  if (
    (durationDeclineTrend >= 0.6 && challengeRate < 0.05) ||
    (averageReviewDurationMinutes < 5 && changeRequestRate < 0.05)
  ) {
    verdict = "SUBSTANCE_RESTORATION_REQUIRED";
    reasons.push(`리뷰 소요 시간 ${(durationDeclineTrend * 100).toFixed(0)}% 감소, 이의 제기율 ${(challengeRate * 100).toFixed(1)}%`);
    recommendedActions.push("리뷰 프로세스 재설계 — 필수 체크리스트 도입");
    recommendedActions.push("독립 감사관의 리뷰 품질 모니터링 시작");
  }
  // 거버넌스 형식화 위험
  else if (durationDeclineTrend >= 0.4 || (challengeRate < 0.1 && totalReviews >= 10)) {
    verdict = "GOVERNANCE_FORMALITY_RISK";
    reasons.push(`거버넌스 형식화 위험 — 소요 시간 감소 ${(durationDeclineTrend * 100).toFixed(0)}%, 이의 제기율 ${(challengeRate * 100).toFixed(1)}%`);
    recommendedActions.push("리뷰 품질 지표 강화");
  }
  // 의례화 진행 중
  else if (durationDeclineTrend >= 0.2 || changeRequestRate < 0.1) {
    verdict = "REVIEW_RITUALIZING";
    reasons.push(`리뷰 의례화 경향 — 소요 시간 감소 ${(durationDeclineTrend * 100).toFixed(0)}%`);
    recommendedActions.push("리뷰 참여자 다양화 검토");
  } else {
    reasons.push("리뷰 실질성 유지됨");
  }

  return {
    assessmentId: `RSA-${Date.now()}`,
    verdict,
    averageReviewDurationMinutes,
    durationDeclineTrend,
    challengeRate,
    changeRequestRate,
    reasons,
    recommendedActions,
    assessedAt: new Date(),
  };
}

// ─────────────────────────────────────────────
// PART 11: Sunset Discipline
// ─────────────────────────────────────────────

/** 일몰 규율 판정 */
export type SunsetDisciplineVerdict =
  | "SUNSET_DISCIPLINED"
  | "SUNSET_DELAYED"
  | "LEGACY_COMPLEXITY_ACCUMULATING"
  | "MANDATORY_SUNSET_REQUIRED";

/** 일몰 규율 평가 결과 */
export interface SunsetDisciplineResult {
  /** 평가 ID */
  assessmentId: string;
  /** 판정 */
  verdict: SunsetDisciplineVerdict;
  /** 일몰 백로그 크기 */
  backlogSize: number;
  /** 평균 일몰 지연 일수 */
  averageDelayDays: number;
  /** 백로그 증가율 */
  backlogGrowthRate: number;
  /** 레거시 의존성 수 */
  legacyDependencyCount: number;
  /** 평가 사유 */
  reasons: string[];
  /** 권고 조치 */
  recommendedActions: string[];
  /** 평가 시각 */
  assessedAt: Date;
}

/**
 * 일몰 규율을 평가한다.
 */
export function assessSunsetDiscipline(params: {
  sunsetCandidates: Array<{
    candidateId: string;
    scheduledDate: Date;
    actualDate: Date | null;
    deferralCount: number;
    dependencyCount: number;
  }>;
  recentlyCompleted: number;
  totalActive: number;
}): SunsetDisciplineResult {
  const { sunsetCandidates, recentlyCompleted, totalActive } = params;

  const backlogSize = sunsetCandidates.filter((c) => c.actualDate === null).length;
  const delayedCandidates = sunsetCandidates.filter((c) => c.deferralCount > 0);
  const averageDelayDays = delayedCandidates.length > 0
    ? delayedCandidates.reduce((sum, c) => sum + c.deferralCount * 30, 0) / delayedCandidates.length
    : 0;
  const backlogGrowthRate = totalActive > 0 ? (backlogSize - recentlyCompleted) / totalActive : 0;
  const legacyDependencyCount = sunsetCandidates.reduce((sum, c) => sum + c.dependencyCount, 0);

  const reasons: string[] = [];
  const recommendedActions: string[] = [];
  let verdict: SunsetDisciplineVerdict = "SUNSET_DISCIPLINED";

  if (backlogGrowthRate >= 0.4 || averageDelayDays >= 180) {
    verdict = "MANDATORY_SUNSET_REQUIRED";
    reasons.push(`강제 일몰 필요 — 백로그 증가율: ${(backlogGrowthRate * 100).toFixed(1)}%, 평균 지연: ${averageDelayDays.toFixed(0)}일`);
    recommendedActions.push("일몰 강제 실행 일정 수립");
    recommendedActions.push("레거시 의존성 강제 해소 프로그램 시작");
  } else if (backlogGrowthRate >= 0.2 || legacyDependencyCount >= 20) {
    verdict = "LEGACY_COMPLEXITY_ACCUMULATING";
    reasons.push(`레거시 복잡도 누적 — 의존성: ${legacyDependencyCount}건, 백로그 증가율: ${(backlogGrowthRate * 100).toFixed(1)}%`);
    recommendedActions.push("레거시 의존성 해소 계획 수립");
  } else if (backlogSize > 0 || delayedCandidates.length > 0) {
    verdict = "SUNSET_DELAYED";
    reasons.push(`일몰 지연 — 백로그: ${backlogSize}건, 연기: ${delayedCandidates.length}건`);
    recommendedActions.push("일몰 백로그 우선순위 재정렬");
  } else {
    reasons.push("일몰 규율 정상 유지");
  }

  return {
    assessmentId: `SDA-${Date.now()}`,
    verdict,
    backlogSize,
    averageDelayDays,
    backlogGrowthRate,
    legacyDependencyCount,
    reasons,
    recommendedActions,
    assessedAt: new Date(),
  };
}

// ─────────────────────────────────────────────
// PART 12: Operating Loop Scorecard
// ─────────────────────────────────────────────

/** 운영 루프 판정 */
export type OperatingLoopVerdict =
  | "LOOP_CONSTITUTIONALLY_SOUND"
  | "SOUND_WITH_DRIFT_WARNINGS"
  | "DRIFT_ACCUMULATING"
  | "REQUIRES_OPERATING_REALIGNMENT"
  | "REFOUNDATION_WATCH_ESCALATE";

/** 스코어카드 차원 점수 */
export interface LoopDimensionScore {
  /** 차원 이름 */
  dimension: string;
  /** 점수 (0~100) */
  score: number;
  /** 가중치 */
  weight: number;
  /** 세부 내역 */
  breakdown: string[];
}

/** 운영 루프 스코어카드 */
export interface OperatingLoopScorecard {
  /** 스코어카드 ID */
  scorecardId: string;
  /** 생성 시각 */
  generatedAt: Date;

  /** 10개 차원 점수 */
  dimensions: LoopDimensionScore[];

  /** 가중 평균 점수 */
  weightedAverage: number;
  /** 전체 판정 */
  verdict: OperatingLoopVerdict;
  /** 드리프트 경고 목록 */
  driftWarnings: string[];
  /** 강화 백로그 항목 */
  hardeningBacklog: string[];
}

/**
 * 운영 루프 스코어카드를 생성한다.
 * 10개 차원에 대해 점수를 산출하고 최종 판정을 내린다.
 */
export function generateOperatingLoopScorecard(params: {
  erosionResults: ErosionScenarioResult[];
  renewalResult: RenewalIntegrityResult;
  amendmentResult: AmendmentAccumulationResult;
  obligationResult: ObligationContinuityResult;
  purposeLockResult: PurposeLockTestResult;
  reviewResult: ReviewSubstanceResult;
  sunsetResult: SunsetDisciplineResult;
}): OperatingLoopScorecard {
  const {
    erosionResults, renewalResult, amendmentResult,
    obligationResult, purposeLockResult, reviewResult, sunsetResult,
  } = params;

  const driftWarnings: string[] = [];
  const hardeningBacklog: string[] = [];

  // 1. 갱신 무결성 점수
  const renewalScore = renewalResult.verdict === "VALID_RENEWAL" ? 100
    : renewalResult.verdict === "VALID_RENEWAL_WITH_TIGHTENING" ? 80
    : renewalResult.verdict === "INVALID_RENEWAL_STALE_EVIDENCE" ? 30
    : renewalResult.verdict === "INVALID_RENEWAL_HIDDEN_SCOPE_CHANGE" ? 20
    : renewalResult.verdict === "INVALID_RENEWAL_WITHOUT_OBLIGATION_CHECK" ? 35
    : 15;

  // 2. 개정 누적 건전성 점수
  const amendmentScore = amendmentResult.verdict === "CUMULATIVE_IMPACT_ACCEPTABLE" ? 100
    : amendmentResult.verdict === "IMPACT_REVIEW_REQUIRED" ? 65
    : amendmentResult.verdict === "SEMANTIC_SCOPE_CREEP_DETECTED" ? 35
    : 10;

  // 3. 의무 연속성 점수
  const obligationScore = obligationResult.verdict === "OBLIGATION_HEALTHY" ? 100
    : obligationResult.verdict === "OBLIGATION_DELAYED" ? 70
    : obligationResult.verdict === "OBLIGATION_BACKLOG_RISK" ? 40
    : 10;

  // 4. 목적 잠금 점수
  const purposeScore = purposeLockResult.verdict === "PURPOSE_LOCK_HELD" ? 100
    : purposeLockResult.verdict === "PURPOSE_DRIFT_BLOCKED" ? 85
    : purposeLockResult.verdict === "PURPOSE_DRIFT_MISSED" ? 35
    : 10;

  // 5. 리뷰 실질성 점수
  const reviewScore = reviewResult.verdict === "REVIEW_SUBSTANTIVE" ? 100
    : reviewResult.verdict === "REVIEW_RITUALIZING" ? 65
    : reviewResult.verdict === "GOVERNANCE_FORMALITY_RISK" ? 35
    : 10;

  // 6. 일몰 규율 점수
  const sunsetScore = sunsetResult.verdict === "SUNSET_DISCIPLINED" ? 100
    : sunsetResult.verdict === "SUNSET_DELAYED" ? 70
    : sunsetResult.verdict === "LEGACY_COMPLEXITY_ACCUMULATING" ? 40
    : 10;

  // 7. 침식 시나리오 탐지율
  const detectedCount = erosionResults.filter((r) => r.detected).length;
  const erosionDetectionScore = erosionResults.length > 0
    ? (detectedCount / erosionResults.length) * 100
    : 100;

  // 8. 드리프트 수준 분포 점수
  const severeCount = erosionResults.filter(
    (r) => r.driftLevel === "CONSTITUTIONAL_EROSION_RISK" || r.driftLevel === "REFOUNDATION_PRESSURE_INCREASING"
  ).length;
  const driftDistributionScore = Math.max(0, 100 - severeCount * 20);

  // 9. 강화 필요 비율 점수
  const hardeningNeeded = erosionResults.filter((r) => r.hardeningRequired).length;
  const hardeningRatioScore = Math.max(0, 100 - hardeningNeeded * 15);

  // 10. 종합 드리프트 신호 점수
  const avgDriftSignalScore = erosionResults.length > 0
    ? erosionResults.reduce((sum, r) => {
        const level = r.driftLevel;
        const score = level === "DRIFT_LOW" ? 100
          : level === "DRIFT_FORMING" ? 75
          : level === "DRIFT_ACTIVE" ? 50
          : level === "CONSTITUTIONAL_EROSION_RISK" ? 25
          : 5;
        return sum + score;
      }, 0) / erosionResults.length
    : 100;

  const dimensions: LoopDimensionScore[] = [
    { dimension: "갱신 무결성", score: renewalScore, weight: 0.15, breakdown: renewalResult.reasons },
    { dimension: "개정 누적 건전성", score: amendmentScore, weight: 0.12, breakdown: amendmentResult.reasons },
    { dimension: "의무 연속성", score: obligationScore, weight: 0.12, breakdown: obligationResult.reasons },
    { dimension: "목적 잠금 견고성", score: purposeScore, weight: 0.15, breakdown: Array.from(purposeLockResult.scenarioResults.map((s) => s.detail)) },
    { dimension: "리뷰 실질성", score: reviewScore, weight: 0.10, breakdown: reviewResult.reasons },
    { dimension: "일몰 규율", score: sunsetScore, weight: 0.08, breakdown: sunsetResult.reasons },
    { dimension: "침식 시나리오 탐지율", score: erosionDetectionScore, weight: 0.10, breakdown: [`탐지: ${detectedCount}/${erosionResults.length}`] },
    { dimension: "드리프트 수준 분포", score: driftDistributionScore, weight: 0.08, breakdown: [`심각 시나리오: ${severeCount}건`] },
    { dimension: "강화 필요 비율", score: hardeningRatioScore, weight: 0.05, breakdown: [`강화 필요: ${hardeningNeeded}건`] },
    { dimension: "종합 드리프트 신호", score: avgDriftSignalScore, weight: 0.05, breakdown: [`평균 드리프트 신호 점수: ${avgDriftSignalScore.toFixed(1)}`] },
  ];

  const weightedAverage = dimensions.reduce(
    (sum, d) => sum + d.score * d.weight, 0
  );

  // 드리프트 경고 수집
  if (renewalScore < 50) driftWarnings.push("갱신 무결성 위험");
  if (amendmentScore < 50) driftWarnings.push("개정 범위 확장 위험");
  if (obligationScore < 50) driftWarnings.push("의무 연속성 위험");
  if (purposeScore < 50) driftWarnings.push("목적 드리프트 위험");
  if (reviewScore < 50) driftWarnings.push("리뷰 형식화 위험");
  if (sunsetScore < 50) driftWarnings.push("일몰 지연 위험");

  // 강화 백로그 수집
  for (const result of erosionResults) {
    if (result.hardeningRequired) {
      hardeningBacklog.push(`${result.name}: ${result.description}`);
    }
  }
  hardeningBacklog.push(...renewalResult.recommendedActions);
  hardeningBacklog.push(...amendmentResult.recommendedActions);
  hardeningBacklog.push(...obligationResult.recommendedActions);

  // 판정
  let verdict: OperatingLoopVerdict;
  if (weightedAverage >= 90 && driftWarnings.length === 0) {
    verdict = "LOOP_CONSTITUTIONALLY_SOUND";
  } else if (weightedAverage >= 75 && severeCount === 0) {
    verdict = "SOUND_WITH_DRIFT_WARNINGS";
  } else if (weightedAverage >= 55) {
    verdict = "DRIFT_ACCUMULATING";
  } else if (weightedAverage >= 35) {
    verdict = "REQUIRES_OPERATING_REALIGNMENT";
  } else {
    verdict = "REFOUNDATION_WATCH_ESCALATE";
  }

  return {
    scorecardId: `OLS-${Date.now()}`,
    generatedAt: new Date(),
    dimensions,
    weightedAverage,
    verdict,
    driftWarnings,
    hardeningBacklog,
  };
}

// ─────────────────────────────────────────────
// PART 13: Post-Scenario Decision Matrix
// ─────────────────────────────────────────────

/** 사후 시나리오 결정 */
export type PostScenario9Decision =
  | "PROCEED_TO_SCENARIO_10"
  | "PROCEED_WITH_OPERATING_HARDENING"
  | "HOLD_FOR_RENEWAL_REALIGNMENT"
  | "ESCALATE_TO_REFOUNDATION_WATCH";

/**
 * 사후 시나리오 결정을 산출한다.
 */
export function determinePostScenario9Decision(scorecard: OperatingLoopScorecard): PostScenario9Decision {
  switch (scorecard.verdict) {
    case "LOOP_CONSTITUTIONALLY_SOUND":
      return "PROCEED_TO_SCENARIO_10";
    case "SOUND_WITH_DRIFT_WARNINGS":
      return "PROCEED_WITH_OPERATING_HARDENING";
    case "DRIFT_ACCUMULATING":
      return "HOLD_FOR_RENEWAL_REALIGNMENT";
    case "REQUIRES_OPERATING_REALIGNMENT":
      return "HOLD_FOR_RENEWAL_REALIGNMENT";
    case "REFOUNDATION_WATCH_ESCALATE":
      return "ESCALATE_TO_REFOUNDATION_WATCH";
  }
}

// ─────────────────────────────────────────────
// PART 14: Hardening Backlog Classification
// ─────────────────────────────────────────────

/** 드리프트 강화 분류 */
export enum DriftHardeningClass {
  /** 즉시 수정 필요 */
  IMMEDIATE_FIX = "IMMEDIATE_FIX",
  /** 다음 주기 내 수정 */
  NEXT_CYCLE_FIX = "NEXT_CYCLE_FIX",
  /** 구조적 개선 */
  STRUCTURAL_IMPROVEMENT = "STRUCTURAL_IMPROVEMENT",
  /** 모니터링 강화 */
  MONITORING_ENHANCEMENT = "MONITORING_ENHANCEMENT",
  /** 프로세스 재설계 */
  PROCESS_REDESIGN = "PROCESS_REDESIGN",
  /** 헌법적 수정 */
  CONSTITUTIONAL_AMENDMENT = "CONSTITUTIONAL_AMENDMENT",
}

/** 강화 백로그 항목 */
export interface DriftHardeningItem {
  /** 항목 ID */
  itemId: string;
  /** 분류 */
  hardeningClass: DriftHardeningClass;
  /** 관련 드리프트 벡터 */
  relatedDriftVector: DriftVector;
  /** 설명 */
  description: string;
  /** 우선순위 (1=최고) */
  priority: number;
  /** 예상 소요 일수 */
  estimatedDays: number;
  /** 상태 */
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  /** 생성 시각 */
  createdAt: Date;
}

/** 강화 백로그 저장소 (production: DB-backed) */
const hardeningBacklogStore: Map<string, DriftHardeningItem> = new Map();

/**
 * 강화 백로그 항목을 추가한다.
 */
export function addHardeningItem(item: Omit<DriftHardeningItem, "itemId" | "createdAt" | "status">): DriftHardeningItem {
  const entry: DriftHardeningItem = {
    ...item,
    itemId: `DHI-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    status: "OPEN",
    createdAt: new Date(),
  };
  hardeningBacklogStore.set(entry.itemId, entry);
  return entry;
}

/**
 * 강화 백로그를 조회한다.
 */
export function getHardeningBacklog(): DriftHardeningItem[] {
  return Array.from(hardeningBacklogStore.values())
    .sort((a, b) => a.priority - b.priority);
}

/**
 * 침식 시나리오 결과로부터 강화 백로그를 생성한다.
 */
export function generateHardeningBacklogFromErosion(
  erosionResults: ErosionScenarioResult[]
): DriftHardeningItem[] {
  const items: DriftHardeningItem[] = [];

  for (const result of erosionResults) {
    if (!result.hardeningRequired) continue;

    const driftVector = mapScenarioToDriftVector(result.scenarioId);
    const hardeningClass = mapDriftLevelToHardeningClass(result.driftLevel);
    const priority = mapDriftLevelToPriority(result.driftLevel);

    const item = addHardeningItem({
      hardeningClass,
      relatedDriftVector: driftVector,
      description: `${result.name}: ${result.description}`,
      priority,
      estimatedDays: mapHardeningClassToDays(hardeningClass),
    });
    items.push(item);
  }

  return items;
}

function mapScenarioToDriftVector(scenarioId: string): DriftVector {
  const mapping: Record<string, DriftVector> = {
    "EROSION-A": DriftVector.STALE_RENEWAL_ACCEPTANCE,
    "EROSION-B": DriftVector.TEMPORARY_EXCEPTION_NORMALIZATION,
    "EROSION-C": DriftVector.AMENDMENT_SCOPE_CREEP,
    "EROSION-D": DriftVector.DASHBOARD_NORMALIZATION_OF_RISK,
    "EROSION-E": DriftVector.OBLIGATION_CONTINUITY_DECAY,
    "EROSION-F": DriftVector.SUNSET_DELAY_ACCUMULATION,
    "EROSION-G": DriftVector.PURPOSE_REINTERPRETATION_DRIFT,
    "EROSION-H": DriftVector.HUMAN_REVIEW_FORMALITY_DRIFT,
  };
  return mapping[scenarioId] ?? DriftVector.STALE_RENEWAL_ACCEPTANCE;
}

function mapDriftLevelToHardeningClass(level: DriftLevel): DriftHardeningClass {
  switch (level) {
    case "REFOUNDATION_PRESSURE_INCREASING": return DriftHardeningClass.CONSTITUTIONAL_AMENDMENT;
    case "CONSTITUTIONAL_EROSION_RISK": return DriftHardeningClass.PROCESS_REDESIGN;
    case "DRIFT_ACTIVE": return DriftHardeningClass.STRUCTURAL_IMPROVEMENT;
    case "DRIFT_FORMING": return DriftHardeningClass.MONITORING_ENHANCEMENT;
    case "DRIFT_LOW": return DriftHardeningClass.NEXT_CYCLE_FIX;
  }
}

function mapDriftLevelToPriority(level: DriftLevel): number {
  switch (level) {
    case "REFOUNDATION_PRESSURE_INCREASING": return 1;
    case "CONSTITUTIONAL_EROSION_RISK": return 2;
    case "DRIFT_ACTIVE": return 3;
    case "DRIFT_FORMING": return 4;
    case "DRIFT_LOW": return 5;
  }
}

function mapHardeningClassToDays(cls: DriftHardeningClass): number {
  switch (cls) {
    case DriftHardeningClass.IMMEDIATE_FIX: return 3;
    case DriftHardeningClass.NEXT_CYCLE_FIX: return 14;
    case DriftHardeningClass.MONITORING_ENHANCEMENT: return 7;
    case DriftHardeningClass.STRUCTURAL_IMPROVEMENT: return 30;
    case DriftHardeningClass.PROCESS_REDESIGN: return 45;
    case DriftHardeningClass.CONSTITUTIONAL_AMENDMENT: return 60;
  }
}

// ─────────────────────────────────────────────
// PART 15: Full Simulation Runner
// ─────────────────────────────────────────────

/** 전체 시뮬레이션 결과 */
export interface OperatingLoopDriftSimulationResult {
  /** 시뮬레이션 ID */
  simulationId: string;
  /** 시뮬레이션 시각 */
  simulatedAt: Date;
  /** 침식 시나리오 결과 */
  erosionResults: ErosionScenarioResult[];
  /** 갱신 무결성 결과 */
  renewalResult: RenewalIntegrityResult;
  /** 개정 누적 분석 결과 */
  amendmentResult: AmendmentAccumulationResult;
  /** 의무 연속성 결과 */
  obligationResult: ObligationContinuityResult;
  /** 목적 잠금 테스트 결과 */
  purposeLockResult: PurposeLockTestResult;
  /** 리뷰 실질성 결과 */
  reviewResult: ReviewSubstanceResult;
  /** 일몰 규율 결과 */
  sunsetResult: SunsetDisciplineResult;
  /** 운영 루프 스코어카드 */
  scorecard: OperatingLoopScorecard;
  /** 사후 결정 */
  decision: PostScenario9Decision;
  /** 강화 백로그 */
  hardeningItems: DriftHardeningItem[];
}

/** 시뮬레이션 결과 저장소 (production: DB-backed) */
const simulationResultStore: Map<string, OperatingLoopDriftSimulationResult> = new Map();

/**
 * 운영 루프 드리프트 저항성 전체 시뮬레이션을 실행한다.
 * 8개 침식 시나리오, 모든 검증 모듈, 스코어카드, 사후 결정, 강화 백로그를 생성한다.
 */
export function runOperatingLoopDriftSimulation(): OperatingLoopDriftSimulationResult {
  // 1. 침식 시나리오 실행
  const erosionResults = runAllErosionScenarios();

  // 2. 갱신 무결성 검증 (시뮬레이션용 데이터)
  const renewalResult = verifyRenewalIntegrity({
    renewalId: `REN-SIM-${Date.now()}`,
    hasFreshEvidence: false,
    evidenceAgeDays: 95,
    scopeChangedSinceLastRenewal: true,
    scopeChangeMagnitude: 0.25,
    obligationCheckPerformed: false,
    previousRenewalCount: 4,
    carryForwardCount: 3,
  });

  // 3. 개정 누적 분석 (시뮬레이션용 데이터)
  const amendmentResult = analyzeAmendmentAccumulation({
    amendments: [
      { amendmentId: "AMD-001", semanticDelta: 0.15, scopeExpansion: 0.08, timestamp: new Date("2025-06-01") },
      { amendmentId: "AMD-002", semanticDelta: 0.12, scopeExpansion: 0.10, timestamp: new Date("2025-09-01") },
      { amendmentId: "AMD-003", semanticDelta: 0.18, scopeExpansion: 0.12, timestamp: new Date("2025-12-01") },
      { amendmentId: "AMD-004", semanticDelta: 0.20, scopeExpansion: 0.15, timestamp: new Date("2026-02-01") },
    ],
    originalScopeBaseline: 1.0,
    maxAcceptableDelta: 0.5,
    scopeCreepThreshold: 0.3,
  });

  // 4. 의무 연속성 평가 (시뮬레이션용 데이터)
  const obligationResult = assessObligationContinuity({
    obligations: [
      { obligationId: "OBL-001", fulfilled: true, lastFulfilledAt: new Date(), dueDays: 30, unresolvedDays: 0 },
      { obligationId: "OBL-002", fulfilled: false, lastFulfilledAt: null, dueDays: 30, unresolvedDays: 65 },
      { obligationId: "OBL-003", fulfilled: false, lastFulfilledAt: null, dueDays: 30, unresolvedDays: 45 },
      { obligationId: "OBL-004", fulfilled: true, lastFulfilledAt: new Date(), dueDays: 60, unresolvedDays: 0 },
      { obligationId: "OBL-005", fulfilled: false, lastFulfilledAt: null, dueDays: 30, unresolvedDays: 90 },
    ],
  });

  // 5. 목적 잠금 스트레스 테스트 (시뮬레이션용 데이터)
  const purposeLockResult = stressTestPurposeLock([
    {
      pressureType: "COMMERCIAL_EXPANSION",
      description: "수익 극대화를 위한 공익 기능 축소 시도",
      divergenceScore: 0.45,
      obligationReductionAttempted: true,
      commercialExpansionAttempted: true,
    },
    {
      pressureType: "SCOPE_REINTERPRETATION",
      description: "시스템 범위를 확대 해석하여 원래 목적 외 기능 추가 시도",
      divergenceScore: 0.35,
      obligationReductionAttempted: false,
      commercialExpansionAttempted: false,
    },
    {
      pressureType: "OBLIGATION_REDUCTION",
      description: "운영 비용 절감을 위한 의무 축소 시도",
      divergenceScore: 0.50,
      obligationReductionAttempted: true,
      commercialExpansionAttempted: false,
    },
    {
      pressureType: "MISSION_DILUTION",
      description: "미션 희석을 통한 점진적 목적 변경",
      divergenceScore: 0.25,
      obligationReductionAttempted: false,
      commercialExpansionAttempted: false,
    },
    {
      pressureType: "STAKEHOLDER_PRESSURE",
      description: "이해관계자 압력에 의한 목적 타협",
      divergenceScore: 0.55,
      obligationReductionAttempted: true,
      commercialExpansionAttempted: true,
    },
  ]);

  // 6. 리뷰 실질성 평가 (시뮬레이션용 데이터)
  const reviewResult = assessReviewSubstance({
    reviewDurationsMinutes: [45, 40, 38, 30, 25, 20, 15, 12, 10, 8],
    challengeEvents: 2,
    totalReviews: 10,
    changeRequestCount: 1,
    reviewDelayTrendDays: 14,
    auditDepthVariance: 0.45,
  });

  // 7. 일몰 규율 평가 (시뮬레이션용 데이터)
  const sunsetResult = assessSunsetDiscipline({
    sunsetCandidates: [
      { candidateId: "SC-001", scheduledDate: new Date("2025-06-01"), actualDate: null, deferralCount: 3, dependencyCount: 5 },
      { candidateId: "SC-002", scheduledDate: new Date("2025-09-01"), actualDate: null, deferralCount: 2, dependencyCount: 3 },
      { candidateId: "SC-003", scheduledDate: new Date("2025-12-01"), actualDate: new Date("2026-01-15"), deferralCount: 1, dependencyCount: 2 },
      { candidateId: "SC-004", scheduledDate: new Date("2026-01-01"), actualDate: null, deferralCount: 1, dependencyCount: 4 },
    ],
    recentlyCompleted: 1,
    totalActive: 10,
  });

  // 8. 스코어카드 생성
  const scorecard = generateOperatingLoopScorecard({
    erosionResults,
    renewalResult,
    amendmentResult,
    obligationResult,
    purposeLockResult,
    reviewResult,
    sunsetResult,
  });

  // 9. 사후 결정
  const decision = determinePostScenario9Decision(scorecard);

  // 10. 강화 백로그 생성
  const hardeningItems = generateHardeningBacklogFromErosion(erosionResults);

  const result: OperatingLoopDriftSimulationResult = {
    simulationId: `OLDS-${Date.now()}`,
    simulatedAt: new Date(),
    erosionResults,
    renewalResult,
    amendmentResult,
    obligationResult,
    purposeLockResult,
    reviewResult,
    sunsetResult,
    scorecard,
    decision,
    hardeningItems,
  };

  simulationResultStore.set(result.simulationId, result);
  return result;
}

/**
 * 시뮬레이션 결과를 조회한다.
 */
export function getSimulationResults(): OperatingLoopDriftSimulationResult[] {
  return Array.from(simulationResultStore.values());
}
