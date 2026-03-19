/**
 * Organization Overview Hub — Block-Level UI State Contract
 *
 * 각 블록의 loading / normal / empty / unavailable 상태를 일관되게 관리.
 * container가 판정하고, block component는 state + model만 받아 렌더한다.
 */

import type { OverviewSourceState } from "./ops-hub-adapters";
import type { ErrorBlockKey } from "./ops-hub-view-models";

// ═══════════════════════════════════════════════════
// 1. Block UI State Enum
// ═══════════════════════════════════════════════════

export type OverviewBlockUiState = "loading" | "normal" | "empty" | "unavailable";

// ═══════════════════════════════════════════════════
// 2. Block State Props (block component가 받는 계약)
// ═══════════════════════════════════════════════════

export interface BlockStateProps {
  uiState: OverviewBlockUiState;
  blockKey: ErrorBlockKey;
  emptyMessage: string;
  unavailableMessage: string;
  loadingMessage: string;
  retryCta: string;
  onRetry?: () => void;
}

// ═══════════════════════════════════════════════════
// 3. Block State 판정 함수
// ═══════════════════════════════════════════════════

/** source 상태 + errorBlocks → block UI state 판정 */
export function resolveBlockUiState(
  source: OverviewSourceState<unknown>,
  errorBlocks: ErrorBlockKey[],
  blockKey: ErrorBlockKey
): OverviewBlockUiState {
  // errorBlocks에 명시적으로 포함되면 unavailable
  if (errorBlocks.includes(blockKey)) return "unavailable";
  // source 자체 에러
  if (source.isError) return "unavailable";
  // 로딩 중
  if (source.isLoading) return "loading";
  // 데이터 비어있음
  if (source.isEmpty) return "empty";
  // 정상
  return "normal";
}

/** 여러 source에 의존하는 블록용 (alerts, workQueue 등) */
export function resolveCompositeBlockUiState(
  sources: OverviewSourceState<unknown>[],
  errorBlocks: ErrorBlockKey[],
  blockKey: ErrorBlockKey,
  dataIsEmpty: boolean
): OverviewBlockUiState {
  if (errorBlocks.includes(blockKey)) return "unavailable";
  if (sources.some((s) => s.isError)) return "unavailable";
  if (sources.every((s) => s.isLoading)) return "loading";
  if (dataIsEmpty) return "empty";
  return "normal";
}

// ═══════════════════════════════════════════════════
// 4. Block별 카피 정의
// ═══════════════════════════════════════════════════

export interface BlockCopySet {
  emptyMessage: string;
  unavailableMessage: string;
  loadingMessage: string;
  retryCta: string;
}

export const BLOCK_COPY: Record<ErrorBlockKey, BlockCopySet> = {
  alerts: {
    emptyMessage: "현재 우선 확인이 필요한 운영 경고가 없습니다",
    unavailableMessage: "운영 경고를 불러오지 못했습니다",
    loadingMessage: "운영 경고를 확인하는 중...",
    retryCta: "경고 다시 불러오기",
  },
  workQueue: {
    emptyMessage: "지금 바로 처리할 작업이 없습니다",
    unavailableMessage: "작업 대기 항목을 불러오지 못했습니다",
    loadingMessage: "처리할 작업을 정리하는 중...",
    retryCta: "작업 목록 다시 불러오기",
  },
  approvalInbox: {
    emptyMessage: "현재 승인 대기 요청이 없습니다",
    unavailableMessage: "승인 요청을 불러오지 못했습니다",
    loadingMessage: "승인 대기 항목을 확인하는 중...",
    retryCta: "승인 목록 다시 불러오기",
  },
  activityFeed: {
    emptyMessage: "아직 기록된 운영 활동이 없습니다",
    unavailableMessage: "최근 운영 활동을 불러오지 못했습니다",
    loadingMessage: "최근 활동을 정리하는 중...",
    retryCta: "활동 기록 다시 불러오기",
  },
};

// ═══════════════════════════════════════════════════
// 5. BlockStateProps 생성 헬퍼
// ═══════════════════════════════════════════════════

export function buildBlockStateProps(
  blockKey: ErrorBlockKey,
  uiState: OverviewBlockUiState,
  onRetry?: () => void
): BlockStateProps {
  const copy = BLOCK_COPY[blockKey];
  return {
    uiState,
    blockKey,
    emptyMessage: copy.emptyMessage,
    unavailableMessage: copy.unavailableMessage,
    loadingMessage: copy.loadingMessage,
    retryCta: copy.retryCta,
    onRetry,
  };
}

// ═══════════════════════════════════════════════════
// 6. Page-Level 상태 판정
// ═══════════════════════════════════════════════════

export type PageLevelUiState = "loading" | "normal" | "partial-error" | "critical-error";

/** page-level 상태: currentUser/organization이 없으면 critical, 일부 block 에러면 partial */
export function resolvePageUiState(
  hasCurrentUser: boolean,
  hasOrganization: boolean,
  errorBlocks: ErrorBlockKey[]
): PageLevelUiState {
  if (!hasCurrentUser || !hasOrganization) return "critical-error";
  if (errorBlocks.length > 0) return "partial-error";
  return "normal";
}

// ═══════════════════════════════════════════════════
// 7. Page-Level 카피
// ═══════════════════════════════════════════════════

export const PAGE_COPY = {
  loading: "운영 허브 데이터를 불러오는 중...",
  criticalError: "조직 또는 사용자 정보를 불러오지 못했습니다. 다시 시도해주세요.",
  criticalRetryCta: "페이지 새로고침",
  partialErrorBanner: "일부 운영 데이터를 불러오지 못했습니다. 해당 블록에서 다시 시도할 수 있습니다.",
};

// ═══════════════════════════════════════════════════
// 8. Skeleton 높이 가이드
// ═══════════════════════════════════════════════════

/** 각 블록의 skeleton 최소 높이 (px) — 레이아웃 점프 방지 */
export const BLOCK_SKELETON_HEIGHTS: Record<ErrorBlockKey, number> = {
  alerts: 120,
  workQueue: 200,
  approvalInbox: 160,
  activityFeed: 240,
};

// ═══════════════════════════════════════════════════
// 9. All Blocks 상태 한번에 계산
// ═══════════════════════════════════════════════════

export interface AllBlockStates {
  alerts: BlockStateProps;
  workQueue: BlockStateProps;
  approvalInbox: BlockStateProps;
  activityFeed: BlockStateProps;
  pageState: PageLevelUiState;
}

export function computeAllBlockStates(params: {
  hasCurrentUser: boolean;
  hasOrganization: boolean;
  errorBlocks: ErrorBlockKey[];
  alertsEmpty: boolean;
  workQueueEmpty: boolean;
  approvalEmpty: boolean;
  activityEmpty: boolean;
  alertsLoading?: boolean;
  workQueueLoading?: boolean;
  approvalLoading?: boolean;
  activityLoading?: boolean;
  onRetryAlerts?: () => void;
  onRetryWorkQueue?: () => void;
  onRetryApproval?: () => void;
  onRetryActivity?: () => void;
}): AllBlockStates {
  const eb = params.errorBlocks;

  function blockState(key: ErrorBlockKey, isEmpty: boolean, isLoading?: boolean): OverviewBlockUiState {
    if (eb.includes(key)) return "unavailable";
    if (isLoading) return "loading";
    if (isEmpty) return "empty";
    return "normal";
  }

  return {
    alerts: buildBlockStateProps("alerts", blockState("alerts", params.alertsEmpty, params.alertsLoading), params.onRetryAlerts),
    workQueue: buildBlockStateProps("workQueue", blockState("workQueue", params.workQueueEmpty, params.workQueueLoading), params.onRetryWorkQueue),
    approvalInbox: buildBlockStateProps("approvalInbox", blockState("approvalInbox", params.approvalEmpty, params.approvalLoading), params.onRetryApproval),
    activityFeed: buildBlockStateProps("activityFeed", blockState("activityFeed", params.activityEmpty, params.activityLoading), params.onRetryActivity),
    pageState: resolvePageUiState(params.hasCurrentUser, params.hasOrganization, eb),
  };
}
