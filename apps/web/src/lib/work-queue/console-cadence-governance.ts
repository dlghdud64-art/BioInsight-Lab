/**
 * Console Cadence & SLA Governance — 운영 케이던스 & SLA 거버넌스 잠금
 *
 * 큐/검토 행동을 명시적인 일일/주간 운영 규칙으로 전환합니다.
 * §1 운영 케이던스(4단계), §2 SLA 거버넌스(6카테고리),
 * §3 리드 개입 규칙(5케이스), §4 검토 결과 거버넌스,
 * §5 거버넌스 보고 신호(6개).
 *
 * 순수 정의 파일 — DB 호출 없음.
 */

import type { WorkQueueItem } from "./work-queue-service";
import type {
  EscalationRuleId,
  EscalationResult,
  ActivityLogEntry,
  AccountabilityMetrics,
} from "./console-accountability";
import {
  evaluateEscalations,
  computeAccountabilityMetrics,
} from "./console-accountability";
import {
  resolveAssignmentState,
  type AssignmentState,
} from "./console-assignment";
import { computeFinalTier, type PriorityTier } from "./console-priorities";
import type {
  DailyReviewCategoryId,
  ReviewOutcomeId,
  CarryOverReason,
  CarryOverEntry,
  ReviewRecord,
  DailyReviewSurface,
} from "./console-daily-review";
import {
  selectDailyReviewItems,
  computeCarryOver,
  CARRY_OVER_DEFS,
} from "./console-daily-review";

// ══════════════════════════════════════════════════════
// §1: Canonical Operating Cadence
// ══════════════════════════════════════════════════════

export type CadenceStepId =
  | "start_of_day_review"
  | "midday_escalation_check"
  | "end_of_day_carryover"
  | "weekly_bottleneck_review";

export interface CadenceStepDef {
  id: CadenceStepId;
  label: string;
  description: string;
  schedule: string;
  participants: ("operator" | "lead")[];
  reviewScope: string;
  expectedActions: string[];
  outcomeLogged: string;
  sortOrder: number;
}

export const CADENCE_STEP_DEFS: Record<CadenceStepId, CadenceStepDef> = {
  start_of_day_review: {
    id: "start_of_day_review",
    label: "업무 시작 검토",
    description: "일일 시작 시 긴급 항목 확인, 이월 항목 검토, 배정 확인",
    schedule: "매일 업무 시작",
    participants: ["operator", "lead"],
    reviewScope: "urgent_now, overdue_owned, handoff_not_accepted, carry-over items",
    expectedActions: [
      "긴급 항목 담당자 확인",
      "이월 항목 사유 확인 및 조치 결정",
      "미배정 긴급 항목 배정",
    ],
    outcomeLogged: "CADENCE_START_OF_DAY",
    sortOrder: 0,
  },
  midday_escalation_check: {
    id: "midday_escalation_check",
    label: "오후 에스컬레이션 점검",
    description: "에스컬레이션 발생 여부 확인, 차단 항목 진행 확인",
    schedule: "매일 오후",
    participants: ["lead"],
    reviewScope: "blocked_too_long, urgent_unassigned, escalation triggers",
    expectedActions: [
      "활성 에스컬레이션 검토",
      "차단 항목 해제 여부 확인",
      "미배정 긴급 항목 재배정",
    ],
    outcomeLogged: "CADENCE_MIDDAY_CHECK",
    sortOrder: 1,
  },
  end_of_day_carryover: {
    id: "end_of_day_carryover",
    label: "업무 종료 이월 검토",
    description: "미해결 항목 이월 결정, 검토 결과 기록",
    schedule: "매일 업무 종료",
    participants: ["operator", "lead"],
    reviewScope: "all unresolved items from today's review",
    expectedActions: [
      "미해결 항목 이월 또는 해결 판단",
      "이월 사유 기록",
      "다음 날 우선순위 확인",
    ],
    outcomeLogged: "CADENCE_END_OF_DAY",
    sortOrder: 2,
  },
  weekly_bottleneck_review: {
    id: "weekly_bottleneck_review",
    label: "주간 병목 분석",
    description: "반복 차단 패턴 분석, 재배정 핫스팟 확인, SLA 준수율 검토",
    schedule: "매주 1회",
    participants: ["lead"],
    reviewScope: "carry-over trends, reassignment hotspots, SLA compliance",
    expectedActions: [
      "반복 차단 항목 근본 원인 분석",
      "재배정 핫스팟 담당자 면담",
      "SLA 위반 추세 검토",
      "개선 액션 아이템 등록",
    ],
    outcomeLogged: "CADENCE_WEEKLY_REVIEW",
    sortOrder: 3,
  },
};

export const CADENCE_STEP_LABELS: Record<CadenceStepId, string> = {
  start_of_day_review: "업무 시작 검토",
  midday_escalation_check: "오후 에스컬레이션 점검",
  end_of_day_carryover: "업무 종료 이월 검토",
  weekly_bottleneck_review: "주간 병목 분석",
};

// ══════════════════════════════════════════════════════
// §2: SLA Governance Definitions
// ══════════════════════════════════════════════════════

export type SLACategoryId =
  | "first_action_latency"
  | "urgent_resolution"
  | "handoff_acceptance"
  | "blocked_resolution"
  | "reassignment_stability"
  | "review_completion";

export interface SLACategoryDef {
  id: SLACategoryId;
  label: string;
  description: string;
  targetHours: number;
  breachHours: number;
  owner: "operator" | "lead" | "both";
  escalationPath: EscalationRuleId | null;
  reviewRequirement: CadenceStepId;
  reportingImplication: string;
}

export const SLA_CATEGORY_DEFS: Record<SLACategoryId, SLACategoryDef> = {
  first_action_latency: {
    id: "first_action_latency",
    label: "최초 조치 지연",
    description: "배정 후 최초 조치까지 소요 시간",
    targetHours: 4,
    breachHours: 8,
    owner: "operator",
    escalationPath: "assigned_no_first_action",
    reviewRequirement: "start_of_day_review",
    reportingImplication: "평균 최초 조치 지연 시간 보고",
  },
  urgent_resolution: {
    id: "urgent_resolution",
    label: "긴급 해결 시간",
    description: "긴급 항목 배정 후 해결까지 소요 시간",
    targetHours: 12,
    breachHours: 24,
    owner: "both",
    escalationPath: "overdue_urgent_same_owner",
    reviewRequirement: "start_of_day_review",
    reportingImplication: "긴급 항목 SLA 준수율 보고",
  },
  handoff_acceptance: {
    id: "handoff_acceptance",
    label: "인수인계 수락 시간",
    description: "인수인계 요청 후 수락까지 소요 시간",
    targetHours: 6,
    breachHours: 12,
    owner: "operator",
    escalationPath: "handoff_not_picked_up",
    reviewRequirement: "start_of_day_review",
    reportingImplication: "미인수 인수인계 건수 보고",
  },
  blocked_resolution: {
    id: "blocked_resolution",
    label: "차단 해결 시간",
    description: "차단 상태 진입 후 해제까지 소요 시간",
    targetHours: 24,
    breachHours: 48,
    owner: "both",
    escalationPath: "blocked_too_long",
    reviewRequirement: "midday_escalation_check",
    reportingImplication: "장기 차단 항목 에이징 보고",
  },
  reassignment_stability: {
    id: "reassignment_stability",
    label: "재배정 안정성",
    description: "항목당 재배정 횟수 임계값",
    targetHours: 0, // not time-based; 0 means N/A
    breachHours: 0,
    owner: "lead",
    escalationPath: "repeatedly_reassigned",
    reviewRequirement: "weekly_bottleneck_review",
    reportingImplication: "재배정 핫스팟 보고",
  },
  review_completion: {
    id: "review_completion",
    label: "검토 완료율",
    description: "일일 검토 대상 항목 중 실제 검토 완료 비율",
    targetHours: 0, // percentage, not time-based
    breachHours: 0,
    owner: "lead",
    escalationPath: null,
    reviewRequirement: "end_of_day_carryover",
    reportingImplication: "일일 검토 완료율 보고",
  },
};

export const SLA_CATEGORY_LABELS: Record<SLACategoryId, string> = {
  first_action_latency: "최초 조치 지연",
  urgent_resolution: "긴급 해결 시간",
  handoff_acceptance: "인수인계 수락 시간",
  blocked_resolution: "차단 해결 시간",
  reassignment_stability: "재배정 안정성",
  review_completion: "검토 완료율",
};

// ══════════════════════════════════════════════════════
// §3: Lead Intervention Rules
// ══════════════════════════════════════════════════════

export type LeadInterventionCaseId =
  | "repeated_reassignment"
  | "carry_over_escalation"
  | "sla_breach_cluster"
  | "blocked_without_action"
  | "operator_overload";

export interface LeadInterventionCaseDef {
  id: LeadInterventionCaseId;
  label: string;
  triggerCondition: string;
  recommendedAction: string;
  resolutionExpectation: string;
  followUpRequirement: string;
  relatedSLA: SLACategoryId | null;
}

export const LEAD_INTERVENTION_CASE_DEFS: Record<LeadInterventionCaseId, LeadInterventionCaseDef> = {
  repeated_reassignment: {
    id: "repeated_reassignment",
    label: "반복 재배정",
    triggerCondition: "동일 항목 3회 이상 재배정",
    recommendedAction: "안정적 담당자 확정 및 근본 원인 파악",
    resolutionExpectation: "24시간 내 고정 담당자 배정",
    followUpRequirement: "주간 병목 분석에서 추적",
    relatedSLA: "reassignment_stability",
  },
  carry_over_escalation: {
    id: "carry_over_escalation",
    label: "이월 심화",
    triggerCondition: "이월 2일 이상 지속 또는 심각도 승격",
    recommendedAction: "직접 개입하여 차단 요인 제거",
    resolutionExpectation: "당일 내 조치 방향 결정",
    followUpRequirement: "다음 일일 검토에서 확인",
    relatedSLA: null,
  },
  sla_breach_cluster: {
    id: "sla_breach_cluster",
    label: "SLA 위반 집중",
    triggerCondition: "동일 담당자 또는 유형에서 SLA 위반 3건 이상",
    recommendedAction: "업무 재분배 또는 프로세스 개선",
    resolutionExpectation: "주간 검토 내 개선 계획 수립",
    followUpRequirement: "주간 병목 분석에서 추세 확인",
    relatedSLA: null,
  },
  blocked_without_action: {
    id: "blocked_without_action",
    label: "조치 없는 차단",
    triggerCondition: "차단 48시간 이상 + 최근 24시간 내 조치 기록 없음",
    recommendedAction: "차단 사유 직접 확인 및 해제 조치",
    resolutionExpectation: "24시간 내 차단 해제 또는 에스컬레이션",
    followUpRequirement: "오후 에스컬레이션 점검에서 확인",
    relatedSLA: "blocked_resolution",
  },
  operator_overload: {
    id: "operator_overload",
    label: "운영자 과부하",
    triggerCondition: "단일 운영자에 활성 긴급 항목 5건 이상 배정",
    recommendedAction: "업무 재분배",
    resolutionExpectation: "당일 내 재분배 완료",
    followUpRequirement: "업무 시작 검토에서 배정 균형 확인",
    relatedSLA: null,
  },
};

export const LEAD_INTERVENTION_LABELS: Record<LeadInterventionCaseId, string> = {
  repeated_reassignment: "반복 재배정",
  carry_over_escalation: "이월 심화",
  sla_breach_cluster: "SLA 위반 집중",
  blocked_without_action: "조치 없는 차단",
  operator_overload: "운영자 과부하",
};

// ══════════════════════════════════════════════════════
// §4: Review Outcome Governance
// ══════════════════════════════════════════════════════

export interface ReviewOutcomeGovernanceDef {
  outcomeId: ReviewOutcomeId;
  carryOverReasonCode: CarryOverReason | null;
  preservesHistory: boolean;
  governanceNote: string;
}

export const REVIEW_OUTCOME_GOVERNANCE: Record<ReviewOutcomeId, ReviewOutcomeGovernanceDef> = {
  keep_with_owner: {
    outcomeId: "keep_with_owner",
    carryOverReasonCode: null,
    preservesHistory: true,
    governanceNote: "이월 종료, 현 담당자 유지 확인",
  },
  reassign: {
    outcomeId: "reassign",
    carryOverReasonCode: null,
    preservesHistory: true,
    governanceNote: "이월 종료, 새 담당자에게 이관",
  },
  escalate_to_lead: {
    outcomeId: "escalate_to_lead",
    carryOverReasonCode: null,
    preservesHistory: true,
    governanceNote: "리드 개입으로 전환, 이월 종료",
  },
  blocked_followup: {
    outcomeId: "blocked_followup",
    carryOverReasonCode: "blocked_unresolved",
    preservesHistory: true,
    governanceNote: "차단 이월 지속, 다음 검토에서 재확인",
  },
  carry_to_next: {
    outcomeId: "carry_to_next",
    carryOverReasonCode: "overdue_owned",
    preservesHistory: true,
    governanceNote: "다음 검토로 이월, 사유 기록 필수",
  },
  resolved_during_review: {
    outcomeId: "resolved_during_review",
    carryOverReasonCode: null,
    preservesHistory: true,
    governanceNote: "검토 중 해결 확인, 이월 종료",
  },
};

// ══════════════════════════════════════════════════════
// §5: Governance-Facing Reporting Signals
// ══════════════════════════════════════════════════════

export type GovernanceSignalId =
  | "daily_unresolved_urgent"
  | "carry_over_by_reason"
  | "blocked_aging"
  | "reassignment_hotspots"
  | "avg_first_action_latency"
  | "lead_intervention_count";

export interface GovernanceSignalDef {
  id: GovernanceSignalId;
  label: string;
  description: string;
  dataSource: string;
  cadenceStep: CadenceStepId;
  threshold: string;
}

export const GOVERNANCE_SIGNAL_DEFS: Record<GovernanceSignalId, GovernanceSignalDef> = {
  daily_unresolved_urgent: {
    id: "daily_unresolved_urgent",
    label: "일일 미해결 긴급",
    description: "당일 미해결 긴급 항목 수",
    dataSource: "DailyReviewSurface.categories.urgent_now + overdue_owned",
    cadenceStep: "start_of_day_review",
    threshold: "0건 목표, 3건 이상 리드 개입",
  },
  carry_over_by_reason: {
    id: "carry_over_by_reason",
    label: "사유별 이월 현황",
    description: "이월 사유별 항목 수 및 일수 분포",
    dataSource: "DailyReviewSurface.carryOverCount + item.carryOver",
    cadenceStep: "end_of_day_carryover",
    threshold: "이월 2일 이상 심각도 승격",
  },
  blocked_aging: {
    id: "blocked_aging",
    label: "차단 에이징",
    description: "차단 상태 지속 시간 분포",
    dataSource: "AccountabilityMetrics.blockedAgingCount",
    cadenceStep: "midday_escalation_check",
    threshold: "48시간 초과 시 에스컬레이션",
  },
  reassignment_hotspots: {
    id: "reassignment_hotspots",
    label: "재배정 핫스팟",
    description: "재배정 빈도가 높은 항목 또는 담당자",
    dataSource: "AccountabilityMetrics.reassignmentCount + logs",
    cadenceStep: "weekly_bottleneck_review",
    threshold: "동일 항목 3회 이상 재배정",
  },
  avg_first_action_latency: {
    id: "avg_first_action_latency",
    label: "평균 최초 조치 지연",
    description: "배정 후 최초 조치까지 평균 소요 시간",
    dataSource: "AccountabilityMetrics.avgFirstActionLatencyHours",
    cadenceStep: "start_of_day_review",
    threshold: "목표 4시간, 위반 8시간",
  },
  lead_intervention_count: {
    id: "lead_intervention_count",
    label: "리드 개입 건수",
    description: "기간 내 리드 개입 발생 건수",
    dataSource: "ActivityLog ITEM_ESCALATED + ITEM_REVIEW_COMPLETED(escalate_to_lead)",
    cadenceStep: "weekly_bottleneck_review",
    threshold: "주간 추세 모니터링",
  },
};

export const GOVERNANCE_SIGNAL_LABELS: Record<GovernanceSignalId, string> = {
  daily_unresolved_urgent: "일일 미해결 긴급",
  carry_over_by_reason: "사유별 이월 현황",
  blocked_aging: "차단 에이징",
  reassignment_hotspots: "재배정 핫스팟",
  avg_first_action_latency: "평균 최초 조치 지연",
  lead_intervention_count: "리드 개입 건수",
};

// ══════════════════════════════════════════════════════
// Pure Function Result Types
// ══════════════════════════════════════════════════════

export interface CadenceStatus {
  stepId: CadenceStepId;
  isRelevant: boolean;
  pendingItemCount: number;
  completedItemCount: number;
  description: string;
}

export interface SLAStatus {
  categoryId: SLACategoryId;
  totalItems: number;
  withinTarget: number;
  withinBreach: number;
  breached: number;
  complianceRate: number; // 0-1
}

export interface LeadInterventionTrigger {
  caseId: LeadInterventionCaseId;
  triggered: boolean;
  affectedItemIds: string[];
  affectedUserIds: string[];
  detail: string;
}

export interface GovernanceSignalValue {
  signalId: GovernanceSignalId;
  value: number;
  breakdown: Record<string, number>;
  thresholdExceeded: boolean;
}

export interface GovernanceReport {
  date: string;
  cadenceStatuses: CadenceStatus[];
  slaStatuses: SLAStatus[];
  interventionTriggers: LeadInterventionTrigger[];
  signals: GovernanceSignalValue[];
}

// ══════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const TERMINAL_TASK_STATUSES = new Set(["COMPLETED", "FAILED"]);

// ══════════════════════════════════════════════════════
// §1 Pure Function: Evaluate Cadence Status
// ══════════════════════════════════════════════════════

/**
 * 현재 시점에서 각 케이던스 단계의 상태를 평가합니다.
 */
export function evaluateCadenceStatuses(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  userId: string,
  now?: Date,
): CadenceStatus[] {
  const _now = now ?? new Date();
  const todayStr = toDateStr(_now);
  const surface = selectDailyReviewItems(items, logs, userId, _now);

  // Check which cadence steps have been completed today
  const todayCadenceLogs = logs.filter((l) => {
    const logDate = toDateStr(l.createdAt);
    return logDate === todayStr && isCadenceEvent(l.activityType);
  });
  const completedSteps = new Set(todayCadenceLogs.map((l) => cadenceEventToStep(l.activityType)));

  const results: CadenceStatus[] = [];

  for (const stepId of Object.keys(CADENCE_STEP_DEFS) as CadenceStepId[]) {
    const def = CADENCE_STEP_DEFS[stepId];
    const isCompleted = completedSteps.has(stepId);

    let pendingCount = 0;
    let completedCount = 0;

    if (stepId === "start_of_day_review") {
      pendingCount = surface.categories.urgent_now.length
        + surface.categories.overdue_owned.length
        + surface.categories.handoff_not_accepted.length;
      completedCount = surface.categories.recently_resolved.length;
    } else if (stepId === "midday_escalation_check") {
      pendingCount = surface.categories.blocked_too_long.length
        + surface.categories.urgent_unassigned.length;
    } else if (stepId === "end_of_day_carryover") {
      pendingCount = surface.carryOverCount;
      completedCount = surface.categories.recently_resolved.length;
    } else if (stepId === "weekly_bottleneck_review") {
      pendingCount = surface.categories.needs_lead_intervention.length;
    }

    const isRelevant = stepId === "weekly_bottleneck_review"
      ? isWeeklyReviewDay(_now)
      : true; // daily steps are always relevant

    results.push({
      stepId,
      isRelevant: isRelevant && !isCompleted,
      pendingItemCount: pendingCount,
      completedItemCount: completedCount,
      description: isCompleted
        ? `${def.label} 완료`
        : `${def.label}: ${pendingCount}건 검토 대기`,
    });
  }

  return results;
}

// ══════════════════════════════════════════════════════
// §2 Pure Function: Evaluate SLA Statuses
// ══════════════════════════════════════════════════════

/**
 * 각 SLA 카테고리의 현재 준수 상태를 평가합니다.
 */
export function evaluateSLAStatuses(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  now?: Date,
): SLAStatus[] {
  const _now = now ?? new Date();
  const results: SLAStatus[] = [];

  for (const catId of Object.keys(SLA_CATEGORY_DEFS) as SLACategoryId[]) {
    const def = SLA_CATEGORY_DEFS[catId];

    if (catId === "first_action_latency") {
      results.push(evaluateFirstActionSLA(items, logs, def, _now));
    } else if (catId === "urgent_resolution") {
      results.push(evaluateUrgentResolutionSLA(items, def, _now));
    } else if (catId === "handoff_acceptance") {
      results.push(evaluateHandoffAcceptanceSLA(items, def, _now));
    } else if (catId === "blocked_resolution") {
      results.push(evaluateBlockedResolutionSLA(items, def, _now));
    } else if (catId === "reassignment_stability") {
      results.push(evaluateReassignmentStabilitySLA(items, logs, def));
    } else if (catId === "review_completion") {
      results.push(evaluateReviewCompletionSLA(items, def, _now));
    }
  }

  return results;
}

function evaluateFirstActionSLA(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  def: SLACategoryDef,
  now: Date,
): SLAStatus {
  // Items that are assigned and active
  const assigned = items.filter((i) =>
    !TERMINAL_TASK_STATUSES.has(i.taskStatus) && i.assigneeId,
  );

  let withinTarget = 0;
  let withinBreach = 0;
  let breached = 0;

  // Build first-action map from logs
  const firstActionByItem = new Map<string, Date>();
  for (const log of logs) {
    if (!log.entityId) continue;
    if (log.activityType === "ITEM_ASSIGNED" || log.activityType === "STATUS_CHANGED") continue;
    // Any non-assignment activity counts as first action
    if (!firstActionByItem.has(log.entityId)) {
      firstActionByItem.set(log.entityId, new Date(log.createdAt));
    }
  }

  for (const item of assigned) {
    const assignedAt = new Date(item.createdAt);
    const firstAction = firstActionByItem.get(item.id);
    const elapsed = firstAction
      ? (firstAction.getTime() - assignedAt.getTime()) / MS_PER_HOUR
      : (now.getTime() - assignedAt.getTime()) / MS_PER_HOUR;

    if (elapsed <= def.targetHours) {
      withinTarget++;
    } else if (elapsed <= def.breachHours) {
      withinBreach++;
    } else {
      breached++;
    }
  }

  const total = assigned.length;
  return {
    categoryId: "first_action_latency",
    totalItems: total,
    withinTarget,
    withinBreach,
    breached,
    complianceRate: total > 0 ? withinTarget / total : 1,
  };
}

function evaluateUrgentResolutionSLA(
  items: WorkQueueItem[],
  def: SLACategoryDef,
  now: Date,
): SLAStatus {
  const urgent = items.filter((i) => {
    const tier = computeFinalTier(i);
    return tier === "urgent_blocker" && i.assigneeId;
  });

  let withinTarget = 0;
  let withinBreach = 0;
  let breached = 0;

  for (const item of urgent) {
    if (TERMINAL_TASK_STATUSES.has(item.taskStatus)) {
      // Resolved — check how long it took
      const elapsed = (new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime()) / MS_PER_HOUR;
      if (elapsed <= def.targetHours) withinTarget++;
      else if (elapsed <= def.breachHours) withinBreach++;
      else breached++;
    } else {
      // Still open
      const elapsed = (now.getTime() - new Date(item.createdAt).getTime()) / MS_PER_HOUR;
      if (elapsed <= def.targetHours) withinTarget++;
      else if (elapsed <= def.breachHours) withinBreach++;
      else breached++;
    }
  }

  const total = urgent.length;
  return {
    categoryId: "urgent_resolution",
    totalItems: total,
    withinTarget,
    withinBreach,
    breached,
    complianceRate: total > 0 ? withinTarget / total : 1,
  };
}

function evaluateHandoffAcceptanceSLA(
  items: WorkQueueItem[],
  def: SLACategoryDef,
  now: Date,
): SLAStatus {
  const handedOff = items.filter((i) => {
    const state = resolveAssignmentState({
      assigneeId: i.assigneeId ?? null,
      metadata: i.metadata ?? {},
      taskStatus: i.taskStatus,
    });
    return state === "handed_off" && !TERMINAL_TASK_STATUSES.has(i.taskStatus);
  });

  let withinTarget = 0;
  let withinBreach = 0;
  let breached = 0;

  for (const item of handedOff) {
    const metadata = item.metadata as Record<string, unknown>;
    const handoff = metadata?.handoff as { handedOffAt?: string } | undefined;
    const handedOffAt = handoff?.handedOffAt
      ? new Date(handoff.handedOffAt)
      : new Date(item.updatedAt);
    const elapsed = (now.getTime() - handedOffAt.getTime()) / MS_PER_HOUR;

    if (elapsed <= def.targetHours) withinTarget++;
    else if (elapsed <= def.breachHours) withinBreach++;
    else breached++;
  }

  const total = handedOff.length;
  return {
    categoryId: "handoff_acceptance",
    totalItems: total,
    withinTarget,
    withinBreach,
    breached,
    complianceRate: total > 0 ? withinTarget / total : 1,
  };
}

function evaluateBlockedResolutionSLA(
  items: WorkQueueItem[],
  def: SLACategoryDef,
  now: Date,
): SLAStatus {
  const blocked = items.filter((i) => {
    const state = resolveAssignmentState({
      assigneeId: i.assigneeId ?? null,
      metadata: i.metadata ?? {},
      taskStatus: i.taskStatus,
    });
    return state === "blocked" && !TERMINAL_TASK_STATUSES.has(i.taskStatus);
  });

  let withinTarget = 0;
  let withinBreach = 0;
  let breached = 0;

  for (const item of blocked) {
    const metadata = item.metadata as Record<string, unknown>;
    const blockedAt = metadata?.blockedAt
      ? new Date(metadata.blockedAt as string)
      : new Date(item.updatedAt);
    const elapsed = (now.getTime() - blockedAt.getTime()) / MS_PER_HOUR;

    if (elapsed <= def.targetHours) withinTarget++;
    else if (elapsed <= def.breachHours) withinBreach++;
    else breached++;
  }

  const total = blocked.length;
  return {
    categoryId: "blocked_resolution",
    totalItems: total,
    withinTarget,
    withinBreach,
    breached,
    complianceRate: total > 0 ? withinTarget / total : 1,
  };
}

function evaluateReassignmentStabilitySLA(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  def: SLACategoryDef,
): SLAStatus {
  // Count items with 3+ reassignment events
  const reassignCounts = new Map<string, number>();
  for (const log of logs) {
    if (!log.entityId) continue;
    if (log.activityType === "ITEM_REASSIGNED" || log.activityType === "ITEM_ASSIGNED") {
      reassignCounts.set(log.entityId, (reassignCounts.get(log.entityId) ?? 0) + 1);
    }
  }

  const activeItems = items.filter((i) => !TERMINAL_TASK_STATUSES.has(i.taskStatus));
  let withinTarget = 0;
  let breached = 0;

  for (const item of activeItems) {
    const count = reassignCounts.get(item.id) ?? 0;
    if (count < 3) {
      withinTarget++;
    } else {
      breached++;
    }
  }

  const total = activeItems.length;
  return {
    categoryId: "reassignment_stability",
    totalItems: total,
    withinTarget,
    withinBreach: 0, // binary: either stable or not
    breached,
    complianceRate: total > 0 ? withinTarget / total : 1,
  };
}

function evaluateReviewCompletionSLA(
  items: WorkQueueItem[],
  def: SLACategoryDef,
  now: Date,
): SLAStatus {
  const todayStr = toDateStr(now);
  const activeItems = items.filter((i) => !TERMINAL_TASK_STATUSES.has(i.taskStatus));

  let reviewed = 0;
  let notReviewed = 0;

  for (const item of activeItems) {
    const metadata = item.metadata as Record<string, unknown>;
    const history = (metadata?.reviewHistory ?? []) as ReviewRecord[];
    const lastReview = history[history.length - 1];

    if (lastReview && toDateStr(lastReview.reviewedAt) === todayStr) {
      reviewed++;
    } else {
      notReviewed++;
    }
  }

  const total = activeItems.length;
  return {
    categoryId: "review_completion",
    totalItems: total,
    withinTarget: reviewed,
    withinBreach: 0,
    breached: notReviewed,
    complianceRate: total > 0 ? reviewed / total : 1,
  };
}

// ══════════════════════════════════════════════════════
// §3 Pure Function: Evaluate Lead Intervention Triggers
// ══════════════════════════════════════════════════════

/**
 * 리드 개입이 필요한 상황을 평가합니다.
 */
export function evaluateLeadInterventionTriggers(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  now?: Date,
): LeadInterventionTrigger[] {
  const _now = now ?? new Date();
  const results: LeadInterventionTrigger[] = [];

  // Case 1: Repeated reassignment (3+ times)
  results.push(checkRepeatedReassignment(items, logs));

  // Case 2: Carry-over escalation (2+ days or severity promoted)
  results.push(checkCarryOverEscalation(items, _now));

  // Case 3: SLA breach cluster (3+ breaches for same owner or type)
  results.push(checkSLABreachCluster(items, logs, _now));

  // Case 4: Blocked without action (48h+ blocked, no recent action)
  results.push(checkBlockedWithoutAction(items, logs, _now));

  // Case 5: Operator overload (5+ urgent items assigned to one person)
  results.push(checkOperatorOverload(items));

  return results;
}

function checkRepeatedReassignment(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
): LeadInterventionTrigger {
  const reassignCounts = new Map<string, number>();
  for (const log of logs) {
    if (!log.entityId) continue;
    if (log.activityType === "ITEM_REASSIGNED" || log.activityType === "ITEM_ASSIGNED") {
      reassignCounts.set(log.entityId, (reassignCounts.get(log.entityId) ?? 0) + 1);
    }
  }

  const affectedItems: string[] = [];
  const affectedUsers = new Set<string>();

  for (const item of items) {
    if (TERMINAL_TASK_STATUSES.has(item.taskStatus)) continue;
    const count = reassignCounts.get(item.id) ?? 0;
    if (count >= 3) {
      affectedItems.push(item.id);
      if (item.assigneeId) affectedUsers.add(item.assigneeId);
    }
  }

  return {
    caseId: "repeated_reassignment",
    triggered: affectedItems.length > 0,
    affectedItemIds: affectedItems,
    affectedUserIds: [...affectedUsers],
    detail: affectedItems.length > 0
      ? `${affectedItems.length}건 항목 3회 이상 재배정`
      : "해당 없음",
  };
}

function checkCarryOverEscalation(
  items: WorkQueueItem[],
  now: Date,
): LeadInterventionTrigger {
  const affectedItems: string[] = [];

  for (const item of items) {
    if (TERMINAL_TASK_STATUSES.has(item.taskStatus)) continue;
    const carryOver = computeCarryOver(item, now);
    if (carryOver && (carryOver.dayCount >= 2 || carryOver.severityPromoted)) {
      affectedItems.push(item.id);
    }
  }

  return {
    caseId: "carry_over_escalation",
    triggered: affectedItems.length > 0,
    affectedItemIds: affectedItems,
    affectedUserIds: [],
    detail: affectedItems.length > 0
      ? `${affectedItems.length}건 이월 2일 이상 또는 심각도 승격`
      : "해당 없음",
  };
}

function checkSLABreachCluster(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  now: Date,
): LeadInterventionTrigger {
  // Count SLA breaches per owner
  const breachByOwner = new Map<string, number>();

  for (const item of items) {
    if (TERMINAL_TASK_STATUSES.has(item.taskStatus)) continue;
    if (!item.assigneeId) continue;

    const elapsed = (now.getTime() - new Date(item.createdAt).getTime()) / MS_PER_HOUR;
    const tier = computeFinalTier(item);

    // Check various SLA thresholds
    let isBreach = false;
    if (tier === "urgent_blocker" && elapsed > 24) isBreach = true;

    const state = resolveAssignmentState({
      assigneeId: item.assigneeId ?? null,
      metadata: item.metadata ?? {},
      taskStatus: item.taskStatus,
    });
    if (state === "blocked" && elapsed > 48) isBreach = true;

    if (isBreach) {
      breachByOwner.set(item.assigneeId, (breachByOwner.get(item.assigneeId) ?? 0) + 1);
    }
  }

  const affectedUsers: string[] = [];
  const affectedItems: string[] = [];

  for (const [userId, count] of breachByOwner) {
    if (count >= 3) {
      affectedUsers.push(userId);
      // Collect item IDs for this user
      for (const item of items) {
        if (item.assigneeId === userId && !TERMINAL_TASK_STATUSES.has(item.taskStatus)) {
          affectedItems.push(item.id);
        }
      }
    }
  }

  return {
    caseId: "sla_breach_cluster",
    triggered: affectedUsers.length > 0,
    affectedItemIds: affectedItems,
    affectedUserIds: affectedUsers,
    detail: affectedUsers.length > 0
      ? `${affectedUsers.length}명 담당자 SLA 위반 3건 이상`
      : "해당 없음",
  };
}

function checkBlockedWithoutAction(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  now: Date,
): LeadInterventionTrigger {
  const recentThreshold = now.getTime() - 24 * MS_PER_HOUR;
  const blockedThreshold = now.getTime() - 48 * MS_PER_HOUR;

  // Build recent-action set
  const recentActionItems = new Set<string>();
  for (const log of logs) {
    if (!log.entityId) continue;
    if (new Date(log.createdAt).getTime() >= recentThreshold) {
      recentActionItems.add(log.entityId);
    }
  }

  const affectedItems: string[] = [];
  const affectedUsers = new Set<string>();

  for (const item of items) {
    if (TERMINAL_TASK_STATUSES.has(item.taskStatus)) continue;
    const state = resolveAssignmentState({
      assigneeId: item.assigneeId ?? null,
      metadata: item.metadata ?? {},
      taskStatus: item.taskStatus,
    });

    if (state !== "blocked") continue;

    // Check if blocked for 48h+
    const metadata = item.metadata as Record<string, unknown>;
    const blockedAt = metadata?.blockedAt
      ? new Date(metadata.blockedAt as string).getTime()
      : new Date(item.updatedAt).getTime();

    if (blockedAt > blockedThreshold) continue; // not yet 48h

    // Check if no recent action
    if (!recentActionItems.has(item.id)) {
      affectedItems.push(item.id);
      if (item.assigneeId) affectedUsers.add(item.assigneeId);
    }
  }

  return {
    caseId: "blocked_without_action",
    triggered: affectedItems.length > 0,
    affectedItemIds: affectedItems,
    affectedUserIds: [...affectedUsers],
    detail: affectedItems.length > 0
      ? `${affectedItems.length}건 48시간 이상 차단 + 최근 24시간 조치 없음`
      : "해당 없음",
  };
}

function checkOperatorOverload(
  items: WorkQueueItem[],
): LeadInterventionTrigger {
  const urgentByOwner = new Map<string, string[]>();

  for (const item of items) {
    if (TERMINAL_TASK_STATUSES.has(item.taskStatus)) continue;
    if (!item.assigneeId) continue;
    const tier = computeFinalTier(item);
    if (tier === "urgent_blocker") {
      const arr = urgentByOwner.get(item.assigneeId) ?? [];
      arr.push(item.id);
      urgentByOwner.set(item.assigneeId, arr);
    }
  }

  const affectedUsers: string[] = [];
  const affectedItems: string[] = [];

  for (const [userId, itemIds] of urgentByOwner) {
    if (itemIds.length >= 5) {
      affectedUsers.push(userId);
      affectedItems.push(...itemIds);
    }
  }

  return {
    caseId: "operator_overload",
    triggered: affectedUsers.length > 0,
    affectedItemIds: affectedItems,
    affectedUserIds: affectedUsers,
    detail: affectedUsers.length > 0
      ? `${affectedUsers.length}명 운영자 긴급 항목 5건 이상`
      : "해당 없음",
  };
}

// ══════════════════════════════════════════════════════
// §5 Pure Function: Compute Governance Signals
// ══════════════════════════════════════════════════════

/**
 * 거버넌스 보고 신호를 계산합니다.
 */
export function computeGovernanceSignals(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  userId: string,
  now?: Date,
): GovernanceSignalValue[] {
  const _now = now ?? new Date();
  const surface = selectDailyReviewItems(items, logs, userId, _now);
  const metrics = computeAccountabilityMetrics(items, logs, _now);

  const signals: GovernanceSignalValue[] = [];

  // 1. daily_unresolved_urgent
  const urgentCount = surface.categories.urgent_now.length + surface.categories.overdue_owned.length;
  signals.push({
    signalId: "daily_unresolved_urgent",
    value: urgentCount,
    breakdown: {
      urgent_now: surface.categories.urgent_now.length,
      overdue_owned: surface.categories.overdue_owned.length,
    },
    thresholdExceeded: urgentCount >= 3,
  });

  // 2. carry_over_by_reason
  const carryOverBreakdown: Record<string, number> = {};
  for (const catItems of Object.values(surface.categories)) {
    for (const ri of catItems) {
      if (ri.carryOver) {
        carryOverBreakdown[ri.carryOver.reason] = (carryOverBreakdown[ri.carryOver.reason] ?? 0) + 1;
      }
    }
  }
  signals.push({
    signalId: "carry_over_by_reason",
    value: surface.carryOverCount,
    breakdown: carryOverBreakdown,
    thresholdExceeded: Object.values(surface.categories).some((catItems) =>
      catItems.some((ri) => ri.carryOver && ri.carryOver.dayCount >= 2),
    ),
  });

  // 3. blocked_aging
  signals.push({
    signalId: "blocked_aging",
    value: metrics.blockedAgingCount,
    breakdown: { blocked_aging_count: metrics.blockedAgingCount },
    thresholdExceeded: metrics.blockedAgingCount > 0,
  });

  // 4. reassignment_hotspots
  signals.push({
    signalId: "reassignment_hotspots",
    value: metrics.reassignmentCount,
    breakdown: { reassignment_count: metrics.reassignmentCount },
    thresholdExceeded: metrics.reassignmentCount >= 3,
  });

  // 5. avg_first_action_latency
  const latency = metrics.avgFirstActionLatencyHours ?? 0;
  signals.push({
    signalId: "avg_first_action_latency",
    value: latency,
    breakdown: { avg_hours: latency },
    thresholdExceeded: latency > 8,
  });

  // 6. lead_intervention_count
  const interventionLogs = logs.filter((l) =>
    l.activityType === "ITEM_ESCALATED"
    || (l.activityType === "ITEM_REVIEW_COMPLETED"
      && (l.metadata as Record<string, unknown>)?.reviewOutcome === "escalate_to_lead"),
  );
  signals.push({
    signalId: "lead_intervention_count",
    value: interventionLogs.length,
    breakdown: {
      escalated: logs.filter((l) => l.activityType === "ITEM_ESCALATED").length,
      review_escalated: interventionLogs.length - logs.filter((l) => l.activityType === "ITEM_ESCALATED").length,
    },
    thresholdExceeded: false, // trend monitoring, no hard threshold
  });

  return signals;
}

// ══════════════════════════════════════════════════════
// Composite: Generate Full Governance Report
// ══════════════════════════════════════════════════════

/**
 * 전체 거버넌스 보고서를 생성합니다.
 */
export function generateGovernanceReport(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  userId: string,
  now?: Date,
): GovernanceReport {
  const _now = now ?? new Date();

  return {
    date: toDateStr(_now),
    cadenceStatuses: evaluateCadenceStatuses(items, logs, userId, _now),
    slaStatuses: evaluateSLAStatuses(items, logs, _now),
    interventionTriggers: evaluateLeadInterventionTriggers(items, logs, _now),
    signals: computeGovernanceSignals(items, logs, userId, _now),
  };
}

// ══════════════════════════════════════════════════════
// §4 Pure Function: Map Review Outcome to Governance
// ══════════════════════════════════════════════════════

/**
 * 검토 결과에 대한 거버넌스 정보를 조회합니다.
 */
export function getReviewOutcomeGovernance(
  outcomeId: ReviewOutcomeId,
): ReviewOutcomeGovernanceDef {
  return REVIEW_OUTCOME_GOVERNANCE[outcomeId];
}

/**
 * 검토 결과의 이월 사유 코드를 반환합니다.
 */
export function getCarryOverReasonForOutcome(
  outcomeId: ReviewOutcomeId,
): CarryOverReason | null {
  return REVIEW_OUTCOME_GOVERNANCE[outcomeId].carryOverReasonCode;
}

// ══════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════

function toDateStr(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

function isCadenceEvent(activityType: string): boolean {
  return activityType.startsWith("CADENCE_");
}

function cadenceEventToStep(activityType: string): CadenceStepId | null {
  const map: Record<string, CadenceStepId> = {
    CADENCE_START_OF_DAY: "start_of_day_review",
    CADENCE_MIDDAY_CHECK: "midday_escalation_check",
    CADENCE_END_OF_DAY: "end_of_day_carryover",
    CADENCE_WEEKLY_REVIEW: "weekly_bottleneck_review",
  };
  return map[activityType] ?? null;
}

function isWeeklyReviewDay(now: Date): boolean {
  // Monday = 1
  return now.getUTCDay() === 1;
}
