/**
 * Organization Overview — Container / Presenter 타입 계약
 *
 * Container: 데이터 획득 + 상태 판정 + action 연결
 * Presenter: props로 UI 렌더링만 (fetch/global state 금지)
 */

import type { BlockState, BlockProps } from "@/lib/review-queue/ops-hub-block-states";
import type {
  OverviewKpiCardViewModel,
  StepFunnelStageViewModel,
  AlertItemViewModel,
  WorkQueueSectionViewModel,
  ApprovalInboxBlockViewModel,
  ActivityFeedItemViewModel,
  QuickLinkItemViewModel,
} from "@/lib/review-queue/ops-hub-view-models";

// ═══════════════════════════════════════════════════
// Page-Level Props
// ═══════════════════════════════════════════════════

export interface OrganizationOverviewPresenterProps {
  /** 페이지 전체 상태 */
  pageState: BlockState;

  /** 페이지 에러 (error state일 때) */
  pageError?: { message?: string; code?: string };

  /** retry 가능 여부 */
  isPageRetryable?: boolean;

  /** 페이지 retry handler */
  onPageRetry?: () => void;

  /** unavailable 상태 정보 */
  unavailable?: {
    title: string;
    description: string;
    primaryAction?: { label: string; href: string };
  };

  /** ready 상태 데이터 */
  kpis?: OverviewKpiCardViewModel[];
  stepFunnel?: { stages: StepFunnelStageViewModel[] };
  quickLinks?: QuickLinkItemViewModel[];

  /** Block-level props (ready 상태에서만) */
  alertsBlock?: BlockProps<{ items: AlertItemViewModel[] }>;
  workQueueBlock?: BlockProps<{ sections: WorkQueueSectionViewModel[] }>;
  approvalInboxBlock?: BlockProps<ApprovalInboxBlockViewModel>;
  activityFeedBlock?: BlockProps<{ items: ActivityFeedItemViewModel[] }>;

  /** Partial error banner */
  hasPartialError?: boolean;
}

// ═══════════════════════════════════════════════════
// Block-Level Empty/Error/Unavailable 메시지 Props
// ═══════════════════════════════════════════════════

export interface BlockEmptyProps {
  title: string;
  description?: string;
  primaryAction?: { label: string; onClick: () => void };
}

export interface BlockErrorProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryCta?: string;
}

export interface BlockUnavailableProps {
  title: string;
  description?: string;
  primaryAction?: { label: string; href: string };
}
