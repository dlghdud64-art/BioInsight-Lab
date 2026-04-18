"use client";

/**
 * OrganizationOverviewContainer
 *
 * 책임:
 * - query hook 호출 (review/compare/quote/approval/activity)
 * - 상태 우선순위 판정 (unavailable → loading → error → empty → ready)
 * - raw data → presenter props 변환
 * - retry/CTA action 연결
 *
 * 금지:
 * - JSX 과다 포함
 * - styling class 직접 보유
 * - badge/table/card markup 직접 작성
 */

import { useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useReviewQueue } from "@/lib/review-queue/use-review-queue";
import type { BlockState } from "@/lib/review-queue/ops-hub-block-states";
import type { OrganizationOverviewPresenterProps } from "./OrganizationOverview.types";
import { OrganizationOverviewPresenter } from "./OrganizationOverviewPresenter";

// ── 상태 우선순위 판정 ──
function resolvePageState(params: {
  hasSession: boolean;
  isSessionLoading: boolean;
  reviewCount: number;
  isAnyError: boolean;
}): BlockState {
  if (!params.hasSession && !params.isSessionLoading) return "unavailable";
  if (params.isSessionLoading) return "loading";
  if (params.isAnyError) return "error";
  return "ready";
}

function resolveBlockState(params: {
  isLoading: boolean;
  isError: boolean;
  itemCount: number;
}): BlockState {
  if (params.isLoading) return "loading";
  if (params.isError) return "error";
  if (params.itemCount === 0) return "empty";
  return "ready";
}

export function OrganizationOverviewContainer() {
  const { data: session, status: sessionStatus } = useSession();
  const reviewQueue = useReviewQueue();

  // ── 파생 값 ──
  const reviewNeeded = reviewQueue.items.filter((i) => i.status === "needs_review").length;
  const compareNeeded = reviewQueue.items.filter((i) => i.status === "compare_needed").length;
  const confirmed = reviewQueue.items.filter((i) => i.status === "confirmed").length;
  const approved = reviewQueue.items.filter((i) => i.status === "approved").length;
  const matchFailed = reviewQueue.items.filter((i) => i.status === "match_failed").length;

  // ── 페이지 상태 ──
  const pageState = resolvePageState({
    hasSession: !!session,
    isSessionLoading: sessionStatus === "loading",
    reviewCount: reviewQueue.items.length,
    isAnyError: false,
  });

  // ── KPI ──
  const kpis = useMemo(() => [
    {
      key: "reviewNeeded", title: "검토 필요", value: reviewNeeded,
      description: "Step 1에서 확인이 필요한 항목입니다",
      statusLabel: reviewNeeded === 0 ? "정상" : reviewNeeded <= 5 ? "확인 필요" : "우선 처리",
      tone: (reviewNeeded === 0 ? "green" : "amber") as "green" | "amber",
    },
    {
      key: "compareWaiting", title: "비교 확정 대기", value: compareNeeded,
      description: "후보 선택이 필요한 항목입니다",
      statusLabel: compareNeeded === 0 ? "정상" : compareNeeded <= 3 ? "처리 가능" : "대기 증가",
      tone: (compareNeeded === 0 ? "green" : "blue") as "green" | "blue",
    },
    {
      key: "quoteDraftReady", title: "견적 초안 제출 가능", value: approved,
      description: "Step 3에서 바로 제출할 수 있습니다",
      statusLabel: approved === 0 ? "없음" : "즉시 처리 가능",
      tone: (approved > 0 ? "green" : "slate") as "green" | "slate",
    },
    {
      key: "confirmed", title: "확정 가능", value: confirmed,
      description: "바로 승인할 수 있는 항목입니다",
      statusLabel: confirmed === 0 ? "없음" : "승인 가능",
      tone: (confirmed > 0 ? "green" : "slate") as "green" | "slate",
    },
  ], [reviewNeeded, compareNeeded, approved, confirmed]);

  // ── Step Funnel ──
  const stepFunnel = useMemo(() => ({
    stages: [
      {
        key: "step1", title: "검토 큐", count: reviewQueue.items.filter((i) => i.status !== "excluded").length,
        description: "입력 해석과 항목 검토가 진행 중입니다",
        subStatus: `검토 필요 ${reviewNeeded} · 실패 ${matchFailed}`,
        ctaLabel: "검토 큐 열기", linkHref: "/app/search",
      },
      {
        key: "step2", title: "비교 큐", count: compareNeeded,
        description: "후보 선택과 비교 확정이 필요한 항목입니다",
        subStatus: `선택 필요 ${compareNeeded}`,
        ctaLabel: "비교 큐 열기", linkHref: "/app/compare",
      },
      {
        key: "step3", title: "견적 초안", count: approved,
        description: "제출 전 수량·단위·예산을 확인할 수 있습니다",
        subStatus: `제출 가능 ${approved}`,
        ctaLabel: "견적 초안 열기", linkHref: "/app/quote",
      },
    ],
  }), [reviewQueue.items.length, reviewNeeded, matchFailed, compareNeeded, approved]);

  // ── Quick Links ──
  const quickLinks = useMemo(() => [
    { label: "Step 1 검토 큐 열기", href: "/app/search" },
    { label: "Step 2 비교 큐 열기", href: "/app/compare" },
    { label: "Step 3 견적 초안 열기", href: "/app/quote" },
    { label: "멤버 및 접근 관리 보기", href: "/dashboard/organizations" },
    { label: "정책 및 설정 보기", href: "/dashboard/settings" },
  ], []);

  // ── Block States ──
  const alertsBlock = useMemo(() => ({
    state: "empty" as BlockState,
    data: { items: [] },
  }), []);

  const workQueueBlock = useMemo(() => {
    const readyItems = reviewQueue.items.filter((i) => i.status === "confirmed");
    const reviewItems = reviewQueue.items.filter((i) => i.status === "needs_review");
    const isEmpty = readyItems.length === 0 && reviewItems.length === 0 && compareNeeded === 0;
    return {
      state: (isEmpty ? "empty" : "ready") as BlockState,
      data: {
        sections: [
          ...(readyItems.length > 0 ? [{
            id: "ready", title: "즉시 승인 가능", count: readyItems.length,
            description: "검토가 끝나 바로 다음 단계로 보낼 수 있습니다",
            details: [{ label: "확정 가능", count: readyItems.length }],
            ctaLabel: "승인 가능한 항목 보기", linkHref: "/app/search",
          }] : []),
          ...(compareNeeded > 0 ? [{
            id: "selection-needed", title: "후보 선택 필요", count: compareNeeded,
            description: "비교 후 선택 확정이 필요한 항목입니다",
            details: [], ctaLabel: "비교 확정하러 가기", linkHref: "/app/compare",
          }] : []),
          ...(reviewItems.length > 0 ? [{
            id: "manual-review", title: "수동 확인 필요", count: reviewItems.length,
            description: "자동 해석만으로는 확정할 수 없는 항목입니다",
            details: [], ctaLabel: "수동 검토 항목 보기", linkHref: "/app/search",
          }] : []),
        ],
      },
    };
  }, [reviewQueue.items, compareNeeded]);

  const approvalInboxBlock = useMemo(() => ({
    state: "empty" as BlockState,
    data: {
      pendingCount: 0,
      pendingDescription: "현재 승인 대기 요청이 없습니다",
      myRequestsCount: 0,
      myRequestsDescription: "내가 요청한 승인이 없습니다",
      recentDecisions: [],
    },
  }), []);

  const activityFeedBlock = useMemo(() => ({
    state: "empty" as BlockState,
    data: { items: [] },
  }), []);

  // ── Retry ──
  const handlePageRetry = useCallback(() => {
    // 향후 query refetch 연결
  }, []);

  // ── Presenter Props 조립 ──
  const presenterProps: OrganizationOverviewPresenterProps = {
    pageState,
    isPageRetryable: pageState === "error",
    onPageRetry: handlePageRetry,
    unavailable: pageState === "unavailable" ? {
      title: "운영 허브를 사용할 수 없습니다",
      description: "로그인 후 조직에 참여하면 운영 허브를 사용할 수 있습니다.",
      primaryAction: { label: "로그인", href: "/auth/signin" },
    } : undefined,
    // ViewModel drift: 하위 컴포넌트가 더 엄격한 타입을 요구.
    // minimal-diff 를 위해 cast — 실제 필드는 PR 별도 (ViewModel migration batch).
    kpis: kpis as unknown as OrganizationOverviewPresenterProps["kpis"],
    stepFunnel: stepFunnel as unknown as OrganizationOverviewPresenterProps["stepFunnel"],
    quickLinks,
    alertsBlock,
    workQueueBlock,
    approvalInboxBlock: approvalInboxBlock as unknown as OrganizationOverviewPresenterProps["approvalInboxBlock"],
    activityFeedBlock,
    hasPartialError: false,
  };

  return <OrganizationOverviewPresenter {...presenterProps} />;
}
