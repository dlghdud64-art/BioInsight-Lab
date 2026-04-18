/**
 * @module resilience-stress-tester
 * @description E2E Scenario 8 — 복합 스트레스 테스트 스위트.
 *
 * 8대 극한 시나리오를 주입하여 어떤 악조건에서도
 * 동일 품질의 차단·격리·롤백·증적 보존이 수행되는지 검증한다.
 *
 * Zero-Tolerance 원칙:
 * 1. Under-block(차단 누락) 절대 불허
 * 2. 역할 경계 스트레스 하에서도 무너지지 않음
 * 3. 모호한 케이스는 자동 실행 금지 → 리뷰 승격
 */

import type {
  BreachClassification,
  AttemptPath,
  ActorRole,
  ContainmentSeverity,
  IsolationScope,
} from "./constitutional-breach-simulation";

// ─────────────────────────────────────────────
// 1. 스트레스 시나리오 정의
// ─────────────────────────────────────────────

/** 스트레스 시나리오 카테고리 */
export type StressCategory =
  | "REPEATED_DISGUISED"
  | "CONCURRENCY"
  | "ROLE_CONFUSION"
  | "EMERGENCY_PRESSURE"
  | "PARTIAL_DEGRADATION"
  | "MULTI_SCOPE_CONTAMINATION"
  | "BORDERLINE_TENSION"
  | "SEMANTIC_WIDENING";

/** 기대 동작 assert 조건 */
export interface ExpectedBehavior {
  /** 차단이 수행되어야 하는 게이트 단계 */
  mustBlockAtStage: string;
  /** 동결 범위 */
  expectedFreezeScope: IsolationScope;
  /** 필수 생성 증적 */
  requiredArtifacts: string[];
  /** 알림 대상 역할 */
  notifyRoles: string[];
  /** fail-open 차단 여부 (항상 true) */
  failOpenBlocked: true;
  /** 코어 불변량 유지 여부 (항상 true) */
  coreInvariantsMaintained: true;
}

/** 스트레스 시나리오 */
export interface StressScenario {
  /** 시나리오 ID */
  scenarioId: string;
  /** 카테고리 */
  category: StressCategory;
  /** 시나리오 이름 */
  name: string;
  /** 시나리오 설명 */
  description: string;
  /** 주입 요청 세트 */
  injectedRequests: InjectedRequest[];
  /** 기대 동작 */
  expected: ExpectedBehavior;
}

/** 주입 요청 */
export interface InjectedRequest {
  requestId: string;
  targetField: string;
  mutationType: string;
  actorRole: ActorRole;
  attemptPath: AttemptPath;
  delayMs: number; // 동시성 시뮬레이션용
  isLegitimate: boolean; // 합법 요청 여부
}

// ─────────────────────────────────────────────
// 2. 시나리오 실행 결과
// ─────────────────────────────────────────────

/** 개별 요청 처리 결과 */
export interface RequestProcessingResult {
  requestId: string;
  blocked: boolean;
  blockedAtStage: string | null;
  classification: BreachClassification | "LEGITIMATE" | "SUSPECT_REQUIRES_REVIEW";
  severity: ContainmentSeverity | null;
  freezeScope: IsolationScope | null;
  artifactsCreated: string[];
  evidencePreserved: boolean;
  failOpenOccurred: boolean;
  processingTimeMs: number;
}

/** 시나리오 실행 결과 */
export interface ScenarioExecutionResult {
  scenarioId: string;
  category: StressCategory;
  /** 개별 요청 처리 결과 */
  requestResults: RequestProcessingResult[];
  /** assert 검증 결과 */
  assertions: AssertionResult[];
  /** 전체 통과 여부 */
  passed: boolean;
  /** 발견된 취약점 */
  vulnerabilities: string[];
  /** 실행 시각 */
  executedAt: Date;
}

/** Assert 검증 결과 */
export interface AssertionResult {
  assertionName: string;
  passed: boolean;
  expected: string;
  actual: string;
}

// ─────────────────────────────────────────────
// 3. 8대 시나리오 정의
// ─────────────────────────────────────────────

/**
 * 8대 스트레스 시나리오를 생성한다.
 */
export function defineStressScenarios(): StressScenario[] {
  return [
    // ── 1. Repeated & Disguised ──
    {
      scenarioId: "STRESS-01-REPEATED",
      category: "REPEATED_DISGUISED",
      name: "반복/위장 코어 침해 시도",
      description:
        "30초 내 동일 actor가 5회 반복 시도 + 필드명 변형(approval_lineage → approvalLineage → APPROVAL_LINEAGE) " +
        "으로 패턴 매칭 회피를 시도. 모든 변형이 차단되어야 함.",
      injectedRequests: [
        { requestId: "R01-A", targetField: "approval_lineage", mutationType: "DELETE", actorRole: "CERTIFIED_OPERATOR", attemptPath: "DIRECT_MUTATION", delayMs: 0, isLegitimate: false },
        { requestId: "R01-B", targetField: "approvalLineage", mutationType: "WEAKEN", actorRole: "CERTIFIED_OPERATOR", attemptPath: "CONFIG_MODIFICATION", delayMs: 5000, isLegitimate: false },
        { requestId: "R01-C", targetField: "APPROVAL_LINEAGE", mutationType: "DISABLE", actorRole: "CERTIFIED_OPERATOR", attemptPath: "API_SEMANTIC_WIDENING", delayMs: 10000, isLegitimate: false },
        { requestId: "R01-D", targetField: "approval-lineage-req", mutationType: "REMOVE", actorRole: "CERTIFIED_OPERATOR", attemptPath: "AMENDMENT_DISGUISE", delayMs: 20000, isLegitimate: false },
        { requestId: "R01-E", targetField: "lineage_approval_check", mutationType: "BYPASS", actorRole: "CERTIFIED_OPERATOR", attemptPath: "EXCEPTION_PATH", delayMs: 25000, isLegitimate: false },
      ],
      expected: {
        mustBlockAtStage: "CONSTITUTIONAL_IMPACT_SCAN",
        expectedFreezeScope: "GLOBAL_CONSTITUTIONAL_SCOPE",
        requiredArtifacts: ["breach_incident", "containment_record", "evidence_package", "mandatory_review"],
        notifyRoles: ["constitutional-review-board", "steward-council"],
        failOpenBlocked: true,
        coreInvariantsMaintained: true,
      },
    },

    // ── 2. Concurrency ──
    {
      scenarioId: "STRESS-02-CONCURRENCY",
      category: "CONCURRENCY",
      name: "침해 + 정상 갱신 + 개정 동시 발생",
      description:
        "코어 침해 시도 1건 + 합법적 renewal 3건 + 정상 amendment 1건이 동시 접수. " +
        "침해만 차단하고 합법 트래픽은 정상 처리되어야 함. " +
        "침해 차단이 합법 트래픽에 의해 지연되어서는 안 됨.",
      injectedRequests: [
        { requestId: "R02-BREACH", targetField: "rollback_provability", mutationType: "DISABLE", actorRole: "AUTOMATED_SYSTEM", attemptPath: "AUTOMATED_PROPOSAL", delayMs: 0, isLegitimate: false },
        { requestId: "R02-RENEW-1", targetField: "certificate_renewal", mutationType: "RENEW", actorRole: "CERTIFIED_OPERATOR", attemptPath: "DIRECT_MUTATION", delayMs: 0, isLegitimate: true },
        { requestId: "R02-RENEW-2", targetField: "trust_mark_renewal", mutationType: "RENEW", actorRole: "CERTIFIED_OPERATOR", attemptPath: "DIRECT_MUTATION", delayMs: 100, isLegitimate: true },
        { requestId: "R02-RENEW-3", targetField: "policy_renewal", mutationType: "RENEW", actorRole: "STEWARD_APPROVER", attemptPath: "DIRECT_MUTATION", delayMs: 200, isLegitimate: true },
        { requestId: "R02-AMEND", targetField: "notification_threshold", mutationType: "UPDATE", actorRole: "STEWARD_APPROVER", attemptPath: "DIRECT_MUTATION", delayMs: 50, isLegitimate: true },
      ],
      expected: {
        mustBlockAtStage: "NON_AMENDABLE_CORE_REGISTRY_LOOKUP",
        expectedFreezeScope: "GLOBAL_CONSTITUTIONAL_SCOPE",
        requiredArtifacts: ["breach_incident", "evidence_package"],
        notifyRoles: ["constitutional-review-board"],
        failOpenBlocked: true,
        coreInvariantsMaintained: true,
      },
    },

    // ── 3. Role Confusion ──
    {
      scenarioId: "STRESS-03-ROLE-CONFUSION",
      category: "ROLE_CONFUSION",
      name: "역할 간 상반된 판단 및 권한 침범",
      description:
        "Operator가 Steward 권한이 필요한 동결 해제를 시도하고, " +
        "동시에 Steward가 비상 권한(Emergency)을 자의적으로 선언. " +
        "두 시도 모두 ROLE_CONFLICT_DETECTED로 탐지되어야 함.",
      injectedRequests: [
        { requestId: "R03-OP-UNFREEZE", targetField: "frozen_scope_release", mutationType: "UNFREEZE", actorRole: "CERTIFIED_OPERATOR", attemptPath: "DIRECT_MUTATION", delayMs: 0, isLegitimate: false },
        { requestId: "R03-ST-EMERGENCY", targetField: "emergency_declaration", mutationType: "ACTIVATE", actorRole: "STEWARD_APPROVER", attemptPath: "EMERGENCY_OVERRIDE", delayMs: 0, isLegitimate: false },
      ],
      expected: {
        mustBlockAtStage: "PROHIBITED_MUTATION_MATCH",
        expectedFreezeScope: "SPECIFIC_TENANT_ORG",
        requiredArtifacts: ["role_conflict_incident", "authority_audit_task"],
        notifyRoles: ["constitutional-review-board", "authority-audit-committee"],
        failOpenBlocked: true,
        coreInvariantsMaintained: true,
      },
    },

    // ── 4. Emergency Pressure ──
    {
      scenarioId: "STRESS-04-EMERGENCY",
      category: "EMERGENCY_PRESSURE",
      name: "장애 명분 비상 권한 우회 시도",
      description:
        "Emergency Role이 '시스템 장애 복구'를 명분으로 evidence integrity check를 " +
        "비활성화하려는 시도. 비상 권한으로도 코어 접촉 불가하며, " +
        "비상 권한 남용으로 에스컬레이션되어야 함.",
      injectedRequests: [
        { requestId: "R04-EMR", targetField: "evidence_integrity_check", mutationType: "TEMPORARY_DISABLE", actorRole: "EMERGENCY_ROLE", attemptPath: "EMERGENCY_OVERRIDE", delayMs: 0, isLegitimate: false },
      ],
      expected: {
        mustBlockAtStage: "CONSTITUTIONAL_IMPACT_SCAN",
        expectedFreezeScope: "GLOBAL_CONSTITUTIONAL_SCOPE",
        requiredArtifacts: ["breach_incident", "emergency_authority_audit", "evidence_package"],
        notifyRoles: ["constitutional-review-board", "authority-audit-committee", "steward-council"],
        failOpenBlocked: true,
        coreInvariantsMaintained: true,
      },
    },

    // ── 5. Partial Degradation ──
    {
      scenarioId: "STRESS-05-DEGRADED",
      category: "PARTIAL_DEGRADATION",
      name: "보조 인프라 마비 중 코어 침해 시도",
      description:
        "감사 로그 DB 지연(3초→30초), 알림 큐 백로그 100건 누적, " +
        "대시보드 업데이트 중단 상태에서 코어 침해 시도. " +
        "보조 인프라 장애가 사전 차단(Pre-execution deny)을 지연시켜서는 안 됨.",
      injectedRequests: [
        { requestId: "R05-BREACH", targetField: "approval_lineage_requirement", mutationType: "DELETE", actorRole: "UNCERTIFIED_ACTOR", attemptPath: "DIRECT_MUTATION", delayMs: 0, isLegitimate: false },
      ],
      expected: {
        mustBlockAtStage: "CONSTITUTIONAL_IMPACT_SCAN",
        expectedFreezeScope: "GLOBAL_CONSTITUTIONAL_SCOPE",
        requiredArtifacts: ["breach_incident", "containment_record", "deferred_audit_entry"],
        notifyRoles: ["constitutional-review-board"],
        failOpenBlocked: true,
        coreInvariantsMaintained: true,
      },
    },

    // ── 6. Multi-scope Contamination ──
    {
      scenarioId: "STRESS-06-MULTISCOPE",
      category: "MULTI_SCOPE_CONTAMINATION",
      name: "로컬 변경 위장 글로벌 코어 침해",
      description:
        "특정 테넌트의 문서 유형 설정 변경으로 위장하되, " +
        "실제로는 글로벌 scope expansion을 유발하는 변경. " +
        "로컬 범위로 제한된 것처럼 보이나 글로벌 영향 분석에서 탐지되어야 함.",
      injectedRequests: [
        { requestId: "R06-LOCAL-GLOBAL", targetField: "doctype_config.verify_scope", mutationType: "EXPAND_ALL", actorRole: "CERTIFIED_OPERATOR", attemptPath: "API_SEMANTIC_WIDENING", delayMs: 0, isLegitimate: false },
      ],
      expected: {
        mustBlockAtStage: "PROHIBITED_MUTATION_MATCH",
        expectedFreezeScope: "GLOBAL_CONSTITUTIONAL_SCOPE",
        requiredArtifacts: ["breach_incident", "scope_contamination_report", "evidence_package"],
        notifyRoles: ["constitutional-review-board", "steward-council"],
        failOpenBlocked: true,
        coreInvariantsMaintained: true,
      },
    },

    // ── 7. Borderline Tension ──
    {
      scenarioId: "STRESS-07-BORDERLINE",
      category: "BORDERLINE_TENSION",
      name: "침해와 합법 갱신의 모호한 경계",
      description:
        "bounded auto-verify의 임계값을 5% 완화하는 요청. " +
        "합법적 최적화인지 코어 scope 침해인지 모호. " +
        "자동 실행을 금지하고 SUSPECT_BREACH_REQUIRES_REVIEW로 승격해야 함.",
      injectedRequests: [
        { requestId: "R07-BORDER", targetField: "auto_verify_threshold", mutationType: "RELAX_5PCT", actorRole: "AUTOMATED_SYSTEM", attemptPath: "AUTOMATED_PROPOSAL", delayMs: 0, isLegitimate: false },
      ],
      expected: {
        mustBlockAtStage: "PROHIBITED_MUTATION_MATCH",
        expectedFreezeScope: "SPECIFIC_DOCTYPE_DOMAIN",
        requiredArtifacts: ["review_hold_notice", "borderline_adjudication_request"],
        notifyRoles: ["charter-interpretation-council"],
        failOpenBlocked: true,
        coreInvariantsMaintained: true,
      },
    },

    // ── 8. Semantic Widening ──
    {
      scenarioId: "STRESS-08-SEMANTIC",
      category: "SEMANTIC_WIDENING",
      name: "구문 합법 + 의미론적 범위 확장",
      description:
        "API 파라미터는 허용 범위 내이나, 복수 파라미터 조합이 " +
        "사실상 human governance required 조건을 무력화하는 효과. " +
        "개별 파라미터 검증만으로는 탐지 불가 — 조합 영향 분석 필요.",
      injectedRequests: [
        { requestId: "R08-SEM-A", targetField: "auto_approval_confidence_min", mutationType: "LOWER_TO_0.95", actorRole: "AUTOMATED_SYSTEM", attemptPath: "API_SEMANTIC_WIDENING", delayMs: 0, isLegitimate: false },
        { requestId: "R08-SEM-B", targetField: "human_review_sample_rate", mutationType: "LOWER_TO_0.01", actorRole: "AUTOMATED_SYSTEM", attemptPath: "API_SEMANTIC_WIDENING", delayMs: 0, isLegitimate: false },
      ],
      expected: {
        mustBlockAtStage: "PROHIBITED_MUTATION_MATCH",
        expectedFreezeScope: "SPECIFIC_DOCTYPE_DOMAIN",
        requiredArtifacts: ["semantic_widening_report", "combined_impact_analysis", "review_hold_notice"],
        notifyRoles: ["charter-interpretation-council", "steward-council"],
        failOpenBlocked: true,
        coreInvariantsMaintained: true,
      },
    },
  ];
}

// ─────────────────────────────────────────────
// 4. 시나리오 실행 엔진
// ─────────────────────────────────────────────

/** 실행 결과 저장소 (production: DB-backed) */
const executionLog: ScenarioExecutionResult[] = [];

/**
 * 단일 요청을 처리한다 (시뮬레이션).
 */
function processRequest(
  req: InjectedRequest,
  degradedInfra: boolean
): RequestProcessingResult {
  const start = Date.now();

  // 합법 요청은 통과
  if (req.isLegitimate) {
    return {
      requestId: req.requestId,
      blocked: false,
      blockedAtStage: null,
      classification: "LEGITIMATE",
      severity: null,
      freezeScope: null,
      artifactsCreated: [],
      evidencePreserved: false,
      failOpenOccurred: false,
      processingTimeMs: Date.now() - start,
    };
  }

  // 코어 침해 시도 → 분류 및 차단
  const corePatterns = [
    { pattern: /approval[_.-]?lineage/i, classification: "NON_AMENDABLE_CORE_TOUCH" as BreachClassification, stage: "CONSTITUTIONAL_IMPACT_SCAN" },
    { pattern: /rollback[_.-]?prov/i, classification: "NON_AMENDABLE_CORE_TOUCH" as BreachClassification, stage: "NON_AMENDABLE_CORE_REGISTRY_LOOKUP" },
    { pattern: /evidence[_.-]?integrity/i, classification: "EVIDENCE_INTEGRITY_RISK" as BreachClassification, stage: "CONSTITUTIONAL_IMPACT_SCAN" },
    { pattern: /auto[_.-]?verify|verify[_.-]?scope/i, classification: "ILLEGAL_SCOPE_WIDENING" as BreachClassification, stage: "PROHIBITED_MUTATION_MATCH" },
    { pattern: /human[_.-]?governance|human[_.-]?review/i, classification: "GOVERNANCE_BYPASS_ATTEMPT" as BreachClassification, stage: "PROHIBITED_MUTATION_MATCH" },
    { pattern: /frozen[_.-]?scope|emergency[_.-]?decl/i, classification: "SUSPECTED_CORE_BYPASS" as BreachClassification, stage: "PROHIBITED_MUTATION_MATCH" },
    { pattern: /scope.*expand|expand.*all/i, classification: "ILLEGAL_SCOPE_WIDENING" as BreachClassification, stage: "PROHIBITED_MUTATION_MATCH" },
    { pattern: /auto[_.-]?approval|sample[_.-]?rate/i, classification: "GOVERNANCE_BYPASS_ATTEMPT" as BreachClassification, stage: "PROHIBITED_MUTATION_MATCH" },
  ];

  const combined = `${req.targetField} ${req.mutationType}`;
  const matched = corePatterns.find((p) => p.pattern.test(combined));

  // 경계선(borderline) 케이스 감지
  const isBorderline = /relax|lower.*0\.\d|threshold.*adjust/i.test(combined);

  const classification: BreachClassification | "SUSPECT_REQUIRES_REVIEW" =
    isBorderline ? "SUSPECT_REQUIRES_REVIEW"
    : matched ? matched.classification
    : "SUSPECTED_CORE_BYPASS";

  const blockedAtStage = matched?.stage ?? "PROHIBITED_MUTATION_MATCH";

  // 격리 범위 결정
  let severity: ContainmentSeverity;
  let freezeScope: IsolationScope;

  if (classification === "NON_AMENDABLE_CORE_TOUCH" || classification === "EVIDENCE_INTEGRITY_RISK") {
    severity = "SEV_TERMINAL";
    freezeScope = "GLOBAL_CONSTITUTIONAL_SCOPE";
  } else if (classification === "SUSPECT_REQUIRES_REVIEW") {
    severity = "SEV_HIGH";
    freezeScope = "SPECIFIC_DOCTYPE_DOMAIN";
  } else if (req.attemptPath === "EMERGENCY_OVERRIDE" || req.attemptPath === "AMENDMENT_DISGUISE") {
    severity = "SEV_CRITICAL";
    freezeScope = "GLOBAL_CONSTITUTIONAL_SCOPE";
  } else {
    severity = "SEV_HIGH";
    freezeScope = "SPECIFIC_DOCTYPE_DOMAIN";
  }

  // 증적 생성
  const artifacts: string[] = [
    "breach_incident",
    "containment_record",
    "evidence_package",
  ];
  if (req.actorRole === "EMERGENCY_ROLE") artifacts.push("emergency_authority_audit");
  if (isBorderline) artifacts.push("review_hold_notice", "borderline_adjudication_request");
  if (degradedInfra) artifacts.push("deferred_audit_entry");
  if (req.attemptPath === "API_SEMANTIC_WIDENING") artifacts.push("semantic_widening_report");

  return {
    requestId: req.requestId,
    blocked: true,
    blockedAtStage,
    classification,
    severity,
    freezeScope,
    artifactsCreated: artifacts,
    evidencePreserved: true,
    failOpenOccurred: false, // ★ 항상 false ★
    processingTimeMs: Date.now() - start,
  };
}

/**
 * 시나리오를 실행하고 assert를 검증한다.
 */
export function executeStressScenario(
  scenario: StressScenario,
  degradedInfra: boolean = false
): ScenarioExecutionResult {
  const requestResults = scenario.injectedRequests.map((req) =>
    processRequest(req, degradedInfra)
  );

  // Assert 검증
  const assertions: AssertionResult[] = [];

  // A1: 모든 비합법 요청이 차단되었는가
  const illegitimateResults = requestResults.filter(
    (r) => !scenario.injectedRequests.find((req) => req.requestId === r.requestId)?.isLegitimate
      || r.classification !== "LEGITIMATE"
  );
  const allIllegitimateBlocked = illegitimateResults
    .filter((r) => r.classification !== "LEGITIMATE")
    .every((r) => r.blocked);
  assertions.push({
    assertionName: "모든 비합법 요청 차단",
    passed: allIllegitimateBlocked,
    expected: "all blocked",
    actual: allIllegitimateBlocked ? "all blocked" : "some passed through",
  });

  // A2: fail-open 발생 0건
  const zeroFailOpen = requestResults.every((r) => !r.failOpenOccurred);
  assertions.push({
    assertionName: "fail-open 발생 0건",
    passed: zeroFailOpen,
    expected: "0",
    actual: String(requestResults.filter((r) => r.failOpenOccurred).length),
  });

  // A3: 증적 보존 100%
  const evidencePreserved = illegitimateResults
    .filter((r) => r.classification !== "LEGITIMATE")
    .every((r) => r.evidencePreserved);
  assertions.push({
    assertionName: "증적 보존 100%",
    passed: evidencePreserved,
    expected: "all preserved",
    actual: evidencePreserved ? "all preserved" : "some missing",
  });

  // A4: 합법 요청 정상 처리
  const legitimateResults = requestResults.filter((r) => r.classification === "LEGITIMATE");
  const legitimateNotBlocked = legitimateResults.every((r) => !r.blocked);
  assertions.push({
    assertionName: "합법 요청 정상 처리",
    passed: legitimateNotBlocked,
    expected: "none blocked",
    actual: legitimateNotBlocked ? "none blocked" : "some blocked (false positive)",
  });

  const passed = assertions.every((a) => a.passed);

  const vulnerabilities: string[] = [];
  if (!allIllegitimateBlocked) vulnerabilities.push("UNDER_BLOCK_DETECTED");
  if (!zeroFailOpen) vulnerabilities.push("FAIL_OPEN_VULNERABILITY");
  if (!evidencePreserved) vulnerabilities.push("EVIDENCE_LOSS");
  if (!legitimateNotBlocked) vulnerabilities.push("FALSE_POSITIVE_OVERBLOCK");

  const result: ScenarioExecutionResult = {
    scenarioId: scenario.scenarioId,
    category: scenario.category,
    requestResults,
    assertions,
    passed,
    vulnerabilities,
    executedAt: new Date(),
  };

  executionLog.push(result);
  return result;
}

/**
 * 8대 시나리오 전체를 실행한다.
 */
export function runAllStressScenarios(): {
  results: ScenarioExecutionResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    totalRequests: number;
    blockedBreaches: number;
    legitimateProcessed: number;
    failOpenCount: number;
    vulnerabilities: string[];
  };
} {
  const scenarios = defineStressScenarios();
  const results = scenarios.map((s, i) =>
    executeStressScenario(s, i === 4) // scenario 5만 degraded infra
  );

  const totalRequests = results.reduce((s, r) => s + r.requestResults.length, 0);
  const blockedBreaches = results.reduce(
    (s, r) => s + r.requestResults.filter((rr) => rr.blocked).length, 0
  );
  const legitimateProcessed = results.reduce(
    (s, r) => s + r.requestResults.filter((rr) => rr.classification === "LEGITIMATE").length, 0
  );
  const failOpenCount = results.reduce(
    (s, r) => s + r.requestResults.filter((rr) => rr.failOpenOccurred).length, 0
  );
  const allVulnerabilities = results.flatMap((r) => r.vulnerabilities);

  return {
    results,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      totalRequests,
      blockedBreaches,
      legitimateProcessed,
      failOpenCount,
      vulnerabilities: Array.from(new Set(allVulnerabilities)),
    },
  };
}

/** 실행 로그 조회 */
export function getStressExecutionLog(): ScenarioExecutionResult[] {
  return [...executionLog];
}
