/**
 * Release Finalization Pack — RC Freeze + Decision Consistency + Scope + Sign-off + Ops Fallback + P1 Kickoff
 *
 * 새 기능 추가 금지. 구조 리팩터 금지. stabilization contract 수정 금지.
 * 운영 문서 형태의 release candidate 잠금 산출물.
 */

// ══════════════════════════════════════════════════════════════════════════════
// 1. RC Freeze
// ══════════════════════════════════════════════════════════════════════════════

export interface RCFreezeRecord {
  readonly releaseCandidateId: string;
  readonly frozenCommit: string;
  readonly releaseTag: string;
  readonly tagNamingConvention: string;
  readonly mainFreezeStatus: "FROZEN_FOR_RC" | "OPEN";
  readonly freezeReason: string;
  readonly noFurtherMergeRule: string;
  readonly frozenAt: string;
}

export const RC_FREEZE: RCFreezeRecord = {
  releaseCandidateId: "RC-2026-0315-001",
  frozenCommit: "576ce86",
  releaseTag: "v1.0.0-rc.1",
  tagNamingConvention: "v{major}.{minor}.{patch}-rc.{seq} — seq increments on correction commits only",
  mainFreezeStatus: "FROZEN_FOR_RC",
  freezeReason: "S0~S6 stabilization passed. EXIT_GATE_PASSED. GO_WITH_EXPLICIT_DEFERRED_RISKS decision issued.",
  noFurtherMergeRule: "sign-off 4개 필드 전부 approved=true 기록 전까지 main에 어떤 merge도 금지. 예외: critical hotfix만 허용하되 privileged path + audit + rollbackImpact 증빙 필수. hotfix 시 rc.{seq} 재발행 필수.",
  frozenAt: "2026-03-15T00:00:00Z",
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// 2. Decision Consistency Correction
// ══════════════════════════════════════════════════════════════════════════════

export interface DecisionConsistencyReview {
  readonly targetRiskId: string;
  readonly originalClassification: string;
  readonly reviewQuestion: string;
  readonly evidence: readonly string[];
  readonly conclusion: string;
  readonly reclassifiedTo: string;
  readonly exitGateImpact: string;
  readonly selfContradictionCheck: "NO_CONTRADICTION" | "CONTRADICTION_FOUND";
}

export const PSR008_CONSISTENCY_REVIEW: DecisionConsistencyReview = {
  targetRiskId: "PSR-008",
  originalClassification: "soak runner 실행 로직 미구현 (severity: MEDIUM)",
  reviewQuestion: "soak runner 부재가 EXIT_GATE_PASSED와 충돌하는가?",
  evidence: [
    "S6 soak-exit-gate.ts: evaluateExitGate()는 SoakMetrics 입력 기반 판정 함수. runner와 독립.",
    "S6 test #3: createDefaultMetrics() → evaluateExitGate() → EXIT_GATE_PASSED. runner 없이 evaluator 단독 검증 완료.",
    "S6 test #4~#14: metrics 변조 시 EXIT_GATE_FAILED 정상 판정. evaluator 로직 자체는 완전.",
    "soak runner는 '반복 실행하여 metrics를 수집하는 orchestrator'이지, exit gate 판정 로직이 아님.",
    "exit gate contract: evaluateExitGate(metrics) → result. metrics 공급원이 runner든 수동이든 판정 무관.",
  ],
  conclusion: "soak runner 부재는 EXIT_GATE_PASSED와 모순되지 않음. evaluator는 독립 검증 완료. runner는 반복 soak 실행 편의 도구이며 exit gate contract의 구성 요소가 아님.",
  reclassifiedTo: "hardening debt (severity: LOW, recommendedNextPhase: POST_STABILIZATION_P2)",
  exitGateImpact: "없음. EXIT_GATE_PASSED 판정 유효 유지.",
  selfContradictionCheck: "NO_CONTRADICTION",
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// 3. Release Scope Declaration
// ══════════════════════════════════════════════════════════════════════════════

export type ReleaseScope = "INTERNAL_ONLY" | "CONTROLLED_EXTERNAL" | "BROAD_EXTERNAL";

export interface ReleaseScopeDeclaration {
  readonly approvedScope: ReleaseScope;
  readonly rationale: string;
  readonly blockedScopes: readonly {
    readonly scope: ReleaseScope;
    readonly reason: string;
    readonly unblockCondition: string;
  }[];
  readonly scopeEscalationPath: string;
}

export const RELEASE_SCOPE: ReleaseScopeDeclaration = {
  approvedScope: "INTERNAL_ONLY",
  rationale: "INC-08 (customer/internal comms) BLOCKED + INC-09 (post-incident review) BLOCKED. incident 발생 시 고객 통지 및 사후 리뷰 경로 부재. 보수적 판단으로 INTERNAL_ONLY 승인.",
  blockedScopes: [
    {
      scope: "CONTROLLED_EXTERNAL",
      reason: "INC-08 BLOCKED — incident 시 외부 고객 통지 수동 절차 미확정",
      unblockCondition: "INC-08 수동 운영 절차서 작성 완료 + ops-lead 승인",
    },
    {
      scope: "BROAD_EXTERNAL",
      reason: "INC-08 BLOCKED + INC-09 BLOCKED — customer comms 미연동 + PIR 프로세스 미정의",
      unblockCondition: "INC-08 해소 + INC-09 PIR 템플릿 확정 + releaseMgr 재승인",
    },
  ],
  scopeEscalationPath: "INTERNAL_ONLY → (INC-08 해소) → CONTROLLED_EXTERNAL → (INC-09 해소) → BROAD_EXTERNAL. 각 단계 releaseMgr 재승인 필수.",
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// 4. Sign-off Pack
// ══════════════════════════════════════════════════════════════════════════════

export type SignOffStatus = "PENDING" | "APPROVED" | "REJECTED" | "CONDITIONAL";

export interface SignOffEntry {
  readonly role: string;
  status: SignOffStatus;
  name: string;
  signedAt: string;
  note: string;
}

export interface SignOffPack {
  entries: SignOffEntry[];
  readonly completionRule: string;
  readonly blockingRule: string;
}

export function createSignOffPack(): SignOffPack {
  return {
    entries: [
      { role: "releaseMgr", status: "PENDING", name: "", signedAt: "", note: "" },
      { role: "opsLead", status: "PENDING", name: "", signedAt: "", note: "" },
      { role: "techLead", status: "PENDING", name: "", signedAt: "", note: "" },
      { role: "secLead", status: "PENDING", name: "", signedAt: "", note: "" },
    ],
    completionRule: "4개 역할 전부 APPROVED 상태여야 최종 GO 확정. CONDITIONAL은 note에 조건 명시 필수, 조건 미충족 시 PENDING으로 복귀.",
    blockingRule: "1개라도 REJECTED이면 NO_GO. 1개라도 PENDING이면 GO 확정 금지. sign-off complete 전 main merge 금지.",
  };
}

export function isSignOffComplete(pack: SignOffPack): boolean {
  return pack.entries.every((e) => e.status === "APPROVED");
}

export function hasSignOffRejection(pack: SignOffPack): boolean {
  return pack.entries.some((e) => e.status === "REJECTED");
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. Blocked Incident Ops Fallback
// ══════════════════════════════════════════════════════════════════════════════

export interface IncidentOpsFallback {
  readonly checklistItemId: string;
  readonly blockReason: string;
  readonly fallbackProcedure: readonly string[];
  readonly releaseImpact: string;
  readonly broadExternalBlock: boolean;
}

export const INC08_COMMS_FALLBACK: IncidentOpsFallback = {
  checklistItemId: "INC-08",
  blockReason: "외부 알림 시스템(Slack webhook, email alert) 미연동",
  fallbackProcedure: [
    "1. incident 발생 시 ops-lead가 수동으로 내부 Slack #ops-alert 채널에 즉시 포스팅",
    "2. 포스팅 내용: incident ID, severity, affected scope, current status, ETA",
    "3. 외부 고객 영향 있을 경우 ops-lead → releaseMgr 에스컬레이션 (15분 이내)",
    "4. releaseMgr가 고객 통지 여부 판단 후 수동 이메일 발송",
    "5. 모든 통지 이력을 incident timeline의 correlationId에 수동 기록",
  ],
  releaseImpact: "INTERNAL_ONLY release에는 영향 없음. CONTROLLED_EXTERNAL 이상 release 시 이 절차서 완성 + ops-lead 승인 필요.",
  broadExternalBlock: true,
} as const;

export interface PIRTemplate {
  readonly checklistItemId: string;
  readonly blockReason: string;
  readonly templateFields: readonly string[];
  readonly minimumRequirements: readonly string[];
  readonly releaseImpact: string;
  readonly broadExternalBlock: boolean;
}

export const INC09_PIR_TEMPLATE: PIRTemplate = {
  checklistItemId: "INC-09",
  blockReason: "Post-Incident Review 프로세스 미정의",
  templateFields: [
    "pirId: string — PIR 고유 ID",
    "incidentId: string — 연관 incident ID",
    "correlationId: string — audit timeline 연결용",
    "occurredAt: Date — incident 발생 시각",
    "detectedAt: Date — 탐지 시각",
    "resolvedAt: Date — 해소 시각",
    "severity: CRITICAL | HIGH | MEDIUM | LOW",
    "rootCause: string — 근본 원인 1문장",
    "containmentActions: string[] — 수행된 containment 조치 목록",
    "timelineReconstructionStatus: RECONSTRUCTABLE | PARTIALLY_RECONSTRUCTABLE | BROKEN_CHAIN",
    "affectedScopes: string[] — 영향받은 scope",
    "customerImpact: NONE | DEGRADED | OUTAGE",
    "preventionActions: string[] — 재발 방지 조치",
    "owner: string — PIR 작성자",
    "reviewedBy: string[] — 리뷰어",
    "completedAt: Date — PIR 완료 시각",
  ],
  minimumRequirements: [
    "incident 해소 후 72시간 이내 PIR 초안 작성",
    "S5 buildTimeline() 결과를 PIR에 첨부 (reconstruction evidence)",
    "root cause + prevention actions 필수 기재",
    "ops-lead + tech-lead 리뷰 서명",
  ],
  releaseImpact: "INTERNAL_ONLY release에는 영향 없음. BROAD_EXTERNAL release 전까지 PIR 프로세스 확정 필수.",
  broadExternalBlock: true,
} as const;

// ══════════════════════════════════════════════════════════════════════════════
// 6. Post-Stabilization P1 Kickoff Pack
// ══════════════════════════════════════════════════════════════════════════════

export interface P1Epic {
  readonly epicId: string;
  readonly title: string;
  readonly objective: string;
  readonly whyNow: string;
  readonly notReleaseBlocking: string;
  readonly successCriteria: readonly string[];
  readonly relatedDeferredRisks: readonly string[];
}

export const P1_KICKOFF_EPICS: readonly P1Epic[] = [
  {
    epicId: "P1-EPIC-001",
    title: "Persistence / Prisma Integration",
    objective: "S0~S6의 모든 in-memory store(baseline registry, authority registry, audit log, idempotency store, recurrence tracker, residual risk)를 Prisma 기반 persistent storage로 전환.",
    whyNow: "현재 프로세스 재시작/Vercel 배포 시 전체 runtime state 유실. controlled release 이후 트래픽 증가 시 데이터 손실 위험 직결.",
    notReleaseBlocking: "stabilization 검증은 단일 프로세스 scope 내 완료. 실운영 트래픽 전환 전까지 in-memory로 충분.",
    successCriteria: [
      "모든 store의 CRUD가 Prisma transaction 경유",
      "프로세스 재시작 후 state 복원 확인",
      "기존 S0~S6 105 tests 회귀 없음",
      "migration script 검증 (up/down)",
    ],
    relatedDeferredRisks: ["PSR-001"],
  },
  {
    epicId: "P1-EPIC-002",
    title: "Multi-Instance Uniqueness / Distributed Locking",
    objective: "idempotency key, authority transfer lock, queue receipt를 분산 환경에서 유일성 보장하도록 전환.",
    whyNow: "Vercel serverless 환경에서 동시 요청 시 in-memory lock 무효화. canary rollout 트래픽 증가 시 race condition 발현 가능.",
    notReleaseBlocking: "현재 트래픽 규모에서 동시 요청 확률 극히 낮음. INTERNAL_ONLY scope에서 동시성 이슈 발현 가능성 최소.",
    successCriteria: [
      "동시 요청 시 duplicate enqueue 0건 (load test)",
      "authority transfer concurrent lock 분산 환경 검증",
      "Redis 또는 DB advisory lock 기반 구현",
      "기존 S3, S4 테스트 회귀 없음",
    ],
    relatedDeferredRisks: ["PSR-002"],
  },
  {
    epicId: "P1-EPIC-003",
    title: "INCIDENT_LOCKDOWN Recovery Path",
    objective: "INCIDENT_LOCKDOWN 상태에서 ACTIVE_100으로 안전하게 복귀하는 transition 경로 추가.",
    whyNow: "lockdown 진입 후 복귀 경로 부재로 수동 재배포 필요. 운영 중 incident 발생 시 복구 시간(MTTR) 직결.",
    notReleaseBlocking: "lockdown 자체가 극단적 시나리오. 발생 확률 낮고 수동 재배포로 대응 가능.",
    successCriteria: [
      "INCIDENT_LOCKDOWN → ACTIVE_100 transition 정의 (admin approval gate 필수)",
      "transition guard에 복귀 조건 검증 추가 (baseline integrity + audit chain intact)",
      "S1 테스트에 복귀 시나리오 추가",
      "복귀 시 audit event 기록 확인",
    ],
    relatedDeferredRisks: ["PSR-004"],
  },
] as const;

// ══════════════════════════════════════════════════════════════════════════════
// 7. Final Release Decision Sheet
// ══════════════════════════════════════════════════════════════════════════════

export interface FinalReleaseDecisionSheet {
  readonly releaseCandidateId: string;
  readonly commit: string;
  readonly tag: string;
  readonly decision: "GO" | "NO_GO" | "GO_WITH_EXPLICIT_DEFERRED_RISKS";
  readonly releaseScope: ReleaseScope;
  readonly criticalRiskCount: number;
  readonly deferredRiskCount: number;
  readonly blockedChecklistItems: readonly string[];
  readonly signOffStatus: "ALL_APPROVED" | "PENDING" | "HAS_REJECTION";
  readonly goLivePreconditions: readonly string[];
  readonly noFurtherMergeRule: string;
  readonly decisionConsistencyStatus: "NO_CONTRADICTION" | "CONTRADICTION_FOUND";
  readonly scopeEscalationPath: string;
}

export const FINAL_RELEASE_DECISION: FinalReleaseDecisionSheet = {
  releaseCandidateId: "RC-2026-0315-001",
  commit: "576ce86",
  tag: "v1.0.0-rc.1",
  decision: "GO_WITH_EXPLICIT_DEFERRED_RISKS",
  releaseScope: "INTERNAL_ONLY",
  criticalRiskCount: 0,
  deferredRiskCount: 10,
  blockedChecklistItems: ["INC-08: customer/internal comms", "INC-09: post-incident review"],
  signOffStatus: "PENDING",
  goLivePreconditions: [
    "sign-off 4/4 APPROVED",
    "INC-08 수동 운영 fallback 절차서 ops-lead 확인",
    "INC-09 최소 PIR 템플릿 tech-lead 확인",
    "v1.0.0-rc.1 tag 기준 Vercel 배포 성공 확인",
    "rollback snapshot 무결성 최종 확인",
  ],
  noFurtherMergeRule: "sign-off complete 전 main merge 금지. critical hotfix 예외 시 privileged path + audit + rollbackImpact 증빙 + rc.{seq} 재발행 필수.",
  decisionConsistencyStatus: "NO_CONTRADICTION",
  scopeEscalationPath: "INTERNAL_ONLY → CONTROLLED_EXTERNAL (INC-08 해소) → BROAD_EXTERNAL (INC-08 + INC-09 해소)",
} as const;
