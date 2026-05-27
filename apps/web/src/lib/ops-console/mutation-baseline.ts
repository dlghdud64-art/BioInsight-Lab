/**
 * mutation-baseline.ts
 *
 * Core Mutation Baseline — 공통 mutation execution / state / invalidation 경계.
 *
 * UI action → command model → repository mutation → provider apply →
 * normalized result → invalidate/refetch → updated screen semantics
 *
 * Screen이 provider를 직접 호출하지 않고, command를 repository를 통해 실행.
 * mutation 결과는 shared normalization path로 다시 흐른다.
 *
 * @module ops-console/mutation-baseline
 */

import type { EntityType } from './production-readiness-plan';

// ===========================================================================
// 1. Mutation State Model
// ===========================================================================

export type MutationPhase =
  | 'idle'
  | 'pending'
  | 'success'
  | 'failure'
  | 'stale_conflict'
  | 'retry_available'
  | 'handoff_ready';

export interface MutationState<TResult = unknown> {
  phase: MutationPhase;
  commandType: string;
  entityType: EntityType;
  entityId: string;
  /** 결과 데이터 (success 시) */
  result?: TResult;
  /** 생성된 downstream entity ID (있으면) */
  createdEntityId?: string;
  /** 생성된 downstream entity route */
  createdEntityRoute?: string;
  /** 에러 코드 */
  errorCode?: string;
  /** 에러 메시지 */
  errorMessage?: string;
  /** 충돌 시 최신 상태 route */
  conflictRoute?: string;
  /** 충돌 설명 */
  conflictExplanation?: string;
  /** 재시도 가능 여부 */
  retryable: boolean;
  /** invalidation 대상 scope */
  invalidationScope: InvalidationScope;
  /** 실행 시각 */
  startedAt?: string;
  /** 완료 시각 */
  completedAt?: string;
}

// ===========================================================================
// 2. Command Definition
// ===========================================================================

export type CoreCommandType =
  | 'select_quote_vendor'
  | 'create_po_from_quote'
  | 'submit_po_issue'
  | 'record_vendor_acknowledgement'
  | 'complete_receiving_inspection'
  | 'save_receiving_lot_capture'
  | 'post_inventory_inbound'
  | 'create_quote_from_reorder';

export interface CommandPayload {
  commandType: CoreCommandType;
  entityType: EntityType;
  entityId: string;
  payload: Record<string, unknown>;
  /** idempotency key (confirmed-required commands) */
  idempotencyKey?: string;
  /** known version for stale precheck */
  expectedVersion?: string;
}

// ===========================================================================
// 3. Mutation Result
// ===========================================================================

export interface MutationResult {
  status: 'success' | 'stale_conflict' | 'permission_denied' | 'validation_error' | 'duplicate_request' | 'partial_success' | 'error';
  createdEntityId?: string;
  createdEntityRoute?: string;
  newVersion?: string;
  conflictDetail?: string;
  retryable: boolean;
  invalidationScope: InvalidationScope;
}

// ===========================================================================
// 4. Invalidation Scope
// ===========================================================================

export interface InvalidationScope {
  /** 재계산해야 하는 entity */
  entities: { type: EntityType; id: string }[];
  /** 재계산해야 하는 화면/projection */
  projections: string[];
  /** 전체 inbox 재계산 필요 */
  inbox: boolean;
  /** 전체 dashboard 재계산 필요 */
  dashboard: boolean;
}

// ===========================================================================
// 5. Command → Invalidation Mapping
// ===========================================================================

export const COMMAND_INVALIDATION_MAP: Record<CoreCommandType, {
  projections: string[];
  inbox: boolean;
  dashboard: boolean;
  linkedModules: string[];
}> = {
  select_quote_vendor: {
    projections: ['quote_detail', 'quotes_landing'],
    inbox: true,
    dashboard: true,
    linkedModules: ['po_handoff_summary'],
  },
  create_po_from_quote: {
    projections: ['quote_detail', 'po_landing'],
    inbox: true,
    dashboard: true,
    linkedModules: [],
  },
  submit_po_issue: {
    projections: ['po_detail', 'po_landing'],
    inbox: true,
    dashboard: true,
    linkedModules: ['receiving_handoff_preview'],
  },
  record_vendor_acknowledgement: {
    projections: ['po_detail', 'po_landing'],
    inbox: true,
    dashboard: true,
    linkedModules: ['receiving_handoff_readiness'],
  },
  complete_receiving_inspection: {
    projections: ['receiving_detail', 'receiving_landing'],
    inbox: true,
    dashboard: true,
    linkedModules: ['posting_readiness'],
  },
  save_receiving_lot_capture: {
    projections: ['receiving_detail'],
    inbox: false,
    dashboard: false,
    linkedModules: ['posting_blocker_recalc'],
  },
  post_inventory_inbound: {
    projections: ['receiving_detail', 'receiving_landing', 'stock_risk'],
    inbox: true,
    dashboard: true,
    linkedModules: ['stock_risk_handoff'],
  },
  create_quote_from_reorder: {
    projections: ['stock_risk_detail', 'quotes_landing'],
    inbox: true,
    dashboard: true,
    linkedModules: ['sourcing_recovery_summary'],
  },
};

// ===========================================================================
// 6. Optimistic / Confirmed Classification
// ===========================================================================

export const COMMAND_OPTIMISTIC_RULES: Record<CoreCommandType, {
  optimisticAllowed: boolean;
  confirmedRequired: boolean;
  notes: string;
}> = {
  select_quote_vendor: {
    optimisticAllowed: true,
    confirmedRequired: false,
    notes: '제한적 optimistic 가능. handoff 전 재검증 필요.',
  },
  create_po_from_quote: {
    optimisticAllowed: false,
    confirmedRequired: true,
    notes: 'confirmed result 우선. canonical PO id 필요.',
  },
  submit_po_issue: {
    optimisticAllowed: false,
    confirmedRequired: true,
    notes: 'confirmed result 우선.',
  },
  record_vendor_acknowledgement: {
    optimisticAllowed: true,
    confirmedRequired: false,
    notes: '부분 optimistic 가능. canonical refresh 필요.',
  },
  complete_receiving_inspection: {
    optimisticAllowed: false,
    confirmedRequired: true,
    notes: 'confirmed result 우선.',
  },
  save_receiving_lot_capture: {
    optimisticAllowed: true,
    confirmedRequired: false,
    notes: '부분 optimistic 가능. partial save 허용.',
  },
  post_inventory_inbound: {
    optimisticAllowed: false,
    confirmedRequired: true,
    notes: 'confirmed result 우선.',
  },
  create_quote_from_reorder: {
    optimisticAllowed: false,
    confirmedRequired: true,
    notes: 'confirmed entity id 우선.',
  },
};

// ===========================================================================
// 7. Stale Conflict Handling
// ===========================================================================

export const STALE_CONFLICT_HANDLERS: Record<string, {
  explanation: string;
  recoveryActions: { label: string; action: 'refetch' | 'redirect' | 'retry' }[];
}> = {
  already_selected: {
    explanation: '이미 공급사가 선정되었습니다.',
    recoveryActions: [
      { label: '최신 상태 확인', action: 'refetch' },
      { label: 'PO 생성으로 이동', action: 'redirect' },
    ],
  },
  already_created: {
    explanation: '이미 생성된 항목입니다.',
    recoveryActions: [
      { label: '생성된 항목 보기', action: 'redirect' },
    ],
  },
  already_issued: {
    explanation: '이미 발행된 발주입니다.',
    recoveryActions: [
      { label: '최신 상태 확인', action: 'refetch' },
    ],
  },
  already_posted: {
    explanation: '이미 재고에 반영되었습니다.',
    recoveryActions: [
      { label: '재고 현황 확인', action: 'redirect' },
    ],
  },
  already_converted: {
    explanation: '이미 다음 단계로 전환되었습니다.',
    recoveryActions: [
      { label: '전환된 항목 보기', action: 'redirect' },
    ],
  },
  version_mismatch: {
    explanation: '다른 사용자가 변경했습니다. 최신 상태를 확인하세요.',
    recoveryActions: [
      { label: '최신 상태 확인', action: 'refetch' },
      { label: '다시 시도', action: 'retry' },
    ],
  },
};

// ===========================================================================
// 8. Failure Recovery Guidance
// ===========================================================================

export const FAILURE_RECOVERY_GUIDANCE: Record<string, {
  title: string;
  description: string;
  retryable: boolean;
  alternatives: { label: string; route?: string }[];
}> = {
  validation_error: {
    title: '입력 값을 확인해주세요',
    description: '제출된 정보에 오류가 있습니다. 수정 후 다시 시도하세요.',
    retryable: true,
    alternatives: [],
  },
  permission_denied: {
    title: '권한이 없습니다',
    description: '이 작업을 수행할 권한이 없습니다. 관리자에게 문의하세요.',
    retryable: false,
    alternatives: [
      { label: '작업함으로', route: '/dashboard/inbox' },
    ],
  },
  network_error: {
    title: '네트워크 오류',
    description: '서버와 통신에 실패했습니다. 잠시 후 다시 시도하세요.',
    retryable: true,
    alternatives: [],
  },
  server_error: {
    title: '서버 오류',
    description: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.',
    retryable: true,
    alternatives: [
      { label: '오늘로', route: '/dashboard' },
    ],
  },
  timeout: {
    title: '요청 시간 초과',
    description: '처리 시간이 초과되었습니다. 결과를 확인 후 다시 시도하세요.',
    retryable: true,
    alternatives: [
      { label: '최신 상태 확인', route: undefined }, // current page refresh
    ],
  },
};

// ===========================================================================
// 9. Downstream Handoff Builder
// ===========================================================================

export interface DownstreamHandoff {
  available: boolean;
  targetEntityId?: string;
  targetRoute?: string;
  targetLabel?: string;
  targetModule?: string;
}

/**
 * Mutation 성공 후 downstream handoff 정보를 빌드한다.
 */
export function buildDownstreamHandoff(
  commandType: CoreCommandType,
  result: MutationResult,
): DownstreamHandoff {
  if (result.status !== 'success' && result.status !== 'partial_success') {
    return { available: false };
  }

  switch (commandType) {
    case 'create_po_from_quote':
      return {
        available: !!result.createdEntityId,
        targetEntityId: result.createdEntityId,
        targetRoute: result.createdEntityRoute || (result.createdEntityId ? `/dashboard/purchase-orders/${result.createdEntityId}` : undefined),
        targetLabel: '생성된 발주 보기',
        targetModule: 'purchase_orders',
      };

    case 'submit_po_issue':
      return {
        available: true,
        targetRoute: '/dashboard/receiving',
        targetLabel: '입고 예정 확인',
        targetModule: 'receiving',
      };

    case 'post_inventory_inbound':
      return {
        available: true,
        targetRoute: '/dashboard/stock-risk',
        targetLabel: '재고 현황 확인',
        targetModule: 'stock_risk',
      };

    case 'create_quote_from_reorder':
      return {
        available: !!result.createdEntityId,
        targetEntityId: result.createdEntityId,
        targetRoute: result.createdEntityRoute || (result.createdEntityId ? `/dashboard/quotes/${result.createdEntityId}` : undefined),
        targetLabel: '생성된 견적 보기',
        targetModule: 'quotes',
      };

    default:
      return { available: false };
  }
}

// ===========================================================================
// 10. Build Invalidation Scope from Command
// ===========================================================================

/**
 * CommandPayload에서 InvalidationScope를 빌드한다.
 */
export function buildInvalidationScope(
  command: CommandPayload,
  result: MutationResult,
): InvalidationScope {
  const mapping = COMMAND_INVALIDATION_MAP[command.commandType];

  const entities: { type: EntityType; id: string }[] = [
    { type: command.entityType, id: command.entityId },
  ];

  // downstream entity도 포함
  if (result.createdEntityId) {
    const downstreamType = resolveDownstreamEntityType(command.commandType);
    if (downstreamType) {
      entities.push({ type: downstreamType, id: result.createdEntityId });
    }
  }

  return {
    entities,
    projections: mapping.projections,
    inbox: mapping.inbox,
    dashboard: mapping.dashboard,
  };
}

function resolveDownstreamEntityType(commandType: CoreCommandType): EntityType | null {
  switch (commandType) {
    case 'create_po_from_quote': return 'po';
    case 'create_quote_from_reorder': return 'quote';
    default: return null;
  }
}

// ===========================================================================
// 11. Command Eligibility Check
// ===========================================================================

export interface CommandEligibility {
  canExecute: boolean;
  blockedReasons: string[];
  reviewReasons: string[];
  permissionIssue?: string;
  stalePrecondition: boolean;
}

/**
 * Command 실행 가능 여부를 사전 검사한다.
 * Action surface에서 CTA 활성화/비활성화에 사용.
 */
export function checkCommandEligibility(
  commandType: CoreCommandType,
  entityState: {
    readiness: string;
    blockers: string[];
    reviewRequired: boolean;
    ownerMatch: boolean;
    hasPermission: boolean;
    versionKnown: boolean;
  },
): CommandEligibility {
  const blockedReasons: string[] = [];
  const reviewReasons: string[] = [];

  // Blocker check
  if (entityState.blockers.length > 0) {
    blockedReasons.push(...entityState.blockers);
  }

  // Review check
  if (entityState.reviewRequired) {
    reviewReasons.push('검토가 필요합니다');
  }

  // Permission check
  let permissionIssue: string | undefined;
  if (!entityState.hasPermission) {
    permissionIssue = '이 작업을 수행할 권한이 없습니다';
  }

  // Stale check
  const stalePrecondition = !entityState.versionKnown;

  const canExecute =
    blockedReasons.length === 0 &&
    !permissionIssue &&
    !entityState.reviewRequired;

  return {
    canExecute,
    blockedReasons,
    reviewReasons,
    permissionIssue,
    stalePrecondition,
  };
}
