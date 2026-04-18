/**
 * Organization Overview — ViewModel
 *
 * 책임: raw query response → UI 친화형 데이터 변환
 * 금지: API 호출, hook, router, global state
 *
 * 이 파일에서 badge label, status tone, amount format,
 * date label, empty copy 등을 결정한다.
 */

import type {
  OverviewStatsRaw,
  OverviewAlertRaw,
  OverviewActivityRaw,
  OverviewQueryResult,
} from "../hooks/useOverviewQuery";

// ═══════════════════════════════════════════════════
// 1. ViewModel Types
// ═══════════════════════════════════════════════════

export type KpiTone = "green" | "amber" | "red" | "blue" | "slate";

export interface KpiCardVM {
  key: string;
  title: string;
  value: number;
  description: string;
  statusLabel: string;
  tone: KpiTone;
}

export interface StepFunnelStageVM {
  key: string;
  title: string;
  count: number;
  description: string;
  subStatus: string;
  ctaLabel: string;
  linkHref: string;
}

export interface AlertItemVM {
  id: string;
  severity: "urgent" | "warning" | "info";
  severityLabel: string;
  title: string;
  description: string;
  ctaLabel: string;
  linkHref: string;
}

export interface ActivityItemVM {
  id: string;
  action: string;
  actor: string;
  timeFormatted: string;
}

export interface OverviewVM {
  kpis: KpiCardVM[];
  stepFunnel: { stages: StepFunnelStageVM[] };
  alerts: { isEmpty: boolean; items: AlertItemVM[] };
  activityFeed: { isEmpty: boolean; items: ActivityItemVM[] };
  staleBadge: string | null;
  totalPendingLabel: string;
}

// ═══════════════════════════════════════════════════
// 2. KPI Mapping
// ═══════════════════════════════════════════════════

function resolveKpiTone(key: string, value: number): KpiTone {
  if (key === "quoteDraftReady" || key === "confirmed") {
    return value > 0 ? "green" : "slate";
  }
  if (key === "reviewNeeded" || key === "budgetWarning" || key === "inventoryDuplicate" || key === "compareWaiting") {
    return value === 0 ? "green" : "amber";
  }
  if (key === "approvalPending") {
    return value === 0 ? "green" : value >= 3 ? "red" : "amber";
  }
  return "slate";
}

function resolveKpiStatusLabel(key: string, value: number): string {
  const labels: Record<string, (v: number) => string> = {
    reviewNeeded: (v) => v === 0 ? "정상" : v <= 5 ? "확인 필요" : "우선 처리",
    compareWaiting: (v) => v === 0 ? "정상" : v <= 3 ? "처리 가능" : "대기 증가",
    quoteDraftReady: (v) => v === 0 ? "없음" : "즉시 처리 가능",
    approvalPending: (v) => v === 0 ? "정상" : v <= 2 ? "대기 중" : "우선 확인",
    budgetWarning: (v) => v === 0 ? "정상" : "검토 필요",
    inventoryDuplicate: (v) => v === 0 ? "정상" : "대조 필요",
    activeMembers: () => "운영 중",
    recentActivity: () => "활동 추적 중",
  };
  return labels[key]?.(value) ?? "—";
}

const KPI_META: Array<{ key: string; title: string; descFn: () => string }> = [
  { key: "reviewNeeded", title: "검토 필요", descFn: () => "Step 1에서 확인이 필요한 항목입니다" },
  { key: "compareWaiting", title: "비교 확정 대기", descFn: () => "후보 선택이 필요한 항목입니다" },
  { key: "quoteDraftReady", title: "견적 초안 제출 가능", descFn: () => "Step 3에서 바로 제출할 수 있습니다" },
  { key: "approvalPending", title: "승인 대기", descFn: () => "검토 또는 제출 승인이 필요한 요청입니다" },
  { key: "budgetWarning", title: "예산 확인 필요", descFn: () => "제출 전 예산 검토가 필요한 항목입니다" },
  { key: "inventoryDuplicate", title: "재고 중복 가능", descFn: () => "기존 재고와 중복 구매 가능성이 있습니다" },
  { key: "activeMembers", title: "활성 멤버", descFn: () => "최근 작업이 있는 조직 멤버 수입니다" },
  { key: "recentActivity", title: "최근 7일 활동", descFn: () => "검토, 비교, 제출, 승인 이벤트 기준입니다" },
];

function statsToKpiValue(stats: OverviewStatsRaw, key: string): number {
  const map: Record<string, number> = {
    reviewNeeded: stats.reviewNeeded,
    compareWaiting: stats.compareNeeded,
    quoteDraftReady: stats.approved,
    approvalPending: stats.pendingApprovals,
    budgetWarning: stats.budgetWarnings,
    inventoryDuplicate: stats.inventoryDuplicates,
    activeMembers: stats.activeMembers,
    recentActivity: stats.recentActivityCount,
  };
  return map[key] ?? 0;
}

export function toKpiCards(stats: OverviewStatsRaw): KpiCardVM[] {
  return KPI_META.map(({ key, title, descFn }) => {
    const value = statsToKpiValue(stats, key);
    return {
      key,
      title,
      value,
      description: descFn(),
      statusLabel: resolveKpiStatusLabel(key, value),
      tone: resolveKpiTone(key, value),
    };
  });
}

// ═══════════════════════════════════════════════════
// 3. Step Funnel Mapping
// ═══════════════════════════════════════════════════

export function toStepFunnel(stats: OverviewStatsRaw): { stages: StepFunnelStageVM[] } {
  return {
    stages: [
      {
        key: "step1", title: "검토 큐", count: stats.totalReview,
        description: "입력 해석과 항목 검토가 진행 중입니다",
        subStatus: `검토 필요 ${stats.reviewNeeded} · 실패 ${stats.matchFailed}`,
        ctaLabel: "검토 큐 열기", linkHref: "/app/search",
      },
      {
        key: "step2", title: "비교 큐", count: stats.totalCompare,
        description: "후보 선택과 비교 확정이 필요한 항목입니다",
        subStatus: `선택 필요 ${stats.compareNeeded}`,
        ctaLabel: "비교 큐 열기", linkHref: "/app/compare",
      },
      {
        key: "step3", title: "견적 초안", count: stats.totalQuoteDraft,
        description: "제출 전 수량·단위·예산을 확인할 수 있습니다",
        subStatus: `제출 가능 ${stats.approved}`,
        ctaLabel: "견적 초안 열기", linkHref: "/app/quote",
      },
    ],
  };
}

// ═══════════════════════════════════════════════════
// 4. Alerts Mapping
// ═══════════════════════════════════════════════════

const SEVERITY_MAP: Record<string, { label: string; vm: "urgent" | "warning" | "info" }> = {
  high: { label: "긴급", vm: "urgent" },
  medium: { label: "주의", vm: "warning" },
  low: { label: "안내", vm: "info" },
};

export function toAlertItems(alerts: OverviewAlertRaw[]): AlertItemVM[] {
  return alerts.map((a) => {
    const sev = SEVERITY_MAP[a.severity] ?? SEVERITY_MAP.low;
    return {
      id: a.id,
      severity: sev.vm,
      severityLabel: sev.label,
      title: a.title,
      description: a.description,
      ctaLabel: "항목 보기",
      linkHref: a.linkHref,
    };
  });
}

// ═══════════════════════════════════════════════════
// 5. Activity Feed Mapping
// ═══════════════════════════════════════════════════

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export function toActivityItems(events: OverviewActivityRaw[]): ActivityItemVM[] {
  return events.map((e) => ({
    id: e.id,
    action: e.message,
    actor: e.actorLabel,
    timeFormatted: formatRelativeTime(e.timestamp),
  }));
}

// ═══════════════════════════════════════════════════
// 6. Page-Level ViewModel
// ═══════════════════════════════════════════════════

export function toOverviewVM(result: OverviewQueryResult): OverviewVM {
  const { stats, alerts, recentActivity } = result;
  const alertItems = toAlertItems(alerts);
  const activityItems = toActivityItems(recentActivity);

  const totalPending = stats.reviewNeeded + stats.compareNeeded + stats.pendingApprovals;

  return {
    kpis: toKpiCards(stats),
    stepFunnel: toStepFunnel(stats),
    alerts: { isEmpty: alertItems.length === 0, items: alertItems },
    activityFeed: { isEmpty: activityItems.length === 0, items: activityItems },
    staleBadge: null, // 향후 stale 판정 추가
    totalPendingLabel: totalPending > 0 ? `처리 대기 ${totalPending}건` : "처리 대기 없음",
  };
}
