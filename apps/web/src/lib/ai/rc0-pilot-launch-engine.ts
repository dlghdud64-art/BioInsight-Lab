/**
 * RC0 Pilot Launch Engine — Batch 19
 *
 * "테스트 통과"가 아니라 "실제로 pilot를 켜도 된다"는 운영 준비를 구조화.
 *
 * 5 sections:
 * 1. RC0 Scope Freeze — stage/domain/PO/duration/actor 확정
 * 2. Scenario Freeze — 검증 완료 시나리오 목록 고정
 * 3. Signoff Registry — approver/operator/rollback owner/reviewer 지정
 * 4. Day-0 Monitoring Pack — 첫날 모니터링 포인트 + 임계치 정의
 * 5. Rollback Drill — 리허설 결과 기록 + readiness 판정
 *
 * CORE CONTRACT:
 * 1. RC0는 gate verdict 이후의 실행 레이어 — truth 변경 없음
 * 2. scope freeze 후 변경은 새 RC를 만들어야 함
 * 3. signoff는 모든 역할이 완료되어야 launch 가능
 * 4. rollback drill 미실시면 launch 차단
 * 5. grammar registry 외 label 하드코딩 금지
 */

import type { GovernanceDomain } from "./governance-event-bus";
import type { QuoteChainStage } from "./quote-approval-governance-engine";
import type { OperationalVerdict, ActivationScope, ReleaseCandidateSnapshot } from "./operational-readiness-gate-engine";
import type { PilotPlan, PilotStatus } from "./pilot-activation-engine";
import { getLifecycleActionLabel, type UnifiedSeverity } from "./governance-grammar-registry";

// ══════════════════════════════════════════════════════
// 1. RC0 Scope Freeze
// ══════════════════════════════════════════════════════

export interface RC0ScopeFreeze {
  rc0Id: string;
  frozenAt: string;
  /** Gate verdict this RC0 is based on */
  gateVerdict: OperationalVerdict;
  gateSnapshotId: string;
  /** Activation scope from gate */
  activationScope: ActivationScope;
  /** Frozen scope details */
  includedStages: QuoteChainStage[];
  activeDomains: GovernanceDomain[];
  poLimit: number;
  durationDays: number;
  startDate: string;
  endDate: string;
  /** Actor scope */
  actorScope: {
    operatorRoles: string[];
    reviewerRoles: string[];
    maxConcurrentActors: number;
  };
  /** Locked — no modification after freeze */
  locked: boolean;
}

export function createRC0ScopeFreeze(
  gateVerdict: OperationalVerdict,
  gateSnapshotId: string,
  scope: ActivationScope,
  config: {
    includedStages: QuoteChainStage[];
    activeDomains: GovernanceDomain[];
    poLimit: number;
    durationDays: number;
    startDate: string;
    operatorRoles: string[];
    reviewerRoles: string[];
    maxConcurrentActors: number;
  },
): RC0ScopeFreeze {
  const start = new Date(config.startDate);
  const end = new Date(start.getTime() + config.durationDays * 86400000);

  return {
    rc0Id: `rc0_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    frozenAt: new Date().toISOString(),
    gateVerdict,
    gateSnapshotId,
    activationScope: scope,
    includedStages: [...config.includedStages],
    activeDomains: [...config.activeDomains],
    poLimit: config.poLimit,
    durationDays: config.durationDays,
    startDate: config.startDate,
    endDate: end.toISOString(),
    actorScope: {
      operatorRoles: [...config.operatorRoles],
      reviewerRoles: [...config.reviewerRoles],
      maxConcurrentActors: config.maxConcurrentActors,
    },
    locked: true,
  };
}

export function validateRC0ScopeFreeze(freeze: RC0ScopeFreeze): RC0ScopeValidation {
  const issues: string[] = [];

  if (freeze.gateVerdict === "no_go") {
    issues.push("gate verdict가 no_go — RC0 생성 불가");
  }
  if (freeze.includedStages.length === 0) {
    issues.push("포함 stage 없음");
  }
  if (freeze.activeDomains.length === 0) {
    issues.push("활성 domain 없음");
  }
  if (freeze.poLimit <= 0) {
    issues.push("PO 제한이 0 이하");
  }
  if (freeze.durationDays <= 0) {
    issues.push("기간이 0일 이하");
  }
  if (freeze.actorScope.operatorRoles.length === 0) {
    issues.push("operator 역할 미지정");
  }
  if (freeze.actorScope.reviewerRoles.length === 0) {
    issues.push("reviewer 역할 미지정");
  }
  if (new Date(freeze.startDate) < new Date(freeze.frozenAt)) {
    issues.push("시작일이 freeze 시점보다 이전");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export interface RC0ScopeValidation {
  valid: boolean;
  issues: string[];
}

// ══════════════════════════════════════════════════════
// 2. Scenario Freeze
// ══════════════════════════════════════════════════════

export type PilotScenarioId =
  | "normal_closed_loop"
  | "supplier_change_reopen"
  | "receiving_discrepancy_partial"
  | "stale_reconnect"
  | "multi_actor_contention"
  | "rollback_execution";

export interface FrozenScenario {
  scenarioId: PilotScenarioId;
  name: string;
  description: string;
  /** E2E 검증 통과 여부 */
  acceptanceVerified: boolean;
  /** 이 시나리오에서 사용할 seed PO 범위 */
  seedPoRange: { from: number; to: number };
  /** 예상 소요 일수 */
  expectedDays: number;
  /** 완료 기준 */
  completionCriteria: string;
}

export function createFrozenScenarios(): FrozenScenario[] {
  return [
    {
      scenarioId: "normal_closed_loop",
      name: "정상 폐루프",
      description: "Quote → Approval → PO → Dispatch → Supplier Confirmed → Receiving → Stock Release → Reorder no action",
      acceptanceVerified: true,
      seedPoRange: { from: 1, to: 5 },
      expectedDays: 14,
      completionCriteria: "전체 chain 정상 통과, blocker 0건, terminal status 도달",
    },
    {
      scenarioId: "supplier_change_reopen",
      name: "공급사 변경 요청 재개방",
      description: "supplier change requested → reopen → reconfirm → receive",
      acceptanceVerified: true,
      seedPoRange: { from: 6, to: 8 },
      expectedDays: 7,
      completionCriteria: "변경 요청 후 reconfirm 완료, handoff 보존, receiving 정상 진입",
    },
    {
      scenarioId: "receiving_discrepancy_partial",
      name: "입고 이상 / 부분 릴리즈 / 재주문",
      description: "discrepancy → hold → partial release → reorder required → procurement re-entry",
      acceptanceVerified: true,
      seedPoRange: { from: 9, to: 12 },
      expectedDays: 10,
      completionCriteria: "discrepancy 감지, partial release 실행, reorder decision 도달",
    },
    {
      scenarioId: "stale_reconnect",
      name: "stale / replay / reconnect",
      description: "workbench open 중 외부 이벤트 → stale 배너 → refresh → continue",
      acceptanceVerified: true,
      seedPoRange: { from: 13, to: 15 },
      expectedDays: 3,
      completionCriteria: "stale 감지 → refresh 성공 → action 정상 실행",
    },
    {
      scenarioId: "multi_actor_contention",
      name: "다중 actor 경합",
      description: "actor A action 중 actor B 동일 PO mutation 시도 → concurrency guard",
      acceptanceVerified: true,
      seedPoRange: { from: 16, to: 18 },
      expectedDays: 3,
      completionCriteria: "concurrency block → 순차 처리 → 데이터 일관성 유지",
    },
    {
      scenarioId: "rollback_execution",
      name: "파일럿 롤백",
      description: "critical signal → rollback recommendation → execution → dashboard/audit reflected",
      acceptanceVerified: true,
      seedPoRange: { from: 19, to: 20 },
      expectedDays: 1,
      completionCriteria: "rollback 실행 → 파일럿 비활성화 → 감사 스냅샷 캡처",
    },
  ];
}

export function validateScenarioFreeze(scenarios: FrozenScenario[]): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const requiredIds: PilotScenarioId[] = [
    "normal_closed_loop", "supplier_change_reopen", "receiving_discrepancy_partial",
    "stale_reconnect", "multi_actor_contention", "rollback_execution",
  ];

  for (const id of requiredIds) {
    const found = scenarios.find(s => s.scenarioId === id);
    if (!found) {
      issues.push(`필수 시나리오 누락: ${id}`);
    } else if (!found.acceptanceVerified) {
      issues.push(`시나리오 미검증: ${id} (${found.name})`);
    }
  }

  // PO range overlap check
  for (let i = 0; i < scenarios.length; i++) {
    for (let j = i + 1; j < scenarios.length; j++) {
      const a = scenarios[i];
      const b = scenarios[j];
      if (a.seedPoRange.from <= b.seedPoRange.to && b.seedPoRange.from <= a.seedPoRange.to) {
        issues.push(`PO 범위 중복: ${a.scenarioId} (${a.seedPoRange.from}-${a.seedPoRange.to}) ↔ ${b.scenarioId} (${b.seedPoRange.from}-${b.seedPoRange.to})`);
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

// ══════════════════════════════════════════════════════
// 3. Signoff Registry
// ══════════════════════════════════════════════════════

export type SignoffRole =
  | "approver"
  | "operator_owner"
  | "rollback_owner"
  | "compliance_reviewer"
  | "escalation_contact";

export interface SignoffEntry {
  role: SignoffRole;
  label: string;
  assignee: string;
  email: string;
  signedOff: boolean;
  signedOffAt: string | null;
  comment: string | null;
}

export interface SignoffRegistry {
  registryId: string;
  rc0Id: string;
  entries: SignoffEntry[];
  allSignedOff: boolean;
  createdAt: string;
}

export function createSignoffRegistry(rc0Id: string, entries: Omit<SignoffEntry, "signedOff" | "signedOffAt" | "comment">[]): SignoffRegistry {
  return {
    registryId: `signoff_${Date.now().toString(36)}`,
    rc0Id,
    entries: entries.map(e => ({
      ...e,
      signedOff: false,
      signedOffAt: null,
      comment: null,
    })),
    allSignedOff: false,
    createdAt: new Date().toISOString(),
  };
}

export function applySignoff(registry: SignoffRegistry, role: SignoffRole, comment: string | null): SignoffRegistry {
  const updated = {
    ...registry,
    entries: registry.entries.map(e =>
      e.role === role
        ? { ...e, signedOff: true, signedOffAt: new Date().toISOString(), comment }
        : e,
    ),
  };
  updated.allSignedOff = updated.entries.every(e => e.signedOff);
  return updated;
}

export function validateSignoffRegistry(registry: SignoffRegistry): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const requiredRoles: SignoffRole[] = ["approver", "operator_owner", "rollback_owner", "compliance_reviewer"];

  for (const role of requiredRoles) {
    const entry = registry.entries.find(e => e.role === role);
    if (!entry) {
      issues.push(`필수 역할 미지정: ${role}`);
    } else if (!entry.assignee || entry.assignee.trim() === "") {
      issues.push(`담당자 미지정: ${role}`);
    }
  }

  return { valid: issues.length === 0, issues };
}

// ══════════════════════════════════════════════════════
// 4. Day-0 Monitoring Pack
// ══════════════════════════════════════════════════════

export interface MonitoringPoint {
  pointId: string;
  name: string;
  category: "runtime_signal" | "chain_health" | "stale" | "irreversible" | "rollback" | "compliance";
  /** 정상 범위 */
  normalRange: string;
  /** 경고 임계치 */
  warningThreshold: string;
  /** 위험 임계치 */
  criticalThreshold: string;
  /** 확인 주기 (분) */
  checkIntervalMin: number;
  /** 자동 알림 여부 */
  autoAlert: boolean;
}

export interface Day0MonitoringPack {
  packId: string;
  rc0Id: string;
  points: MonitoringPoint[];
  alertChannels: string[];
  escalationTimeMin: number;
  createdAt: string;
}

export function createDay0MonitoringPack(rc0Id: string, alertChannels: string[] = ["slack"]): Day0MonitoringPack {
  const points: MonitoringPoint[] = [
    // Runtime signals
    { pointId: "D0-RS1", name: "Grammar Coverage 점수", category: "runtime_signal", normalRange: "90~100", warningThreshold: "< 80", criticalThreshold: "< 60", checkIntervalMin: 5, autoAlert: true },
    { pointId: "D0-RS2", name: "Hardening Pipeline 점수", category: "runtime_signal", normalRange: "85~100", warningThreshold: "< 70", criticalThreshold: "< 50", checkIntervalMin: 5, autoAlert: true },
    { pointId: "D0-RS3", name: "Event Bus Health 점수", category: "runtime_signal", normalRange: "80~100", warningThreshold: "< 65", criticalThreshold: "< 40", checkIntervalMin: 5, autoAlert: true },
    { pointId: "D0-RS4", name: "Audit Wiring 점수", category: "runtime_signal", normalRange: "80~100", warningThreshold: "< 65", criticalThreshold: "< 40", checkIntervalMin: 5, autoAlert: true },
    { pointId: "D0-RS5", name: "Pilot Safety 점수", category: "runtime_signal", normalRange: "85~100", warningThreshold: "< 70", criticalThreshold: "< 50", checkIntervalMin: 5, autoAlert: true },
    // Chain health
    { pointId: "D0-CH1", name: "Blocked PO 수", category: "chain_health", normalRange: "0~2", warningThreshold: "> 5", criticalThreshold: "> 10", checkIntervalMin: 10, autoAlert: true },
    { pointId: "D0-CH2", name: "최장 blocked 시간 (분)", category: "chain_health", normalRange: "0~15", warningThreshold: "> 20", criticalThreshold: "> 30", checkIntervalMin: 10, autoAlert: true },
    // Stale
    { pointId: "D0-ST1", name: "Stale blocking 발생 수", category: "stale", normalRange: "0", warningThreshold: "> 2", criticalThreshold: "> 5", checkIntervalMin: 10, autoAlert: true },
    { pointId: "D0-ST2", name: "Stale domain 수", category: "stale", normalRange: "0", warningThreshold: "> 1", criticalThreshold: "> 3", checkIntervalMin: 10, autoAlert: true },
    // Irreversible
    { pointId: "D0-IR1", name: "Irreversible action 실패 수", category: "irreversible", normalRange: "0", warningThreshold: "> 0", criticalThreshold: "> 1", checkIntervalMin: 5, autoAlert: true },
    // Rollback
    { pointId: "D0-RB1", name: "Rollback trigger hit 여부", category: "rollback", normalRange: "없음", warningThreshold: "watch", criticalThreshold: "rollback_recommended 이상", checkIntervalMin: 5, autoAlert: true },
    // Compliance
    { pointId: "D0-CP1", name: "미준수 케이스 비율", category: "compliance", normalRange: "0~5%", warningThreshold: "> 20%", criticalThreshold: "> 50%", checkIntervalMin: 30, autoAlert: true },
    { pointId: "D0-CP2", name: "Compliance snapshot 캡처 여부", category: "compliance", normalRange: "30분 이내", warningThreshold: "1시간 초과", criticalThreshold: "2시간 초과", checkIntervalMin: 30, autoAlert: false },
  ];

  return {
    packId: `d0mon_${Date.now().toString(36)}`,
    rc0Id,
    points,
    alertChannels: [...alertChannels],
    escalationTimeMin: 15,
    createdAt: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════
// 5. Rollback Drill
// ══════════════════════════════════════════════════════

export interface RollbackDrillStep {
  stepId: string;
  description: string;
  order: number;
  executed: boolean;
  executedAt: string | null;
  executedBy: string | null;
  result: "pass" | "fail" | "skipped" | "not_executed";
  notes: string | null;
}

export interface RollbackDrillResult {
  drillId: string;
  rc0Id: string;
  conductedAt: string;
  conductedBy: string;
  steps: RollbackDrillStep[];
  overallResult: "pass" | "fail" | "partial";
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  /** drill 후 발견된 이슈 */
  discoveredIssues: string[];
  /** drill readiness — launch 가능 여부 */
  launchReady: boolean;
}

export function createRollbackDrillTemplate(rc0Id: string): RollbackDrillStep[] {
  return [
    { stepId: "RD-1", description: "Monitoring Workbench에서 rollback trigger 시뮬레이션 확인", order: 1, executed: false, executedAt: null, executedBy: null, result: "not_executed", notes: null },
    { stepId: "RD-2", description: "rollback_recommended 상태에서 dock 버튼 상태 확인", order: 2, executed: false, executedAt: null, executedBy: null, result: "not_executed", notes: null },
    { stepId: "RD-3", description: "rollback_required 상태에서 complete 버튼 비활성화 확인", order: 3, executed: false, executedAt: null, executedBy: null, result: "not_executed", notes: null },
    { stepId: "RD-4", description: "Rollback Pilot 버튼 클릭 → confirmation dialog 표시 확인", order: 4, executed: false, executedAt: null, executedBy: null, result: "not_executed", notes: null },
    { stepId: "RD-5", description: "rollback 실행 → 파일럿 비활성화 확인", order: 5, executed: false, executedAt: null, executedBy: null, result: "not_executed", notes: null },
    { stepId: "RD-6", description: "감사 스냅샷 자동 캡처 확인", order: 6, executed: false, executedAt: null, executedBy: null, result: "not_executed", notes: null },
    { stepId: "RD-7", description: "Dashboard에 rollback 상태 반영 확인", order: 7, executed: false, executedAt: null, executedBy: null, result: "not_executed", notes: null },
    { stepId: "RD-8", description: "Audit Review에서 rollback 이력 조회 가능 확인", order: 8, executed: false, executedAt: null, executedBy: null, result: "not_executed", notes: null },
    { stepId: "RD-9", description: "진행 중 PO가 기존 flow로 계속 처리 가능한지 확인", order: 9, executed: false, executedAt: null, executedBy: null, result: "not_executed", notes: null },
    { stepId: "RD-10", description: "rollback 후 재활성화 경로 확인 (새 RC0 필요)", order: 10, executed: false, executedAt: null, executedBy: null, result: "not_executed", notes: null },
  ];
}

export function evaluateRollbackDrill(
  rc0Id: string,
  conductedBy: string,
  steps: RollbackDrillStep[],
): RollbackDrillResult {
  const passed = steps.filter(s => s.result === "pass").length;
  const failed = steps.filter(s => s.result === "fail").length;

  let overallResult: "pass" | "fail" | "partial";
  if (failed === 0 && passed === steps.length) {
    overallResult = "pass";
  } else if (failed > 0) {
    overallResult = "fail";
  } else {
    overallResult = "partial";
  }

  const discoveredIssues = steps
    .filter(s => s.result === "fail" && s.notes)
    .map(s => `${s.stepId}: ${s.notes}`);

  return {
    drillId: `drill_${Date.now().toString(36)}`,
    rc0Id,
    conductedAt: new Date().toISOString(),
    conductedBy,
    steps,
    overallResult,
    totalSteps: steps.length,
    passedSteps: passed,
    failedSteps: failed,
    discoveredIssues,
    launchReady: overallResult === "pass",
  };
}

// ══════════════════════════════════════════════════════
// 6. Launch Readiness Check
// ══════════════════════════════════════════════════════

export interface LaunchReadinessCheck {
  rc0Id: string;
  evaluatedAt: string;
  scopeValid: boolean;
  scenariosValid: boolean;
  signoffComplete: boolean;
  monitoringConfigured: boolean;
  drillPassed: boolean;
  /** Overall launch readiness */
  ready: boolean;
  blockingReasons: string[];
}

export function evaluateLaunchReadiness(
  scope: RC0ScopeFreeze,
  scenarios: FrozenScenario[],
  signoff: SignoffRegistry,
  monitoring: Day0MonitoringPack,
  drill: RollbackDrillResult | null,
): LaunchReadinessCheck {
  const blockingReasons: string[] = [];

  const scopeValidation = validateRC0ScopeFreeze(scope);
  if (!scopeValidation.valid) {
    blockingReasons.push(...scopeValidation.issues);
  }

  const scenarioValidation = validateScenarioFreeze(scenarios);
  if (!scenarioValidation.valid) {
    blockingReasons.push(...scenarioValidation.issues);
  }

  const signoffValidation = validateSignoffRegistry(signoff);
  if (!signoffValidation.valid) {
    blockingReasons.push(...signoffValidation.issues);
  }
  if (!signoff.allSignedOff) {
    const unsigned = signoff.entries.filter(e => !e.signedOff).map(e => e.label);
    blockingReasons.push(`미서명 역할: ${unsigned.join(", ")}`);
  }

  if (monitoring.points.length === 0) {
    blockingReasons.push("모니터링 포인트 미설정");
  }

  if (!drill) {
    blockingReasons.push("rollback drill 미실시");
  } else if (!drill.launchReady) {
    blockingReasons.push(`rollback drill 실패: ${drill.failedSteps}건 실패`);
  }

  return {
    rc0Id: scope.rc0Id,
    evaluatedAt: new Date().toISOString(),
    scopeValid: scopeValidation.valid,
    scenariosValid: scenarioValidation.valid,
    signoffComplete: signoff.allSignedOff,
    monitoringConfigured: monitoring.points.length > 0,
    drillPassed: drill?.launchReady ?? false,
    ready: blockingReasons.length === 0,
    blockingReasons,
  };
}

// ══════════════════════════════════════════════════════
// 7. Launch Surface Builder
// ══════════════════════════════════════════════════════

export interface LaunchSurface {
  center: {
    ready: boolean;
    rc0Id: string;
    scopeSummary: {
      stages: number;
      domains: number;
      poLimit: number;
      durationDays: number;
      startDate: string;
      endDate: string;
    };
    scenarioSummary: {
      total: number;
      verified: number;
      totalSeedPOs: number;
    };
    signoffSummary: {
      total: number;
      completed: number;
      pending: string[];
    };
    drillSummary: {
      conducted: boolean;
      result: string;
      passedSteps: number;
      totalSteps: number;
    };
    monitoringSummary: {
      points: number;
      alertChannels: string[];
    };
    blockingReasons: string[];
  };
  rail: {
    scopeDetails: RC0ScopeFreeze;
    scenarios: Array<{ id: string; name: string; verified: boolean; seedRange: string }>;
    signoffEntries: Array<{ role: string; label: string; assignee: string; signedOff: boolean }>;
    monitoringPoints: Array<{ id: string; name: string; category: string; critical: string }>;
    drillSteps: Array<{ id: string; description: string; result: string }> | null;
  };
  dock: {
    actions: LaunchAction[];
  };
}

export interface LaunchAction {
  actionKey: string;
  label: string;
  enabled: boolean;
  requiresConfirmation: boolean;
  requiredRoles: string[];
  disabledReason: string | null;
}

export function buildLaunchSurface(
  readiness: LaunchReadinessCheck,
  scope: RC0ScopeFreeze,
  scenarios: FrozenScenario[],
  signoff: SignoffRegistry,
  monitoring: Day0MonitoringPack,
  drill: RollbackDrillResult | null,
): LaunchSurface {
  const pendingSignoffs = signoff.entries.filter(e => !e.signedOff).map(e => e.label);

  return {
    center: {
      ready: readiness.ready,
      rc0Id: scope.rc0Id,
      scopeSummary: {
        stages: scope.includedStages.length,
        domains: scope.activeDomains.length,
        poLimit: scope.poLimit,
        durationDays: scope.durationDays,
        startDate: scope.startDate,
        endDate: scope.endDate,
      },
      scenarioSummary: {
        total: scenarios.length,
        verified: scenarios.filter(s => s.acceptanceVerified).length,
        totalSeedPOs: scenarios.reduce((sum, s) => sum + (s.seedPoRange.to - s.seedPoRange.from + 1), 0),
      },
      signoffSummary: {
        total: signoff.entries.length,
        completed: signoff.entries.filter(e => e.signedOff).length,
        pending: pendingSignoffs,
      },
      drillSummary: {
        conducted: drill !== null,
        result: drill?.overallResult ?? "미실시",
        passedSteps: drill?.passedSteps ?? 0,
        totalSteps: drill?.totalSteps ?? 0,
      },
      monitoringSummary: {
        points: monitoring.points.length,
        alertChannels: monitoring.alertChannels,
      },
      blockingReasons: readiness.blockingReasons,
    },
    rail: {
      scopeDetails: scope,
      scenarios: scenarios.map(s => ({
        id: s.scenarioId,
        name: s.name,
        verified: s.acceptanceVerified,
        seedRange: `PO ${s.seedPoRange.from}~${s.seedPoRange.to}`,
      })),
      signoffEntries: signoff.entries.map(e => ({
        role: e.role,
        label: e.label,
        assignee: e.assignee,
        signedOff: e.signedOff,
      })),
      monitoringPoints: monitoring.points.map(p => ({
        id: p.pointId,
        name: p.name,
        category: p.category,
        critical: p.criticalThreshold,
      })),
      drillSteps: drill?.steps.map(s => ({
        id: s.stepId,
        description: s.description,
        result: s.result,
      })) ?? null,
    },
    dock: {
      actions: [
        {
          actionKey: "launch_pilot",
          label: getLifecycleActionLabel("launch_pilot"),
          enabled: readiness.ready,
          requiresConfirmation: true,
          requiredRoles: ["release_manager", "ops_lead"],
          disabledReason: readiness.ready ? null : `${readiness.blockingReasons.length}건 미충족`,
        },
        {
          actionKey: "conduct_drill",
          label: getLifecycleActionLabel("conduct_drill"),
          enabled: !drill || !drill.launchReady,
          requiresConfirmation: true,
          requiredRoles: ["ops_lead", "rollback_owner"],
          disabledReason: drill?.launchReady ? "리허설 이미 통과" : null,
        },
        {
          actionKey: "modify_scope",
          label: getLifecycleActionLabel("modify_scope"),
          enabled: true,
          requiresConfirmation: true,
          requiredRoles: ["release_manager"],
          disabledReason: null,
        },
        {
          actionKey: "export_launch_pack",
          label: getLifecycleActionLabel("export_launch_pack"),
          enabled: true,
          requiresConfirmation: false,
          requiredRoles: [],
          disabledReason: null,
        },
        {
          actionKey: "cancel_rc0",
          label: getLifecycleActionLabel("cancel_rc0"),
          enabled: true,
          requiresConfirmation: true,
          requiredRoles: ["release_manager"],
          disabledReason: null,
        },
      ],
    },
  };
}
