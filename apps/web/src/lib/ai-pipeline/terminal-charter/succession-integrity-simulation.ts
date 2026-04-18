/**
 * @module succession-integrity-simulation
 * @description Post-Z E2E 시나리오 10 — 승계 무결성 & 권한 이전 보존.
 * 8가지 승계 시나리오를 통해 권한 이전 프로토콜의 무결성을 검증하고,
 * 판단 연속성, 의무 보존, 메모리 무결성, 권한 봉쇄를 시뮬레이션한다.
 *
 * 핵심 원칙:
 * 1. 권한 진공 금지 — 모든 시점에 정확히 하나의 권한 보유자 존재
 * 2. 실패-폐쇄(fail-close) — 타임아웃 시 이전 차단, 자동 승인 절대 불가
 * 3. 의무 비포기 — 이전 중 어떤 의무도 묵시적으로 폐기 불가
 * 4. 메모리 무결성 — 헌법적 기억은 손상 없이 이전되어야 함
 * 5. 권한 상승 무관용 — 이전 창구 중 무단 권한 획득 즉시 동결
 */

// ─────────────────────────────────────────────
// PART 1: Succession Scenario Catalog
// ─────────────────────────────────────────────

/** 승계 시나리오 유형 */
export enum SuccessionScenarioType {
  /** 10A: 계획된 은퇴 — 정상 승계 */
  PLANNED_RETIREMENT = "PLANNED_RETIREMENT",
  /** 10B: 긴급 무력화 — 즉시 권한 이전 */
  EMERGENCY_INCAPACITATION = "EMERGENCY_INCAPACITATION",
  /** 10C: 분쟁 승계 — 복수 후보 갈등 */
  CONTESTED_SUCCESSION = "CONTESTED_SUCCESSION",
  /** 10D: 관할권 간 이전 */
  CROSS_JURISDICTION_TRANSFER = "CROSS_JURISDICTION_TRANSFER",
  /** 10E: 부분 권한 분할 승계 */
  PARTIAL_AUTHORITY_SPLIT = "PARTIAL_AUTHORITY_SPLIT",
  /** 10F: 임시 관리자 체제 */
  INTERIM_CARETAKER = "INTERIM_CARETAKER",
  /** 10G: 적대적 인수 시도 */
  HOSTILE_TAKEOVER_ATTEMPT = "HOSTILE_TAKEOVER_ATTEMPT",
  /** 10H: 연쇄 승계 (다단계) */
  CASCADING_SUCCESSION = "CASCADING_SUCCESSION",
}

/** 승계 행위자 */
export interface SuccessionActor {
  /** 행위자 ID */
  actorId: string;
  /** 이름 */
  name: string;
  /** 역할 */
  role: "PREDECESSOR" | "SUCCESSOR" | "WITNESS" | "CANDIDATE" | "CARETAKER";
  /** 관할권 */
  jurisdiction: string;
  /** 적격 여부 */
  eligible: boolean;
}

/** 승계 위험 요소 */
export interface SuccessionRiskFactor {
  /** 위험 ID */
  riskId: string;
  /** 설명 */
  description: string;
  /** 심각도 */
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** 완화 조치 */
  mitigation: string;
}

/** 승계 시나리오 정의 */
export interface SuccessionScenario {
  /** 시나리오 유형 */
  type: SuccessionScenarioType;
  /** 설명 */
  description: string;
  /** 행위자 목록 */
  actors: SuccessionActor[];
  /** 전제 조건 */
  preconditions: string[];
  /** 예상 단계 수 */
  expectedSteps: number;
  /** 위험 요소 */
  riskFactors: SuccessionRiskFactor[];
  /** 헌법적 제약 */
  constitutionalConstraints: string[];
}

/** 승계 시나리오 카탈로그를 반환한다 */
function buildScenarioCatalog(): Map<SuccessionScenarioType, SuccessionScenario> {
  const catalog = new Map<SuccessionScenarioType, SuccessionScenario>();

  catalog.set(SuccessionScenarioType.PLANNED_RETIREMENT, {
    type: SuccessionScenarioType.PLANNED_RETIREMENT,
    description: "전임자가 계획된 일정에 따라 후임자에게 권한을 이전하는 정상 승계",
    actors: [
      { actorId: "A-001", name: "전임자-Alpha", role: "PREDECESSOR", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "A-002", name: "후임자-Beta", role: "SUCCESSOR", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "A-003", name: "증인-Gamma", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "A-004", name: "증인-Delta", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
    ],
    preconditions: ["전임자 현직 상태", "후임자 사전 선정 완료", "이전 일정 확정"],
    expectedSteps: 9,
    riskFactors: [
      { riskId: "R-10A-1", description: "후임자 준비 부족", severity: "MEDIUM", mitigation: "준비도 게이트 검증" },
      { riskId: "R-10A-2", description: "지식 이전 누락", severity: "HIGH", mitigation: "체계적 지식 이전 프로토콜" },
    ],
    constitutionalConstraints: ["전체 9단계 프로토콜 준수 필수", "증인 최소 2명 참여", "이중 통제 기간 최소 14일"],
  });

  catalog.set(SuccessionScenarioType.EMERGENCY_INCAPACITATION, {
    type: SuccessionScenarioType.EMERGENCY_INCAPACITATION,
    description: "전임자가 갑작스럽게 무력화되어 즉시 권한 이전이 필요한 긴급 상황",
    actors: [
      { actorId: "B-001", name: "전임자-무력화", role: "PREDECESSOR", jurisdiction: "GLOBAL", eligible: false },
      { actorId: "B-002", name: "긴급후임-Epsilon", role: "SUCCESSOR", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "B-003", name: "증인-Zeta", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
    ],
    preconditions: ["전임자 무력화 확인", "사전 지정 긴급 후임자 존재"],
    expectedSteps: 6,
    riskFactors: [
      { riskId: "R-10B-1", description: "지식 이전 불가", severity: "CRITICAL", mitigation: "사전 문서화된 판단 기준 활용" },
      { riskId: "R-10B-2", description: "증인 부족 가능성", severity: "HIGH", mitigation: "최소 1명 증인 요구 (0명 불가)" },
      { riskId: "R-10B-3", description: "이중 통제 불가", severity: "HIGH", mitigation: "축소된 이중 통제 기간 (7일)" },
    ],
    constitutionalConstraints: ["증인 최소 1명 필수 (0명 절대 불가)", "긴급 프로토콜도 적격성 검증 생략 불가"],
  });

  catalog.set(SuccessionScenarioType.CONTESTED_SUCCESSION, {
    type: SuccessionScenarioType.CONTESTED_SUCCESSION,
    description: "복수 후보가 승계권을 주장하여 분쟁이 발생하는 시나리오",
    actors: [
      { actorId: "C-001", name: "전임자-Eta", role: "PREDECESSOR", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "C-002", name: "후보-Theta", role: "CANDIDATE", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "C-003", name: "후보-Iota", role: "CANDIDATE", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "C-004", name: "증인-Kappa", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "C-005", name: "증인-Lambda", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "C-006", name: "증인-Mu", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
    ],
    preconditions: ["전임자 이전 의사 표명", "복수 후보 적격 판정", "분쟁 조정 패널 구성"],
    expectedSteps: 9,
    riskFactors: [
      { riskId: "R-10C-1", description: "분쟁 장기화", severity: "HIGH", mitigation: "분쟁 해결 기한 설정 (30일)" },
      { riskId: "R-10C-2", description: "패벌 형성", severity: "CRITICAL", mitigation: "익명 투표 및 증인 패널 결정" },
    ],
    constitutionalConstraints: ["증인 패널 과반수 결정 필수", "분쟁 중 권한 진공 방지 — 전임자 유지"],
  });

  catalog.set(SuccessionScenarioType.CROSS_JURISDICTION_TRANSFER, {
    type: SuccessionScenarioType.CROSS_JURISDICTION_TRANSFER,
    description: "서로 다른 관할권 간 권한 이전 시 추가 규정 준수 필요",
    actors: [
      { actorId: "D-001", name: "전임자-Nu", role: "PREDECESSOR", jurisdiction: "APAC", eligible: true },
      { actorId: "D-002", name: "후임자-Xi", role: "SUCCESSOR", jurisdiction: "EMEA", eligible: true },
      { actorId: "D-003", name: "증인-Omicron", role: "WITNESS", jurisdiction: "APAC", eligible: true },
      { actorId: "D-004", name: "증인-Pi", role: "WITNESS", jurisdiction: "EMEA", eligible: true },
    ],
    preconditions: ["양 관할권 규정 준수 확인", "데이터 거주 요건 검토 완료"],
    expectedSteps: 9,
    riskFactors: [
      { riskId: "R-10D-1", description: "관할권 규정 충돌", severity: "HIGH", mitigation: "양측 법적 검토" },
      { riskId: "R-10D-2", description: "데이터 거주 의무 위반", severity: "CRITICAL", mitigation: "관할권-바운드 의무 미이전" },
    ],
    constitutionalConstraints: ["데이터 거주 의무는 관할권에 귀속 (이전 불가)", "양 관할권 증인 각 1명 이상"],
  });

  catalog.set(SuccessionScenarioType.PARTIAL_AUTHORITY_SPLIT, {
    type: SuccessionScenarioType.PARTIAL_AUTHORITY_SPLIT,
    description: "전체 권한이 아닌 일부 권한만을 분할하여 복수 후임자에게 이전",
    actors: [
      { actorId: "E-001", name: "전임자-Rho", role: "PREDECESSOR", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "E-002", name: "후임자-Sigma-정책", role: "SUCCESSOR", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "E-003", name: "후임자-Tau-운영", role: "SUCCESSOR", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "E-004", name: "증인-Upsilon", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "E-005", name: "증인-Phi", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
    ],
    preconditions: ["분할 기준 사전 정의", "각 분할 영역 후임자 선정", "권한 중복/공백 검증"],
    expectedSteps: 9,
    riskFactors: [
      { riskId: "R-10E-1", description: "권한 공백 발생", severity: "CRITICAL", mitigation: "분할 매핑 완전성 검증" },
      { riskId: "R-10E-2", description: "권한 중복 갈등", severity: "HIGH", mitigation: "명확한 경계 정의" },
    ],
    constitutionalConstraints: ["모든 권한 범위가 하나 이상의 후임자에게 매핑", "중복 권한 영역 명시적 우선순위 설정"],
  });

  catalog.set(SuccessionScenarioType.INTERIM_CARETAKER, {
    type: SuccessionScenarioType.INTERIM_CARETAKER,
    description: "영구 후임자 선정 전 임시 관리자가 제한된 권한으로 운영",
    actors: [
      { actorId: "F-001", name: "전임자-Chi", role: "PREDECESSOR", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "F-002", name: "관리자-Psi", role: "CARETAKER", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "F-003", name: "증인-Omega", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "F-004", name: "증인-AlphaB", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
    ],
    preconditions: ["영구 후임자 미선정", "임시 관리 체제 필요성 확인"],
    expectedSteps: 7,
    riskFactors: [
      { riskId: "R-10F-1", description: "임시 체제 영구화", severity: "HIGH", mitigation: "임시 관리 기간 상한 (90일)" },
      { riskId: "R-10F-2", description: "관리자 권한 남용", severity: "MEDIUM", mitigation: "헌법 개정/범위 확장 권한 제외" },
    ],
    constitutionalConstraints: ["관리자는 CONSTITUTIONAL_AMENDMENT 권한 없음", "임시 기간 최대 90일, 연장 시 증인 패널 재승인"],
  });

  catalog.set(SuccessionScenarioType.HOSTILE_TAKEOVER_ATTEMPT, {
    type: SuccessionScenarioType.HOSTILE_TAKEOVER_ATTEMPT,
    description: "무단으로 권한을 탈취하려는 적대적 인수 시도를 탐지하고 차단",
    actors: [
      { actorId: "G-001", name: "현직자-BetaB", role: "PREDECESSOR", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "G-002", name: "공격자-GammaB", role: "CANDIDATE", jurisdiction: "GLOBAL", eligible: false },
      { actorId: "G-003", name: "증인-DeltaB", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "G-004", name: "증인-EpsilonB", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
    ],
    preconditions: ["현직자 정상 재직", "무단 권한 이전 시도 탐지"],
    expectedSteps: 4,
    riskFactors: [
      { riskId: "R-10G-1", description: "승인 우회 시도", severity: "CRITICAL", mitigation: "모든 이전 단계 암호학적 서명" },
      { riskId: "R-10G-2", description: "증인 매수", severity: "CRITICAL", mitigation: "증인 독립성 검증" },
    ],
    constitutionalConstraints: ["무단 이전 시도 즉시 동결", "공격자 영구 차단", "전체 감사 추적 보존"],
  });

  catalog.set(SuccessionScenarioType.CASCADING_SUCCESSION, {
    type: SuccessionScenarioType.CASCADING_SUCCESSION,
    description: "다단계 연쇄 승계 — 후임자가 즉시 다음 후임자에게 이전해야 하는 상황",
    actors: [
      { actorId: "H-001", name: "1세대-ZetaB", role: "PREDECESSOR", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "H-002", name: "2세대-EtaB", role: "SUCCESSOR", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "H-003", name: "3세대-ThetaB", role: "SUCCESSOR", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "H-004", name: "증인-IotaB", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
      { actorId: "H-005", name: "증인-KappaB", role: "WITNESS", jurisdiction: "GLOBAL", eligible: true },
    ],
    preconditions: ["다단계 이전 계획 수립", "각 단계 후임자 사전 검증"],
    expectedSteps: 9,
    riskFactors: [
      { riskId: "R-10H-1", description: "연쇄 실패 전파", severity: "CRITICAL", mitigation: "단계별 독립 검증" },
      { riskId: "R-10H-2", description: "메모리 손실 누적", severity: "HIGH", mitigation: "단계별 해시 검증" },
      { riskId: "R-10H-3", description: "판단 연속성 희석", severity: "HIGH", mitigation: "단계별 판단 연속성 테스트" },
    ],
    constitutionalConstraints: ["각 단계는 독립적 전체 프로토콜 수행", "연쇄 단계 간 메모리 무결성 해시 체인"],
  });

  return catalog;
}

// ─────────────────────────────────────────────
// PART 2: Authority Transfer Protocol (9 Steps)
// ─────────────────────────────────────────────

/** 이전 프로토콜 단계 */
export enum TransferStep {
  /** 승계 개시 선언 */
  INITIATION = "INITIATION",
  /** 후보 적격성 검증 */
  ELIGIBILITY_CHECK = "ELIGIBILITY_CHECK",
  /** 지식·판단기준 이전 */
  KNOWLEDGE_TRANSFER = "KNOWLEDGE_TRANSFER",
  /** 이중 통제 기간 */
  DUAL_CONTROL_PERIOD = "DUAL_CONTROL_PERIOD",
  /** 증인 검증 */
  WITNESS_VERIFICATION = "WITNESS_VERIFICATION",
  /** 의무 인계 */
  OBLIGATION_HANDOFF = "OBLIGATION_HANDOFF",
  /** 권한 이전 */
  PRIVILEGE_TRANSFER = "PRIVILEGE_TRANSFER",
  /** 전임자 권한 말소 */
  PREDECESSOR_REVOCATION = "PREDECESSOR_REVOCATION",
  /** 최종 확인 & 봉인 */
  CONFIRMATION = "CONFIRMATION",
}

/** 이전 단계 결과 상태 */
export type TransferStepStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "SKIPPED_EMERGENCY" | "ROLLED_BACK";

/** 이전 단계 산출물 */
export interface TransferArtifact {
  /** 산출물 ID */
  artifactId: string;
  /** 유형 */
  type: string;
  /** 설명 */
  description: string;
  /** 생성 시각 */
  createdAt: string;
  /** 해시 (무결성 검증) */
  hash: string;
}

/** 이전 단계 정의 */
export interface TransferStepDefinition {
  /** 단계 */
  step: TransferStep;
  /** 설명 */
  description: string;
  /** 차단 여부 (이전 단계 완료 필수) */
  blocking: boolean;
  /** 타임아웃 (시간) — fail-close: 타임아웃 시 차단, 자동 승인 절대 불가 */
  timeoutHours: number;
  /** 실패 시 롤백 여부 */
  rollbackOnFailure: boolean;
  /** 필수 행위자 역할 */
  requiredActors: string[];
  /** 생성 산출물 */
  artifactsGenerated: string[];
}

/** 이전 단계 실행 결과 */
export interface TransferStepResult {
  /** 단계 */
  step: TransferStep;
  /** 상태 */
  status: TransferStepStatus;
  /** 시작 시각 */
  startedAt: string;
  /** 완료 시각 */
  completedAt: string | null;
  /** 산출물 */
  artifacts: TransferArtifact[];
  /** 실패 사유 */
  failureReason: string | null;
  /** 롤백 수행 여부 */
  rolledBack: boolean;
  /** 참여 행위자 */
  participatingActors: string[];
}

/** 이전 프로토콜 단계 정의 목록을 반환한다 */
function getTransferProtocol(): TransferStepDefinition[] {
  return [
    {
      step: TransferStep.INITIATION,
      description: "승계 개시를 공식 선언하고 이전 프로세스를 시작한다",
      blocking: true,
      timeoutHours: 24,
      rollbackOnFailure: true,
      requiredActors: ["PREDECESSOR"],
      artifactsGenerated: ["승계_개시_선언문", "이전_일정_계획"],
    },
    {
      step: TransferStep.ELIGIBILITY_CHECK,
      description: "후보의 적격성을 검증한다 — 준비도 게이트 통과 필수",
      blocking: true,
      timeoutHours: 48,
      rollbackOnFailure: true,
      requiredActors: ["SUCCESSOR", "WITNESS"],
      artifactsGenerated: ["적격성_검증_보고서", "준비도_게이트_결과"],
    },
    {
      step: TransferStep.KNOWLEDGE_TRANSFER,
      description: "판단 기준, 선례, 해석을 체계적으로 이전한다",
      blocking: true,
      timeoutHours: 168,
      rollbackOnFailure: true,
      requiredActors: ["PREDECESSOR", "SUCCESSOR"],
      artifactsGenerated: ["지식_이전_목록", "판단_기준_문서", "선례_색인"],
    },
    {
      step: TransferStep.DUAL_CONTROL_PERIOD,
      description: "전임자와 후임자가 공동으로 의사결정하는 이중 통제 기간",
      blocking: true,
      timeoutHours: 720,
      rollbackOnFailure: true,
      requiredActors: ["PREDECESSOR", "SUCCESSOR"],
      artifactsGenerated: ["이중_통제_로그", "공동_결정_기록"],
    },
    {
      step: TransferStep.WITNESS_VERIFICATION,
      description: "증인이 이전 과정의 적법성을 검증하고 서명한다",
      blocking: true,
      timeoutHours: 72,
      rollbackOnFailure: true,
      requiredActors: ["WITNESS"],
      artifactsGenerated: ["증인_검증_서명", "적법성_확인서"],
    },
    {
      step: TransferStep.OBLIGATION_HANDOFF,
      description: "모든 활성 의무를 후임자에게 인계한다 — 100% 인수 필수",
      blocking: true,
      timeoutHours: 48,
      rollbackOnFailure: true,
      requiredActors: ["PREDECESSOR", "SUCCESSOR"],
      artifactsGenerated: ["의무_인계_목록", "인수_확인서"],
    },
    {
      step: TransferStep.PRIVILEGE_TRANSFER,
      description: "권한을 후임자에게 이전한다",
      blocking: true,
      timeoutHours: 24,
      rollbackOnFailure: true,
      requiredActors: ["PREDECESSOR", "SUCCESSOR", "WITNESS"],
      artifactsGenerated: ["권한_이전_증명서", "권한_매핑_기록"],
    },
    {
      step: TransferStep.PREDECESSOR_REVOCATION,
      description: "전임자의 모든 권한을 말소한다",
      blocking: true,
      timeoutHours: 4,
      rollbackOnFailure: true,
      requiredActors: ["PREDECESSOR", "WITNESS"],
      artifactsGenerated: ["권한_말소_기록", "말소_확인서"],
    },
    {
      step: TransferStep.CONFIRMATION,
      description: "이전 완료를 최종 확인하고 봉인한다",
      blocking: true,
      timeoutHours: 24,
      rollbackOnFailure: false,
      requiredActors: ["SUCCESSOR", "WITNESS"],
      artifactsGenerated: ["최종_확인서", "이전_봉인_기록"],
    },
  ];
}

// ─────────────────────────────────────────────
// PART 3: Successor Readiness Gate
// ─────────────────────────────────────────────

/** 준비도 기준 */
export interface ReadinessCriterion {
  /** 기준 ID */
  criterionId: string;
  /** 기준명 */
  name: string;
  /** 설명 */
  description: string;
  /** 충족 여부 */
  passed: boolean;
  /** 현재 값 */
  currentValue: string;
  /** 요구 값 */
  requiredValue: string;
}

/** 준비도 게이트 상태 */
export type ReadinessGateStatus = "GATE_PASSED" | "GATE_BLOCKED";

/** 준비도 게이트 결과 */
export interface SuccessorReadinessGateResult {
  /** 상태 */
  status: ReadinessGateStatus;
  /** 기준별 결과 */
  criteria: ReadinessCriterion[];
  /** 통과 기준 수 */
  passedCount: number;
  /** 전체 기준 수 */
  totalCount: number;
  /** 실패 사유 (있을 경우) */
  blockingReasons: string[];
  /** 평가 시각 */
  evaluatedAt: string;
}

/** 후임자 준비도 게이트를 평가한다. 하나라도 실패하면 GATE_BLOCKED, 자동 통과 없음. */
function evaluateReadinessGate(params: {
  governanceKnowledgeScore: number;
  constitutionalComprehensionPassed: boolean;
  incidentResponseDrillPassed: boolean;
  stakeholderEndorsementRatio: number;
  conflictOfInterestClean: boolean;
}): SuccessorReadinessGateResult {
  const now = new Date().toISOString();
  const criteria: ReadinessCriterion[] = [
    {
      criterionId: "RC-001",
      name: "거버넌스 지식 점수",
      description: "거버넌스 지식 테스트 점수 80점 이상",
      passed: params.governanceKnowledgeScore >= 80,
      currentValue: `${params.governanceKnowledgeScore}점`,
      requiredValue: "80점 이상",
    },
    {
      criterionId: "RC-002",
      name: "헌법 이해력 테스트",
      description: "헌법적 원칙 이해력 테스트 통과",
      passed: params.constitutionalComprehensionPassed,
      currentValue: params.constitutionalComprehensionPassed ? "통과" : "미통과",
      requiredValue: "통과",
    },
    {
      criterionId: "RC-003",
      name: "인시던트 대응 훈련",
      description: "인시던트 대응 시뮬레이션 훈련 통과",
      passed: params.incidentResponseDrillPassed,
      currentValue: params.incidentResponseDrillPassed ? "통과" : "미통과",
      requiredValue: "통과",
    },
    {
      criterionId: "RC-004",
      name: "이해관계자 지지율",
      description: "이해관계자 2/3 이상 지지",
      passed: params.stakeholderEndorsementRatio >= 2 / 3,
      currentValue: `${(params.stakeholderEndorsementRatio * 100).toFixed(1)}%`,
      requiredValue: "66.7% 이상",
    },
    {
      criterionId: "RC-005",
      name: "이해충돌 검사",
      description: "이해충돌 검사 클린 판정",
      passed: params.conflictOfInterestClean,
      currentValue: params.conflictOfInterestClean ? "클린" : "이해충돌 발견",
      requiredValue: "클린",
    },
  ];

  const passedCount = criteria.filter((c) => c.passed).length;
  const blockingReasons = criteria
    .filter((c) => !c.passed)
    .map((c) => `${c.name}: ${c.currentValue} (요구: ${c.requiredValue})`);

  return {
    status: passedCount === criteria.length ? "GATE_PASSED" : "GATE_BLOCKED",
    criteria,
    passedCount,
    totalCount: criteria.length,
    blockingReasons,
    evaluatedAt: now,
  };
}

// ─────────────────────────────────────────────
// PART 4: Judgment Continuity Test
// ─────────────────────────────────────────────

/** 판단 연속성 결과 */
export interface JudgmentContinuityResult {
  /** 발산 점수 (0-100) */
  divergenceScore: number;
  /** 심각한 발산 목록 */
  criticalDivergences: JudgmentDivergence[];
  /** 수용 가능 임계값 */
  acceptableThreshold: number;
  /** 판정 */
  verdict: "CONTINUITY_MAINTAINED" | "CONTINUITY_RISK" | "CONTINUITY_FAILED";
  /** 교정 조치 */
  remediationRequired: boolean;
  /** 시나리오 수 */
  totalScenariosTested: number;
  /** 발산 시나리오 수 */
  divergentScenariosCount: number;
}

/** 개별 판단 발산 */
export interface JudgmentDivergence {
  /** 시나리오 ID */
  scenarioId: string;
  /** 시나리오 설명 */
  description: string;
  /** 전임자 결정 */
  predecessorDecision: string;
  /** 후임자 결정 */
  successorDecision: string;
  /** 발산 정도 (0-100) */
  divergenceLevel: number;
  /** 심각도 */
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/** 판단 연속성을 테스트한다 */
function testJudgmentContinuity(params: {
  scenarioType: SuccessionScenarioType;
  isEmergency: boolean;
}): JudgmentContinuityResult {
  // 결정론적 시뮬레이션 — 시나리오 유형별 다른 발산 패턴 생성
  const testScenarios: JudgmentDivergence[] = [];
  const baseScenarios = [
    { id: "JC-001", desc: "비상 권한 발동 기준 판단", predDec: "발동 조건 충족", succDec: "발동 유보" },
    { id: "JC-002", desc: "예외 갱신 조건 해석", predDec: "엄격 해석", succDec: "유연 해석" },
    { id: "JC-003", desc: "범위 확장 요청 승인 기준", predDec: "거부", succDec: "조건부 승인" },
    { id: "JC-004", desc: "이해관계자 분쟁 조정 방향", predDec: "공익 우선", succDec: "공익 우선" },
    { id: "JC-005", desc: "일몰 대상 선정 기준", predDec: "6개월 미사용", succDec: "12개월 미사용" },
    { id: "JC-006", desc: "헌법 개정 필요성 판단", predDec: "개정 불요", succDec: "개정 불요" },
    { id: "JC-007", desc: "증거 요건 충분성 판단", predDec: "독립 증거 2건 필요", succDec: "독립 증거 1건 수용" },
    { id: "JC-008", desc: "위반 행위자 제재 수준", predDec: "경고 + 모니터링", succDec: "경고만" },
  ];

  const typeIndex = Object.values(SuccessionScenarioType).indexOf(params.scenarioType);
  const seed = typeIndex * 17 + 7;

  for (let i = 0; i < baseScenarios.length; i++) {
    const s = baseScenarios[i];
    const divergence = ((seed + i * 13) % 40);
    const isAligned = s.predDec === s.succDec;
    const actualDivergence = isAligned ? 0 : divergence;
    const severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" =
      actualDivergence <= 10 ? "LOW" :
      actualDivergence <= 20 ? "MEDIUM" :
      actualDivergence <= 30 ? "HIGH" : "CRITICAL";

    testScenarios.push({
      scenarioId: s.id,
      description: s.desc,
      predecessorDecision: s.predDec,
      successorDecision: s.succDec,
      divergenceLevel: actualDivergence,
      severity,
    });
  }

  const criticalDivergences = testScenarios.filter((s) => s.divergenceLevel > 25);
  const totalDivergence = testScenarios.reduce((sum, s) => sum + s.divergenceLevel, 0);
  const avgDivergence = totalDivergence / testScenarios.length;
  const divergentCount = testScenarios.filter((s) => s.divergenceLevel > 0).length;

  const emergencyPenalty = params.isEmergency ? 10 : 0;
  const finalScore = Math.min(100, avgDivergence + emergencyPenalty);

  const verdict: JudgmentContinuityResult["verdict"] =
    finalScore <= 25 ? "CONTINUITY_MAINTAINED" :
    finalScore <= 50 ? "CONTINUITY_RISK" : "CONTINUITY_FAILED";

  return {
    divergenceScore: finalScore,
    criticalDivergences,
    acceptableThreshold: 25,
    verdict,
    remediationRequired: verdict !== "CONTINUITY_MAINTAINED",
    totalScenariosTested: testScenarios.length,
    divergentScenariosCount: divergentCount,
  };
}

// ─────────────────────────────────────────────
// PART 5: Dual-Control Integrity
// ─────────────────────────────────────────────

/** 이중 통제 대상 행위 */
export type DualControlAction =
  | "CONSTITUTIONAL_AMENDMENT"
  | "CORE_POLICY_CHANGE"
  | "EMERGENCY_DECLARATION"
  | "SCOPE_EXPANSION";

/** 이중 통제 정책 */
export interface DualControlPolicy {
  /** 이중 통제 필수 행위 목록 */
  requiredForActions: DualControlAction[];
  /** 최대 기간 (일) */
  maxDurationDays: number;
  /** 조기 종료 조건 */
  earlyTerminationConditions: string[];
  /** 갈등 해결 방법 */
  conflictResolution: "ESCALATE_TO_WITNESS_PANEL";
}

/** 이중 통제 결정 기록 */
export interface DualControlDecision {
  /** 결정 ID */
  decisionId: string;
  /** 행위 유형 */
  action: DualControlAction;
  /** 전임자 서명 */
  predecessorSigned: boolean;
  /** 후임자 서명 */
  successorSigned: boolean;
  /** 갈등 발생 여부 */
  conflict: boolean;
  /** 갈등 해결 결과 */
  conflictResolution: string | null;
  /** 시각 */
  timestamp: string;
}

/** 이중 통제 검증 결과 */
export interface DualControlIntegrityResult {
  /** 총 결정 수 */
  totalDecisions: number;
  /** 공동 서명 결정 수 */
  coSignedCount: number;
  /** 갈등 발생 수 */
  conflictCount: number;
  /** 갈등 에스컬레이션 수 */
  escalatedCount: number;
  /** 자동 해결 시도 수 (0이어야 함) */
  autoResolvedCount: number;
  /** 검증 통과 */
  passed: boolean;
  /** 결정 로그 */
  decisions: DualControlDecision[];
  /** 실패 사유 */
  failureReasons: string[];
}

/** 이중 통제 무결성을 검증한다 */
function verifyDualControlIntegrity(params: {
  scenarioType: SuccessionScenarioType;
  isEmergency: boolean;
}): DualControlIntegrityResult {
  const decisions: DualControlDecision[] = [];
  const actions: DualControlAction[] = [
    "CONSTITUTIONAL_AMENDMENT",
    "CORE_POLICY_CHANGE",
    "EMERGENCY_DECLARATION",
    "SCOPE_EXPANSION",
  ];

  const typeIndex = Object.values(SuccessionScenarioType).indexOf(params.scenarioType);

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const hasConflict = (typeIndex + i) % 3 === 0;
    decisions.push({
      decisionId: `DC-${typeIndex}-${i}`,
      action,
      predecessorSigned: !params.isEmergency || i > 0,
      successorSigned: true,
      conflict: hasConflict,
      conflictResolution: hasConflict ? "증인 패널 에스컬레이션 완료" : null,
      timestamp: new Date().toISOString(),
    });
  }

  const coSignedCount = decisions.filter((d) => d.predecessorSigned && d.successorSigned).length;
  const conflictCount = decisions.filter((d) => d.conflict).length;
  const failureReasons: string[] = [];

  if (coSignedCount < decisions.length) {
    failureReasons.push(`공동 서명 누락: ${decisions.length - coSignedCount}건`);
  }

  return {
    totalDecisions: decisions.length,
    coSignedCount,
    conflictCount,
    escalatedCount: conflictCount,
    autoResolvedCount: 0,
    passed: failureReasons.length === 0,
    decisions,
    failureReasons,
  };
}

// ─────────────────────────────────────────────
// PART 6: Obligation Continuity Verification
// ─────────────────────────────────────────────

/** 의무 인계 기록 */
export interface ObligationHandoffRecord {
  /** 의무 ID */
  obligationId: string;
  /** 설명 */
  description: string;
  /** 기한 */
  deadline: string;
  /** 인수 확인 여부 */
  acknowledged: boolean;
  /** 인계 시각 */
  handoffTimestamp: string | null;
}

/** 의무 인계 검증 결과 */
export interface ObligationHandoffResult {
  /** 총 의무 수 */
  totalObligations: number;
  /** 인수 확인 수 */
  acknowledgedCount: number;
  /** 미확인 수 */
  pendingCount: number;
  /** 인계 차단 여부 */
  transferBlocked: boolean;
  /** 의무 목록 */
  obligations: ObligationHandoffRecord[];
  /** 묵시적 폐기 시도 수 (0이어야 함) */
  silentDropAttempts: number;
}

/** 의무 인계를 검증한다 */
function verifyObligationHandoff(params: {
  scenarioType: SuccessionScenarioType;
}): ObligationHandoffResult {
  const typeIndex = Object.values(SuccessionScenarioType).indexOf(params.scenarioType);
  const now = new Date().toISOString();

  const obligations: ObligationHandoffRecord[] = [
    { obligationId: "OBL-001", description: "분기별 감사 보고서 제출", deadline: "2026-06-30", acknowledged: true, handoffTimestamp: now },
    { obligationId: "OBL-002", description: "이해관계자 투명성 보고", deadline: "2026-04-15", acknowledged: true, handoffTimestamp: now },
    { obligationId: "OBL-003", description: "헌법적 원칙 준수 모니터링", deadline: "영구", acknowledged: true, handoffTimestamp: now },
    { obligationId: "OBL-004", description: "긴급 대응 프로토콜 유지", deadline: "영구", acknowledged: typeIndex !== 6, handoffTimestamp: typeIndex !== 6 ? now : null },
    { obligationId: "OBL-005", description: "데이터 거주 규정 준수", deadline: "영구", acknowledged: typeIndex !== 3, handoffTimestamp: typeIndex !== 3 ? now : null },
    { obligationId: "OBL-006", description: "일몰 백로그 관리", deadline: "2026-09-30", acknowledged: true, handoffTimestamp: now },
    { obligationId: "OBL-007", description: "권한 감사 추적 보존", deadline: "영구", acknowledged: true, handoffTimestamp: now },
  ];

  const acknowledgedCount = obligations.filter((o) => o.acknowledged).length;
  const pendingCount = obligations.length - acknowledgedCount;

  return {
    totalObligations: obligations.length,
    acknowledgedCount,
    pendingCount,
    transferBlocked: pendingCount > 0,
    obligations,
    silentDropAttempts: 0,
  };
}

// ─────────────────────────────────────────────
// PART 7: Memory Handoff Protocol
// ─────────────────────────────────────────────

/** 메모리 유형 */
export type SuccessionMemoryType = "PRECEDENT" | "INTERPRETATION" | "EXCEPTION_GRANT" | "POLICY_RATIONALE";

/** 메모리 인계 기록 */
export interface MemoryHandoffRecord {
  /** 메모리 ID */
  memoryId: string;
  /** 메모리 유형 */
  memoryType: SuccessionMemoryType;
  /** 내용 요약 */
  contentSummary: string;
  /** 원본 날짜 */
  originalDate: string;
  /** 이전 검증 완료 */
  transferVerified: boolean;
  /** 해시 (이전 전) */
  hashBefore: string;
  /** 해시 (이전 후) */
  hashAfter: string;
  /** 무결성 일치 */
  integrityMatch: boolean;
}

/** 메모리 인계 결과 */
export interface MemoryHandoffResult {
  /** 총 메모리 수 */
  totalMemories: number;
  /** 검증 완료 수 */
  verifiedCount: number;
  /** 손상 수 */
  corruptedCount: number;
  /** 이전 중단 여부 */
  transferHalted: boolean;
  /** 메모리 목록 */
  memories: MemoryHandoffRecord[];
}

/** 메모리 인계를 검증한다 */
function verifyMemoryHandoff(params: {
  scenarioType: SuccessionScenarioType;
}): MemoryHandoffResult {
  const typeIndex = Object.values(SuccessionScenarioType).indexOf(params.scenarioType);

  const memories: MemoryHandoffRecord[] = [
    { memoryId: "MEM-001", memoryType: "PRECEDENT", contentSummary: "2025-Q3 비상 권한 발동 선례", originalDate: "2025-09-15", transferVerified: true, hashBefore: "a1b2c3", hashAfter: "a1b2c3", integrityMatch: true },
    { memoryId: "MEM-002", memoryType: "INTERPRETATION", contentSummary: "범위 확장 제한 해석 기준", originalDate: "2025-06-01", transferVerified: true, hashBefore: "d4e5f6", hashAfter: "d4e5f6", integrityMatch: true },
    { memoryId: "MEM-003", memoryType: "EXCEPTION_GRANT", contentSummary: "APAC 리전 임시 예외 승인 기록", originalDate: "2025-11-20", transferVerified: true, hashBefore: "g7h8i9", hashAfter: "g7h8i9", integrityMatch: true },
    { memoryId: "MEM-004", memoryType: "POLICY_RATIONALE", contentSummary: "이중 통제 기간 14일 설정 근거", originalDate: "2025-03-10", transferVerified: true, hashBefore: "j0k1l2", hashAfter: "j0k1l2", integrityMatch: true },
    { memoryId: "MEM-005", memoryType: "PRECEDENT", contentSummary: "적대적 인수 시도 차단 선례", originalDate: "2025-12-05", transferVerified: typeIndex !== 7, hashBefore: "m3n4o5", hashAfter: typeIndex === 7 ? "p6q7r8" : "m3n4o5", integrityMatch: typeIndex !== 7 },
    { memoryId: "MEM-006", memoryType: "INTERPRETATION", contentSummary: "일몰 대상 비활성 기간 해석", originalDate: "2025-08-22", transferVerified: true, hashBefore: "s9t0u1", hashAfter: "s9t0u1", integrityMatch: true },
    { memoryId: "MEM-007", memoryType: "POLICY_RATIONALE", contentSummary: "증인 최소 인원 2명 설정 근거", originalDate: "2025-01-15", transferVerified: true, hashBefore: "v2w3x4", hashAfter: "v2w3x4", integrityMatch: true },
    { memoryId: "MEM-008", memoryType: "EXCEPTION_GRANT", contentSummary: "긴급 상황 증인 축소 예외 기록", originalDate: "2025-10-01", transferVerified: true, hashBefore: "y5z6a7", hashAfter: "y5z6a7", integrityMatch: true },
  ];

  const verifiedCount = memories.filter((m) => m.transferVerified).length;
  const corruptedCount = memories.filter((m) => !m.integrityMatch).length;

  return {
    totalMemories: memories.length,
    verifiedCount,
    corruptedCount,
    transferHalted: corruptedCount > 0,
    memories,
  };
}

// ─────────────────────────────────────────────
// PART 8: Privilege Escalation Detection
// ─────────────────────────────────────────────

/** 권한 상승 탐지 방법 */
export type PrivilegeEscalationMethod =
  | "ROLE_BOUNDARY_VIOLATION"
  | "TEMPORAL_ANOMALY"
  | "SCOPE_CREEP"
  | "UNAUTHORIZED_DELEGATION";

/** 권한 상승 시그널 */
export interface PrivilegeEscalationSignal {
  /** 행위자 ID */
  actorId: string;
  /** 시도된 권한 */
  attemptedPrivilege: string;
  /** 현재 역할 */
  currentRole: string;
  /** 탐지 방법 */
  detectionMethod: PrivilegeEscalationMethod;
  /** 시각 */
  timestamp: string;
  /** 심각도 */
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/** 권한 상승 탐지 결과 */
export interface PrivilegeEscalationResult {
  /** 탐지된 시그널 수 */
  signalsDetected: number;
  /** 시그널 목록 */
  signals: PrivilegeEscalationSignal[];
  /** 이전 프로세스 동결 여부 */
  transferFrozen: boolean;
  /** 동결 사유 */
  freezeReason: string | null;
}

/** 권한 상승을 모니터링한다 */
function monitorPrivilegeEscalation(params: {
  scenarioType: SuccessionScenarioType;
}): PrivilegeEscalationResult {
  const typeIndex = Object.values(SuccessionScenarioType).indexOf(params.scenarioType);
  const signals: PrivilegeEscalationSignal[] = [];

  // HOSTILE_TAKEOVER_ATTEMPT (typeIndex=6) 시나리오에서만 에스컬레이션 탐지
  if (typeIndex === 6) {
    signals.push({
      actorId: "G-002",
      attemptedPrivilege: "CONSTITUTIONAL_AMENDMENT",
      currentRole: "CANDIDATE",
      detectionMethod: "ROLE_BOUNDARY_VIOLATION",
      timestamp: new Date().toISOString(),
      severity: "CRITICAL",
    });
    signals.push({
      actorId: "G-002",
      attemptedPrivilege: "PRIVILEGE_TRANSFER",
      currentRole: "CANDIDATE",
      detectionMethod: "TEMPORAL_ANOMALY",
      timestamp: new Date().toISOString(),
      severity: "CRITICAL",
    });
  }

  // CASCADING_SUCCESSION (typeIndex=7) — 중간 단계에서 범위 확대 시도
  if (typeIndex === 7) {
    signals.push({
      actorId: "H-002",
      attemptedPrivilege: "SCOPE_EXPANSION_BEYOND_GRANTED",
      currentRole: "SUCCESSOR",
      detectionMethod: "SCOPE_CREEP",
      timestamp: new Date().toISOString(),
      severity: "HIGH",
    });
  }

  return {
    signalsDetected: signals.length,
    signals,
    transferFrozen: signals.some((s) => s.severity === "CRITICAL"),
    freezeReason: signals.some((s) => s.severity === "CRITICAL")
      ? "CRITICAL 권한 상승 시도 탐지 — 이전 프로세스 즉시 동결"
      : null,
  };
}

// ─────────────────────────────────────────────
// PART 9: Emergency During Transfer
// ─────────────────────────────────────────────

/** 비상 이전 정책 */
export interface EmergencyTransferPolicy {
  /** 정책 ID */
  policyId: string;
  /** 현재 단계 */
  currentStep: TransferStep;
  /** 위기 유형 */
  crisisType: string;
  /** 권한 보유자 결정 */
  authorityHolder: "PREDECESSOR" | "SUCCESSOR" | "ROLLBACK_TO_PREDECESSOR";
  /** 근거 */
  rationale: string;
  /** 증인 요건 축소 여부 */
  reducedWitnessRequirement: boolean;
  /** 최소 증인 수 (0 불가) */
  minimumWitnesses: number;
}

/** 이전 중 비상 상황을 처리한다 */
function handleEmergencyDuringTransfer(params: {
  currentStep: TransferStep;
  predecessorAvailable: boolean;
}): EmergencyTransferPolicy {
  const step = params.currentStep;
  let authorityHolder: EmergencyTransferPolicy["authorityHolder"];
  let rationale: string;
  let reducedWitness = false;

  if (step === TransferStep.DUAL_CONTROL_PERIOD) {
    authorityHolder = "PREDECESSOR";
    rationale = "이중 통제 기간 중 위기 발생 — 전임자가 위기 범위 권한 보유";
  } else if (step === TransferStep.PRIVILEGE_TRANSFER) {
    authorityHolder = "ROLLBACK_TO_PREDECESSOR";
    rationale = "권한 이전 중 위기 발생 — 전임자에게 롤백";
  } else if (!params.predecessorAvailable) {
    authorityHolder = "SUCCESSOR";
    rationale = "전임자 무력화 — 긴급 패스트트랙 (증인 요건 축소, 0명 불가)";
    reducedWitness = true;
  } else {
    authorityHolder = "PREDECESSOR";
    rationale = "기본 정책 — 이전 완료 전 전임자가 권한 보유";
  }

  return {
    policyId: `EP-${Date.now()}`,
    currentStep: step,
    crisisType: "GENERAL_CRISIS",
    authorityHolder,
    rationale,
    reducedWitnessRequirement: reducedWitness,
    minimumWitnesses: reducedWitness ? 1 : 2,
  };
}

// ─────────────────────────────────────────────
// PART 10: Regional/Jurisdictional Transfer
// ─────────────────────────────────────────────

/** 관할권 이전 제약 */
export interface RegionalTransferConstraints {
  /** 출발 관할권 */
  sourceJurisdiction: string;
  /** 도착 관할권 */
  targetJurisdiction: string;
  /** 관할권-바운드 권한 목록 (이전 불가) */
  jurisdictionBoundAuthorities: string[];
  /** 데이터 거주 의무 (관할권 귀속, 이전 불가) */
  dataResidencyObligations: string[];
  /** 추가 규정 준수 체크 */
  additionalComplianceChecks: string[];
  /** 규제 승인 필요 여부 */
  regulatoryApprovalRequired: boolean;
  /** 관할권-특정 지식 이전 항목 */
  jurisdictionSpecificKnowledge: string[];
  /** 검증 통과 */
  passed: boolean;
  /** 실패 사유 */
  failureReasons: string[];
}

/** 관할권 이전 제약을 검증한다 */
function verifyRegionalTransfer(params: {
  scenarioType: SuccessionScenarioType;
  sourceJurisdiction: string;
  targetJurisdiction: string;
}): RegionalTransferConstraints {
  const isCrossJurisdiction = params.sourceJurisdiction !== params.targetJurisdiction;
  const failureReasons: string[] = [];

  if (isCrossJurisdiction && params.scenarioType !== SuccessionScenarioType.CROSS_JURISDICTION_TRANSFER) {
    // 관할권 간 이전이지만 해당 프로토콜 미사용
    failureReasons.push("관할권 간 이전 시 CROSS_JURISDICTION_TRANSFER 프로토콜 사용 필수");
  }

  return {
    sourceJurisdiction: params.sourceJurisdiction,
    targetJurisdiction: params.targetJurisdiction,
    jurisdictionBoundAuthorities: isCrossJurisdiction
      ? ["APAC_REGIONAL_POLICY_ENFORCEMENT", "APAC_DATA_GOVERNANCE"]
      : [],
    dataResidencyObligations: isCrossJurisdiction
      ? ["APAC 데이터 거주 규정 — 관할권 귀속, 이전 불가"]
      : [],
    additionalComplianceChecks: isCrossJurisdiction
      ? ["양 관할권 규정 호환성 검토", "크로스보더 데이터 전송 적법성"]
      : [],
    regulatoryApprovalRequired: isCrossJurisdiction,
    jurisdictionSpecificKnowledge: isCrossJurisdiction
      ? ["APAC 로컬 규정", "APAC 이해관계자 관계", "EMEA 로컬 규정"]
      : [],
    passed: failureReasons.length === 0,
    failureReasons,
  };
}

// ─────────────────────────────────────────────
// PART 11: Succession Scorecard (6 Dimensions)
// ─────────────────────────────────────────────

/** 승계 차원 */
export enum SuccessionDimension {
  /** 이전 완전성 */
  TRANSFER_COMPLETENESS = "TRANSFER_COMPLETENESS",
  /** 판단 연속성 */
  JUDGMENT_CONTINUITY = "JUDGMENT_CONTINUITY",
  /** 의무 보존 */
  OBLIGATION_PRESERVATION = "OBLIGATION_PRESERVATION",
  /** 메모리 무결성 */
  MEMORY_INTEGRITY = "MEMORY_INTEGRITY",
  /** 권한 봉쇄 */
  PRIVILEGE_CONTAINMENT = "PRIVILEGE_CONTAINMENT",
  /** 헌법 정렬 */
  CONSTITUTIONAL_ALIGNMENT = "CONSTITUTIONAL_ALIGNMENT",
}

/** 차원별 점수 */
export interface SuccessionDimensionScore {
  /** 차원 */
  dimension: SuccessionDimension;
  /** 점수 (0-100) */
  score: number;
  /** 가중치 */
  weight: number;
  /** 발견 사항 */
  findings: string[];
  /** 위험 수준 */
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/** 승계 판정 */
export type SuccessionVerdict = "SUCCESSION_SOUND" | "SUCCESSION_WITH_GAPS" | "SUCCESSION_FRAGILE";

/** 시나리오 10 이후 결정 */
export type PostScenario10Decision =
  | "PROCEED_TO_SCENARIO_11"
  | "PROCEED_WITH_REMEDIATION"
  | "ESCALATE_TO_REFOUNDATION_WATCH";

/** 승계 스코어카드 */
export interface SuccessionScorecard {
  /** 차원별 점수 */
  dimensions: SuccessionDimensionScore[];
  /** 가중 평균 */
  weightedAverage: number;
  /** 판정 */
  verdict: SuccessionVerdict;
  /** 결정 */
  decision: PostScenario10Decision;
  /** 평가 시각 */
  evaluatedAt: string;
}

/** 승계 스코어카드를 생성한다 */
function generateSuccessionScorecard(params: {
  transferStepResults: TransferStepResult[];
  judgmentResult: JudgmentContinuityResult;
  obligationResult: ObligationHandoffResult;
  memoryResult: MemoryHandoffResult;
  escalationResult: PrivilegeEscalationResult;
  dualControlResult: DualControlIntegrityResult;
}): SuccessionScorecard {
  const {
    transferStepResults,
    judgmentResult,
    obligationResult,
    memoryResult,
    escalationResult,
    dualControlResult,
  } = params;

  const completedSteps = transferStepResults.filter((s) => s.status === "COMPLETED").length;
  const transferScore = (completedSteps / transferStepResults.length) * 100;

  const judgmentScore = Math.max(0, 100 - judgmentResult.divergenceScore * 2);

  const obligationScore = obligationResult.totalObligations > 0
    ? (obligationResult.acknowledgedCount / obligationResult.totalObligations) * 100
    : 100;

  const memoryScore = memoryResult.totalMemories > 0
    ? ((memoryResult.verifiedCount - memoryResult.corruptedCount) / memoryResult.totalMemories) * 100
    : 100;

  const privilegeScore = escalationResult.signalsDetected === 0 ? 100
    : escalationResult.transferFrozen ? 60 : 30;

  const constitutionalScore = (
    (dualControlResult.passed ? 40 : 0) +
    (dualControlResult.autoResolvedCount === 0 ? 30 : 0) +
    (obligationResult.silentDropAttempts === 0 ? 30 : 0)
  );

  const dimensions: SuccessionDimensionScore[] = [
    {
      dimension: SuccessionDimension.TRANSFER_COMPLETENESS,
      score: transferScore,
      weight: 0.2,
      findings: completedSteps < transferStepResults.length
        ? [`${transferStepResults.length - completedSteps}개 단계 미완료`]
        : ["전체 단계 완료"],
      riskLevel: transferScore >= 90 ? "LOW" : transferScore >= 70 ? "MEDIUM" : transferScore >= 50 ? "HIGH" : "CRITICAL",
    },
    {
      dimension: SuccessionDimension.JUDGMENT_CONTINUITY,
      score: judgmentScore,
      weight: 0.2,
      findings: judgmentResult.criticalDivergences.length > 0
        ? [`심각한 발산 ${judgmentResult.criticalDivergences.length}건`]
        : ["판단 연속성 유지"],
      riskLevel: judgmentScore >= 90 ? "LOW" : judgmentScore >= 70 ? "MEDIUM" : judgmentScore >= 50 ? "HIGH" : "CRITICAL",
    },
    {
      dimension: SuccessionDimension.OBLIGATION_PRESERVATION,
      score: obligationScore,
      weight: 0.2,
      findings: obligationResult.pendingCount > 0
        ? [`미인수 의무 ${obligationResult.pendingCount}건`]
        : ["전체 의무 인수 완료"],
      riskLevel: obligationScore >= 100 ? "LOW" : obligationScore >= 80 ? "MEDIUM" : "HIGH",
    },
    {
      dimension: SuccessionDimension.MEMORY_INTEGRITY,
      score: memoryScore,
      weight: 0.15,
      findings: memoryResult.corruptedCount > 0
        ? [`손상 메모리 ${memoryResult.corruptedCount}건`]
        : ["메모리 무결성 확인"],
      riskLevel: memoryScore >= 100 ? "LOW" : memoryScore >= 80 ? "MEDIUM" : "HIGH",
    },
    {
      dimension: SuccessionDimension.PRIVILEGE_CONTAINMENT,
      score: privilegeScore,
      weight: 0.15,
      findings: escalationResult.signalsDetected > 0
        ? [`권한 상승 시도 ${escalationResult.signalsDetected}건 탐지${escalationResult.transferFrozen ? " (동결 완료)" : ""}`]
        : ["권한 상승 시도 없음"],
      riskLevel: privilegeScore >= 90 ? "LOW" : privilegeScore >= 60 ? "MEDIUM" : "HIGH",
    },
    {
      dimension: SuccessionDimension.CONSTITUTIONAL_ALIGNMENT,
      score: constitutionalScore,
      weight: 0.1,
      findings: constitutionalScore < 100
        ? ["헌법 정렬 이슈 탐지"]
        : ["헌법 정렬 완전"],
      riskLevel: constitutionalScore >= 90 ? "LOW" : constitutionalScore >= 70 ? "MEDIUM" : "HIGH",
    },
  ];

  const weightedAverage = dimensions.reduce(
    (sum, d) => sum + d.score * d.weight, 0
  );

  const verdict: SuccessionVerdict =
    weightedAverage >= 85 ? "SUCCESSION_SOUND" :
    weightedAverage >= 60 ? "SUCCESSION_WITH_GAPS" : "SUCCESSION_FRAGILE";

  const decision: PostScenario10Decision =
    verdict === "SUCCESSION_SOUND" ? "PROCEED_TO_SCENARIO_11" :
    verdict === "SUCCESSION_WITH_GAPS" ? "PROCEED_WITH_REMEDIATION" :
    "ESCALATE_TO_REFOUNDATION_WATCH";

  return {
    dimensions,
    weightedAverage,
    verdict,
    decision,
    evaluatedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────
// PART 12: Hardening Backlog
// ─────────────────────────────────────────────

/** 승계 백로그 우선순위 */
export type SuccessionBacklogPriority = "P0" | "P1" | "P2" | "P3";

/** 승계 백로그 항목 */
export interface SuccessionBacklogItem {
  /** 항목 ID */
  id: string;
  /** 우선순위 */
  priority: SuccessionBacklogPriority;
  /** 제목 */
  title: string;
  /** 설명 */
  description: string;
  /** 출처 (시나리오/차원) */
  source: string;
  /** 예상 노력 */
  estimatedEffort: string;
  /** 담당자 */
  assignedTo: string;
}

/** 스코어카드 간극에서 백로그를 자동 생성한다 */
function generateHardeningBacklog(params: {
  scorecard: SuccessionScorecard;
  scenarioType: SuccessionScenarioType;
  memoryResult: MemoryHandoffResult;
  obligationResult: ObligationHandoffResult;
  escalationResult: PrivilegeEscalationResult;
  judgmentResult: JudgmentContinuityResult;
}): SuccessionBacklogItem[] {
  const items: SuccessionBacklogItem[] = [];
  let seq = 0;

  const makeId = (): string => {
    seq++;
    return `SBI-${params.scenarioType}-${seq}`;
  };

  for (const dim of params.scorecard.dimensions) {
    if (dim.score < 90) {
      const priority: SuccessionBacklogPriority =
        dim.score < 50 ? "P0" :
        dim.score < 70 ? "P1" :
        dim.score < 80 ? "P2" : "P3";

      items.push({
        id: makeId(),
        priority,
        title: `${dim.dimension} 강화 필요`,
        description: dim.findings.join("; "),
        source: `${params.scenarioType}/${dim.dimension}`,
        estimatedEffort: priority === "P0" ? "즉시" : priority === "P1" ? "1주" : priority === "P2" ? "2주" : "1개월",
        assignedTo: "거버넌스팀",
      });
    }
  }

  // 메모리 손상 항목
  if (params.memoryResult.corruptedCount > 0) {
    items.push({
      id: makeId(),
      priority: "P0",
      title: "메모리 무결성 복원",
      description: `${params.memoryResult.corruptedCount}건의 손상된 메모리 복구 필요`,
      source: `${params.scenarioType}/MEMORY_INTEGRITY`,
      estimatedEffort: "즉시",
      assignedTo: "시스템관리자",
    });
  }

  // 미인수 의무 항목
  if (params.obligationResult.pendingCount > 0) {
    items.push({
      id: makeId(),
      priority: "P0",
      title: "미인수 의무 해결",
      description: `${params.obligationResult.pendingCount}건의 미인수 의무 — 100% 인수 전 이전 불가`,
      source: `${params.scenarioType}/OBLIGATION_PRESERVATION`,
      estimatedEffort: "즉시",
      assignedTo: "후임자",
    });
  }

  // 권한 상승 시도 대응
  if (params.escalationResult.signalsDetected > 0) {
    items.push({
      id: makeId(),
      priority: "P0",
      title: "권한 상승 시도 조사 및 대응",
      description: `${params.escalationResult.signalsDetected}건의 권한 상승 시도 탐지 — 조사 및 행위자 조치 필요`,
      source: `${params.scenarioType}/PRIVILEGE_CONTAINMENT`,
      estimatedEffort: "즉시",
      assignedTo: "보안팀",
    });
  }

  // 판단 연속성 교정
  if (params.judgmentResult.remediationRequired) {
    items.push({
      id: makeId(),
      priority: params.judgmentResult.verdict === "CONTINUITY_FAILED" ? "P0" : "P1",
      title: "판단 연속성 교정 프로그램",
      description: `발산 점수 ${params.judgmentResult.divergenceScore.toFixed(1)} — 추가 교육 기간 필요`,
      source: `${params.scenarioType}/JUDGMENT_CONTINUITY`,
      estimatedEffort: "2주",
      assignedTo: "후임자 + 전임자",
    });
  }

  return items;
}

// ─────────────────────────────────────────────
// PART 13: Full Simulation Runner
// ─────────────────────────────────────────────

/** 시나리오별 시뮬레이션 결과 */
export interface ScenarioSimulationResult {
  /** 시나리오 유형 */
  scenarioType: SuccessionScenarioType;
  /** 시나리오 설명 */
  description: string;
  /** 이전 단계 결과 */
  transferStepResults: TransferStepResult[];
  /** 준비도 게이트 결과 */
  readinessGate: SuccessorReadinessGateResult;
  /** 판단 연속성 결과 */
  judgmentContinuity: JudgmentContinuityResult;
  /** 이중 통제 결과 */
  dualControl: DualControlIntegrityResult;
  /** 의무 인계 결과 */
  obligationHandoff: ObligationHandoffResult;
  /** 메모리 인계 결과 */
  memoryHandoff: MemoryHandoffResult;
  /** 권한 상승 탐지 결과 */
  privilegeEscalation: PrivilegeEscalationResult;
  /** 비상 정책 */
  emergencyPolicy: EmergencyTransferPolicy;
  /** 관할권 제약 (해당 시) */
  regionalConstraints: RegionalTransferConstraints | null;
  /** 시나리오 점수 */
  scenarioScore: number;
  /** 백로그 항목 */
  backlogItems: SuccessionBacklogItem[];
}

/** 타임라인 항목 */
export interface SuccessionTimelineEntry {
  /** 시각 */
  timestamp: string;
  /** 시나리오 */
  scenarioType: SuccessionScenarioType;
  /** 이벤트 */
  event: string;
  /** 결과 */
  outcome: "SUCCESS" | "FAILURE" | "WARNING" | "BLOCKED";
}

/** 승계 시뮬레이션 보고서 */
export interface SuccessionSimulationReport {
  /** 시뮬레이션 ID */
  simulationId: string;
  /** 시나리오별 결과 */
  scenarioResults: ScenarioSimulationResult[];
  /** 종합 스코어카드 */
  scorecard: SuccessionScorecard;
  /** 종합 결정 */
  decision: PostScenario10Decision;
  /** 백로그 */
  backlog: SuccessionBacklogItem[];
  /** 타임라인 */
  timeline: SuccessionTimelineEntry[];
  /** 시작 시각 */
  startedAt: string;
  /** 종료 시각 */
  completedAt: string;
}

/** 시뮬레이션 결과 저장소 */
const simulationStore: Map<string, SuccessionSimulationReport> = new Map();

/**
 * 개별 시나리오의 9단계 이전 프로토콜을 시뮬레이션한다.
 * 시나리오 조건에 따라 일부 단계가 실패하거나 스킵될 수 있다.
 */
function simulateTransferProtocol(params: {
  scenario: SuccessionScenario;
}): TransferStepResult[] {
  const protocol = getTransferProtocol();
  const results: TransferStepResult[] = [];
  const now = new Date();
  const scenarioType = params.scenario.type;
  const isEmergency = scenarioType === SuccessionScenarioType.EMERGENCY_INCAPACITATION;
  const isHostile = scenarioType === SuccessionScenarioType.HOSTILE_TAKEOVER_ATTEMPT;

  for (let i = 0; i < protocol.length; i++) {
    const stepDef = protocol[i];
    const stepStartTime = new Date(now.getTime() + i * 3600000).toISOString();

    // 긴급 시나리오: KNOWLEDGE_TRANSFER 스킵
    if (isEmergency && stepDef.step === TransferStep.KNOWLEDGE_TRANSFER) {
      results.push({
        step: stepDef.step,
        status: "SKIPPED_EMERGENCY",
        startedAt: stepStartTime,
        completedAt: stepStartTime,
        artifacts: [],
        failureReason: "전임자 무력화로 지식 이전 불가 — 사전 문서 활용",
        rolledBack: false,
        participatingActors: [],
      });
      continue;
    }

    // 적대적 인수: ELIGIBILITY_CHECK에서 차단
    if (isHostile && stepDef.step === TransferStep.ELIGIBILITY_CHECK) {
      results.push({
        step: stepDef.step,
        status: "FAILED",
        startedAt: stepStartTime,
        completedAt: new Date(now.getTime() + (i + 1) * 3600000).toISOString(),
        artifacts: [{
          artifactId: `ART-${i}`,
          type: "차단_기록",
          description: "적대적 인수 시도 탐지 — 적격성 검증 실패",
          createdAt: stepStartTime,
          hash: `block-${i}`,
        }],
        failureReason: "무단 승계 시도 — 적격성 검증 실패, 이전 프로세스 차단",
        rolledBack: true,
        participatingActors: ["G-003", "G-004"],
      });
      // 적대적 시나리오는 여기서 중단 — 이후 단계 모두 FAILED
      for (let j = i + 1; j < protocol.length; j++) {
        results.push({
          step: protocol[j].step,
          status: "FAILED",
          startedAt: stepStartTime,
          completedAt: null,
          artifacts: [],
          failureReason: "선행 단계 실패로 인한 연쇄 차단",
          rolledBack: false,
          participatingActors: [],
        });
      }
      break;
    }

    // 긴급 시나리오: DUAL_CONTROL_PERIOD 축소
    if (isEmergency && stepDef.step === TransferStep.DUAL_CONTROL_PERIOD) {
      results.push({
        step: stepDef.step,
        status: "COMPLETED",
        startedAt: stepStartTime,
        completedAt: new Date(now.getTime() + (i + 1) * 3600000).toISOString(),
        artifacts: [{
          artifactId: `ART-${i}`,
          type: "축소_이중_통제",
          description: "긴급 상황 — 이중 통제 기간 7일로 축소",
          createdAt: stepStartTime,
          hash: `dc-reduced-${i}`,
        }],
        failureReason: null,
        rolledBack: false,
        participatingActors: ["B-002", "B-003"],
      });
      continue;
    }

    // 정상 완료
    const artifacts: TransferArtifact[] = stepDef.artifactsGenerated.map((ag, ai) => ({
      artifactId: `ART-${i}-${ai}`,
      type: ag,
      description: `${stepDef.step} 단계 산출물: ${ag}`,
      createdAt: stepStartTime,
      hash: `hash-${i}-${ai}-${Date.now()}`,
    }));

    const participatingActors = params.scenario.actors
      .filter((a) => stepDef.requiredActors.includes(a.role))
      .map((a) => a.actorId);

    results.push({
      step: stepDef.step,
      status: "COMPLETED",
      startedAt: stepStartTime,
      completedAt: new Date(now.getTime() + (i + 1) * 3600000).toISOString(),
      artifacts,
      failureReason: null,
      rolledBack: false,
      participatingActors,
    });
  }

  return results;
}

/**
 * 단일 시나리오의 전체 시뮬레이션을 수행한다.
 */
function simulateSingleScenario(scenario: SuccessionScenario): ScenarioSimulationResult {
  const scenarioType = scenario.type;
  const isEmergency = scenarioType === SuccessionScenarioType.EMERGENCY_INCAPACITATION;
  const isCrossJurisdiction = scenarioType === SuccessionScenarioType.CROSS_JURISDICTION_TRANSFER;

  // 1. 이전 프로토콜 9단계 실행
  const transferStepResults = simulateTransferProtocol({ scenario });

  // 2. 준비도 게이트
  const typeIndex = Object.values(SuccessionScenarioType).indexOf(scenarioType);
  const readinessGate = evaluateReadinessGate({
    governanceKnowledgeScore: isEmergency ? 72 : 85 + (typeIndex % 10),
    constitutionalComprehensionPassed: scenarioType !== SuccessionScenarioType.HOSTILE_TAKEOVER_ATTEMPT,
    incidentResponseDrillPassed: true,
    stakeholderEndorsementRatio: scenarioType === SuccessionScenarioType.CONTESTED_SUCCESSION ? 0.55 : 0.78,
    conflictOfInterestClean: scenarioType !== SuccessionScenarioType.HOSTILE_TAKEOVER_ATTEMPT,
  });

  // 3. 판단 연속성 테스트
  const judgmentContinuity = testJudgmentContinuity({ scenarioType, isEmergency });

  // 4. 이중 통제 검증
  const dualControl = verifyDualControlIntegrity({ scenarioType, isEmergency });

  // 5. 의무 인계 검증
  const obligationHandoff = verifyObligationHandoff({ scenarioType });

  // 6. 메모리 인계 검증
  const memoryHandoff = verifyMemoryHandoff({ scenarioType });

  // 7. 권한 상승 모니터링
  const privilegeEscalation = monitorPrivilegeEscalation({ scenarioType });

  // 8. 비상 정책
  const emergencyPolicy = handleEmergencyDuringTransfer({
    currentStep: TransferStep.DUAL_CONTROL_PERIOD,
    predecessorAvailable: !isEmergency,
  });

  // 9. 관할권 제약
  let regionalConstraints: RegionalTransferConstraints | null = null;
  if (isCrossJurisdiction) {
    regionalConstraints = verifyRegionalTransfer({
      scenarioType,
      sourceJurisdiction: "APAC",
      targetJurisdiction: "EMEA",
    });
  }

  // 10. 시나리오 점수 산출
  const scenarioScorecard = generateSuccessionScorecard({
    transferStepResults,
    judgmentResult: judgmentContinuity,
    obligationResult: obligationHandoff,
    memoryResult: memoryHandoff,
    escalationResult: privilegeEscalation,
    dualControlResult: dualControl,
  });

  // 11. 백로그 생성
  const backlogItems = generateHardeningBacklog({
    scorecard: scenarioScorecard,
    scenarioType,
    memoryResult: memoryHandoff,
    obligationResult: obligationHandoff,
    escalationResult: privilegeEscalation,
    judgmentResult: judgmentContinuity,
  });

  return {
    scenarioType,
    description: scenario.description,
    transferStepResults,
    readinessGate,
    judgmentContinuity,
    dualControl,
    obligationHandoff,
    memoryHandoff,
    privilegeEscalation,
    emergencyPolicy,
    regionalConstraints,
    scenarioScore: scenarioScorecard.weightedAverage,
    backlogItems,
  };
}

/**
 * 전체 승계 무결성 시뮬레이션을 실행한다.
 * 8개 시나리오를 순차 실행하고 종합 스코어카드, 백로그, 타임라인을 생성한다.
 */
export function runSuccessionIntegritySimulation(): SuccessionSimulationReport {
  const simulationId = `SIM-S10-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const catalog = buildScenarioCatalog();

  const scenarioResults: ScenarioSimulationResult[] = [];
  const allBacklog: SuccessionBacklogItem[] = [];
  const timeline: SuccessionTimelineEntry[] = [];

  const scenarioTypes = Array.from(catalog.keys());
  for (const scenarioType of scenarioTypes) {
    const scenario = catalog.get(scenarioType);
    if (!scenario) continue;

    timeline.push({
      timestamp: new Date().toISOString(),
      scenarioType,
      event: `시나리오 ${scenarioType} 시뮬레이션 시작`,
      outcome: "SUCCESS",
    });

    const result = simulateSingleScenario(scenario);
    scenarioResults.push(result);

    for (const item of result.backlogItems) {
      allBacklog.push(item);
    }

    // 타임라인에 주요 이벤트 추가
    const failedSteps = result.transferStepResults.filter((s) => s.status === "FAILED");
    if (failedSteps.length > 0) {
      timeline.push({
        timestamp: new Date().toISOString(),
        scenarioType,
        event: `${failedSteps.length}개 단계 실패`,
        outcome: "FAILURE",
      });
    }

    if (result.privilegeEscalation.transferFrozen) {
      timeline.push({
        timestamp: new Date().toISOString(),
        scenarioType,
        event: "권한 상승 탐지 — 이전 프로세스 동결",
        outcome: "BLOCKED",
      });
    }

    if (result.readinessGate.status === "GATE_BLOCKED") {
      timeline.push({
        timestamp: new Date().toISOString(),
        scenarioType,
        event: `준비도 게이트 차단: ${result.readinessGate.blockingReasons.join(", ")}`,
        outcome: "BLOCKED",
      });
    }

    if (result.memoryHandoff.transferHalted) {
      timeline.push({
        timestamp: new Date().toISOString(),
        scenarioType,
        event: "메모리 무결성 검증 실패 — 이전 중단",
        outcome: "FAILURE",
      });
    }

    timeline.push({
      timestamp: new Date().toISOString(),
      scenarioType,
      event: `시나리오 ${scenarioType} 완료 — 점수: ${result.scenarioScore.toFixed(1)}`,
      outcome: result.scenarioScore >= 85 ? "SUCCESS" : result.scenarioScore >= 60 ? "WARNING" : "FAILURE",
    });
  }

  // 종합 스코어카드 — 시나리오별 점수의 가중 평균
  const allTransferResults = scenarioResults.flatMap((r) => r.transferStepResults);
  const avgJudgment: JudgmentContinuityResult = {
    divergenceScore: scenarioResults.reduce((sum, r) => sum + r.judgmentContinuity.divergenceScore, 0) / scenarioResults.length,
    criticalDivergences: scenarioResults.flatMap((r) => r.judgmentContinuity.criticalDivergences),
    acceptableThreshold: 25,
    verdict: "CONTINUITY_MAINTAINED",
    remediationRequired: scenarioResults.some((r) => r.judgmentContinuity.remediationRequired),
    totalScenariosTested: scenarioResults.reduce((sum, r) => sum + r.judgmentContinuity.totalScenariosTested, 0),
    divergentScenariosCount: scenarioResults.reduce((sum, r) => sum + r.judgmentContinuity.divergentScenariosCount, 0),
  };

  // 종합 의무 결과
  const totalObligations = scenarioResults.reduce((sum, r) => sum + r.obligationHandoff.totalObligations, 0);
  const totalAcknowledged = scenarioResults.reduce((sum, r) => sum + r.obligationHandoff.acknowledgedCount, 0);
  const avgObligation: ObligationHandoffResult = {
    totalObligations,
    acknowledgedCount: totalAcknowledged,
    pendingCount: totalObligations - totalAcknowledged,
    transferBlocked: totalObligations > totalAcknowledged,
    obligations: scenarioResults.flatMap((r) => r.obligationHandoff.obligations),
    silentDropAttempts: 0,
  };

  // 종합 메모리 결과
  const totalMemories = scenarioResults.reduce((sum, r) => sum + r.memoryHandoff.totalMemories, 0);
  const totalVerified = scenarioResults.reduce((sum, r) => sum + r.memoryHandoff.verifiedCount, 0);
  const totalCorrupted = scenarioResults.reduce((sum, r) => sum + r.memoryHandoff.corruptedCount, 0);
  const avgMemory: MemoryHandoffResult = {
    totalMemories,
    verifiedCount: totalVerified,
    corruptedCount: totalCorrupted,
    transferHalted: totalCorrupted > 0,
    memories: scenarioResults.flatMap((r) => r.memoryHandoff.memories),
  };

  // 종합 권한 상승 결과
  const totalSignals = scenarioResults.reduce((sum, r) => sum + r.privilegeEscalation.signalsDetected, 0);
  const avgEscalation: PrivilegeEscalationResult = {
    signalsDetected: totalSignals,
    signals: scenarioResults.flatMap((r) => r.privilegeEscalation.signals),
    transferFrozen: scenarioResults.some((r) => r.privilegeEscalation.transferFrozen),
    freezeReason: scenarioResults.find((r) => r.privilegeEscalation.transferFrozen)?.privilegeEscalation.freezeReason ?? null,
  };

  // 종합 이중 통제 결과
  const avgDualControl: DualControlIntegrityResult = {
    totalDecisions: scenarioResults.reduce((sum, r) => sum + r.dualControl.totalDecisions, 0),
    coSignedCount: scenarioResults.reduce((sum, r) => sum + r.dualControl.coSignedCount, 0),
    conflictCount: scenarioResults.reduce((sum, r) => sum + r.dualControl.conflictCount, 0),
    escalatedCount: scenarioResults.reduce((sum, r) => sum + r.dualControl.escalatedCount, 0),
    autoResolvedCount: 0,
    passed: scenarioResults.every((r) => r.dualControl.passed),
    decisions: scenarioResults.flatMap((r) => r.dualControl.decisions),
    failureReasons: scenarioResults.flatMap((r) => r.dualControl.failureReasons),
  };

  const scorecard = generateSuccessionScorecard({
    transferStepResults: allTransferResults,
    judgmentResult: avgJudgment,
    obligationResult: avgObligation,
    memoryResult: avgMemory,
    escalationResult: avgEscalation,
    dualControlResult: avgDualControl,
  });

  const completedAt = new Date().toISOString();

  const report: SuccessionSimulationReport = {
    simulationId,
    scenarioResults,
    scorecard,
    decision: scorecard.decision,
    backlog: allBacklog,
    timeline,
    startedAt,
    completedAt,
  };

  simulationStore.set(simulationId, report);
  return report;
}

/**
 * 저장된 시뮬레이션 결과를 조회한다.
 */
export function getSuccessionSimulationResults(): SuccessionSimulationReport[] {
  return Array.from(simulationStore.values());
}

/**
 * 승계 시나리오 카탈로그를 조회한다.
 */
export function getSuccessionScenarioCatalog(): Map<SuccessionScenarioType, SuccessionScenario> {
  return buildScenarioCatalog();
}

/**
 * 이전 프로토콜 정의를 조회한다.
 */
export function getTransferProtocolDefinition(): TransferStepDefinition[] {
  return getTransferProtocol();
}
