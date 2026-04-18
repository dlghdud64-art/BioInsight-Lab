/**
 * Integration Readiness Gate — 신규 시스템 연동 진입 게이트
 *
 * Schema Contract, Idempotency 전략, Rollback 플랜이 없으면
 * 프로덕션 반영을 하드 블록합니다.
 */

// ── Types ──

export interface IntegrationReadinessCheck {
  id: string;
  name: string;
  description: string;
  passed: boolean;
  blockerIfFailed: boolean;
  details?: string;
}

export interface IntegrationReadinessResult {
  systemId: string;
  checkedAt: string;
  overallReady: boolean;
  checks: IntegrationReadinessCheck[];
  blockers: string[];
  warnings: string[];
}

/**
 * 신규 시스템 연동 준비 상태 검증
 */
export function evaluateIntegrationReadiness(params: {
  systemId: string;
  hasSchemaContract: boolean;
  schemaVersioned: boolean;
  hasIdempotencyStrategy: boolean;
  idempotencyKeyDefined: boolean;
  hasRollbackPlan: boolean;
  rollbackTested: boolean;
  hasDeadLetterQueue: boolean;
  hasCircuitBreaker: boolean;
  hasMonitoring: boolean;
  hasOwnerTeam: boolean;
  hasRecoveryRunbook: boolean;
  dataClassificationDone: boolean;
  sotMatrixUpdated: boolean;
}): IntegrationReadinessResult {
  const checks: IntegrationReadinessCheck[] = [];

  checks.push({
    id: "IR_001", name: "Schema Contract", description: "이벤트/API 스키마 계약이 정의되어야 합니다",
    passed: params.hasSchemaContract, blockerIfFailed: true,
  });

  checks.push({
    id: "IR_002", name: "Schema Versioning", description: "스키마 버전 관리 전략이 있어야 합니다",
    passed: params.schemaVersioned, blockerIfFailed: true,
  });

  checks.push({
    id: "IR_003", name: "Idempotency Strategy", description: "멱등성 전략이 정의되어야 합니다",
    passed: params.hasIdempotencyStrategy, blockerIfFailed: true,
  });

  checks.push({
    id: "IR_004", name: "Idempotency Key", description: "멱등성 키가 정의되어야 합니다",
    passed: params.idempotencyKeyDefined, blockerIfFailed: true,
  });

  checks.push({
    id: "IR_005", name: "Rollback Plan", description: "연동 롤백 플랜이 있어야 합니다",
    passed: params.hasRollbackPlan, blockerIfFailed: true,
  });

  checks.push({
    id: "IR_006", name: "Rollback Test", description: "롤백 플랜이 테스트되어야 합니다",
    passed: params.rollbackTested, blockerIfFailed: false,
  });

  checks.push({
    id: "IR_007", name: "Dead Letter Queue", description: "실패 이벤트를 위한 DLQ가 구성되어야 합니다",
    passed: params.hasDeadLetterQueue, blockerIfFailed: true,
  });

  checks.push({
    id: "IR_008", name: "Circuit Breaker", description: "서킷 브레이커가 구성되어야 합니다",
    passed: params.hasCircuitBreaker, blockerIfFailed: true,
  });

  checks.push({
    id: "IR_009", name: "Monitoring", description: "연동 모니터링이 구성되어야 합니다",
    passed: params.hasMonitoring, blockerIfFailed: true,
  });

  checks.push({
    id: "IR_010", name: "Owner Team", description: "연동 소유 팀이 지정되어야 합니다",
    passed: params.hasOwnerTeam, blockerIfFailed: true,
  });

  checks.push({
    id: "IR_011", name: "Recovery Runbook", description: "장애 복구 런북이 작성되어야 합니다",
    passed: params.hasRecoveryRunbook, blockerIfFailed: false,
  });

  checks.push({
    id: "IR_012", name: "Data Classification", description: "데이터 분류가 완료되어야 합니다",
    passed: params.dataClassificationDone, blockerIfFailed: true,
  });

  checks.push({
    id: "IR_013", name: "SoT Matrix Updated", description: "Source of Truth 매트릭스가 갱신되어야 합니다",
    passed: params.sotMatrixUpdated, blockerIfFailed: true,
  });

  const blockers = checks.filter((c) => !c.passed && c.blockerIfFailed).map((c) => c.name);
  const warnings = checks.filter((c) => !c.passed && !c.blockerIfFailed).map((c) => c.name);

  return {
    systemId: params.systemId,
    checkedAt: new Date().toISOString(),
    overallReady: blockers.length === 0,
    checks,
    blockers,
    warnings,
  };
}
