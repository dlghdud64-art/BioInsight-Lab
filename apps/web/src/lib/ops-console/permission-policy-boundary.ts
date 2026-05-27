/**
 * permission-policy-boundary.ts
 *
 * Phase 2 Permission / Policy Execution Boundary Baseline.
 *
 * visibility -> eligibility -> command preflight -> policy/role/owner enforcement
 * -> denial classification -> recovery path
 *
 * 이 파일은 Phase 1 semantics/shell/hubs 와
 * Phase 2 runtime-read / mutation-baseline / conflict-idempotency 위에
 * 권한, 역할, owner, policy lock, plan restriction, approval requirement가
 * 실제 command execution boundary에서 일관되게 작동하도록 정리한다.
 *
 * Screen component는 이 layer를 통해 permission truth에 접근하며,
 * 화면마다 다른 permission 조건문을 만들지 않는다.
 *
 * @module ops-console/permission-policy-boundary
 */

import type { EntityType } from './production-readiness-plan';
import type { CoreCommandType } from './mutation-baseline';

// ===========================================================================
// 1. Capability Model — 공통 permission capability
// ===========================================================================

/**
 * Entity + actor context에서 계산된 공통 capability set.
 * dashboard / inbox / landing / detail / action surface 모두 이 모델을 재사용한다.
 */
export interface PermissionCapability {
  canView: boolean;
  canEdit: boolean;
  canExecute: boolean;
  canReview: boolean;
  canApprove: boolean;
  canReassign: boolean;
  canResolveBlocker: boolean;
  canTriggerReentry: boolean;
}

/**
 * Capability 계산에 필요한 actor context.
 */
export interface ActorContext {
  userId: string;
  organizationRole: OrganizationRoleLevel;
  /** actor가 소속된 functional team/group */
  functionalRole?: FunctionalRole;
  /** 현재 actor가 entity owner인지 */
  isEntityOwner: boolean;
  /** 현재 actor가 review owner인지 */
  isReviewOwner: boolean;
  /** 현재 actor가 approval owner인지 */
  isApprovalOwner: boolean;
}

/**
 * Capability 계산에 필요한 entity context.
 */
export interface EntityPermissionContext {
  entityType: EntityType;
  entityId: string;
  /** entity 현재 상태 */
  currentState: string;
  /** entity 현재 owner */
  currentOwnerId?: string;
  /** review owner (reviewer 지정 시) */
  reviewOwnerId?: string;
  /** approval owner (approver 지정 시) */
  approvalOwnerId?: string;
  /** next owner (handoff 대상) */
  nextOwnerId?: string;
  /** 활성 policy lock 여부 */
  policyLocked: boolean;
  /** policy lock 사유 */
  policyLockReason?: string;
  /** plan restriction 여부 */
  planRestricted: boolean;
  /** plan restriction 사유 */
  planRestrictionReason?: string;
  /** approval requirement 활성 여부 */
  approvalRequired: boolean;
  /** approval 완료 여부 */
  approvalCompleted: boolean;
  /** review requirement 활성 여부 */
  reviewRequired: boolean;
  /** review 완료 여부 */
  reviewCompleted: boolean;
  /** 알려진 version (stale check용) */
  knownVersion?: string;
}

// ===========================================================================
// 2. Organization Role Level
// ===========================================================================

/**
 * OrganizationRole의 permission level 매핑.
 * 기존 OrganizationRole enum(VIEWER, REQUESTER, APPROVER, ADMIN, OWNER)과 일치.
 */
export type OrganizationRoleLevel =
  | 'VIEWER'
  | 'REQUESTER'
  | 'APPROVER'
  | 'ADMIN'
  | 'OWNER';

/**
 * Functional role — 업무 기능 역할 (organizational role과 별도).
 */
export type FunctionalRole =
  | 'procurement'       // 구매 담당
  | 'receiving'         // 입고 담당
  | 'inventory'         // 재고 담당
  | 'finance'           // 재무/예산 담당
  | 'lab_manager'       // 연구실 관리
  | 'general';          // 일반

/**
 * Role hierarchy — 상위 role은 하위 role의 capability를 포함.
 */
const ROLE_HIERARCHY: Record<OrganizationRoleLevel, number> = {
  VIEWER: 0,
  REQUESTER: 1,
  APPROVER: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function hasMinimumRole(
  actorRole: OrganizationRoleLevel,
  requiredRole: OrganizationRoleLevel,
): boolean {
  return ROLE_HIERARCHY[actorRole] >= ROLE_HIERARCHY[requiredRole];
}

// ===========================================================================
// 3. Denial / Restriction Taxonomy
// ===========================================================================

/**
 * 공통 denial class.
 * blocked semantics(워크플로 차단)과 denial semantics(권한/정책 거부)를 분리한다.
 */
export type DenialClass =
  | 'role_restricted'                 // role level 부족
  | 'owner_mismatch'                  // entity owner가 아님
  | 'approval_required'               // 승인이 먼저 필요함
  | 'policy_locked'                   // 정책에 의해 잠김
  | 'plan_restricted'                 // 플랜/구독 제한
  | 'permission_denied'               // 일반 권한 거부 (복합 사유)
  | 'stale_permission_context'        // permission context가 최신이 아님
  | 'review_required_before_execute'; // 검토 완료 후 실행 가능

/**
 * Denial 상세 정보.
 * UI는 이 구조를 통해 왜, 누가, 무엇을 하면 되는지 안내한다.
 */
export interface DenialDetail {
  denialClass: DenialClass;
  /** 사용자에게 보이는 사유 요약 */
  reasonSummary: string;
  /** 해결할 수 있는 owner/role 안내 */
  requiredOwnerRole?: string;
  /** 다음 authorized owner 이름 (알 수 있는 경우) */
  nextAuthorizedOwnerName?: string;
  /** resolve-first 경로 */
  resolvePath?: DenialResolvePath;
}

/**
 * Denial 발생 시 recovery/resolve 경로.
 */
export interface DenialResolvePath {
  /** 이동할 화면 */
  route?: string;
  /** 화면 라벨 */
  routeLabel?: string;
  /** 수행할 행동 */
  actionLabel: string;
  /** 관련 surface type */
  surfaceType: 'approval_panel' | 'review_section' | 'assignment_panel'
    | 'policy_settings' | 'plan_upgrade' | 'inspection_section'
    | 'blocker_panel' | 'refresh_current' | 'inbox';
}

// ===========================================================================
// 4. Denial Explanation Map
// ===========================================================================

export const DENIAL_EXPLANATIONS: Record<DenialClass, {
  title: string;
  description: string;
  escalationHint: string;
}> = {
  role_restricted: {
    title: '역할 권한 부족',
    description: '이 작업에 필요한 조직 역할이 부족합니다.',
    escalationHint: '관리자에게 역할 변경을 요청하세요.',
  },
  owner_mismatch: {
    title: '담당자 불일치',
    description: '이 항목의 담당자가 아닙니다.',
    escalationHint: '담당자에게 확인하거나 배정 변경을 요청하세요.',
  },
  approval_required: {
    title: '승인 필요',
    description: '이 작업을 실행하기 전에 승인이 완료되어야 합니다.',
    escalationHint: '승인자에게 승인을 요청하세요.',
  },
  policy_locked: {
    title: '정책 제한',
    description: '조직 정책에 의해 잠긴 항목입니다.',
    escalationHint: '정책 관리자에게 해제를 요청하세요.',
  },
  plan_restricted: {
    title: '플랜 제한',
    description: '현재 구독 플랜에서 제공되지 않는 기능입니다.',
    escalationHint: '플랜 업그레이드를 검토하세요.',
  },
  permission_denied: {
    title: '권한 없음',
    description: '이 작업을 수행할 권한이 없습니다.',
    escalationHint: '관리자에게 권한을 요청하세요.',
  },
  stale_permission_context: {
    title: '권한 정보 갱신 필요',
    description: '최근 역할/배정 변경이 반영되지 않았을 수 있습니다.',
    escalationHint: '페이지를 새로고침하여 최신 권한을 확인하세요.',
  },
  review_required_before_execute: {
    title: '검토 먼저 필요',
    description: '실행하기 전에 검토가 완료되어야 합니다.',
    escalationHint: '검토자에게 검토 완료를 요청하세요.',
  },
};

// ===========================================================================
// 5. Visibility / Preflight / Execution / Recovery 4단계 모델
// ===========================================================================

/**
 * Action visibility — 보여줄지 여부.
 */
export interface ActionVisibility {
  visible: boolean;
  /** 숨김 사유 (visible=false일 때) */
  hiddenReason?: string;
}

/**
 * Preflight eligibility — 지금 클릭 가능한지.
 * preflight 통과 ≠ 실행 성공 보장.
 */
export interface PreflightEligibility {
  eligible: boolean;
  /** 비활성 사유들 */
  denials: DenialDetail[];
  /** stale check 필요 여부 */
  needsRecheck: boolean;
  /** 검토/승인 먼저 필요 여부 */
  prerequisiteRequired: boolean;
  /** prerequisite 설명 */
  prerequisiteSummary?: string;
}

/**
 * Execution denial — 실제 실행 시 canonical truth 기준 거부.
 */
export interface ExecutionDenial {
  denied: boolean;
  denialClass?: DenialClass;
  /** 상세 사유 */
  detail?: DenialDetail;
  /** 실행 시점 version */
  executionVersion?: string;
}

/**
 * Recovery path — 무엇을 하면 다시 실행 가능한지.
 */
export interface RecoveryPath {
  available: boolean;
  paths: DenialResolvePath[];
}

/**
 * 완전한 action permission 평가 결과.
 * visibility → preflight → execution → recovery 전체를 포함.
 */
export interface ActionPermissionEvaluation {
  commandType: CoreCommandType;
  entityType: EntityType;
  entityId: string;
  visibility: ActionVisibility;
  preflight: PreflightEligibility;
  execution: ExecutionDenial;
  recovery: RecoveryPath;
}

// ===========================================================================
// 6. Ownership Role Separation
// ===========================================================================

/**
 * Entity에 관련된 ownership 역할을 명확히 분리한다.
 * owner ≠ reviewer ≠ approver ≠ next owner.
 */
export interface OwnershipContext {
  /** 현재 실행 담당자 */
  currentOwner?: OwnerReference;
  /** 검토 담당자 */
  reviewOwner?: OwnerReference;
  /** 승인 담당자 */
  approvalOwner?: OwnerReference;
  /** 다음 단계 담당자 */
  nextOwner?: OwnerReference;
  /** policy restriction 주체 */
  policyAuthority?: string;
}

export interface OwnerReference {
  userId: string;
  name: string;
  role: OrganizationRoleLevel;
  functionalRole?: FunctionalRole;
}

// ===========================================================================
// 7. Command-specific Permission / Policy Boundary Rules
// ===========================================================================

export interface CommandPermissionRule {
  commandType: CoreCommandType;
  /** 최소 조직 역할 */
  minimumRole: OrganizationRoleLevel;
  /** 관련 functional roles */
  allowedFunctionalRoles: FunctionalRole[];
  /** entity ownership 필요 여부 */
  requiresOwnership: boolean;
  /** 승인 완료 필요 여부 */
  requiresApprovalComplete: boolean;
  /** 검토 완료 필요 여부 */
  requiresReviewComplete: boolean;
  /** policy check 필요 여부 */
  policyCheckRequired: boolean;
  /** plan restriction 체크 필요 여부 */
  planCheckRequired: boolean;
  /** denial 시 기본 resolve path */
  defaultResolvePath: DenialResolvePath;
  /** 이 command에서 구분해야 할 ownership roles */
  relevantOwnershipRoles: ('currentOwner' | 'reviewOwner' | 'approvalOwner' | 'nextOwner')[];
}

export const COMMAND_PERMISSION_RULES: Record<CoreCommandType, CommandPermissionRule> = {
  // ---- 1) select_quote_vendor ----
  select_quote_vendor: {
    commandType: 'select_quote_vendor',
    minimumRole: 'REQUESTER',
    allowedFunctionalRoles: ['procurement', 'lab_manager', 'general'],
    requiresOwnership: false,
    requiresApprovalComplete: false,
    requiresReviewComplete: true,
    policyCheckRequired: false,
    planCheckRequired: false,
    defaultResolvePath: {
      actionLabel: '견적 검토 완료 후 선정',
      surfaceType: 'review_section',
    },
    relevantOwnershipRoles: ['currentOwner', 'reviewOwner'],
  },

  // ---- 2) create_po_from_quote ----
  create_po_from_quote: {
    commandType: 'create_po_from_quote',
    minimumRole: 'APPROVER',
    allowedFunctionalRoles: ['procurement', 'finance'],
    requiresOwnership: false,
    requiresApprovalComplete: false,
    requiresReviewComplete: false,
    policyCheckRequired: true,
    planCheckRequired: true,
    defaultResolvePath: {
      actionLabel: '정책/예산 확인',
      surfaceType: 'policy_settings',
    },
    relevantOwnershipRoles: ['currentOwner'],
  },

  // ---- 3) submit_po_issue ----
  submit_po_issue: {
    commandType: 'submit_po_issue',
    minimumRole: 'APPROVER',
    allowedFunctionalRoles: ['procurement', 'finance'],
    requiresOwnership: true,
    requiresApprovalComplete: true,
    requiresReviewComplete: false,
    policyCheckRequired: true,
    planCheckRequired: false,
    defaultResolvePath: {
      actionLabel: '승인 완료 확인',
      surfaceType: 'approval_panel',
    },
    relevantOwnershipRoles: ['currentOwner', 'approvalOwner'],
  },

  // ---- 4) record_vendor_acknowledgement ----
  record_vendor_acknowledgement: {
    commandType: 'record_vendor_acknowledgement',
    minimumRole: 'REQUESTER',
    allowedFunctionalRoles: ['procurement', 'general'],
    requiresOwnership: true,
    requiresApprovalComplete: false,
    requiresReviewComplete: false,
    policyCheckRequired: false,
    planCheckRequired: false,
    defaultResolvePath: {
      actionLabel: '담당자 확인 또는 배정 변경',
      surfaceType: 'assignment_panel',
    },
    relevantOwnershipRoles: ['currentOwner'],
  },

  // ---- 5) complete_receiving_inspection ----
  complete_receiving_inspection: {
    commandType: 'complete_receiving_inspection',
    minimumRole: 'REQUESTER',
    allowedFunctionalRoles: ['receiving', 'lab_manager'],
    requiresOwnership: false,
    requiresApprovalComplete: false,
    requiresReviewComplete: true,
    policyCheckRequired: false,
    planCheckRequired: false,
    defaultResolvePath: {
      actionLabel: '검수 검토 완료',
      surfaceType: 'inspection_section',
    },
    relevantOwnershipRoles: ['currentOwner', 'reviewOwner'],
  },

  // ---- 6) save_receiving_lot_capture ----
  save_receiving_lot_capture: {
    commandType: 'save_receiving_lot_capture',
    minimumRole: 'REQUESTER',
    allowedFunctionalRoles: ['receiving', 'inventory', 'general'],
    requiresOwnership: true,
    requiresApprovalComplete: false,
    requiresReviewComplete: false,
    policyCheckRequired: false,
    planCheckRequired: false,
    defaultResolvePath: {
      actionLabel: '담당자 확인',
      surfaceType: 'assignment_panel',
    },
    relevantOwnershipRoles: ['currentOwner'],
  },

  // ---- 7) post_inventory_inbound ----
  post_inventory_inbound: {
    commandType: 'post_inventory_inbound',
    minimumRole: 'REQUESTER',
    allowedFunctionalRoles: ['receiving', 'inventory'],
    requiresOwnership: false,
    requiresApprovalComplete: false,
    requiresReviewComplete: true,
    policyCheckRequired: false,
    planCheckRequired: false,
    defaultResolvePath: {
      actionLabel: '검수/검토 완료 후 반영',
      surfaceType: 'inspection_section',
    },
    relevantOwnershipRoles: ['currentOwner', 'reviewOwner'],
  },

  // ---- 8) create_quote_from_reorder ----
  create_quote_from_reorder: {
    commandType: 'create_quote_from_reorder',
    minimumRole: 'REQUESTER',
    allowedFunctionalRoles: ['procurement', 'inventory', 'lab_manager'],
    requiresOwnership: false,
    requiresApprovalComplete: false,
    requiresReviewComplete: false,
    policyCheckRequired: true,
    planCheckRequired: true,
    defaultResolvePath: {
      actionLabel: '예산/정책 검토',
      surfaceType: 'policy_settings',
    },
    relevantOwnershipRoles: ['currentOwner', 'approvalOwner'],
  },
};

// ===========================================================================
// 8. Capability Evaluator
// ===========================================================================

/**
 * Actor + Entity context로부터 capability를 계산한다.
 * 화면별 ad-hoc 조건문 대신 이 함수를 사용한다.
 */
export function evaluateCapability(
  actor: ActorContext,
  entity: EntityPermissionContext,
): PermissionCapability {
  const isOwnerOrAdmin = entity.currentOwnerId === actor.userId
    || hasMinimumRole(actor.organizationRole, 'ADMIN');

  return {
    canView: hasMinimumRole(actor.organizationRole, 'VIEWER'),

    canEdit: hasMinimumRole(actor.organizationRole, 'REQUESTER')
      && (isOwnerOrAdmin || !entity.policyLocked),

    canExecute: hasMinimumRole(actor.organizationRole, 'REQUESTER')
      && !entity.policyLocked
      && !entity.planRestricted,

    canReview: actor.isReviewOwner
      || hasMinimumRole(actor.organizationRole, 'APPROVER'),

    canApprove: actor.isApprovalOwner
      || hasMinimumRole(actor.organizationRole, 'ADMIN'),

    canReassign: hasMinimumRole(actor.organizationRole, 'APPROVER')
      || actor.isEntityOwner,

    canResolveBlocker: actor.isEntityOwner
      || actor.isReviewOwner
      || hasMinimumRole(actor.organizationRole, 'ADMIN'),

    canTriggerReentry: hasMinimumRole(actor.organizationRole, 'REQUESTER')
      && !entity.planRestricted,
  };
}

// ===========================================================================
// 9. Command Preflight Evaluator
// ===========================================================================

/**
 * Command 실행 전 preflight eligibility를 평가한다.
 * 기존 mutation-baseline.checkCommandEligibility를 확장하여
 * denial class 분류 + recovery path를 제공한다.
 */
export function evaluateCommandPreflight(
  commandType: CoreCommandType,
  actor: ActorContext,
  entity: EntityPermissionContext,
  ownership: OwnershipContext,
): PreflightEligibility {
  const rule = COMMAND_PERMISSION_RULES[commandType];
  const denials: DenialDetail[] = [];
  let needsRecheck = false;
  let prerequisiteRequired = false;
  let prerequisiteSummary: string | undefined;

  // ---- Role check ----
  if (!hasMinimumRole(actor.organizationRole, rule.minimumRole)) {
    denials.push({
      denialClass: 'role_restricted',
      reasonSummary: `최소 ${rule.minimumRole} 역할이 필요합니다.`,
      requiredOwnerRole: rule.minimumRole,
      resolvePath: {
        actionLabel: '관리자에게 역할 변경 요청',
        surfaceType: 'assignment_panel',
        route: '/dashboard/inbox',
        routeLabel: '작업함',
      },
    });
  }

  // ---- Ownership check ----
  if (rule.requiresOwnership && !actor.isEntityOwner && !hasMinimumRole(actor.organizationRole, 'ADMIN')) {
    denials.push({
      denialClass: 'owner_mismatch',
      reasonSummary: '이 항목의 담당자가 아닙니다.',
      nextAuthorizedOwnerName: ownership.currentOwner?.name,
      resolvePath: {
        actionLabel: '담당자 확인 또는 배정 변경',
        surfaceType: 'assignment_panel',
      },
    });
  }

  // ---- Approval requirement ----
  if (rule.requiresApprovalComplete && entity.approvalRequired && !entity.approvalCompleted) {
    prerequisiteRequired = true;
    prerequisiteSummary = '승인이 먼저 완료되어야 합니다.';
    denials.push({
      denialClass: 'approval_required',
      reasonSummary: '승인이 완료되지 않았습니다.',
      nextAuthorizedOwnerName: ownership.approvalOwner?.name,
      requiredOwnerRole: 'APPROVER',
      resolvePath: {
        actionLabel: '승인 패널에서 승인 처리',
        surfaceType: 'approval_panel',
      },
    });
  }

  // ---- Review requirement ----
  if (rule.requiresReviewComplete && entity.reviewRequired && !entity.reviewCompleted) {
    prerequisiteRequired = true;
    prerequisiteSummary = prerequisiteSummary
      ? `${prerequisiteSummary} 검토도 필요합니다.`
      : '검토가 먼저 완료되어야 합니다.';
    denials.push({
      denialClass: 'review_required_before_execute',
      reasonSummary: '검토가 완료되지 않았습니다.',
      nextAuthorizedOwnerName: ownership.reviewOwner?.name,
      requiredOwnerRole: 'APPROVER',
      resolvePath: {
        actionLabel: '검토 섹션에서 검토 완료',
        surfaceType: 'review_section',
      },
    });
  }

  // ---- Policy lock ----
  if (rule.policyCheckRequired && entity.policyLocked) {
    denials.push({
      denialClass: 'policy_locked',
      reasonSummary: entity.policyLockReason || '조직 정책에 의해 잠김',
      resolvePath: {
        actionLabel: '정책 설정 확인',
        surfaceType: 'policy_settings',
      },
    });
  }

  // ---- Plan restriction ----
  if (rule.planCheckRequired && entity.planRestricted) {
    denials.push({
      denialClass: 'plan_restricted',
      reasonSummary: entity.planRestrictionReason || '플랜 제한',
      resolvePath: {
        actionLabel: '플랜 업그레이드 검토',
        surfaceType: 'plan_upgrade',
      },
    });
  }

  // ---- Stale permission context ----
  if (!entity.knownVersion) {
    needsRecheck = true;
  }

  return {
    eligible: denials.length === 0,
    denials,
    needsRecheck,
    prerequisiteRequired,
    prerequisiteSummary,
  };
}

// ===========================================================================
// 10. Execution Denial Classifier
// ===========================================================================

/**
 * 실제 실행 시 서버 응답 기반으로 denial을 분류한다.
 * preflight와 달리 canonical truth 기준.
 */
export function classifyExecutionDenial(
  commandType: CoreCommandType,
  serverError: {
    code: string;
    message?: string;
    ownerMismatch?: boolean;
    approvalPending?: boolean;
    policyBlocked?: boolean;
    planRestricted?: boolean;
    reviewPending?: boolean;
    stalePerm?: boolean;
  },
): ExecutionDenial {
  const rule = COMMAND_PERMISSION_RULES[commandType];

  // stale permission 우선 체크
  if (serverError.stalePerm) {
    return {
      denied: true,
      denialClass: 'stale_permission_context',
      detail: {
        denialClass: 'stale_permission_context',
        reasonSummary: '권한 정보가 변경되었습니다. 최신 상태를 확인하세요.',
        resolvePath: {
          actionLabel: '최신 상태 확인',
          surfaceType: 'refresh_current',
        },
      },
    };
  }

  if (serverError.ownerMismatch) {
    return {
      denied: true,
      denialClass: 'owner_mismatch',
      detail: {
        denialClass: 'owner_mismatch',
        reasonSummary: serverError.message || '담당자가 변경되었습니다.',
        resolvePath: {
          actionLabel: '담당자 확인',
          surfaceType: 'assignment_panel',
        },
      },
    };
  }

  if (serverError.approvalPending) {
    return {
      denied: true,
      denialClass: 'approval_required',
      detail: {
        denialClass: 'approval_required',
        reasonSummary: serverError.message || '승인이 완료되지 않았습니다.',
        resolvePath: rule.defaultResolvePath,
      },
    };
  }

  if (serverError.policyBlocked) {
    return {
      denied: true,
      denialClass: 'policy_locked',
      detail: {
        denialClass: 'policy_locked',
        reasonSummary: serverError.message || '조직 정책에 의해 차단되었습니다.',
        resolvePath: {
          actionLabel: '정책 설정 확인',
          surfaceType: 'policy_settings',
        },
      },
    };
  }

  if (serverError.planRestricted) {
    return {
      denied: true,
      denialClass: 'plan_restricted',
      detail: {
        denialClass: 'plan_restricted',
        reasonSummary: serverError.message || '플랜 제한으로 실행할 수 없습니다.',
        resolvePath: {
          actionLabel: '플랜 업그레이드',
          surfaceType: 'plan_upgrade',
        },
      },
    };
  }

  if (serverError.reviewPending) {
    return {
      denied: true,
      denialClass: 'review_required_before_execute',
      detail: {
        denialClass: 'review_required_before_execute',
        reasonSummary: serverError.message || '검토가 완료되지 않았습니다.',
        resolvePath: {
          actionLabel: '검토 완료 요청',
          surfaceType: 'review_section',
        },
      },
    };
  }

  // role restricted fallback
  if (serverError.code === 'permission_denied' || serverError.code === 'forbidden') {
    return {
      denied: true,
      denialClass: 'role_restricted',
      detail: {
        denialClass: 'role_restricted',
        reasonSummary: serverError.message || '이 작업을 수행할 권한이 없습니다.',
        requiredOwnerRole: rule.minimumRole,
        resolvePath: {
          actionLabel: '관리자에게 역할 변경 요청',
          surfaceType: 'assignment_panel',
          route: '/dashboard/inbox',
          routeLabel: '작업함',
        },
      },
    };
  }

  // 거부 아닌 경우
  return { denied: false };
}

// ===========================================================================
// 11. Recovery Path Builder
// ===========================================================================

/**
 * Denial 발생 시 recovery path를 빌드한다.
 */
export function buildRecoveryPaths(
  commandType: CoreCommandType,
  denials: DenialDetail[],
): RecoveryPath {
  if (denials.length === 0) {
    return { available: false, paths: [] };
  }

  const paths: DenialResolvePath[] = [];
  const seenSurfaces = new Set<string>();

  for (const denial of denials) {
    if (denial.resolvePath && !seenSurfaces.has(denial.resolvePath.surfaceType)) {
      seenSurfaces.add(denial.resolvePath.surfaceType);
      paths.push(denial.resolvePath);
    }
  }

  // command-level default fallback
  const rule = COMMAND_PERMISSION_RULES[commandType];
  if (paths.length === 0) {
    paths.push(rule.defaultResolvePath);
  }

  return { available: paths.length > 0, paths };
}

// ===========================================================================
// 12. Full Action Permission Evaluation
// ===========================================================================

/**
 * Command에 대한 완전한 permission 평가.
 * visibility → preflight → (execution은 실행 후) → recovery.
 */
export function evaluateActionPermission(
  commandType: CoreCommandType,
  actor: ActorContext,
  entity: EntityPermissionContext,
  ownership: OwnershipContext,
): ActionPermissionEvaluation {
  const rule = COMMAND_PERMISSION_RULES[commandType];
  const capability = evaluateCapability(actor, entity);

  // ---- Visibility ----
  const visibility: ActionVisibility = {
    visible: capability.canView && hasMinimumRole(actor.organizationRole, 'VIEWER'),
  };
  if (!visibility.visible) {
    visibility.hiddenReason = '이 작업을 볼 수 있는 권한이 없습니다.';
  }

  // ---- Preflight ----
  const preflight = evaluateCommandPreflight(commandType, actor, entity, ownership);

  // ---- Execution (placeholder — 실제 실행 후 서버 응답으로 결정) ----
  const execution: ExecutionDenial = { denied: false };

  // ---- Recovery ----
  const recovery = buildRecoveryPaths(commandType, preflight.denials);

  return {
    commandType,
    entityType: entity.entityType,
    entityId: entity.entityId,
    visibility,
    preflight,
    execution,
    recovery,
  };
}

// ===========================================================================
// 13. Permission Context Freshness
// ===========================================================================

/**
 * Permission context의 freshness 상태.
 */
export type PermissionFreshness =
  | 'fresh'            // 방금 확인됨
  | 'possibly_stale'   // 시간 경과, 변경 가능성 있음
  | 'needs_recheck';   // 확실히 재검사 필요

/**
 * Permission context freshness를 판별한다.
 */
export function evaluatePermissionFreshness(
  lastCheckedAt: string | undefined,
  recentEvents: {
    roleChanged?: boolean;
    ownerReassigned?: boolean;
    policyPublished?: boolean;
    approvalStateChanged?: boolean;
  },
  maxFreshAge: number = 3 * 60 * 1000,  // 3분
): PermissionFreshness {
  // 최근 이벤트가 있으면 즉시 재검사 필요
  if (
    recentEvents.roleChanged
    || recentEvents.ownerReassigned
    || recentEvents.policyPublished
    || recentEvents.approvalStateChanged
  ) {
    return 'needs_recheck';
  }

  if (!lastCheckedAt) {
    return 'needs_recheck';
  }

  const age = Date.now() - new Date(lastCheckedAt).getTime();
  if (age > maxFreshAge) {
    return 'possibly_stale';
  }

  return 'fresh';
}

// ===========================================================================
// 14. Permission-Aware Summary Model
// ===========================================================================

/**
 * Dashboard / Inbox / Landing / Detail / Action Surface 공통 permission summary.
 * 화면마다 별도 permission schema를 만들지 않고 이 모델을 재사용한다.
 */
export interface PermissionSummary {
  // ---- Capability ----
  canView: boolean;
  canEdit: boolean;
  canExecute: boolean;
  canReview: boolean;
  canApprove: boolean;
  canTriggerReentry: boolean;

  // ---- Restriction ----
  restrictionClass?: DenialClass;
  restrictionReasonSummary?: string;

  // ---- Ownership / Role ----
  requiredOwnerRole?: string;
  approvalRequirementSummary?: string;
  policyLockSummary?: string;
  planRestrictionSummary?: string;

  // ---- Next authorized ----
  nextAuthorizedOwnerName?: string;
  nextAuthorizedRoute?: string;

  // ---- Freshness ----
  freshness: PermissionFreshness;
}

/**
 * Capability + Preflight + Entity context로부터
 * 공통 PermissionSummary를 빌드한다.
 */
export function buildPermissionSummary(
  capability: PermissionCapability,
  preflight: PreflightEligibility,
  entity: EntityPermissionContext,
  ownership: OwnershipContext,
  freshness: PermissionFreshness,
): PermissionSummary {
  // primary denial 추출
  const primaryDenial = preflight.denials[0] ?? undefined;

  return {
    canView: capability.canView,
    canEdit: capability.canEdit,
    canExecute: capability.canExecute && preflight.eligible,
    canReview: capability.canReview,
    canApprove: capability.canApprove,
    canTriggerReentry: capability.canTriggerReentry,

    restrictionClass: primaryDenial?.denialClass,
    restrictionReasonSummary: primaryDenial?.reasonSummary,
    requiredOwnerRole: primaryDenial?.requiredOwnerRole,

    approvalRequirementSummary: entity.approvalRequired && !entity.approvalCompleted
      ? `승인 필요 (승인자: ${ownership.approvalOwner?.name ?? '미지정'})`
      : undefined,

    policyLockSummary: entity.policyLocked
      ? entity.policyLockReason ?? '정책 잠김'
      : undefined,

    planRestrictionSummary: entity.planRestricted
      ? entity.planRestrictionReason ?? '플랜 제한'
      : undefined,

    nextAuthorizedOwnerName: primaryDenial?.nextAuthorizedOwnerName,
    nextAuthorizedRoute: primaryDenial?.resolvePath?.route,

    freshness,
  };
}

// ===========================================================================
// 15. Command-specific Denial → Recovery Route Mapping
// ===========================================================================

/**
 * Command별 denial class → 구체적 recovery route 매핑.
 * generic "권한 없음" 대신 command 맥락에 맞는 안내를 제공한다.
 */
export const COMMAND_DENIAL_RECOVERY_MAP: Record<CoreCommandType, Partial<Record<DenialClass, {
  title: string;
  description: string;
  route?: string;
  routeLabel?: string;
}>>> = {
  select_quote_vendor: {
    owner_mismatch: {
      title: '담당자가 아닙니다',
      description: '이 견적의 담당자에게 확인하거나 배정 변경을 요청하세요.',
      route: '/dashboard/quotes',
      routeLabel: '견적 목록',
    },
    review_required_before_execute: {
      title: '검토 완료 후 선정 가능',
      description: '견적 비교 검토가 완료되어야 공급사를 선정할 수 있습니다.',
    },
    policy_locked: {
      title: '정책에 의해 잠김',
      description: '조직 구매 정책에 의해 이 견적 선정이 제한됩니다.',
    },
  },

  create_po_from_quote: {
    role_restricted: {
      title: '발주 생성 권한 없음',
      description: '승인자(APPROVER) 이상 역할이 필요합니다.',
    },
    policy_locked: {
      title: '예산/정책 제한',
      description: '조직 구매 정책 또는 예산 한도에 의해 제한됩니다.',
    },
    plan_restricted: {
      title: '플랜 기능 제한',
      description: '현재 플랜에서 발주 자동 생성이 제한됩니다.',
    },
  },

  submit_po_issue: {
    approval_required: {
      title: '승인 미완료',
      description: '재무/구매 승인이 완료되어야 발주를 발행할 수 있습니다.',
      route: '/dashboard/purchase-orders',
      routeLabel: '발주 목록',
    },
    owner_mismatch: {
      title: '발행 담당자가 아닙니다',
      description: '이 발주의 담당자만 발행할 수 있습니다.',
    },
    policy_locked: {
      title: '정책 잠김',
      description: '조직 정책에 의해 이 발주 발행이 제한됩니다.',
    },
  },

  record_vendor_acknowledgement: {
    owner_mismatch: {
      title: '담당자가 아닙니다',
      description: '이 발주의 담당자만 공급사 확인을 기록할 수 있습니다.',
    },
  },

  complete_receiving_inspection: {
    review_required_before_execute: {
      title: '검수 검토 필요',
      description: '검수 검토가 완료되어야 검수를 완료할 수 있습니다.',
    },
    owner_mismatch: {
      title: '검수 담당자가 아닙니다',
      description: '이 입고의 검수 담당자 또는 입고 담당자만 검수를 완료할 수 있습니다.',
    },
  },

  save_receiving_lot_capture: {
    owner_mismatch: {
      title: '입고 담당자가 아닙니다',
      description: '이 입고의 담당자만 Lot/문서 정보를 입력할 수 있습니다.',
    },
  },

  post_inventory_inbound: {
    review_required_before_execute: {
      title: '검수/검토 미완료',
      description: '검수 검토가 완료되어야 재고에 반영할 수 있습니다.',
    },
    policy_locked: {
      title: '정책 잠김',
      description: '재고 반영이 조직 정책에 의해 제한됩니다.',
    },
  },

  create_quote_from_reorder: {
    policy_locked: {
      title: '예산/정책 검토 필요',
      description: '재주문 견적 생성이 예산/정책 제한에 의해 제한됩니다.',
      route: '/dashboard/stock-risk',
      routeLabel: '재고 위험',
    },
    plan_restricted: {
      title: '플랜 제한',
      description: '현재 플랜에서 자동 재주문이 제한됩니다.',
    },
    approval_required: {
      title: '예산 승인 필요',
      description: '예산 승인자의 승인이 필요합니다.',
    },
  },
};

// ===========================================================================
// 16. Action Surface Eligibility Connector
// ===========================================================================

/**
 * Action surface에서 버튼 상태를 결정할 때 사용하는 구조.
 * generic disabled 대신 구체적 사유를 전달한다.
 */
export interface ActionSurfaceEligibility {
  /** 버튼 표시 여부 */
  visible: boolean;
  /** 버튼 활성 여부 */
  enabled: boolean;
  /** 비활성 사유 라벨 (tooltip / 하단 안내용) */
  disabledLabel?: string;
  /** denial class (있으면) */
  disabledClass?: DenialClass;
  /** 선행 조건 안내 */
  prerequisiteLabel?: string;
  /** resolve-first 경로 */
  resolveAction?: {
    label: string;
    route?: string;
  };
}

/**
 * ActionPermissionEvaluation → ActionSurfaceEligibility 변환.
 * 모든 action surface에서 동일하게 사용한다.
 */
export function toActionSurfaceEligibility(
  evaluation: ActionPermissionEvaluation,
): ActionSurfaceEligibility {
  if (!evaluation.visibility.visible) {
    return { visible: false, enabled: false };
  }

  if (evaluation.preflight.eligible) {
    return {
      visible: true,
      enabled: true,
      prerequisiteLabel: evaluation.preflight.needsRecheck
        ? '권한 정보가 최신이 아닐 수 있습니다'
        : undefined,
    };
  }

  // ---- Disabled state with detail ----
  const primaryDenial = evaluation.preflight.denials[0];
  const commandRecovery = COMMAND_DENIAL_RECOVERY_MAP[evaluation.commandType];
  const specificRecovery = primaryDenial
    ? commandRecovery?.[primaryDenial.denialClass]
    : undefined;

  return {
    visible: true,
    enabled: false,
    disabledLabel: specificRecovery?.description
      ?? primaryDenial?.reasonSummary
      ?? '실행할 수 없습니다',
    disabledClass: primaryDenial?.denialClass,
    prerequisiteLabel: evaluation.preflight.prerequisiteSummary,
    resolveAction: primaryDenial?.resolvePath
      ? {
          label: primaryDenial.resolvePath.actionLabel,
          route: primaryDenial.resolvePath.route,
        }
      : undefined,
  };
}

// ===========================================================================
// 17. Screen-level Permission Consistency Guard
// ===========================================================================

/**
 * Dashboard/Inbox에서 "ready" 표시인데 Detail에서 "permission denied"가
 * 반복되는 불일치를 방지하기 위한 guard.
 *
 * Inbox/Landing에서 item을 보여줄 때 이 함수로 pre-screen한다.
 */
export interface ScreenPermissionGuard {
  /** 아이템을 목록에 표시할지 */
  showInList: boolean;
  /** action available 표시할지 */
  showActionAvailable: boolean;
  /** 실제 action 가능한지 (detail에서도 동일) */
  canActOnDetail: boolean;
  /** 불일치 시 경고 */
  inconsistencyWarning?: string;
}

export function evaluateScreenPermissionGuard(
  capability: PermissionCapability,
  preflight: PreflightEligibility,
  itemReadiness: string,
): ScreenPermissionGuard {
  const canActOnDetail = preflight.eligible;

  // "ready" 상태인데 permission에서 차단되면 불일치 경고
  const isReadyButBlocked = (itemReadiness === 'ready' || itemReadiness === 'actionable')
    && !canActOnDetail;

  return {
    showInList: capability.canView,
    showActionAvailable: capability.canView && (canActOnDetail || preflight.denials.length === 0),
    canActOnDetail,
    inconsistencyWarning: isReadyButBlocked
      ? '이 항목은 처리 가능 상태이나 현재 권한으로는 실행할 수 없습니다. 담당자/역할을 확인하세요.'
      : undefined,
  };
}
