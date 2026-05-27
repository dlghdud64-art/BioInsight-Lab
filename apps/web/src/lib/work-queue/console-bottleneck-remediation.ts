/**
 * Console Bottleneck Remediation — 병목 탐지 & 개선 루프
 *
 * 반복되는 SLA 위반, 이월, 재배정 핫스팟, 차단 장기화 등을
 * 명시적 개선 항목(remediation item)으로 전환합니다.
 * §1 병목 탐지(7클래스), §2 개선 항목 모델(5상태),
 * §3 주간 병목 검토, §4 거버넌스→개선 연결,
 * §5 콘솔 가시화, §6 클로즈-더-루프 보고.
 *
 * 순수 정의 파일 — DB 호출 없음.
 */

import type { WorkQueueItem } from "./work-queue-service";
import type {
  ActivityLogEntry,
  EscalationResult,
} from "./console-accountability";
import {
  evaluateEscalations,
  computeAccountabilityMetrics,
} from "./console-accountability";
import {
  resolveAssignmentState,
  type AssignmentState,
} from "./console-assignment";
import { computeFinalTier } from "./console-priorities";
import type {
  CarryOverEntry,
  ReviewRecord,
} from "./console-daily-review";
import {
  selectDailyReviewItems,
  computeCarryOver,
} from "./console-daily-review";
import type {
  GovernanceSignalValue,
  LeadInterventionTrigger,
  SLAStatus,
} from "./console-cadence-governance";
import {
  evaluateSLAStatuses,
  evaluateLeadInterventionTriggers,
  computeGovernanceSignals,
} from "./console-cadence-governance";

// ══════════════════════════════════════════════════════
// §1: Canonical Bottleneck Detection
// ══════════════════════════════════════════════════════

export type BottleneckClassId =
  | "repeated_sla_breach"
  | "repeated_carry_over"
  | "repeated_reassignment_hotspot"
  | "blocked_work_hotspot"
  | "handoff_failure_hotspot"
  | "owner_role_latency_hotspot"
  | "queue_type_throughput_hotspot";

export type BottleneckSeverity = "low" | "medium" | "high" | "critical";

export interface BottleneckClassDef {
  id: BottleneckClassId;
  label: string;
  description: string;
  detectionRule: string;
  thresholdWindow: string;
  severity: BottleneckSeverity;
  reportingImplication: string;
  remediationRequired: boolean;
}

export const BOTTLENECK_CLASS_DEFS: Record<BottleneckClassId, BottleneckClassDef> = {
  repeated_sla_breach: {
    id: "repeated_sla_breach",
    label: "반복 SLA 위반",
    description: "동일 SLA 카테고리에서 주간 3회 이상 위반",
    detectionRule: "SLA breached >= 3 in same category within 7 days",
    thresholdWindow: "7일",
    severity: "high",
    reportingImplication: "주간 병목 분석 필수 항목",
    remediationRequired: true,
  },
  repeated_carry_over: {
    id: "repeated_carry_over",
    label: "반복 이월",
    description: "동일 항목 3일 이상 연속 이월",
    detectionRule: "carryOver.dayCount >= 3 on same item",
    thresholdWindow: "3일",
    severity: "high",
    reportingImplication: "리드 개입 필요",
    remediationRequired: true,
  },
  repeated_reassignment_hotspot: {
    id: "repeated_reassignment_hotspot",
    label: "반복 재배정 핫스팟",
    description: "동일 항목 또는 큐 패밀리에서 주간 재배정 5회 이상",
    detectionRule: "reassignment count >= 5 on same item or queue family within 7 days",
    thresholdWindow: "7일",
    severity: "high",
    reportingImplication: "담당자 안정화 필요",
    remediationRequired: true,
  },
  blocked_work_hotspot: {
    id: "blocked_work_hotspot",
    label: "차단 장기화 핫스팟",
    description: "동일 큐 유형에서 48시간 이상 차단 항목 3건 이상",
    detectionRule: "blocked items >= 3 with duration > 48h in same queue type",
    thresholdWindow: "현재 스냅샷",
    severity: "medium",
    reportingImplication: "프로세스 병목 분석 필요",
    remediationRequired: true,
  },
  handoff_failure_hotspot: {
    id: "handoff_failure_hotspot",
    label: "인수인계 실패 핫스팟",
    description: "주간 미인수 인수인계 3건 이상",
    detectionRule: "handoff_not_picked_up escalation >= 3 within 7 days",
    thresholdWindow: "7일",
    severity: "medium",
    reportingImplication: "인수인계 프로세스 개선 필요",
    remediationRequired: false,
  },
  owner_role_latency_hotspot: {
    id: "owner_role_latency_hotspot",
    label: "담당 역할 지연 핫스팟",
    description: "특정 담당자 평균 최초 조치 지연 8시간 초과",
    detectionRule: "avg first-action latency > 8h per owner within 7 days",
    thresholdWindow: "7일",
    severity: "medium",
    reportingImplication: "업무 분배 재검토 필요",
    remediationRequired: false,
  },
  queue_type_throughput_hotspot: {
    id: "queue_type_throughput_hotspot",
    label: "큐 유형 처리량 핫스팟",
    description: "특정 큐 유형 완료율 주간 50% 미만",
    detectionRule: "completion rate < 50% for queue type within 7 days",
    thresholdWindow: "7일",
    severity: "low",
    reportingImplication: "큐 운영 전략 재검토",
    remediationRequired: false,
  },
};

export const BOTTLENECK_CLASS_LABELS: Record<BottleneckClassId, string> = {
  repeated_sla_breach: "반복 SLA 위반",
  repeated_carry_over: "반복 이월",
  repeated_reassignment_hotspot: "반복 재배정 핫스팟",
  blocked_work_hotspot: "차단 장기화 핫스팟",
  handoff_failure_hotspot: "인수인계 실패 핫스팟",
  owner_role_latency_hotspot: "담당 역할 지연 핫스팟",
  queue_type_throughput_hotspot: "큐 유형 처리량 핫스팟",
};

// ══════════════════════════════════════════════════════
// §2: Remediation Item Model
// ══════════════════════════════════════════════════════

export type RemediationStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "resolved"
  | "deferred";

export interface RemediationItem {
  remediationId: string;
  bottleneckType: BottleneckClassId;
  sourceMetric: string;
  sourceRule: string;
  severity: BottleneckSeverity;
  summary: string;
  owner: string;
  createdAt: string;
  dueAt: string;
  status: RemediationStatus;
  linkedQueueFamily: string | null;
  linkedEntityType: string | null;
  reviewContext: string;
  resolutionNote: string | null;
  affectedItemIds: string[];
  affectedUserIds: string[];
}

export const REMEDIATION_STATUS_DEFS: Record<RemediationStatus, {
  label: string;
  description: string;
  isTerminal: boolean;
}> = {
  open: {
    label: "열림",
    description: "개선 항목 생성됨, 미착수",
    isTerminal: false,
  },
  in_progress: {
    label: "진행 중",
    description: "개선 조치 진행 중",
    isTerminal: false,
  },
  blocked: {
    label: "차단",
    description: "개선 진행 불가 상태",
    isTerminal: false,
  },
  resolved: {
    label: "해결",
    description: "개선 조치 완료",
    isTerminal: true,
  },
  deferred: {
    label: "연기",
    description: "다음 검토로 연기",
    isTerminal: false,
  },
};

export const REMEDIATION_STATUS_LABELS: Record<RemediationStatus, string> = {
  open: "열림",
  in_progress: "진행 중",
  blocked: "차단",
  resolved: "해결",
  deferred: "연기",
};

/** Valid status transitions */
const REMEDIATION_TRANSITIONS: Record<RemediationStatus, RemediationStatus[]> = {
  open: ["in_progress", "deferred", "resolved"],
  in_progress: ["blocked", "resolved", "deferred"],
  blocked: ["in_progress", "deferred", "resolved"],
  resolved: [], // terminal
  deferred: ["open", "in_progress"],
};

// ══════════════════════════════════════════════════════
// §4: Governance-to-Remediation Linkage
// ══════════════════════════════════════════════════════

export type RemediationCreationMode = "manual" | "suggested" | "automatic";

export interface GovernanceRemediationLinkDef {
  bottleneckType: BottleneckClassId;
  triggerDescription: string;
  whoCanCreate: ("lead" | "operator")[];
  creationMode: RemediationCreationMode;
  requiredContext: string;
  activityLogEvent: string;
}

export const GOVERNANCE_REMEDIATION_LINKS: Record<BottleneckClassId, GovernanceRemediationLinkDef> = {
  repeated_sla_breach: {
    bottleneckType: "repeated_sla_breach",
    triggerDescription: "SLA 위반 주간 3회 이상 반복",
    whoCanCreate: ["lead"],
    creationMode: "suggested",
    requiredContext: "위반 SLA 카테고리, 영향 항목 목록, 담당자",
    activityLogEvent: "REMEDIATION_CREATED",
  },
  repeated_carry_over: {
    bottleneckType: "repeated_carry_over",
    triggerDescription: "동일 항목 3일 이상 연속 이월",
    whoCanCreate: ["lead"],
    creationMode: "suggested",
    requiredContext: "이월 사유, 이월 일수, 원래 카테고리",
    activityLogEvent: "REMEDIATION_CREATED",
  },
  repeated_reassignment_hotspot: {
    bottleneckType: "repeated_reassignment_hotspot",
    triggerDescription: "주간 재배정 5회 이상",
    whoCanCreate: ["lead"],
    creationMode: "suggested",
    requiredContext: "재배정 이력, 관련 담당자, 근본 원인 추정",
    activityLogEvent: "REMEDIATION_CREATED",
  },
  blocked_work_hotspot: {
    bottleneckType: "blocked_work_hotspot",
    triggerDescription: "동일 큐 48시간 이상 차단 항목 3건 이상",
    whoCanCreate: ["lead", "operator"],
    creationMode: "manual",
    requiredContext: "차단 사유, 영향 범위, 해결 시도 이력",
    activityLogEvent: "REMEDIATION_CREATED",
  },
  handoff_failure_hotspot: {
    bottleneckType: "handoff_failure_hotspot",
    triggerDescription: "주간 미인수 인수인계 3건 이상",
    whoCanCreate: ["lead"],
    creationMode: "manual",
    requiredContext: "미인수 인수인계 목록, 인수인계 대상자",
    activityLogEvent: "REMEDIATION_CREATED",
  },
  owner_role_latency_hotspot: {
    bottleneckType: "owner_role_latency_hotspot",
    triggerDescription: "담당자 평균 최초 조치 지연 8시간 초과",
    whoCanCreate: ["lead"],
    creationMode: "manual",
    requiredContext: "담당자, 평균 지연 시간, 업무 부하",
    activityLogEvent: "REMEDIATION_CREATED",
  },
  queue_type_throughput_hotspot: {
    bottleneckType: "queue_type_throughput_hotspot",
    triggerDescription: "큐 유형 주간 완료율 50% 미만",
    whoCanCreate: ["lead"],
    creationMode: "manual",
    requiredContext: "큐 유형, 완료율, 병목 원인 추정",
    activityLogEvent: "REMEDIATION_CREATED",
  },
};

// ══════════════════════════════════════════════════════
// Detection Result Types
// ══════════════════════════════════════════════════════

export interface DetectedBottleneck {
  bottleneckType: BottleneckClassId;
  severity: BottleneckSeverity;
  affectedItemIds: string[];
  affectedUserIds: string[];
  detail: string;
  metric: string;
  metricValue: number;
  remediationRequired: boolean;
  existingRemediationId: string | null;
}

export interface WeeklyReviewOutcome {
  reviewDate: string;
  reviewedBy: string;
  bottlenecksDetected: DetectedBottleneck[];
  remediationsCreated: string[];
  remediationsResolved: string[];
  remediationsDeferred: string[];
  recurringWithoutRemediation: DetectedBottleneck[];
  summary: string;
}

export interface RemediationConsoleView {
  openCount: number;
  highSeverityCount: number;
  dueSoonCount: number;
  overdueCount: number;
  linkedToCurrentHotspots: RemediationItem[];
  recentlyResolved: RemediationItem[];
}

/** §6 Close-the-loop reporting signals */
export interface RemediationReportSignals {
  recurringHotspotCount: number;
  remediationOpenedCount: number;
  remediationResolvedCount: number;
  averageRemediationAgeDays: number;
  hotspotWithoutRemediationCount: number;
  hotspotRecurrenceAfterRemediationCount: number;
}

// ══════════════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════════════

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const TERMINAL_TASK_STATUSES = new Set(["COMPLETED", "FAILED"]);

// ══════════════════════════════════════════════════════
// §1 Pure Function: Detect Bottlenecks
// ══════════════════════════════════════════════════════

/**
 * 현재 항목과 로그에서 병목을 탐지합니다.
 */
export function detectBottlenecks(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  remediations: RemediationItem[],
  userId: string,
  now?: Date,
): DetectedBottleneck[] {
  const _now = now ?? new Date();
  const results: DetectedBottleneck[] = [];

  // Build remediation lookup by bottleneck type (only non-terminal)
  const activeRemByType = new Map<BottleneckClassId, RemediationItem>();
  for (const rem of remediations) {
    if (!REMEDIATION_STATUS_DEFS[rem.status].isTerminal) {
      activeRemByType.set(rem.bottleneckType, rem);
    }
  }

  // 1. Repeated SLA breach
  results.push(detectRepeatedSLABreach(items, logs, activeRemByType, _now));

  // 2. Repeated carry-over
  results.push(detectRepeatedCarryOver(items, activeRemByType, _now));

  // 3. Repeated reassignment hotspot
  results.push(detectRepeatedReassignment(items, logs, activeRemByType));

  // 4. Blocked work hotspot
  results.push(detectBlockedWorkHotspot(items, activeRemByType, _now));

  // 5. Handoff failure hotspot
  results.push(detectHandoffFailure(items, logs, activeRemByType, _now));

  // 6. Owner role latency hotspot
  results.push(detectOwnerLatency(items, logs, activeRemByType, _now));

  // 7. Queue type throughput hotspot
  results.push(detectQueueThroughput(items, logs, activeRemByType, _now));

  return results;
}

function detectRepeatedSLABreach(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  activeRem: Map<BottleneckClassId, RemediationItem>,
  now: Date,
): DetectedBottleneck {
  const slaStatuses = evaluateSLAStatuses(items, logs, now);
  let totalBreached = 0;
  const affectedItems: string[] = [];

  for (const sla of slaStatuses) {
    totalBreached += sla.breached;
  }

  // Collect breached item IDs (urgent items that are breaching)
  for (const item of items) {
    if (TERMINAL_TASK_STATUSES.has(item.taskStatus)) continue;
    const elapsed = (now.getTime() - new Date(item.createdAt).getTime()) / MS_PER_HOUR;
    if (item.assigneeId && elapsed > 8) {
      affectedItems.push(item.id);
    }
  }

  const existingRem = activeRem.get("repeated_sla_breach");
  return {
    bottleneckType: "repeated_sla_breach",
    severity: totalBreached >= 5 ? "critical" : totalBreached >= 3 ? "high" : "low",
    affectedItemIds: affectedItems,
    affectedUserIds: [],
    detail: totalBreached >= 3
      ? `SLA 위반 ${totalBreached}건 탐지`
      : "SLA 위반 임계값 미달",
    metric: "sla_breach_count",
    metricValue: totalBreached,
    remediationRequired: totalBreached >= 3,
    existingRemediationId: existingRem?.remediationId ?? null,
  };
}

function detectRepeatedCarryOver(
  items: WorkQueueItem[],
  activeRem: Map<BottleneckClassId, RemediationItem>,
  now: Date,
): DetectedBottleneck {
  const affected: string[] = [];

  for (const item of items) {
    if (TERMINAL_TASK_STATUSES.has(item.taskStatus)) continue;
    const carryOver = computeCarryOver(item, now);
    if (carryOver && carryOver.dayCount >= 3) {
      affected.push(item.id);
    }
  }

  const existingRem = activeRem.get("repeated_carry_over");
  return {
    bottleneckType: "repeated_carry_over",
    severity: affected.length >= 3 ? "critical" : affected.length >= 1 ? "high" : "low",
    affectedItemIds: affected,
    affectedUserIds: [],
    detail: affected.length > 0
      ? `${affected.length}건 항목 3일 이상 연속 이월`
      : "반복 이월 없음",
    metric: "carry_over_3d_count",
    metricValue: affected.length,
    remediationRequired: affected.length >= 1,
    existingRemediationId: existingRem?.remediationId ?? null,
  };
}

function detectRepeatedReassignment(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  activeRem: Map<BottleneckClassId, RemediationItem>,
): DetectedBottleneck {
  const reassignCounts = new Map<string, number>();
  for (const log of logs) {
    if (!log.entityId) continue;
    if (log.activityType === "ITEM_REASSIGNED" || log.activityType === "ITEM_ASSIGNED") {
      reassignCounts.set(log.entityId, (reassignCounts.get(log.entityId) ?? 0) + 1);
    }
  }

  const affected: string[] = [];
  const affectedUsers = new Set<string>();
  for (const item of items) {
    if (TERMINAL_TASK_STATUSES.has(item.taskStatus)) continue;
    const count = reassignCounts.get(item.id) ?? 0;
    if (count >= 5) {
      affected.push(item.id);
      if (item.assigneeId) affectedUsers.add(item.assigneeId);
    }
  }

  const existingRem = activeRem.get("repeated_reassignment_hotspot");
  return {
    bottleneckType: "repeated_reassignment_hotspot",
    severity: affected.length >= 3 ? "critical" : affected.length >= 1 ? "high" : "low",
    affectedItemIds: affected,
    affectedUserIds: [...affectedUsers],
    detail: affected.length > 0
      ? `${affected.length}건 항목 5회 이상 재배정`
      : "반복 재배정 핫스팟 없음",
    metric: "reassignment_5plus_count",
    metricValue: affected.length,
    remediationRequired: affected.length >= 1,
    existingRemediationId: existingRem?.remediationId ?? null,
  };
}

function detectBlockedWorkHotspot(
  items: WorkQueueItem[],
  activeRem: Map<BottleneckClassId, RemediationItem>,
  now: Date,
): DetectedBottleneck {
  const blockedLong: string[] = [];
  const blockedByType = new Map<string, number>();

  for (const item of items) {
    if (TERMINAL_TASK_STATUSES.has(item.taskStatus)) continue;
    const state = resolveAssignmentState({
      assigneeId: item.assigneeId ?? null,
      metadata: item.metadata ?? {},
      taskStatus: item.taskStatus,
    });
    if (state !== "blocked") continue;

    const metadata = item.metadata as Record<string, unknown>;
    const blockedAt = metadata?.blockedAt
      ? new Date(metadata.blockedAt as string)
      : new Date(item.updatedAt);
    const hours = (now.getTime() - blockedAt.getTime()) / MS_PER_HOUR;

    if (hours > 48) {
      blockedLong.push(item.id);
      blockedByType.set(item.type, (blockedByType.get(item.type) ?? 0) + 1);
    }
  }

  // Check if any queue type has 3+ long-blocked items
  let hotspotType: string | null = null;
  for (const [type, count] of blockedByType) {
    if (count >= 3) { hotspotType = type; break; }
  }

  const existingRem = activeRem.get("blocked_work_hotspot");
  return {
    bottleneckType: "blocked_work_hotspot",
    severity: blockedLong.length >= 5 ? "high" : blockedLong.length >= 3 ? "medium" : "low",
    affectedItemIds: blockedLong,
    affectedUserIds: [],
    detail: blockedLong.length >= 3
      ? `${blockedLong.length}건 48시간 이상 차단${hotspotType ? ` (${hotspotType} 집중)` : ""}`
      : "차단 장기화 임계값 미달",
    metric: "blocked_48h_count",
    metricValue: blockedLong.length,
    remediationRequired: blockedLong.length >= 3,
    existingRemediationId: existingRem?.remediationId ?? null,
  };
}

function detectHandoffFailure(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  activeRem: Map<BottleneckClassId, RemediationItem>,
  now: Date,
): DetectedBottleneck {
  const escalations = evaluateEscalations(items, logs, now);
  const handoffEscalations = escalations.filter(
    (e: EscalationResult) => e.ruleId === "handoff_not_picked_up",
  );

  const existingRem = activeRem.get("handoff_failure_hotspot");
  return {
    bottleneckType: "handoff_failure_hotspot",
    severity: handoffEscalations.length >= 5 ? "high" : handoffEscalations.length >= 3 ? "medium" : "low",
    affectedItemIds: handoffEscalations.map((e: EscalationResult) => e.itemId),
    affectedUserIds: [],
    detail: handoffEscalations.length >= 3
      ? `미인수 인수인계 ${handoffEscalations.length}건`
      : "인수인계 실패 임계값 미달",
    metric: "handoff_failure_count",
    metricValue: handoffEscalations.length,
    remediationRequired: false,
    existingRemediationId: existingRem?.remediationId ?? null,
  };
}

function detectOwnerLatency(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  activeRem: Map<BottleneckClassId, RemediationItem>,
  now: Date,
): DetectedBottleneck {
  const metrics = computeAccountabilityMetrics(items, logs, now);
  const avgLatency = metrics.avgFirstActionLatencyHours ?? 0;

  const existingRem = activeRem.get("owner_role_latency_hotspot");
  return {
    bottleneckType: "owner_role_latency_hotspot",
    severity: avgLatency > 12 ? "high" : avgLatency > 8 ? "medium" : "low",
    affectedItemIds: [],
    affectedUserIds: [],
    detail: avgLatency > 8
      ? `평균 최초 조치 지연 ${avgLatency.toFixed(1)}시간`
      : "지연 임계값 미달",
    metric: "avg_first_action_latency_hours",
    metricValue: avgLatency,
    remediationRequired: false,
    existingRemediationId: existingRem?.remediationId ?? null,
  };
}

function detectQueueThroughput(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  activeRem: Map<BottleneckClassId, RemediationItem>,
  now: Date,
): DetectedBottleneck {
  // Calculate throughput per queue type
  const sevenDaysAgo = now.getTime() - 7 * MS_PER_DAY;
  const byType = new Map<string, { total: number; completed: number }>();

  for (const item of items) {
    const created = new Date(item.createdAt).getTime();
    if (created < sevenDaysAgo) continue;

    const entry = byType.get(item.type) ?? { total: 0, completed: 0 };
    entry.total++;
    if (TERMINAL_TASK_STATUSES.has(item.taskStatus)) entry.completed++;
    byType.set(item.type, entry);
  }

  let worstType: string | null = null;
  let worstRate = 1;
  for (const [type, stats] of byType) {
    if (stats.total < 3) continue; // skip small samples
    const rate = stats.completed / stats.total;
    if (rate < worstRate) {
      worstRate = rate;
      worstType = type;
    }
  }

  const existingRem = activeRem.get("queue_type_throughput_hotspot");
  return {
    bottleneckType: "queue_type_throughput_hotspot",
    severity: worstRate < 0.3 ? "high" : worstRate < 0.5 ? "medium" : "low",
    affectedItemIds: [],
    affectedUserIds: [],
    detail: worstType && worstRate < 0.5
      ? `${worstType} 완료율 ${Math.round(worstRate * 100)}%`
      : "처리량 임계값 미달",
    metric: "worst_queue_completion_rate",
    metricValue: Math.round(worstRate * 100),
    remediationRequired: false,
    existingRemediationId: existingRem?.remediationId ?? null,
  };
}

// ══════════════════════════════════════════════════════
// §2 Pure Function: Remediation Status Transitions
// ══════════════════════════════════════════════════════

/**
 * 개선 항목 상태 전이 유효성 검사
 */
export function canTransitionRemediation(
  from: RemediationStatus,
  to: RemediationStatus,
): boolean {
  return REMEDIATION_TRANSITIONS[from].includes(to);
}

/**
 * 개선 항목 상태 전이 적용
 */
export function applyRemediationTransition(
  remediation: RemediationItem,
  newStatus: RemediationStatus,
  params: {
    actorUserId: string;
    note?: string;
    now?: Date;
  },
): {
  updatedRemediation: RemediationItem;
  logEvent: string;
  logMetadata: Record<string, unknown>;
} {
  if (!canTransitionRemediation(remediation.status, newStatus)) {
    throw new Error(
      `Invalid transition: ${remediation.status} → ${newStatus}`,
    );
  }

  const _now = params.now ?? new Date();

  const updated: RemediationItem = {
    ...remediation,
    status: newStatus,
    resolutionNote: newStatus === "resolved"
      ? (params.note ?? remediation.resolutionNote)
      : remediation.resolutionNote,
  };

  return {
    updatedRemediation: updated,
    logEvent: "REMEDIATION_STATUS_CHANGED",
    logMetadata: {
      remediationId: remediation.remediationId,
      fromStatus: remediation.status,
      toStatus: newStatus,
      actor: params.actorUserId,
      note: params.note ?? "",
      changedAt: _now.toISOString(),
    },
  };
}

/**
 * 새 개선 항목 생성 (순수 함수)
 */
export function buildRemediationItem(params: {
  remediationId: string;
  bottleneck: DetectedBottleneck;
  owner: string;
  summary: string;
  reviewContext: string;
  linkedQueueFamily?: string | null;
  linkedEntityType?: string | null;
  now?: Date;
  dueDays?: number;
}): RemediationItem {
  const _now = params.now ?? new Date();
  const dueDays = params.dueDays ?? 7;
  const dueAt = new Date(_now.getTime() + dueDays * MS_PER_DAY);

  return {
    remediationId: params.remediationId,
    bottleneckType: params.bottleneck.bottleneckType,
    sourceMetric: params.bottleneck.metric,
    sourceRule: BOTTLENECK_CLASS_DEFS[params.bottleneck.bottleneckType].detectionRule,
    severity: params.bottleneck.severity,
    summary: params.summary,
    owner: params.owner,
    createdAt: _now.toISOString(),
    dueAt: dueAt.toISOString(),
    status: "open",
    linkedQueueFamily: params.linkedQueueFamily ?? null,
    linkedEntityType: params.linkedEntityType ?? null,
    reviewContext: params.reviewContext,
    resolutionNote: null,
    affectedItemIds: params.bottleneck.affectedItemIds,
    affectedUserIds: params.bottleneck.affectedUserIds,
  };
}

// ══════════════════════════════════════════════════════
// §3 Pure Function: Weekly Bottleneck Review
// ══════════════════════════════════════════════════════

/**
 * 주간 병목 검토 결과를 빌드합니다.
 */
export function buildWeeklyReviewOutcome(params: {
  bottlenecks: DetectedBottleneck[];
  remediations: RemediationItem[];
  createdRemediationIds: string[];
  resolvedRemediationIds: string[];
  deferredRemediationIds: string[];
  reviewedBy: string;
  now?: Date;
}): WeeklyReviewOutcome {
  const _now = params.now ?? new Date();

  // Hotspots with remediationRequired but no active remediation
  const recurringWithout = params.bottlenecks.filter(
    (b) =>
      b.remediationRequired
      && b.metricValue > 0
      && !b.existingRemediationId
      && !params.createdRemediationIds.some((id) =>
        params.remediations.some(
          (r) => r.remediationId === id && r.bottleneckType === b.bottleneckType,
        ),
      ),
  );

  return {
    reviewDate: _now.toISOString().slice(0, 10),
    reviewedBy: params.reviewedBy,
    bottlenecksDetected: params.bottlenecks.filter(
      (b) => b.metricValue > 0 && b.severity !== "low",
    ),
    remediationsCreated: params.createdRemediationIds,
    remediationsResolved: params.resolvedRemediationIds,
    remediationsDeferred: params.deferredRemediationIds,
    recurringWithoutRemediation: recurringWithout,
    summary: buildReviewSummary(params.bottlenecks, params.createdRemediationIds, params.resolvedRemediationIds),
  };
}

function buildReviewSummary(
  bottlenecks: DetectedBottleneck[],
  created: string[],
  resolved: string[],
): string {
  const active = bottlenecks.filter((b) => b.metricValue > 0 && b.severity !== "low");
  return `병목 ${active.length}건 탐지, 개선 ${created.length}건 생성, ${resolved.length}건 해결`;
}

// ══════════════════════════════════════════════════════
// §5 Pure Function: Remediation Console View
// ══════════════════════════════════════════════════════

/**
 * 콘솔에 표시할 개선 항목 가시화 데이터를 빌드합니다.
 */
export function buildRemediationConsoleView(
  remediations: RemediationItem[],
  bottlenecks: DetectedBottleneck[],
  now?: Date,
): RemediationConsoleView {
  const _now = now ?? new Date();
  const threeDaysFromNow = _now.getTime() + 3 * MS_PER_DAY;

  const active = remediations.filter((r) => !REMEDIATION_STATUS_DEFS[r.status].isTerminal);
  const resolved = remediations.filter((r) => r.status === "resolved");

  // Recent resolved = resolved in last 7 days
  const sevenDaysAgo = _now.getTime() - 7 * MS_PER_DAY;
  const recentlyResolved = resolved.filter((r) => {
    // Use updatedAt approximation — resolutionNote presence indicates recent resolution
    return new Date(r.createdAt).getTime() >= sevenDaysAgo;
  });

  const highSev = active.filter(
    (r) => r.severity === "critical" || r.severity === "high",
  );

  const dueSoon = active.filter((r) => {
    const due = new Date(r.dueAt).getTime();
    return due <= threeDaysFromNow && due > _now.getTime();
  });

  const overdue = active.filter((r) => {
    return new Date(r.dueAt).getTime() <= _now.getTime();
  });

  // Link to current hotspots
  const activeBottleneckTypes = new Set(
    bottlenecks
      .filter((b) => b.metricValue > 0 && b.severity !== "low")
      .map((b) => b.bottleneckType),
  );
  const linkedToHotspots = active.filter((r) =>
    activeBottleneckTypes.has(r.bottleneckType),
  );

  return {
    openCount: active.length,
    highSeverityCount: highSev.length,
    dueSoonCount: dueSoon.length,
    overdueCount: overdue.length,
    linkedToCurrentHotspots: linkedToHotspots,
    recentlyResolved,
  };
}

// ══════════════════════════════════════════════════════
// §6 Pure Function: Close-the-Loop Reporting
// ══════════════════════════════════════════════════════

/**
 * 개선 루프 보고 신호를 계산합니다.
 */
export function computeRemediationReportSignals(
  bottlenecks: DetectedBottleneck[],
  remediations: RemediationItem[],
  now?: Date,
): RemediationReportSignals {
  const _now = now ?? new Date();

  // Recurring hotspot = severity > low and metricValue > 0
  const recurringHotspots = bottlenecks.filter(
    (b) => b.metricValue > 0 && b.severity !== "low",
  );

  const active = remediations.filter((r) => !REMEDIATION_STATUS_DEFS[r.status].isTerminal);
  const resolved = remediations.filter((r) => r.status === "resolved");

  // Average age of active remediations
  let totalAgeDays = 0;
  for (const r of active) {
    totalAgeDays += (_now.getTime() - new Date(r.createdAt).getTime()) / MS_PER_DAY;
  }
  const avgAge = active.length > 0 ? totalAgeDays / active.length : 0;

  // Hotspot without any remediation (active or resolved)
  const remByType = new Set(remediations.map((r) => r.bottleneckType));
  const withoutRemediation = recurringHotspots.filter(
    (b) => b.remediationRequired && !b.existingRemediationId && !remByType.has(b.bottleneckType),
  );

  // Recurrence after remediation = resolved remediation but bottleneck still active
  const resolvedTypes = new Set(resolved.map((r) => r.bottleneckType));
  const recurrence = recurringHotspots.filter(
    (b) => resolvedTypes.has(b.bottleneckType),
  );

  return {
    recurringHotspotCount: recurringHotspots.length,
    remediationOpenedCount: active.length,
    remediationResolvedCount: resolved.length,
    averageRemediationAgeDays: Math.round(avgAge * 10) / 10,
    hotspotWithoutRemediationCount: withoutRemediation.length,
    hotspotRecurrenceAfterRemediationCount: recurrence.length,
  };
}
