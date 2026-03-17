/**
 * Console Daily Review — 일일 운영 검토 & 에스컬레이션 클로저
 *
 * 책임성 메트릭과 에스컬레이션을 실행 가능한 일일 검토 워크플로우로 전환합니다.
 * 7개 검토 카테고리, 5개 에스컬레이션 액션, 6개 검토 결과, 5개 이월 정의.
 *
 * 순수 정의 파일 — DB 호출 없음.
 */

import type { WorkQueueItem } from "./work-queue-service";
import type {
  EscalationRuleId,
  EscalationResult,
  ActivityLogEntry,
} from "./console-accountability";
import {
  evaluateEscalations,
  getEscalationBoost,
  ESCALATION_RULE_DEFS,
} from "./console-accountability";
import {
  resolveAssignmentState,
  extractHandoffInfo,
  type AssignmentState,
} from "./console-assignment";
import { computeFinalTier } from "./console-priorities";

// ── Daily Review Category Types ──

export type DailyReviewCategoryId =
  | "urgent_now"
  | "overdue_owned"
  | "blocked_too_long"
  | "handoff_not_accepted"
  | "urgent_unassigned"
  | "recently_resolved"
  | "needs_lead_intervention";

export interface DailyReviewCategoryDef {
  id: DailyReviewCategoryId;
  label: string;
  description: string;
  sortOrder: number;
  visibleTo: "operator" | "lead" | "both";
  primaryAction: string;
}

// ── Escalation Action Types ──

export type EscalationActionId =
  | "escalate_untouched"
  | "escalate_handoff"
  | "escalate_blocked"
  | "escalate_reassignment"
  | "escalate_overdue_urgent";

export interface EscalationActionDef {
  id: EscalationActionId;
  label: string;
  triggerRuleId: EscalationRuleId;
  fromStates: AssignmentState[];
  resultingState: AssignmentState;
  ownerChange: "reassign_to_lead" | "keep_owner" | "unassign";
  activityLogEvent: string;
  requiresNote: boolean;
  permissionRule: "lead_only" | "operator_or_lead";
  reviewImplication: string;
}

// ── Review Outcome Types ──

export type ReviewOutcomeId =
  | "keep_with_owner"
  | "reassign"
  | "escalate_to_lead"
  | "blocked_followup"
  | "carry_to_next"
  | "resolved_during_review";

export interface ReviewOutcomeDef {
  id: ReviewOutcomeId;
  label: string;
  description: string;
  resultingOwnerChange: boolean;
  resultingStateChange: AssignmentState | null;
  activityLogEvent: string;
}

export interface ReviewRecord {
  reviewedBy: string;
  reviewedAt: string;
  reviewOutcome: ReviewOutcomeId;
  reviewNote: string;
  resultingOwnerId: string | null;
  resultingState: AssignmentState | null;
}

// ── Carry-Over Types ──

export type CarryOverReason =
  | "unresolved_urgent"
  | "blocked_unresolved"
  | "handoff_unaccepted"
  | "overdue_owned"
  | "repeatedly_reassigned";

export interface CarryOverEntry {
  fromDate: string;
  reason: CarryOverReason;
  dayCount: number;
  severityPromoted: boolean;
  originalCategory: DailyReviewCategoryId;
}

export interface CarryOverDef {
  reason: CarryOverReason;
  label: string;
  appearsInCategory: DailyReviewCategoryId;
  severityPromotesAfterDays: number;
  exitCondition: string;
}

// ── Daily Review Surface Result Types ──

export interface DailyReviewItem {
  item: WorkQueueItem;
  category: DailyReviewCategoryId;
  escalations: EscalationResult[];
  carryOver: CarryOverEntry | null;
  availableEscalationActions: EscalationActionId[];
  availableReviewOutcomes: ReviewOutcomeId[];
}

export interface DailyReviewSurface {
  date: string;
  categories: Record<DailyReviewCategoryId, DailyReviewItem[]>;
  totalCount: number;
  carryOverCount: number;
  operatorItems: DailyReviewItem[];
  leadItems: DailyReviewItem[];
}

// ── Constants ──

const TERMINAL_TASK_STATUSES = new Set(["COMPLETED", "FAILED"]);
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

// ── Canonical Category Definitions ──

export const DAILY_REVIEW_CATEGORY_DEFS: Record<DailyReviewCategoryId, DailyReviewCategoryDef> = {
  urgent_now: {
    id: "urgent_now",
    label: "긴급 현재",
    description: "즉시 조치 필요한 배정된 긴급 항목",
    sortOrder: 0,
    visibleTo: "both",
    primaryAction: "즉시 처리 또는 에스컬레이션",
  },
  overdue_owned: {
    id: "overdue_owned",
    label: "초과 보유",
    description: "동일 담당자가 24시간 이상 보유 중인 긴급 항목",
    sortOrder: 1,
    visibleTo: "both",
    primaryAction: "재배정 또는 에스컬레이션",
  },
  blocked_too_long: {
    id: "blocked_too_long",
    label: "장기 차단",
    description: "48시간 이상 차단 지속 중인 항목",
    sortOrder: 2,
    visibleTo: "both",
    primaryAction: "차단 해제 또는 에스컬레이션",
  },
  handoff_not_accepted: {
    id: "handoff_not_accepted",
    label: "미인수 인수인계",
    description: "12시간 이상 인수되지 않은 인수인계 항목",
    sortOrder: 3,
    visibleTo: "both",
    primaryAction: "인수 촉구 또는 재배정",
  },
  urgent_unassigned: {
    id: "urgent_unassigned",
    label: "긴급 미배정",
    description: "담당자 없는 긴급 항목",
    sortOrder: 4,
    visibleTo: "both",
    primaryAction: "담당 배정",
  },
  recently_resolved: {
    id: "recently_resolved",
    label: "최근 완료",
    description: "최근 24시간 내 완료된 항목 (검토 컨텍스트)",
    sortOrder: 5,
    visibleTo: "operator",
    primaryAction: "확인",
  },
  needs_lead_intervention: {
    id: "needs_lead_intervention",
    label: "리드 개입 필요",
    description: "반복 재배정 또는 이월 심화 항목",
    sortOrder: 6,
    visibleTo: "lead",
    primaryAction: "리드 판단 후 조치",
  },
};

export const DAILY_REVIEW_CATEGORY_LABELS: Record<DailyReviewCategoryId, string> = {
  urgent_now: "긴급 현재",
  overdue_owned: "초과 보유",
  blocked_too_long: "장기 차단",
  handoff_not_accepted: "미인수 인수인계",
  urgent_unassigned: "긴급 미배정",
  recently_resolved: "최근 완료",
  needs_lead_intervention: "리드 개입 필요",
};

// ── Canonical Escalation Action Definitions ──

export const ESCALATION_ACTION_DEFS: Record<EscalationActionId, EscalationActionDef> = {
  escalate_untouched: {
    id: "escalate_untouched",
    label: "미착수 에스컬레이션",
    triggerRuleId: "assigned_no_first_action",
    fromStates: ["assigned"],
    resultingState: "assigned",
    ownerChange: "reassign_to_lead",
    activityLogEvent: "ITEM_ESCALATED",
    requiresNote: false,
    permissionRule: "operator_or_lead",
    reviewImplication: "리드에게 재배정, 미착수 사유 확인",
  },
  escalate_handoff: {
    id: "escalate_handoff",
    label: "미인수 에스컬레이션",
    triggerRuleId: "handoff_not_picked_up",
    fromStates: ["handed_off"],
    resultingState: "assigned",
    ownerChange: "reassign_to_lead",
    activityLogEvent: "ITEM_ESCALATED",
    requiresNote: false,
    permissionRule: "operator_or_lead",
    reviewImplication: "리드에게 재배정, 인수 지연 사유 확인",
  },
  escalate_blocked: {
    id: "escalate_blocked",
    label: "장기차단 에스컬레이션",
    triggerRuleId: "blocked_too_long",
    fromStates: ["blocked"],
    resultingState: "blocked",
    ownerChange: "keep_owner",
    activityLogEvent: "ITEM_ESCALATED",
    requiresNote: true,
    permissionRule: "operator_or_lead",
    reviewImplication: "차단 사유 기록, 리드 가시화",
  },
  escalate_reassignment: {
    id: "escalate_reassignment",
    label: "반복재배정 에스컬레이션",
    triggerRuleId: "repeatedly_reassigned",
    fromStates: ["assigned", "in_progress", "blocked"],
    resultingState: "assigned",
    ownerChange: "reassign_to_lead",
    activityLogEvent: "ITEM_ESCALATED",
    requiresNote: true,
    permissionRule: "lead_only",
    reviewImplication: "리드가 안정적 담당자 지정",
  },
  escalate_overdue_urgent: {
    id: "escalate_overdue_urgent",
    label: "긴급초과 에스컬레이션",
    triggerRuleId: "overdue_urgent_same_owner",
    fromStates: ["assigned", "in_progress"],
    resultingState: "assigned",
    ownerChange: "reassign_to_lead",
    activityLogEvent: "ITEM_ESCALATED",
    requiresNote: false,
    permissionRule: "lead_only",
    reviewImplication: "리드가 재배정 또는 직접 처리",
  },
};

export const ESCALATION_ACTION_LABELS: Record<EscalationActionId, string> = {
  escalate_untouched: "미착수 에스컬레이션",
  escalate_handoff: "미인수 에스컬레이션",
  escalate_blocked: "장기차단 에스컬레이션",
  escalate_reassignment: "반복재배정 에스컬레이션",
  escalate_overdue_urgent: "긴급초과 에스컬레이션",
};

// ── Canonical Review Outcome Definitions ──

export const REVIEW_OUTCOME_DEFS: Record<ReviewOutcomeId, ReviewOutcomeDef> = {
  keep_with_owner: {
    id: "keep_with_owner",
    label: "현 담당 유지",
    description: "현재 담당자가 계속 처리",
    resultingOwnerChange: false,
    resultingStateChange: null,
    activityLogEvent: "ITEM_REVIEW_COMPLETED",
  },
  reassign: {
    id: "reassign",
    label: "재배정",
    description: "다른 담당자에게 재배정",
    resultingOwnerChange: true,
    resultingStateChange: "assigned",
    activityLogEvent: "ITEM_REVIEW_COMPLETED",
  },
  escalate_to_lead: {
    id: "escalate_to_lead",
    label: "리드 에스컬레이션",
    description: "리드에게 판단 위임",
    resultingOwnerChange: true,
    resultingStateChange: "assigned",
    activityLogEvent: "ITEM_REVIEW_COMPLETED",
  },
  blocked_followup: {
    id: "blocked_followup",
    label: "차단 후속",
    description: "차단 사유 확인 후 다음 검토로 이월",
    resultingOwnerChange: false,
    resultingStateChange: null,
    activityLogEvent: "ITEM_REVIEW_COMPLETED",
  },
  carry_to_next: {
    id: "carry_to_next",
    label: "다음 검토 이월",
    description: "다음 일일 검토로 이월",
    resultingOwnerChange: false,
    resultingStateChange: null,
    activityLogEvent: "ITEM_REVIEW_COMPLETED",
  },
  resolved_during_review: {
    id: "resolved_during_review",
    label: "검토 중 해결",
    description: "검토 과정에서 해결됨",
    resultingOwnerChange: false,
    resultingStateChange: "resolved",
    activityLogEvent: "ITEM_REVIEW_COMPLETED",
  },
};

export const REVIEW_OUTCOME_LABELS: Record<ReviewOutcomeId, string> = {
  keep_with_owner: "현 담당 유지",
  reassign: "재배정",
  escalate_to_lead: "리드 에스컬레이션",
  blocked_followup: "차단 후속",
  carry_to_next: "다음 검토 이월",
  resolved_during_review: "검토 중 해결",
};

// ── Canonical Carry-Over Definitions ──

export const CARRY_OVER_DEFS: Record<CarryOverReason, CarryOverDef> = {
  unresolved_urgent: {
    reason: "unresolved_urgent",
    label: "미해결 긴급",
    appearsInCategory: "urgent_now",
    severityPromotesAfterDays: 2,
    exitCondition: "해결 또는 재배정",
  },
  blocked_unresolved: {
    reason: "blocked_unresolved",
    label: "미해결 차단",
    appearsInCategory: "blocked_too_long",
    severityPromotesAfterDays: 2,
    exitCondition: "차단 해제 또는 해결",
  },
  handoff_unaccepted: {
    reason: "handoff_unaccepted",
    label: "미인수 인수인계",
    appearsInCategory: "handoff_not_accepted",
    severityPromotesAfterDays: 1,
    exitCondition: "인수 또는 재배정",
  },
  overdue_owned: {
    reason: "overdue_owned",
    label: "초과 보유",
    appearsInCategory: "overdue_owned",
    severityPromotesAfterDays: 1,
    exitCondition: "해결 또는 재배정",
  },
  repeatedly_reassigned: {
    reason: "repeatedly_reassigned",
    label: "반복 재배정",
    appearsInCategory: "needs_lead_intervention",
    severityPromotesAfterDays: 0,
    exitCondition: "안정적 담당자 24시간 이상 유지",
  },
};

// ── Helpers ──

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

function toDateStr(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / MS_PER_DAY);
}

// ── Pure Function: Compute Carry-Over ──

/**
 * 아이템의 이월 상태를 결정합니다.
 *
 * payload.reviewHistory에서 가장 최근 검토를 확인.
 * carry_to_next 또는 blocked_followup 결과면 이월 엔트리 반환.
 */
export function computeCarryOver(
  item: WorkQueueItem,
  now?: Date,
): CarryOverEntry | null {
  const _now = now ?? new Date();
  const todayStr = toDateStr(_now);
  const metadata = item.metadata as Record<string, unknown>;

  // Check existing carry-over in payload
  const existingCarryOver = metadata?.carryOver as CarryOverEntry | undefined;

  // Check review history
  const reviewHistory = (metadata?.reviewHistory ?? []) as ReviewRecord[];
  if (reviewHistory.length === 0) {
    // If there's an existing carry-over from a prior computation, keep it
    return existingCarryOver ?? null;
  }

  const lastReview = reviewHistory[reviewHistory.length - 1];
  const lastReviewDate = toDateStr(lastReview.reviewedAt);

  // If reviewed today with keep_with_owner or resolved_during_review, exit carry-over
  if (lastReviewDate === todayStr) {
    if (lastReview.reviewOutcome === "keep_with_owner" || lastReview.reviewOutcome === "resolved_during_review") {
      return null;
    }
  }

  // If last review was carry_to_next or blocked_followup, compute carry-over
  if (lastReview.reviewOutcome === "carry_to_next" || lastReview.reviewOutcome === "blocked_followup") {
    const reason = mapOutcomeToCarryOverReason(lastReview, item);
    if (!reason) return null;

    const def = CARRY_OVER_DEFS[reason];
    const fromDate = existingCarryOver?.fromDate ?? lastReviewDate;
    const dayCount = daysBetween(fromDate, todayStr);
    const severityPromoted = def.severityPromotesAfterDays > 0 && dayCount >= def.severityPromotesAfterDays;

    return {
      fromDate,
      reason,
      dayCount: Math.max(1, dayCount),
      severityPromoted,
      originalCategory: def.appearsInCategory,
    };
  }

  return null;
}

function mapOutcomeToCarryOverReason(
  review: ReviewRecord,
  item: WorkQueueItem,
): CarryOverReason | null {
  const state = resolveAssignmentState(toAssignmentItem(item));
  const tier = computeFinalTier(item);

  if (state === "blocked") return "blocked_unresolved";
  if (state === "handed_off") return "handoff_unaccepted";
  if (tier === "urgent_blocker" && item.assigneeId) return "unresolved_urgent";
  if (tier === "urgent_blocker" && !item.assigneeId) return null; // unassigned goes to urgent_unassigned
  if (review.reviewOutcome === "blocked_followup") return "blocked_unresolved";
  return "overdue_owned";
}

// ── Pure Function: Select Daily Review Items ──

/**
 * 일일 검토 항목을 선택하고 카테고리로 분류합니다.
 *
 * 분류 우선순위 (첫 매치):
 * 1. urgent_now: urgent_blocker + 배정됨
 * 2. overdue_owned: overdue_urgent_same_owner 에스컬레이션
 * 3. blocked_too_long: blocked_too_long 에스컬레이션
 * 4. handoff_not_accepted: handoff_not_picked_up 에스컬레이션
 * 5. urgent_unassigned: urgent_blocker + 미배정
 * 6. recently_resolved: 최근 24h 완료
 * 7. needs_lead_intervention: repeatedly_reassigned 또는 이월 심화
 */
export function selectDailyReviewItems(
  items: WorkQueueItem[],
  logs: ActivityLogEntry[],
  userId: string,
  now?: Date,
): DailyReviewSurface {
  const _now = now ?? new Date();
  const todayStr = toDateStr(_now);

  const escalations = evaluateEscalations(items, logs, _now);
  const escalationsByItem = new Map<string, EscalationResult[]>();
  for (const esc of escalations) {
    const arr = escalationsByItem.get(esc.itemId) ?? [];
    arr.push(esc);
    escalationsByItem.set(esc.itemId, arr);
  }

  const categories: Record<DailyReviewCategoryId, DailyReviewItem[]> = {
    urgent_now: [],
    overdue_owned: [],
    blocked_too_long: [],
    handoff_not_accepted: [],
    urgent_unassigned: [],
    recently_resolved: [],
    needs_lead_intervention: [],
  };

  const categorized = new Set<string>();
  const recentThreshold = _now.getTime() - 24 * MS_PER_HOUR;

  // Pre-compute data
  const itemEscRuleIds = new Map<string, Set<string>>();
  for (const [itemId, escs] of escalationsByItem) {
    itemEscRuleIds.set(itemId, new Set(escs.map((e) => e.ruleId)));
  }

  for (const item of items) {
    if (categorized.has(item.id)) continue;

    const tier = computeFinalTier(item);
    const itemEscs = escalationsByItem.get(item.id) ?? [];
    const ruleIds = itemEscRuleIds.get(item.id) ?? new Set();
    const carryOver = computeCarryOver(item, _now);
    const isLead = false; // pure function doesn't know role; all actions computed

    // 1. urgent_now: urgent_blocker + assigned
    if (isActive(item) && tier === "urgent_blocker" && item.assigneeId) {
      if (!ruleIds.has("overdue_urgent_same_owner")) {
        categories.urgent_now.push(buildReviewItem(item, "urgent_now", itemEscs, carryOver, ruleIds));
        categorized.add(item.id);
        continue;
      }
    }

    // 2. overdue_owned: overdue_urgent_same_owner escalation
    if (isActive(item) && ruleIds.has("overdue_urgent_same_owner")) {
      categories.overdue_owned.push(buildReviewItem(item, "overdue_owned", itemEscs, carryOver, ruleIds));
      categorized.add(item.id);
      continue;
    }

    // 3. blocked_too_long: blocked_too_long escalation
    if (isActive(item) && ruleIds.has("blocked_too_long")) {
      categories.blocked_too_long.push(buildReviewItem(item, "blocked_too_long", itemEscs, carryOver, ruleIds));
      categorized.add(item.id);
      continue;
    }

    // 4. handoff_not_accepted: handoff_not_picked_up escalation
    if (isActive(item) && ruleIds.has("handoff_not_picked_up")) {
      categories.handoff_not_accepted.push(buildReviewItem(item, "handoff_not_accepted", itemEscs, carryOver, ruleIds));
      categorized.add(item.id);
      continue;
    }

    // 5. urgent_unassigned: urgent_blocker + no assignee
    if (isActive(item) && tier === "urgent_blocker" && !item.assigneeId) {
      categories.urgent_unassigned.push(buildReviewItem(item, "urgent_unassigned", itemEscs, carryOver, ruleIds));
      categorized.add(item.id);
      continue;
    }

    // 6. recently_resolved: COMPLETED/FAILED in last 24h
    if (TERMINAL_TASK_STATUSES.has(item.taskStatus) && new Date(item.updatedAt).getTime() >= recentThreshold) {
      categories.recently_resolved.push(buildReviewItem(item, "recently_resolved", itemEscs, carryOver, ruleIds));
      categorized.add(item.id);
      continue;
    }

    // 7. needs_lead_intervention: repeatedly_reassigned OR carry-over severity promoted
    if (isActive(item) && (ruleIds.has("repeatedly_reassigned") || (carryOver && carryOver.severityPromoted))) {
      categories.needs_lead_intervention.push(buildReviewItem(item, "needs_lead_intervention", itemEscs, carryOver, ruleIds));
      categorized.add(item.id);
      continue;
    }
  }

  // Flatten all review items
  const allItems: DailyReviewItem[] = [];
  for (const catId of Object.keys(categories) as DailyReviewCategoryId[]) {
    allItems.push(...categories[catId]);
  }

  const carryOverCount = allItems.filter((ri) => ri.carryOver !== null).length;
  const { operatorItems, leadItems } = splitByVisibility(allItems);

  return {
    date: todayStr,
    categories,
    totalCount: allItems.length,
    carryOverCount,
    operatorItems,
    leadItems,
  };
}

function buildReviewItem(
  item: WorkQueueItem,
  category: DailyReviewCategoryId,
  escalations: EscalationResult[],
  carryOver: CarryOverEntry | null,
  ruleIds: Set<string>,
): DailyReviewItem {
  return {
    item,
    category,
    escalations,
    carryOver,
    availableEscalationActions: getAvailableEscalationActions(item, escalations, true),
    availableReviewOutcomes: getAvailableReviewOutcomes(item, category),
  };
}

// ── Pure Function: Available Escalation Actions ──

/**
 * 아이템에 대해 수행 가능한 에스컬레이션 액션을 반환합니다.
 */
export function getAvailableEscalationActions(
  item: WorkQueueItem,
  escalations: EscalationResult[],
  isLead: boolean,
): EscalationActionId[] {
  if (!isActive(item)) return [];

  const activeRuleIds = new Set(escalations.filter((e) => e.itemId === item.id).map((e) => e.ruleId));
  const state = resolveAssignmentState(toAssignmentItem(item));
  const actions: EscalationActionId[] = [];

  for (const [actionId, def] of Object.entries(ESCALATION_ACTION_DEFS) as [EscalationActionId, EscalationActionDef][]) {
    // Check trigger rule is active
    if (!activeRuleIds.has(def.triggerRuleId)) continue;
    // Check from state
    if (!def.fromStates.includes(state)) continue;
    // Check permission
    if (def.permissionRule === "lead_only" && !isLead) continue;

    actions.push(actionId);
  }

  return actions;
}

// ── Pure Function: Available Review Outcomes ──

/**
 * 아이템과 카테고리에 따른 유효한 검토 결과를 반환합니다.
 */
export function getAvailableReviewOutcomes(
  item: WorkQueueItem,
  category: DailyReviewCategoryId,
): ReviewOutcomeId[] {
  const outcomes: ReviewOutcomeId[] = [];

  // resolved_during_review: only for active items
  if (isActive(item)) {
    outcomes.push("keep_with_owner");
    outcomes.push("reassign");
    outcomes.push("carry_to_next");
    outcomes.push("resolved_during_review");

    // escalate_to_lead: not if already in needs_lead_intervention
    if (category !== "needs_lead_intervention") {
      outcomes.push("escalate_to_lead");
    }

    // blocked_followup: only if item is blocked
    const state = resolveAssignmentState(toAssignmentItem(item));
    if (state === "blocked") {
      outcomes.push("blocked_followup");
    }
  } else {
    // Terminal items can only be acknowledged
    outcomes.push("keep_with_owner");
  }

  return outcomes;
}

// ── Pure Function: Build Review Record ──

/**
 * 검토 기록을 생성합니다.
 */
export function buildReviewRecord(params: {
  reviewedBy: string;
  reviewOutcome: ReviewOutcomeId;
  reviewNote: string;
  resultingOwnerId?: string | null;
  resultingState?: AssignmentState | null;
  now?: Date;
}): ReviewRecord {
  const _now = params.now ?? new Date();
  return {
    reviewedBy: params.reviewedBy,
    reviewedAt: _now.toISOString(),
    reviewOutcome: params.reviewOutcome,
    reviewNote: params.reviewNote,
    resultingOwnerId: params.resultingOwnerId ?? null,
    resultingState: params.resultingState ?? null,
  };
}

// ── Pure Function: Apply Review Outcome ──

/**
 * 검토 결과를 적용하여 새 상태를 계산합니다.
 */
export function applyReviewOutcome(
  item: WorkQueueItem,
  outcomeId: ReviewOutcomeId,
  params: {
    actorUserId: string;
    targetUserId?: string;
    note: string;
    now?: Date;
  },
): {
  newPayload: Record<string, unknown>;
  newAssigneeId: string | null;
  logEvent: string;
  logMetadata: Record<string, unknown>;
} {
  const _now = params.now ?? new Date();
  const outcomeDef = REVIEW_OUTCOME_DEFS[outcomeId];
  const metadata = { ...(item.metadata as Record<string, unknown>) };

  const reviewRecord = buildReviewRecord({
    reviewedBy: params.actorUserId,
    reviewOutcome: outcomeId,
    reviewNote: params.note,
    resultingOwnerId: outcomeDef.resultingOwnerChange ? (params.targetUserId ?? null) : item.assigneeId,
    resultingState: outcomeDef.resultingStateChange,
    now: _now,
  });

  // Append to review history
  const history = Array.isArray(metadata.reviewHistory) ? [...(metadata.reviewHistory as ReviewRecord[])] : [];
  history.push(reviewRecord);
  metadata.reviewHistory = history;

  // Update assignment state if changed
  if (outcomeDef.resultingStateChange) {
    metadata.assignmentState = outcomeDef.resultingStateChange;
  }

  // Clear carry-over on keep_with_owner or resolved_during_review
  if (outcomeId === "keep_with_owner" || outcomeId === "resolved_during_review") {
    metadata.carryOver = null;
  }

  let newAssigneeId = item.assigneeId;
  if (outcomeDef.resultingOwnerChange && params.targetUserId) {
    newAssigneeId = params.targetUserId;
  }

  return {
    newPayload: metadata,
    newAssigneeId,
    logEvent: outcomeDef.activityLogEvent,
    logMetadata: {
      reviewOutcome: outcomeId,
      reviewNote: params.note,
      assigneeId_before: item.assigneeId,
      assigneeId_after: newAssigneeId,
    },
  };
}

// ── Pure Function: Apply Escalation Action ──

/**
 * 에스컬레이션 액션을 적용하여 새 상태를 계산합니다.
 */
export function applyEscalationAction(
  item: WorkQueueItem,
  actionId: EscalationActionId,
  params: {
    actorUserId: string;
    targetUserId?: string;
    note?: string;
    now?: Date;
  },
): {
  newPayload: Record<string, unknown>;
  newAssigneeId: string | null;
  logEvent: string;
  logMetadata: Record<string, unknown>;
} {
  const _now = params.now ?? new Date();
  const actionDef = ESCALATION_ACTION_DEFS[actionId];
  const metadata = { ...(item.metadata as Record<string, unknown>) };

  // Update assignment state
  metadata.assignmentState = actionDef.resultingState;

  // Record escalation
  metadata.lastEscalation = {
    actionId,
    escalatedBy: params.actorUserId,
    escalatedAt: _now.toISOString(),
    note: params.note ?? "",
  };

  let newAssigneeId = item.assigneeId;
  if (actionDef.ownerChange === "reassign_to_lead" && params.targetUserId) {
    newAssigneeId = params.targetUserId;
  } else if (actionDef.ownerChange === "unassign") {
    newAssigneeId = null;
  }

  return {
    newPayload: metadata,
    newAssigneeId,
    logEvent: actionDef.activityLogEvent,
    logMetadata: {
      escalationActionId: actionId,
      ruleId: actionDef.triggerRuleId,
      note: params.note ?? "",
      assigneeId_before: item.assigneeId,
      assigneeId_after: newAssigneeId,
    },
  };
}

// ── Pure Function: Split by Visibility ──

/**
 * 검토 항목을 운영자/리드 뷰로 분리합니다.
 */
export function splitByVisibility(
  reviewItems: DailyReviewItem[],
): { operatorItems: DailyReviewItem[]; leadItems: DailyReviewItem[] } {
  const operatorItems: DailyReviewItem[] = [];
  const leadItems: DailyReviewItem[] = [];

  for (const ri of reviewItems) {
    const catDef = DAILY_REVIEW_CATEGORY_DEFS[ri.category];

    if (catDef.visibleTo === "operator" || catDef.visibleTo === "both") {
      operatorItems.push(ri);
    }

    if (catDef.visibleTo === "lead" || catDef.visibleTo === "both") {
      leadItems.push(ri);
    }

    // Items with escalate_to_lead review outcome also go to lead view
    const reviewHistory = ((ri.item.metadata as Record<string, unknown>)?.reviewHistory ?? []) as ReviewRecord[];
    const lastReview = reviewHistory[reviewHistory.length - 1];
    if (lastReview?.reviewOutcome === "escalate_to_lead" && catDef.visibleTo !== "lead" && catDef.visibleTo !== "both") {
      leadItems.push(ri);
    }

    // Critical escalations also go to lead view
    if (ri.escalations.some((e) => e.severity === "critical") && catDef.visibleTo !== "lead" && catDef.visibleTo !== "both") {
      leadItems.push(ri);
    }
  }

  return { operatorItems, leadItems };
}
