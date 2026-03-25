"use client";

/**
 * OrganizationOverviewPresenter
 *
 * 책임: 순수 props 기반 렌더링만.
 * 금지: hook/router/global store/API shape/business logic.
 */

import Link from "next/link";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrganizationOverviewPresenterProps } from "./OrganizationOverview.types";
import {
  OverviewKpiGrid,
  StepFunnelBlock,
  AlertsBlockContent,
  WorkQueueBlockContent,
  ApprovalInboxBlockContent,
  ActivityFeedBlockContent,
  QuickLinksBlock,
} from "@/components/ops-hub/overview-blocks";
import { OverviewTwoColumnLayout, OverviewSection } from "@/components/ops-hub/overview-shell";
import { BlockSkeleton, EmptyState, ErrorState, UnavailableState } from "@/components/ops-hub/block-state-ui";
import { BLOCK_COPY, PAGE_COPY, BLOCK_SKELETON_HEIGHTS } from "@/lib/review-queue/ops-hub-block-states";

// ── Block 렌더 헬퍼 ──
function renderBlock<T>(
  block: { state: string; data?: T; error?: { message?: string }; onRetry?: () => void } | undefined,
  copy: { loading: string; empty: string; error: string; unavailable: string; retryCta: string },
  skeletonHeight: number,
  readyRenderer: (data: T) => React.ReactNode,
  emptyCta?: { label: string; onClick: () => void }
): React.ReactNode {
  if (!block) return null;
  switch (block.state) {
    case "loading": return <BlockSkeleton minHeight={skeletonHeight} />;
    case "error": return <ErrorState title={copy.error} description={block.error?.message} onRetry={block.onRetry} retryCta={copy.retryCta} />;
    case "empty": return <EmptyState title={copy.empty} primaryAction={emptyCta} />;
    case "unavailable": return <UnavailableState title={copy.unavailable} />;
    case "ready": return block.data ? readyRenderer(block.data) : null;
    default: return null;
  }
}

export function OrganizationOverviewPresenter(props: OrganizationOverviewPresenterProps) {
  // ── Page-level states ──
  switch (props.pageState) {
    case "loading":
      return (
        <div className="space-y-4">
          <BlockSkeleton minHeight={80} />
          <BlockSkeleton minHeight={120} />
          <BlockSkeleton minHeight={200} />
        </div>
      );

    case "error":
      return (
        <ErrorState
          title="운영 데이터를 불러오지 못했습니다"
          description={props.pageError?.message}
          onRetry={props.isPageRetryable ? props.onPageRetry : undefined}
        />
      );

    case "unavailable":
      return (
        <UnavailableState
          title={props.unavailable?.title ?? "운영 허브를 사용할 수 없습니다"}
          description={props.unavailable?.description}
          primaryAction={props.unavailable?.primaryAction}
        />
      );

    case "empty":
      return (
        <div className="space-y-6">
          {props.kpis && <OverviewKpiGrid kpis={props.kpis} />}
          {props.stepFunnel && <StepFunnelBlock stages={props.stepFunnel.stages} />}
          <div className="flex flex-col items-center justify-center py-16 px-6 bg-el border border-bd border-dashed rounded-xl text-center max-w-lg mx-auto">
            <Shield className="h-10 w-10 text-slate-500 mb-4" />
            <h3 className="text-base font-bold text-slate-200 mb-2">{PAGE_COPY.fullEmptyTitle}</h3>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">{PAGE_COPY.fullEmptyDescription}</p>
            <Button asChild className="bg-blue-600 hover:bg-blue-500">
              <Link href="/app/search">{PAGE_COPY.fullEmptyCta}</Link>
            </Button>
          </div>
          {props.quickLinks && <QuickLinksBlock links={props.quickLinks} />}
        </div>
      );

    case "ready":
      break; // fall through to ready render
  }

  // ── Ready state ──
  return (
    <div className="space-y-6">
      {props.hasPartialError && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-2.5 text-xs text-amber-300">
          {PAGE_COPY.partialErrorBanner}
        </div>
      )}

      {props.kpis && <OverviewKpiGrid kpis={props.kpis} />}
      {props.stepFunnel && <StepFunnelBlock stages={props.stepFunnel.stages} />}

      <OverviewSection title="운영 경고" helperText="우선 확인이 필요한 항목만 표시합니다">
        {renderBlock(props.alertsBlock, BLOCK_COPY.alerts, BLOCK_SKELETON_HEIGHTS.alerts,
          (data) => <AlertsBlockContent items={data.items} />
        )}
      </OverviewSection>

      <OverviewTwoColumnLayout
        left={
          <OverviewSection title="지금 처리할 작업" helperText="바로 처리 가능한 항목부터 보여줍니다">
            {renderBlock(props.workQueueBlock, BLOCK_COPY.workQueue, BLOCK_SKELETON_HEIGHTS.workQueue,
              (data) => <WorkQueueBlockContent sections={data.sections} />
            )}
          </OverviewSection>
        }
        right={
          <OverviewSection title="승인 대기함" helperText="조직 차원의 승인과 검토가 필요한 요청입니다">
            {renderBlock(props.approvalInboxBlock, BLOCK_COPY.approvalInbox, BLOCK_SKELETON_HEIGHTS.approvalInbox,
              (data) => <ApprovalInboxBlockContent inbox={data} />
            )}
          </OverviewSection>
        }
      />

      <OverviewSection title="최근 운영 활동" helperText="검토, 비교, 제출, 승인 이력을 시간순으로 보여줍니다">
        {renderBlock(props.activityFeedBlock, BLOCK_COPY.activityFeed, BLOCK_SKELETON_HEIGHTS.activityFeed,
          (data) => <ActivityFeedBlockContent items={data.items} />
        )}
      </OverviewSection>

      {props.quickLinks && <QuickLinksBlock links={props.quickLinks} />}
    </div>
  );
}
