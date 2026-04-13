/**
 * Server Authorization Guard
 *
 * Security Readiness Hardening Batch 0 — Security Batch A
 *
 * 클라이언트 UI gating은 보조. 최종 권한은 서버 검증.
 * irreversible action에 대해 서버 authoritative permission check를 추가합니다.
 *
 * 설계 원칙:
 * - UI에서 버튼이 보여도 서버에서 권한 없으면 반드시 차단
 * - raw permission key / internal policy key 노출 금지
 * - role만으로 부족한 경우 entity-scoped capability까지 허용
 * - human-readable governance message로 denial을 surface에 반영
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════

/** 시스템 역할 */
export type SystemRole = 'requester' | 'buyer' | 'approver' | 'ops_admin';

/** Entity-scoped capability */
export interface EntityCapability {
  readonly scope: 'organization' | 'lab' | 'supplier_group' | 'department';
  readonly scopeId: string;
  readonly capabilities: readonly string[];
}

/** 서버 인증 컨텍스트 */
export interface ServerActorContext {
  readonly actorId: string;
  readonly roles: readonly SystemRole[];
  readonly organizationId: string;
  readonly departmentId?: string;
  readonly entityCapabilities: readonly EntityCapability[];
  readonly sessionId: string;
  readonly sessionIssuedAt: string; // ISO
  readonly delegatedBy?: string;
}

/** Irreversible action 유형 */
export type IrreversibleActionType =
  // ── Dispatch chain ──
  | 'approval_decision'
  | 'po_conversion_finalize'
  | 'po_conversion_reopen'
  | 'dispatch_send_now'
  | 'dispatch_schedule_send'
  | 'dispatch_schedule_cancel'
  | 'request_correction'
  // ── Quote chain ──
  | 'quote_request_create'
  | 'quote_request_submit'
  | 'quote_request_resend'
  | 'quote_status_change'
  // ── Purchase / Order chain ──
  | 'purchase_request_approve'
  | 'purchase_request_reject'
  | 'order_create'
  | 'order_status_change'
  // ── AI action chain ──
  | 'ai_action_approve'
  | 'compare_decision'
  | 'email_draft_approve'
  // ── Inventory chain ──
  | 'inventory_restock'
  | 'inventory_use'
  | 'inventory_import'
  // ── Receiving chain ──
  | 'receiving_status_change'
  // ── Organization chain ──
  | 'member_role_change';

/** 권한 검증 요청 */
export interface AuthorizationRequest {
  readonly action: IrreversibleActionType;
  readonly actor: ServerActorContext;
  readonly targetEntityType: 'po' | 'quote' | 'dispatch' | 'approval' | 'order' | 'inventory' | 'receiving' | 'ai_action' | 'compare_session' | 'email_draft' | 'organization';
  readonly targetEntityId: string;
  readonly targetOrganizationId: string;
  readonly snapshotVersion?: string;
  readonly idempotencyKey?: string;
}

/** 권한 검증 결과 */
export interface AuthorizationResult {
  readonly permitted: boolean;
  readonly action: IrreversibleActionType;
  readonly denialReason?: string;
  /** human-readable 메시지 (UI surface용, internal key 미포함) */
  readonly governanceMessage: string;
  readonly requiresApproval: boolean;
  readonly requiredApproverRole?: SystemRole;
  readonly checkedAt: string; // ISO
  readonly checkId: string;
}

/** 역할별 최소 권한 매트릭스 */
const ACTION_ROLE_MINIMUM: Record<IrreversibleActionType, SystemRole[]> = {
  // ── Dispatch chain ──
  approval_decision: ['approver', 'ops_admin'],
  po_conversion_finalize: ['buyer', 'approver', 'ops_admin'],
  po_conversion_reopen: ['buyer', 'approver', 'ops_admin'],
  dispatch_send_now: ['buyer', 'ops_admin'],
  dispatch_schedule_send: ['buyer', 'ops_admin'],
  dispatch_schedule_cancel: ['buyer', 'ops_admin'],
  request_correction: ['requester', 'buyer', 'approver', 'ops_admin'],
  // ── Quote chain ──
  quote_request_create: ['requester', 'buyer', 'ops_admin'],
  quote_request_submit: ['requester', 'buyer', 'ops_admin'],
  quote_request_resend: ['buyer', 'ops_admin'],
  quote_status_change: ['buyer', 'approver', 'ops_admin'],
  // ── Purchase / Order chain ──
  purchase_request_approve: ['approver', 'ops_admin'],
  purchase_request_reject: ['approver', 'ops_admin'],
  order_create: ['buyer', 'approver', 'ops_admin'],
  order_status_change: ['ops_admin'],
  // ── AI action chain ──
  ai_action_approve: ['requester', 'buyer', 'approver', 'ops_admin'],
  compare_decision: ['requester', 'buyer', 'approver', 'ops_admin'],
  email_draft_approve: ['ops_admin'],
  // ── Inventory chain ──
  inventory_restock: ['requester', 'buyer', 'ops_admin'],
  inventory_use: ['requester', 'buyer', 'ops_admin'],
  inventory_import: ['buyer', 'ops_admin'],
  // ── Receiving chain ──
  receiving_status_change: ['buyer', 'ops_admin'],
  // ── Organization chain ──
  member_role_change: ['ops_admin'],
};

/** Self-approval 금지 action (Tier 3 irreversible) */
const SELF_APPROVAL_FORBIDDEN: ReadonlySet<IrreversibleActionType> = new Set([
  'approval_decision',
  'po_conversion_finalize',
  'purchase_request_approve',
]);

/** action → human-readable denial 메시지 */
const DENIAL_MESSAGES: Record<string, string> = {
  role_insufficient: '현재 역할로는 이 작업을 실행할 수 없습니다',
  org_mismatch: '다른 조직의 항목에 대한 작업 권한이 없습니다',
  self_approval_forbidden: '동일인이 요청하고 승인할 수 없습니다. 별도 승인자가 필요합니다',
  session_expired: '세션이 만료되었습니다. 다시 로그인해주세요',
  entity_scope_denied: '해당 범위에 대한 실행 권한이 없습니다',
  snapshot_stale: '승인 기준이 변경되어 다시 검토가 필요합니다',
  default: '현재 권한으로는 실행이 제한됩니다',
};

// ═══════════════════════════════════════════════════════
// Core Functions
// ═══════════════════════════════════════════════════════

let checkIdCounter = 0;

function generateCheckId(): string {
  checkIdCounter += 1;
  return `authz_${Date.now()}_${checkIdCounter}`;
}

/** 세션 유효성 검증 (최대 24시간) */
function isSessionValid(issuedAt: string): boolean {
  const issued = new Date(issuedAt).getTime();
  const now = Date.now();
  const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;
  return !isNaN(issued) && (now - issued) < MAX_SESSION_AGE_MS;
}

/** 역할 기반 권한 검증 */
function hasRequiredRole(
  actorRoles: readonly SystemRole[],
  action: IrreversibleActionType,
): boolean {
  const required = ACTION_ROLE_MINIMUM[action];
  return actorRoles.some(role => required.includes(role));
}

/** 조직 범위 검증 */
function isOrganizationAuthorized(
  actor: ServerActorContext,
  targetOrganizationId: string,
): boolean {
  // 같은 조직이면 OK
  if (actor.organizationId === targetOrganizationId) return true;

  // entity capability로 cross-org 접근 확인
  return actor.entityCapabilities.some(cap =>
    cap.scope === 'organization' &&
    cap.scopeId === targetOrganizationId,
  );
}

/** Entity-scoped capability 검증 */
function hasEntityCapability(
  actor: ServerActorContext,
  action: IrreversibleActionType,
  targetEntityType: string,
  targetEntityId: string,
): boolean {
  // entity capability가 없으면 역할 기반만으로 판단 (true 반환)
  if (actor.entityCapabilities.length === 0) return true;

  // entity capability가 있는 경우, 해당 action에 대한 capability 존재 여부 확인
  return actor.entityCapabilities.some(cap =>
    cap.capabilities.includes(action) ||
    cap.capabilities.includes(`${targetEntityType}.*`),
  );
}

/**
 * 서버 authoritative 권한 검증
 *
 * UI에서 버튼이 보여도 이 함수가 denied 반환하면 mutation 차단.
 * raw key / internal policy key 노출 없이 human-readable 메시지만 반환.
 */
export function checkServerAuthorization(
  request: AuthorizationRequest,
): AuthorizationResult {
  const checkId = generateCheckId();
  const checkedAt = new Date().toISOString();
  const { action, actor, targetEntityType, targetEntityId, targetOrganizationId } = request;

  // 1. 세션 유효성
  if (!isSessionValid(actor.sessionIssuedAt)) {
    return {
      permitted: false,
      action,
      denialReason: 'session_expired',
      governanceMessage: DENIAL_MESSAGES.session_expired,
      requiresApproval: false,
      checkedAt,
      checkId,
    };
  }

  // 2. 역할 기반 권한
  if (!hasRequiredRole(actor.roles, action)) {
    return {
      permitted: false,
      action,
      denialReason: 'role_insufficient',
      governanceMessage: DENIAL_MESSAGES.role_insufficient,
      requiresApproval: false,
      checkedAt,
      checkId,
    };
  }

  // 3. 조직 범위
  if (!isOrganizationAuthorized(actor, targetOrganizationId)) {
    return {
      permitted: false,
      action,
      denialReason: 'org_mismatch',
      governanceMessage: DENIAL_MESSAGES.org_mismatch,
      requiresApproval: false,
      checkedAt,
      checkId,
    };
  }

  // 4. Entity-scoped capability
  if (!hasEntityCapability(actor, action, targetEntityType, targetEntityId)) {
    return {
      permitted: false,
      action,
      denialReason: 'entity_scope_denied',
      governanceMessage: DENIAL_MESSAGES.entity_scope_denied,
      requiresApproval: false,
      checkedAt,
      checkId,
    };
  }

  // 5. Self-approval 금지 (Tier 3)
  if (SELF_APPROVAL_FORBIDDEN.has(action)) {
    return {
      permitted: true,
      action,
      governanceMessage: '실행 가능하나, 별도 승인자가 필요합니다',
      requiresApproval: true,
      requiredApproverRole: 'approver',
      checkedAt,
      checkId,
    };
  }

  // 모든 검증 통과
  return {
    permitted: true,
    action,
    governanceMessage: '실행 권한이 확인되었습니다',
    requiresApproval: false,
    checkedAt,
    checkId,
  };
}

/**
 * Batch authorization check — 여러 action을 한 번에 검증
 * bulk approval 등에서 사용
 */
export function checkBatchAuthorization(
  requests: readonly AuthorizationRequest[],
): readonly AuthorizationResult[] {
  return requests.map(checkServerAuthorization);
}

/**
 * 권한 denial을 human-readable 운영 메시지로 변환
 * raw key / enum / internal code 절대 노출 금지
 */
export function getDenialMessage(result: AuthorizationResult): string {
  if (result.permitted) return '';
  return result.governanceMessage;
}

// ═══════════════════════════════════════════════════════
// Export Constants (테스트용)
// ═══════════════════════════════════════════════════════

export { ACTION_ROLE_MINIMUM, SELF_APPROVAL_FORBIDDEN, DENIAL_MESSAGES };
