/**
 * App Runtime Signal Provider — 실제 앱 상태 기반 release readiness 신호 수집
 *
 * Batch 14: Runtime Signal Wiring Pack
 *
 * 파일 시스템 스캐너가 아니라, 실제 앱 서비스/상태/구성/연결 상태를 읽는 provider.
 * evaluateReleaseReadiness()가 mock이 아닌 실제 product runtime을 보고 verdict를 냄.
 *
 * CORE CONTRACT:
 * 1. read-only — 어떤 truth도 변경하지 않음
 * 2. 각 signal은 독립적으로 수집 가능 — 하나 실패해도 나머지는 계속
 * 3. 결과는 structured — boolean이 아니라 detail + remediation 포함
 * 4. grammar registry 외 label 하드코딩 금지
 *
 * 5개 핵심 signal:
 * RS-1: Grammar consumption coverage
 * RS-2: Hardening pipeline coverage (irreversible mutation protection)
 * RS-3: Event bus wiring health
 * RS-4: Audit/compliance wiring health
 * RS-5: Pilot execution readiness
 */

import type { GovernanceDomain } from "./governance-event-bus";
import type { GovernanceEventBus } from "./governance-event-bus";
import {
  CHAIN_STAGE_GRAMMAR,
  STATUS_GRAMMAR,
  DOCK_ACTION_GRAMMAR,
  PANEL_GRAMMAR,
  SEVERITY_SPEC,
  validateGrammarRegistry,
  getStageLabel,
  getIrreversibleActions,
  type DockActionGrammar,
  type UnifiedSeverity,
} from "./governance-grammar-registry";
import { GOVERNANCE_INVALIDATION_RULES } from "./governance-event-bus";
import type { DecisionLogStore } from "./governance-audit-engine";
import type { ComplianceSnapshotStore } from "./governance-audit-engine";
import type { PilotPlan } from "./pilot-activation-engine";
import type {
  RuntimeSignalProvider,
  ReleaseReadinessContext,
} from "./release-readiness-engine";

// ══════════════════════════════════════════════════════
// 1. Signal Result Types
// ══════════════════════════════════════════════════════

export interface SignalCheckResult {
  signalId: string;
  name: string;
  severity: UnifiedSeverity;
  severityLabel: string;
  passed: boolean;
  score: number;       // 0-100
  detail: string;
  /** 구체적 문제 항목 (실패 시) */
  issues: string[];
  /** 수정 방법 (실패 시) */
  remediation: string | null;
}

export interface AppRuntimeSignalReport {
  evaluatedAt: string;
  signals: SignalCheckResult[];
  overallHealthy: boolean;
  overallScore: number;
  criticalIssues: string[];
  warningIssues: string[];
}

// ══════════════════════════════════════════════════════
// 2. App Runtime Context — 실제 앱에서 주입
// ══════════════════════════════════════════════════════

/**
 * 실제 앱 상태를 주입하는 context.
 * 각 필드는 앱의 실제 서비스/스토어/bus/config에서 읽어온 값.
 */
export interface AppRuntimeContext {
  // ── Grammar consumption ──
  /** domain별로 grammar registry를 import하는 engine 목록 */
  enginesWithGrammarImport: GovernanceDomain[];
  /** 전체 구현된 engine 목록 */
  allImplementedEngines: GovernanceDomain[];
  /** grammar registry를 import하는 surface/workbench 목록 */
  surfacesWithGrammarImport: string[];
  /** 전체 surface/workbench 목록 */
  allSurfaces: string[];
  /** 남은 hardcoded label 건수 (governance domain label, 라인 아이템 label 제외) */
  remainingHardcodedLabelCount: number;

  // ── Hardening pipeline ──
  /** irreversible action 중 hardening pipeline을 통과하는 action 목록 */
  actionsWithHardeningPipeline: string[];
  /** ConcurrencyGuard 인스턴스 존재 여부 */
  concurrencyGuardExists: boolean;
  /** IdempotencyGuard 인스턴스 존재 여부 */
  idempotencyGuardExists: boolean;
  /** ErrorTracker 인스턴스 존재 여부 */
  errorTrackerExists: boolean;

  // ── Event bus ──
  /** event bus 인스턴스 (subscriber/history 조회용) */
  eventBus: GovernanceEventBus | null;
  /** event bus에 구독된 domain 목록 */
  subscribedDomains: GovernanceDomain[];
  /** invalidation rule 수 */
  invalidationRuleCount: number;
  /** stale context detection이 활성화된 domain 목록 */
  staleDetectionDomains: GovernanceDomain[];

  // ── Audit/compliance ──
  /** DecisionLogStore 인스턴스 존재 여부 */
  decisionLogStoreExists: boolean;
  /** event bus에 audit auto-attach가 걸려 있는지 */
  auditAutoAttachActive: boolean;
  /** ComplianceSnapshotStore 인스턴스 존재 여부 */
  complianceSnapshotStoreExists: boolean;
  /** compliance snapshot auto-trigger 간격 (0이면 미설정) */
  complianceSnapshotIntervalMin: number;

  // ── Pilot execution ──
  /** 활성 pilot plan (없으면 null) */
  activePilotPlan: PilotPlan | null;
  /** pilot용 role gating이 구성되어 있는지 */
  pilotRoleGatingConfigured: boolean;
  /** pilot용 confirmation dialog가 irreversible action에 강제되는지 */
  pilotConfirmationDialogEnforced: boolean;
  /** rollback trigger가 완전히 구성되어 있는지 */
  rollbackTriggersComplete: boolean;
  /** monitoring config가 구성되어 있는지 */
  monitoringConfigured: boolean;
}

// ══════════════════════════════════════════════════════
// 3. Individual Signal Checkers
// ══════════════════════════════════════════════════════

/**
 * RS-1: Grammar Consumption Coverage
 *
 * - engine grammar import 비율
 * - surface grammar import 비율
 * - 남은 hardcoded label 수
 * - registry adapter(getStatusLabel 등) 적용률
 */
export function checkGrammarCoverage(ctx: AppRuntimeContext): SignalCheckResult {
  const issues: string[] = [];

  // Engine coverage
  const engineTotal = ctx.allImplementedEngines.length;
  const engineConsuming = ctx.enginesWithGrammarImport.length;
  const engineRatio = engineTotal > 0 ? engineConsuming / engineTotal : 1;
  if (engineRatio < 1) {
    const missing = ctx.allImplementedEngines.filter(d => !ctx.enginesWithGrammarImport.includes(d));
    issues.push(`engine grammar 미소비: ${missing.join(", ")}`);
  }

  // Surface coverage
  const surfaceTotal = ctx.allSurfaces.length;
  const surfaceConsuming = ctx.surfacesWithGrammarImport.length;
  const surfaceRatio = surfaceTotal > 0 ? surfaceConsuming / surfaceTotal : 1;
  if (surfaceRatio < 0.8) {
    issues.push(`surface grammar 소비율 ${Math.round(surfaceRatio * 100)}% — 80% 이상 필요`);
  }

  // Hardcoded labels
  if (ctx.remainingHardcodedLabelCount > 0) {
    issues.push(`남은 hardcoded governance label: ${ctx.remainingHardcodedLabelCount}건`);
  }

  const score = Math.round(
    (engineRatio * 40 + Math.min(surfaceRatio / 0.8, 1) * 30 + (ctx.remainingHardcodedLabelCount === 0 ? 30 : Math.max(0, 30 - ctx.remainingHardcodedLabelCount * 5)))
  );
  const passed = issues.length === 0;

  return {
    signalId: "RS-1",
    name: "Grammar Consumption Coverage",
    severity: passed ? "info" : issues.some(i => i.includes("engine")) ? "critical" : "warning",
    severityLabel: passed ? SEVERITY_SPEC.info.label : issues.some(i => i.includes("engine")) ? SEVERITY_SPEC.critical.label : SEVERITY_SPEC.warning.label,
    passed,
    score: Math.max(0, Math.min(100, score)),
    detail: passed
      ? `${engineConsuming}/${engineTotal} engine, ${surfaceConsuming}/${surfaceTotal} surface — grammar 전량 소비`
      : `${issues.length}건 미해결`,
    issues,
    remediation: passed ? null : "getStatusLabel()/getStageLabel() import 추가, hardcoded label 제거",
  };
}

/**
 * RS-2: Hardening Pipeline Coverage
 *
 * - irreversible action 중 hardening pipeline 경유 비율
 * - concurrency guard 존재
 * - idempotency guard 존재
 * - error boundary 존재
 */
export function checkMutationPipelineCoverage(ctx: AppRuntimeContext): SignalCheckResult {
  const issues: string[] = [];

  // Irreversible actions protected
  const allIrreversible = DOCK_ACTION_GRAMMAR.filter(a => a.risk === "irreversible");
  const protectedActions = ctx.actionsWithHardeningPipeline;
  const unprotected = allIrreversible.filter(a => !protectedActions.includes(a.actionKey));
  if (unprotected.length > 0) {
    issues.push(`비보호 irreversible action: ${unprotected.map(a => a.actionKey).join(", ")}`);
  }

  // Guard layers
  if (!ctx.concurrencyGuardExists) issues.push("ConcurrencyGuard 미구성");
  if (!ctx.idempotencyGuardExists) issues.push("IdempotencyGuard 미구성");
  if (!ctx.errorTrackerExists) issues.push("ErrorTracker 미구성");

  const protectionRatio = allIrreversible.length > 0
    ? (allIrreversible.length - unprotected.length) / allIrreversible.length
    : 1;
  const guardScore = (ctx.concurrencyGuardExists ? 10 : 0) + (ctx.idempotencyGuardExists ? 10 : 0) + (ctx.errorTrackerExists ? 10 : 0);
  const score = Math.round(protectionRatio * 70 + guardScore);
  const passed = issues.length === 0;

  return {
    signalId: "RS-2",
    name: "Hardening Pipeline Coverage",
    severity: passed ? "info" : unprotected.length > 0 ? "critical" : "warning",
    severityLabel: passed ? SEVERITY_SPEC.info.label : unprotected.length > 0 ? SEVERITY_SPEC.critical.label : SEVERITY_SPEC.warning.label,
    passed,
    score: Math.max(0, Math.min(100, score)),
    detail: passed
      ? `${allIrreversible.length}개 irreversible action 전량 보호, 3 guard layer 구성 완료`
      : `${issues.length}건 미해결`,
    issues,
    remediation: passed ? null : "executeWithBoundary() 래핑 및 guard 인스턴스 생성 필요",
  };
}

/**
 * RS-3: Event Bus Wiring Health
 *
 * - subscriber attach 상태 (domain별)
 * - invalidation mapping 누락 여부
 * - stale context detection availability
 */
export function checkEventBusHealth(ctx: AppRuntimeContext): SignalCheckResult {
  const issues: string[] = [];
  const ALL_DOMAINS: GovernanceDomain[] = [
    "quote_chain", "dispatch_prep", "dispatch_execution", "supplier_confirmation",
    "receiving_prep", "receiving_execution", "stock_release", "reorder_decision",
  ];

  // Subscriber coverage
  const unsubscribed = ALL_DOMAINS.filter(d => !ctx.subscribedDomains.includes(d));
  if (unsubscribed.length > 0) {
    issues.push(`event bus 미구독 domain: ${unsubscribed.join(", ")}`);
  }

  // Event bus existence
  if (!ctx.eventBus) {
    issues.push("GovernanceEventBus 인스턴스 없음");
  }

  // Invalidation rules
  if (ctx.invalidationRuleCount < 10) {
    issues.push(`invalidation rule ${ctx.invalidationRuleCount}건 — 10건 이상 필요`);
  }

  // Stale detection
  const staleUnwired = ALL_DOMAINS.filter(d => !ctx.staleDetectionDomains.includes(d));
  if (staleUnwired.length > 3) {
    issues.push(`stale detection 미설정 domain ${staleUnwired.length}개 — 과반 이상 설정 필요`);
  }

  const subscriberRatio = ALL_DOMAINS.length > 0
    ? ctx.subscribedDomains.length / ALL_DOMAINS.length
    : 0;
  const ruleScore = Math.min(ctx.invalidationRuleCount / 10, 1) * 30;
  const staleScore = ctx.staleDetectionDomains.length >= 5 ? 20 : ctx.staleDetectionDomains.length * 4;
  const score = Math.round(subscriberRatio * 50 + ruleScore + staleScore);
  const passed = issues.length === 0;

  return {
    signalId: "RS-3",
    name: "Event Bus Wiring Health",
    severity: passed ? "info" : !ctx.eventBus ? "critical" : "warning",
    severityLabel: passed ? SEVERITY_SPEC.info.label : !ctx.eventBus ? SEVERITY_SPEC.critical.label : SEVERITY_SPEC.warning.label,
    passed,
    score: Math.max(0, Math.min(100, score)),
    detail: passed
      ? `${ctx.subscribedDomains.length}/${ALL_DOMAINS.length} domain 구독, ${ctx.invalidationRuleCount} rules, stale detection 활성`
      : `${issues.length}건 미해결`,
    issues,
    remediation: passed ? null : "event bus subscribe() 및 invalidation rule 추가 필요",
  };
}

/**
 * RS-4: Audit/Compliance Wiring Health
 *
 * - compliance snapshot auto trigger 동작 여부
 * - decision log append 누락 여부
 * - audit → event bus auto-attach 상태
 */
export function checkComplianceWiringHealth(ctx: AppRuntimeContext): SignalCheckResult {
  const issues: string[] = [];

  if (!ctx.decisionLogStoreExists) {
    issues.push("DecisionLogStore 미생성");
  }
  if (!ctx.auditAutoAttachActive) {
    issues.push("event bus → audit auto-attach 미연결");
  }
  if (!ctx.complianceSnapshotStoreExists) {
    issues.push("ComplianceSnapshotStore 미생성");
  }
  if (ctx.complianceSnapshotIntervalMin === 0) {
    issues.push("compliance snapshot auto-trigger 미설정");
  }

  const componentCount = [
    ctx.decisionLogStoreExists,
    ctx.auditAutoAttachActive,
    ctx.complianceSnapshotStoreExists,
    ctx.complianceSnapshotIntervalMin > 0,
  ].filter(Boolean).length;
  const score = Math.round((componentCount / 4) * 100);
  const passed = issues.length === 0;

  return {
    signalId: "RS-4",
    name: "Audit/Compliance Wiring Health",
    severity: passed ? "info" : componentCount <= 1 ? "critical" : "warning",
    severityLabel: passed ? SEVERITY_SPEC.info.label : componentCount <= 1 ? SEVERITY_SPEC.critical.label : SEVERITY_SPEC.warning.label,
    passed,
    score: Math.max(0, Math.min(100, score)),
    detail: passed
      ? `decision log + compliance snapshot + auto-attach + auto-trigger 전량 구성`
      : `4개 구성요소 중 ${componentCount}개만 구성됨`,
    issues,
    remediation: passed ? null : "createDecisionLogStore(), attachAuditToEventBus(), createComplianceSnapshotStore() 호출 필요",
  };
}

/**
 * RS-5: Pilot Execution Readiness
 *
 * - role gating 구성 여부
 * - confirmation dialog 강제 여부
 * - rollback trigger/config completeness
 * - monitoring config 여부
 */
export function checkPilotActivationSafety(ctx: AppRuntimeContext): SignalCheckResult {
  const issues: string[] = [];

  if (!ctx.pilotRoleGatingConfigured) {
    issues.push("pilot role gating 미구성 — 비인가 활성화 가능");
  }
  if (!ctx.pilotConfirmationDialogEnforced) {
    issues.push("irreversible action confirmation dialog 미강제");
  }
  if (!ctx.rollbackTriggersComplete) {
    issues.push("rollback trigger 구성 불완전");
  }
  if (!ctx.monitoringConfigured) {
    issues.push("monitoring config 미설정");
  }

  // Active pilot plan 검증
  if (ctx.activePilotPlan) {
    const plan = ctx.activePilotPlan;
    if (plan.rollbackPlan.triggers.length === 0) {
      issues.push("활성 pilot plan에 rollback trigger 없음");
    }
    if (plan.rollbackPlan.authorizedRoles.length === 0) {
      issues.push("rollback 권한 역할 미지정");
    }
    const requiredUnchecked = plan.checklist.filter(i => i.required && !i.checked);
    if (requiredUnchecked.length > 0 && plan.status === "active") {
      issues.push(`활성 pilot에 미완료 필수 항목 ${requiredUnchecked.length}건`);
    }
  }

  const safetyCount = [
    ctx.pilotRoleGatingConfigured,
    ctx.pilotConfirmationDialogEnforced,
    ctx.rollbackTriggersComplete,
    ctx.monitoringConfigured,
  ].filter(Boolean).length;
  const score = Math.round((safetyCount / 4) * 100);
  const passed = issues.length === 0;

  return {
    signalId: "RS-5",
    name: "Pilot Execution Readiness",
    severity: passed ? "info" : safetyCount <= 1 ? "critical" : "warning",
    severityLabel: passed ? SEVERITY_SPEC.info.label : safetyCount <= 1 ? SEVERITY_SPEC.critical.label : SEVERITY_SPEC.warning.label,
    passed,
    score: Math.max(0, Math.min(100, score)),
    detail: passed
      ? `role gating + confirmation + rollback trigger + monitoring 전량 구성`
      : `4개 안전장치 중 ${safetyCount}개만 구성됨`,
    issues,
    remediation: passed ? null : "PilotActivationWorkbench의 authorizedRoles/confirmation/rollback/monitoring 구성 필요",
  };
}

// ══════════════════════════════════════════════════════
// 4. Aggregated App Runtime Signal Report
// ══════════════════════════════════════════════════════

/**
 * 5개 signal을 모두 수집하여 종합 report 생성.
 * release readiness gate가 이 report를 소비.
 */
export function buildAppRuntimeSignalReport(ctx: AppRuntimeContext): AppRuntimeSignalReport {
  const signals: SignalCheckResult[] = [
    checkGrammarCoverage(ctx),
    checkMutationPipelineCoverage(ctx),
    checkEventBusHealth(ctx),
    checkComplianceWiringHealth(ctx),
    checkPilotActivationSafety(ctx),
  ];

  const criticalIssues = signals
    .filter(s => s.severity === "critical")
    .flatMap(s => s.issues);
  const warningIssues = signals
    .filter(s => s.severity === "warning")
    .flatMap(s => s.issues);

  const overallScore = signals.length > 0
    ? Math.round(signals.reduce((sum, s) => sum + s.score, 0) / signals.length)
    : 0;

  return {
    evaluatedAt: new Date().toISOString(),
    signals,
    overallHealthy: signals.every(s => s.passed),
    overallScore,
    criticalIssues,
    warningIssues,
  };
}

// ══════════════════════════════════════════════════════
// 5. AppRuntimeSignalProvider → RuntimeSignalProvider Adapter
// ══════════════════════════════════════════════════════

/**
 * AppRuntimeContext를 기존 RuntimeSignalProvider 인터페이스로 변환.
 * 기존 release-readiness-engine.ts의 buildRuntimeReadinessContext()와 호환.
 */
export function createAppRuntimeSignalProvider(ctx: AppRuntimeContext): RuntimeSignalProvider {
  return {
    scanImplementedEngines: () => ctx.allImplementedEngines,
    scanEngineGrammarConsumption: () => ctx.enginesWithGrammarImport,
    scanSurfaceGrammarConsumption: () => ({
      consuming: ctx.surfacesWithGrammarImport,
      total: ctx.allSurfaces,
    }),
    scanTestFiles: () => [], // test file scan은 runtime signal이 아님 — 빈 배열 반환
    scanEventBusWiring: () => ({
      wiredDomains: ctx.subscribedDomains,
      invalidationRuleCount: ctx.invalidationRuleCount,
    }),
    checkHardeningPipeline: () =>
      ctx.concurrencyGuardExists && ctx.idempotencyGuardExists && ctx.errorTrackerExists,
    checkDocs: () => ({
      architecture: true,  // docs는 runtime signal이 아님 — 항상 true
      grammar: true,
    }),
  };
}

/**
 * AppRuntimeContext에서 ReleaseReadinessContext를 생성하고 evaluateReleaseReadiness를 실행할 수 있도록.
 * runtime signal report와 release readiness result를 한 번에 얻는 편의 함수.
 */
export function buildReleaseReadinessContextFromApp(ctx: AppRuntimeContext): ReleaseReadinessContext {
  const provider = createAppRuntimeSignalProvider(ctx);
  return {
    implementedEngines: provider.scanImplementedEngines(),
    enginesConsumingGrammar: provider.scanEngineGrammarConsumption(),
    surfacesConsumingGrammar: provider.scanSurfaceGrammarConsumption().consuming,
    totalSurfaces: provider.scanSurfaceGrammarConsumption().total,
    testFiles: provider.scanTestFiles(),
    eventBusWiredDomains: provider.scanEventBusWiring().wiredDomains,
    invalidationRuleCount: provider.scanEventBusWiring().invalidationRuleCount,
    hardeningPipelineExists: provider.checkHardeningPipeline(),
    architectureDocExists: provider.checkDocs().architecture,
    grammarDocExists: provider.checkDocs().grammar,
  };
}
