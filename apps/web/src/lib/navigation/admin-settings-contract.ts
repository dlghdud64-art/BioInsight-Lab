/**
 * Admin / Settings 운영 허브 계약
 *
 * Settings = 옵션 저장소가 아니라 운영 기준점
 * Admin = 멤버/권한/정책/연동/보안 통합 관리 허브
 * 현재 상태 + 누락/위험 설정이 먼저 보여야 함
 */

// ═══════════════════════════════════════════════════
// Section Status
// ═══════════════════════════════════════════════════

export type SectionStatus =
  | "configured"       // 정상 설정 완료
  | "incomplete"       // 필수 설정 미완료
  | "error"           // 설정 오류
  | "review_needed"   // 검토 필요
  | "not_applicable"; // 현재 플랜 미해당

export interface SectionStatusInfo {
  status: SectionStatus;
  label: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

const STATUS_LABELS: Record<SectionStatus, string> = {
  configured: "설정 완료",
  incomplete: "설정 필요",
  error: "설정 오류",
  review_needed: "검토 필요",
  not_applicable: "플랜 미해당",
};

export function getSectionStatusLabel(status: SectionStatus): string {
  return STATUS_LABELS[status];
}

// ═══════════════════════════════════════════════════
// Admin Section Definitions
// ═══════════════════════════════════════════════════

export type AdminSectionKey =
  | "organization"
  | "members"
  | "roles_permissions"
  | "approval_policy"
  | "integrations"
  | "security"
  | "notifications"
  | "plan_billing"
  | "audit_history";

export interface AdminSectionDefinition {
  key: AdminSectionKey;
  title: string;
  description: string;
  href: string;
  priority: number; // 낮을수록 중요
}

export const ADMIN_SECTIONS: AdminSectionDefinition[] = [
  { key: "organization", title: "조직 정보", description: "조직명, 설명, 기본 설정", href: "/dashboard/settings#organization", priority: 1 },
  { key: "members", title: "멤버 및 접근", description: "멤버 초대, 역할 배정, 접근 제어", href: "/dashboard/settings#members", priority: 2 },
  { key: "roles_permissions", title: "역할 및 권한", description: "역할 정의, 권한 매핑, 승인 범위", href: "/dashboard/settings#roles", priority: 3 },
  { key: "approval_policy", title: "승인 정책", description: "승인 라우팅, 자동 승인 조건, 에스컬레이션", href: "/dashboard/settings#approval", priority: 4 },
  { key: "integrations", title: "연동 설정", description: "ERP, SSO, 이메일, 외부 시스템 연결", href: "/dashboard/settings/enterprise#integrations", priority: 5 },
  { key: "security", title: "보안", description: "2FA, 세션 정책, IP 제한, 감사 설정", href: "/dashboard/settings/enterprise#security", priority: 6 },
  { key: "notifications", title: "알림 정책", description: "알림 채널, 전달 방식, 일일 요약", href: "/dashboard/settings#notifications", priority: 7 },
  { key: "plan_billing", title: "플랜 및 결제", description: "구독 상태, 좌석, 결제 정보", href: "/dashboard/settings/plans", priority: 8 },
  { key: "audit_history", title: "감사 이력", description: "설정 변경 로그, 멤버 활동 기록", href: "/dashboard/audit", priority: 9 },
];

// ═══════════════════════════════════════════════════
// Setup / Risk Summary
// ═══════════════════════════════════════════════════

export interface SetupRiskSummary {
  totalSections: number;
  configured: number;
  incomplete: number;
  error: number;
  reviewNeeded: number;
  completionPercent: number;
  priorityActions: PriorityAdminAction[];
}

export interface PriorityAdminAction {
  id: string;
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  href: string;
  ctaLabel: string;
}

/** Setup/Risk Summary 계산 */
export function computeSetupRiskSummary(
  sectionStatuses: Map<AdminSectionKey, SectionStatus>,
): SetupRiskSummary {
  const total = sectionStatuses.size;
  let configured = 0;
  let incomplete = 0;
  let error = 0;
  let reviewNeeded = 0;
  const actions: PriorityAdminAction[] = [];

  sectionStatuses.forEach((status, key) => {
    const section = ADMIN_SECTIONS.find((s) => s.key === key);
    if (!section) return;

    switch (status) {
      case "configured":
        configured++;
        break;
      case "incomplete":
        incomplete++;
        actions.push({
          id: `setup-${key}`,
          title: `${section.title} 설정 필요`,
          description: section.description,
          severity: section.priority <= 4 ? "high" : "medium",
          href: section.href,
          ctaLabel: `${section.title} 설정하기`,
        });
        break;
      case "error":
        error++;
        actions.push({
          id: `error-${key}`,
          title: `${section.title} 설정 오류`,
          description: "설정을 확인하고 수정해주세요",
          severity: "high",
          href: section.href,
          ctaLabel: `오류 확인하기`,
        });
        break;
      case "review_needed":
        reviewNeeded++;
        actions.push({
          id: `review-${key}`,
          title: `${section.title} 검토 필요`,
          description: "최근 변경 사항을 확인해주세요",
          severity: "medium",
          href: section.href,
          ctaLabel: `검토하기`,
        });
        break;
    }
  });

  // priority 기준 정렬
  actions.sort((a, b) => {
    const severityOrder = { high: 0, medium: 1, low: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  return {
    totalSections: total,
    configured,
    incomplete,
    error,
    reviewNeeded,
    completionPercent: total > 0 ? Math.round((configured / total) * 100) : 0,
    priorityActions: actions.slice(0, 5), // 최대 5개
  };
}

// ═══════════════════════════════════════════════════
// High-Impact Setting Guard
// ═══════════════════════════════════════════════════

export type SettingImpactLevel = "low" | "medium" | "high" | "critical";

export interface SettingGuardInfo {
  impactLevel: SettingImpactLevel;
  requiresConfirm: boolean;
  impactDescription: string;
  affectedAreas: string[];
}

const HIGH_IMPACT_SETTINGS: Record<string, SettingGuardInfo> = {
  "owner_transfer": {
    impactLevel: "critical",
    requiresConfirm: true,
    impactDescription: "조직 소유권이 이전됩니다. 이 작업은 되돌릴 수 없습니다.",
    affectedAreas: ["모든 멤버 권한", "결제 정보", "조직 설정"],
  },
  "role_change": {
    impactLevel: "high",
    requiresConfirm: true,
    impactDescription: "멤버의 접근 권한이 변경됩니다.",
    affectedAreas: ["접근 가능 화면", "승인 범위", "데이터 열람"],
  },
  "approval_policy_change": {
    impactLevel: "high",
    requiresConfirm: true,
    impactDescription: "승인 정책이 변경되면 진행 중인 요청에도 영향을 줄 수 있습니다.",
    affectedAreas: ["승인 대기 요청", "자동 승인 조건", "에스컬레이션 규칙"],
  },
  "integration_disconnect": {
    impactLevel: "high",
    requiresConfirm: true,
    impactDescription: "연동을 해제하면 동기화가 중단됩니다.",
    affectedAreas: ["데이터 동기화", "자동 알림", "외부 시스템 연결"],
  },
  "plan_downgrade": {
    impactLevel: "high",
    requiresConfirm: true,
    impactDescription: "플랜을 낮추면 일부 기능 접근이 제한될 수 있습니다.",
    affectedAreas: ["사용 가능 기능", "좌석 수", "저장 용량"],
  },
  "member_remove": {
    impactLevel: "medium",
    requiresConfirm: true,
    impactDescription: "멤버를 제거하면 해당 사용자의 접근이 즉시 차단됩니다.",
    affectedAreas: ["접근 권한", "담당 업무", "진행 중 요청"],
  },
  "notification_change": {
    impactLevel: "low",
    requiresConfirm: false,
    impactDescription: "알림 설정이 변경됩니다.",
    affectedAreas: ["알림 수신 채널", "전달 빈도"],
  },
};

/** 설정 변경의 영향도 조회 */
export function getSettingGuard(settingKey: string): SettingGuardInfo | null {
  return HIGH_IMPACT_SETTINGS[settingKey] ?? null;
}

/** confirm이 필요한지 판정 */
export function requiresSettingConfirm(settingKey: string): boolean {
  return HIGH_IMPACT_SETTINGS[settingKey]?.requiresConfirm ?? false;
}

// ═══════════════════════════════════════════════════
// Settings Navigation ViewModel
// ═══════════════════════════════════════════════════

export interface SettingsNavItemViewModel {
  key: AdminSectionKey;
  title: string;
  href: string;
  status: SectionStatus;
  statusLabel: string;
  isActive: boolean;
}

/** Settings navigation items 생성 */
export function buildSettingsNavItems(
  sectionStatuses: Map<AdminSectionKey, SectionStatus>,
  activeKey: AdminSectionKey | null,
): SettingsNavItemViewModel[] {
  return ADMIN_SECTIONS.map((section) => {
    const status = sectionStatuses.get(section.key) ?? "not_applicable";
    return {
      key: section.key,
      title: section.title,
      href: section.href,
      status,
      statusLabel: getSectionStatusLabel(status),
      isActive: section.key === activeKey,
    };
  });
}
