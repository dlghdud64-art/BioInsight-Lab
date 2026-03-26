/**
 * Request Draft Edit Activity — supplier-local 최소 추적 + quiet period 입력
 *
 * 고정 규칙:
 * 1. activity는 message/question/attachments/items의 실질 user edit만 기록.
 * 2. focus/blur/mount/scroll/tab change/review/programmatic patch → activity 금지.
 * 3. isUserActivelyTypingMessage는 heartbeat 기반 ephemeral. lastMessageEditedAt은 실제 timestamp.
 * 4. supplier별 독립 activity. 다른 supplier activity가 현재 eligibility를 오염하면 안 됨.
 * 5. generation eligibility는 activity selector → quiet input builder 경로만 사용.
 * 6. 실질 변화 없는 setValue는 timestamp churn 금지.
 */

// ── Model ──

export interface RequestDraftEditActivity {
  requestAssemblyId: string;
  supplierId: string;
  lastMessageEditedAt: string | null;
  lastQuestionEditedAt: string | null;
  lastAttachmentsEditedAt: string | null;
  lastItemsEditedAt: string | null;
  isUserActivelyTypingMessage: boolean;
  lastTypingHeartbeatAt: string | null;
}

export type RequestDraftEditActivityMap = Record<string, RequestDraftEditActivity>;

// ── Key ──

export function activityKey(requestAssemblyId: string, supplierId: string): string {
  return `${requestAssemblyId}:${supplierId}`;
}

// ── Empty activity ──

export function createEmptyActivity(requestAssemblyId: string, supplierId: string): RequestDraftEditActivity {
  return {
    requestAssemblyId,
    supplierId,
    lastMessageEditedAt: null,
    lastQuestionEditedAt: null,
    lastAttachmentsEditedAt: null,
    lastItemsEditedAt: null,
    isUserActivelyTypingMessage: false,
    lastTypingHeartbeatAt: null,
  };
}

// ── Selector ──

export function selectEditActivityForSupplier(
  activityMap: RequestDraftEditActivityMap,
  requestAssemblyId: string,
  supplierId: string
): RequestDraftEditActivity | null {
  return activityMap[activityKey(requestAssemblyId, supplierId)] ?? null;
}

// ── Record user edit (실질 변경만) ──

export type EditSource = "message" | "question" | "attachments" | "items";

export function recordUserEditActivity(
  activityMap: RequestDraftEditActivityMap,
  requestAssemblyId: string,
  supplierId: string,
  source: EditSource,
  now: string
): RequestDraftEditActivityMap {
  const key = activityKey(requestAssemblyId, supplierId);
  const prev = activityMap[key] ?? createEmptyActivity(requestAssemblyId, supplierId);
  const next = { ...prev };

  switch (source) {
    case "message":
      next.lastMessageEditedAt = now;
      next.lastTypingHeartbeatAt = now;
      next.isUserActivelyTypingMessage = true;
      break;
    case "question":
      next.lastQuestionEditedAt = now;
      break;
    case "attachments":
      next.lastAttachmentsEditedAt = now;
      break;
    case "items":
      next.lastItemsEditedAt = now;
      break;
  }

  return { ...activityMap, [key]: next };
}

// ── Typing clear ──

const TYPING_HEARTBEAT_THRESHOLD_MS = 2000; // 2초 heartbeat 없으면 typing 종료

export function shouldClearMessageTypingState(input: {
  isUserActivelyTypingMessage: boolean;
  lastTypingHeartbeatAt: string | null;
  now: string;
}): boolean {
  if (!input.isUserActivelyTypingMessage) return false;
  if (!input.lastTypingHeartbeatAt) return true;
  const elapsed = new Date(input.now).getTime() - new Date(input.lastTypingHeartbeatAt).getTime();
  return elapsed >= TYPING_HEARTBEAT_THRESHOLD_MS;
}

export function clearTypingIfNeeded(
  activityMap: RequestDraftEditActivityMap,
  requestAssemblyId: string,
  supplierId: string,
  now: string
): RequestDraftEditActivityMap {
  const key = activityKey(requestAssemblyId, supplierId);
  const activity = activityMap[key];
  if (!activity || !activity.isUserActivelyTypingMessage) return activityMap;

  if (shouldClearMessageTypingState({
    isUserActivelyTypingMessage: activity.isUserActivelyTypingMessage,
    lastTypingHeartbeatAt: activity.lastTypingHeartbeatAt,
    now,
  })) {
    return {
      ...activityMap,
      [key]: { ...activity, isUserActivelyTypingMessage: false },
    };
  }

  return activityMap;
}

// ── Supplier change: typing flag 안전 종료 ──

export function clearTypingOnSupplierChange(
  activityMap: RequestDraftEditActivityMap,
  requestAssemblyId: string,
  previousSupplierId: string
): RequestDraftEditActivityMap {
  const key = activityKey(requestAssemblyId, previousSupplierId);
  const activity = activityMap[key];
  if (!activity || !activity.isUserActivelyTypingMessage) return activityMap;

  // typing flag만 종료. editedAt는 유지.
  return {
    ...activityMap,
    [key]: { ...activity, isUserActivelyTypingMessage: false },
  };
}

// ── Quiet period input (generation eligibility용 표준 입력) ──

export interface RequestDraftQuietPeriodInput {
  now: string;
  lastMessageEditedAt: string | null;
  lastQuestionEditedAt: string | null;
  lastAttachmentsEditedAt: string | null;
  lastItemsEditedAt: string | null;
  isUserActivelyTypingMessage: boolean;
  lastTypingHeartbeatAt: string | null;
}

export function buildQuietPeriodInput(
  activity: RequestDraftEditActivity | null,
  now: string
): RequestDraftQuietPeriodInput {
  return {
    now,
    lastMessageEditedAt: activity?.lastMessageEditedAt ?? null,
    lastQuestionEditedAt: activity?.lastQuestionEditedAt ?? null,
    lastAttachmentsEditedAt: activity?.lastAttachmentsEditedAt ?? null,
    lastItemsEditedAt: activity?.lastItemsEditedAt ?? null,
    isUserActivelyTypingMessage: activity?.isUserActivelyTypingMessage ?? false,
    lastTypingHeartbeatAt: activity?.lastTypingHeartbeatAt ?? null,
  };
}

// ── Quiet period check (message vs field 분리) ──

const MESSAGE_QUIET_MS = 3000;  // message typing 후 3초
const FIELD_QUIET_MS = 1500;    // toggle/attachment/item 후 1.5초

export interface QuietPeriodResult {
  isQuiet: boolean;
  reason: "quiet" | "message_typing" | "message_debounce" | "field_debounce";
}

export function checkQuietPeriod(input: RequestDraftQuietPeriodInput): QuietPeriodResult {
  const nowMs = new Date(input.now).getTime();

  // 1. Message typing in progress → editing_in_progress
  if (input.isUserActivelyTypingMessage) {
    return { isQuiet: false, reason: "message_typing" };
  }

  // 2. Message debounce
  if (input.lastMessageEditedAt) {
    const elapsed = nowMs - new Date(input.lastMessageEditedAt).getTime();
    if (elapsed < MESSAGE_QUIET_MS) {
      return { isQuiet: false, reason: "message_debounce" };
    }
  }

  // 3. Field debounce (question/attachments/items)
  for (const ts of [input.lastQuestionEditedAt, input.lastAttachmentsEditedAt, input.lastItemsEditedAt]) {
    if (ts) {
      const elapsed = nowMs - new Date(ts).getTime();
      if (elapsed < FIELD_QUIET_MS) {
        return { isQuiet: false, reason: "field_debounce" };
      }
    }
  }

  return { isQuiet: true, reason: "quiet" };
}
