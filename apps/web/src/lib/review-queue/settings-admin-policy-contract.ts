// ─────────────────────────────────────────────
// Settings / Admin Policy / Control Surface 중앙 계약
// ─────────────────────────────────────────────
// 운영 정책 정의 → 스코프 할당 → 권한/잠금 평가 →
// 하류 영향 → 감사 추적 → 제어된 저장
//
// 핵심 규칙:
//   - 설정 값과 정책 평가 결과는 절대 혼합하지 않는다
//   - 전역/워크스페이스/모듈/역할 기반 설정은 분리한다
//   - 저장 가능 상태와 적용된 유효 상태를 구분한다
//   - 잠금 유형: plan/role/inherited/compliance/temporary_freeze 구분
//   - Draft → 검증 → 게시 → 롤백 흐름
//   - 계약 레이어에 UI 라벨 없음
// ─────────────────────────────────────────────

// ─── 상태 타입 ─────────────────────────────────

/** 정책 관리 표면(surface) 전체의 운영 상태 */
export type AdminPolicySurfaceStatus =
  | "active"
  | "drafting"
  | "pending_review"
  | "publishing"
  | "published"
  | "rollback_available"
  | "archived";

/** 정책 섹션 단위의 표시·편집 상태 */
export type AdminPolicySectionStatus =
  | "active"
  | "locked"
  | "read_only"
  | "plan_restricted"
  | "hidden"
  | "draft_changed";

/** 개별 정책 필드의 편집·상속·유효성 상태 */
export type AdminPolicyFieldStatus =
  | "clean"
  | "dirty"
  | "invalid"
  | "locked"
  | "inherited"
  | "overridden"
  | "review_required";

/** 초안(draft)의 생명주기 상태 */
export type AdminPolicyDraftStatus =
  | "draft"
  | "validation_failed"
  | "ready_for_review"
  | "pending_approval"
  | "approved"
  | "publish_blocked"
  | "published"
  | "discarded";

/** 게시 실행(publish execution)의 진행 상태 */
export type AdminPolicyPublishStatus =
  | "not_started"
  | "submitted"
  | "under_review"
  | "approved"
  | "blocked"
  | "published"
  | "rolled_back";

// ─── 계약 인터페이스 ──────────────────────────────

/**
 * 정책 관리 표면(surface) 계약
 * - 하나의 워크스페이스 내 특정 운영 영역(procurement, inventory 등)의 정책 묶음
 * - 섹션 → 필드 → 값 구조를 갖는다
 */
export interface AdminPolicySurfaceContract {
  /** 표면 고유 식별자 */
  id: string;
  /** 소속 워크스페이스 ID */
  workspaceId: string;
  /** 정책 표면 유형 */
  surfaceType:
    | "workspace"
    | "procurement"
    | "inventory"
    | "approval"
    | "notification"
    | "security"
    | "vendor";
  /** 현재 운영 상태 */
  status: AdminPolicySurfaceStatus;
  /** 게시 버전 번호 */
  version: number;
  /** 마지막 게시 일시 (ISO 8601) */
  lastPublishedAt?: string;
  /** 마지막 게시자 ID */
  lastPublishedBy?: string;
  /** 하위 정책 섹션 목록 */
  sections: AdminPolicySectionContract[];
  /** 상위 워크스페이스 상속 ID (있을 경우) */
  inheritedFromWorkspaceId?: string;
  /** 현재 플랜 티어 (잠금·제한 평가에 사용) */
  planTier?: string;
  /** 관련 감사 추적 항목 ID 목록 */
  auditTrailIds?: string[];
}

/**
 * 정책 섹션 계약
 * - 하나의 표면 내 특정 정책 카테고리(승인, 예산, 보안 등)
 * - 필드 목록, 가시성·편집·잠금 규칙을 포함한다
 */
export interface AdminPolicySectionContract {
  /** 섹션 고유 식별자 */
  id: string;
  /** 소속 표면 ID */
  surfaceId: string;
  /** 섹션 키 (프로그래밍 식별용) */
  sectionKey: string;
  /** 정책 카테고리 */
  category:
    | "approval"
    | "budget"
    | "notification"
    | "security"
    | "document"
    | "inventory"
    | "vendor"
    | "workspace";
  /** 섹션 상태 */
  status: AdminPolicySectionStatus;
  /** 적용 스코프 */
  scope: AdminPolicyScopeContract;
  /** 하위 필드 목록 */
  fields: AdminPolicyFieldContract[];
  /** 가시성 규칙 */
  visibilityRule: AdminPolicyVisibilityRuleContract;
  /** 편집 규칙 */
  editRule: AdminPolicyEditRuleContract;
  /** 잠금 규칙 (설정된 경우) */
  lockRule?: AdminPolicyLockRuleContract;
  /** 이 섹션이 영향을 주는 하류 모듈 참조 목록 */
  downstreamModuleRefs: string[];
  /** 영향 평가 규칙 ID 목록 */
  impactRuleIds?: string[];
}

/**
 * 정책 필드 계약
 * - 개별 설정 값의 타입, 현재 값, 기본 값, 상태, 유효성 검사를 정의
 */
export interface AdminPolicyFieldContract {
  /** 필드 고유 식별자 */
  id: string;
  /** 소속 섹션 ID */
  sectionId: string;
  /** 필드 키 (프로그래밍 식별용) */
  fieldKey: string;
  /** 값 타입 */
  valueType:
    | "boolean"
    | "number"
    | "text"
    | "enum"
    | "multi_enum"
    | "currency"
    | "days"
    | "user_ref"
    | "role_ref"
    | "vendor_ref";
  /** 현재 설정 값 */
  currentValue: unknown;
  /** 기본 값 (있을 경우) */
  defaultValue?: unknown;
  /** 허용 값 목록 (enum/multi_enum 등) */
  allowedValues?: unknown[];
  /** 필수 여부 */
  required: boolean;
  /** 민감 설정 여부 (MFA 필요 등) */
  isSensitive: boolean;
  /** 상위에서 상속된 값인지 여부 */
  isInherited: boolean;
  /** 상속 값을 오버라이드했는지 여부 */
  isOverridden: boolean;
  /** 필드 상태 */
  status: AdminPolicyFieldStatus;
  /** 유효성 검사 규칙 ID 목록 */
  validationRuleIds?: string[];
  /** 의존 필드 키 목록 (이 필드 변경 시 함께 검증 필요) */
  dependencyFieldKeys?: string[];
  /** 마지막 변경 일시 (ISO 8601) */
  changedAt?: string;
  /** 마지막 변경자 ID */
  changedBy?: string;
}

/**
 * 정책 적용 스코프 계약
 * - 전역/워크스페이스/팀/위치/모듈/역할 수준 적용 범위 정의
 */
export interface AdminPolicyScopeContract {
  /** 스코프 유형 */
  scopeType: "global" | "workspace" | "team" | "location" | "module" | "role";
  /** 스코프 대상 ID 목록 (특정 팀, 위치 등) */
  scopeIds?: string[];
  /** 상속 모드 */
  inheritanceMode: "direct" | "inherited" | "overridden";
  /** 유효 시작 일시 (ISO 8601) */
  effectiveFrom?: string;
  /** 유효 종료 일시 (ISO 8601) */
  effectiveUntil?: string;
}

/**
 * 섹션 가시성 규칙 계약
 * - 어떤 역할에 표시할지, 플랜·기능 제한 시 숨길지 정의
 */
export interface AdminPolicyVisibilityRuleContract {
  /** 규칙 고유 식별자 */
  id: string;
  /** 소속 섹션 ID */
  sectionId: string;
  /** 이 섹션을 볼 수 있는 역할 목록 */
  visibleToRoles: string[];
  /** 플랜 제한 시 숨김 여부 */
  hiddenWhenPlanRestricted: boolean;
  /** 기능 비활성화 시 숨김 여부 */
  hiddenWhenFeatureDisabled: boolean;
  /** 잠금 시 읽기 전용으로 표시할지 여부 */
  showReadOnlyWhenLocked: boolean;
}

/**
 * 섹션 편집 규칙 계약
 * - 편집 가능 역할, 소유자 전용 여부, MFA·승인 필요 여부 정의
 */
export interface AdminPolicyEditRuleContract {
  /** 규칙 고유 식별자 */
  id: string;
  /** 소속 섹션 ID */
  sectionId: string;
  /** 편집 가능 역할 목록 */
  editableByRoles: string[];
  /** 소유자(OWNER) 역할 필수 여부 */
  requiresOwnerRole: boolean;
  /** 민감 변경 시 MFA 필요 여부 */
  requiresMfaForSensitiveChange: boolean;
  /** 변경 시 승인 필요 여부 */
  approvalRequiredForChange: boolean;
  /** 변경 승인 정책 ID (승인 필요 시) */
  changeApprovalPolicyId?: string;
}

/**
 * 섹션 잠금 규칙 계약
 * - 잠금 유형(plan/role/inherited/compliance/temporary_freeze)과 조건 정의
 */
export interface AdminPolicyLockRuleContract {
  /** 규칙 고유 식별자 */
  id: string;
  /** 소속 섹션 ID */
  sectionId: string;
  /** 잠금 유형 */
  lockType: "plan" | "role" | "inherited" | "compliance" | "temporary_freeze";
  /** 현재 잠금 여부 */
  isLocked: boolean;
  /** 잠금 사유 코드 */
  lockReasonCode: string;
  /** 잠금 해제 일시 (임시 동결 등, ISO 8601) */
  lockUntil?: string;
  /** 잠금 해제 조건 코드 목록 */
  unlockConditionCodes?: string[];
}

/**
 * 정책 초안(draft) 계약
 * - 변경 사항을 추적하고 검증·승인·게시까지의 생명주기를 관리
 */
export interface AdminPolicyDraftContract {
  /** 초안 고유 식별자 */
  id: string;
  /** 소속 워크스페이스 ID */
  workspaceId: string;
  /** 대상 표면 ID */
  surfaceId: string;
  /** 기준 버전 번호 (어느 버전을 기반으로 수정 중인지) */
  baseVersion: number;
  /** 초안 상태 */
  status: AdminPolicyDraftStatus;
  /** 변경된 섹션 ID 목록 */
  dirtySectionIds: string[];
  /** 변경된 필드 ID 목록 */
  dirtyFieldIds: string[];
  /** 유효성 검증 이슈 ID 목록 */
  validationIssueIds: string[];
  /** 생성 일시 (ISO 8601) */
  createdAt: string;
  /** 생성자 ID */
  createdBy: string;
  /** 마지막 수정 일시 (ISO 8601) */
  updatedAt: string;
  /** 마지막 수정자 ID */
  updatedBy: string;
  /** 변경 항목 목록 */
  changeSet: AdminPolicyChangeSetContract[];
}

/**
 * 정책 변경 항목 계약
 * - 개별 필드의 변경 전·후 값, 변경 유형, 영향도, 검토 필요 여부
 */
export interface AdminPolicyChangeSetContract {
  /** 변경 항목 고유 식별자 */
  id: string;
  /** 소속 초안 ID */
  draftId: string;
  /** 대상 섹션 ID */
  sectionId: string;
  /** 대상 필드 ID */
  fieldId: string;
  /** 변경 전 값 */
  previousValue: unknown;
  /** 변경 후 값 */
  nextValue: unknown;
  /** 변경 유형 */
  changeType: "create_override" | "update" | "clear_override" | "reset_default";
  /** 변경 영향 수준 */
  impactLevel: "low" | "medium" | "high" | "critical";
  /** 검토 필요 여부 */
  requiresReview: boolean;
}

/**
 * 정책 유효성 검증 이슈 계약
 * - 초안의 검증 결과로 발생하는 이슈(차단/경고/정보)를 표현
 */
export interface AdminPolicyValidationIssueContract {
  /** 이슈 고유 식별자 */
  id: string;
  /** 소속 초안 ID */
  draftId: string;
  /** 관련 섹션 ID (있을 경우) */
  sectionId?: string;
  /** 관련 필드 ID (있을 경우) */
  fieldId?: string;
  /** 이슈 유형 */
  issueType:
    | "required_missing"
    | "dependency_missing"
    | "invalid_range"
    | "role_conflict"
    | "scope_conflict"
    | "plan_restricted"
    | "unsafe_change";
  /** 심각도 */
  severity: "info" | "warning" | "error" | "critical";
  /** 게시 차단 여부 */
  blocking: boolean;
  /** 사유 코드 */
  reasonCode: string;
  /** 관련 필드 키 목록 */
  relatedFieldKeys?: string[];
}

/**
 * 정책 영향 평가 계약
 * - 초안 변경이 하류 모듈(quote, po, receiving 등)에 미치는 영향을 정의
 */
export interface AdminPolicyImpactAssessmentContract {
  /** 평가 고유 식별자 */
  id: string;
  /** 소속 초안 ID */
  draftId: string;
  /** 대상 섹션 ID */
  sectionId: string;
  /** 영향 받는 모듈 목록 */
  affectedModules: (
    | "quote"
    | "po"
    | "receiving"
    | "inventory"
    | "reorder"
    | "vendor"
    | "notification"
    | "approval"
  )[];
  /** 영향 받는 워크플로우 상태 목록 */
  affectedWorkflowStates: string[];
  /** 영향 유형 */
  impactType:
    | "config_only"
    | "runtime_rule_change"
    | "approval_path_change"
    | "permission_change"
    | "notification_change";
  /** 위험 수준 */
  riskLevel: "low" | "medium" | "high" | "critical";
  /** 적용 전 확인 필요 여부 */
  requiresConfirmation: boolean;
  /** 영향 사유 코드 목록 */
  impactReasonCodes: string[];
}

/**
 * 게시 실행 계약
 * - 초안의 게시 프로세스 추적: 제출 → 검토 → 승인 → 게시 → 롤백
 */
export interface AdminPolicyPublishExecutionContract {
  /** 실행 고유 식별자 */
  id: string;
  /** 대상 초안 ID */
  draftId: string;
  /** 대상 표면 ID */
  surfaceId: string;
  /** 게시 상태 */
  status: AdminPolicyPublishStatus;
  /** 제출 일시 (ISO 8601) */
  submittedAt: string;
  /** 제출자 ID */
  submittedBy: string;
  /** 검토 완료 일시 (ISO 8601) */
  reviewedAt?: string;
  /** 검토자 ID */
  reviewedBy?: string;
  /** 승인 일시 (ISO 8601) */
  approvedAt?: string;
  /** 승인자 ID */
  approvedBy?: string;
  /** 게시 일시 (ISO 8601) */
  publishedAt?: string;
  /** 게시자 ID */
  publishedBy?: string;
  /** 롤백 가능 여부 */
  rollbackAvailable: boolean;
  /** 롤백 참조 버전 번호 */
  rollbackReferenceVersion?: number;
  /** 게시 차단 사유 목록 */
  blockedReasons: string[];
}

/**
 * 정책 감사 추적 항목 계약
 * - 정책 변경에 대한 모든 행위를 기록하는 감사 로그
 */
export interface AdminPolicyAuditEntryContract {
  /** 항목 고유 식별자 */
  id: string;
  /** 소속 워크스페이스 ID */
  workspaceId: string;
  /** 대상 표면 ID */
  surfaceId: string;
  /** 관련 섹션 ID (있을 경우) */
  sectionId?: string;
  /** 관련 필드 ID (있을 경우) */
  fieldId?: string;
  /** 행위 유형 */
  actionType:
    | "draft_created"
    | "field_changed"
    | "validation_failed"
    | "submitted"
    | "approved"
    | "published"
    | "rollback"
    | "override_cleared";
  /** 행위 일시 (ISO 8601) */
  actedAt: string;
  /** 행위자 ID */
  actedBy: string;
  /** 변경 요약 코드 목록 */
  changeSummaryCodes: string[];
  /** 행위자 IP 해시 (프라이버시 보호) */
  sourceIpHash?: string;
  /** MFA 인증 여부 */
  mfaVerified: boolean;
  /** 관련 게시 실행 ID */
  relatedExecutionId?: string;
}

// ─── 설명 상수 및 운영 카피 ────────────────────────

/** 정책 표면 유형별 한국어 설명 */
export const ADMIN_SURFACE_TYPE_DESCRIPTIONS: Record<
  AdminPolicySurfaceContract["surfaceType"],
  { label: string; description: string }
> = {
  workspace: {
    label: "워크스페이스 운영",
    description: "기본 통화, 세금, 문서 번호, 위치, 비활성 사용자 정책",
  },
  procurement: {
    label: "구매 운영",
    description: "견적 SLA, 발주 정책, 공급사 거래 규칙",
  },
  inventory: {
    label: "재고 운영",
    description: "lot 필수, 유효기간 필수, 문서 요건, 격리 해제 조건",
  },
  approval: {
    label: "승인 정책",
    description: "승인 단계, 고액 승인, 긴급 bypass, 반환 경로",
  },
  notification: {
    label: "알림 정책",
    description: "응답 지연, 승인 대기, 입고 지연, 만료 위험 알림",
  },
  security: {
    label: "보안/접근",
    description: "MFA, 다운로드 권한, 문서 export, role 기반 제한",
  },
  vendor: {
    label: "공급사 거버넌스",
    description: "선호 공급사, 비승인 제한, 대체 허용, risk flag 연계",
  },
};

/** 정책 섹션 카테고리별 한국어 설명 */
export const ADMIN_SECTION_CATEGORY_DESCRIPTIONS: Record<
  AdminPolicySectionContract["category"],
  { label: string; description: string }
> = {
  approval: {
    label: "승인 정책",
    description: "구매/견적 승인 단계와 조건 설정",
  },
  budget: {
    label: "예산 통제",
    description: "팀/프로젝트별 예산 한도와 초과 정책",
  },
  notification: {
    label: "알림 규칙",
    description: "운영 이벤트별 알림 조건과 수신자",
  },
  security: {
    label: "보안/접근 제어",
    description: "권한, MFA, 다운로드, export 정책",
  },
  document: {
    label: "문서 정책",
    description: "COA/MSDS 필수 여부, 문서 요건",
  },
  inventory: {
    label: "재고 정책",
    description: "lot/expiry 필수, 격리 해제 조건",
  },
  vendor: {
    label: "공급사 정책",
    description: "공급사 승인, 대체, 위험 연계 규칙",
  },
  workspace: {
    label: "워크스페이스 운영",
    description: "통화, 세금, 번호 체계, 위치 규칙",
  },
};

/** 잠금 유형별 한국어 설명 */
export const LOCK_TYPE_DESCRIPTIONS: Record<
  AdminPolicyLockRuleContract["lockType"],
  { label: string; description: string }
> = {
  plan: {
    label: "플랜 제한",
    description: "현재 플랜에서 사용할 수 없는 기능",
  },
  role: {
    label: "권한 제한",
    description: "현재 역할로 수정할 수 없는 설정",
  },
  inherited: {
    label: "상위 정책 상속",
    description: "상위 워크스페이스에서 상속된 설정",
  },
  compliance: {
    label: "규정 잠금",
    description: "규정 준수를 위해 변경이 제한된 설정",
  },
  temporary_freeze: {
    label: "임시 동결",
    description: "관리자에 의해 임시 변경 금지 상태",
  },
};

/** 설정 페이지 빈 상태 문구 */
export const SETTINGS_EMPTY_COPY = {
  title: "설정할 운영 정책이 없습니다",
  body: "워크스페이스 설정을 시작하면 구매/재고/승인 흐름에 자동 적용됩니다",
  actionLabel: "설정 시작하기",
  actionHref: "/dashboard/settings/workspace",
} as const;

/** 설정 페이지 에러 상태 문구 */
export const SETTINGS_ERROR_COPY = {
  title: "설정 정보를 불러오지 못했습니다",
  body: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
} as const;

/** 설정 페이지 접근 불가 문구 */
export const SETTINGS_UNAVAILABLE_COPY = {
  title: "현재 권한으로 설정에 접근할 수 없습니다",
  body: "관리자 또는 소유자 권한이 필요합니다",
  actionLabel: "권한 요청하기",
  actionHref: "/dashboard/support",
} as const;

/** 설정 관련 안티패턴 목록 — 코드 리뷰 시 경고 기준 */
export const SETTINGS_ANTI_PATTERNS: string[] = [
  "draft 없이 설정값을 즉시 mutate하는 구조",
  "isEditable: boolean 하나로만 편집 통제",
  "inherited/override/locked/restricted를 구분 못하는 구조",
  "impact assessment 없이 publish되는 구조",
  "approval-required change를 표현하지 못하는 구조",
  "audit trail 없이 publish만 되는 구조",
  "section 상태와 field 상태를 혼합하는 구조",
  "downstream module 영향을 계산하지 못하는 구조",
];

/** 설정 코드 리뷰 체크리스트 — PR 검토 기준 */
export const settingsCodeReviewChecklist: string[] = [
  "settings가 운영 정책 제어 계약으로 표현되는가",
  "surface/section/field/draft/publish/audit 구조가 분리되어 있는가",
  "inherited/overridden/locked/plan-restricted 상태를 구분할 수 있는가",
  "save/review/publish/rollback readiness를 계산할 수 있는가",
  "approval-required change와 sensitive change를 표현할 수 있는가",
  "downstream impact가 quote/po/receiving/reorder/inventory에 연결되는가",
  "field dependency와 validation issue가 blocking/non-blocking으로 분리되는가",
  "locked section이 있어도 나머지 surface 저장이 가능한가",
  "draft 없이 직접 설정 변경이 불가능한 구조인가",
  "rollback reference가 유지되는가",
];
