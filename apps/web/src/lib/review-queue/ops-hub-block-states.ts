/**
 * Organization Overview Hub — Block-Level State Contract
 *
 * 모든 Block 컴포넌트가 따르는 상태 계약.
 * container가 판정하고, block은 state + data만 받아 렌더한다.
 *
 * 금지:
 * - state 없이 조건 분기
 * - data && ... 형태 렌더링
 * - loading + 기존 데이터 동시 노출
 * - error인데 기존 데이터 fallback
 * - empty를 단순 "데이터 없음" 텍스트로 처리
 */

import type { OverviewSourceState } from "./ops-hub-adapters";
import type { ErrorBlockKey } from "./ops-hub-view-models";

// ═══════════════════════════════════════════════════
// 1. Block State Enum (5단계)
// ═══════════════════════════════════════════════════

export type BlockState =
  | "loading"     // 데이터를 불러오는 중
  | "ready"       // 데이터 정상 수신, 렌더 가능
  | "empty"       // 정상 수신했지만 데이터 없음
  | "error"       // 불러오기 실패, retry 가능
  | "unavailable"; // 기능 비활성화 또는 접근 불가

// ═══════════════════════════════════════════════════
// 2. Block Props Contract (제네릭)
// ═══════════════════════════════════════════════════

export interface BlockProps<T> {
  state: BlockState;
  data?: T;                 // ready 상태에서만 사용
  error?: {
    message?: string;
    code?: string;
  };
  isRetryable?: boolean;    // error 상태에서만 의미 있음
  onRetry?: () => void;
  isDisabled?: boolean;     // unavailable 상태 제어
}

// ═══════════════════════════════════════════════════
// 3. Block State 판정 함수
// ═══════════════════════════════════════════════════

/** source 상태 + errorBlocks → block state 판정 */
export function resolveBlockState(
  source: OverviewSourceState<unknown>,
  errorBlocks: ErrorBlockKey[],
  blockKey: ErrorBlockKey,
  isDisabled?: boolean
): BlockState {
  if (isDisabled) return "unavailable";
  if (errorBlocks.includes(blockKey)) return "error";
  if (source.isError) return "error";
  if (source.isLoading) return "loading";
  if (source.isEmpty) return "empty";
  return "ready";
}

/** 여러 source에 의존하는 블록용 (alerts, workQueue 등) */
export function resolveCompositeBlockState(
  sources: OverviewSourceState<unknown>[],
  errorBlocks: ErrorBlockKey[],
  blockKey: ErrorBlockKey,
  dataIsEmpty: boolean,
  isDisabled?: boolean
): BlockState {
  if (isDisabled) return "unavailable";
  if (errorBlocks.includes(blockKey)) return "error";
  if (sources.some((s) => s.isError)) return "error";
  if (sources.some((s) => s.isLoading)) return "loading";
  if (dataIsEmpty) return "empty";
  return "ready";
}

// ═══════════════════════════════════════════════════
// 4. BlockProps 생성 헬퍼
// ═══════════════════════════════════════════════════

/** 단일 source → BlockProps 생성 */
export function buildBlockProps<T>(
  source: OverviewSourceState<T>,
  errorBlocks: ErrorBlockKey[],
  blockKey: ErrorBlockKey,
  opts?: {
    onRetry?: () => void;
    isDisabled?: boolean;
  }
): BlockProps<T> {
  const state = resolveBlockState(source, errorBlocks, blockKey, opts?.isDisabled);
  return {
    state,
    data: state === "ready" ? source.data : undefined,
    error: state === "error" ? { message: String(source.error ?? "데이터를 불러오지 못했습니다") } : undefined,
    isRetryable: state === "error",
    onRetry: state === "error" ? opts?.onRetry : undefined,
    isDisabled: opts?.isDisabled,
  };
}

/** composite source → BlockProps 생성 */
export function buildCompositeBlockProps<T>(
  sources: OverviewSourceState<unknown>[],
  errorBlocks: ErrorBlockKey[],
  blockKey: ErrorBlockKey,
  data: T,
  dataIsEmpty: boolean,
  opts?: {
    onRetry?: () => void;
    isDisabled?: boolean;
  }
): BlockProps<T> {
  const state = resolveCompositeBlockState(sources, errorBlocks, blockKey, dataIsEmpty, opts?.isDisabled);
  const failedSource = sources.find((s) => s.isError);
  return {
    state,
    data: state === "ready" ? data : undefined,
    error: state === "error" ? { message: String(failedSource?.error ?? "데이터를 불러오지 못했습니다") } : undefined,
    isRetryable: state === "error",
    onRetry: state === "error" ? opts?.onRetry : undefined,
    isDisabled: opts?.isDisabled,
  };
}

// ═══════════════════════════════════════════════════
// 5. Block State Renderer (switch 기반)
// ═══════════════════════════════════════════════════

/**
 * Block 컴포넌트 내부에서 사용하는 상태별 렌더 타입.
 *
 * 사용 예:
 * ```tsx
 * function MyBlock(props: BlockProps<MyData>) {
 *   return renderBlockState(props, {
 *     loading: () => <BlockSkeleton />,
 *     error: (err, onRetry) => <ErrorState message={err?.message} onRetry={onRetry} />,
 *     empty: () => <EmptyState />,
 *     unavailable: () => <UnavailableState />,
 *     ready: (data) => <ActualContent data={data} />,
 *   });
 * }
 * ```
 */
export interface BlockStateRenderers<T> {
  loading: () => React.ReactNode;
  ready: (data: T) => React.ReactNode;
  empty: () => React.ReactNode;
  error: (error?: { message?: string; code?: string }, onRetry?: () => void) => React.ReactNode;
  unavailable: () => React.ReactNode;
}

export function renderBlockState<T>(
  props: BlockProps<T>,
  renderers: BlockStateRenderers<T>
): React.ReactNode {
  switch (props.state) {
    case "loading":
      return renderers.loading();
    case "error":
      return renderers.error(props.error, props.isRetryable ? props.onRetry : undefined);
    case "empty":
      return renderers.empty();
    case "unavailable":
      return renderers.unavailable();
    case "ready":
      return renderers.ready(props.data as T);
  }
}

// ═══════════════════════════════════════════════════
// 6. Block-Level Copy (블록별 상태 메시지)
// ═══════════════════════════════════════════════════

export const BLOCK_COPY = {
  alerts: {
    loading: "운영 경고를 확인하는 중...",
    empty: "현재 우선 확인이 필요한 운영 경고가 없습니다",
    emptyDescription: "예산, 재고, 승인 관련 경고가 발생하면 여기에 표시됩니다.",
    error: "운영 경고를 불러오지 못했습니다",
    errorDescription: "네트워크 상태를 확인하고 다시 시도해주세요.",
    unavailable: "운영 경고 기능을 사용할 수 없습니다",
    unavailableDescription: "이 기능은 Business 플랜 이상에서 제공됩니다.",
    retryCta: "경고 다시 불러오기",
  },
  workQueue: {
    loading: "처리할 작업을 정리하는 중...",
    empty: "지금 바로 처리할 작업이 없습니다",
    emptyDescription: "검토 큐에 항목이 추가되면 처리할 작업이 여기에 표시됩니다.",
    emptyCta: "Step 1 검토 큐 열기",
    error: "작업 대기 항목을 불러오지 못했습니다",
    errorDescription: "잠시 후 다시 시도하거나 새로고침해주세요.",
    unavailable: "작업 큐 기능을 사용할 수 없습니다",
    unavailableDescription: "팀 운영 기능은 Team 플랜 이상에서 사용할 수 있습니다.",
    retryCta: "작업 큐 다시 불러오기",
  },
  approvalInbox: {
    loading: "승인 요청을 확인하는 중...",
    empty: "현재 승인 대기 요청이 없습니다",
    emptyDescription: "견적 제출이나 예산 검토에서 승인이 필요하면 여기에 표시됩니다.",
    error: "승인 요청을 불러오지 못했습니다",
    errorDescription: "네트워크 상태를 확인하고 다시 시도해주세요.",
    unavailable: "승인 워크플로우를 사용할 수 없습니다",
    unavailableDescription: "팀 승인 기능은 Business 플랜 이상에서 사용할 수 있습니다.",
    unavailableCta: "플랜 업그레이드",
    retryCta: "승인 요청 다시 불러오기",
  },
  activityFeed: {
    loading: "최근 운영 활동을 불러오는 중...",
    empty: "아직 기록된 운영 활동이 없습니다",
    emptyDescription: "검토, 비교, 제출, 승인 작업을 시작하면 활동 이력이 여기에 기록됩니다.",
    emptyCta: "Step 1 시작하기",
    error: "최근 운영 활동을 불러오지 못했습니다",
    errorDescription: "잠시 후 다시 시도해주세요.",
    unavailable: "활동 피드 기능을 사용할 수 없습니다",
    unavailableDescription: "이 기능은 Team 플랜 이상에서 제공됩니다.",
    retryCta: "활동 다시 불러오기",
  },
} as const;

/** 도메인별 상태 카피 세트 (재사용 가능) */
export const DOMAIN_COPY = {
  inventory: {
    empty: { title: "등록된 재고가 없습니다", description: "입고된 시약과 장비를 등록하면 lot, 유효기간, 부족 수량을 함께 관리할 수 있습니다.", cta: "재고 등록 시작하기" },
    error: { title: "재고 데이터를 불러오지 못했습니다", description: "잠시 후 다시 시도해주세요.", cta: "다시 불러오기" },
    unavailable: { title: "재고 관리 기능을 사용할 수 없습니다", description: "조직에 참여하면 팀 재고를 함께 관리할 수 있습니다.", cta: "조직 설정 보기" },
  },
  quote: {
    empty: { title: "진행 중인 견적이 없습니다", description: "비교 확정된 항목을 견적 초안으로 보내면 공급사에 견적을 요청할 수 있습니다.", cta: "검토 큐에서 시작하기" },
    error: { title: "견적 데이터를 불러오지 못했습니다", description: "네트워크 상태를 확인하고 다시 시도해주세요.", cta: "다시 불러오기" },
    unavailable: { title: "견적 기능을 사용할 수 없습니다", description: "현재 권한으로는 견적 요청에 접근할 수 없습니다.", cta: "권한 요청하기" },
  },
  search: {
    empty: { title: "검색 결과가 없습니다", description: "다른 키워드로 검색하거나 필터를 조정해보세요.", cta: "검색 다시 시도" },
    filterEmpty: { title: "현재 필터에 해당하는 항목이 없습니다", description: "필터 조건을 변경하면 더 많은 결과를 볼 수 있습니다.", cta: "필터 초기화" },
    error: { title: "검색 결과를 불러오지 못했습니다", description: "잠시 후 다시 시도해주세요.", cta: "다시 검색" },
  },
  budget: {
    empty: { title: "등록된 예산이 없습니다", description: "팀 또는 프로젝트 예산을 생성하면 지출을 추적하고 초과를 방지할 수 있습니다.", cta: "예산안 만들기" },
    error: { title: "예산 데이터를 불러오지 못했습니다", description: "잠시 후 다시 시도해주세요.", cta: "다시 불러오기" },
    unavailable: { title: "예산 관리 기능을 사용할 수 없습니다", description: "예산 통합 관리는 Business 플랜 이상에서 제공됩니다.", cta: "플랜 업그레이드" },
  },
  approval: {
    empty: { title: "현재 승인 대기 요청이 없습니다", description: "견적 제출이나 예산 검토에서 승인이 필요하면 여기에 표시됩니다." },
    error: { title: "승인 요청을 불러오지 못했습니다", description: "네트워크 상태를 확인하고 다시 시도해주세요.", cta: "다시 불러오기" },
    unavailable: { title: "승인 워크플로우를 사용할 수 없습니다", description: "팀 승인 기능은 Business 플랜 이상에서 사용할 수 있습니다.", cta: "플랜 업그레이드" },
  },
} as const;

/** 페이지 레벨 카피 */
export const PAGE_COPY = {
  partialErrorBanner: "일부 운영 데이터를 불러오지 못했습니다. 해당 영역에서 다시 시도할 수 있습니다.",
  fullEmptyTitle: "아직 운영 작업이 시작되지 않았습니다",
  fullEmptyDescription: "직접 검색 또는 업로드 해석으로 검토 큐를 만들면 비교와 견적 작업이 이어집니다",
  fullEmptyCta: "Step 1 시작하기",
} as const;

/** 블록 skeleton 최소 높이 (레이아웃 점프 방지) */
export const BLOCK_SKELETON_HEIGHTS = {
  alerts: 100,
  workQueue: 200,
  approvalInbox: 160,
  activityFeed: 180,
} as const;
