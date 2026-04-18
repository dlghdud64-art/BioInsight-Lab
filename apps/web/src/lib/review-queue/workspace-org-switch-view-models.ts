/**
 * Workspace / Organization 컨텍스트 전환 ViewModel
 *
 * UI 컴포넌트가 소비하는 뷰모델 타입과 헬퍼 함수를 정의한다.
 * 모든 사용자 노출 문구는 한국어.
 */

import type {
  WorkspaceContext,
  StatePreservationCategory,
} from "./workspace-org-switch-contract";
import { STATE_PRESERVATION_RULES } from "./workspace-org-switch-contract";

// ---------------------------------------------------------------------------
// 1. 현재 컨텍스트 ViewModel
// ---------------------------------------------------------------------------

/** 헤더에 고정 표시되는 현재 컨텍스트 요약 */
export interface CurrentContextViewModel {
  organizationName: string;
  workspaceName: string;
  /** 역할 표시명 (e.g. "관리자") */
  roleLabel: string;
  /** 역할에 따른 시각적 톤 */
  roleTone: "admin" | "approver" | "requester" | "viewer";
  /** 적용 중인 정책 표시명 목록 */
  activePolicyLabels: string[];
  /** 통합 표시 레이블 (e.g. "연구소팀 · 관리자") */
  displayLabel: string;
}

// ---------------------------------------------------------------------------
// 2. 워크스페이스 목록 항목 ViewModel
// ---------------------------------------------------------------------------

/** 워크스페이스 선택 목록의 개별 항목 */
export interface WorkspaceListItemViewModel {
  organizationId: string;
  workspaceId: string;
  organizationName: string;
  workspaceName: string;
  /** 역할 표시명 (e.g. "승인자") */
  roleLabel: string;
  /** 현재 선택된 워크스페이스 여부 */
  isCurrent: boolean;
  /** 즐겨찾기 여부 */
  isFavorite: boolean;
  /** 마지막 접근 시간 표시 (e.g. "2시간 전") */
  lastAccessedLabel?: string;
  /** 멤버 수 표시 (e.g. "12명") */
  memberCountLabel?: string;
  /** 미읽은 알림 존재 여부 */
  hasUnreadNotifications: boolean;
}

// ---------------------------------------------------------------------------
// 3. 워크스페이스 전환기 ViewModel
// ---------------------------------------------------------------------------

/** 워크스페이스 전환 드롭다운/패널의 전체 상태 */
export interface WorkspaceSwitcherViewModel {
  /** 현재 활성 컨텍스트 */
  currentContext: CurrentContextViewModel;
  /** 최근 접근한 워크스페이스 목록 */
  recentWorkspaces: WorkspaceListItemViewModel[];
  /** 즐겨찾기 워크스페이스 목록 */
  favoriteWorkspaces: WorkspaceListItemViewModel[];
  /** 전체 워크스페이스 목록 (조직별 그룹) */
  allWorkspaces: WorkspaceListItemViewModel[];
  /** 소속 조직 목록 */
  organizations: { id: string; name: string; workspaceCount: number }[];
  /** 소속 워크스페이스가 하나도 없는 상태 */
  isEmpty: boolean;
  /** 로딩 중 여부 */
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// 4. 전환 확인 대화상자 ViewModel
// ---------------------------------------------------------------------------

/** 워크스페이스 전환 확인 대화상자 데이터 */
export interface SwitchConfirmationViewModel {
  /** 현재(출발) 컨텍스트 */
  fromContext: CurrentContextViewModel;
  /** 대상(도착) 컨텍스트 요약 */
  toContext: {
    organizationName: string;
    workspaceName: string;
    roleLabel: string;
  };
  /** 초기화될 상태 목록 */
  stateResets: { label: string; description: string }[];
  /** 역할 변경 경고 (e.g. "새 워크스페이스에서는 VIEWER 권한만 있습니다") */
  roleChangeWarning?: string;
  /** 정책 변경 목록 */
  policyChanges?: {
    label: string;
    changeType: "added" | "removed" | "changed";
  }[];
  /** 조직 간 전환 여부 (워크스페이스 간 전환보다 영향 범위 큼) */
  isOrganizationSwitch: boolean;
  /** 확인 버튼 레이블 */
  confirmLabel: string;
  /** 취소 버튼 레이블 */
  cancelLabel: string;
}

// ---------------------------------------------------------------------------
// 5. Deep Link 컨텍스트 ViewModel
// ---------------------------------------------------------------------------

/** Deep link 진입 시 컨텍스트 불일치 안내 */
export interface DeepLinkContextViewModel {
  /** 링크가 가리키는 워크스페이스명 */
  targetWorkspaceName: string;
  /** 현재 활성 워크스페이스명 */
  currentWorkspaceName: string;
  /** 불일치 여부 */
  isMismatch: boolean;
  /** 불일치 안내 메시지 */
  mismatchMessage: string;
  /** 전환 버튼 레이블 */
  switchLabel: string;
  /** 유지 버튼 레이블 */
  stayLabel: string;
}

// ---------------------------------------------------------------------------
// 6. 헬퍼: 상태 보존 분류
// ---------------------------------------------------------------------------

/**
 * 워크스페이스 전환 시 각 상태의 보존/초기화 여부를 결정한다.
 *
 * conditional 카테고리는 같은 조직 내 전환이면 preserve,
 * 다른 조직 간 전환이면 reset으로 해석된다.
 */
export function resolveStatePreservation(
  fromContext: WorkspaceContext,
  toContext: WorkspaceContext,
): {
  preserved: string[];
  reset: string[];
  conditional: { key: string; willReset: boolean; reason: string }[];
} {
  const isSameOrg = fromContext.organizationId === toContext.organizationId;

  const preserved: string[] = [];
  const reset: string[] = [];
  const conditional: { key: string; willReset: boolean; reason: string }[] = [];

  for (const rule of STATE_PRESERVATION_RULES) {
    switch (rule.category) {
      case "preserve":
        preserved.push(rule.stateKey);
        break;
      case "reset":
        reset.push(rule.stateKey);
        break;
      case "conditional":
        conditional.push({
          key: rule.stateKey,
          willReset: !isSameOrg,
          reason: isSameOrg
            ? "같은 조직 내 전환이므로 유지"
            : "조직 간 전환이므로 초기화",
        });
        break;
    }
  }

  return { preserved, reset, conditional };
}

// ---------------------------------------------------------------------------
// 7. 헬퍼: 전환 확인 대화상자 빌더
// ---------------------------------------------------------------------------

/** 역할 코드를 한국어 표시명으로 변환 */
function toRoleLabel(role: string): string {
  const map: Record<string, string> = {
    ADMIN: "관리자",
    APPROVER: "승인자",
    REQUESTER: "요청자",
    VIEWER: "열람자",
    OWNER: "소유자",
  };
  return map[role] ?? role;
}

/** 역할 코드를 톤으로 변환 */
function toRoleTone(
  role: string,
): "admin" | "approver" | "requester" | "viewer" {
  const map: Record<string, "admin" | "approver" | "requester" | "viewer"> = {
    ADMIN: "admin",
    OWNER: "admin",
    APPROVER: "approver",
    REQUESTER: "requester",
    VIEWER: "viewer",
  };
  return map[role] ?? "viewer";
}

/** 정책 코드를 한국어 레이블로 변환 */
function toPolicyLabel(policy: string): string {
  const map: Record<string, string> = {
    budget_control: "예산 통제",
    approval_required: "승인 필수",
    document_mandatory: "문서 첨부 필수",
  };
  return map[policy] ?? policy;
}

/**
 * 전환 확인 대화상자에 필요한 전체 데이터를 구성한다.
 *
 * 역할 변경, 정책 차이, 상태 초기화 목록을 포함한다.
 */
export function buildSwitchConfirmation(
  from: WorkspaceContext,
  to: WorkspaceContext,
): SwitchConfirmationViewModel {
  const isOrgSwitch = from.organizationId !== to.organizationId;
  const stateResult = resolveStatePreservation(from, to);

  // 초기화될 상태 목록 구성
  const stateResets: { label: string; description: string }[] = [];
  for (const rule of STATE_PRESERVATION_RULES) {
    if (rule.category === "reset") {
      stateResets.push({ label: rule.label, description: rule.reason });
    }
  }
  for (const c of stateResult.conditional) {
    if (c.willReset) {
      const rule = STATE_PRESERVATION_RULES.find((r) => r.stateKey === c.key);
      if (rule) {
        stateResets.push({ label: rule.label, description: c.reason });
      }
    }
  }

  // 역할 변경 경고
  let roleChangeWarning: string | undefined;
  if (from.currentRole !== to.currentRole) {
    roleChangeWarning = `새 워크스페이스에서는 ${toRoleLabel(to.currentRole)} 권한만 있습니다`;
  }

  // 정책 차이
  const fromPolicies = new Set(from.activePolicies);
  const toPolicies = new Set(to.activePolicies);
  const policyChanges: {
    label: string;
    changeType: "added" | "removed" | "changed";
  }[] = [];

  for (const p of to.activePolicies) {
    if (!fromPolicies.has(p)) {
      policyChanges.push({ label: toPolicyLabel(p), changeType: "added" });
    }
  }
  for (const p of from.activePolicies) {
    if (!toPolicies.has(p)) {
      policyChanges.push({ label: toPolicyLabel(p), changeType: "removed" });
    }
  }

  const fromRoleLabel = toRoleLabel(from.currentRole);
  const toRoleLabel_ = toRoleLabel(to.currentRole);

  return {
    fromContext: {
      organizationName: from.organizationName,
      workspaceName: from.workspaceName,
      roleLabel: fromRoleLabel,
      roleTone: toRoleTone(from.currentRole),
      activePolicyLabels: from.activePolicies.map(toPolicyLabel),
      displayLabel: `${from.workspaceName} · ${fromRoleLabel}`,
    },
    toContext: {
      organizationName: to.organizationName,
      workspaceName: to.workspaceName,
      roleLabel: toRoleLabel_,
    },
    stateResets,
    roleChangeWarning,
    policyChanges: policyChanges.length > 0 ? policyChanges : undefined,
    isOrganizationSwitch: isOrgSwitch,
    confirmLabel: isOrgSwitch ? "조직 전환" : "워크스페이스 전환",
    cancelLabel: "취소",
  };
}

// ---------------------------------------------------------------------------
// 8. 헬퍼: 컨텍스트 불일치 감지
// ---------------------------------------------------------------------------

/**
 * URL에 포함된 워크스페이스 ID와 현재 활성 워크스페이스를 비교하여
 * 불일치 여부와 권장 동작을 결정한다.
 *
 * - URL에 워크스페이스 지정이 없으면 현재 유지 (stay)
 * - URL 워크스페이스와 현재가 같으면 유지 (stay)
 * - 다르면 사용자에게 전환 여부 확인 (ask)
 */
export function detectContextMismatch(
  urlWorkspaceId: string | null,
  currentWorkspaceId: string,
): { isMismatch: boolean; action: "switch" | "stay" | "ask" } {
  if (urlWorkspaceId === null) {
    return { isMismatch: false, action: "stay" };
  }

  if (urlWorkspaceId === currentWorkspaceId) {
    return { isMismatch: false, action: "stay" };
  }

  return { isMismatch: true, action: "ask" };
}
