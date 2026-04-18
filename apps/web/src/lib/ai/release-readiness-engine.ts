/**
 * Release Readiness Engine — 파일럿 / 정식 릴리즈 전 governance chain 준비 상태 점검
 *
 * governance chain 전체(engine + surface + workbench + test + grammar)가
 * "배포 가능 상태"인지를 구조적으로 검증하는 gate.
 *
 * CORE CONTRACT:
 * 1. release gate는 truth를 변경하지 않음 — read-only 검증
 * 2. 모든 label은 grammar registry에서 resolve
 * 3. gate 통과 여부는 boolean이 아니라 structured verdict
 * 4. blocker = 릴리즈 차단, warning = 릴리즈 가능하나 주의, info = 참고사항
 * 5. gate 결과는 compliance snapshot store에 기록 가능
 *
 * IMMUTABLE RULES:
 * - gate가 engine/surface를 수정하면 안 됨
 * - optimistic pass 금지 — 실제 검증 결과로만 gate 열림
 * - grammar registry 외 label 하드코딩 금지
 */

import type { GovernanceDomain } from "./governance-event-bus";
import type { QuoteChainStage } from "./quote-approval-governance-engine";
import {
  CHAIN_STAGE_GRAMMAR,
  STATUS_GRAMMAR,
  PANEL_GRAMMAR,
  DOCK_ACTION_GRAMMAR,
  BLOCKER_SEVERITY_SPEC,
  SEVERITY_SPEC,
  validateGrammarRegistry,
  getStageLabel,
  type UnifiedSeverity,
} from "./governance-grammar-registry";

// ══════════════════════════════════════════════════════
// 1. Gate Check Types
// ══════════════════════════════════════════════════════

export type GateCheckStatus = "pass" | "fail" | "warning";

export interface GateCheck {
  checkId: string;
  category: GateCategory;
  name: string;
  description: string;
  status: GateCheckStatus;
  severity: UnifiedSeverity;
  severityLabel: string;
  detail: string;
  /** Suggested fix if failed */
  remediation: string | null;
}

export type GateCategory =
  | "grammar_integrity"
  | "engine_coverage"
  | "surface_consumption"
  | "test_coverage"
  | "event_wiring"
  | "hardening"
  | "documentation";

export interface ReleaseReadinessResult {
  resultId: string;
  evaluatedAt: string;
  /** Overall verdict */
  verdict: "ready" | "blocked" | "conditional";
  /** Total checks run */
  totalChecks: number;
  /** Checks by status */
  passed: number;
  failed: number;
  warnings: number;
  /** Categorized check results */
  checks: GateCheck[];
  /** Blocking issues (must fix before release) */
  blockers: GateCheck[];
  /** Warnings (can release but should address) */
  warningItems: GateCheck[];
  /** Release score (0-100) */
  readinessScore: number;
  /** Summary for operator */
  summaryMessage: string;
}

// ══════════════════════════════════════════════════════
// 2. Gate Check Definitions
// ══════════════════════════════════════════════════════

/**
 * 릴리즈 준비 상태를 구조적으로 검증.
 * 각 check는 독립적으로 실행되며, 결과는 structured verdict.
 */
export function evaluateReleaseReadiness(context: ReleaseReadinessContext): ReleaseReadinessResult {
  const checks: GateCheck[] = [];

  // ── Category 1: Grammar Integrity ──
  checks.push(checkGrammarRegistryIntegrity());
  checks.push(checkStageCount());
  checks.push(checkAllDomainsHaveStatuses());
  checks.push(checkTerminalStatusPresence());
  checks.push(checkIrreversibleActionProtection());

  // ── Category 2: Engine Coverage ──
  checks.push(checkEngineCoverage(context));
  checks.push(checkEngineGrammarConsumption(context));

  // ── Category 3: Surface Consumption ──
  checks.push(checkSurfaceGrammarConsumption(context));
  checks.push(checkWorkbenchPattern(context));

  // ── Category 4: Test Coverage ──
  checks.push(checkTestCoverage(context));

  // ── Category 5: Event Wiring ──
  checks.push(checkEventBusWiring(context));
  checks.push(checkInvalidationRules(context));

  // ── Category 6: Hardening ──
  checks.push(checkHardeningPipeline(context));

  // ── Category 7: Documentation ──
  checks.push(checkDocumentation(context));

  // Compute verdict
  const failed = checks.filter(c => c.status === "fail").length;
  const warnings = checks.filter(c => c.status === "warning").length;
  const passed = checks.filter(c => c.status === "pass").length;
  const total = checks.length;
  const readinessScore = total > 0 ? Math.round((passed / total) * 100) : 0;

  let verdict: "ready" | "blocked" | "conditional";
  if (failed > 0) verdict = "blocked";
  else if (warnings > 0) verdict = "conditional";
  else verdict = "ready";

  const summaryMessage = verdict === "ready"
    ? `모든 ${total}개 gate check 통과 — 릴리즈 준비 완료`
    : verdict === "conditional"
      ? `${warnings}개 주의사항 있음 — 조건부 릴리즈 가능`
      : `${failed}개 차단 항목 미해소 — 릴리즈 불가`;

  return {
    resultId: `rr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    evaluatedAt: new Date().toISOString(),
    verdict,
    totalChecks: total,
    passed,
    failed,
    warnings,
    checks,
    blockers: checks.filter(c => c.status === "fail"),
    warningItems: checks.filter(c => c.status === "warning"),
    readinessScore,
    summaryMessage,
  };
}

// ══════════════════════════════════════════════════════
// 3. Release Readiness Context — 외부에서 주입
// ══════════════════════════════════════════════════════

/**
 * Release readiness 검증에 필요한 외부 context.
 * engine/surface/test 현황을 구조적으로 전달.
 */
export interface ReleaseReadinessContext {
  /** 구현된 engine 목록 */
  implementedEngines: GovernanceDomain[];
  /** grammar registry를 직접 소비하는 engine 목록 */
  enginesConsumingGrammar: GovernanceDomain[];
  /** grammar registry를 직접 소비하는 surface/workbench 목록 */
  surfacesConsumingGrammar: string[];
  /** 전체 surface/workbench 목록 */
  totalSurfaces: string[];
  /** 테스트 파일 존재 여부 */
  testFiles: string[];
  /** event bus 연결된 domain 목록 */
  eventBusWiredDomains: GovernanceDomain[];
  /** invalidation rule 수 */
  invalidationRuleCount: number;
  /** hardening pipeline 존재 여부 */
  hardeningPipelineExists: boolean;
  /** architecture doc 존재 여부 */
  architectureDocExists: boolean;
  /** grammar doc / naming rules 존재 여부 */
  grammarDocExists: boolean;
}

// ══════════════════════════════════════════════════════
// 4. Individual Gate Check Functions
// ══════════════════════════════════════════════════════

function makeCheck(
  checkId: string,
  category: GateCategory,
  name: string,
  description: string,
  status: GateCheckStatus,
  detail: string,
  remediation: string | null = null,
): GateCheck {
  const severity: UnifiedSeverity = status === "fail" ? "critical" : status === "warning" ? "warning" : "info";
  return {
    checkId,
    category,
    name,
    description,
    status,
    severity,
    severityLabel: SEVERITY_SPEC[severity].label,
    detail,
    remediation,
  };
}

function checkGrammarRegistryIntegrity(): GateCheck {
  const result = validateGrammarRegistry();
  if (result.valid && result.warnings.length === 0) {
    return makeCheck("GI-1", "grammar_integrity", "Grammar Registry 무결성", "grammar registry 전체 무결성 검증", "pass", `${result.stats.stageCount} stages, ${result.stats.statusCount} statuses, ${result.stats.actionCount} actions — 무결`);
  }
  if (result.valid) {
    return makeCheck("GI-1", "grammar_integrity", "Grammar Registry 무결성", "grammar registry 전체 무결성 검증", "warning", `무결하나 ${result.warnings.length}건 주의: ${result.warnings[0]}`, "grammar registry warnings 검토");
  }
  return makeCheck("GI-1", "grammar_integrity", "Grammar Registry 무결성", "grammar registry 전체 무결성 검증", "fail", `${result.errors.length}건 오류: ${result.errors[0]}`, "governance-grammar-registry.ts 수정 필요");
}

function checkStageCount(): GateCheck {
  const count = CHAIN_STAGE_GRAMMAR.length;
  if (count === 13) {
    return makeCheck("GI-2", "grammar_integrity", "Chain Stage 수", "13-stage chain 완전성", "pass", "13단계 확정");
  }
  return makeCheck("GI-2", "grammar_integrity", "Chain Stage 수", "13-stage chain 완전성", "fail", `${count}단계 — 13단계 필요`, "CHAIN_STAGE_GRAMMAR 수정 필요");
}

function checkAllDomainsHaveStatuses(): GateCheck {
  const domains: GovernanceDomain[] = ["dispatch_prep", "dispatch_execution", "supplier_confirmation", "receiving_prep", "receiving_execution", "stock_release", "reorder_decision"];
  const missing = domains.filter(d => !STATUS_GRAMMAR.some(s => s.domain === d));
  if (missing.length === 0) {
    return makeCheck("GI-3", "grammar_integrity", "Domain Status 정의", "모든 domain에 status 정의 존재", "pass", `${domains.length}개 domain 모두 status 정의됨`);
  }
  return makeCheck("GI-3", "grammar_integrity", "Domain Status 정의", "모든 domain에 status 정의 존재", "fail", `${missing.join(", ")} domain에 status 없음`, "STATUS_GRAMMAR에 누락 domain 추가");
}

function checkTerminalStatusPresence(): GateCheck {
  const domains: GovernanceDomain[] = ["dispatch_prep", "dispatch_execution", "supplier_confirmation", "receiving_prep", "receiving_execution", "stock_release", "reorder_decision"];
  const missingCancelled = domains.filter(d => {
    const terminals = STATUS_GRAMMAR.filter(s => s.domain === d && s.isTerminal);
    return !terminals.some(s => s.status === "cancelled");
  });
  if (missingCancelled.length === 0) {
    return makeCheck("GI-4", "grammar_integrity", "Terminal Status 완전성", "모든 domain에 cancelled terminal 존재", "pass", "모든 domain에 cancelled terminal 존재");
  }
  return makeCheck("GI-4", "grammar_integrity", "Terminal Status 완전성", "모든 domain에 cancelled terminal 존재", "warning", `${missingCancelled.join(", ")}에 cancelled terminal 없음`, "STATUS_GRAMMAR에 cancelled 추가 권장");
}

function checkIrreversibleActionProtection(): GateCheck {
  const unprotected = DOCK_ACTION_GRAMMAR.filter(a => a.risk === "irreversible" && !a.blockedByStale);
  if (unprotected.length === 0) {
    return makeCheck("GI-5", "grammar_integrity", "Irreversible Action 보호", "모든 비가역 action이 stale에 의해 차단", "pass", `${DOCK_ACTION_GRAMMAR.filter(a => a.risk === "irreversible").length}개 비가역 action 모두 보호됨`);
  }
  return makeCheck("GI-5", "grammar_integrity", "Irreversible Action 보호", "모든 비가역 action이 stale에 의해 차단", "fail", `${unprotected.map(a => a.actionKey).join(", ")} 미보호`, "blockedByStale: true 설정 필요");
}

function checkEngineCoverage(ctx: ReleaseReadinessContext): GateCheck {
  const allDomains: GovernanceDomain[] = ["quote_chain", "dispatch_prep", "dispatch_execution", "supplier_confirmation", "receiving_prep", "receiving_execution", "stock_release", "reorder_decision"];
  const missing = allDomains.filter(d => !ctx.implementedEngines.includes(d));
  if (missing.length === 0) {
    return makeCheck("EC-1", "engine_coverage", "Engine 구현 완전성", "모든 governance domain에 engine 존재", "pass", `${allDomains.length}개 domain 모두 engine 구현됨`);
  }
  return makeCheck("EC-1", "engine_coverage", "Engine 구현 완전성", "모든 governance domain에 engine 존재", "fail", `${missing.join(", ")} engine 미구현`, "누락 domain engine 추가 필요");
}

function checkEngineGrammarConsumption(ctx: ReleaseReadinessContext): GateCheck {
  const notConsuming = ctx.implementedEngines.filter(d => !ctx.enginesConsumingGrammar.includes(d));
  if (notConsuming.length === 0) {
    return makeCheck("EC-2", "engine_coverage", "Engine Grammar 소비", "모든 engine이 grammar registry 소비", "pass", `${ctx.enginesConsumingGrammar.length}개 engine 모두 grammar 소비`);
  }
  return makeCheck("EC-2", "engine_coverage", "Engine Grammar 소비", "모든 engine이 grammar registry 소비", "warning", `${notConsuming.join(", ")} engine이 grammar 미소비`, "getStatusLabel() import 추가 필요");
}

function checkSurfaceGrammarConsumption(ctx: ReleaseReadinessContext): GateCheck {
  const ratio = ctx.totalSurfaces.length > 0 ? ctx.surfacesConsumingGrammar.length / ctx.totalSurfaces.length : 0;
  if (ratio >= 0.8) {
    return makeCheck("SC-1", "surface_consumption", "Surface Grammar 소비율", "surface의 80% 이상이 grammar registry 소비", "pass", `${ctx.surfacesConsumingGrammar.length}/${ctx.totalSurfaces.length} surface grammar 소비 (${Math.round(ratio * 100)}%)`);
  }
  if (ratio >= 0.5) {
    return makeCheck("SC-1", "surface_consumption", "Surface Grammar 소비율", "surface의 80% 이상이 grammar registry 소비", "warning", `${ctx.surfacesConsumingGrammar.length}/${ctx.totalSurfaces.length} surface grammar 소비 (${Math.round(ratio * 100)}%)`, "잔여 surface grammar 전환 필요");
  }
  return makeCheck("SC-1", "surface_consumption", "Surface Grammar 소비율", "surface의 80% 이상이 grammar registry 소비", "fail", `${ctx.surfacesConsumingGrammar.length}/${ctx.totalSurfaces.length} surface grammar 소비 (${Math.round(ratio * 100)}%)`, "surface grammar 전환 우선 진행 필요");
}

function checkWorkbenchPattern(ctx: ReleaseReadinessContext): GateCheck {
  // center/rail/dock pattern 일관성은 surface count로 proxy
  if (ctx.totalSurfaces.length >= 8) {
    return makeCheck("SC-2", "surface_consumption", "Workbench 패턴 완전성", "center/rail/dock 패턴 workbench 구현", "pass", `${ctx.totalSurfaces.length}개 workbench 구현됨`);
  }
  return makeCheck("SC-2", "surface_consumption", "Workbench 패턴 완전성", "center/rail/dock 패턴 workbench 구현", "warning", `${ctx.totalSurfaces.length}개 workbench — 8개 이상 권장`, "누락 domain workbench 추가 필요");
}

function checkTestCoverage(ctx: ReleaseReadinessContext): GateCheck {
  if (ctx.testFiles.length >= 6) {
    return makeCheck("TC-1", "test_coverage", "테스트 파일 수", "governance 관련 테스트 파일 충분", "pass", `${ctx.testFiles.length}개 테스트 파일`);
  }
  return makeCheck("TC-1", "test_coverage", "테스트 파일 수", "governance 관련 테스트 파일 충분", "warning", `${ctx.testFiles.length}개 테스트 파일 — 6개 이상 권장`, "테스트 파일 추가 필요");
}

function checkEventBusWiring(ctx: ReleaseReadinessContext): GateCheck {
  if (ctx.eventBusWiredDomains.length >= 5) {
    return makeCheck("EW-1", "event_wiring", "Event Bus 연결", "핵심 domain event bus 연결", "pass", `${ctx.eventBusWiredDomains.length}개 domain 연결됨`);
  }
  return makeCheck("EW-1", "event_wiring", "Event Bus 연결", "핵심 domain event bus 연결", "warning", `${ctx.eventBusWiredDomains.length}개 domain — 5개 이상 권장`, "event bus 연결 확대 필요");
}

function checkInvalidationRules(ctx: ReleaseReadinessContext): GateCheck {
  if (ctx.invalidationRuleCount >= 10) {
    return makeCheck("EW-2", "event_wiring", "Invalidation Rule 수", "targeted invalidation rule 충분", "pass", `${ctx.invalidationRuleCount}개 rule`);
  }
  return makeCheck("EW-2", "event_wiring", "Invalidation Rule 수", "targeted invalidation rule 충분", "warning", `${ctx.invalidationRuleCount}개 rule — 10개 이상 권장`, "invalidation rule 추가 필요");
}

function checkHardeningPipeline(ctx: ReleaseReadinessContext): GateCheck {
  if (ctx.hardeningPipelineExists) {
    return makeCheck("HP-1", "hardening", "Hardening Pipeline", "5-layer hardening pipeline 존재", "pass", "HardenedMutationPipeline 구현됨");
  }
  return makeCheck("HP-1", "hardening", "Hardening Pipeline", "5-layer hardening pipeline 존재", "fail", "hardening pipeline 미구현", "governance-hardening-engine.ts 구현 필요");
}

function checkDocumentation(ctx: ReleaseReadinessContext): GateCheck {
  if (ctx.architectureDocExists && ctx.grammarDocExists) {
    return makeCheck("DC-1", "documentation", "문서화", "ARCHITECTURE.md + grammar naming rules 문서 존재", "pass", "문서 존재 확인");
  }
  const missing: string[] = [];
  if (!ctx.architectureDocExists) missing.push("ARCHITECTURE.md");
  if (!ctx.grammarDocExists) missing.push("grammar naming rules");
  return makeCheck("DC-1", "documentation", "문서화", "ARCHITECTURE.md + grammar naming rules 문서 존재", "warning", `${missing.join(", ")} 누락`, "문서 추가 권장");
}

// ══════════════════════════════════════════════════════
// 5. Runtime Signal Provider — live context 수집
// ══════════════════════════════════════════════════════

/**
 * Runtime signal 제공 인터페이스.
 * 각 signal은 실제 시스템 상태에서 동적으로 수집.
 * 정적 context 대신 이 provider를 통해 release readiness를 평가하면
 * 실시간 변화가 gate 결과에 반영됨.
 */
export interface RuntimeSignalProvider {
  /** 현재 구현된 engine 파일 스캔 */
  scanImplementedEngines: () => GovernanceDomain[];
  /** grammar import 유무로 engine grammar 소비 판정 */
  scanEngineGrammarConsumption: () => GovernanceDomain[];
  /** surface/workbench 파일 스캔 + grammar import 체크 */
  scanSurfaceGrammarConsumption: () => { consuming: string[]; total: string[] };
  /** 테스트 파일 목록 스캔 */
  scanTestFiles: () => string[];
  /** event bus 구독 domain 스캔 */
  scanEventBusWiring: () => { wiredDomains: GovernanceDomain[]; invalidationRuleCount: number };
  /** hardening pipeline 존재 여부 */
  checkHardeningPipeline: () => boolean;
  /** 문서 존재 여부 */
  checkDocs: () => { architecture: boolean; grammar: boolean };
}

/**
 * Runtime signal provider로부터 ReleaseReadinessContext를 구성.
 * 이 함수를 통해 정적 context 대신 실시간 상태로 gate를 실행할 수 있음.
 */
export function buildRuntimeReadinessContext(provider: RuntimeSignalProvider): ReleaseReadinessContext {
  const surfaces = provider.scanSurfaceGrammarConsumption();
  const wiring = provider.scanEventBusWiring();
  const docs = provider.checkDocs();

  return {
    implementedEngines: provider.scanImplementedEngines(),
    enginesConsumingGrammar: provider.scanEngineGrammarConsumption(),
    surfacesConsumingGrammar: surfaces.consuming,
    totalSurfaces: surfaces.total,
    testFiles: provider.scanTestFiles(),
    eventBusWiredDomains: wiring.wiredDomains,
    invalidationRuleCount: wiring.invalidationRuleCount,
    hardeningPipelineExists: provider.checkHardeningPipeline(),
    architectureDocExists: docs.architecture,
    grammarDocExists: docs.grammar,
  };
}

/**
 * Runtime signal 건강도 요약.
 * 각 signal의 상태를 한눈에 파악하기 위한 lightweight check.
 * full gate 실행 전 빠른 사전 점검용.
 */
export interface RuntimeSignalHealth {
  signalId: string;
  name: string;
  healthy: boolean;
  detail: string;
}

export function checkRuntimeSignalHealth(provider: RuntimeSignalProvider): RuntimeSignalHealth[] {
  const signals: RuntimeSignalHealth[] = [];

  // Engine scan
  const engines = provider.scanImplementedEngines();
  signals.push({
    signalId: "RS-1",
    name: "Engine 스캔",
    healthy: engines.length >= 8,
    detail: `${engines.length}/8 domain engine 감지`,
  });

  // Grammar consumption
  const consuming = provider.scanEngineGrammarConsumption();
  signals.push({
    signalId: "RS-2",
    name: "Grammar 소비 스캔",
    healthy: consuming.length >= engines.length * 0.8,
    detail: `${consuming.length}/${engines.length} engine grammar 소비`,
  });

  // Surface scan
  const surfaces = provider.scanSurfaceGrammarConsumption();
  const surfaceRatio = surfaces.total.length > 0 ? surfaces.consuming.length / surfaces.total.length : 0;
  signals.push({
    signalId: "RS-3",
    name: "Surface 소비 스캔",
    healthy: surfaceRatio >= 0.8,
    detail: `${surfaces.consuming.length}/${surfaces.total.length} surface grammar 소비 (${Math.round(surfaceRatio * 100)}%)`,
  });

  // Event bus
  const wiring = provider.scanEventBusWiring();
  signals.push({
    signalId: "RS-4",
    name: "Event Bus 연결",
    healthy: wiring.wiredDomains.length >= 5 && wiring.invalidationRuleCount >= 10,
    detail: `${wiring.wiredDomains.length} domain, ${wiring.invalidationRuleCount} rules`,
  });

  // Hardening
  const hardening = provider.checkHardeningPipeline();
  signals.push({
    signalId: "RS-5",
    name: "Hardening Pipeline",
    healthy: hardening,
    detail: hardening ? "구현 확인" : "미구현",
  });

  return signals;
}

// ══════════════════════════════════════════════════════
// 6. Release Readiness Surface — workbench center/rail/dock
// ══════════════════════════════════════════════════════

export interface ReleaseReadinessSurface {
  center: {
    result: ReleaseReadinessResult;
    categoryBreakdown: Array<{
      category: GateCategory;
      categoryLabel: string;
      passed: number;
      failed: number;
      warnings: number;
      total: number;
    }>;
  };
  rail: {
    blockerSummary: string[];
    warningSummary: string[];
    readinessScore: number;
    stageLabels: Array<{ stage: QuoteChainStage; label: string }>;
    /** App runtime signal 요약 (연결 시 표시, 미연결 시 null) */
    runtimeSignals: RuntimeSignalHealth[] | null;
  };
  dock: {
    actions: Array<{
      actionKey: "rerun_gate" | "export_result" | "view_blockers" | "proceed_to_pilot";
      label: string;
      enabled: boolean;
    }>;
  };
}

const CATEGORY_LABELS: Record<GateCategory, string> = {
  grammar_integrity: "Grammar 무결성",
  engine_coverage: "Engine 구현",
  surface_consumption: "Surface 소비",
  test_coverage: "테스트 커버리지",
  event_wiring: "Event 연결",
  hardening: "하드닝",
  documentation: "문서화",
};

export function buildReleaseReadinessSurface(
  result: ReleaseReadinessResult,
  runtimeSignals?: RuntimeSignalHealth[] | null,
): ReleaseReadinessSurface {
  const categories: GateCategory[] = ["grammar_integrity", "engine_coverage", "surface_consumption", "test_coverage", "event_wiring", "hardening", "documentation"];

  const categoryBreakdown = categories.map(cat => {
    const catChecks = result.checks.filter(c => c.category === cat);
    return {
      category: cat,
      categoryLabel: CATEGORY_LABELS[cat],
      passed: catChecks.filter(c => c.status === "pass").length,
      failed: catChecks.filter(c => c.status === "fail").length,
      warnings: catChecks.filter(c => c.status === "warning").length,
      total: catChecks.length,
    };
  }).filter(cb => cb.total > 0);

  const stageLabels = CHAIN_STAGE_GRAMMAR.map(s => ({
    stage: s.stage,
    label: s.fullLabel,
  }));

  return {
    center: { result, categoryBreakdown },
    rail: {
      blockerSummary: result.blockers.map(b => b.detail),
      warningSummary: result.warningItems.map(w => w.detail),
      readinessScore: result.readinessScore,
      stageLabels,
      runtimeSignals: runtimeSignals ?? null,
    },
    dock: {
      actions: [
        { actionKey: "rerun_gate", label: "Gate 재실행", enabled: true },
        { actionKey: "export_result", label: "결과 내보내기", enabled: true },
        { actionKey: "view_blockers", label: "차단 항목 보기", enabled: result.blockers.length > 0 },
        { actionKey: "proceed_to_pilot", label: "파일럿 진행", enabled: result.verdict !== "blocked" },
      ],
    },
  };
}
