/**
 * Console Grouping Logic — Operator Console Groups
 *
 * WorkQueueItem을 운영 콘솔 그룹으로 분류합니다.
 * 각 그룹은 운영자의 일일 트리아지 워크플로우를 반영합니다.
 *
 * 순수 함수 — DB 호출 없음.
 */

import type { WorkQueueItem } from "./work-queue-service";
import {
  OPS_SUBSTATUS_DEFS,
  OPS_QUEUE_ITEM_TYPES,
  OPS_QUEUE_CTA_MAP,
  OPS_CTA_COMPLETION_DEFS,
  type OpsQueueItemType,
} from "./ops-queue-semantics";
import { COMPARE_SUBSTATUS_DEFS, COMPARE_CTA_MAP } from "./compare-queue-semantics";
import {
  computeFinalTier,
  PRIORITY_TIER_DEFS,
  type PriorityTier,
} from "./console-priorities";
import {
  resolveAssignmentState,
  extractHandoffInfo,
  shouldActorAct as checkShouldActorAct,
  isMyWork,
  isUnassigned,
  filterForView,
  ASSIGNMENT_STATE_LABELS,
  type AssignmentState,
  type ConsoleView,
  type HandoffInfo,
} from "./console-assignment";

// ── Types ──

export type ConsoleGroupId =
  | "urgent_blockers"
  | "approvals_needed"
  | "receiving_restock"
  | "compare_followup"
  | "stalled_handoffs"
  | "recently_changed"
  | "recently_resolved";

export interface ConsoleGroup {
  id: ConsoleGroupId;
  label: string;
  description: string;
  items: GroupedItem[];
  collapsible: boolean;
}

export interface GroupedItem extends WorkQueueItem {
  priorityTier: PriorityTier;
  ownerRole: string;
  primaryCtaLabel: string;
  primaryCtaActionId: string | null;
  nextQueueLabel: string | null;
  tierIndicator: string;
  tierColor: string;
  // ── Assignment fields ──
  assignmentState: AssignmentState;
  assigneeId: string | null;
  handoffInfo: HandoffInfo | null;
  shouldActorAct: boolean;
  assignmentStateLabel: string;
}

// ── Group Definitions ──

const GROUP_DEFS: { id: ConsoleGroupId; label: string; description: string; collapsible: boolean }[] = [
  { id: "urgent_blockers", label: "긴급/차단", description: "즉시 조치 필요 — 실패, 차단, SLA 초과", collapsible: false },
  { id: "approvals_needed", label: "승인 대기", description: "승인자 결재가 필요한 항목", collapsible: false },
  { id: "receiving_restock", label: "입고/재고", description: "입고 대기, 입고 이슈, 재고 반영 확인", collapsible: false },
  { id: "compare_followup", label: "비교/판정", description: "비교 판정 대기, 문의 후속, 견적 진행", collapsible: false },
  { id: "stalled_handoffs", label: "정체 핸드오프", description: "다음 단계 전환이 지연된 항목", collapsible: false },
  { id: "recently_changed", label: "최근 변경", description: "최근 48시간 내 상태 변경된 항목", collapsible: true },
  { id: "recently_resolved", label: "최근 완료", description: "최근 완료/실패된 항목", collapsible: true },
];

// ── Constants ──

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const RECENTLY_CHANGED_HOURS = 48;

const RECEIVING_STAGES = new Set(["receiving", "inventory"]);
const COMPARE_SUBSTATUSES = new Set(Object.keys(COMPARE_SUBSTATUS_DEFS));
const TERMINAL_TASK_STATUSES = new Set(["COMPLETED", "FAILED"]);

// ── Core Grouping ──

/**
 * WorkQueueItem 배열을 콘솔 그룹으로 분류합니다.
 *
 * 분류 우선순위 (첫 매치 기준):
 * 1. urgent_blockers: tier === urgent_blocker
 * 2. recently_resolved: COMPLETED/FAILED
 * 3. approvals_needed: tier === approval_needed
 * 4. receiving_restock: ops stage === receiving/inventory
 * 5. compare_followup: compare substatus
 * 6. stalled_handoffs: stalled handoff queue type
 * 7. recently_changed: updated within 48h (and not already grouped)
 *
 * 빈 그룹은 제외됩니다.
 */
export function groupForConsole(items: WorkQueueItem[], userId?: string): ConsoleGroup[] {
  const grouped = new Set<string>();
  const buckets: Record<ConsoleGroupId, GroupedItem[]> = {
    urgent_blockers: [],
    approvals_needed: [],
    receiving_restock: [],
    compare_followup: [],
    stalled_handoffs: [],
    recently_changed: [],
    recently_resolved: [],
  };

  // Enrich all items first
  const enriched = items.map((item) => enrichItem(item, userId));

  // Pass 1: urgent_blockers
  for (const item of enriched) {
    if (item.priorityTier === "urgent_blocker") {
      buckets.urgent_blockers.push(item);
      grouped.add(item.id);
    }
  }

  // Pass 2: recently_resolved (COMPLETED/FAILED)
  for (const item of enriched) {
    if (grouped.has(item.id)) continue;
    if (TERMINAL_TASK_STATUSES.has(item.taskStatus)) {
      buckets.recently_resolved.push(item);
      grouped.add(item.id);
    }
  }

  // Pass 3: approvals_needed
  for (const item of enriched) {
    if (grouped.has(item.id)) continue;
    if (item.priorityTier === "approval_needed") {
      buckets.approvals_needed.push(item);
      grouped.add(item.id);
    }
  }

  // Pass 4: receiving_restock
  for (const item of enriched) {
    if (grouped.has(item.id)) continue;
    if (item.substatus && OPS_SUBSTATUS_DEFS[item.substatus]) {
      const stage = OPS_SUBSTATUS_DEFS[item.substatus].stage;
      if (RECEIVING_STAGES.has(stage)) {
        buckets.receiving_restock.push(item);
        grouped.add(item.id);
      }
    }
  }

  // Pass 5: compare_followup
  for (const item of enriched) {
    if (grouped.has(item.id)) continue;
    if (item.substatus && COMPARE_SUBSTATUSES.has(item.substatus)) {
      buckets.compare_followup.push(item);
      grouped.add(item.id);
    }
  }

  // Pass 6: stalled_handoffs (metadata indicates stalled handoff)
  for (const item of enriched) {
    if (grouped.has(item.id)) continue;
    const metadata = item.metadata as Record<string, unknown> | null;
    const queueItemType = metadata?.queueItemType as string | undefined;
    if (queueItemType === "ops_stalled_handoff") {
      buckets.stalled_handoffs.push(item);
      grouped.add(item.id);
    }
  }

  // Pass 7: recently_changed (48h) — catch remaining active items
  const recentThreshold = Date.now() - RECENTLY_CHANGED_HOURS * 60 * 60 * 1000;
  for (const item of enriched) {
    if (grouped.has(item.id)) continue;
    if (new Date(item.updatedAt).getTime() >= recentThreshold) {
      buckets.recently_changed.push(item);
      grouped.add(item.id);
    }
  }

  // Remaining ungrouped items go to recently_changed as fallback
  for (const item of enriched) {
    if (grouped.has(item.id)) continue;
    buckets.recently_changed.push(item);
    grouped.add(item.id);
  }

  // Sort within each group by tier sortOrder → totalScore DESC
  for (const groupId of Object.keys(buckets) as ConsoleGroupId[]) {
    buckets[groupId].sort((a, b) => {
      const tierDiff = PRIORITY_TIER_DEFS[a.priorityTier].sortOrder - PRIORITY_TIER_DEFS[b.priorityTier].sortOrder;
      if (tierDiff !== 0) return tierDiff;
      return b.totalScore - a.totalScore;
    });
  }

  // Build result — omit empty groups
  return GROUP_DEFS
    .map((def) => ({
      id: def.id,
      label: def.label,
      description: def.description,
      items: buckets[def.id],
      collapsible: def.collapsible,
    }))
    .filter((g) => g.items.length > 0);
}

// ── View-Filtered Grouping ──

/**
 * 뷰 기반 필터 적용 후 콘솔 그룹으로 분류합니다.
 *
 * filterForView()로 사전 필터 → groupForConsole()에 위임.
 */
export function groupForConsoleWithView(
  items: WorkQueueItem[],
  view: ConsoleView,
  userId: string,
): ConsoleGroup[] {
  // WorkQueueItem에 assigneeId가 없을 수 있으므로 filterForView 호환 형태로 변환
  const viewItems = items.map((item) => ({
    ...item,
    assigneeId: (item as any).assigneeId ?? null,
    taskStatus: item.taskStatus,
  }));

  const filtered = view === "all"
    ? viewItems
    : filterForView(viewItems, view, userId);

  return groupForConsole(filtered as WorkQueueItem[], userId);
}

// ── Owner Role Resolution ──

/**
 * WorkQueueItem의 소유 역할을 결정합니다.
 *
 * 결정 순서:
 * 1. metadata.queueItemType → OPS_QUEUE_ITEM_TYPES.owner
 * 2. substatus로 OPS_QUEUE_ITEM_TYPES 매칭
 * 3. approvalStatus === PENDING → APPROVER
 * 4. compare substatus → REQUESTER
 * 5. 기본 → OPERATOR
 */
export function resolveOwnerRole(item: WorkQueueItem): string {
  const metadata = item.metadata as Record<string, unknown> | null;
  const queueItemTypeId = metadata?.queueItemType as string | undefined;

  // 1. Explicit queue item type from metadata
  if (queueItemTypeId && OPS_QUEUE_ITEM_TYPES[queueItemTypeId]) {
    return OPS_QUEUE_ITEM_TYPES[queueItemTypeId].owner;
  }

  // 2. Match substatus to queue item type
  if (item.substatus) {
    for (const queueType of Object.values(OPS_QUEUE_ITEM_TYPES)) {
      if (queueType.sourceSubstatuses.includes(item.substatus)) {
        return queueType.owner;
      }
    }
  }

  // 3. PENDING approval → APPROVER
  if (item.approvalStatus === "PENDING") {
    return "APPROVER";
  }

  // 4. Compare substatus → REQUESTER
  if (item.substatus && COMPARE_SUBSTATUSES.has(item.substatus)) {
    return "REQUESTER";
  }

  // 5. Default
  return "OPERATOR";
}

// ── CTA Resolution ──

/**
 * WorkQueueItem의 콘솔 CTA를 해석합니다.
 */
export function resolveConsoleCta(item: WorkQueueItem): {
  label: string;
  actionId: string | null;
  nextLabel: string | null;
} {
  const { substatus } = item;

  // 1. Ops CTA map
  if (substatus && OPS_QUEUE_CTA_MAP[substatus]) {
    const cta = OPS_QUEUE_CTA_MAP[substatus];
    const actionId = findActionIdFromSubstatus(substatus);
    const nextLabel = findNextQueueLabel(actionId);
    return { label: cta.label, actionId, nextLabel };
  }

  // 2. Compare CTA map
  if (substatus && COMPARE_CTA_MAP[substatus]) {
    const cta = COMPARE_CTA_MAP[substatus];
    return { label: cta.label, actionId: null, nextLabel: null };
  }

  // 3. Fallback
  return { label: "확인", actionId: null, nextLabel: null };
}

// ── Console Summary ──

export interface ConsoleSummary {
  urgentCount: number;
  approvalCount: number;
  totalActive: number;
  totalResolved: number;
  // ── Assignment counters ──
  myWorkCount: number;
  unassignedCount: number;
  handedOffCount: number;
}

/**
 * 콘솔 그룹에서 요약 통계를 계산합니다.
 *
 * userId가 제공되면 myWorkCount/unassignedCount/handedOffCount도 계산합니다.
 */
export function computeConsoleSummary(groups: ConsoleGroup[], userId?: string): ConsoleSummary {
  let urgentCount = 0;
  let approvalCount = 0;
  let totalActive = 0;
  let totalResolved = 0;
  let myWorkCount = 0;
  let unassignedCount = 0;
  let handedOffCount = 0;

  for (const group of groups) {
    if (group.id === "urgent_blockers") {
      urgentCount = group.items.length;
    }
    if (group.id === "approvals_needed") {
      approvalCount = group.items.length;
    }
    if (group.id === "recently_resolved") {
      totalResolved = group.items.length;
    }
    for (const item of group.items) {
      if (!TERMINAL_TASK_STATUSES.has(item.taskStatus)) {
        totalActive++;
        if (userId && item.assigneeId === userId) myWorkCount++;
        if (!item.assigneeId && !TERMINAL_TASK_STATUSES.has(item.taskStatus)) unassignedCount++;
        if (item.assignmentState === "handed_off") handedOffCount++;
      }
    }
  }

  return { urgentCount, approvalCount, totalActive, totalResolved, myWorkCount, unassignedCount, handedOffCount };
}

// ── Owner Role Labels ──

export const OWNER_ROLE_LABELS: Record<string, string> = {
  REQUESTER: "요청자",
  APPROVER: "승인자",
  OPERATOR: "운영자",
};

// ── Helpers ──

function enrichItem(item: WorkQueueItem, userId?: string): GroupedItem {
  const tier = computeFinalTier(item);
  const ownerRole = resolveOwnerRole(item);
  const cta = resolveConsoleCta(item);
  const tierDef = PRIORITY_TIER_DEFS[tier];

  // Assignment fields
  const assignmentItem = {
    assigneeId: (item as any).assigneeId ?? null,
    metadata: item.metadata ?? {},
    taskStatus: item.taskStatus,
  };
  const assignmentState = resolveAssignmentState(assignmentItem);
  const handoffInfo = extractHandoffInfo(item.metadata ?? {});
  const actorShouldAct = userId ? checkShouldActorAct(assignmentItem, userId) : false;

  return {
    ...item,
    priorityTier: tier,
    ownerRole,
    primaryCtaLabel: cta.label,
    primaryCtaActionId: cta.actionId,
    nextQueueLabel: cta.nextLabel,
    tierIndicator: tierDef.label,
    tierColor: tierDef.visualIndicator,
    assignmentState,
    assigneeId: assignmentItem.assigneeId,
    handoffInfo,
    shouldActorAct: actorShouldAct,
    assignmentStateLabel: ASSIGNMENT_STATE_LABELS[assignmentState],
  };
}

function findActionIdFromSubstatus(substatus: string): string | null {
  for (const queueType of Object.values(OPS_QUEUE_ITEM_TYPES)) {
    if (queueType.sourceSubstatuses.includes(substatus)) {
      const actionId = queueType.primaryCta.actionId;
      if (actionId && !actionId.startsWith("navigate_")) {
        return actionId;
      }
    }
  }
  return null;
}

function findNextQueueLabel(actionId: string | null): string | null {
  if (!actionId) return null;
  const completionDef = OPS_CTA_COMPLETION_DEFS[actionId];
  if (!completionDef?.nextQueueItemType) return null;
  const nextType = OPS_QUEUE_ITEM_TYPES[completionDef.nextQueueItemType];
  return nextType?.label ?? null;
}
