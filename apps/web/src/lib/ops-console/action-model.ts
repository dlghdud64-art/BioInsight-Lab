/**
 * ops-console/action-model.ts
 *
 * 공통 운영 액션 모델.
 * Detail / Inbox / Decision Panel이 공유하는
 * command taxonomy + readiness + handoff 구조입니다.
 *
 * domain contract에 넣지 않고 UI adapter 레벨에서만 사용합니다.
 *
 * @module ops-console/action-model
 */

// ---------------------------------------------------------------------------
// 1. Command Type Taxonomy
// ---------------------------------------------------------------------------

/**
 * 모든 command의 의미론적 분류.
 * 버튼 스타일보다 command 의미가 먼저 결정됩니다.
 */
export type CommandType =
  | 'execute'          // 즉시 실행 (PO issue, inventory posting)
  | 'review'           // 검토 후 결정 (vendor select with substitute)
  | 'resolve_blocker'  // 차단 해소 (doc upload, quarantine resolve)
  | 'handoff'          // 다음 엔티티/화면으로 전환
  | 'external_followup'// 외부 대기 독촉 (ack follow-up, vendor reminder)
  | 'navigation'       // 연결 엔티티 이동
  | 'destructive';     // 취소/거부/폐기

/**
 * Command의 시각적 우선순위 계층.
 */
export type CommandPriority = 'primary' | 'secondary' | 'triage' | 'context';

// ---------------------------------------------------------------------------
// 2. OperationalCommand — 공통 액션 인터페이스
// ---------------------------------------------------------------------------

export interface OperationalCommand {
  /** 고유 ID */
  id: string;
  /** 표시 라벨 (Korean) */
  label: string;
  /** 의미론적 분류 */
  commandType: CommandType;
  /** 시각적 우선순위 */
  priority: CommandPriority;
  /** 실행 가능 여부 */
  canExecute: boolean;
  /** 비활성 사유 (canExecute=false일 때) */
  blockedReasons: string[];
  /** 검토가 필요한 이유 (commandType=review일 때) */
  reviewReasons: string[];
  /** 확인 대화상자 필요 여부 */
  confirmRequired: boolean;
  /** 확인 메시지 */
  confirmMessage?: string;
  /** 파괴적 액션 여부 */
  destructive: boolean;
  /** 실행 핸들러 */
  onExecute: () => void;
  /** 다음 담당자 */
  nextOwner?: string;
  /** 다음 라우트 */
  nextRoute?: string;
  /** 실행 후 효과 요약 */
  postActionSummary?: string;
}

// ---------------------------------------------------------------------------
// 3. Command Surface — 화면 단위 command 집합
// ---------------------------------------------------------------------------

export interface CommandSurface {
  /** 현재 readiness 요약 (Korean) */
  readinessSummary: string;
  /** 전체적으로 실행 가능 상태인지 */
  isReady: boolean;
  /** Primary command (항상 1개) */
  primaryCommand: OperationalCommand | null;
  /** Secondary commands (2~4개) */
  secondaryCommands: OperationalCommand[];
  /** Triage / review commands */
  triageCommands: OperationalCommand[];
  /** Context / navigation commands */
  contextCommands: OperationalCommand[];
  /** Blocked reason 집계 */
  aggregatedBlockers: string[];
  /** 다음 handoff 대상 */
  handoffTarget?: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// 4. Post-Action Feedback
// ---------------------------------------------------------------------------

export interface PostActionFeedback {
  /** 무엇이 바뀌었는지 */
  stateChange: string;
  /** 다음 작업 */
  nextTask: string;
  /** 이동 가능한 곳 */
  nextRoute?: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// 5. Inbox Quick Action
// ---------------------------------------------------------------------------

export interface InboxQuickAction {
  /** 라벨 */
  label: string;
  /** 실행 가능 여부 */
  canExecute: boolean;
  /** detail로 deep-link가 필요한지 */
  requiresDetail: boolean;
  /** 실행 핸들러 (requiresDetail=false일 때) */
  onExecute?: () => void;
  /** detail route (requiresDetail=true일 때) */
  detailRoute?: string;
}

// ---------------------------------------------------------------------------
// 6. Style helpers
// ---------------------------------------------------------------------------

/** Command priority → Tailwind class mapping */
export const COMMAND_PRIORITY_STYLES: Record<CommandPriority, string> = {
  primary: 'bg-blue-600 hover:bg-blue-500 text-white font-medium',
  secondary: 'bg-slate-700 hover:bg-slate-600 text-slate-200',
  triage: 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700',
  context: 'text-slate-400 hover:text-slate-200 underline-offset-2',
};

/** Command type → icon hint (UI에서 사용) */
export const COMMAND_TYPE_HINTS: Record<CommandType, { iconHint: string; tone: string }> = {
  execute: { iconHint: 'play', tone: 'text-blue-400' },
  review: { iconHint: 'eye', tone: 'text-amber-400' },
  resolve_blocker: { iconHint: 'unlock', tone: 'text-red-400' },
  handoff: { iconHint: 'arrow-right', tone: 'text-teal-400' },
  external_followup: { iconHint: 'mail', tone: 'text-purple-400' },
  navigation: { iconHint: 'link', tone: 'text-slate-400' },
  destructive: { iconHint: 'trash', tone: 'text-red-400' },
};

// ---------------------------------------------------------------------------
// 7. Builder helpers
// ---------------------------------------------------------------------------

/** Create an execute command */
export function createExecuteCommand(
  id: string,
  label: string,
  onExecute: () => void,
  opts: {
    canExecute?: boolean;
    blockedReasons?: string[];
    confirmRequired?: boolean;
    confirmMessage?: string;
    nextRoute?: string;
    nextOwner?: string;
    postActionSummary?: string;
    priority?: CommandPriority;
  } = {},
): OperationalCommand {
  return {
    id,
    label,
    commandType: 'execute',
    priority: opts.priority ?? 'primary',
    canExecute: opts.canExecute ?? true,
    blockedReasons: opts.blockedReasons ?? [],
    reviewReasons: [],
    confirmRequired: opts.confirmRequired ?? false,
    confirmMessage: opts.confirmMessage,
    destructive: false,
    onExecute,
    nextRoute: opts.nextRoute,
    nextOwner: opts.nextOwner,
    postActionSummary: opts.postActionSummary,
  };
}

/** Create a review command */
export function createReviewCommand(
  id: string,
  label: string,
  onExecute: () => void,
  reviewReasons: string[],
  opts: {
    canExecute?: boolean;
    confirmRequired?: boolean;
    confirmMessage?: string;
    priority?: CommandPriority;
  } = {},
): OperationalCommand {
  return {
    id,
    label,
    commandType: 'review',
    priority: opts.priority ?? 'secondary',
    canExecute: opts.canExecute ?? true,
    blockedReasons: [],
    reviewReasons,
    confirmRequired: opts.confirmRequired ?? false,
    confirmMessage: opts.confirmMessage,
    destructive: false,
    onExecute,
  };
}

/** Create a handoff/navigation command */
export function createHandoffCommand(
  id: string,
  label: string,
  href: string,
  onNavigate: () => void,
  opts: { priority?: CommandPriority } = {},
): OperationalCommand {
  return {
    id,
    label,
    commandType: 'handoff',
    priority: opts.priority ?? 'context',
    canExecute: true,
    blockedReasons: [],
    reviewReasons: [],
    confirmRequired: false,
    destructive: false,
    onExecute: onNavigate,
    nextRoute: href,
  };
}

/** Create a blocker resolution command */
export function createBlockerCommand(
  id: string,
  label: string,
  onExecute: () => void,
  blockedReasons: string[],
  opts: { canExecute?: boolean; priority?: CommandPriority } = {},
): OperationalCommand {
  return {
    id,
    label,
    commandType: 'resolve_blocker',
    priority: opts.priority ?? 'triage',
    canExecute: opts.canExecute ?? false,
    blockedReasons,
    reviewReasons: [],
    confirmRequired: false,
    destructive: false,
    onExecute,
  };
}
