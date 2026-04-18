/**
 * Console Assignment Semantics — Canonical Definitions
 *
 * 운영자 담당 배정·인수인계·소유권 추적의 정식 정의.
 * assigneeId (DB 컬럼) + payload.assignmentState + payload.handoff로 저장.
 *
 * 순수 정의 파일 — DB 호출 없음.
 */

// ── Types ──

export type AssignmentState =
  | "unassigned"
  | "assigned"
  | "in_progress"
  | "blocked"
  | "handed_off"
  | "resolved";

export interface AssignmentStateDef {
  state: AssignmentState;
  label: string;
  description: string;
  allowedTransitions: AssignmentState[];
  priorityBoost: number;
  groupingEffect: ConsoleView | null;
}

export type AssignmentAction =
  | "claim"
  | "assign"
  | "reassign"
  | "mark_in_progress"
  | "mark_blocked"
  | "hand_off";

export interface AssignmentActionDef {
  action: AssignmentAction;
  label: string;
  fromStates: AssignmentState[];
  toState: AssignmentState;
  requiresTargetUser: boolean;
  requiresNote: boolean;
  activityLogEvent: string;
  permissionRule: "self_or_org_member" | "org_member";
}

export type ConsoleView =
  | "all"
  | "my_work"
  | "unassigned"
  | "team_urgent"
  | "recently_handed_off";

export interface HandoffInfo {
  note: string;
  fromUserId: string;
  toUserId: string;
  at: string;
  nextAction: string;
}

// ── Canonical State Definitions ──

export const ASSIGNMENT_STATE_DEFS: Record<AssignmentState, AssignmentStateDef> = {
  unassigned: {
    state: "unassigned",
    label: "미배정",
    description: "담당자 없음 — 누구든 담당 가능",
    allowedTransitions: ["assigned"],
    priorityBoost: 0,
    groupingEffect: "unassigned",
  },
  assigned: {
    state: "assigned",
    label: "배정됨",
    description: "담당자가 배정됨 — 작업 시작 대기",
    allowedTransitions: ["in_progress", "handed_off", "assigned"],
    priorityBoost: 0,
    groupingEffect: "my_work",
  },
  in_progress: {
    state: "in_progress",
    label: "진행 중",
    description: "담당자가 작업 중",
    allowedTransitions: ["handed_off", "blocked", "resolved"],
    priorityBoost: 0,
    groupingEffect: "my_work",
  },
  blocked: {
    state: "blocked",
    label: "차단됨",
    description: "작업이 차단됨 — 에스컬레이션 필요",
    allowedTransitions: ["in_progress", "handed_off", "assigned"],
    priorityBoost: 10,
    groupingEffect: "team_urgent",
  },
  handed_off: {
    state: "handed_off",
    label: "인수인계",
    description: "다른 담당자에게 이관됨",
    allowedTransitions: ["assigned"],
    priorityBoost: 0,
    groupingEffect: "recently_handed_off",
  },
  resolved: {
    state: "resolved",
    label: "완료",
    description: "작업 종료",
    allowedTransitions: [],
    priorityBoost: 0,
    groupingEffect: null,
  },
};

// ── Canonical Action Definitions ──

export const ASSIGNMENT_ACTION_DEFS: Record<AssignmentAction, AssignmentActionDef> = {
  claim: {
    action: "claim",
    label: "담당",
    fromStates: ["unassigned", "handed_off"],
    toState: "assigned",
    requiresTargetUser: false,
    requiresNote: false,
    activityLogEvent: "ITEM_CLAIMED",
    permissionRule: "org_member",
  },
  assign: {
    action: "assign",
    label: "배정",
    fromStates: ["unassigned"],
    toState: "assigned",
    requiresTargetUser: true,
    requiresNote: false,
    activityLogEvent: "ITEM_ASSIGNED",
    permissionRule: "org_member",
  },
  reassign: {
    action: "reassign",
    label: "재배정",
    fromStates: ["assigned", "in_progress", "blocked"],
    toState: "assigned",
    requiresTargetUser: true,
    requiresNote: false,
    activityLogEvent: "ITEM_REASSIGNED",
    permissionRule: "org_member",
  },
  mark_in_progress: {
    action: "mark_in_progress",
    label: "진행 시작",
    fromStates: ["assigned"],
    toState: "in_progress",
    requiresTargetUser: false,
    requiresNote: false,
    activityLogEvent: "ITEM_STARTED",
    permissionRule: "self_or_org_member",
  },
  mark_blocked: {
    action: "mark_blocked",
    label: "차단",
    fromStates: ["in_progress"],
    toState: "blocked",
    requiresTargetUser: false,
    requiresNote: true,
    activityLogEvent: "ITEM_BLOCKED",
    permissionRule: "self_or_org_member",
  },
  hand_off: {
    action: "hand_off",
    label: "인수인계",
    fromStates: ["assigned", "in_progress", "blocked"],
    toState: "handed_off",
    requiresTargetUser: true,
    requiresNote: true,
    activityLogEvent: "ITEM_HANDED_OFF",
    permissionRule: "self_or_org_member",
  },
};

// ── Labels ──

export const ASSIGNMENT_STATE_LABELS: Record<AssignmentState, string> = {
  unassigned: "미배정",
  assigned: "배정됨",
  in_progress: "진행 중",
  blocked: "차단됨",
  handed_off: "인수인계",
  resolved: "완료",
};

export const ASSIGNMENT_ACTION_LABELS: Record<AssignmentAction, string> = {
  claim: "담당",
  assign: "배정",
  reassign: "재배정",
  mark_in_progress: "진행 시작",
  mark_blocked: "차단",
  hand_off: "인수인계",
};

export const CONSOLE_VIEW_LABELS: Record<ConsoleView, string> = {
  all: "전체",
  my_work: "내 작업",
  unassigned: "미배정",
  team_urgent: "팀 긴급",
  recently_handed_off: "최근 인수인계",
};

// ── Constants ──

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED"]);
const HANDOFF_RECENT_HOURS = 48;

// ── Pure Functions ──

/**
 * 아이템의 현재 배정 상태를 결정합니다.
 *
 * 우선순위:
 * 1. taskStatus가 터미널 → resolved
 * 2. payload.assignmentState가 명시됨 → 해당 값
 * 3. assigneeId 있음 → assigned
 * 4. 기본 → unassigned
 */
export function resolveAssignmentState(item: {
  assigneeId?: string | null;
  metadata: Record<string, unknown>;
  taskStatus: string;
}): AssignmentState {
  // Terminal override
  if (TERMINAL_STATUSES.has(item.taskStatus)) {
    return "resolved";
  }

  // Explicit state in metadata
  const explicit = item.metadata?.assignmentState as string | undefined;
  if (explicit && explicit in ASSIGNMENT_STATE_DEFS) {
    return explicit as AssignmentState;
  }

  // Infer from assigneeId
  if (item.assigneeId) {
    return "assigned";
  }

  return "unassigned";
}

/**
 * 현재 상태에서 특정 액션으로의 전이가 가능한지 확인합니다.
 */
export function canTransition(
  currentState: AssignmentState,
  action: AssignmentAction,
): boolean {
  const actionDef = ASSIGNMENT_ACTION_DEFS[action];
  if (!actionDef) return false;
  return actionDef.fromStates.includes(currentState);
}

/**
 * 배정 액션의 유효성을 검증합니다.
 */
export function validateAction(
  action: AssignmentAction,
  params: {
    actorUserId: string;
    currentAssigneeId?: string | null;
    targetUserId?: string;
    note?: string;
  },
): { valid: boolean; error?: string } {
  const actionDef = ASSIGNMENT_ACTION_DEFS[action];
  if (!actionDef) {
    return { valid: false, error: "알 수 없는 액션입니다." };
  }

  if (actionDef.requiresTargetUser && !params.targetUserId) {
    return { valid: false, error: "대상 사용자를 지정해야 합니다." };
  }

  if (actionDef.requiresNote && !params.note?.trim()) {
    return { valid: false, error: "사유를 입력해야 합니다." };
  }

  // Self-permission check: mark_in_progress, mark_blocked only by current assignee
  if (actionDef.permissionRule === "self_or_org_member") {
    if (params.currentAssigneeId && params.currentAssigneeId !== params.actorUserId) {
      // Allow org members to also perform these actions (no strict block)
    }
  }

  return { valid: true };
}

/**
 * 인수인계 페이로드를 생성합니다.
 */
export function buildHandoffPayload(params: {
  fromUserId: string;
  toUserId: string;
  note: string;
  nextAction: string;
}): Record<string, unknown> {
  const handoff: HandoffInfo = {
    note: params.note,
    fromUserId: params.fromUserId,
    toUserId: params.toUserId,
    at: new Date().toISOString(),
    nextAction: params.nextAction,
  };

  return {
    assignmentState: "handed_off" as AssignmentState,
    handoff,
  };
}

/**
 * 메타데이터에서 인수인계 정보를 추출합니다.
 */
export function extractHandoffInfo(
  metadata: Record<string, unknown>,
): HandoffInfo | null {
  const handoff = metadata?.handoff as Record<string, unknown> | undefined;
  if (
    !handoff ||
    typeof handoff.note !== "string" ||
    typeof handoff.fromUserId !== "string" ||
    typeof handoff.toUserId !== "string" ||
    typeof handoff.at !== "string"
  ) {
    return null;
  }

  return {
    note: handoff.note,
    fromUserId: handoff.fromUserId,
    toUserId: handoff.toUserId,
    at: handoff.at,
    nextAction: (handoff.nextAction as string) ?? "",
  };
}

/**
 * 아이템이 특정 사용자의 "내 작업"인지 확인합니다.
 */
export function isMyWork(
  item: { assigneeId?: string | null; metadata: Record<string, unknown>; taskStatus: string },
  userId: string,
): boolean {
  if (TERMINAL_STATUSES.has(item.taskStatus)) return false;
  return item.assigneeId === userId;
}

/**
 * 아이템이 미배정인지 확인합니다.
 */
export function isUnassigned(
  item: { assigneeId?: string | null; metadata: Record<string, unknown>; taskStatus: string },
): boolean {
  if (TERMINAL_STATUSES.has(item.taskStatus)) return false;
  return !item.assigneeId;
}

/**
 * 현재 사용자가 즉시 조치해야 하는 아이템인지 확인합니다.
 */
export function shouldActorAct(
  item: { assigneeId?: string | null; metadata: Record<string, unknown>; taskStatus: string },
  userId: string,
): boolean {
  if (TERMINAL_STATUSES.has(item.taskStatus)) return false;
  if (item.assigneeId !== userId) return false;

  const state = resolveAssignmentState(item);
  return state === "assigned" || state === "in_progress";
}

/**
 * 뷰 기반 필터링을 적용합니다.
 */
export function filterForView<
  T extends { assigneeId?: string | null; metadata: Record<string, unknown>; taskStatus: string },
>(
  items: T[],
  view: ConsoleView,
  userId: string,
): T[] {
  switch (view) {
    case "all":
      return items;

    case "my_work":
      return items.filter((item) => isMyWork(item, userId));

    case "unassigned":
      return items.filter((item) => isUnassigned(item));

    case "team_urgent": {
      return items.filter((item) => {
        if (TERMINAL_STATUSES.has(item.taskStatus)) return false;
        const state = resolveAssignmentState(item);
        if (state === "blocked") return true;
        // Also include items with BLOCKED/FAILED taskStatus
        if (item.taskStatus === "BLOCKED" || item.taskStatus === "FAILED") return true;
        return false;
      });
    }

    case "recently_handed_off": {
      const threshold = Date.now() - HANDOFF_RECENT_HOURS * 60 * 60 * 1000;
      return items.filter((item) => {
        const state = resolveAssignmentState(item);
        if (state !== "handed_off") return false;
        const handoff = extractHandoffInfo(item.metadata);
        if (!handoff) return false;
        return new Date(handoff.at).getTime() >= threshold;
      });
    }

    default:
      return items;
  }
}

/**
 * 아이템에 대해 가능한 배정 액션 목록을 반환합니다.
 */
export function getAvailableActions(
  item: { assigneeId?: string | null; metadata: Record<string, unknown>; taskStatus: string },
  userId: string,
): AssignmentAction[] {
  const state = resolveAssignmentState(item);
  if (state === "resolved") return [];

  const actions: AssignmentAction[] = [];

  for (const [action, def] of Object.entries(ASSIGNMENT_ACTION_DEFS)) {
    if (!def.fromStates.includes(state)) continue;

    // Self-only actions: mark_in_progress, mark_blocked require being the assignee
    if (def.permissionRule === "self_or_org_member" && item.assigneeId && item.assigneeId !== userId) {
      continue;
    }

    actions.push(action as AssignmentAction);
  }

  return actions;
}
