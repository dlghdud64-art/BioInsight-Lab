/**
 * Organization Overview Hub — View Models + Dummy Fixtures
 *
 * Page container가 domain objects를 가공하여 block components에 전달하는 view model.
 * 각 블록은 자기 책임 데이터만 받는다.
 */

// ═══════════════════════════════════════════════════
// Organization Header
// ═══════════════════════════════════════════════════

export interface OverviewOrganizationHeader {
  id: string;
  name: string;
  plan: "starter" | "team" | "business" | "enterprise";
  memberCount: number;
  createdAt: string;
}

// ═══════════════════════════════════════════════════
// KPI Card View Model
// ═══════════════════════════════════════════════════

export type KpiTone = "green" | "amber" | "red" | "blue" | "slate";

export interface OverviewKpiCardViewModel {
  key: string;
  title: string;
  value: number;
  description: string;
  statusLabel: string;
  tone: KpiTone;
  linkHref: string | null;
}

// ═══════════════════════════════════════════════════
// Step Funnel View Model
// ═══════════════════════════════════════════════════

export interface StepFunnelStageViewModel {
  key: "step1" | "step2" | "step3";
  title: string;
  count: number;
  description: string;
  subStatus: string;
  linkHref: string;
  ctaLabel: string;
}

export interface StepFunnelViewModel {
  stages: StepFunnelStageViewModel[];
}

// ═══════════════════════════════════════════════════
// Alerts Block View Model
// ═══════════════════════════════════════════════════

export type AlertSeverity = "urgent" | "warning" | "info";

export interface AlertItemViewModel {
  id: string;
  severity: AlertSeverity;
  severityLabel: string;
  title: string;
  description: string;
  count: number;
  linkHref: string;
  ctaLabel: string;
}

export interface AlertsBlockViewModel {
  items: AlertItemViewModel[];
  isEmpty: boolean;
  emptyMessage: string;
}

// ═══════════════════════════════════════════════════
// Work Queue Block View Model
// ═══════════════════════════════════════════════════

export interface WorkQueueSectionViewModel {
  id: string;
  title: string;
  count: number;
  description: string;
  linkHref: string;
  ctaLabel: string;
  details: { label: string; count: number }[];
}

export interface WorkQueueBlockViewModel {
  sections: WorkQueueSectionViewModel[];
  isEmpty: boolean;
  emptyMessage: string;
}

// ═══════════════════════════════════════════════════
// Approval Inbox Block View Model
// ═══════════════════════════════════════════════════

export interface ApprovalDecisionViewModel {
  id: string;
  action: string;
  state: "approved" | "rejected";
  stateLabel: string;
  time: string;
}

export interface ApprovalInboxBlockViewModel {
  pendingCount: number;
  pendingDescription: string;
  myRequestsCount: number;
  myRequestsDescription: string;
  recentDecisions: ApprovalDecisionViewModel[];
  isEmpty: boolean;
  emptyMessage: string;
}

// ═══════════════════════════════════════════════════
// Activity Feed Block View Model
// ═══════════════════════════════════════════════════

export interface ActivityFeedItemViewModel {
  id: string;
  actor: string;
  action: string;
  time: string;
  timeFormatted: string;
}

export interface ActivityFeedBlockViewModel {
  items: ActivityFeedItemViewModel[];
  isEmpty: boolean;
  emptyMessage: string;
}

// ═══════════════════════════════════════════════════
// Quick Links
// ═══════════════════════════════════════════════════

export interface QuickLinkItemViewModel {
  href: string;
  label: string;
}

// ═══════════════════════════════════════════════════
// Page State
// ═══════════════════════════════════════════════════

export type ErrorBlockKey = "alerts" | "workQueue" | "approvalInbox" | "activityFeed";

export interface PageStateViewModel {
  isLoading: boolean;
  hasPartialError: boolean;
  errorBlocks: ErrorBlockKey[];
}

// ═══════════════════════════════════════════════════
// Page-Level View Model
// ═══════════════════════════════════════════════════

export interface OrganizationOverviewPageViewModel {
  organization: OverviewOrganizationHeader;
  kpis: OverviewKpiCardViewModel[];
  stepFunnel: StepFunnelViewModel;
  alerts: AlertsBlockViewModel;
  workQueue: WorkQueueBlockViewModel;
  approvalInbox: ApprovalInboxBlockViewModel;
  activityFeed: ActivityFeedBlockViewModel;
  quickLinks: QuickLinkItemViewModel[];
  pageState: PageStateViewModel;
}

// ═══════════════════════════════════════════════════
// KPI Tone Helper
// ═══════════════════════════════════════════════════

export function resolveKpiTone(key: string, value: number): KpiTone {
  if (key === "reviewNeeded") return value === 0 ? "green" : value <= 5 ? "amber" : "red";
  if (key === "compareWaiting") return value === 0 ? "green" : value <= 3 ? "blue" : "amber";
  if (key === "quoteDraftReady") return value === 0 ? "slate" : "green";
  if (key === "approvalPending") return value === 0 ? "green" : value <= 2 ? "amber" : "red";
  if (key === "budgetWarnings") return value === 0 ? "green" : "amber";
  if (key === "inventoryWarnings") return value === 0 ? "green" : "amber";
  return "slate";
}

export function resolveKpiStatusLabel(key: string, value: number): string {
  if (key === "reviewNeeded") return value === 0 ? "정상" : value <= 5 ? "확인 필요" : "우선 처리";
  if (key === "compareWaiting") return value === 0 ? "정상" : value <= 3 ? "처리 가능" : "대기 증가";
  if (key === "quoteDraftReady") return value === 0 ? "없음" : "즉시 처리 가능";
  if (key === "approvalPending") return value === 0 ? "정상" : value <= 2 ? "대기 중" : "우선 확인";
  if (key === "budgetWarnings") return value === 0 ? "정상" : "검토 필요";
  if (key === "inventoryWarnings") return value === 0 ? "정상" : "대조 필요";
  if (key === "activeMembers") return "운영 중";
  if (key === "recentActivity") return "활동 추적 중";
  return "";
}

// ═══════════════════════════════════════════════════
// Dummy Data Fixture
// ═══════════════════════════════════════════════════

export const DUMMY_OVERVIEW: OrganizationOverviewPageViewModel = {
  organization: {
    id: "org-1",
    name: "바이오사이언스 연구소",
    plan: "business",
    memberCount: 12,
    createdAt: "2025-06-15T00:00:00Z",
  },

  kpis: [
    { key: "reviewNeeded", title: "검토 필요", value: 9, description: "Step 1에서 확인이 필요한 항목입니다", statusLabel: "확인 필요", tone: "amber", linkHref: "/search" },
    { key: "compareWaiting", title: "비교 확정 대기", value: 5, description: "후보 선택이 필요한 항목입니다", statusLabel: "처리 가능", tone: "blue", linkHref: "/search" },
    { key: "quoteDraftReady", title: "견적 초안 제출 가능", value: 4, description: "Step 3에서 바로 제출할 수 있습니다", statusLabel: "즉시 처리 가능", tone: "green", linkHref: "/search" },
    { key: "approvalPending", title: "승인 대기", value: 3, description: "검토 또는 제출 승인이 필요한 요청입니다", statusLabel: "우선 확인", tone: "red", linkHref: null },
    { key: "budgetWarnings", title: "예산 확인 필요", value: 2, description: "제출 전 예산 검토가 필요한 항목입니다", statusLabel: "검토 필요", tone: "amber", linkHref: null },
    { key: "inventoryWarnings", title: "재고 중복 가능", value: 1, description: "기존 재고와 중복 구매 가능성이 있습니다", statusLabel: "대조 필요", tone: "amber", linkHref: "/dashboard/inventory" },
    { key: "activeMembers", title: "활성 멤버", value: 8, description: "최근 작업이 있는 조직 멤버 수입니다", statusLabel: "운영 중", tone: "slate", linkHref: null },
    { key: "recentActivity", title: "최근 7일 활동", value: 47, description: "검토, 비교, 제출, 승인 이벤트 기준입니다", statusLabel: "활동 추적 중", tone: "slate", linkHref: null },
  ],

  stepFunnel: {
    stages: [
      { key: "step1", title: "검토 큐", count: 24, description: "입력 해석과 항목 검토가 진행 중입니다", subStatus: "검토 필요 9 · 실패 3", linkHref: "/search", ctaLabel: "검토 큐 열기" },
      { key: "step2", title: "비교 큐", count: 9, description: "후보 선택과 비교 확정이 필요한 항목입니다", subStatus: "선택 필요 5 · 확정 4", linkHref: "/search", ctaLabel: "비교 큐 열기" },
      { key: "step3", title: "견적 초안", count: 6, description: "제출 전 수량·단위·예산을 확인할 수 있습니다", subStatus: "제출 가능 4 · 보류 2", linkHref: "/search", ctaLabel: "견적 초안 열기" },
    ],
  },

  alerts: {
    items: [
      { id: "a1", severity: "urgent", severityLabel: "긴급", title: "승인 지연", description: "3일 이상 대기 중인 승인 요청 1건", count: 1, linkHref: "#approvals", ctaLabel: "승인 요청 보기" },
      { id: "a2", severity: "warning", severityLabel: "주의", title: "예산 확인 필요", description: "제출 전 검토가 필요한 견적 초안 2건", count: 2, linkHref: "/search", ctaLabel: "예산 확인 항목 보기" },
      { id: "a3", severity: "warning", severityLabel: "주의", title: "재고 중복 가능", description: "기존 보유 재고와 대조가 필요한 항목 1건", count: 1, linkHref: "/dashboard/inventory", ctaLabel: "재고 대조 항목 보기" },
      { id: "a4", severity: "info", severityLabel: "안내", title: "매칭 실패 항목", description: "후보를 찾지 못한 항목 3건", count: 3, linkHref: "/search", ctaLabel: "검토 큐 확인" },
    ],
    isEmpty: false,
    emptyMessage: "현재 우선 확인이 필요한 운영 경고가 없습니다",
  },

  workQueue: {
    sections: [
      { id: "wq1", title: "즉시 승인 가능", count: 7, description: "검토가 끝나 바로 다음 단계로 보낼 수 있습니다", linkHref: "/search", ctaLabel: "승인 가능한 항목 보기", details: [] },
      { id: "wq2", title: "후보 선택 필요", count: 5, description: "비교 후 선택 확정이 필요한 항목입니다", linkHref: "/search", ctaLabel: "비교 확정하러 가기", details: [{ label: "프로토콜 기반", count: 2 }, { label: "엑셀 기반", count: 3 }] },
      { id: "wq3", title: "제출 직전 확인", count: 4, description: "견적 요청 전에 수량·단위·예산을 확인하세요", linkHref: "/search", ctaLabel: "견적 초안 확인하기", details: [] },
      { id: "wq4", title: "수동 확인 필요", count: 3, description: "자동 해석만으로는 확정할 수 없는 항목입니다", linkHref: "/search", ctaLabel: "수동 검토 항목 보기", details: [{ label: "제조사 확인 필요", count: 2 }, { label: "규격 불일치", count: 1 }] },
    ],
    isEmpty: false,
    emptyMessage: "지금 바로 처리할 작업이 없습니다",
  },

  approvalInbox: {
    pendingCount: 3,
    pendingDescription: "구매 또는 운영 승인 후 진행할 수 있습니다",
    myRequestsCount: 2,
    myRequestsDescription: "현재 승인 대기 중입니다",
    recentDecisions: [
      { id: "d1", action: "프로토콜 기반 항목 2건 승인", state: "approved", stateLabel: "승인", time: "2026-03-19T09:30:00Z" },
      { id: "d2", action: "예산 초과 견적 1건 반려", state: "rejected", stateLabel: "반려", time: "2026-03-19T08:15:00Z" },
    ],
    isEmpty: false,
    emptyMessage: "현재 승인 대기 요청이 없습니다",
  },

  activityFeed: {
    items: [
      { id: "f1", actor: "운영 담당자", action: "5개 항목을 비교 큐로 전송했습니다", time: "2026-03-19T10:24:00Z", timeFormatted: "10:24" },
      { id: "f2", actor: "구매 담당자", action: "3개 견적 초안을 제출 가능 상태로 변경했습니다", time: "2026-03-19T10:10:00Z", timeFormatted: "10:10" },
      { id: "f3", actor: "관리자", action: "예산 확인 요청 1건을 승인했습니다", time: "2026-03-19T09:45:00Z", timeFormatted: "09:45" },
      { id: "f4", actor: "시스템", action: "엑셀 업로드 24행이 검토 큐에 추가되었습니다", time: "2026-03-19T09:30:00Z", timeFormatted: "09:30" },
      { id: "f5", actor: "연구 책임자", action: "프로토콜에서 8개 후보가 추출되었습니다", time: "2026-03-19T09:15:00Z", timeFormatted: "09:15" },
      { id: "f6", actor: "시스템", action: "검토 필요 항목 3건이 승인되었습니다", time: "2026-03-19T09:00:00Z", timeFormatted: "09:00" },
    ],
    isEmpty: false,
    emptyMessage: "아직 기록된 운영 활동이 없습니다",
  },

  quickLinks: [
    { href: "/search", label: "Step 1 검토 큐 열기" },
    { href: "/search", label: "Step 2 비교 큐 열기" },
    { href: "/search", label: "Step 3 견적 초안 열기" },
    { href: "#approvals", label: "승인 요청 보기" },
    { href: "#members", label: "멤버 및 접근 관리 보기" },
    { href: "#settings", label: "정책 및 설정 보기" },
  ],

  pageState: {
    isLoading: false,
    hasPartialError: false,
    errorBlocks: [],
  },
};

// ── Empty state fixture ──
export const DUMMY_OVERVIEW_EMPTY: OrganizationOverviewPageViewModel = {
  organization: { id: "org-2", name: "신규 조직", plan: "starter", memberCount: 1, createdAt: new Date().toISOString() },
  kpis: [
    { key: "reviewNeeded", title: "검토 필요", value: 0, description: "Step 1에서 확인이 필요한 항목입니다", statusLabel: "정상", tone: "green", linkHref: "/search" },
    { key: "compareWaiting", title: "비교 확정 대기", value: 0, description: "후보 선택이 필요한 항목입니다", statusLabel: "정상", tone: "green", linkHref: "/search" },
    { key: "quoteDraftReady", title: "견적 초안 제출 가능", value: 0, description: "Step 3에서 바로 제출할 수 있습니다", statusLabel: "없음", tone: "slate", linkHref: "/search" },
    { key: "approvalPending", title: "승인 대기", value: 0, description: "검토 또는 제출 승인이 필요한 요청입니다", statusLabel: "정상", tone: "green", linkHref: null },
    { key: "budgetWarnings", title: "예산 확인 필요", value: 0, description: "제출 전 예산 검토가 필요한 항목입니다", statusLabel: "정상", tone: "green", linkHref: null },
    { key: "inventoryWarnings", title: "재고 중복 가능", value: 0, description: "기존 재고와 중복 구매 가능성이 있습니다", statusLabel: "정상", tone: "green", linkHref: null },
    { key: "activeMembers", title: "활성 멤버", value: 1, description: "최근 작업이 있는 조직 멤버 수입니다", statusLabel: "운영 중", tone: "slate", linkHref: null },
    { key: "recentActivity", title: "최근 7일 활동", value: 0, description: "검토, 비교, 제출, 승인 이벤트 기준입니다", statusLabel: "활동 추적 중", tone: "slate", linkHref: null },
  ],
  stepFunnel: { stages: [
    { key: "step1", title: "검토 큐", count: 0, description: "입력 해석과 항목 검토가 진행 중입니다", subStatus: "검토 필요 0 · 실패 0", linkHref: "/search", ctaLabel: "검토 큐 열기" },
    { key: "step2", title: "비교 큐", count: 0, description: "후보 선택과 비교 확정이 필요한 항목입니다", subStatus: "선택 필요 0 · 확정 0", linkHref: "/search", ctaLabel: "비교 큐 열기" },
    { key: "step3", title: "견적 초안", count: 0, description: "제출 전 수량·단위·예산을 확인할 수 있습니다", subStatus: "제출 가능 0 · 보류 0", linkHref: "/search", ctaLabel: "견적 초안 열기" },
  ]},
  alerts: { items: [], isEmpty: true, emptyMessage: "현재 우선 확인이 필요한 운영 경고가 없습니다" },
  workQueue: { sections: [], isEmpty: true, emptyMessage: "지금 바로 처리할 작업이 없습니다" },
  approvalInbox: { pendingCount: 0, pendingDescription: "", myRequestsCount: 0, myRequestsDescription: "", recentDecisions: [], isEmpty: true, emptyMessage: "현재 승인 대기 요청이 없습니다" },
  activityFeed: { items: [], isEmpty: true, emptyMessage: "아직 기록된 운영 활동이 없습니다" },
  quickLinks: [
    { href: "/search", label: "Step 1 검토 큐 열기" },
    { href: "/search", label: "Step 2 비교 큐 열기" },
    { href: "/search", label: "Step 3 견적 초안 열기" },
    { href: "#approvals", label: "승인 요청 보기" },
    { href: "#members", label: "멤버 및 접근 관리 보기" },
    { href: "#settings", label: "정책 및 설정 보기" },
  ],
  pageState: { isLoading: false, hasPartialError: false, errorBlocks: [] },
};
