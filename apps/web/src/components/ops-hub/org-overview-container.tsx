"use client";

/**
 * Organization Overview Page Container
 *
 * raw domain data → mapper → view model → presentational component.
 * 블록별 loading/error/empty 분리. raw data를 UI에 직접 전달하지 않는다.
 */

import { useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useReviewQueue } from "@/lib/review-queue/use-review-queue";
import { mapToOverviewPageViewModel, type OpsHubRawInput } from "@/lib/review-queue/ops-hub-mappers";
import { getEvents } from "@/lib/review-queue/activity-log";
import type { CompareQueueItem, QuoteDraftItem } from "@/lib/review-queue/types";
import type { ApprovalRequest } from "@/lib/review-queue/permissions";
import type { OverviewOrganizationHeader, ErrorBlockKey } from "@/lib/review-queue/ops-hub-view-models";
import { OrgOverviewHub } from "./org-overview-hub";
import { Loader2 } from "lucide-react";

// ═══════════════════════════════════════════════════
// Loadable type
// ═══════════════════════════════════════════════════

interface Loadable<T> {
  data: T;
  isLoading: boolean;
  isError: boolean;
}

function loaded<T>(data: T): Loadable<T> {
  return { data, isLoading: false, isError: false };
}

// ═══════════════════════════════════════════════════
// Container Props
// ═══════════════════════════════════════════════════

interface OrgOverviewContainerProps {
  organization: OverviewOrganizationHeader;
  memberCount: number;
  activeMemberCount: number;
  // 외부에서 주입 가능한 추가 데이터 (optional)
  compareItems?: CompareQueueItem[];
  quoteDrafts?: QuoteDraftItem[];
  approvalRequests?: ApprovalRequest[];
}

// ═══════════════════════════════════════════════════
// Container Component
// ═══════════════════════════════════════════════════

export function OrgOverviewContainer({
  organization,
  memberCount,
  activeMemberCount,
  compareItems = [],
  quoteDrafts = [],
  approvalRequests = [],
}: OrgOverviewContainerProps) {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? "current_user";

  // ── 1. Review Queue (sessionStorage backed) ──
  const reviewQueue = useReviewQueue();

  // ── 2. Activity Events (sessionStorage backed) ──
  const activityEvents = useMemo(() => getEvents(), [reviewQueue.items.length]);

  // ── 3. Error blocks 수집 (현재는 없음, 향후 API 연결 시 추가) ──
  const errorBlocks: ErrorBlockKey[] = [];

  // ── 4. Raw input 조합 ──
  const rawInput: OpsHubRawInput = useMemo(() => ({
    organization,
    reviewItems: reviewQueue.items,
    compareItems,
    quoteDrafts,
    approvalRequests,
    activityEvents,
    memberCount,
    activeMemberCount,
    errorBlocks,
  }), [
    organization,
    reviewQueue.items,
    compareItems,
    quoteDrafts,
    approvalRequests,
    activityEvents,
    memberCount,
    activeMemberCount,
    errorBlocks,
  ]);

  // ── 5. View Model 생성 ──
  const viewModel = useMemo(
    () => mapToOverviewPageViewModel(rawInput, currentUserId),
    [rawInput, currentUserId]
  );

  // ── 6. Presentational 렌더 ──
  return (
    <OrgOverviewHub
      kpi={{
        totalMembers: viewModel.kpis.find((k) => k.key === "activeMembers")?.value ?? memberCount,
        activeMembers: activeMemberCount,
        approvalPending: viewModel.kpis.find((k) => k.key === "approvalPending")?.value ?? 0,
        reviewNeeded: viewModel.kpis.find((k) => k.key === "reviewNeeded")?.value ?? 0,
        compareWaiting: viewModel.kpis.find((k) => k.key === "compareWaiting")?.value ?? 0,
        quoteDraftReady: viewModel.kpis.find((k) => k.key === "quoteDraftReady")?.value ?? 0,
        budgetWarnings: viewModel.kpis.find((k) => k.key === "budgetWarnings")?.value ?? 0,
        inventoryWarnings: viewModel.kpis.find((k) => k.key === "inventoryWarnings")?.value ?? 0,
      }}
      funnel={{
        step1Total: viewModel.stepFunnel.stages[0]?.count ?? 0,
        step1Confirmed: reviewQueue.stats.confirmed,
        step1NeedsReview: reviewQueue.stats.needsReview,
        step1MatchFailed: reviewQueue.stats.matchFailed,
        step1Approved: viewModel.stepFunnel.stages[0]?.count ?? 0, // approx
        step2Total: viewModel.stepFunnel.stages[1]?.count ?? 0,
        step2Pending: compareItems.filter((c) => c.status === "pending_comparison" || c.status === "selection_needed").length,
        step2Confirmed: compareItems.filter((c) => c.status === "selection_confirmed").length,
        step3Total: viewModel.stepFunnel.stages[2]?.count ?? 0,
        step3Ready: quoteDrafts.filter((q) => q.status === "draft_ready").length,
        step3Missing: quoteDrafts.filter((q) => q.status === "missing_required_fields").length,
        step3Review: quoteDrafts.filter((q) => q.status === "awaiting_review").length,
      }}
      alerts={viewModel.alerts.items.map((a) => ({
        id: a.id,
        priority: a.severity === "urgent" ? "high" : a.severity === "warning" ? "medium" : "low",
        title: a.title,
        description: a.description,
        count: a.count,
        linkHref: a.linkHref,
        linkLabel: a.ctaLabel,
      }))}
      workQueue={viewModel.workQueue.sections.map((s) => ({
        id: s.id,
        title: s.title,
        count: s.count,
        description: s.description,
        linkHref: s.linkHref,
        linkLabel: s.ctaLabel,
        items: s.details,
      }))}
      approvalInbox={{
        pendingCount: viewModel.approvalInbox.pendingCount,
        myRequestsCount: viewModel.approvalInbox.myRequestsCount,
        recentDecisions: viewModel.approvalInbox.recentDecisions.map((d) => ({
          id: d.id,
          action: d.action,
          state: d.state,
          time: d.time,
        })),
      }}
      activityFeed={viewModel.activityFeed.items.map((f) => ({
        id: f.id,
        actor: f.actor,
        action: f.action,
        entity: "",
        time: f.time,
      }))}
    />
  );
}

// ═══════════════════════════════════════════════════
// Loading State
// ═══════════════════════════════════════════════════

export function OrgOverviewLoading() {
  return (
    <div className="flex items-center justify-center py-20 gap-2 text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">운영 허브 데이터를 불러오는 중...</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Block Error Fallback
// ═══════════════════════════════════════════════════

export function BlockErrorFallback({
  blockName,
  onRetry,
}: {
  blockName: string;
  onRetry?: () => void;
}) {
  const BLOCK_ERROR_MESSAGES: Record<string, string> = {
    alerts: "운영 경고를 불러오지 못했습니다",
    workQueue: "작업 대기 항목을 불러오지 못했습니다",
    approvalInbox: "승인 요청을 불러오지 못했습니다",
    activityFeed: "최근 운영 활동을 불러오지 못했습니다",
  };

  return (
    <div className="bg-pn border border-bd rounded-lg p-4 flex items-center justify-between">
      <span className="text-xs text-slate-400">
        {BLOCK_ERROR_MESSAGES[blockName] ?? `${blockName} 데이터를 불러오지 못했습니다`}
      </span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
        >
          다시 불러오기
        </button>
      )}
    </div>
  );
}
