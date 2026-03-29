/**
 * Pilot Activation Engine — governance chain 파일럿 운영 활성화 팩
 *
 * release readiness gate 통과 후, 실제 파일럿 운영에 필요한
 * 설정/체크리스트/rollback plan을 구조적으로 생성.
 *
 * CORE CONTRACT:
 * 1. pilot activation은 truth를 변경하지 않음 — 설정/체크리스트 생성만
 * 2. 모든 label은 grammar registry에서 resolve
 * 3. pilot plan은 생성 후 불변 — 수정은 새 plan 생성으로
 * 4. rollback plan은 pilot plan 생성 시 동시에 생성
 * 5. activation checklist의 모든 항목이 확인되어야 pilot 시작 가능
 *
 * IMMUTABLE RULES:
 * - pilot activation이 engine 코드를 수정하면 안 됨
 * - grammar registry 외 label 하드코딩 금지
 * - rollback plan 없이 pilot 시작 금지
 */

import type { GovernanceDomain } from "./governance-event-bus";
import type { QuoteChainStage } from "./quote-approval-governance-engine";
import {
  CHAIN_STAGE_GRAMMAR,
  SEVERITY_SPEC,
  getStageLabel,
  type UnifiedSeverity,
} from "./governance-grammar-registry";
import type { ReleaseReadinessResult } from "./release-readiness-engine";

// ══════════════════════════════════════════════════════
// 1. Pilot Plan
// ══════════════════════════════════════════════════════

export interface PilotPlan {
  planId: string;
  createdAt: string;
  /** Release readiness result that this plan is based on */
  readinessResultId: string;
  readinessScore: number;

  // ── Scope ──
  /** Pilot scope: which stages are included */
  includedStages: Array<{ stage: QuoteChainStage; stageLabel: string }>;
  /** Pilot scope: which domains are active */
  activeDomains: GovernanceDomain[];
  /** Pilot scope: PO count limit (0 = unlimited) */
  poCountLimit: number;
  /** Pilot duration (days) */
  durationDays: number;

  // ── Activation Checklist ──
  checklist: ActivationChecklistItem[];

  // ── Rollback ──
  rollbackPlan: RollbackPlan;

  // ── Monitoring ──
  monitoringConfig: MonitoringConfig;

  // ── Status ──
  status: PilotStatus;
}

export type PilotStatus = "draft" | "checklist_in_progress" | "ready_to_activate" | "active" | "completed" | "rolled_back" | "cancelled";

export interface ActivationChecklistItem {
  itemId: string;
  category: "technical" | "operational" | "compliance" | "communication";
  description: string;
  checked: boolean;
  checkedBy: string | null;
  checkedAt: string | null;
  required: boolean;
}

export interface RollbackPlan {
  /** Trigger conditions for rollback */
  triggers: RollbackTrigger[];
  /** Steps to execute on rollback */
  steps: RollbackStep[];
  /** Who can authorize rollback */
  authorizedRoles: string[];
  /** Max time to complete rollback (hours) */
  maxRollbackHours: number;
}

export interface RollbackTrigger {
  triggerId: string;
  severity: UnifiedSeverity;
  severityLabel: string;
  condition: string;
  threshold: string;
  autoRollback: boolean;
}

export interface RollbackStep {
  order: number;
  description: string;
  domain: GovernanceDomain | "all";
  reversible: boolean;
}

export interface MonitoringConfig {
  /** Compliance snapshot frequency (minutes) */
  complianceSnapshotIntervalMin: number;
  /** Alert thresholds */
  alertThresholds: {
    nonCompliantRatePercent: number;
    blockerCountMax: number;
    errorRatePercent: number;
  };
  /** Reporting frequency (hours) */
  reportingIntervalHours: number;
}

// ══════════════════════════════════════════════════════
// 2. Pilot Plan Builder
// ══════════════════════════════════════════════════════

export function createPilotPlan(params: {
  readinessResult: ReleaseReadinessResult;
  poCountLimit?: number;
  durationDays?: number;
  includedStages?: QuoteChainStage[];
  activeDomains?: GovernanceDomain[];
}): PilotPlan {
  const { readinessResult, poCountLimit = 10, durationDays = 14 } = params;

  // Default: all stages
  const stages = params.includedStages
    ? params.includedStages.map(s => ({ stage: s, stageLabel: getStageLabel(s) }))
    : CHAIN_STAGE_GRAMMAR.map(s => ({ stage: s.stage, stageLabel: s.fullLabel }));

  // Default: all domains from grammar
  const activeDomains: GovernanceDomain[] = params.activeDomains ?? [
    "quote_chain", "dispatch_prep", "dispatch_execution", "supplier_confirmation",
    "receiving_prep", "receiving_execution", "stock_release", "reorder_decision",
  ];

  const checklist = buildDefaultChecklist();
  const rollbackPlan = buildDefaultRollbackPlan(activeDomains);
  const monitoringConfig = buildDefaultMonitoringConfig();

  return {
    planId: `pilot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    readinessResultId: readinessResult.resultId,
    readinessScore: readinessResult.readinessScore,
    includedStages: stages,
    activeDomains,
    poCountLimit,
    durationDays,
    checklist,
    rollbackPlan,
    monitoringConfig,
    status: "draft",
  };
}

// ── Default Checklist ──

function buildDefaultChecklist(): ActivationChecklistItem[] {
  return [
    // Technical
    { itemId: "CK-T1", category: "technical", description: "TypeScript 컴파일 에러 0건 확인", checked: false, checkedBy: null, checkedAt: null, required: true },
    { itemId: "CK-T2", category: "technical", description: "전체 governance 테스트 통과 확인", checked: false, checkedBy: null, checkedAt: null, required: true },
    { itemId: "CK-T3", category: "technical", description: "Event bus 연결 검증 완료", checked: false, checkedBy: null, checkedAt: null, required: true },
    { itemId: "CK-T4", category: "technical", description: "Hardening pipeline 작동 확인", checked: false, checkedBy: null, checkedAt: null, required: true },
    { itemId: "CK-T5", category: "technical", description: "Grammar registry 무결성 검증 통과", checked: false, checkedBy: null, checkedAt: null, required: true },

    // Operational
    { itemId: "CK-O1", category: "operational", description: "파일럿 대상 PO 선정 완료", checked: false, checkedBy: null, checkedAt: null, required: true },
    { itemId: "CK-O2", category: "operational", description: "운영자 교육/안내 완료", checked: false, checkedBy: null, checkedAt: null, required: true },
    { itemId: "CK-O3", category: "operational", description: "모니터링 대시보드 접근 확인", checked: false, checkedBy: null, checkedAt: null, required: false },

    // Compliance
    { itemId: "CK-C1", category: "compliance", description: "Compliance snapshot 자동 생성 확인", checked: false, checkedBy: null, checkedAt: null, required: true },
    { itemId: "CK-C2", category: "compliance", description: "Rollback plan 검토 및 승인 완료", checked: false, checkedBy: null, checkedAt: null, required: true },

    // Communication
    { itemId: "CK-M1", category: "communication", description: "이해관계자 파일럿 시작 공지", checked: false, checkedBy: null, checkedAt: null, required: false },
    { itemId: "CK-M2", category: "communication", description: "공급사 대응 절차 확인", checked: false, checkedBy: null, checkedAt: null, required: false },
  ];
}

// ── Default Rollback Plan ──

function buildDefaultRollbackPlan(activeDomains: GovernanceDomain[]): RollbackPlan {
  return {
    triggers: [
      {
        triggerId: "RT-1",
        severity: "critical",
        severityLabel: SEVERITY_SPEC.critical.label,
        condition: "비준수 비율 임계치 초과",
        threshold: "비준수 > 20%",
        autoRollback: false,
      },
      {
        triggerId: "RT-2",
        severity: "critical",
        severityLabel: SEVERITY_SPEC.critical.label,
        condition: "데이터 무결성 오류",
        threshold: "integrity check 실패",
        autoRollback: true,
      },
      {
        triggerId: "RT-3",
        severity: "warning",
        severityLabel: SEVERITY_SPEC.warning.label,
        condition: "차단 건수 임계치 초과",
        threshold: "동시 blocker > 5건",
        autoRollback: false,
      },
    ],
    steps: [
      { order: 1, description: "신규 PO governance chain 진입 중단", domain: "all", reversible: true },
      { order: 2, description: "진행 중 PO 기존 워크플로우로 전환", domain: "all", reversible: true },
      { order: 3, description: "governance event bus 구독 해제", domain: "all", reversible: true },
      { order: 4, description: "파일럿 결과 compliance snapshot 최종 저장", domain: "all", reversible: false },
      { order: 5, description: "이해관계자 rollback 완료 공지", domain: "all", reversible: false },
    ],
    authorizedRoles: ["procurement_manager", "system_admin"],
    maxRollbackHours: 4,
  };
}

// ── Default Monitoring Config ──

function buildDefaultMonitoringConfig(): MonitoringConfig {
  return {
    complianceSnapshotIntervalMin: 30,
    alertThresholds: {
      nonCompliantRatePercent: 10,
      blockerCountMax: 5,
      errorRatePercent: 5,
    },
    reportingIntervalHours: 24,
  };
}

// ══════════════════════════════════════════════════════
// 3. Checklist Management
// ══════════════════════════════════════════════════════

export function checkChecklistItem(
  plan: PilotPlan,
  itemId: string,
  actor: string,
): PilotPlan {
  const updatedChecklist = plan.checklist.map(item =>
    item.itemId === itemId
      ? { ...item, checked: true, checkedBy: actor, checkedAt: new Date().toISOString() }
      : item,
  );

  const allRequiredChecked = updatedChecklist
    .filter(item => item.required)
    .every(item => item.checked);

  return {
    ...plan,
    checklist: updatedChecklist,
    status: allRequiredChecked ? "ready_to_activate" : "checklist_in_progress",
  };
}

export function uncheckChecklistItem(
  plan: PilotPlan,
  itemId: string,
): PilotPlan {
  const updatedChecklist = plan.checklist.map(item =>
    item.itemId === itemId
      ? { ...item, checked: false, checkedBy: null, checkedAt: null }
      : item,
  );

  return {
    ...plan,
    checklist: updatedChecklist,
    status: "checklist_in_progress",
  };
}

export function activatePilot(plan: PilotPlan): PilotPlan {
  if (plan.status !== "ready_to_activate") {
    return plan; // 체크리스트 미완료 시 활성화 불가
  }
  return { ...plan, status: "active" };
}

export function completePilot(plan: PilotPlan): PilotPlan {
  if (plan.status !== "active") return plan;
  return { ...plan, status: "completed" };
}

export function rollbackPilot(plan: PilotPlan): PilotPlan {
  if (plan.status !== "active") return plan;
  return { ...plan, status: "rolled_back" };
}

export function cancelPilot(plan: PilotPlan): PilotPlan {
  if (plan.status === "completed" || plan.status === "rolled_back") return plan;
  return { ...plan, status: "cancelled" };
}

// ══════════════════════════════════════════════════════
// 4. Pilot Activation Surface — workbench center/rail/dock
// ══════════════════════════════════════════════════════

export interface PilotActivationSurface {
  center: {
    plan: PilotPlan;
    checklistProgress: {
      total: number;
      checked: number;
      requiredTotal: number;
      requiredChecked: number;
      progressPercent: number;
    };
    categoryBreakdown: Array<{
      category: string;
      items: ActivationChecklistItem[];
    }>;
  };
  rail: {
    readinessScore: number;
    includedStageLabels: string[];
    rollbackTriggerSummary: string[];
    monitoringConfig: MonitoringConfig;
  };
  dock: {
    actions: Array<{
      actionKey: "check_item" | "uncheck_item" | "activate_pilot" | "complete_pilot" | "rollback_pilot" | "cancel_pilot" | "export_plan";
      label: string;
      enabled: boolean;
    }>;
  };
}

export function buildPilotActivationSurface(plan: PilotPlan): PilotActivationSurface {
  const total = plan.checklist.length;
  const checked = plan.checklist.filter(i => i.checked).length;
  const requiredTotal = plan.checklist.filter(i => i.required).length;
  const requiredChecked = plan.checklist.filter(i => i.required && i.checked).length;
  const progressPercent = requiredTotal > 0 ? Math.round((requiredChecked / requiredTotal) * 100) : 100;

  const categories = ["technical", "operational", "compliance", "communication"] as const;
  const categoryLabels: Record<string, string> = {
    technical: "기술 검증",
    operational: "운영 준비",
    compliance: "준수 확인",
    communication: "소통",
  };
  const categoryBreakdown = categories.map(cat => ({
    category: categoryLabels[cat],
    items: plan.checklist.filter(i => i.category === cat),
  }));

  return {
    center: {
      plan,
      checklistProgress: { total, checked, requiredTotal, requiredChecked, progressPercent },
      categoryBreakdown,
    },
    rail: {
      readinessScore: plan.readinessScore,
      includedStageLabels: plan.includedStages.map(s => s.stageLabel),
      rollbackTriggerSummary: plan.rollbackPlan.triggers.map(t => `${t.severityLabel}: ${t.condition} (${t.threshold})`),
      monitoringConfig: plan.monitoringConfig,
    },
    dock: {
      actions: [
        { actionKey: "check_item", label: "항목 체크", enabled: plan.status === "draft" || plan.status === "checklist_in_progress" },
        { actionKey: "uncheck_item", label: "항목 체크 해제", enabled: plan.status === "draft" || plan.status === "checklist_in_progress" },
        { actionKey: "activate_pilot", label: "파일럿 시작", enabled: plan.status === "ready_to_activate" },
        { actionKey: "complete_pilot", label: "파일럿 완료", enabled: plan.status === "active" },
        { actionKey: "rollback_pilot", label: "파일럿 롤백", enabled: plan.status === "active" },
        { actionKey: "cancel_pilot", label: "파일럿 취소", enabled: plan.status !== "completed" && plan.status !== "rolled_back" },
        { actionKey: "export_plan", label: "계획서 내보내기", enabled: true },
      ],
    },
  };
}
