/**
 * production-readiness-plan.ts
 *
 * Demo-to-Production Readiness Hardening 계획서.
 * seed truth → stable domain adapters → production data contract boundary
 * → async mutation safety → permission/state integrity → recoverable failure handling
 *
 * 이 파일은 런타임 코드가 아니라 구현 참조용 설계 문서.
 * 실제 production readiness 구현 시 이 계획을 기반으로 진행한다.
 *
 * @module ops-console/production-readiness-plan
 */

// ===========================================================================
// 1. Provider 통합 구조
// ===========================================================================

/**
 * 공통 provider 인터페이스.
 * demo/runtime/hybrid 모두 이 인터페이스를 구현해야 한다.
 */
export interface OpsDataProvider {
  // Entity fetch
  fetchEntityById(type: EntityType, id: string): Promise<ProviderResult<unknown>>;
  fetchEntityList(type: EntityType, filter: ListFilter): Promise<ProviderResult<unknown[]>>;

  // Linked entity traversal
  resolveLinkedEntity(sourceType: EntityType, sourceId: string, linkType: LinkType): Promise<ProviderResult<unknown | null>>;

  // Mutation
  applyMutation(command: MutationCommand): Promise<MutationResult>;

  // Derived semantics recalculation
  recalculateDerived(scope: RecalcScope): Promise<void>;

  // Stale detection
  checkStaleness(type: EntityType, id: string, knownVersion: string): Promise<StalenessResult>;

  // Source classification
  readonly sourceType: 'demo' | 'runtime' | 'hybrid';
}

export type EntityType = 'quote' | 'po' | 'receiving' | 'stock_risk' | 'assignment' | 'policy';
export type LinkType = 'upstream' | 'downstream' | 'comparison' | 'approval' | 'acknowledgement';

export interface ListFilter {
  module?: string;
  readiness?: string;
  owner?: string;
  dueSemantic?: string;
  limit?: number;
  offset?: number;
}

export interface ProviderResult<T> {
  data: T | null;
  status: 'ok' | 'not_found' | 'stale' | 'partial' | 'error';
  staleSince?: string;
  missingFields?: string[];
  errorCode?: string;
}

export interface MutationCommand {
  type: string;
  entityType: EntityType;
  entityId: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  expectedVersion?: string;
}

export interface MutationResult {
  status: 'success' | 'stale_conflict' | 'permission_denied' | 'validation_error' | 'duplicate_request' | 'partial_success';
  createdEntityId?: string;
  createdEntityRoute?: string;
  newVersion?: string;
  conflictDetail?: string;
  retryable: boolean;
  invalidationScope: RecalcScope;
}

export interface RecalcScope {
  entities: { type: EntityType; id: string }[];
  projections: string[];
}

export interface StalenessResult {
  isStale: boolean;
  currentVersion?: string;
  suggestedRoute?: string;
}

// ===========================================================================
// 2. Mutation Hardening 규칙
// ===========================================================================

/**
 * 주요 mutation별 safety 규칙.
 * 각 mutation은 아래 속성을 반드시 가진다.
 */
export const MUTATION_SAFETY_RULES: Record<string, {
  optimisticAllowed: boolean;
  idempotencyRequired: boolean;
  confirmedResponseRequired: boolean;
  stalePrecheck: boolean;
  invalidationScope: string[];
  rollbackStrategy: 'refetch' | 'local_rollback' | 'redirect';
  downstreamHandoff: boolean;
}> = {
  select_quote_vendor: {
    optimisticAllowed: true,
    idempotencyRequired: false,
    confirmedResponseRequired: false,
    stalePrecheck: true,
    invalidationScope: ['quote_detail', 'quotes_landing', 'inbox', 'dashboard'],
    rollbackStrategy: 'refetch',
    downstreamHandoff: false,
  },
  create_po_from_quote: {
    optimisticAllowed: false,
    idempotencyRequired: true,
    confirmedResponseRequired: true,
    stalePrecheck: true,
    invalidationScope: ['quote_detail', 'po_landing', 'inbox', 'dashboard'],
    rollbackStrategy: 'redirect',
    downstreamHandoff: true,
  },
  submit_po_issue: {
    optimisticAllowed: false,
    idempotencyRequired: true,
    confirmedResponseRequired: true,
    stalePrecheck: true,
    invalidationScope: ['po_detail', 'po_landing', 'inbox', 'dashboard', 'receiving_handoff'],
    rollbackStrategy: 'refetch',
    downstreamHandoff: false,
  },
  record_vendor_acknowledgement: {
    optimisticAllowed: true,
    idempotencyRequired: false,
    confirmedResponseRequired: false,
    stalePrecheck: false,
    invalidationScope: ['po_detail', 'po_landing', 'inbox', 'dashboard'],
    rollbackStrategy: 'refetch',
    downstreamHandoff: false,
  },
  complete_receiving_inspection: {
    optimisticAllowed: true,
    idempotencyRequired: false,
    confirmedResponseRequired: false,
    stalePrecheck: true,
    invalidationScope: ['receiving_detail', 'receiving_landing', 'inbox', 'dashboard'],
    rollbackStrategy: 'refetch',
    downstreamHandoff: false,
  },
  post_inventory_inbound: {
    optimisticAllowed: false,
    idempotencyRequired: true,
    confirmedResponseRequired: true,
    stalePrecheck: true,
    invalidationScope: ['receiving_detail', 'receiving_landing', 'stock_risk', 'inbox', 'dashboard'],
    rollbackStrategy: 'refetch',
    downstreamHandoff: true,
  },
  create_quote_from_reorder: {
    optimisticAllowed: false,
    idempotencyRequired: true,
    confirmedResponseRequired: true,
    stalePrecheck: true,
    invalidationScope: ['stock_risk_detail', 'quotes_landing', 'inbox', 'dashboard', 'recovery'],
    rollbackStrategy: 'redirect',
    downstreamHandoff: true,
  },
  resolve_blocker: {
    optimisticAllowed: true,
    idempotencyRequired: false,
    confirmedResponseRequired: false,
    stalePrecheck: false,
    invalidationScope: ['entity_detail', 'inbox', 'dashboard'],
    rollbackStrategy: 'refetch',
    downstreamHandoff: false,
  },
};

// ===========================================================================
// 3. Partial Data Tolerance
// ===========================================================================

/**
 * 각 화면의 partial-data 대응 규칙.
 * linked entity 일부 없어도 현재 작업은 유지한다.
 */
export const PARTIAL_DATA_RULES: Record<string, {
  requiredFields: string[];
  degradedWithout: string[];
  blockedWithout: string[];
  staleMessage: string;
}> = {
  quote_detail: {
    requiredFields: ['id', 'requestNumber', 'status'],
    degradedWithout: ['comparison', 'responses'],
    blockedWithout: [],
    staleMessage: '비교 데이터가 아직 로드되지 않았습니다. 부분 정보로 표시합니다.',
  },
  po_detail: {
    requiredFields: ['id', 'poNumber', 'status'],
    degradedWithout: ['approval', 'acknowledgement'],
    blockedWithout: [],
    staleMessage: '승인/확인 데이터가 아직 로드되지 않았습니다.',
  },
  receiving_detail: {
    requiredFields: ['id', 'receivingNumber', 'status', 'lineReceipts'],
    degradedWithout: ['linkedPO', 'documentAttachments'],
    blockedWithout: [],
    staleMessage: '연결 발주 정보가 아직 로드되지 않았습니다.',
  },
  stock_risk_detail: {
    requiredFields: ['stockPositions'],
    degradedWithout: ['linkedQuoteState', 'receivingLineage'],
    blockedWithout: [],
    staleMessage: '연결 소싱 정보가 아직 반영되지 않았습니다.',
  },
};

// ===========================================================================
// 4. Permission Eligibility
// ===========================================================================

/**
 * Command → Permission 매핑.
 * preflight eligibility + server-side enforcement 둘 다 적용.
 */
export const PERMISSION_RULES: Record<string, {
  requiredRoles: string[];
  requiresOwnership: boolean;
  requiresApproval: boolean;
  policyCheckRequired: boolean;
  denialMessage: string;
}> = {
  select_quote_vendor: {
    requiredRoles: ['REQUESTER', 'APPROVER', 'ADMIN', 'OWNER'],
    requiresOwnership: false,
    requiresApproval: false,
    policyCheckRequired: false,
    denialMessage: '공급사 선정 권한이 없습니다.',
  },
  create_po_from_quote: {
    requiredRoles: ['APPROVER', 'ADMIN', 'OWNER'],
    requiresOwnership: false,
    requiresApproval: false,
    policyCheckRequired: true,
    denialMessage: '발주 생성 권한이 없습니다. 승인자 이상 필요.',
  },
  submit_po_issue: {
    requiredRoles: ['APPROVER', 'ADMIN', 'OWNER'],
    requiresOwnership: true,
    requiresApproval: true,
    policyCheckRequired: true,
    denialMessage: '발주 발행 권한이 없거나 승인이 완료되지 않았습니다.',
  },
  post_inventory_inbound: {
    requiredRoles: ['REQUESTER', 'APPROVER', 'ADMIN', 'OWNER'],
    requiresOwnership: false,
    requiresApproval: false,
    policyCheckRequired: false,
    denialMessage: '재고 반영 권한이 없습니다.',
  },
  create_quote_from_reorder: {
    requiredRoles: ['REQUESTER', 'APPROVER', 'ADMIN', 'OWNER'],
    requiresOwnership: false,
    requiresApproval: false,
    policyCheckRequired: true,
    denialMessage: '재주문 견적 생성 권한이 없거나 정책 제한이 있습니다.',
  },
};

// ===========================================================================
// 5. Error Taxonomy
// ===========================================================================

export const ERROR_TAXONOMY: Record<string, {
  uiInterpretation: string;
  retryable: boolean;
  returnPath: string;
  showLinkedRoute: boolean;
  requiresEscalation: boolean;
}> = {
  validation_error: {
    uiInterpretation: '입력 값에 문제가 있습니다.',
    retryable: true,
    returnPath: 'current_screen',
    showLinkedRoute: false,
    requiresEscalation: false,
  },
  permission_denied: {
    uiInterpretation: '이 작업을 수행할 권한이 없습니다.',
    retryable: false,
    returnPath: 'current_screen',
    showLinkedRoute: false,
    requiresEscalation: true,
  },
  stale_conflict: {
    uiInterpretation: '다른 사용자가 이미 변경했습니다. 최신 상태를 확인하세요.',
    retryable: true,
    returnPath: 'refresh_current',
    showLinkedRoute: true,
    requiresEscalation: false,
  },
  duplicate_request: {
    uiInterpretation: '이미 처리된 요청입니다.',
    retryable: false,
    returnPath: 'linked_entity',
    showLinkedRoute: true,
    requiresEscalation: false,
  },
  linked_entity_missing: {
    uiInterpretation: '연결된 엔티티를 찾을 수 없습니다.',
    retryable: true,
    returnPath: 'parent_list',
    showLinkedRoute: false,
    requiresEscalation: false,
  },
  transition_not_allowed: {
    uiInterpretation: '현재 상태에서 이 작업을 수행할 수 없습니다.',
    retryable: false,
    returnPath: 'refresh_current',
    showLinkedRoute: true,
    requiresEscalation: false,
  },
  partial_success: {
    uiInterpretation: '일부만 처리되었습니다. 나머지를 확인하세요.',
    retryable: true,
    returnPath: 'current_screen',
    showLinkedRoute: false,
    requiresEscalation: false,
  },
};

// ===========================================================================
// 6. Readiness Classification (dev/inspection용)
// ===========================================================================

export type ReadinessLevel =
  | 'demo_only'
  | 'demo_stable'
  | 'runtime_partial_ready'
  | 'production_candidate'
  | 'needs_backend_contract_alignment';

/**
 * 화면/기능별 현재 readiness 분류.
 * 개발/검증용이지 사용자-facing이 아니다.
 */
export const SCREEN_READINESS: Record<string, {
  level: ReadinessLevel;
  notes: string;
}> = {
  'dashboard/today': { level: 'demo_stable', notes: 'inbox-adapter 기반, provider 전환 시 동일 semantics' },
  'dashboard/inbox': { level: 'demo_stable', notes: 'unified inbox model, filter/sort 안정' },
  'dashboard/quotes_landing': { level: 'demo_stable', notes: 'module-landing-adapter 기반' },
  'dashboard/quotes_detail': { level: 'demo_stable', notes: 'sourcing-flow-adapter + detail shell' },
  'dashboard/po_landing': { level: 'demo_stable', notes: 'module-landing-adapter 기반' },
  'dashboard/po_detail': { level: 'demo_stable', notes: 'po-detail-adapter + execution console' },
  'dashboard/receiving_landing': { level: 'demo_stable', notes: 'module-landing-adapter 기반' },
  'dashboard/receiving_detail': { level: 'demo_stable', notes: 'receiving-detail-adapter + execution console' },
  'dashboard/stock_risk': { level: 'demo_stable', notes: 'module-landing-adapter + reentry context' },
  'search/compare': { level: 'demo_stable', notes: 'search/compare flow, AI summary layer' },
  'mutation/vendor_select': { level: 'demo_only', notes: 'client-side state only, no persistence' },
  'mutation/po_issue': { level: 'demo_only', notes: 'client-side transition, no server confirmation' },
  'mutation/posting': { level: 'demo_only', notes: 'client-side transition, no server confirmation' },
  'mutation/reorder_quote': { level: 'demo_only', notes: 'client-side transition, no persistence' },
  'permission/role_guard': { level: 'needs_backend_contract_alignment', notes: 'preflight only, server enforcement 미구현' },
  'error/stale_conflict': { level: 'needs_backend_contract_alignment', notes: 'version field 미존재' },
};

// ===========================================================================
// 7. Integration Phase Plan
// ===========================================================================

export const INTEGRATION_PHASES = [
  {
    phase: 1,
    name: 'Read Baseline',
    scope: ['dashboard summary', 'inbox queue', 'module landing', 'detail read'],
    dependencies: ['API endpoints for list/detail reads'],
    risk: 'low — read-only, no state mutation',
    completion: 'All screens display real data with partial-data fallback',
  },
  {
    phase: 2,
    name: 'Low-risk Mutations',
    scope: ['owner assignment', 'follow-up actions', 'review request'],
    dependencies: ['Phase 1 reads stable', 'assignment API'],
    risk: 'low — non-destructive updates',
    completion: 'Assignment/review actions persist and reflect across screens',
  },
  {
    phase: 3,
    name: 'Core Execution Mutations',
    scope: ['vendor select', 'PO create/issue', 'ack update', 'inspection', 'lot capture', 'posting'],
    dependencies: ['Phase 1+2 stable', 'command endpoints', 'idempotency support'],
    risk: 'medium — state transitions with downstream impact',
    completion: 'Core procurement flow end-to-end with real persistence',
  },
  {
    phase: 4,
    name: 'Recovery/Re-entry Mutations',
    scope: ['reorder quote create', 'duplicate clear', 'blocker resolution', 'alternate sourcing'],
    dependencies: ['Phase 3 stable', 'linked entity creation APIs'],
    risk: 'medium — cross-module handoff creation',
    completion: 'Stock risk → sourcing re-entry with real entity creation',
  },
  {
    phase: 5,
    name: 'Permission/Policy Tightening',
    scope: ['server-driven eligibility', 'policy lock', 'plan restriction', 'approval gating'],
    dependencies: ['Phase 3+4 stable', 'RBAC/policy APIs'],
    risk: 'low — enforcement layer on top of working mutations',
    completion: 'All mutations respect server-side permission/policy',
  },
] as const;
