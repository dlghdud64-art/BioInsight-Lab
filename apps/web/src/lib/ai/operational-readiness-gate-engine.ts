/**
 * Operational Readiness Final Gate Engine — Batch 17
 *
 * "좋아 보인다"를 "켜도 된다"로 바꾸는 최종 운영 승인 레이어.
 *
 * CORE CONTRACT:
 * 1. 점수는 참고용, blocker는 결정용 — critical blocker 1개라도 go 불가
 * 2. 7개 category 고정 (Structure / Runtime / Mutation / Pilot / Observability / Continuity / Scope)
 * 3. Release Candidate Snapshot을 한 묶음으로 고정 — "왜 이 버전을 켰는지" 근거
 * 4. go / conditional_go / hold는 irreversible action에 준하는 취급
 * 5. 기존 truth 변경 없음 — read-only 통합 판단만
 *
 * IMMUTABLE RULES:
 * - 각 category evaluator는 독립 실행 가능
 * - blocker는 단 하나라도 있으면 go를 절대 반환하지 않음
 * - scope recommendation은 verdict와 독립적으로 산출
 * - grammar registry 외 label 하드코딩 금지
 */

import type { ReleaseReadinessResult } from "./release-readiness-engine";
import type { AppRuntimeSignalReport, SignalCheckResult } from "./app-runtime-signal-provider";
import type { PilotPlan, PilotStatus } from "./pilot-activation-engine";
import type { ProductAcceptanceReport } from "./product-acceptance-engine";
import type { ComplianceSnapshot } from "./governance-audit-engine";
import type { RollbackEvaluationResult, RollbackRecommendation } from "./pilot-monitoring-engine";
import type { QuoteChainStage } from "./quote-approval-governance-engine";
import type { GovernanceDomain } from "./governance-event-bus";
import { SEVERITY_SPEC, type UnifiedSeverity } from "./governance-grammar-registry";

// ══════════════════════════════════════════════════════
// 1. Gate Category Types
// ══════════════════════════════════════════════════════

export type GateCategoryId =
  | "structure_integrity"
  | "runtime_health"
  | "mutation_safety"
  | "pilot_safety"
  | "observability"
  | "operational_continuity"
  | "scope_control";

export const GATE_CATEGORY_LABELS: Record<GateCategoryId, string> = {
  structure_integrity: "구조 무결성",
  runtime_health: "런타임 건강도",
  mutation_safety: "변경 안전성",
  pilot_safety: "파일럿 안전성",
  observability: "관측 가능성",
  operational_continuity: "운영 연속성",
  scope_control: "범위 통제",
} as const;

export interface CategoryEvaluation {
  categoryId: GateCategoryId;
  categoryLabel: string;
  passed: boolean;
  score: number; // 0–100
  blockers: GateIssue[];
  conditionals: GateIssue[];
  evidence: string[];
}

export interface GateIssue {
  issueId: string;
  severity: UnifiedSeverity;
  severityLabel: string;
  category: GateCategoryId;
  summary: string;
  detail: string;
  /** blocker = go 차단, conditional = conditional_go 가능 */
  impact: "blocker" | "conditional";
}

// ══════════════════════════════════════════════════════
// 2. Verdict & Scope Types
// ══════════════════════════════════════════════════════

export type OperationalVerdict = "go" | "conditional_go" | "no_go";

export type ActivationScope = "internal_only" | "pilot_limited" | "pilot_expanded" | "hold";

export interface ActivationScopeRecommendation {
  scope: ActivationScope;
  reason: string;
  suggestedPoLimit: number;
  suggestedDomains: GovernanceDomain[];
  suggestedDurationDays: number;
}

export interface OperationalReadinessVerdict {
  verdict: OperationalVerdict;
  evaluatedAt: string;
  overallScore: number;
  categoryCount: number;
  passedCategories: number;
  failedCategories: number;
  totalBlockers: number;
  totalConditionals: number;
  categories: CategoryEvaluation[];
  blockingIssues: GateIssue[];
  conditionalIssues: GateIssue[];
  scopeRecommendation: ActivationScopeRecommendation;
  rollbackConfidence: "high" | "medium" | "low" | "unknown";
}

// ══════════════════════════════════════════════════════
// 3. Release Candidate Snapshot
// ══════════════════════════════════════════════════════

export interface ReleaseCandidateSnapshot {
  snapshotId: string;
  capturedAt: string;
  /** Grammar registry version (stage count) */
  grammarVersion: { stageCount: number; statusCount: number; actionCount: number };
  /** Runtime signal report summary */
  runtimeSignalSummary: { overallScore: number; overallHealthy: boolean; criticalCount: number; warningCount: number };
  /** Product acceptance verdict */
  acceptanceVerdict: "accepted" | "rejected" | "conditional";
  acceptancePassedScenarios: number;
  acceptanceTotalScenarios: number;
  /** Pilot plan snapshot (if exists) */
  pilotPlanId: string | null;
  pilotStatus: PilotStatus | null;
  /** Compliance summary */
  complianceSummary: { totalSnapshots: number; nonCompliantCount: number; latestCapturedAt: string | null };
  /** Rollback readiness */
  rollbackRecommendation: RollbackRecommendation | null;
  /** Gate verdict */
  gateVerdict: OperationalVerdict;
  gateScore: number;
  /** Approver */
  approver: string | null;
  /** Recommended scope */
  recommendedScope: ActivationScope;
}

// ══════════════════════════════════════════════════════
// 4. Gate Input
// ══════════════════════════════════════════════════════

export interface OperationalReadinessInput {
  releaseReadiness: ReleaseReadinessResult;
  runtimeSignalReport: AppRuntimeSignalReport;
  pilotPlan: PilotPlan | null;
  acceptanceReport: ProductAcceptanceReport;
  complianceSnapshots: ComplianceSnapshot[];
  rollbackEvaluation: RollbackEvaluationResult | null;
  /** Audit availability flags */
  auditLogAvailable: boolean;
  complianceSnapshotStoreAvailable: boolean;
  reportingAvailable: boolean;
  /** Continuity flags */
  reconnectMechanismExists: boolean;
  replayMechanismExists: boolean;
  persistenceLayerHealthy: boolean;
  recoveryTestedRecently: boolean;
}

// ══════════════════════════════════════════════════════
// 5. Category Evaluators
// ══════════════════════════════════════════════════════

function makeSeverityLabel(severity: UnifiedSeverity): string {
  return SEVERITY_SPEC[severity]?.label ?? severity;
}

function makeIssue(
  id: string,
  severity: UnifiedSeverity,
  category: GateCategoryId,
  summary: string,
  detail: string,
  impact: "blocker" | "conditional",
): GateIssue {
  return { issueId: id, severity, severityLabel: makeSeverityLabel(severity), category, summary, detail, impact };
}

/**
 * Category 1: Structure Integrity
 * grammar / chain / handoff / terminal separation
 */
export function evaluateStructureIntegrity(input: OperationalReadinessInput): CategoryEvaluation {
  const issues: GateIssue[] = [];
  const evidence: string[] = [];

  // 1a. Release readiness verdict
  if (input.releaseReadiness.verdict === "blocked") {
    issues.push(makeIssue("SI-1", "critical", "structure_integrity", "릴리즈 준비 실패", `릴리즈 준비 verdict: blocked (${input.releaseReadiness.failed}건 실패)`, "blocker"));
  } else if (input.releaseReadiness.verdict === "conditional") {
    issues.push(makeIssue("SI-2", "warning", "structure_integrity", "릴리즈 준비 조건부", `릴리즈 준비 verdict: conditional (${input.releaseReadiness.warnings}건 경고)`, "conditional"));
  } else {
    evidence.push(`릴리즈 준비 verdict: ready (${input.releaseReadiness.passed}/${input.releaseReadiness.totalChecks} 통과)`);
  }

  // 1b. Product acceptance verdict
  if (input.acceptanceReport.verdict === "rejected") {
    issues.push(makeIssue("SI-3", "critical", "structure_integrity", "제품 수용 거부", `${input.acceptanceReport.failedScenarios}개 시나리오 실패: ${input.acceptanceReport.criticalFailures.join(", ")}`, "blocker"));
  } else if (input.acceptanceReport.verdict === "conditional") {
    issues.push(makeIssue("SI-4", "warning", "structure_integrity", "제품 수용 조건부", `${input.acceptanceReport.failedScenarios}개 시나리오 실패`, "conditional"));
  } else {
    evidence.push(`제품 수용 verdict: accepted (${input.acceptanceReport.passedScenarios}/${input.acceptanceReport.totalScenarios} 통과)`);
  }

  const blockers = issues.filter(i => i.impact === "blocker");
  const conditionals = issues.filter(i => i.impact === "conditional");
  const score = blockers.length > 0 ? 0 : conditionals.length > 0 ? 70 : 100;

  return {
    categoryId: "structure_integrity",
    categoryLabel: GATE_CATEGORY_LABELS.structure_integrity,
    passed: blockers.length === 0,
    score,
    blockers,
    conditionals,
    evidence,
  };
}

/**
 * Category 2: Runtime Health
 * runtime signal 5개
 */
export function evaluateRuntimeHealth(input: OperationalReadinessInput): CategoryEvaluation {
  const issues: GateIssue[] = [];
  const evidence: string[] = [];
  const report = input.runtimeSignalReport;

  if (!report.overallHealthy) {
    // Check individual signals
    for (const signal of report.signals) {
      if (!signal.passed && signal.severity === "critical") {
        issues.push(makeIssue(`RH-${signal.signalId}`, "critical", "runtime_health", `런타임 신호 실패: ${signal.name}`, signal.detail, "blocker"));
      } else if (!signal.passed) {
        issues.push(makeIssue(`RH-${signal.signalId}`, "warning", "runtime_health", `런타임 신호 경고: ${signal.name}`, signal.detail, "conditional"));
      }
    }
  }

  if (report.criticalIssues.length > 0) {
    evidence.push(`critical 이슈 ${report.criticalIssues.length}건`);
  }
  if (report.warningIssues.length > 0) {
    evidence.push(`warning 이슈 ${report.warningIssues.length}건`);
  }
  if (report.overallHealthy) {
    evidence.push(`런타임 건강: 점수 ${report.overallScore}/100`);
  }

  const blockers = issues.filter(i => i.impact === "blocker");
  const conditionals = issues.filter(i => i.impact === "conditional");
  const score = report.overallScore;

  return {
    categoryId: "runtime_health",
    categoryLabel: GATE_CATEGORY_LABELS.runtime_health,
    passed: blockers.length === 0,
    score,
    blockers,
    conditionals,
    evidence,
  };
}

/**
 * Category 3: Mutation Safety
 * hardening pipeline / stale blocking / irreversible protection
 */
export function evaluateMutationSafety(input: OperationalReadinessInput): CategoryEvaluation {
  const issues: GateIssue[] = [];
  const evidence: string[] = [];
  const report = input.runtimeSignalReport;

  // RS-2 hardening pipeline check
  const hardeningSignal = report.signals.find(s => s.signalId === "RS-2");
  if (hardeningSignal && !hardeningSignal.passed) {
    if (hardeningSignal.severity === "critical") {
      issues.push(makeIssue("MS-1", "critical", "mutation_safety", "하드닝 파이프라인 미비", hardeningSignal.detail, "blocker"));
    } else {
      issues.push(makeIssue("MS-2", "warning", "mutation_safety", "하드닝 파이프라인 경고", hardeningSignal.detail, "conditional"));
    }
  } else if (hardeningSignal?.passed) {
    evidence.push(`하드닝 파이프라인: 점수 ${hardeningSignal.score}/100`);
  }

  // Acceptance report — irreversible action protection
  const iapScenario = input.acceptanceReport.scenarios.find(s => s.scenarioId === "E");
  if (iapScenario && !iapScenario.passed) {
    issues.push(makeIssue("MS-3", "critical", "mutation_safety", "irreversible action 보호 실패", `시나리오 E 실패: ${iapScenario.failedSteps.join(", ")}`, "blocker"));
  } else if (iapScenario?.passed) {
    evidence.push("irreversible action 보호 검증 통과");
  }

  const blockers = issues.filter(i => i.impact === "blocker");
  const conditionals = issues.filter(i => i.impact === "conditional");
  const score = blockers.length > 0 ? 0 : conditionals.length > 0 ? 65 : (hardeningSignal?.score ?? 80);

  return {
    categoryId: "mutation_safety",
    categoryLabel: GATE_CATEGORY_LABELS.mutation_safety,
    passed: blockers.length === 0,
    score,
    blockers,
    conditionals,
    evidence,
  };
}

/**
 * Category 4: Pilot Safety
 * checklist / rollback trigger / role gating / confirmation
 */
export function evaluatePilotSafety(input: OperationalReadinessInput): CategoryEvaluation {
  const issues: GateIssue[] = [];
  const evidence: string[] = [];
  const plan = input.pilotPlan;

  if (!plan) {
    issues.push(makeIssue("PS-1", "critical", "pilot_safety", "파일럿 계획 없음", "파일럿 계획이 생성되지 않았습니다", "blocker"));
    return { categoryId: "pilot_safety", categoryLabel: GATE_CATEGORY_LABELS.pilot_safety, passed: false, score: 0, blockers: issues, conditionals: [], evidence };
  }

  // Checklist completion
  const requiredItems = plan.checklist.filter(c => c.required);
  const unchecked = requiredItems.filter(c => !c.checked);
  if (unchecked.length > 0) {
    issues.push(makeIssue("PS-2", "critical", "pilot_safety", `필수 체크리스트 미완료 ${unchecked.length}건`, unchecked.map(c => c.description).join(", "), "blocker"));
  } else {
    evidence.push(`체크리스트 완료: ${requiredItems.length}/${requiredItems.length} 필수 항목`);
  }

  // Rollback plan exists
  if (!plan.rollbackPlan || plan.rollbackPlan.triggers.length === 0) {
    issues.push(makeIssue("PS-3", "critical", "pilot_safety", "롤백 계획 없음", "롤백 트리거가 정의되지 않았습니다", "blocker"));
  } else {
    evidence.push(`롤백 트리거 ${plan.rollbackPlan.triggers.length}개 정의`);
  }

  // Rollback evaluation
  if (input.rollbackEvaluation) {
    if (input.rollbackEvaluation.recommendation === "rollback_required") {
      issues.push(makeIssue("PS-4", "critical", "pilot_safety", "롤백 필수 상태", `${input.rollbackEvaluation.triggerCount}개 트리거 적중`, "blocker"));
    } else if (input.rollbackEvaluation.recommendation === "rollback_recommended") {
      issues.push(makeIssue("PS-5", "warning", "pilot_safety", "롤백 권고 상태", `${input.rollbackEvaluation.triggerCount}개 트리거 적중`, "conditional"));
    } else {
      evidence.push(`롤백 상태: ${input.rollbackEvaluation.recommendation}`);
    }
  }

  // RS-5 pilot signal
  const pilotSignal = input.runtimeSignalReport.signals.find(s => s.signalId === "RS-5");
  if (pilotSignal && !pilotSignal.passed) {
    issues.push(makeIssue("PS-6", "warning", "pilot_safety", "파일럿 안전 신호 경고", pilotSignal.detail, "conditional"));
  }

  const blockers = issues.filter(i => i.impact === "blocker");
  const conditionals = issues.filter(i => i.impact === "conditional");
  const checklistScore = requiredItems.length > 0 ? ((requiredItems.length - unchecked.length) / requiredItems.length) * 100 : 100;
  const score = blockers.length > 0 ? Math.min(30, checklistScore) : conditionals.length > 0 ? 70 : checklistScore;

  return {
    categoryId: "pilot_safety",
    categoryLabel: GATE_CATEGORY_LABELS.pilot_safety,
    passed: blockers.length === 0,
    score: Math.round(score),
    blockers,
    conditionals,
    evidence,
  };
}

/**
 * Category 5: Observability
 * audit log / compliance snapshot / reporting availability
 */
export function evaluateObservability(input: OperationalReadinessInput): CategoryEvaluation {
  const issues: GateIssue[] = [];
  const evidence: string[] = [];

  if (!input.auditLogAvailable) {
    issues.push(makeIssue("OB-1", "critical", "observability", "감사 로그 불가", "감사 로그 기록 시스템이 가용하지 않습니다", "blocker"));
  } else {
    evidence.push("감사 로그 가용");
  }

  if (!input.complianceSnapshotStoreAvailable) {
    issues.push(makeIssue("OB-2", "critical", "observability", "컴플라이언스 스냅샷 불가", "컴플라이언스 스냅샷 저장소가 가용하지 않습니다", "blocker"));
  } else {
    evidence.push("컴플라이언스 스냅샷 저장소 가용");
  }

  if (!input.reportingAvailable) {
    issues.push(makeIssue("OB-3", "warning", "observability", "리포팅 시스템 미가용", "리포팅 시스템이 가용하지 않습니다", "conditional"));
  } else {
    evidence.push("리포팅 시스템 가용");
  }

  // RS-4 audit signal
  const auditSignal = input.runtimeSignalReport.signals.find(s => s.signalId === "RS-4");
  if (auditSignal && !auditSignal.passed) {
    issues.push(makeIssue("OB-4", "warning", "observability", "감사 와이어링 경고", auditSignal.detail, "conditional"));
  }

  // Compliance snapshot freshness
  if (input.complianceSnapshots.length > 0) {
    const latest = input.complianceSnapshots.reduce((a, b) => a.capturedAt > b.capturedAt ? a : b);
    const ageMs = Date.now() - new Date(latest.capturedAt).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours > 24) {
      issues.push(makeIssue("OB-5", "warning", "observability", "컴플라이언스 스냅샷 오래됨", `최신 스냅샷: ${ageHours.toFixed(1)}시간 전`, "conditional"));
    } else {
      evidence.push(`최신 컴플라이언스 스냅샷: ${ageHours.toFixed(1)}시간 전`);
    }
  } else {
    issues.push(makeIssue("OB-6", "warning", "observability", "컴플라이언스 스냅샷 없음", "캡처된 컴플라이언스 스냅샷이 없습니다", "conditional"));
  }

  const blockers = issues.filter(i => i.impact === "blocker");
  const conditionals = issues.filter(i => i.impact === "conditional");
  const baseScore = [input.auditLogAvailable, input.complianceSnapshotStoreAvailable, input.reportingAvailable].filter(Boolean).length;
  const score = blockers.length > 0 ? 0 : Math.round((baseScore / 3) * 100);

  return {
    categoryId: "observability",
    categoryLabel: GATE_CATEGORY_LABELS.observability,
    passed: blockers.length === 0,
    score,
    blockers,
    conditionals,
    evidence,
  };
}

/**
 * Category 6: Operational Continuity
 * reconnect / replay / persistence / recovery
 */
export function evaluateOperationalContinuity(input: OperationalReadinessInput): CategoryEvaluation {
  const issues: GateIssue[] = [];
  const evidence: string[] = [];

  if (!input.reconnectMechanismExists) {
    issues.push(makeIssue("OC-1", "critical", "operational_continuity", "재연결 메커니즘 없음", "네트워크 중단 시 재연결 메커니즘이 없습니다", "blocker"));
  } else {
    evidence.push("재연결 메커니즘 존재");
  }

  if (!input.replayMechanismExists) {
    issues.push(makeIssue("OC-2", "warning", "operational_continuity", "리플레이 메커니즘 없음", "이벤트 리플레이 메커니즘이 없습니다", "conditional"));
  } else {
    evidence.push("이벤트 리플레이 메커니즘 존재");
  }

  if (!input.persistenceLayerHealthy) {
    issues.push(makeIssue("OC-3", "critical", "operational_continuity", "영속성 레이어 이상", "데이터 영속성 레이어가 건강하지 않습니다", "blocker"));
  } else {
    evidence.push("영속성 레이어 정상");
  }

  if (!input.recoveryTestedRecently) {
    issues.push(makeIssue("OC-4", "warning", "operational_continuity", "복구 테스트 미실시", "최근 복구 테스트가 수행되지 않았습니다", "conditional"));
  } else {
    evidence.push("최근 복구 테스트 통과");
  }

  // RS-3 event bus signal
  const eventBusSignal = input.runtimeSignalReport.signals.find(s => s.signalId === "RS-3");
  if (eventBusSignal && !eventBusSignal.passed) {
    if (eventBusSignal.severity === "critical") {
      issues.push(makeIssue("OC-5", "critical", "operational_continuity", "이벤트 버스 건강 위험", eventBusSignal.detail, "blocker"));
    } else {
      issues.push(makeIssue("OC-6", "warning", "operational_continuity", "이벤트 버스 경고", eventBusSignal.detail, "conditional"));
    }
  }

  // Stale scenario check from acceptance
  const staleScenario = input.acceptanceReport.scenarios.find(s => s.scenarioId === "D");
  if (staleScenario && !staleScenario.passed) {
    issues.push(makeIssue("OC-7", "warning", "operational_continuity", "stale/reconnect 시나리오 실패", `시나리오 D 실패: ${staleScenario.failedSteps.join(", ")}`, "conditional"));
  }

  const blockers = issues.filter(i => i.impact === "blocker");
  const conditionals = issues.filter(i => i.impact === "conditional");
  const flagCount = [input.reconnectMechanismExists, input.replayMechanismExists, input.persistenceLayerHealthy, input.recoveryTestedRecently].filter(Boolean).length;
  const score = blockers.length > 0 ? Math.round((flagCount / 4) * 40) : Math.round((flagCount / 4) * 100);

  return {
    categoryId: "operational_continuity",
    categoryLabel: GATE_CATEGORY_LABELS.operational_continuity,
    passed: blockers.length === 0,
    score,
    blockers,
    conditionals,
    evidence,
  };
}

/**
 * Category 7: Scope Control
 * pilot 범위 적절성 (PO limit / domain limit / duration / actor scope)
 */
export function evaluateScopeControl(input: OperationalReadinessInput): CategoryEvaluation {
  const issues: GateIssue[] = [];
  const evidence: string[] = [];
  const plan = input.pilotPlan;

  if (!plan) {
    // No pilot plan → scope control not applicable but not blocking
    evidence.push("파일럿 계획 없음 — 범위 통제 해당 없음");
    return { categoryId: "scope_control", categoryLabel: GATE_CATEGORY_LABELS.scope_control, passed: true, score: 50, blockers: [], conditionals: issues, evidence };
  }

  // PO limit check
  if (plan.poCountLimit === 0) {
    issues.push(makeIssue("SC-1", "warning", "scope_control", "PO 수량 제한 없음", "파일럿 PO 수량 제한이 설정되지 않았습니다 (무제한)", "conditional"));
  } else {
    evidence.push(`PO 수량 제한: ${plan.poCountLimit}건`);
  }

  // Duration check
  if (plan.durationDays > 90) {
    issues.push(makeIssue("SC-2", "warning", "scope_control", "파일럿 기간 과다", `파일럿 기간 ${plan.durationDays}일 — 90일 초과`, "conditional"));
  } else if (plan.durationDays <= 0) {
    issues.push(makeIssue("SC-3", "critical", "scope_control", "파일럿 기간 미설정", "파일럿 기간이 0일 이하입니다", "blocker"));
  } else {
    evidence.push(`파일럿 기간: ${plan.durationDays}일`);
  }

  // Domain scope check
  if (plan.activeDomains.length === 0) {
    issues.push(makeIssue("SC-4", "critical", "scope_control", "활성 도메인 없음", "파일럿에 활성화된 도메인이 없습니다", "blocker"));
  } else {
    evidence.push(`활성 도메인: ${plan.activeDomains.length}개`);
  }

  // Stage scope check
  if (plan.includedStages.length === 0) {
    issues.push(makeIssue("SC-5", "critical", "scope_control", "포함 스테이지 없음", "파일럿에 포함된 스테이지가 없습니다", "blocker"));
  } else {
    evidence.push(`포함 스테이지: ${plan.includedStages.length}개`);
  }

  // Rollback authorized roles
  if (plan.rollbackPlan.authorizedRoles.length === 0) {
    issues.push(makeIssue("SC-6", "critical", "scope_control", "롤백 권한자 없음", "롤백을 수행할 권한 역할이 지정되지 않았습니다", "blocker"));
  } else {
    evidence.push(`롤백 권한 역할: ${plan.rollbackPlan.authorizedRoles.join(", ")}`);
  }

  const blockers = issues.filter(i => i.impact === "blocker");
  const conditionals = issues.filter(i => i.impact === "conditional");
  const score = blockers.length > 0 ? 0 : conditionals.length > 0 ? 70 : 100;

  return {
    categoryId: "scope_control",
    categoryLabel: GATE_CATEGORY_LABELS.scope_control,
    passed: blockers.length === 0,
    score,
    blockers,
    conditionals,
    evidence,
  };
}

// ══════════════════════════════════════════════════════
// 6. Scope Recommendation
// ══════════════════════════════════════════════════════

export function buildActivationScopeRecommendation(
  verdict: OperationalVerdict,
  input: OperationalReadinessInput,
  totalBlockers: number,
  totalConditionals: number,
): ActivationScopeRecommendation {
  if (verdict === "no_go") {
    return {
      scope: "hold",
      reason: `${totalBlockers}건 blocker 미해소 — 활성화 보류`,
      suggestedPoLimit: 0,
      suggestedDomains: [],
      suggestedDurationDays: 0,
    };
  }

  const plan = input.pilotPlan;
  const runtimeScore = input.runtimeSignalReport.overallScore;

  if (verdict === "conditional_go") {
    // Conditional → limited scope
    const suggestedDomains = plan?.activeDomains.slice(0, 2) ?? ["quote_chain" as GovernanceDomain];
    return {
      scope: "pilot_limited",
      reason: `${totalConditionals}건 조건부 이슈 — 제한적 파일럿 권고`,
      suggestedPoLimit: Math.min(plan?.poCountLimit ?? 10, 10),
      suggestedDomains: suggestedDomains,
      suggestedDurationDays: Math.min(plan?.durationDays ?? 14, 14),
    };
  }

  // go verdict
  if (runtimeScore >= 90 && totalConditionals === 0) {
    // Full confidence
    const suggestedDomains = plan?.activeDomains ?? ["quote_chain" as GovernanceDomain, "dispatch_prep" as GovernanceDomain];
    return {
      scope: "pilot_expanded",
      reason: "전체 검증 통과 — 확장 파일럿 가능",
      suggestedPoLimit: plan?.poCountLimit ?? 50,
      suggestedDomains: suggestedDomains,
      suggestedDurationDays: plan?.durationDays ?? 30,
    };
  }

  // go but conservative
  const suggestedDomains = plan?.activeDomains.slice(0, 3) ?? ["quote_chain" as GovernanceDomain];
  return {
    scope: "pilot_limited",
    reason: "검증 통과 — 안전 범위 내 파일럿 권고",
    suggestedPoLimit: Math.min(plan?.poCountLimit ?? 20, 20),
    suggestedDomains: suggestedDomains,
    suggestedDurationDays: Math.min(plan?.durationDays ?? 21, 21),
  };
}

// ══════════════════════════════════════════════════════
// 7. Rollback Confidence
// ══════════════════════════════════════════════════════

function evaluateRollbackConfidence(input: OperationalReadinessInput): "high" | "medium" | "low" | "unknown" {
  if (!input.pilotPlan) return "unknown";

  const rollbackPlan = input.pilotPlan.rollbackPlan;
  if (!rollbackPlan || rollbackPlan.triggers.length === 0) return "low";

  const hasRoles = rollbackPlan.authorizedRoles.length > 0;
  const hasSteps = rollbackPlan.steps.length > 0;
  const hasTriggers = rollbackPlan.triggers.length >= 3;

  const rollbackEval = input.rollbackEvaluation;
  const signalsFresh = rollbackEval ? !rollbackEval.signalAge.stale : true;

  if (hasRoles && hasSteps && hasTriggers && signalsFresh) return "high";
  if (hasRoles && hasTriggers) return "medium";
  return "low";
}

// ══════════════════════════════════════════════════════
// 8. Main Gate Builder
// ══════════════════════════════════════════════════════

/**
 * 운영 준비 최종 게이트 평가.
 * 7개 category를 독립 평가 → verdict 산출 → scope 추천.
 */
export function evaluateOperationalReadinessGate(input: OperationalReadinessInput): OperationalReadinessVerdict {
  const categories: CategoryEvaluation[] = [
    evaluateStructureIntegrity(input),
    evaluateRuntimeHealth(input),
    evaluateMutationSafety(input),
    evaluatePilotSafety(input),
    evaluateObservability(input),
    evaluateOperationalContinuity(input),
    evaluateScopeControl(input),
  ];

  const allBlockers = categories.flatMap(c => c.blockers);
  const allConditionals = categories.flatMap(c => c.conditionals);
  const passedCategories = categories.filter(c => c.passed).length;
  const failedCategories = categories.filter(c => !c.passed).length;

  // Verdict: blocker 우선
  let verdict: OperationalVerdict;
  if (allBlockers.length > 0) {
    verdict = "no_go";
  } else if (allConditionals.length > 0) {
    verdict = "conditional_go";
  } else {
    verdict = "go";
  }

  const overallScore = categories.length > 0
    ? Math.round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length)
    : 0;

  const scopeRecommendation = buildActivationScopeRecommendation(verdict, input, allBlockers.length, allConditionals.length);
  const rollbackConfidence = evaluateRollbackConfidence(input);

  return {
    verdict,
    evaluatedAt: new Date().toISOString(),
    overallScore,
    categoryCount: categories.length,
    passedCategories,
    failedCategories,
    totalBlockers: allBlockers.length,
    totalConditionals: allConditionals.length,
    categories,
    blockingIssues: allBlockers,
    conditionalIssues: allConditionals,
    scopeRecommendation,
    rollbackConfidence,
  };
}

// ══════════════════════════════════════════════════════
// 9. Release Candidate Snapshot Builder
// ══════════════════════════════════════════════════════

export function buildReleaseCandidateSnapshot(
  input: OperationalReadinessInput,
  verdict: OperationalReadinessVerdict,
  approver: string | null,
): ReleaseCandidateSnapshot {
  const latestCompliance = input.complianceSnapshots.length > 0
    ? input.complianceSnapshots.reduce((a, b) => a.capturedAt > b.capturedAt ? a : b)
    : null;
  const nonCompliantCount = input.complianceSnapshots.filter(s => s.verdict !== "compliant").length;

  return {
    snapshotId: `rcs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    capturedAt: new Date().toISOString(),
    grammarVersion: {
      stageCount: input.releaseReadiness.totalChecks, // proxy
      statusCount: 0,
      actionCount: 0,
    },
    runtimeSignalSummary: {
      overallScore: input.runtimeSignalReport.overallScore,
      overallHealthy: input.runtimeSignalReport.overallHealthy,
      criticalCount: input.runtimeSignalReport.criticalIssues.length,
      warningCount: input.runtimeSignalReport.warningIssues.length,
    },
    acceptanceVerdict: input.acceptanceReport.verdict,
    acceptancePassedScenarios: input.acceptanceReport.passedScenarios,
    acceptanceTotalScenarios: input.acceptanceReport.totalScenarios,
    pilotPlanId: input.pilotPlan?.planId ?? null,
    pilotStatus: input.pilotPlan?.status ?? null,
    complianceSummary: {
      totalSnapshots: input.complianceSnapshots.length,
      nonCompliantCount,
      latestCapturedAt: latestCompliance?.capturedAt ?? null,
    },
    rollbackRecommendation: input.rollbackEvaluation?.recommendation ?? null,
    gateVerdict: verdict.verdict,
    gateScore: verdict.overallScore,
    approver,
    recommendedScope: verdict.scopeRecommendation.scope,
  };
}

// ══════════════════════════════════════════════════════
// 10. Workbench Surface Builder
// ══════════════════════════════════════════════════════

export interface OperationalReadinessSurface {
  center: {
    verdict: OperationalVerdict;
    overallScore: number;
    categoryBreakdown: Array<{
      categoryId: GateCategoryId;
      categoryLabel: string;
      passed: boolean;
      score: number;
      blockerCount: number;
      conditionalCount: number;
    }>;
    blockingIssues: GateIssue[];
    conditionalIssues: GateIssue[];
    scopeRecommendation: ActivationScopeRecommendation;
    releaseCandidateSummary: {
      acceptanceVerdict: string;
      runtimeScore: number;
      rollbackConfidence: string;
    };
  };
  rail: {
    runtimeSignals: Array<{ signalId: string; name: string; passed: boolean; score: number; severity: UnifiedSeverity }>;
    complianceSummary: { total: number; nonCompliant: number; latestAt: string | null };
    pilotScope: { stages: number; domains: number; poLimit: number; durationDays: number } | null;
    rollbackReadiness: { recommendation: string; triggerCount: number; confidence: string };
    acceptanceSummary: { verdict: string; passed: number; total: number };
    evidenceLinks: string[];
  };
  dock: {
    actions: OperationalReadinessAction[];
  };
}

export interface OperationalReadinessAction {
  actionKey: string;
  label: string;
  enabled: boolean;
  requiresConfirmation: boolean;
  requiredRoles: string[];
  disabledReason: string | null;
}

export function buildOperationalReadinessSurface(
  verdict: OperationalReadinessVerdict,
  input: OperationalReadinessInput,
  snapshot: ReleaseCandidateSnapshot,
): OperationalReadinessSurface {
  const isGo = verdict.verdict === "go";
  const isConditionalGo = verdict.verdict === "conditional_go";
  const isNoGo = verdict.verdict === "no_go";

  const latestCompliance = input.complianceSnapshots.length > 0
    ? input.complianceSnapshots.reduce((a, b) => a.capturedAt > b.capturedAt ? a : b)
    : null;

  return {
    center: {
      verdict: verdict.verdict,
      overallScore: verdict.overallScore,
      categoryBreakdown: verdict.categories.map(c => ({
        categoryId: c.categoryId,
        categoryLabel: c.categoryLabel,
        passed: c.passed,
        score: c.score,
        blockerCount: c.blockers.length,
        conditionalCount: c.conditionals.length,
      })),
      blockingIssues: verdict.blockingIssues,
      conditionalIssues: verdict.conditionalIssues,
      scopeRecommendation: verdict.scopeRecommendation,
      releaseCandidateSummary: {
        acceptanceVerdict: input.acceptanceReport.verdict,
        runtimeScore: input.runtimeSignalReport.overallScore,
        rollbackConfidence: verdict.rollbackConfidence,
      },
    },
    rail: {
      runtimeSignals: input.runtimeSignalReport.signals.map(s => ({
        signalId: s.signalId,
        name: s.name,
        passed: s.passed,
        score: s.score,
        severity: s.severity,
      })),
      complianceSummary: {
        total: input.complianceSnapshots.length,
        nonCompliant: input.complianceSnapshots.filter(s => s.verdict !== "compliant").length,
        latestAt: latestCompliance?.capturedAt ?? null,
      },
      pilotScope: input.pilotPlan
        ? {
            stages: input.pilotPlan.includedStages.length,
            domains: input.pilotPlan.activeDomains.length,
            poLimit: input.pilotPlan.poCountLimit,
            durationDays: input.pilotPlan.durationDays,
          }
        : null,
      rollbackReadiness: {
        recommendation: input.rollbackEvaluation?.recommendation ?? "unknown",
        triggerCount: input.rollbackEvaluation?.triggerCount ?? 0,
        confidence: verdict.rollbackConfidence,
      },
      acceptanceSummary: {
        verdict: input.acceptanceReport.verdict,
        passed: input.acceptanceReport.passedScenarios,
        total: input.acceptanceReport.totalScenarios,
      },
      evidenceLinks: verdict.categories.flatMap(c => c.evidence),
    },
    dock: {
      actions: [
        {
          actionKey: "approve_go",
          label: "Go 승인",
          enabled: isGo,
          requiresConfirmation: true,
          requiredRoles: ["release_manager", "ops_lead"],
          disabledReason: isGo ? null : isConditionalGo ? "조건부 이슈 존재 — conditional go만 가능" : `${verdict.totalBlockers}건 blocker 미해소`,
        },
        {
          actionKey: "approve_conditional_go",
          label: "Conditional Go 승인",
          enabled: isConditionalGo || isGo,
          requiresConfirmation: true,
          requiredRoles: ["release_manager", "ops_lead"],
          disabledReason: isNoGo ? `${verdict.totalBlockers}건 blocker 미해소` : null,
        },
        {
          actionKey: "reject_hold",
          label: "보류 (Hold)",
          enabled: true,
          requiresConfirmation: true,
          requiredRoles: ["release_manager"],
          disabledReason: null,
        },
        {
          actionKey: "open_pilot_workbench",
          label: "파일럿 워크벤치 열기",
          enabled: input.pilotPlan !== null,
          requiresConfirmation: false,
          requiredRoles: [],
          disabledReason: input.pilotPlan ? null : "파일럿 계획 없음",
        },
        {
          actionKey: "open_audit_review",
          label: "감사 리뷰 열기",
          enabled: input.auditLogAvailable,
          requiresConfirmation: false,
          requiredRoles: [],
          disabledReason: input.auditLogAvailable ? null : "감사 로그 불가",
        },
        {
          actionKey: "export_gate_snapshot",
          label: "게이트 스냅샷 내보내기",
          enabled: true,
          requiresConfirmation: false,
          requiredRoles: [],
          disabledReason: null,
        },
      ],
    },
  };
}
