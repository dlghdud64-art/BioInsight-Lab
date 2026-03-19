"use client";

/**
 * OrganizationOverviewPage — Presentational Composition
 *
 * container가 만든 view model + block states를 받아 조립만 한다.
 * 데이터 계산/fetch/판정 금지.
 */

import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type {
  OrganizationOverviewPageViewModel,
} from "@/lib/review-queue/ops-hub-view-models";
import type { AllBlockStates } from "@/lib/review-queue/ops-hub-block-states";
import { PAGE_COPY } from "@/lib/review-queue/ops-hub-block-states";
import {
  BlockWrapper,
  OverviewKpiGrid,
  StepFunnelBlock,
  AlertsBlockContent,
  WorkQueueBlockContent,
  ApprovalInboxBlockContent,
  ActivityFeedBlockContent,
  QuickLinksBlock,
} from "./overview-blocks";
import { OverviewTwoColumnLayout } from "./overview-shell";
import { BLOCK_SKELETON_HEIGHTS } from "@/lib/review-queue/ops-hub-block-states";

// ═══════════════════════════════════════════════════
// Props
// ═══════════════════════════════════════════════════

interface OrganizationOverviewPageProps {
  vm: OrganizationOverviewPageViewModel;
  blockStates: AllBlockStates;
}

// ═══════════════════════════════════════════════════
// Page Component
// ═══════════════════════════════════════════════════

export function OrganizationOverviewPage({ vm, blockStates }: OrganizationOverviewPageProps) {
  const hasAnyData =
    vm.stepFunnel.stages.some((s) => s.count > 0) ||
    !vm.alerts.isEmpty ||
    !vm.workQueue.isEmpty ||
    !vm.activityFeed.isEmpty;

  // ── 전체 빈 상태 (데이터 0 + 에러 없음) ──
  if (!hasAnyData && !vm.pageState.hasPartialError) {
    return (
      <div className="space-y-6">
        {/* KPI는 0이어도 구조 유지 */}
        <OverviewKpiGrid kpis={vm.kpis} />
        <StepFunnelBlock stages={vm.stepFunnel.stages} />

        {/* 시작 가이드 */}
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-el border border-bd border-dashed rounded-xl text-center max-w-lg mx-auto">
          <Shield className="h-10 w-10 text-slate-500 mb-4" />
          <h3 className="text-base font-bold text-slate-200 mb-2">아직 운영 작업이 시작되지 않았습니다</h3>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            직접 검색 또는 업로드 해석으로 검토 큐를 만들면<br />비교와 견적 작업이 이어집니다
          </p>
          <Button asChild className="bg-blue-600 hover:bg-blue-500">
            <Link href="/test/search">Step 1 시작하기</Link>
          </Button>
        </div>

        <QuickLinksBlock links={vm.quickLinks} />
      </div>
    );
  }

  // ── Partial error banner ──
  const showPartialBanner = vm.pageState.hasPartialError;

  return (
    <div className="space-y-6">
      {/* Partial error banner */}
      {showPartialBanner && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-2.5 text-xs text-amber-300">
          {PAGE_COPY.partialErrorBanner}
        </div>
      )}

      {/* 1. KPI Grid */}
      <OverviewKpiGrid kpis={vm.kpis} />

      {/* 2. Step Funnel */}
      <StepFunnelBlock stages={vm.stepFunnel.stages} />

      {/* 3. Alerts */}
      <BlockWrapper
        title="운영 경고"
        helperText="우선 확인이 필요한 항목만 표시합니다"
        state={blockStates.alerts}
        minHeight={BLOCK_SKELETON_HEIGHTS.alerts}
      >
        <AlertsBlockContent items={vm.alerts.items} />
      </BlockWrapper>

      {/* 4-5. Work Queue + Approval Inbox (Two-Column) */}
      <OverviewTwoColumnLayout
        left={
          <BlockWrapper
            title="지금 처리할 작업"
            helperText="바로 처리 가능한 항목부터 보여줍니다"
            state={blockStates.workQueue}
            minHeight={BLOCK_SKELETON_HEIGHTS.workQueue}
          >
            <WorkQueueBlockContent sections={vm.workQueue.sections} />
          </BlockWrapper>
        }
        right={
          <BlockWrapper
            title="승인 대기함"
            helperText="조직 차원의 승인과 검토가 필요한 요청입니다"
            state={blockStates.approvalInbox}
            minHeight={BLOCK_SKELETON_HEIGHTS.approvalInbox}
          >
            <ApprovalInboxBlockContent inbox={vm.approvalInbox} />
          </BlockWrapper>
        }
      />

      {/* 6. Activity Feed */}
      <BlockWrapper
        title="최근 운영 활동"
        helperText="검토, 비교, 제출, 승인 이력을 시간순으로 보여줍니다"
        state={blockStates.activityFeed}
        minHeight={BLOCK_SKELETON_HEIGHTS.activityFeed}
      >
        <ActivityFeedBlockContent items={vm.activityFeed.items} />
      </BlockWrapper>

      {/* 7. Quick Links */}
      <QuickLinksBlock links={vm.quickLinks} />
    </div>
  );
}
