/**
 * Workspace / Organization 컨텍스트 전환 중앙 계약
 *
 * 핵심 원칙: 워크스페이스 전환은 단순 네비게이션이 아니라,
 * 운영 컨텍스트 전환이다.
 * 현재 컨텍스트는 항상 가시적이어야 하고,
 * 상태 보존/초기화는 예측 가능해야 하며,
 * 권한·데이터·정책은 워크스페이스 범위로 한정된다.
 */

// ---------------------------------------------------------------------------
// 1. 페이지 섹션 순서
// ---------------------------------------------------------------------------

/** 워크스페이스 전환 UI의 필수 섹션 순서 */
export const WORKSPACE_SWITCH_SECTIONS = [
  "currentContextDisplay",
  "workspaceSwitcher",
  "accessRoleSummary",
  "contextNavigation",
  "statePreservationRules",
  "crossContextGuardrails",
  "auditRecovery",
] as const;

export type WorkspaceSwitchSection =
  (typeof WORKSPACE_SWITCH_SECTIONS)[number];

// ---------------------------------------------------------------------------
// 2. 컨텍스트 레벨
// ---------------------------------------------------------------------------

/** 계층적 컨텍스트 수준 */
export type ContextLevel = "organization" | "workspace" | "team" | "project";

// ---------------------------------------------------------------------------
// 3. 워크스페이스 컨텍스트
// ---------------------------------------------------------------------------

/** 현재 활성 워크스페이스의 전체 컨텍스트 */
export interface WorkspaceContext {
  organizationId: string;
  organizationName: string;
  workspaceId: string;
  workspaceName: string;
  teamId?: string;
  teamName?: string;
  projectId?: string;
  projectName?: string;
  /** 현재 역할 (e.g. "ADMIN", "APPROVER", "REQUESTER", "VIEWER") */
  currentRole: string;
  /** 부여된 권한 목록 */
  permissions: string[];
  /** 활성 정책 목록 (e.g. ["budget_control", "approval_required", "document_mandatory"]) */
  activePolicies: string[];
}

// ---------------------------------------------------------------------------
// 4. 컨텍스트 표시 계약
// ---------------------------------------------------------------------------

/** 현재 컨텍스트를 UI에 어떻게 표시해야 하는지 규정 */
export const ContextDisplayContract = {
  /** 반드시 표시해야 하는 필드 */
  mustShow: [
    { field: "organizationName" as const, label: "조직명" },
    { field: "workspaceName" as const, label: "워크스페이스명" },
    { field: "currentRole" as const, label: "현재 역할" },
  ],
  /** 가능하면 표시해야 하는 필드 */
  shouldShow: [
    { field: "teamName" as const, label: "소속 팀" },
    { field: "activePolicies" as const, label: "적용 정책" },
  ],
  /** 항상 헤더에 고정 노출 */
  placement: "header_persistent" as const,
  /** 컨텍스트 확인 불가 시 경고 메시지 */
  missingContextWarning:
    "현재 워크스페이스를 확인할 수 없습니다. 다시 선택해주세요.",
} as const;

// ---------------------------------------------------------------------------
// 5. 전환 트리거
// ---------------------------------------------------------------------------

/** 워크스페이스 전환을 유발하는 트리거 유형 */
export type SwitchTrigger =
  | "user_manual"
  | "deep_link_restore"
  | "recent_context"
  | "favorite"
  | "invitation_accept"
  | "admin_redirect";

// ---------------------------------------------------------------------------
// 6. 전환 액션
// ---------------------------------------------------------------------------

/** 워크스페이스 전환 요청 */
export interface SwitchAction {
  from: { organizationId: string; workspaceId: string };
  to: { organizationId: string; workspaceId: string };
  trigger: SwitchTrigger;
  /** 확인 대화상자 필요 여부 */
  requiresConfirmation: boolean;
  /** 확인 메시지 (Korean) */
  confirmationMessage?: string;
}

// ---------------------------------------------------------------------------
// 7. 상태 보존 카테고리
// ---------------------------------------------------------------------------

/** 전환 시 상태 보존 방식 */
export type StatePreservationCategory = "preserve" | "reset" | "conditional";

// ---------------------------------------------------------------------------
// 8. 상태 보존 규칙
// ---------------------------------------------------------------------------

/** 워크스페이스 전환 시 각 상태의 보존/초기화 규칙 */
export const STATE_PRESERVATION_RULES = [
  {
    stateKey: "globalTheme",
    label: "테마 설정",
    category: "preserve" as StatePreservationCategory,
    reason: "사용자 개인 설정은 워크스페이스와 무관",
  },
  {
    stateKey: "userPreferences",
    label: "개인 환경 설정",
    category: "preserve" as StatePreservationCategory,
    reason: "언어, 알림 설정 등은 유지",
  },
  {
    stateKey: "sidebarCollapsed",
    label: "사이드바 상태",
    category: "preserve" as StatePreservationCategory,
    reason: "UI 레이아웃 선호는 유지",
  },
  {
    stateKey: "searchQuery",
    label: "검색어",
    category: "reset" as StatePreservationCategory,
    reason: "워크스페이스 데이터 범위가 달라짐",
  },
  {
    stateKey: "activeFilters",
    label: "적용된 필터",
    category: "reset" as StatePreservationCategory,
    reason: "필터 기준이 워크스페이스마다 다를 수 있음",
  },
  {
    stateKey: "selectedItems",
    label: "선택된 항목",
    category: "reset" as StatePreservationCategory,
    reason: "다른 워크스페이스 항목과 혼합 방지",
  },
  {
    stateKey: "compareBasket",
    label: "비교 대상",
    category: "reset" as StatePreservationCategory,
    reason: "워크스페이스 간 비교 무의미",
  },
  {
    stateKey: "quoteDraft",
    label: "견적 초안",
    category: "conditional" as StatePreservationCategory,
    reason: "같은 조직 내 전환이면 유지, 조직 간 전환이면 초기화",
  },
  {
    stateKey: "dashboardState",
    label: "대시보드 상태",
    category: "reset" as StatePreservationCategory,
    reason: "KPI/queue가 워크스페이스 종속",
  },
  {
    stateKey: "notificationRead",
    label: "알림 읽음 상태",
    category: "preserve" as StatePreservationCategory,
    reason: "읽음 표시는 사용자 단위",
  },
  {
    stateKey: "recentActivity",
    label: "최근 활동",
    category: "reset" as StatePreservationCategory,
    reason: "활동 기록이 워크스페이스 종속",
  },
  {
    stateKey: "approvalContext",
    label: "승인 맥락",
    category: "reset" as StatePreservationCategory,
    reason: "승인 정책이 워크스페이스별로 다름",
  },
] as const;

// ---------------------------------------------------------------------------
// 9. 교차 컨텍스트 가드레일
// ---------------------------------------------------------------------------

/** 잘못된 컨텍스트에서의 위험한 작업을 방지하는 가드레일 */
export const CROSS_CONTEXT_GUARDRAILS = [
  {
    guardId: "wrong_context_purchase",
    description: "다른 워크스페이스의 예산으로 구매 요청 방지",
    action: "구매 요청 차단",
    severity: "block" as const,
  },
  {
    guardId: "wrong_context_approval",
    description: "권한 없는 워크스페이스에서 승인 시도 방지",
    action: "승인 차단 + 올바른 워크스페이스 안내",
    severity: "block" as const,
  },
  {
    guardId: "cross_org_data_mix",
    description: "다른 조직의 데이터가 현재 화면에 혼입 방지",
    action: "데이터 필터링",
    severity: "block" as const,
  },
  {
    guardId: "context_mismatch_warning",
    description: "deep link가 현재 컨텍스트와 다를 때 안내",
    action: "컨텍스트 전환 확인 대화상자",
    severity: "confirm" as const,
  },
  {
    guardId: "destructive_action_recheck",
    description: "삭제/취소 등 파괴적 작업 전 컨텍스트 재확인",
    action: "현재 워크스페이스 표시 후 재확인",
    severity: "confirm" as const,
  },
  {
    guardId: "stale_context_warning",
    description: "오래된 세션에서 컨텍스트 변경 감지",
    action: "새로고침 권장",
    severity: "warn" as const,
  },
] as const;

// ---------------------------------------------------------------------------
// 10. 전환 확인 대화상자
// ---------------------------------------------------------------------------

/** 워크스페이스 전환 확인 대화상자에 필요한 정보 */
export interface ContextSwitchConfirmation {
  /** 이전 워크스페이스 표시명 */
  fromLabel: string;
  /** 대상 워크스페이스 표시명 */
  toLabel: string;
  /** 전환 시 상태 변경 목록 */
  stateChanges: { label: string; willReset: boolean }[];
  /** 역할 변경 경고 (e.g. "새 워크스페이스에서는 VIEWER 권한만 있습니다") */
  roleChangeWarning?: string;
  /** 정책 차이 목록 */
  policyDifferences?: string[];
  /** 확인 버튼 레이블 */
  confirmLabel: string;
  /** 취소 버튼 레이블 */
  cancelLabel: string;
}

// ---------------------------------------------------------------------------
// 11. Deep Link 복원 계약
// ---------------------------------------------------------------------------

/** Deep link 진입 시 올바른 워크스페이스 복원 규칙 */
export const DeepLinkRestoreContract = {
  /** 워크스페이스 결정 우선순위 */
  priority: [
    "url_workspace_param",
    "last_active_workspace",
    "default_workspace",
  ] as const,
  /** 컨텍스트 불일치 시 동작 */
  mismatchAction: "show_confirmation" as const,
  /** 불일치 시 확인 메시지 */
  mismatchMessage:
    "이 링크는 다른 워크스페이스의 항목입니다. 전환하시겠습니까?",
  /** 워크스페이스 미발견 시 대체 메시지 */
  fallbackMessage:
    "워크스페이스를 찾을 수 없습니다. 기본 워크스페이스로 이동합니다.",
} as const;

// ---------------------------------------------------------------------------
// 12. 최근 컨텍스트 항목
// ---------------------------------------------------------------------------

/** 최근 접근한 워크스페이스 기록 */
export interface RecentContextEntry {
  organizationId: string;
  workspaceId: string;
  organizationName: string;
  workspaceName: string;
  role: string;
  lastAccessedAt: string;
  isFavorite: boolean;
}

// ---------------------------------------------------------------------------
// 13. 상태별 안내 문구
// ---------------------------------------------------------------------------

/** 소속 워크스페이스가 없을 때 안내 */
export const WORKSPACE_SWITCH_EMPTY_COPY = {
  title: "소속된 워크스페이스가 없습니다",
  description: "조직 관리자에게 워크스페이스 초대를 요청하세요",
  actionLabel: "초대 요청하기",
} as const;

/** 워크스페이스 정보 로드 실패 시 안내 */
export const WORKSPACE_SWITCH_ERROR_COPY = {
  title: "워크스페이스 정보를 불러오지 못했습니다",
  description: "잠시 후 다시 시도해주세요",
  actionLabel: "다시 시도",
} as const;

/** 접근 불가 워크스페이스 안내 */
export const WORKSPACE_SWITCH_UNAVAILABLE_COPY = {
  title: "이 워크스페이스에 접근할 수 없습니다",
  description:
    "권한이 변경되었거나 워크스페이스가 비활성화되었을 수 있습니다",
  actionLabel: "관리자에게 문의",
} as const;

// ---------------------------------------------------------------------------
// 14. 안티패턴 목록
// ---------------------------------------------------------------------------

/** 워크스페이스 전환 관련 안티패턴 — 코드 리뷰 시 반드시 회피 */
export const WORKSPACE_ANTI_PATTERNS: string[] = [
  "현재 어떤 워크스페이스에서 작업 중인지 불명확",
  "전환 시 어떤 상태가 유지/초기화되는지 예측 불가",
  "워크스페이스별 권한 차이가 UI에 반영되지 않음",
  "잘못된 컨텍스트에서 구매/승인이 실행됨",
  "deep link 진입 시 올바른 워크스페이스 복원 실패",
  "조직 수준 설정과 워크스페이스 수준 설정이 혼재",
  "멀티 워크스페이스 사용자의 전환 비용이 과도함",
  "cross-workspace 데이터 혼합이 발생",
];

// ---------------------------------------------------------------------------
// 15. 코드 리뷰 체크리스트
// ---------------------------------------------------------------------------

/** 워크스페이스 전환 구현 코드 리뷰 체크리스트 */
export const workspaceSwitchCodeReviewChecklist: string[] = [
  "현재 워크스페이스가 헤더에 항상 표시되는가",
  "전환 시 state preservation 규칙이 적용되는가",
  "권한/역할 변경이 전환 즉시 반영되는가",
  "cross-context guardrail이 구매/승인/삭제에 적용되는가",
  "deep link 진입 시 올바른 context 복원/확인이 되는가",
  "전환 확인 대화상자에 역할/정책 변경이 표시되는가",
  "최근/즐겨찾기 워크스페이스 목록이 제공되는가",
  "조직 간 전환과 워크스페이스 간 전환이 구분되는가",
  "세션 만료/stale context 감지가 되는가",
  "감사 로그에 컨텍스트 전환이 기록되는가",
];
