/**
 * P1-1 Persistence / Prisma Integration — Kickoff Design
 *
 * 운영 신뢰성 hardening. 새 제품 기능 추가 금지.
 * stabilization contract (S0~S6 interface) 깨지 말 것.
 * in-memory 구현을 persistence-backed로 치환하되 interface contract 유지.
 */

// ══════════════════════════════════════════════════════════════════════════════
// 1. P1 Epic Breakdown
// ══════════════════════════════════════════════════════════════════════════════

export interface P1EpicDetail {
  readonly epicId: string;
  readonly title: string;
  readonly objective: string;
  readonly whyNow: string;
  readonly inScope: readonly string[];
  readonly outOfScope: readonly string[];
  readonly dependencies: readonly string[];
  readonly successCriteria: readonly string[];
  readonly releaseRiskIfDelayed: string;
}

export const P1_EPICS: readonly P1EpicDetail[] = [
  {
    epicId: "P1-1",
    title: "Persistence / Prisma Integration",
    objective: "S0~S6의 모든 in-memory store를 Prisma 기반 persistent storage로 전환. 프로세스 재시작/배포 후에도 runtime state 유지.",
    whyNow: "Vercel 배포마다 전체 state 유실. INTERNAL_ONLY release에서도 배포 후 baseline/authority/audit 초기화는 운영 장애 직결.",
    inScope: [
      "Prisma schema 추가 (StabilizationBaseline, AuthorityLine, StabilizationAuditEvent, ProcessedIntake, CanonicalAuditEvent)",
      "repository interface 정의 (IBaselineRepository, IAuthorityRepository, IAuditRepository, IIntakeRepository)",
      "기존 in-memory store를 repository 호출로 치환",
      "migration script (up/down)",
      "기존 105 tests 회귀 없음 확인",
    ],
    outOfScope: [
      "distributed lock / multi-instance 동시성 (P1-2 scope)",
      "INCIDENT_LOCKDOWN recovery transition (P1-3 scope)",
      "새 제품 기능",
      "module decomposition / file restructure",
      "canonical-event-schema.ts 내부 로직 변경",
    ],
    dependencies: [
      "Prisma 5.22.0 + PostgreSQL (이미 설치됨)",
      "db.ts 싱글턴 패턴 (이미 존재)",
      "stabilization.ts 타입 정의 (변경 없이 재사용)",
    ],
    successCriteria: [
      "프로세스 재시작 후 baseline/authority/audit state 복원 확인",
      "S0~S6 105 tests ALL PASS (회귀 없음)",
      "npx prisma migrate dev 성공",
      "npx prisma generate 성공",
      "기존 exported function signature 변경 없음",
    ],
    releaseRiskIfDelayed: "배포마다 전체 stabilization state 초기화. baseline freeze 유실 시 runtime gate lock 무효화. 운영 중 incident 발생 시 audit trail 재구성 불가.",
  },
  {
    epicId: "P1-2",
    title: "Multi-Instance Uniqueness / Distributed Locking",
    objective: "Vercel serverless 환경에서 동시 요청 시 idempotency/authority transfer lock 유효성 보장.",
    whyNow: "P1-1 persistence 완료 후 DB 기반 uniqueness constraint로 대부분 해결 가능. 단, transfer lock은 advisory lock 필요.",
    inScope: [
      "DB unique constraint로 idempotency 보장",
      "authority transfer lock을 DB row-level lock 또는 advisory lock으로 전환",
      "동시 요청 시나리오 테스트 추가",
    ],
    outOfScope: [
      "Redis 도입",
      "외부 distributed lock 서비스",
      "product-facing concurrency 처리",
    ],
    dependencies: ["P1-1 완료 (DB 기반 store 전제)"],
    successCriteria: [
      "동시 transfer request 시 duplicate 0건",
      "동시 intake 시 duplicate enqueue 0건",
      "기존 S3, S4 테스트 회귀 없음",
    ],
    releaseRiskIfDelayed: "트래픽 증가 시 duplicate intake/authority race condition. INTERNAL_ONLY scope에서는 발현 확률 낮음.",
  },
  {
    epicId: "P1-3",
    title: "INCIDENT_LOCKDOWN Recovery Path",
    objective: "INCIDENT_LOCKDOWN 상태에서 ACTIVE_100으로 안전하게 복귀하는 transition 경로 추가.",
    whyNow: "lockdown 진입 후 수동 재배포만 가능. P1-1 persistence가 있어야 lockdown 상태가 배포 후에도 유지되므로, 복귀 경로가 더 중요해짐.",
    inScope: [
      "transition-guard.ts에 INCIDENT_LOCKDOWN → ACTIVE_100 transition 추가",
      "admin approval gate 조건 추가",
      "baseline integrity + audit chain intact 사전 검증",
      "S1 테스트에 복귀 시나리오 추가",
    ],
    outOfScope: [
      "복귀 UI",
      "자동 복귀",
      "lockdown 중 partial operation 허용",
    ],
    dependencies: ["P1-1 완료 (lockdown 상태 persistent 전제)"],
    successCriteria: [
      "INCIDENT_LOCKDOWN → ACTIVE_100 transition 테스트 통과",
      "admin approval 없이 복귀 시도 시 rejection 확인",
      "복귀 시 audit event 기록 확인",
      "기존 S1 12 tests 회귀 없음",
    ],
    releaseRiskIfDelayed: "lockdown 발생 시 MTTR 증가 (수동 재배포 필요). 발생 확률 자체는 낮음.",
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 2. Execution Order
// ══════════════════════════════════════════════════════════════════════════════

export const EXECUTION_ORDER_RATIONALE: readonly {
  readonly order: number;
  readonly epicId: string;
  readonly riskBasis: string;
}[] = [
  {
    order: 1,
    epicId: "P1-1",
    riskBasis: "배포마다 전체 state 유실 — 가장 높은 빈도의 운영 리스크. P1-2, P1-3 모두 DB 기반 전제. blocking dependency.",
  },
  {
    order: 2,
    epicId: "P1-2",
    riskBasis: "P1-1 완료 시 DB unique constraint로 80% 해결. 나머지 transfer lock만 추가 작업. 트래픽 증가 시 리스크 발현.",
  },
  {
    order: 3,
    epicId: "P1-3",
    riskBasis: "lockdown 발생 확률 자체가 낮음. P1-1 없으면 lockdown 상태 자체가 유지 안 되므로 복귀 경로도 무의미. 의존성 + 낮은 발현 확률.",
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 3. P1-1 Persistence Target Map
// ══════════════════════════════════════════════════════════════════════════════

export type CanStayInMemory = "YES_TEMPORARY" | "NO_MUST_PERSIST" | "OPTIONAL";

export interface PersistenceTarget {
  readonly component: string;
  readonly sourceFile: string;
  readonly currentStorage: string;
  readonly targetStorage: string;
  readonly migrationNeed: string;
  readonly correctnessRisk: string;
  readonly canStayInMemory: CanStayInMemory;
  readonly priority: "PHASE_1" | "PHASE_2" | "PHASE_3";
}

export const PERSISTENCE_TARGET_MAP: readonly PersistenceTarget[] = [
  {
    component: "Baseline Registry",
    sourceFile: "core/baseline/baseline-registry.ts",
    currentStorage: "let _canonicalBaseline: BaselineRegistry | null (singleton variable)",
    targetStorage: "Prisma StabilizationBaseline model (unique constraint on canonicalBaselineId)",
    migrationNeed: "CREATE TABLE + unique index. 기존 데이터 없음 (매 배포 초기화).",
    correctnessRisk: "singleton 보장 필수. DB에 2개 이상 row 생성 시 assertSingleCanonical() 위반.",
    canStayInMemory: "NO_MUST_PERSIST",
    priority: "PHASE_1",
  },
  {
    component: "Authority Registry",
    sourceFile: "core/authority/authority-registry.ts",
    currentStorage: "Map<string, AuthorityLine> + Map<string, transferLock>",
    targetStorage: "Prisma StabilizationAuthorityLine model + transfer_state column",
    migrationNeed: "CREATE TABLE + index on authorityLineId. transferLock은 row-level status로 흡수.",
    correctnessRisk: "transfer state machine 9단계 일관성 필수. partial update 시 split-brain 가능.",
    canStayInMemory: "NO_MUST_PERSIST",
    priority: "PHASE_1",
  },
  {
    component: "Stabilization Audit Events",
    sourceFile: "core/audit/audit-events.ts",
    currentStorage: "const _auditEvents: StabilizationAuditEvent[] (append-only array)",
    targetStorage: "Prisma StabilizationAuditEvent model (append-only, no update/delete)",
    migrationNeed: "CREATE TABLE + indexes on correlationId, eventType, timestamp.",
    correctnessRisk: "낮음. append-only이므로 write conflict 없음. 순서 보장은 timestamp 기반.",
    canStayInMemory: "NO_MUST_PERSIST",
    priority: "PHASE_1",
  },
  {
    component: "Canonical Audit Log",
    sourceFile: "core/observability/canonical-event-schema.ts",
    currentStorage: "const _auditLog: CanonicalEvent[] + Set<string> _writtenIds",
    targetStorage: "Prisma CanonicalAuditEvent model (append-only) + unique eventId",
    migrationNeed: "CREATE TABLE + unique index on eventId + indexes on correlationId, timelineId.",
    correctnessRisk: "dedupe는 unique constraint로 자연 보장. _writtenIds Set 불필요해짐.",
    canStayInMemory: "NO_MUST_PERSIST",
    priority: "PHASE_1",
  },
  {
    component: "Intake Idempotency Store",
    sourceFile: "core/routing/routing-resolver.ts",
    currentStorage: "Map<string, IntakeTerminalOutcome> + Map<string, string> queueReceipts",
    targetStorage: "Prisma ProcessedIntake model (intakeId unique, terminalOutcome, queueReceiptId)",
    migrationNeed: "CREATE TABLE + unique index on intakeId.",
    correctnessRisk: "unique constraint로 duplicate enqueue 방지. 현재 in-memory보다 강한 보장.",
    canStayInMemory: "NO_MUST_PERSIST",
    priority: "PHASE_2",
  },
  {
    component: "Runtime State Store",
    sourceFile: "core/rollback/scope-restore-adapter.ts",
    currentStorage: "Map<string, Record<string, unknown>> _runtimeState",
    targetStorage: "Prisma RuntimeStateSnapshot model (scope + jsonData)",
    migrationNeed: "CREATE TABLE. scope별 JSON 컬럼.",
    correctnessRisk: "중간. JSON 직렬화/역직렬화 시 타입 손실 가능. Date 필드 주의.",
    canStayInMemory: "YES_TEMPORARY",
    priority: "PHASE_2",
  },
  {
    component: "Snapshot Registry",
    sourceFile: "core/baseline/snapshot-manager.ts",
    currentStorage: "Map<string, BaselineSnapshot> (inferred from baseline-registry pattern)",
    targetStorage: "Prisma BaselineSnapshot model (snapshotId, tag, scopes JSON, config JSON)",
    migrationNeed: "CREATE TABLE + index on baselineId, tag.",
    correctnessRisk: "낮음. immutable after creation.",
    canStayInMemory: "NO_MUST_PERSIST",
    priority: "PHASE_1",
  },
  {
    component: "Reject/Dead-Letter Metadata",
    sourceFile: "core/runtime/runtime-gate.ts (reject store)",
    currentStorage: "Array<RejectEvent> (inferred from S1 pattern)",
    targetStorage: "기존 AuditLog 또는 별도 RejectedAction model",
    migrationNeed: "CREATE TABLE or use existing AuditLog with type filter.",
    correctnessRisk: "낮음. 조회 전용 데이터.",
    canStayInMemory: "YES_TEMPORARY",
    priority: "PHASE_3",
  },
  {
    component: "Release Baseline Lock Metadata",
    sourceFile: "post-stabilization-transition.ts (const objects)",
    currentStorage: "TypeScript const (compile-time)",
    targetStorage: "변환 불필요. compile-time const는 코드에 내장.",
    migrationNeed: "없음.",
    correctnessRisk: "없음.",
    canStayInMemory: "YES_TEMPORARY",
    priority: "PHASE_3",
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 4. P1-1 Minimal Implementation Slice
// ══════════════════════════════════════════════════════════════════════════════

export interface ImplementationSlice {
  readonly sliceId: string;
  readonly title: string;
  readonly description: string;
  readonly files: readonly string[];
}

export const PHASE_1_SLICES: readonly ImplementationSlice[] = [
  {
    sliceId: "SLICE-1A",
    title: "Prisma Schema Additions",
    description: "5개 모델 추가: StabilizationBaseline, BaselineSnapshot, StabilizationAuthorityLine, StabilizationAuditEvent, CanonicalAuditEvent. npx prisma migrate dev 실행.",
    files: [
      "prisma/schema.prisma — 모델 추가",
      "prisma/migrations/ — auto-generated",
    ],
  },
  {
    sliceId: "SLICE-1B",
    title: "Repository Interface Definitions",
    description: "각 store의 CRUD interface 정의. 실제 Prisma 구현과 in-memory fallback 구현 모두 동일 interface 준수.",
    files: [
      "runtime/core/persistence/types.ts — interface 정의",
      "runtime/core/persistence/baseline-repository.ts",
      "runtime/core/persistence/authority-repository.ts",
      "runtime/core/persistence/audit-repository.ts",
      "runtime/core/persistence/canonical-audit-repository.ts",
      "runtime/core/persistence/snapshot-repository.ts",
    ],
  },
  {
    sliceId: "SLICE-1C",
    title: "Prisma Repository Implementations",
    description: "interface에 대한 Prisma 기반 구현. db.ts 싱글턴 사용.",
    files: [
      "runtime/core/persistence/prisma/prisma-baseline-repository.ts",
      "runtime/core/persistence/prisma/prisma-authority-repository.ts",
      "runtime/core/persistence/prisma/prisma-audit-repository.ts",
      "runtime/core/persistence/prisma/prisma-canonical-audit-repository.ts",
      "runtime/core/persistence/prisma/prisma-snapshot-repository.ts",
    ],
  },
  {
    sliceId: "SLICE-1D",
    title: "In-Memory Repository Implementations (Test Fallback)",
    description: "기존 Map 기반 로직을 repository interface로 래핑. 테스트 환경에서 DB 없이 실행 가능.",
    files: [
      "runtime/core/persistence/memory/memory-baseline-repository.ts",
      "runtime/core/persistence/memory/memory-authority-repository.ts",
      "runtime/core/persistence/memory/memory-audit-repository.ts",
      "runtime/core/persistence/memory/memory-canonical-audit-repository.ts",
      "runtime/core/persistence/memory/memory-snapshot-repository.ts",
    ],
  },
  {
    sliceId: "SLICE-1E",
    title: "Store 치환 (기존 파일 수정)",
    description: "기존 registry/store 파일에서 Map 직접 조작을 repository 호출로 교체. exported function signature 변경 없음.",
    files: [
      "runtime/core/baseline/baseline-registry.ts — _canonicalBaseline → repository.get/save",
      "runtime/core/authority/authority-registry.ts — _registry Map → repository.get/save/update",
      "runtime/core/audit/audit-events.ts — _auditEvents array → repository.append/query",
      "runtime/core/observability/canonical-event-schema.ts — _auditLog/_writtenIds → repository.append/exists/query",
    ],
  },
] as const;

// ── Migration Order ──

export const MIGRATION_ORDER: readonly {
  readonly order: number;
  readonly component: string;
  readonly reason: string;
}[] = [
  { order: 1, component: "StabilizationAuditEvent", reason: "다른 모든 store가 audit emit에 의존. audit가 먼저 persistent 되어야 다른 store 전환 시 이벤트 유실 없음." },
  { order: 2, component: "StabilizationBaseline + BaselineSnapshot", reason: "baseline이 모든 runtime gate의 전제. baseline 유실 시 gate lock 무효화." },
  { order: 3, component: "StabilizationAuthorityLine", reason: "authority transfer state machine 일관성 필요. baseline 다음 우선순위." },
  { order: 4, component: "CanonicalAuditEvent", reason: "S5 observability 데이터. StabilizationAuditEvent와 별도 테이블이므로 독립 마이그레이션 가능." },
] as const;

// ── Migration Strategy ──

export const MIGRATION_STRATEGY = {
  approach: "additive-only",
  detail: "기존 테이블 변경 없음. 새 테이블만 추가. prisma migrate dev로 생성.",
  rollbackStrategy: "prisma migrate down (또는 수동 DROP TABLE). 새 테이블만 삭제하면 기존 스키마 복원.",
  dataLoss: "없음. 기존 데이터 없음 (매 배포 초기화 상태). 마이그레이션은 빈 테이블 생성만.",
  zeroDowntime: "Vercel 배포 특성상 새 인스턴스가 뜰 때 migration 실행. 기존 인스턴스와 충돌 없음.",
} as const;

// ── Test Strategy ──

export const TEST_STRATEGY = {
  unit: "기존 105 tests는 memory repository로 실행. exported function signature 변경 없으므로 테스트 코드 수정 없음.",
  integration: "prisma repository에 대한 별도 integration test 추가 (DB 접속 필요). CI에서만 실행.",
  regression: "S0~S6 전체 테스트 suite가 memory repository로 회귀 검증.",
  switchMechanism: "환경 변수 USE_PRISMA_PERSISTENCE=true/false로 runtime에서 repository 구현체 선택.",
} as const;

// ── Prisma Schema Draft ──

export const PRISMA_SCHEMA_ADDITIONS = `
// ── Stabilization Runtime Persistence ──

model StabilizationBaseline {
  id                      String   @id @default(cuid())
  canonicalBaselineId     String   @unique
  baselineVersion         String
  baselineHash            String
  baselineSource          String   @default("PACKAGE1_COMPLETE_NEW_AI_INTEGRATED")
  baselineStatus          String   // UNFROZEN | FROZEN | INVALIDATED
  lifecycleState          String   // ACTIVE_100 etc.
  releaseMode             String   // FULL_ACTIVE_STABILIZATION etc.
  activeSnapshotId        String
  rollbackSnapshotId      String
  freezeReason            String
  activePathManifestId    String
  policySetVersion        String
  routingRuleVersion      String
  authorityRegistryVersion String
  documentType            String
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}

model StabilizationSnapshot {
  id            String   @id @default(cuid())
  snapshotId    String   @unique
  baselineId    String
  tag           String   // ACTIVE | ROLLBACK
  scopesJson    Json     // SnapshotScopeEntry[]
  configJson    Json     // Record<string, unknown>
  capturedAt    DateTime @default(now())
  capturedBy    String

  @@index([baselineId, tag])
}

model StabilizationAuthorityLine {
  id                  String   @id @default(cuid())
  authorityLineId     String   @unique
  currentAuthorityId  String
  authorityState      String   // ACTIVE | FROZEN | REVOKED
  transferState       String   // 9-state machine
  pendingSuccessorId  String?
  revokedAuthorityIds Json     // string[]
  registryVersion     Int
  baselineId          String
  correlationId       String
  updatedAt           DateTime @updatedAt
  updatedBy           String

  @@index([baselineId])
  @@index([correlationId])
}

model StabilizationAuditEvent {
  id              String   @id @default(cuid())
  eventId         String   @unique
  eventType       String
  baselineId      String
  baselineVersion String
  baselineHash    String
  snapshotId      String
  correlationId   String
  documentType    String
  performedBy     String
  detail          String
  timestamp       DateTime @default(now())

  @@index([correlationId])
  @@index([eventType])
  @@index([timestamp])
}

model CanonicalAuditEvent {
  id                String   @id @default(cuid())
  eventId           String   @unique
  eventType         String
  eventStage        String?
  correlationId     String
  incidentId        String?
  timelineId        String
  baselineId        String
  baselineVersion   String
  baselineHash      String
  lifecycleState    String
  releaseMode       String
  actor             String
  sourceModule      String
  entityType        String
  entityId          String
  reasonCode        String
  severity          String   // INFO | NOTICE | WARNING | ERROR | CRITICAL
  occurredAt        DateTime
  recordedAt        DateTime @default(now())
  snapshotBeforeId  String?
  snapshotAfterId   String?
  affectedScopes    Json     // string[]
  resultStatus      String   // ACCEPTED | DENIED | STARTED | COMPLETED | FAILED | ESCALATED | QUARANTINED
  parentEventId     String?
  schemaVersion     String

  @@index([correlationId])
  @@index([timelineId])
  @@index([eventType])
  @@index([occurredAt])
}
` as const;

// ══════════════════════════════════════════════════════════════════════════════
// 5. Guardrails
// ══════════════════════════════════════════════════════════════════════════════

export const GUARDRAILS: readonly string[] = [
  "full multi-instance 구현 금지 (P1-2 scope)",
  "distributed lock 실제 도입 금지 (P1-2 scope)",
  "recovery path UI 추가 금지 (P1-3 scope)",
  "unrelated module decomposition 금지",
  "product-facing feature 변경 금지",
  "exported function signature 변경 금지 (interface contract 유지)",
  "stabilization.ts 타입 정의 변경 금지",
  "기존 테스트 파일 수정 금지 (memory repository로 기존 테스트 그대로 통과)",
  "Prisma migration은 additive-only (기존 테이블 변경 금지)",
  "canonical-event-schema.ts 내부 판정 로직 변경 금지",
] as const;
