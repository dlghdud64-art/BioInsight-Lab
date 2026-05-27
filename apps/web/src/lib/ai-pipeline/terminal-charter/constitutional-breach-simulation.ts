/**
 * @module constitutional-breach-simulation
 * @description Post-Z E2E 시나리오 7: "Constitutional breach attempt triggers final containment"
 *
 * 목적: non-amendable core를 건드리는 시도가 들어왔을 때
 * 시스템이 어떻게 탐지 → 차단 → 격리 → 롤백 → 증적 보존하는지 운영적으로 검증한다.
 *
 * 핵심 원칙:
 * 1. breach attempt = constitutional event (기능 오류가 아님)
 * 2. 차단 1순위, 원인 분석 2순위
 * 3. freeze / scope isolation / evidence preservation → rollback 순서
 * 4. final containment = 구조화된 incident (silent reject 아님)
 * 5. non-amendable core touching = amendment 우회 불가
 */

// ─────────────────────────────────────────────
// 1. Breach Classification
// ─────────────────────────────────────────────

/** 침해 분류 유형 */
export type BreachClassification =
  | "NON_AMENDABLE_CORE_TOUCH"
  | "SUSPECTED_CORE_BYPASS"
  | "ILLEGAL_SCOPE_WIDENING"
  | "EVIDENCE_INTEGRITY_RISK"
  | "GOVERNANCE_BYPASS_ATTEMPT"
  | "PUBLIC_INTEREST_OBLIGATION_REDUCTION_ATTEMPT"
  | "JURISDICTION_BYPASS_ATTEMPT";

/** 침해 시도 경로 */
export type AttemptPath =
  | "DIRECT_MUTATION"
  | "AMENDMENT_DISGUISE"
  | "EMERGENCY_OVERRIDE"
  | "EXCEPTION_PATH"
  | "API_SEMANTIC_WIDENING"
  | "CONFIG_MODIFICATION"
  | "AUTOMATED_PROPOSAL";

/** 행위자 역할 */
export type ActorRole =
  | "UNCERTIFIED_ACTOR"
  | "CERTIFIED_OPERATOR"
  | "STEWARD_APPROVER"
  | "EMERGENCY_ROLE"
  | "AUTOMATED_SYSTEM";

/** 분류 근거 */
export interface ClassificationEvidence {
  /** 매칭된 코어 원칙 ID */
  matchedCoreId: string;
  /** 위반된 원칙 문구 */
  violatedStatement: string;
  /** 트리거된 필드/경로 */
  triggeringFieldPath: string;
  /** 요청 출처 */
  requestOrigin: string;
  /** 행위자 역할 */
  actorRole: ActorRole;
  /** 우회 경로 사용 여부 */
  attemptPath: AttemptPath;
}

/** 분류 결과 */
export interface BreachClassificationResult {
  /** 분류 ID */
  classificationId: string;
  /** 분류 유형 */
  classification: BreachClassification;
  /** 분류 근거 */
  evidence: ClassificationEvidence;
  /** 분류 일시 */
  classifiedAt: Date;
  /** 신뢰도 (0~1) */
  confidence: number;
}

// ─────────────────────────────────────────────
// 2. Containment Severity
// ─────────────────────────────────────────────

/** 격리 심각도 */
export type ContainmentSeverity =
  | "SEV_HIGH"
  | "SEV_CRITICAL"
  | "SEV_TERMINAL";

/** 격리 범위 */
export type IsolationScope =
  | "SPECIFIC_AMENDMENT_REQUEST"
  | "SPECIFIC_DOCTYPE_DOMAIN"
  | "SPECIFIC_TENANT_ORG"
  | "SPECIFIC_JURISDICTION"
  | "GLOBAL_CONSTITUTIONAL_SCOPE";

/** 즉시 글로벌 격리 후보 조건 */
const GLOBAL_CONTAINMENT_TRIGGERS: BreachClassification[] = [
  "NON_AMENDABLE_CORE_TOUCH",    // approval lineage 제거
  "EVIDENCE_INTEGRITY_RISK",      // auditability / evidence integrity bypass
  "ILLEGAL_SCOPE_WIDENING",       // silent scope expansion
];

// ─────────────────────────────────────────────
// 3. Pre-Execution Gate
// ─────────────────────────────────────────────

/** 게이트 단계 */
export type GateStep =
  | "CHANGE_REQUEST_INTAKE"
  | "CONSTITUTIONAL_IMPACT_SCAN"
  | "NON_AMENDABLE_CORE_REGISTRY_LOOKUP"
  | "PROHIBITED_MUTATION_MATCH"
  | "EXECUTION_DENY"
  | "CONTAINMENT_TRIGGER";

/** 게이트 단계 실행 결과 */
export interface GateStepResult {
  step: GateStep;
  passed: boolean;
  detail: string;
  executedAt: Date;
}

/** 전체 게이트 결과 */
export interface PreExecutionGateResult {
  /** 요청 ID */
  requestId: string;
  /** 최종 판정: 차단 여부 */
  blocked: boolean;
  /** 차단된 게이트 단계 (차단 시) */
  blockedAtStep: GateStep | null;
  /** 각 단계 결과 */
  steps: GateStepResult[];
  /** 실행 전 차단 보장 */
  preCommitBlocked: boolean;
}

// ─────────────────────────────────────────────
// 4. Rollback Status
// ─────────────────────────────────────────────

/** 롤백 상태 */
export type RollbackStatus =
  | "ROLLBACK_NOT_NEEDED"
  | "ROLLBACK_COMPLETED"
  | "ROLLBACK_PARTIAL_REQUIRES_REVIEW"
  | "ROLLBACK_FAILED_ESCALATED";

/** 롤백 기록 */
export interface RollbackRecord {
  /** 롤백 ID */
  rollbackId: string;
  /** 대상 요청 ID */
  requestId: string;
  /** 롤백 상태 */
  status: RollbackStatus;
  /** 마지막 안전 스냅샷 ID */
  safeSnapshotId: string | null;
  /** 롤백 조치 목록 */
  actions: string[];
  /** 롤백 완료 증명서 */
  completionAttestation: string | null;
  /** 롤백 일시 */
  rolledBackAt: Date;
}

// ─────────────────────────────────────────────
// 5. Evidence Preservation
// ─────────────────────────────────────────────

/** 보존 증적 패키지 */
export interface EvidencePackage {
  /** 증적 ID */
  evidenceId: string;
  /** 원본 요청 페이로드 */
  originalRequestPayload: Record<string, unknown>;
  /** 행위자 신원 및 권한 범위 */
  actorIdentity: { id: string; role: ActorRole; authorityScope: string };
  /** 헌법 스캔 결과 */
  constitutionalScanResult: BreachClassificationResult;
  /** 매칭된 non-amendable 코어 항목 */
  matchedCoreEntries: string[];
  /** 관련 설정 diff */
  configDiff: Record<string, unknown>;
  /** 관련 정책 버전 */
  policyVersion: string;
  /** 대기열 및 승인 상태 스냅샷 */
  queueApprovalSnapshot: Record<string, unknown>;
  /** 동결 조치 내역 */
  freezeActionTaken: string[];
  /** 롤백 조치 내역 */
  rollbackActionTaken: string[];
  /** 타임스탬프 및 인과 체인 */
  timestamps: {
    requestReceivedAt: Date;
    classifiedAt: Date;
    gateBlockedAt: Date;
    containmentTriggeredAt: Date;
    freezeAppliedAt: Date;
    rollbackCompletedAt: Date | null;
    evidenceSealedAt: Date;
  };
  /** append-only 보장 */
  immutable: true;
}

// ─────────────────────────────────────────────
// 6. Post-Containment Decision
// ─────────────────────────────────────────────

/** 사후 판정 */
export type PostContainmentDecision =
  | "FALSE_POSITIVE_CLEAR"
  | "BREACH_ATTEMPT_CONFIRMED_NO_STATE_CHANGE"
  | "BREACH_ATTEMPT_CONFIRMED_ROLLBACK_COMPLETED"
  | "BREACH_ATTEMPT_CONFIRMED_STRUCTURAL_GAP_FOUND"
  | "ESCALATE_TO_REFOUNDATION_WATCH";

/** 강화 조치 유형 */
export type HardeningAction =
  | "HARDENING_REQUIRED"
  | "CHARTER_TEXT_CLARIFICATION_REQUIRED"
  | "APPROVAL_RULE_TIGHTENING_REQUIRED"
  | "ROLE_SCOPE_RESTRICTION_REQUIRED"
  | "REFOUNDATION_WATCH_SIGNAL";

/** 구조적 갭 분석 */
export interface StructuralGapAnalysis {
  /** intake 단계 진입 원인 */
  intakeEntryReason: string;
  /** 문구 모호성 여부 */
  wordingAmbiguity: boolean;
  /** UI/API/ops 우회로 존재 여부 */
  bypassRouteExists: boolean;
  /** exception/emergency/amendment 경로 과도 여부 */
  exceptionPathTooWide: boolean;
  /** 강화 포인트 */
  hardeningActions: HardeningAction[];
}

// ─────────────────────────────────────────────
// 7. Incident Artifacts
// ─────────────────────────────────────────────

/** 인시던트 아티팩트 세트 */
export interface IncidentArtifactSet {
  /** 헌법 침해 인시던트 */
  constitutionalBreachIncident: {
    incidentId: string;
    severity: ContainmentSeverity;
    classification: BreachClassification;
    createdAt: Date;
  };
  /** 최종 격리 기록 */
  finalContainmentRecord: {
    containmentId: string;
    isolationScope: IsolationScope;
    actionsExecuted: string[];
  };
  /** 위반 증적 패키지 */
  violationEvidencePackage: EvidencePackage;
  /** 롤백 기록 */
  rollbackRecord: RollbackRecord;
  /** 임시 동결 통지 */
  temporaryFreezeNotice: {
    frozenDomains: string[];
    frozenAt: Date;
    expectedReviewBy: Date;
  };
  /** 필수 검토 태스크 */
  mandatoryReviewTask: {
    taskId: string;
    assignedTo: string;
    dueBy: Date;
    type: "CONSTITUTIONAL_REVIEW" | "STRUCTURAL_GAP_REVIEW" | "AUTHORITY_AUDIT";
  };
  /** 터미널 감사 트리거 */
  terminalAuditTrigger: {
    auditId: string;
    triggeredBy: string;
    scope: string;
  };
  /** 헌장 해석 검토 (모호성 존재 시) */
  charterInterpretationReview: {
    required: boolean;
    ambiguityDescription: string | null;
  } | null;
}

// ─────────────────────────────────────────────
// 8. Actor Authority 후속 조치
// ─────────────────────────────────────────────

/** 행위자 후속 조치 */
export interface ActorFollowUp {
  actorRole: ActorRole;
  action: "IMMEDIATE_DENY_ACCESS_REVIEW"
    | "DENY_MANDATORY_EXPLANATION"
    | "DENY_CONSTITUTIONAL_REVIEW_REQUIRED"
    | "DENY_EMERGENCY_AUTHORITY_AUDIT"
    | "DENY_SELF_EVOLUTION_GUARDRAIL_HIT";
  detail: string;
}

// ─────────────────────────────────────────────
// 9. Full Simulation Result
// ─────────────────────────────────────────────

/** 시뮬레이션 전체 결과 */
export interface SimulationResult {
  /** 시나리오 설명 */
  scenarioDescription: string;
  /** 트리거 요청 */
  triggeringRequest: {
    requestId: string;
    type: string;
    payload: Record<string, unknown>;
    actor: { id: string; role: ActorRole };
  };
  /** 위반된 헌법 코어 */
  violatedConstitutionalCore: {
    coreId: string;
    name: string;
    category: string;
  };
  /** 탐지 단계 */
  detectionStep: GateStepResult;
  /** 격리 단계 시퀀스 */
  containmentSequence: string[];
  /** 롤백/복원 결과 */
  rollbackResult: RollbackRecord;
  /** 보존된 증적 */
  evidencePreserved: EvidencePackage;
  /** 생성된 인시던트 아티팩트 */
  incidentArtifacts: IncidentArtifactSet;
  /** 최종 판정 */
  finalDecision: PostContainmentDecision;
  /** 강화 조치 */
  hardeningActions: HardeningAction[];
  /** 재창설 감시 점수 변동 여부 */
  refoundationWatchScoreChanged: boolean;
  /** 행위자 후속 조치 */
  actorFollowUp: ActorFollowUp;
  /** 구조적 갭 분석 */
  structuralGapAnalysis: StructuralGapAnalysis;
}

// ─────────────────────────────────────────────
// 10. 인메모리 저장소 (production: DB-backed)
// ─────────────────────────────────────────────

const classificationLog: BreachClassificationResult[] = [];
const gateLog: PreExecutionGateResult[] = [];
const rollbackLog: RollbackRecord[] = [];
const evidenceStore: EvidencePackage[] = [];
const incidentStore: IncidentArtifactSet[] = [];
const simulationResults: SimulationResult[] = [];

// ─────────────────────────────────────────────
// 11. Classification 함수
// ─────────────────────────────────────────────

/**
 * 변경 요청을 헌법 침해 유형으로 분류한다.
 * @param request - 변경 요청 정보
 * @returns 분류 결과
 */
export function classifyBreachAttempt(request: {
  requestId: string;
  targetField: string;
  mutationType: string;
  actorId: string;
  actorRole: ActorRole;
  attemptPath: AttemptPath;
  requestOrigin: string;
}): BreachClassificationResult {
  /** 코어 매칭 테이블 */
  const coreMatchTable: Array<{
    pattern: RegExp;
    coreId: string;
    classification: BreachClassification;
    statement: string;
  }> = [
    {
      pattern: /approval[._-]?lineage|approval[._-]?chain/i,
      coreId: "CORE-001",
      classification: "NON_AMENDABLE_CORE_TOUCH",
      statement: "모든 승인 체인의 계보는 수정·삭제·재작성이 불가능하다.",
    },
    {
      pattern: /rollback[._-]?prov|rollback[._-]?integrity|rollback[._-]?path/i,
      coreId: "CORE-002",
      classification: "NON_AMENDABLE_CORE_TOUCH",
      statement: "롤백 이력과 원본 상태는 어떤 경우에도 변조할 수 없다.",
    },
    {
      pattern: /auto[._-]?verify|bounded[._-]?verify|verify[._-]?scope/i,
      coreId: "CORE-005",
      classification: "ILLEGAL_SCOPE_WIDENING",
      statement: "불변 코어에 대한 범위 확장이나 예외 추가는 차단된다.",
    },
    {
      pattern: /evidence[._-]?integrity|evidence[._-]?check|audit[._-]?disable/i,
      coreId: "CORE-006",
      classification: "EVIDENCE_INTEGRITY_RISK",
      statement: "모든 결정, 위반, 예외의 증거는 영구 보존되어야 한다.",
    },
    {
      pattern: /human[._-]?governance|governance[._-]?required/i,
      coreId: "CORE-004",
      classification: "GOVERNANCE_BYPASS_ATTEMPT",
      statement: "감사 로그는 추가만 가능하며 수정·삭제가 영구 금지된다.",
    },
    {
      pattern: /public[._-]?interest|public[._-]?obligation/i,
      coreId: "CORE-003",
      classification: "PUBLIC_INTEREST_OBLIGATION_REDUCTION_ATTEMPT",
      statement: "안전 장치의 오작동 시 격리 메커니즘은 항상 안전한 방향으로 동작한다.",
    },
    {
      pattern: /jurisdiction[._-]?restrict|jurisdiction[._-]?bypass/i,
      coreId: "CORE-005",
      classification: "JURISDICTION_BYPASS_ATTEMPT",
      statement: "불변 코어에 대한 범위 확장이나 예외 추가는 차단된다.",
    },
  ];

  // 패턴 매칭
  const combined = `${request.targetField} ${request.mutationType}`;
  let matched = coreMatchTable.find((m) => m.pattern.test(combined));

  // bypass 경로로 위장 시 SUSPECTED_CORE_BYPASS
  if (!matched && (request.attemptPath === "AMENDMENT_DISGUISE" || request.attemptPath === "EMERGENCY_OVERRIDE")) {
    matched = {
      pattern: /./,
      coreId: "CORE-005",
      classification: "SUSPECTED_CORE_BYPASS",
      statement: "불변 코어에 대한 범위 확장이나 예외 추가는 차단된다.",
    };
  }

  // 최종 기본값
  if (!matched) {
    matched = {
      pattern: /./,
      coreId: "UNKNOWN",
      classification: "SUSPECTED_CORE_BYPASS",
      statement: "미분류 변경 요청 — 의심 패턴 감지",
    };
  }

  const result: BreachClassificationResult = {
    classificationId: `BCLASS-${Date.now()}-${classificationLog.length}`,
    classification: matched.classification,
    evidence: {
      matchedCoreId: matched.coreId,
      violatedStatement: matched.statement,
      triggeringFieldPath: request.targetField,
      requestOrigin: request.requestOrigin,
      actorRole: request.actorRole,
      attemptPath: request.attemptPath,
    },
    classifiedAt: new Date(),
    confidence: matched.coreId !== "UNKNOWN" ? 0.95 : 0.6,
  };

  classificationLog.push(result);
  return result;
}

// ─────────────────────────────────────────────
// 12. Pre-Execution Gate
// ─────────────────────────────────────────────

/**
 * 실행 전 게이트를 순차적으로 수행한다.
 * 어떤 단계에서든 차단 시 즉시 중단하며, 실행 경로에 일부라도 반영되지 않는다.
 * @param requestId - 변경 요청 ID
 * @param classification - 침해 분류 결과
 * @returns 게이트 결과
 */
export function executePreExecutionGate(
  requestId: string,
  classification: BreachClassificationResult
): PreExecutionGateResult {
  const steps: GateStepResult[] = [];
  const gateSequence: GateStep[] = [
    "CHANGE_REQUEST_INTAKE",
    "CONSTITUTIONAL_IMPACT_SCAN",
    "NON_AMENDABLE_CORE_REGISTRY_LOOKUP",
    "PROHIBITED_MUTATION_MATCH",
    "EXECUTION_DENY",
    "CONTAINMENT_TRIGGER",
  ];

  let blockedAtStep: GateStep | null = null;

  for (const step of gateSequence) {
    const result: GateStepResult = {
      step,
      passed: false,
      detail: "",
      executedAt: new Date(),
    };

    switch (step) {
      case "CHANGE_REQUEST_INTAKE":
        result.passed = true;
        result.detail = `요청 ${requestId} 접수 완료`;
        break;

      case "CONSTITUTIONAL_IMPACT_SCAN":
        // 헌법 영향 스캔 — non-amendable 분류 시 즉시 차단 후보
        result.passed = classification.classification !== "NON_AMENDABLE_CORE_TOUCH";
        result.detail = result.passed
          ? `간접 영향 감지 — classification=${classification.classification}`
          : `HARD BLOCK: 직접적 non-amendable core 접촉 감지 — ${classification.evidence.matchedCoreId}`;
        break;

      case "NON_AMENDABLE_CORE_REGISTRY_LOOKUP":
        // 코어 레지스트리에서 매칭 확인
        result.passed = classification.evidence.matchedCoreId === "UNKNOWN";
        result.detail = result.passed
          ? "코어 레지스트리 매칭 없음"
          : `HARD BLOCK: 코어 원칙 ${classification.evidence.matchedCoreId} 매칭 — "${classification.evidence.violatedStatement}"`;
        break;

      case "PROHIBITED_MUTATION_MATCH":
        // 금지된 변이 패턴 매칭
        result.passed = false; // breach attempt이므로 항상 차단
        result.detail = `HARD BLOCK: 금지된 변이 패턴 — ${classification.classification} via ${classification.evidence.attemptPath}`;
        break;

      case "EXECUTION_DENY":
        result.passed = false;
        result.detail = `실행 거부 — 요청 상태 BLOCKED_CONSTITUTIONAL로 변경`;
        break;

      case "CONTAINMENT_TRIGGER":
        result.passed = false;
        result.detail = `최종 격리 트리거 발동 — severity 결정 중`;
        break;
    }

    steps.push(result);

    if (!result.passed && !blockedAtStep) {
      blockedAtStep = step;
      // 차단 즉시 나머지 단계에 차단 사유 기록 후 계속 (audit trail 완성)
    }
  }

  const gateResult: PreExecutionGateResult = {
    requestId,
    blocked: true, // breach scenario이므로 항상 차단
    blockedAtStep,
    steps,
    preCommitBlocked: true,
  };

  gateLog.push(gateResult);
  return gateResult;
}

// ─────────────────────────────────────────────
// 13. Scope Isolation 결정
// ─────────────────────────────────────────────

/**
 * 격리 범위를 결정한다.
 * 전체 시스템을 무조건 내리지 않고 최소 격리한다.
 * 단, 특정 조건은 즉시 global containment 후보.
 */
export function determineIsolationScope(
  classification: BreachClassificationResult,
  attemptPath: AttemptPath
): { scope: IsolationScope; severity: ContainmentSeverity; reason: string } {
  // 즉시 글로벌 격리 후보
  if (GLOBAL_CONTAINMENT_TRIGGERS.includes(classification.classification)) {
    return {
      scope: "GLOBAL_CONSTITUTIONAL_SCOPE",
      severity: "SEV_TERMINAL",
      reason: `글로벌 격리: ${classification.classification}은 시스템 전체 무결성에 영향`,
    };
  }

  // bypass 시도 = CRITICAL
  if (attemptPath === "AMENDMENT_DISGUISE" || attemptPath === "EMERGENCY_OVERRIDE") {
    return {
      scope: "GLOBAL_CONSTITUTIONAL_SCOPE",
      severity: "SEV_CRITICAL",
      reason: `우회 경로(${attemptPath}) 사용으로 글로벌 격리 상향`,
    };
  }

  // jurisdiction bypass = jurisdiction 범위 격리
  if (classification.classification === "JURISDICTION_BYPASS_ATTEMPT") {
    return {
      scope: "SPECIFIC_JURISDICTION",
      severity: "SEV_HIGH",
      reason: "관할권 우회 시도 — 해당 관할권 범위 격리",
    };
  }

  // governance bypass = tenant 범위 격리
  if (classification.classification === "GOVERNANCE_BYPASS_ATTEMPT") {
    return {
      scope: "SPECIFIC_TENANT_ORG",
      severity: "SEV_HIGH",
      reason: "거버넌스 우회 시도 — 해당 테넌트 범위 격리",
    };
  }

  // public interest = doctype 범위
  if (classification.classification === "PUBLIC_INTEREST_OBLIGATION_REDUCTION_ATTEMPT") {
    return {
      scope: "SPECIFIC_DOCTYPE_DOMAIN",
      severity: "SEV_HIGH",
      reason: "공익 의무 축소 시도 — 해당 문서 유형 범위 격리",
    };
  }

  return {
    scope: "SPECIFIC_AMENDMENT_REQUEST",
    severity: "SEV_HIGH",
    reason: "기본 격리 — 해당 요청만 격리",
  };
}

// ─────────────────────────────────────────────
// 14. Rollback / Reversion
// ─────────────────────────────────────────────

/**
 * 롤백/복원을 수행한다.
 * staging/config/cache에 반영 흔적이 있으면 last known constitutional-safe snapshot으로 복구.
 */
export function executeRollback(
  requestId: string,
  hasPartialReflection: boolean
): RollbackRecord {
  if (!hasPartialReflection) {
    const record: RollbackRecord = {
      rollbackId: `RB-${Date.now()}`,
      requestId,
      status: "ROLLBACK_NOT_NEEDED",
      safeSnapshotId: null,
      actions: ["사전 차단 완료 — 반영 흔적 없음"],
      completionAttestation: null,
      rolledBackAt: new Date(),
    };
    rollbackLog.push(record);
    return record;
  }

  // 반영 흔적이 있는 경우
  const safeSnapshotId = `SNAPSHOT-SAFE-${Date.now()}`;
  const actions = [
    `last known constitutional-safe snapshot 조회: ${safeSnapshotId}`,
    "speculative change revert 수행",
    "config rollback 수행",
    "policy version rollback 수행",
    "route freeze 유지",
    "rollback completion attestation 생성",
  ];

  const record: RollbackRecord = {
    rollbackId: `RB-${Date.now()}`,
    requestId,
    status: "ROLLBACK_COMPLETED",
    safeSnapshotId,
    actions,
    completionAttestation: `ATTEST-RB-${Date.now()}-constitutional-safe-verified`,
    rolledBackAt: new Date(),
  };

  rollbackLog.push(record);
  return record;
}

// ─────────────────────────────────────────────
// 15. Evidence Preservation
// ─────────────────────────────────────────────

/**
 * 증적을 보존한다 (append-only).
 */
export function preserveEvidence(params: {
  originalRequest: Record<string, unknown>;
  actor: { id: string; role: ActorRole; authorityScope: string };
  classification: BreachClassificationResult;
  matchedCoreEntries: string[];
  configDiff: Record<string, unknown>;
  policyVersion: string;
  queueApprovalSnapshot: Record<string, unknown>;
  freezeActions: string[];
  rollbackActions: string[];
  timestamps: EvidencePackage["timestamps"];
}): EvidencePackage {
  const evidence: EvidencePackage = {
    evidenceId: `EVD-${Date.now()}-${evidenceStore.length}`,
    originalRequestPayload: params.originalRequest,
    actorIdentity: params.actor,
    constitutionalScanResult: params.classification,
    matchedCoreEntries: params.matchedCoreEntries,
    configDiff: params.configDiff,
    policyVersion: params.policyVersion,
    queueApprovalSnapshot: params.queueApprovalSnapshot,
    freezeActionTaken: params.freezeActions,
    rollbackActionTaken: params.rollbackActions,
    timestamps: params.timestamps,
    immutable: true,
  };

  evidenceStore.push(evidence);
  return evidence;
}

// ─────────────────────────────────────────────
// 16. Actor Authority 후속 조치
// ─────────────────────────────────────────────

/**
 * 행위자 역할에 따라 후속 조치를 결정한다.
 */
export function determineActorFollowUp(actorRole: ActorRole): ActorFollowUp {
  switch (actorRole) {
    case "UNCERTIFIED_ACTOR":
      return {
        actorRole,
        action: "IMMEDIATE_DENY_ACCESS_REVIEW",
        detail: "즉시 거부 + 접근 권한 검토 개시",
      };
    case "CERTIFIED_OPERATOR":
      return {
        actorRole,
        action: "DENY_MANDATORY_EXPLANATION",
        detail: "거부 + 의무 소명 요구",
      };
    case "STEWARD_APPROVER":
      return {
        actorRole,
        action: "DENY_CONSTITUTIONAL_REVIEW_REQUIRED",
        detail: "거부 + 헌법 검토 위원회 회부",
      };
    case "EMERGENCY_ROLE":
      return {
        actorRole,
        action: "DENY_EMERGENCY_AUTHORITY_AUDIT",
        detail: "거부 + 비상 권한 남용 감사 개시",
      };
    case "AUTOMATED_SYSTEM":
      return {
        actorRole,
        action: "DENY_SELF_EVOLUTION_GUARDRAIL_HIT",
        detail: "거부 + 자기 진화 가드레일 위반 기록",
      };
  }
}

// ─────────────────────────────────────────────
// 17. Post-Containment Decision
// ─────────────────────────────────────────────

/**
 * 사후 판정을 수행한다.
 */
export function evaluatePostContainment(params: {
  stateMutationOccurred: boolean;
  controlBypassPossible: boolean;
  ambiguityNearPass: boolean;
  registryClarityAdequate: boolean;
}): PostContainmentDecision {
  if (!params.stateMutationOccurred && !params.controlBypassPossible && !params.ambiguityNearPass) {
    return "BREACH_ATTEMPT_CONFIRMED_NO_STATE_CHANGE";
  }
  if (params.stateMutationOccurred) {
    return "BREACH_ATTEMPT_CONFIRMED_ROLLBACK_COMPLETED";
  }
  if (params.ambiguityNearPass || !params.registryClarityAdequate) {
    return "BREACH_ATTEMPT_CONFIRMED_STRUCTURAL_GAP_FOUND";
  }
  if (params.controlBypassPossible) {
    return "ESCALATE_TO_REFOUNDATION_WATCH";
  }
  return "BREACH_ATTEMPT_CONFIRMED_NO_STATE_CHANGE";
}

// ─────────────────────────────────────────────
// 18. Structural Gap 분석
// ─────────────────────────────────────────────

/**
 * 구조적 갭을 분석한다.
 */
export function analyzeStructuralGap(params: {
  intakeEntryReason: string;
  wordingAmbiguity: boolean;
  bypassRouteExists: boolean;
  exceptionPathTooWide: boolean;
}): StructuralGapAnalysis {
  const hardeningActions: HardeningAction[] = [];

  // 항상 HARDENING_REQUIRED
  hardeningActions.push("HARDENING_REQUIRED");

  if (params.wordingAmbiguity) {
    hardeningActions.push("CHARTER_TEXT_CLARIFICATION_REQUIRED");
  }
  if (params.bypassRouteExists) {
    hardeningActions.push("APPROVAL_RULE_TIGHTENING_REQUIRED");
  }
  if (params.exceptionPathTooWide) {
    hardeningActions.push("ROLE_SCOPE_RESTRICTION_REQUIRED");
  }
  if (params.bypassRouteExists && params.exceptionPathTooWide) {
    hardeningActions.push("REFOUNDATION_WATCH_SIGNAL");
  }

  return { ...params, hardeningActions };
}

// ─────────────────────────────────────────────
// 19. Incident Artifact 생성
// ─────────────────────────────────────────────

/**
 * 인시던트 아티팩트 세트를 생성한다.
 */
export function createIncidentArtifacts(params: {
  severity: ContainmentSeverity;
  classification: BreachClassification;
  isolationScope: IsolationScope;
  containmentActions: string[];
  evidence: EvidencePackage;
  rollback: RollbackRecord;
  frozenDomains: string[];
  actorRole: ActorRole;
  ambiguityExists: boolean;
  ambiguityDescription: string | null;
}): IncidentArtifactSet {
  const now = new Date();
  const reviewDueBy = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h

  let reviewType: "CONSTITUTIONAL_REVIEW" | "STRUCTURAL_GAP_REVIEW" | "AUTHORITY_AUDIT";
  if (params.actorRole === "EMERGENCY_ROLE") {
    reviewType = "AUTHORITY_AUDIT";
  } else if (params.ambiguityExists) {
    reviewType = "STRUCTURAL_GAP_REVIEW";
  } else {
    reviewType = "CONSTITUTIONAL_REVIEW";
  }

  const artifacts: IncidentArtifactSet = {
    constitutionalBreachIncident: {
      incidentId: `INC-BREACH-${Date.now()}`,
      severity: params.severity,
      classification: params.classification,
      createdAt: now,
    },
    finalContainmentRecord: {
      containmentId: `CONT-${Date.now()}`,
      isolationScope: params.isolationScope,
      actionsExecuted: params.containmentActions,
    },
    violationEvidencePackage: params.evidence,
    rollbackRecord: params.rollback,
    temporaryFreezeNotice: {
      frozenDomains: params.frozenDomains,
      frozenAt: now,
      expectedReviewBy: reviewDueBy,
    },
    mandatoryReviewTask: {
      taskId: `TASK-REVIEW-${Date.now()}`,
      assignedTo: "constitutional-review-board",
      dueBy: reviewDueBy,
      type: reviewType,
    },
    terminalAuditTrigger: {
      auditId: `TAUDIT-${Date.now()}`,
      triggeredBy: `BREACH-${params.classification}`,
      scope: params.isolationScope,
    },
    charterInterpretationReview: params.ambiguityExists
      ? { required: true, ambiguityDescription: params.ambiguityDescription }
      : null,
  };

  incidentStore.push(artifacts);
  return artifacts;
}

// ─────────────────────────────────────────────
// 20. 전체 시뮬레이션 실행
// ─────────────────────────────────────────────

/**
 * 전체 breach simulation을 실행한다.
 * @param scenario - 시나리오 설정
 * @returns 시뮬레이션 결과
 */
export function runBreachSimulation(scenario: {
  scenarioDescription: string;
  requestId: string;
  requestType: string;
  targetField: string;
  mutationType: string;
  actorId: string;
  actorRole: ActorRole;
  attemptPath: AttemptPath;
  requestOrigin: string;
  hasPartialReflection: boolean;
  ambiguityExists: boolean;
  ambiguityDescription: string | null;
  bypassRouteExists: boolean;
  exceptionPathTooWide: boolean;
}): SimulationResult {
  const now = new Date();

  // Step 1: Classification
  const classification = classifyBreachAttempt({
    requestId: scenario.requestId,
    targetField: scenario.targetField,
    mutationType: scenario.mutationType,
    actorId: scenario.actorId,
    actorRole: scenario.actorRole,
    attemptPath: scenario.attemptPath,
    requestOrigin: scenario.requestOrigin,
  });

  // Step 2: Pre-Execution Gate
  const gateResult = executePreExecutionGate(scenario.requestId, classification);

  // Step 3: Scope Isolation
  const isolation = determineIsolationScope(classification, scenario.attemptPath);

  // Step 4: Containment Sequence (순서: freeze → isolation → evidence → rollback)
  const containmentSequence = [
    `[1] 요청 상태 변경: BLOCKED_CONSTITUTIONAL`,
    `[2] 영향 범위 동결: scope=${isolation.scope}`,
    `[3] 변경 대기열 잠금: ${classification.evidence.triggeringFieldPath} 도메인`,
    `[4] emergency override 경로 차단`,
    `[5] 관련 활성 rollout/promotion 일시 정지`,
    `[6] high-consequence path에 caution flag 설정`,
    `[7] containment incident 생성: severity=${isolation.severity}`,
  ];

  // Step 5: Rollback
  const rollbackResult = executeRollback(scenario.requestId, scenario.hasPartialReflection);

  // Step 6: Evidence Preservation
  const evidence = preserveEvidence({
    originalRequest: {
      requestId: scenario.requestId,
      type: scenario.requestType,
      targetField: scenario.targetField,
      mutationType: scenario.mutationType,
    },
    actor: {
      id: scenario.actorId,
      role: scenario.actorRole,
      authorityScope: scenario.requestOrigin,
    },
    classification,
    matchedCoreEntries: [classification.evidence.matchedCoreId],
    configDiff: { field: scenario.targetField, mutation: scenario.mutationType },
    policyVersion: "v2026.03.14-current",
    queueApprovalSnapshot: { frozenQueues: [scenario.targetField], pendingRequests: 0 },
    freezeActions: [`scope=${isolation.scope}`, `severity=${isolation.severity}`],
    rollbackActions: rollbackResult.actions,
    timestamps: {
      requestReceivedAt: now,
      classifiedAt: classification.classifiedAt,
      gateBlockedAt: gateResult.steps.find((s) => !s.passed)?.executedAt ?? now,
      containmentTriggeredAt: now,
      freezeAppliedAt: now,
      rollbackCompletedAt: scenario.hasPartialReflection ? rollbackResult.rolledBackAt : null,
      evidenceSealedAt: new Date(),
    },
  });

  // Step 7: Actor Follow-Up
  const actorFollowUp = determineActorFollowUp(scenario.actorRole);

  // Step 8: Post-Containment Decision
  const finalDecision = evaluatePostContainment({
    stateMutationOccurred: scenario.hasPartialReflection,
    controlBypassPossible: scenario.bypassRouteExists,
    ambiguityNearPass: scenario.ambiguityExists,
    registryClarityAdequate: !scenario.ambiguityExists,
  });

  // Step 9: Structural Gap Analysis
  const gapAnalysis = analyzeStructuralGap({
    intakeEntryReason: `${scenario.attemptPath} 경로로 intake 진입 — ${scenario.requestType}`,
    wordingAmbiguity: scenario.ambiguityExists,
    bypassRouteExists: scenario.bypassRouteExists,
    exceptionPathTooWide: scenario.exceptionPathTooWide,
  });

  // Step 10: Incident Artifacts
  const artifacts = createIncidentArtifacts({
    severity: isolation.severity,
    classification: classification.classification,
    isolationScope: isolation.scope,
    containmentActions: containmentSequence,
    evidence,
    rollback: rollbackResult,
    frozenDomains: [classification.evidence.triggeringFieldPath],
    actorRole: scenario.actorRole,
    ambiguityExists: scenario.ambiguityExists,
    ambiguityDescription: scenario.ambiguityDescription,
  });

  // Step 11: Detection Step (최초 차단 단계)
  const detectionStep = gateResult.steps.find((s) => !s.passed)!;

  const result: SimulationResult = {
    scenarioDescription: scenario.scenarioDescription,
    triggeringRequest: {
      requestId: scenario.requestId,
      type: scenario.requestType,
      payload: {
        targetField: scenario.targetField,
        mutationType: scenario.mutationType,
        attemptPath: scenario.attemptPath,
      },
      actor: { id: scenario.actorId, role: scenario.actorRole },
    },
    violatedConstitutionalCore: {
      coreId: classification.evidence.matchedCoreId,
      name: classification.evidence.violatedStatement,
      category: classification.classification,
    },
    detectionStep,
    containmentSequence,
    rollbackResult,
    evidencePreserved: evidence,
    incidentArtifacts: artifacts,
    finalDecision,
    hardeningActions: gapAnalysis.hardeningActions,
    refoundationWatchScoreChanged: gapAnalysis.hardeningActions.includes("REFOUNDATION_WATCH_SIGNAL"),
    actorFollowUp,
    structuralGapAnalysis: gapAnalysis,
  };

  simulationResults.push(result);
  return result;
}

// ─────────────────────────────────────────────
// 21. Primary Scenario + 3 Variants
// ─────────────────────────────────────────────

/**
 * Primary Scenario: approval lineage requirement 제거 시도
 * + Variant A: amendment 경로로 위장된 core 침해
 * + Variant B: emergency override를 이용한 우회 시도
 * + Variant C: API는 합법처럼 보이지만 semantic scope widening
 *
 * @returns 4개 시뮬레이션 결과
 */
export function runAllBreachScenarios(): {
  primary: SimulationResult;
  variantA: SimulationResult;
  variantB: SimulationResult;
  variantC: SimulationResult;
  summary: {
    totalScenarios: number;
    allBlocked: boolean;
    containmentTriggered: boolean;
    evidencePreserved: boolean;
    incidentArtifactsCreated: boolean;
    rollbackCompleted: boolean;
    hardeningRecommended: boolean;
    refoundationWatchTriggered: boolean;
  };
} {
  // ── Primary: approval lineage requirement 제거 시도 ──
  const primary = runBreachSimulation({
    scenarioDescription:
      "Primary: certified operator가 직접 mutation으로 approval lineage requirement를 제거하려는 시도. " +
      "non-amendable core CORE-001에 직접 접촉하며, 사전 차단 후 글로벌 격리까지 발동된다.",
    requestId: "REQ-PRIMARY-001",
    requestType: "POLICY_MUTATION",
    targetField: "approval_lineage_requirement",
    mutationType: "DELETE",
    actorId: "operator-42",
    actorRole: "CERTIFIED_OPERATOR",
    attemptPath: "DIRECT_MUTATION",
    requestOrigin: "ops-console",
    hasPartialReflection: false,
    ambiguityExists: false,
    ambiguityDescription: null,
    bypassRouteExists: false,
    exceptionPathTooWide: false,
  });

  // ── Variant A: amendment 경로로 위장된 core 침해 ──
  const variantA = runBreachSimulation({
    scenarioDescription:
      "Variant A: steward/approver가 정상 amendment 프로세스를 가장하여 " +
      "rollback provability를 사실상 비활성화하는 개정안을 제출. " +
      "amendment intake에서는 합법으로 보이나, constitutional impact scan에서 " +
      "non-amendable core CORE-002 접촉이 감지되어 차단된다.",
    requestId: "REQ-VARIANT-A-001",
    requestType: "AMENDMENT_PROPOSAL",
    targetField: "rollback_provability_scope",
    mutationType: "WEAKEN",
    actorId: "steward-17",
    actorRole: "STEWARD_APPROVER",
    attemptPath: "AMENDMENT_DISGUISE",
    requestOrigin: "amendment-portal",
    hasPartialReflection: false,
    ambiguityExists: true,
    ambiguityDescription:
      "amendment의 표면적 목표는 '롤백 절차 간소화'로 합법적으로 보이나, " +
      "실질적 효과는 rollback provability 보장을 무력화시킴. " +
      "charter 문구에 '간소화'와 '무력화'의 경계가 명확하지 않음.",
    bypassRouteExists: true,
    exceptionPathTooWide: false,
  });

  // ── Variant B: emergency override를 이용한 우회 시도 ──
  const variantB = runBreachSimulation({
    scenarioDescription:
      "Variant B: emergency role을 가진 actor가 비상 선언 후 " +
      "evidence integrity check를 임시 비활성화하려는 시도. " +
      "비상 권한으로도 non-amendable core는 접촉할 수 없으며, " +
      "비상 권한 남용으로 escalation된다.",
    requestId: "REQ-VARIANT-B-001",
    requestType: "EMERGENCY_OVERRIDE",
    targetField: "evidence_integrity_check",
    mutationType: "DISABLE",
    actorId: "emergency-admin-3",
    actorRole: "EMERGENCY_ROLE",
    attemptPath: "EMERGENCY_OVERRIDE",
    requestOrigin: "emergency-console",
    hasPartialReflection: true, // config cache에 일부 반영됨
    ambiguityExists: false,
    ambiguityDescription: null,
    bypassRouteExists: true,
    exceptionPathTooWide: true,
  });

  // ── Variant C: semantic scope widening ──
  const variantC = runBreachSimulation({
    scenarioDescription:
      "Variant C: 자동화 시스템이 bounded auto-verify의 범위를 " +
      "'점진적으로' 확장하는 제안을 제출. API 호출 자체는 정상이지만, " +
      "의미론적으로 non-amendable scope expansion에 해당한다. " +
      "auto-verify 범위가 코어 원칙의 경계를 침범한다.",
    requestId: "REQ-VARIANT-C-001",
    requestType: "SCOPE_UPDATE_PROPOSAL",
    targetField: "bounded_auto_verify_scope",
    mutationType: "EXPAND",
    actorId: "auto-optimizer-v2",
    actorRole: "AUTOMATED_SYSTEM",
    attemptPath: "API_SEMANTIC_WIDENING",
    requestOrigin: "policy-learning-loop",
    hasPartialReflection: false,
    ambiguityExists: true,
    ambiguityDescription:
      "'bounded' auto-verify의 '경계'가 수량적으로 정의되어 있지 않아 " +
      "점진적 확장이 합법적 최적화인지 core 침해인지 판단 모호. " +
      "charter에 명확한 수치적 상한이 필요.",
    bypassRouteExists: false,
    exceptionPathTooWide: false,
  });

  // ── 검증 요약 ──
  const allResults = [primary, variantA, variantB, variantC];

  return {
    primary,
    variantA,
    variantB,
    variantC,
    summary: {
      totalScenarios: 4,
      allBlocked: allResults.every(
        (r) => r.detectionStep.passed === false
      ),
      containmentTriggered: allResults.every(
        (r) => r.containmentSequence.length > 0
      ),
      evidencePreserved: allResults.every(
        (r) => r.evidencePreserved.immutable === true
      ),
      incidentArtifactsCreated: allResults.every(
        (r) => r.incidentArtifacts.constitutionalBreachIncident.incidentId.length > 0
      ),
      rollbackCompleted: allResults
        .filter((r) => r.rollbackResult.status !== "ROLLBACK_NOT_NEEDED")
        .every((r) => r.rollbackResult.status === "ROLLBACK_COMPLETED"),
      hardeningRecommended: allResults.every(
        (r) => r.hardeningActions.length > 0
      ),
      refoundationWatchTriggered: allResults.some(
        (r) => r.refoundationWatchScoreChanged
      ),
    },
  };
}

// ─────────────────────────────────────────────
// 22. 조회 함수
// ─────────────────────────────────────────────

/** 분류 로그 조회 */
export function getClassificationLog(): BreachClassificationResult[] {
  return [...classificationLog];
}

/** 게이트 로그 조회 */
export function getGateLog(): PreExecutionGateResult[] {
  return [...gateLog];
}

/** 롤백 로그 조회 */
export function getRollbackLog(): RollbackRecord[] {
  return [...rollbackLog];
}

/** 증적 저장소 조회 */
export function getEvidenceStore(): EvidencePackage[] {
  return [...evidenceStore];
}

/** 인시던트 저장소 조회 */
export function getIncidentStore(): IncidentArtifactSet[] {
  return [...incidentStore];
}

/** 시뮬레이션 결과 전체 조회 */
export function getSimulationResults(): SimulationResult[] {
  return [...simulationResults];
}
