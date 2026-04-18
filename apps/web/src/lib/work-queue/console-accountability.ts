/**
 * Console Accountability — 운영자 책임성 메트릭 & 에스컬레이션
 *
 * 배정 소유권을 측정 가능한 운영 책임으로 전환합니다.
 * 8개 정규 메트릭, 5개 에스컬레이션 규칙, 5개 개인 워크로드 뷰,
 * 배정 감사 추적 기능을 정의합니다.
 *
 * 순수 정의 파일 — DB 호출 없음.
 */

import type { WorkQueueItem } from "./work-queue-service";
import {
  resolveAssignmentState,
  extractHandoffInfo,
  type AssignmentState,
} from "./console-assignment";
import { computeFinalTier, type PriorityTier } from "./console-priorities";

// ── Activity Log Entry (minimal shape for pure functions) ──

export interface ActivityLogEntry {
  id: string;
  activityType: string;
  entityId: string | null;
  userId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date | string;
}

// ── Accountability Metric Types ──

export type AccountabilityMetricId =
  | "unassigned_count"
  | "assigned_untouched_count"
  | "blocked_aging_count"
  | "handoff_not_accepted_count"
  | "avg_first_action_latency_hours"
  | "reassignment_count"
  | "resolution_throughput"
  | "overdue_owned_count";

export interface AccountabilityMetricDef {
  id: AccountabilityMetricId;
  label: string;
  description: string;
  inclusionCriteria: string;
  exclusionCriteria: string;
  timeWindow: string;
  sourceOfTruth: string;
  whereShown: string;
}

export interface AccountabilityMetrics {
  unassignedCount: number;
  assignedUntouchedCount: number;
  blockedAgingCount: number;
  handoffNotAcceptedCount: number;
  avgFirstActionLatencyHours: number | null;
  reassignmentCount: number;
  resolutionThroughputByOwner: Record<string, number>;
  overdueOwnedCount: number;
}

// ── Escalation Types ──

export type EscalationRuleId =
  | "assigned_no_first_action"
  | "handoff_not_picked_up"
  | "blocked_too_long"
  | "repeatedly_reassigned"
  | "overdue_urgent_same_owner";

export interface EscalationRuleDef {
  id: EscalationRuleId;
  label: string;
  thresholdHours: number;
  severity: "warning" | "critical";
  priorityBoost: number;
  uiImplication: string;
  reportingImplication: string;
}

export interface EscalationResult {
  ruleId: EscalationRuleId;
  severity: "warning" | "critical";
  priorityBoost: number;
  itemId: string;
  message: string;
}

// ── Personal Workload View Types ──

export type PersonalWorkloadViewId =
  | "my_urgent"
  | "assigned_to_me"
  | "waiting_on_others"
  | "handed_off_to_me"
  | "team_overflow";

export interface PersonalWorkloadViewDef {
  id: PersonalWorkloadViewId;
  label: string;
  description: string;
  sortOrder: number;
  primaryAction: string;
  whyHere: string;
  whatResolvesIt: string;
}

// ── Audit Trail Types ──

export interface AssignmentAuditTrail {
  claimedBy: string | null;
  claimedAt: string | null;
  reassignedBy: string | null;
  reassignmentCount: number;
  handedOffBy: string | null;
  firstActionBy: string | null;
  firstActionAt: string | null;
  untouchedHours: number | null;
  blockedReason: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

// ── Owner Report Types ──

export interface OwnerReport {
  ownerId: string;
  ownedUrgentCount: number;
  overdueOwnedCount: number;
  blockedOwnedCount: number;
  avgFirstActionLatencyHours: number | null;
  reassignmentHotspotCount: number;
  pendingHandoffCount: number;
}

// ── Constants ──

const TERMINAL_TASK_STATUSES = new Set(["COMPLETED", "FAILED"]);
const MS_PER_HOUR = 60 * 60 * 1000;

const ASSIGNMENT_LOG_TYPES = new Set([
  "ITEM_CLAIMED",
  "ITEM_ASSIGNED",
  "ITEM_REASSIGNED",
  "ITEM_STARTED",
  "ITEM_BLOCKED",
  "ITEM_HANDED_OFF",
]);

const FIRST_ACTION_TYPES = new Set(["ITEM_STARTED", "ITEM_BLOCKED", "ITEM_HANDED_OFF"]);
const CLAIM_TYPES = new Set(["ITEM_CLAIMED", "ITEM_ASSIGNED"]);

// ── Canonical Metric Definitions ──

export const ACCOUNTABILITY_METRIC_DEFS: Record<AccountabilityMetricId, AccountabilityMetricDef> = {
  unassigned_count: {
    id: "unassigned_count",
    label: "미배정 항목",
    description: "담당자가 없는 활성 항목 수",
    inclusionCriteria: "assigneeId === null AND 활성 상태",
    exclusionCriteria: "COMPLETED, FAILED 상태 제외",
    timeWindow: "현재 스냅샷",
    sourceOfTruth: "AiActionItem.assigneeId",
    whereShown: "콘솔 요약, 팀 오버플로 뷰",
  },
  assigned_untouched_count: {
    id: "assigned_untouched_count",
    label: "미착수 배정",
    description: "배정 후 첫 조치가 없는 항목 수",
    inclusionCriteria: "assigned 상태 AND ITEM_STARTED 로그 없음",
    exclusionCriteria: "터미널 상태, unassigned 제외",
    timeWindow: "배정 이후 전체",
    sourceOfTruth: "assignmentState + ActivityLog",
    whereShown: "콘솔 요약, 에스컬레이션 표시",
  },
  blocked_aging_count: {
    id: "blocked_aging_count",
    label: "장기 차단",
    description: "48시간 이상 차단된 항목 수",
    inclusionCriteria: "blocked 상태 AND 48h 초과",
    exclusionCriteria: "터미널 상태 제외",
    timeWindow: "차단 시점 기준 48h",
    sourceOfTruth: "assignmentState + ITEM_BLOCKED 로그 시각",
    whereShown: "콘솔 요약, 팀 긴급 뷰",
  },
  handoff_not_accepted_count: {
    id: "handoff_not_accepted_count",
    label: "미인수 인수인계",
    description: "12시간 이상 인수되지 않은 인수인계 항목 수",
    inclusionCriteria: "handed_off 상태 AND handoff.at 12h 초과",
    exclusionCriteria: "터미널 상태 제외",
    timeWindow: "인수인계 시점 기준 12h",
    sourceOfTruth: "assignmentState + payload.handoff.at",
    whereShown: "콘솔 요약, 에스컬레이션 표시",
  },
  avg_first_action_latency_hours: {
    id: "avg_first_action_latency_hours",
    label: "평균 첫 조치 소요",
    description: "배정~첫 조치(ITEM_STARTED)까지 평균 시간",
    inclusionCriteria: "ITEM_CLAIMED/ASSIGNED 후 ITEM_STARTED가 있는 항목",
    exclusionCriteria: "첫 조치 기록 없는 항목 제외",
    timeWindow: "최근 30일",
    sourceOfTruth: "ActivityLog 시각 차이",
    whereShown: "운영자 리포트",
  },
  reassignment_count: {
    id: "reassignment_count",
    label: "재배정 횟수",
    description: "ITEM_REASSIGNED 이벤트 총 횟수",
    inclusionCriteria: "ITEM_REASSIGNED 활동 로그",
    exclusionCriteria: "없음",
    timeWindow: "최근 30일",
    sourceOfTruth: "ActivityLog",
    whereShown: "운영자 리포트, 재배정 핫스팟",
  },
  resolution_throughput: {
    id: "resolution_throughput",
    label: "해결 처리량",
    description: "운영자별 완료 항목 수",
    inclusionCriteria: "COMPLETED 상태 항목",
    exclusionCriteria: "FAILED 제외",
    timeWindow: "최근 30일",
    sourceOfTruth: "AiActionItem.resolvedBy + completedAt",
    whereShown: "운영자 리포트",
  },
  overdue_owned_count: {
    id: "overdue_owned_count",
    label: "초과 소유 항목",
    description: "urgent_blocker 티어인 배정 항목 수",
    inclusionCriteria: "assigneeId 있음 AND urgent_blocker 티어",
    exclusionCriteria: "터미널 상태 제외",
    timeWindow: "현재 스냅샷",
    sourceOfTruth: "assigneeId + computeFinalTier",
    whereShown: "콘솔 요약, 개인 긴급 뷰",
  },
};

// ── Escalation Rule Definitions ──

export const ESCALATION_RULE_DEFS: Record<EscalationRuleId, EscalationRuleDef> = {
  assigned_no_first_action: {
    id: "assigned_no_first_action",
    label: "미착수 배정",
    thresholdHours: 24,
    severity: "warning",
    priorityBoost: 5,
    uiImplication: "경고 뱃지 표시, 배정 상태 옆에 시간 경과 표시",
    reportingImplication: "미착수 배정 카운트에 포함",
  },
  handoff_not_picked_up: {
    id: "handoff_not_picked_up",
    label: "미인수 인수인계",
    thresholdHours: 12,
    severity: "warning",
    priorityBoost: 8,
    uiImplication: "인수인계 카드에 경고 뱃지, 인수 촉구 표시",
    reportingImplication: "미인수 인수인계 카운트에 포함",
  },
  blocked_too_long: {
    id: "blocked_too_long",
    label: "장기 차단",
    thresholdHours: 48,
    severity: "critical",
    priorityBoost: 10,
    uiImplication: "긴급 그룹에 승격, 빨간 차단 뱃지",
    reportingImplication: "장기 차단 카운트에 포함, 팀 긴급으로 분류",
  },
  repeatedly_reassigned: {
    id: "repeatedly_reassigned",
    label: "반복 재배정",
    thresholdHours: 3, // overloaded: count threshold, not hours
    severity: "warning",
    priorityBoost: 5,
    uiImplication: "재배정 핫스팟 표시, 안정적 담당자 배정 촉구",
    reportingImplication: "재배정 핫스팟 카운트에 포함",
  },
  overdue_urgent_same_owner: {
    id: "overdue_urgent_same_owner",
    label: "긴급 초과 동일 담당자",
    thresholdHours: 24,
    severity: "critical",
    priorityBoost: 15,
    uiImplication: "최고 우선순위 승격, 즉시 조치 경고",
    reportingImplication: "초과 소유 카운트에 포함, 리드에게 가시화",
  },
};

// ── Personal Workload View Definitions ──

export const PERSONAL_WORKLOAD_VIEW_DEFS: Record<PersonalWorkloadViewId, PersonalWorkloadViewDef> = {
  my_urgent: {
    id: "my_urgent",
    label: "내 긴급",
    description: "즉시 조치가 필요한 내 항목",
    sortOrder: 0,
    primaryAction: "즉시 처리 또는 에스컬레이션",
    whyHere: "긴급 티어이거나 에스컬레이션 발생",
    whatResolvesIt: "항목 처리, 인수인계, 또는 차단 해제",
  },
  assigned_to_me: {
    id: "assigned_to_me",
    label: "내 배정",
    description: "나에게 배정된 활성 항목",
    sortOrder: 1,
    primaryAction: "진행 시작 또는 상태 업데이트",
    whyHere: "담당자로 배정됨",
    whatResolvesIt: "작업 완료 또는 인수인계",
  },
  waiting_on_others: {
    id: "waiting_on_others",
    label: "대기 중",
    description: "내가 인수인계한 항목 (상대 인수 대기)",
    sortOrder: 2,
    primaryAction: "인수 상태 확인, 필요시 리마인드",
    whyHere: "내가 인수인계했으나 아직 인수되지 않음",
    whatResolvesIt: "상대방이 인수(claim)",
  },
  handed_off_to_me: {
    id: "handed_off_to_me",
    label: "인수 요청",
    description: "다른 담당자가 나에게 인수인계한 항목",
    sortOrder: 3,
    primaryAction: "인수(claim) 또는 재배정",
    whyHere: "handoff.toUserId가 나",
    whatResolvesIt: "담당 인수 또는 다른 사람에게 재배정",
  },
  team_overflow: {
    id: "team_overflow",
    label: "팀 미배정",
    description: "담당자 없는 긴급/조치필요 항목",
    sortOrder: 4,
    primaryAction: "담당(claim) 또는 배정(assign)",
    whyHere: "미배정 AND 긴급 또는 조치필요 티어",
    whatResolvesIt: "누군가 담당 또는 배정",
  },
};

export const PERSONAL_WORKLOAD_VIEW_LABELS: Record<PersonalWorkloadViewId, string> = {
  my_urgent: "내 긴급",
  assigned_to_me: "내 배정",
  waiting_on_others: "대기 중",
  handed_off_to_me: "인수 요청",
  team_overflow: "팀 미배정",
};

// ── Helper: resolve item shape for assignment functions ──

function toAssignmentItem(item: WorkQueueItem) {
  return {
    assigneeId: item.assigneeId ?? null,
    metadata: item.metadata ?? {},
    taskStatus: item.taskStatus,
  };
}

function isActive(item: WorkQueueItem): boolean {
  return !TERMINAL_TASK_STATUSES.has(item.taskStatus);
}

function toMs(d: Date | string): number {
  return typeof d === "string" ? new Date(d).getTime() : d.getTime();
}

function hoursSince(from: Date | string, now: Date): number {
  return (now.getTime() - toMs(from)) / MS_PER_HOUR;
}

// ── Metric Computation ──

/**
 * 전체 책임성 메트릭을 계산합니다.
 */
export function computeAccountabilityMetrics(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  now?: Date,
): AccountabilityMetrics {
  const _now = now ?? new Date();
  const activeItems = items.filter(isActive);

  return {
    unassignedCount: countUnassigned(activeItems),
    assignedUntouchedCount: countAssignedUntouched(activeItems, logs, _now),
    blockedAgingCount: countBlockedAging(activeItems, logs, _now),
    handoffNotAcceptedCount: countHandoffNotAccepted(activeItems, _now),
    avgFirstActionLatencyHours: computeAvgFirstActionLatency(logs),
    reassignmentCount: countReassignments(logs),
    resolutionThroughputByOwner: computeResolutionThroughput(items),
    overdueOwnedCount: countOverdueOwned(activeItems),
  };
}

function countUnassigned(items: WorkQueueItem[]): number {
  return items.filter((i) => !i.assigneeId).length;
}

function countAssignedUntouched(items: WorkQueueItem[], logs: ActivityLogEntry[], now: Date): number {
  // Items in "assigned" state that have no ITEM_STARTED log
  const startedEntityIds = new Set(
    logs.filter((l) => FIRST_ACTION_TYPES.has(l.activityType)).map((l) => l.entityId)
  );

  return items.filter((item) => {
    const state = resolveAssignmentState(toAssignmentItem(item));
    return state === "assigned" && !startedEntityIds.has(item.id);
  }).length;
}

function countBlockedAging(items: WorkQueueItem[], logs: ActivityLogEntry[], now: Date): number {
  const blockedThresholdHours = ESCALATION_RULE_DEFS.blocked_too_long.thresholdHours;

  return items.filter((item) => {
    const state = resolveAssignmentState(toAssignmentItem(item));
    if (state !== "blocked") return false;

    // Find when the item was blocked
    const blockedLog = logs
      .filter((l) => l.activityType === "ITEM_BLOCKED" && l.entityId === item.id)
      .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))[0];

    if (blockedLog) {
      return hoursSince(blockedLog.createdAt, now) >= blockedThresholdHours;
    }

    // Fallback: use updatedAt
    return hoursSince(item.updatedAt, now) >= blockedThresholdHours;
  }).length;
}

function countHandoffNotAccepted(items: WorkQueueItem[], now: Date): number {
  const thresholdHours = ESCALATION_RULE_DEFS.handoff_not_picked_up.thresholdHours;

  return items.filter((item) => {
    const state = resolveAssignmentState(toAssignmentItem(item));
    if (state !== "handed_off") return false;

    const handoff = extractHandoffInfo(item.metadata ?? {});
    if (!handoff) return false;

    return hoursSince(handoff.at, now) >= thresholdHours;
  }).length;
}

function computeAvgFirstActionLatency(logs: ActivityLogEntry[]): number | null {
  // Group logs by entityId
  const byEntity = new Map<string, ActivityLogEntry[]>();
  for (const log of logs) {
    if (!log.entityId) continue;
    if (!ASSIGNMENT_LOG_TYPES.has(log.activityType)) continue;
    const arr = byEntity.get(log.entityId) ?? [];
    arr.push(log);
    byEntity.set(log.entityId, arr);
  }

  const latencies: number[] = [];

  for (const [, entityLogs] of byEntity) {
    const sorted = entityLogs.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));

    // Find first claim/assign event
    const claimEvent = sorted.find((l) => CLAIM_TYPES.has(l.activityType));
    if (!claimEvent) continue;

    // Find first action after claim
    const firstAction = sorted.find(
      (l) => FIRST_ACTION_TYPES.has(l.activityType) && toMs(l.createdAt) >= toMs(claimEvent.createdAt)
    );
    if (!firstAction) continue;

    const deltaHours = (toMs(firstAction.createdAt) - toMs(claimEvent.createdAt)) / MS_PER_HOUR;
    latencies.push(deltaHours);
  }

  if (latencies.length === 0) return null;
  return Math.round((latencies.reduce((s, v) => s + v, 0) / latencies.length) * 10) / 10;
}

function countReassignments(logs: ActivityLogEntry[]): number {
  return logs.filter((l) => l.activityType === "ITEM_REASSIGNED").length;
}

function computeResolutionThroughput(items: WorkQueueItem[]): Record<string, number> {
  const byOwner: Record<string, number> = {};

  for (const item of items) {
    if (item.taskStatus !== "COMPLETED") continue;
    const resolvedBy = (item.metadata as Record<string, unknown>)?.resolvedBy as string | undefined;
    const owner = resolvedBy ?? item.assigneeId;
    if (!owner) continue;
    byOwner[owner] = (byOwner[owner] ?? 0) + 1;
  }

  return byOwner;
}

function countOverdueOwned(items: WorkQueueItem[]): number {
  return items.filter((item) => {
    if (!item.assigneeId) return false;
    const tier = computeFinalTier(item);
    return tier === "urgent_blocker";
  }).length;
}

// ── Escalation Evaluation ──

/**
 * 활성 항목에 대해 에스컬레이션 규칙을 평가합니다.
 */
export function evaluateEscalations(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  now?: Date,
): EscalationResult[] {
  const _now = now ?? new Date();
  const results: EscalationResult[] = [];
  const activeItems = items.filter(isActive);

  // Index logs by entityId for fast lookup
  const logsByEntity = new Map<string, ActivityLogEntry[]>();
  for (const log of logs) {
    if (!log.entityId) continue;
    const arr = logsByEntity.get(log.entityId) ?? [];
    arr.push(log);
    logsByEntity.set(log.entityId, arr);
  }

  for (const item of activeItems) {
    const state = resolveAssignmentState(toAssignmentItem(item));
    const entityLogs = logsByEntity.get(item.id) ?? [];

    // Rule 1: assigned_no_first_action
    if (state === "assigned" && item.assigneeId) {
      const hasFirstAction = entityLogs.some((l) => FIRST_ACTION_TYPES.has(l.activityType));
      if (!hasFirstAction) {
        const claimLog = entityLogs
          .filter((l) => CLAIM_TYPES.has(l.activityType))
          .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))[0];

        const assignedSince = claimLog ? claimLog.createdAt : item.updatedAt;
        const hours = hoursSince(assignedSince, _now);

        if (hours >= ESCALATION_RULE_DEFS.assigned_no_first_action.thresholdHours) {
          results.push({
            ruleId: "assigned_no_first_action",
            severity: "warning",
            priorityBoost: ESCALATION_RULE_DEFS.assigned_no_first_action.priorityBoost,
            itemId: item.id,
            message: `배정 후 ${Math.round(hours)}시간 미착수`,
          });
        }
      }
    }

    // Rule 2: handoff_not_picked_up
    if (state === "handed_off") {
      const handoff = extractHandoffInfo(item.metadata ?? {});
      if (handoff) {
        const hours = hoursSince(handoff.at, _now);
        if (hours >= ESCALATION_RULE_DEFS.handoff_not_picked_up.thresholdHours) {
          results.push({
            ruleId: "handoff_not_picked_up",
            severity: "warning",
            priorityBoost: ESCALATION_RULE_DEFS.handoff_not_picked_up.priorityBoost,
            itemId: item.id,
            message: `인수인계 후 ${Math.round(hours)}시간 미인수`,
          });
        }
      }
    }

    // Rule 3: blocked_too_long
    if (state === "blocked") {
      const blockedLog = entityLogs
        .filter((l) => l.activityType === "ITEM_BLOCKED")
        .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))[0];

      const blockedSince = blockedLog ? blockedLog.createdAt : item.updatedAt;
      const hours = hoursSince(blockedSince, _now);

      if (hours >= ESCALATION_RULE_DEFS.blocked_too_long.thresholdHours) {
        results.push({
          ruleId: "blocked_too_long",
          severity: "critical",
          priorityBoost: ESCALATION_RULE_DEFS.blocked_too_long.priorityBoost,
          itemId: item.id,
          message: `${Math.round(hours)}시간 차단 지속`,
        });
      }
    }

    // Rule 4: repeatedly_reassigned
    const reassignCount = entityLogs.filter((l) => l.activityType === "ITEM_REASSIGNED").length;
    if (reassignCount >= ESCALATION_RULE_DEFS.repeatedly_reassigned.thresholdHours) {
      results.push({
        ruleId: "repeatedly_reassigned",
        severity: "warning",
        priorityBoost: ESCALATION_RULE_DEFS.repeatedly_reassigned.priorityBoost,
        itemId: item.id,
        message: `${reassignCount}회 재배정됨`,
      });
    }

    // Rule 5: overdue_urgent_same_owner
    if (item.assigneeId) {
      const tier = computeFinalTier(item);
      if (tier === "urgent_blocker") {
        // Check how long it's been urgent and owned by same person
        const hours = hoursSince(item.updatedAt, _now);
        if (hours >= ESCALATION_RULE_DEFS.overdue_urgent_same_owner.thresholdHours) {
          results.push({
            ruleId: "overdue_urgent_same_owner",
            severity: "critical",
            priorityBoost: ESCALATION_RULE_DEFS.overdue_urgent_same_owner.priorityBoost,
            itemId: item.id,
            message: `긴급 항목 ${Math.round(hours)}시간 동일 담당자 보유`,
          });
        }
      }
    }
  }

  return results;
}

/**
 * 특정 아이템에 대한 최대 에스컬레이션 부스트를 반환합니다.
 */
export function getEscalationBoost(
  item: WorkQueueItem,
  escalations: EscalationResult[],
): number {
  let maxBoost = 0;
  for (const esc of escalations) {
    if (esc.itemId === item.id && esc.priorityBoost > maxBoost) {
      maxBoost = esc.priorityBoost;
    }
  }
  return maxBoost;
}

// ── Personal Workload View Filters ──

/**
 * 개인 워크로드 뷰에 따라 아이템을 필터링합니다.
 */
export function filterForPersonalView(
  items: WorkQueueItem[],
  viewId: PersonalWorkloadViewId,
  userId: string,
  escalations?: EscalationResult[],
): WorkQueueItem[] {
  const activeItems = items.filter(isActive);

  switch (viewId) {
    case "my_urgent": {
      const escItemIds = new Set((escalations ?? []).map((e) => e.itemId));
      return activeItems.filter((item) => {
        if (item.assigneeId !== userId) return false;
        const tier = computeFinalTier(item);
        return tier === "urgent_blocker" || escItemIds.has(item.id);
      });
    }

    case "assigned_to_me": {
      const escItemIds = new Set((escalations ?? []).map((e) => e.itemId));
      return activeItems.filter((item) => {
        if (item.assigneeId !== userId) return false;
        const tier = computeFinalTier(item);
        // Exclude urgent (those go to my_urgent)
        return tier !== "urgent_blocker" && !escItemIds.has(item.id);
      });
    }

    case "waiting_on_others": {
      return activeItems.filter((item) => {
        const state = resolveAssignmentState(toAssignmentItem(item));
        if (state !== "handed_off") return false;
        const handoff = extractHandoffInfo(item.metadata ?? {});
        return handoff?.fromUserId === userId;
      });
    }

    case "handed_off_to_me": {
      return activeItems.filter((item) => {
        const state = resolveAssignmentState(toAssignmentItem(item));
        if (state !== "handed_off") return false;
        const handoff = extractHandoffInfo(item.metadata ?? {});
        return handoff?.toUserId === userId;
      });
    }

    case "team_overflow": {
      return activeItems.filter((item) => {
        if (item.assigneeId) return false;
        const tier = computeFinalTier(item);
        return tier === "urgent_blocker" || tier === "action_needed";
      });
    }

    default:
      return activeItems;
  }
}

// ── Owner Report ──

/**
 * 특정 운영자의 워크로드 리포트를 생성합니다.
 */
export function computeOwnerReport(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  ownerId: string,
  now?: Date,
): OwnerReport {
  const _now = now ?? new Date();
  const activeItems = items.filter(isActive);
  const ownedItems = activeItems.filter((i) => i.assigneeId === ownerId);

  const ownedUrgentCount = ownedItems.filter((i) => computeFinalTier(i) === "urgent_blocker").length;

  const overdueOwnedCount = ownedItems.filter((i) => {
    const tier = computeFinalTier(i);
    return tier === "urgent_blocker" && hoursSince(i.updatedAt, _now) >= 24;
  }).length;

  const blockedOwnedCount = ownedItems.filter((i) => {
    return resolveAssignmentState(toAssignmentItem(i)) === "blocked";
  }).length;

  // First-action latency for this owner
  const ownerLogs = logs.filter((l) => l.userId === ownerId);
  const avgFirstActionLatencyHours = computeAvgFirstActionLatency(ownerLogs);

  // Reassignment hotspot: items this owner has been involved in reassignment
  const reassignmentHotspotCount = logs.filter(
    (l) => l.activityType === "ITEM_REASSIGNED" &&
    ((l.metadata?.assigneeId_before === ownerId) || (l.metadata?.assigneeId_after === ownerId))
  ).length;

  // Pending handoffs to this owner
  const pendingHandoffCount = activeItems.filter((i) => {
    const state = resolveAssignmentState(toAssignmentItem(i));
    if (state !== "handed_off") return false;
    const handoff = extractHandoffInfo(i.metadata ?? {});
    return handoff?.toUserId === ownerId;
  }).length;

  return {
    ownerId,
    ownedUrgentCount,
    overdueOwnedCount,
    blockedOwnedCount,
    avgFirstActionLatencyHours,
    reassignmentHotspotCount,
    pendingHandoffCount,
  };
}

// ── Audit Trail ──

/**
 * 특정 아이템의 배정 감사 추적을 구성합니다.
 */
export function buildAssignmentAuditTrail(
  itemId: string,
  logs: ActivityLogEntry[],
): AssignmentAuditTrail {
  const itemLogs = logs
    .filter((l) => l.entityId === itemId && ASSIGNMENT_LOG_TYPES.has(l.activityType))
    .sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));

  const trail: AssignmentAuditTrail = {
    claimedBy: null,
    claimedAt: null,
    reassignedBy: null,
    reassignmentCount: 0,
    handedOffBy: null,
    firstActionBy: null,
    firstActionAt: null,
    untouchedHours: null,
    blockedReason: null,
    resolvedBy: null,
    resolvedAt: null,
  };

  let claimTime: number | null = null;

  for (const log of itemLogs) {
    switch (log.activityType) {
      case "ITEM_CLAIMED":
      case "ITEM_ASSIGNED":
        if (!trail.claimedBy) {
          trail.claimedBy = log.userId;
          trail.claimedAt = typeof log.createdAt === "string" ? log.createdAt : log.createdAt.toISOString();
          claimTime = toMs(log.createdAt);
        }
        break;

      case "ITEM_REASSIGNED":
        trail.reassignedBy = log.userId;
        trail.reassignmentCount++;
        break;

      case "ITEM_HANDED_OFF":
        trail.handedOffBy = log.userId;
        break;

      case "ITEM_STARTED":
        if (!trail.firstActionBy) {
          trail.firstActionBy = log.userId;
          trail.firstActionAt = typeof log.createdAt === "string" ? log.createdAt : log.createdAt.toISOString();
          if (claimTime) {
            trail.untouchedHours = Math.round(((toMs(log.createdAt) - claimTime) / MS_PER_HOUR) * 10) / 10;
          }
        }
        break;

      case "ITEM_BLOCKED":
        trail.blockedReason = (log.metadata?.note as string) ?? null;
        break;
    }
  }

  // Check for resolution in all logs (not just assignment types)
  const resolutionLog = logs
    .filter((l) => l.entityId === itemId && (l.activityType === "AI_TASK_COMPLETED" || l.activityType === "AI_TASK_FAILED"))
    .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))[0];

  if (resolutionLog) {
    trail.resolvedBy = resolutionLog.userId;
    trail.resolvedAt = typeof resolutionLog.createdAt === "string" ? resolutionLog.createdAt : resolutionLog.createdAt.toISOString();
  }

  return trail;
}
