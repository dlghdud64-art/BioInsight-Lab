/**
 * conflict-idempotency.ts
 *
 * Command Conflict / Idempotency Hardening Baseline.
 *
 * 중복 실행, 재시도, stale state, 이미 완료된 downstream handoff 상황에서
 * 핵심 command가 같은 truth를 유지하도록 conflict 분류 + idempotent result mapping +
 * retry 전략 + exact handoff resolution을 정의한다.
 *
 * @module ops-console/conflict-idempotency
 */

import type { CoreCommandType } from './mutation-baseline';

// ===========================================================================
// 1. Conflict Taxonomy
// ===========================================================================

export type ConflictType =
  | 'already_applied'               // 같은 command가 이미 적용됨
  | 'duplicate_request'             // 중복 요청 (double click 등)
  | 'stale_precondition'           // 전제 조건이 변경됨
  | 'transition_not_allowed'       // 현재 상태에서 허용되지 않는 전이
  | 'linked_downstream_already_exists' // downstream entity가 이미 생성됨
  | 'ownership_or_permission_conflict' // 권한/소유권 충돌
  | 'policy_blocked'               // 정책(예산/한도) 차단
  | 'partial_success_conflict';    // 부분 성공 후 재시도 충돌

// ===========================================================================
// 2. Idempotent Result Model
// ===========================================================================

export type IdempotentResultType =
  | 'applied'                       // 정상 적용
  | 'already_applied_same_result'  // 이미 같은 결과로 적용됨 (no-op success)
  | 'existing_downstream_reuse'    // downstream entity 이미 존재, reuse
  | 'retryable_failure'            // 재시도 가능한 실패
  | 'non_retryable_failure'        // 재시도 불가 실패
  | 'stale_conflict'               // stale 상태 충돌
  | 'blocked_precondition';        // 전제 조건 미충족

export interface IdempotentResult {
  type: IdempotentResultType;
  /** 원래 command type */
  commandType: CoreCommandType;
  /** canonical entity id */
  canonicalEntityId: string;
  /** downstream entity id (있으면) */
  downstreamEntityId?: string;
  /** canonical next route */
  canonicalNextRoute?: string;
  /** 충돌 설명 class */
  conflictType?: ConflictType;
  /** 사용자 안내 메시지 */
  explanation: string;
  /** retry 허용 여부 */
  retryAllowed: boolean;
  /** refetch 필요 여부 */
  refetchRequired: boolean;
  /** 기존 truth로 수렴 가능 여부 */
  convergesWithExistingTruth: boolean;
}

// ===========================================================================
// 3. Conflict Explanation Templates
// ===========================================================================

export const CONFLICT_EXPLANATIONS: Record<ConflictType, {
  title: string;
  description: string;
  suggestedAction: string;
}> = {
  already_applied: {
    title: '이미 처리되었습니다',
    description: '이 작업은 이미 적용되었습니다. 현재 상태를 확인하세요.',
    suggestedAction: '현재 상태 확인',
  },
  duplicate_request: {
    title: '중복 요청',
    description: '동일한 요청이 이미 처리되었습니다.',
    suggestedAction: '결과 확인',
  },
  stale_precondition: {
    title: '상태가 변경되었습니다',
    description: '다른 사용자가 먼저 변경했습니다. 최신 상태를 확인 후 다시 시도하세요.',
    suggestedAction: '최신 상태 불러오기',
  },
  transition_not_allowed: {
    title: '현재 상태에서 불가',
    description: '이 작업은 현재 상태에서 수행할 수 없습니다.',
    suggestedAction: '상태 확인',
  },
  linked_downstream_already_exists: {
    title: '이미 다음 단계가 존재합니다',
    description: '이 작업의 결과물이 이미 생성되어 있습니다.',
    suggestedAction: '생성된 항목 보기',
  },
  ownership_or_permission_conflict: {
    title: '권한 충돌',
    description: '다른 담당자가 이 작업을 처리 중이거나 권한이 변경되었습니다.',
    suggestedAction: '담당자 확인',
  },
  policy_blocked: {
    title: '정책 제한',
    description: '예산, 한도 또는 조직 정책에 의해 차단되었습니다.',
    suggestedAction: '정책 확인',
  },
  partial_success_conflict: {
    title: '부분 처리 충돌',
    description: '이전 처리가 부분 완료되었습니다. 나머지를 확인하세요.',
    suggestedAction: '처리 상태 확인',
  },
};

// ===========================================================================
// 4. Per-Command Conflict Rules
// ===========================================================================

export interface CommandConflictRule {
  /** 이미 같은 결과가 적용된 경우 처리 */
  onAlreadyApplied: 'treat_as_success' | 'show_existing_truth';
  /** downstream entity가 이미 있을 때 */
  onDownstreamExists: 'redirect_to_downstream' | 'block_and_explain';
  /** stale precondition 시 */
  onStalePrecondition: 'refetch_and_retry' | 'refetch_and_explain';
  /** duplicate request 시 */
  onDuplicateRequest: 'idempotent_success' | 'block_duplicate';
  /** retry 전략 */
  retryStrategy: RetryStrategy;
  /** downstream route 패턴 (있으면) */
  downstreamRoutePattern?: string;
}

export type RetryStrategy =
  | 'safe_retry'                  // 바로 재시도 안전
  | 'refresh_then_retry'         // 최신 상태 확인 후 재시도
  | 'do_not_retry_use_existing'  // 재시도 금지, 기존 truth 사용
  | 'resolve_blocker_first';     // blocker 해소 후 재시도

export const COMMAND_CONFLICT_RULES: Record<CoreCommandType, CommandConflictRule> = {
  select_quote_vendor: {
    onAlreadyApplied: 'treat_as_success',
    onDownstreamExists: 'redirect_to_downstream',
    onStalePrecondition: 'refetch_and_retry',
    onDuplicateRequest: 'idempotent_success',
    retryStrategy: 'safe_retry',
    downstreamRoutePattern: '/dashboard/purchase-orders/{downstreamId}',
  },
  create_po_from_quote: {
    onAlreadyApplied: 'show_existing_truth',
    onDownstreamExists: 'redirect_to_downstream',
    onStalePrecondition: 'refetch_and_explain',
    onDuplicateRequest: 'idempotent_success',
    retryStrategy: 'do_not_retry_use_existing',
    downstreamRoutePattern: '/dashboard/purchase-orders/{downstreamId}',
  },
  submit_po_issue: {
    onAlreadyApplied: 'treat_as_success',
    onDownstreamExists: 'redirect_to_downstream',
    onStalePrecondition: 'refetch_and_retry',
    onDuplicateRequest: 'idempotent_success',
    retryStrategy: 'refresh_then_retry',
  },
  record_vendor_acknowledgement: {
    onAlreadyApplied: 'treat_as_success',
    onDownstreamExists: 'redirect_to_downstream',
    onStalePrecondition: 'refetch_and_retry',
    onDuplicateRequest: 'idempotent_success',
    retryStrategy: 'safe_retry',
  },
  complete_receiving_inspection: {
    onAlreadyApplied: 'show_existing_truth',
    onDownstreamExists: 'redirect_to_downstream',
    onStalePrecondition: 'refetch_and_explain',
    onDuplicateRequest: 'idempotent_success',
    retryStrategy: 'refresh_then_retry',
  },
  save_receiving_lot_capture: {
    onAlreadyApplied: 'treat_as_success',
    onDownstreamExists: 'redirect_to_downstream',
    onStalePrecondition: 'refetch_and_retry',
    onDuplicateRequest: 'idempotent_success',
    retryStrategy: 'safe_retry',
  },
  post_inventory_inbound: {
    onAlreadyApplied: 'show_existing_truth',
    onDownstreamExists: 'redirect_to_downstream',
    onStalePrecondition: 'refetch_and_explain',
    onDuplicateRequest: 'idempotent_success',
    retryStrategy: 'do_not_retry_use_existing',
  },
  create_quote_from_reorder: {
    onAlreadyApplied: 'show_existing_truth',
    onDownstreamExists: 'redirect_to_downstream',
    onStalePrecondition: 'refetch_and_explain',
    onDuplicateRequest: 'idempotent_success',
    retryStrategy: 'do_not_retry_use_existing',
    downstreamRoutePattern: '/dashboard/quotes/{downstreamId}',
  },
};

// ===========================================================================
// 5. Classify Mutation Result → IdempotentResult
// ===========================================================================

/**
 * Raw mutation result를 IdempotentResult로 분류한다.
 * Screen은 이 결과를 기반으로 다음 행동을 결정한다.
 */
export function classifyMutationResult(
  commandType: CoreCommandType,
  rawResult: {
    status: string;
    errorCode?: string;
    createdEntityId?: string;
    createdEntityRoute?: string;
    existingEntityId?: string;
    existingEntityRoute?: string;
    conflictDetail?: string;
    newVersion?: string;
  },
  entityId: string,
): IdempotentResult {
  const rules = COMMAND_CONFLICT_RULES[commandType];

  // Success → applied
  if (rawResult.status === 'success') {
    return {
      type: 'applied',
      commandType,
      canonicalEntityId: entityId,
      downstreamEntityId: rawResult.createdEntityId,
      canonicalNextRoute: rawResult.createdEntityRoute,
      explanation: '정상 처리되었습니다.',
      retryAllowed: false,
      refetchRequired: false,
      convergesWithExistingTruth: true,
    };
  }

  // Duplicate request → idempotent success or existing truth
  if (rawResult.status === 'duplicate_request' || rawResult.errorCode === 'duplicate') {
    const existingRoute = rawResult.existingEntityRoute || resolveDownstreamRoute(rules, rawResult.existingEntityId);
    return {
      type: rawResult.existingEntityId ? 'existing_downstream_reuse' : 'already_applied_same_result',
      commandType,
      canonicalEntityId: entityId,
      downstreamEntityId: rawResult.existingEntityId,
      canonicalNextRoute: existingRoute,
      conflictType: 'duplicate_request',
      explanation: CONFLICT_EXPLANATIONS.duplicate_request.description,
      retryAllowed: false,
      refetchRequired: false,
      convergesWithExistingTruth: true,
    };
  }

  // Stale conflict
  if (rawResult.status === 'stale_conflict' || rawResult.errorCode === 'stale') {
    return {
      type: 'stale_conflict',
      commandType,
      canonicalEntityId: entityId,
      conflictType: 'stale_precondition',
      explanation: CONFLICT_EXPLANATIONS.stale_precondition.description,
      retryAllowed: rules.retryStrategy !== 'do_not_retry_use_existing',
      refetchRequired: true,
      convergesWithExistingTruth: false,
    };
  }

  // Already applied (transition not allowed because already in target state)
  if (rawResult.errorCode === 'already_applied' || rawResult.errorCode === 'already_issued' || rawResult.errorCode === 'already_posted' || rawResult.errorCode === 'already_selected') {
    const existingRoute = rawResult.existingEntityRoute || resolveDownstreamRoute(rules, rawResult.existingEntityId);
    return {
      type: 'already_applied_same_result',
      commandType,
      canonicalEntityId: entityId,
      downstreamEntityId: rawResult.existingEntityId,
      canonicalNextRoute: existingRoute,
      conflictType: 'already_applied',
      explanation: CONFLICT_EXPLANATIONS.already_applied.description,
      retryAllowed: false,
      refetchRequired: true,
      convergesWithExistingTruth: true,
    };
  }

  // Permission denied
  if (rawResult.status === 'permission_denied') {
    return {
      type: 'non_retryable_failure',
      commandType,
      canonicalEntityId: entityId,
      conflictType: 'ownership_or_permission_conflict',
      explanation: CONFLICT_EXPLANATIONS.ownership_or_permission_conflict.description,
      retryAllowed: false,
      refetchRequired: false,
      convergesWithExistingTruth: false,
    };
  }

  // Validation error
  if (rawResult.status === 'validation_error') {
    return {
      type: 'retryable_failure',
      commandType,
      canonicalEntityId: entityId,
      explanation: rawResult.conflictDetail || '입력 값을 확인해주세요.',
      retryAllowed: true,
      refetchRequired: false,
      convergesWithExistingTruth: false,
    };
  }

  // Partial success
  if (rawResult.status === 'partial_success') {
    return {
      type: 'applied',
      commandType,
      canonicalEntityId: entityId,
      downstreamEntityId: rawResult.createdEntityId,
      canonicalNextRoute: rawResult.createdEntityRoute,
      conflictType: 'partial_success_conflict',
      explanation: CONFLICT_EXPLANATIONS.partial_success_conflict.description,
      retryAllowed: true,
      refetchRequired: true,
      convergesWithExistingTruth: false,
    };
  }

  // Generic error fallback
  return {
    type: 'retryable_failure',
    commandType,
    canonicalEntityId: entityId,
    explanation: rawResult.conflictDetail || '처리 중 오류가 발생했습니다.',
    retryAllowed: true,
    refetchRequired: true,
    convergesWithExistingTruth: false,
  };
}

// ===========================================================================
// 6. Resolve Downstream Route
// ===========================================================================

function resolveDownstreamRoute(
  rules: CommandConflictRule,
  downstreamId?: string,
): string | undefined {
  if (!downstreamId || !rules.downstreamRoutePattern) return undefined;
  return rules.downstreamRoutePattern.replace('{downstreamId}', downstreamId);
}

// ===========================================================================
// 7. Retry Decision Helper
// ===========================================================================

export interface RetryDecision {
  action: 'retry' | 'refetch_first' | 'use_existing' | 'resolve_blocker' | 'abort';
  label: string;
  route?: string;
}

/**
 * IdempotentResult를 기반으로 retry 결정을 생성한다.
 */
export function buildRetryDecision(result: IdempotentResult): RetryDecision {
  // Already applied or duplicate → use existing
  if (
    result.type === 'already_applied_same_result' ||
    result.type === 'existing_downstream_reuse'
  ) {
    return {
      action: 'use_existing',
      label: result.canonicalNextRoute ? '결과 보기' : '현재 상태 확인',
      route: result.canonicalNextRoute,
    };
  }

  // Stale conflict → refetch first
  if (result.type === 'stale_conflict') {
    return {
      action: 'refetch_first',
      label: '최신 상태 불러오기',
    };
  }

  // Blocked precondition
  if (result.type === 'blocked_precondition') {
    return {
      action: 'resolve_blocker',
      label: '차단 사유 해결',
    };
  }

  // Retryable failure
  if (result.type === 'retryable_failure') {
    return {
      action: 'retry',
      label: '다시 시도',
    };
  }

  // Non-retryable
  if (result.type === 'non_retryable_failure') {
    return {
      action: 'abort',
      label: '작업함으로',
      route: '/dashboard/inbox',
    };
  }

  // Applied (success)
  return {
    action: 'use_existing',
    label: '완료',
    route: result.canonicalNextRoute,
  };
}

// ===========================================================================
// 8. Duplicate Prevention Checklist
// ===========================================================================

/**
 * Command 실행 전 중복 방지 사전 검사 항목.
 * Button disable만으로는 부족하며, mutation layer에서 처리해야 한다.
 */
export const DUPLICATE_PREVENTION_CHECKS: Record<CoreCommandType, {
  checkDescription: string;
  fieldToCheck: string;
  conflictIfTrue: ConflictType;
}[]> = {
  select_quote_vendor: [
    { checkDescription: '이미 같은 vendor 선택됨', fieldToCheck: 'selectedVendorId', conflictIfTrue: 'already_applied' },
    { checkDescription: 'PO가 이미 생성됨', fieldToCheck: 'linkedPOId', conflictIfTrue: 'linked_downstream_already_exists' },
  ],
  create_po_from_quote: [
    { checkDescription: 'PO가 이미 생성됨', fieldToCheck: 'convertedPOId', conflictIfTrue: 'linked_downstream_already_exists' },
    { checkDescription: 'Quote가 이미 converted 상태', fieldToCheck: 'quoteStatus', conflictIfTrue: 'transition_not_allowed' },
  ],
  submit_po_issue: [
    { checkDescription: '이미 issued 상태', fieldToCheck: 'poIssued', conflictIfTrue: 'already_applied' },
  ],
  record_vendor_acknowledgement: [
    { checkDescription: '동일 ack 이미 반영됨', fieldToCheck: 'lastAckPayloadHash', conflictIfTrue: 'already_applied' },
  ],
  complete_receiving_inspection: [
    { checkDescription: '이미 inspection 완료', fieldToCheck: 'inspectionCompleted', conflictIfTrue: 'already_applied' },
  ],
  save_receiving_lot_capture: [
    { checkDescription: '동일 lot 데이터', fieldToCheck: 'lotDataHash', conflictIfTrue: 'already_applied' },
  ],
  post_inventory_inbound: [
    { checkDescription: '이미 posting 완료', fieldToCheck: 'postingCompleted', conflictIfTrue: 'already_applied' },
    { checkDescription: '해당 line 이미 posted', fieldToCheck: 'linePostingStatus', conflictIfTrue: 'partial_success_conflict' },
  ],
  create_quote_from_reorder: [
    { checkDescription: '이미 linked quote 존재', fieldToCheck: 'linkedQuoteId', conflictIfTrue: 'linked_downstream_already_exists' },
    { checkDescription: '중복 open flow 존재', fieldToCheck: 'openFlowExists', conflictIfTrue: 'duplicate_request' },
  ],
};

// ===========================================================================
// 9. Conflict → Screen Semantics Mapping
// ===========================================================================

/**
 * IdempotentResult type별로 화면에 반영할 방법.
 */
export const RESULT_SCREEN_MAPPING: Record<IdempotentResultType, {
  detailBehavior: string;
  inboxBehavior: string;
  landingBehavior: string;
  dashboardBehavior: string;
  toastLevel: 'success' | 'info' | 'warning' | 'error';
}> = {
  applied: {
    detailBehavior: 'refresh detail + show success',
    inboxBehavior: 'refetch inbox (item may move groups)',
    landingBehavior: 'refetch landing bucket counts',
    dashboardBehavior: 'refetch priority queue + stats',
    toastLevel: 'success',
  },
  already_applied_same_result: {
    detailBehavior: 'refresh detail to canonical state',
    inboxBehavior: 'refetch (may already reflect)',
    landingBehavior: 'refetch (may already reflect)',
    dashboardBehavior: 'refetch (may already reflect)',
    toastLevel: 'info',
  },
  existing_downstream_reuse: {
    detailBehavior: 'show link to existing downstream',
    inboxBehavior: 'refetch (may already reflect)',
    landingBehavior: 'refetch (may already reflect)',
    dashboardBehavior: 'refetch (may already reflect)',
    toastLevel: 'info',
  },
  retryable_failure: {
    detailBehavior: 'stay on current, show error + retry',
    inboxBehavior: 'no change',
    landingBehavior: 'no change',
    dashboardBehavior: 'no change',
    toastLevel: 'error',
  },
  non_retryable_failure: {
    detailBehavior: 'stay on current, show error + alternatives',
    inboxBehavior: 'no change',
    landingBehavior: 'no change',
    dashboardBehavior: 'no change',
    toastLevel: 'error',
  },
  stale_conflict: {
    detailBehavior: 'refresh detail + show conflict explanation',
    inboxBehavior: 'refetch inbox',
    landingBehavior: 'refetch landing',
    dashboardBehavior: 'refetch dashboard',
    toastLevel: 'warning',
  },
  blocked_precondition: {
    detailBehavior: 'show blocker with resolve path',
    inboxBehavior: 'no change',
    landingBehavior: 'no change',
    dashboardBehavior: 'no change',
    toastLevel: 'warning',
  },
};
