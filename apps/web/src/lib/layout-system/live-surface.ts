/**
 * live-surface.ts
 *
 * Live Operations Surface — freshness-aware 실시간 운영면 정의.
 *
 * 전면 websocket 전제 없이, row/rail/queue 수준 부분 갱신으로
 * 실시간처럼 느껴지는 운영 표면을 제공한다.
 * stale 상태를 숨기지 않고 명시적으로 표현한다.
 *
 * @module layout-system/live-surface
 */

// ===========================================================================
// 1. Freshness Model
// ===========================================================================

export type FreshnessLevel =
  | 'fresh'          // < 30초 이내
  | 'recent'         // < 2분 이내
  | 'aging'          // < 5분 이내
  | 'stale'          // > 5분
  | 'unknown';       // 갱신 시각 불명

export interface FreshnessState {
  level: FreshnessLevel;
  lastUpdatedAt: string | null;
  /** 마지막 갱신으로부터 경과 초 */
  elapsedSeconds: number | null;
  /** 자동 갱신 예정 시각 */
  nextRefreshAt: string | null;
  /** 갱신 진행 중 */
  isRefreshing: boolean;
}

// ===========================================================================
// 2. Freshness 판정 규칙
// ===========================================================================

export function classifyFreshness(elapsedMs: number | null): FreshnessLevel {
  if (elapsedMs === null) return 'unknown';
  if (elapsedMs < 30_000) return 'fresh';
  if (elapsedMs < 120_000) return 'recent';
  if (elapsedMs < 300_000) return 'aging';
  return 'stale';
}

// ===========================================================================
// 3. Freshness Display
// ===========================================================================

export interface FreshnessDisplay {
  label: string;
  color: string;
  showBadge: boolean;
  showTimestamp: boolean;
}

export function getFreshnessDisplay(level: FreshnessLevel): FreshnessDisplay {
  switch (level) {
    case 'fresh':
      return {
        label: '최신',
        color: 'text-emerald-400',
        showBadge: false,
        showTimestamp: false,
      };
    case 'recent':
      return {
        label: '최근 갱신',
        color: 'text-slate-400',
        showBadge: false,
        showTimestamp: true,
      };
    case 'aging':
      return {
        label: '갱신 필요',
        color: 'text-amber-400',
        showBadge: true,
        showTimestamp: true,
      };
    case 'stale':
      return {
        label: '오래됨',
        color: 'text-red-400',
        showBadge: true,
        showTimestamp: true,
      };
    case 'unknown':
      return {
        label: '확인 불가',
        color: 'text-slate-500',
        showBadge: true,
        showTimestamp: false,
      };
  }
}

// ===========================================================================
// 4. Auto Refresh Cadence
// ===========================================================================

export interface RefreshCadence {
  /** 자동 갱신 간격 (ms) */
  intervalMs: number;
  /** 포커스 복귀 시 갱신 */
  onFocus: boolean;
  /** visibility 복귀 시 갱신 */
  onVisibilityChange: boolean;
  /** 수동 갱신 허용 */
  manualRefresh: boolean;
}

export const REFRESH_CADENCE_BY_MODE: Record<string, RefreshCadence> = {
  hub: {
    intervalMs: 5 * 60 * 1000,   // 5분
    onFocus: true,
    onVisibilityChange: true,
    manualRefresh: true,
  },
  queue_workbench: {
    intervalMs: 2 * 60 * 1000,   // 2분
    onFocus: true,
    onVisibilityChange: true,
    manualRefresh: true,
  },
  split_ops: {
    intervalMs: 3 * 60 * 1000,   // 3분
    onFocus: true,
    onVisibilityChange: true,
    manualRefresh: true,
  },
  analysis_console: {
    intervalMs: 10 * 60 * 1000,  // 10분
    onFocus: false,
    onVisibilityChange: false,
    manualRefresh: true,
  },
  record_policy: {
    intervalMs: 0,               // 자동 갱신 없음
    onFocus: false,
    onVisibilityChange: false,
    manualRefresh: true,
  },
};

// ===========================================================================
// 5. Live Update Scope
// ===========================================================================

export type LiveUpdateScope =
  | 'full_page'        // 전체 페이지 refetch
  | 'queue_list'       // 큐/리스트만 갱신
  | 'selected_rail'    // 선택된 rail만 갱신
  | 'row_status'       // 개별 행 상태만 갱신
  | 'summary_strip'    // 상단 summary만 갱신
  | 'downstream_handoff'; // downstream 핸드오프 정보만 갱신

export interface LiveUpdateRule {
  trigger: string;
  scope: LiveUpdateScope;
  description: string;
}

export const LIVE_UPDATE_RULES: LiveUpdateRule[] = [
  {
    trigger: 'auto_refresh_interval',
    scope: 'queue_list',
    description: '자동 갱신 주기 도달 시 큐/리스트만 부분 갱신',
  },
  {
    trigger: 'focus_return',
    scope: 'summary_strip',
    description: '탭/윈도우 복귀 시 상단 summary만 갱신',
  },
  {
    trigger: 'mutation_success',
    scope: 'selected_rail',
    description: '액션 실행 성공 시 선택된 rail + 해당 행 갱신',
  },
  {
    trigger: 'mutation_success',
    scope: 'row_status',
    description: '액션 실행 성공 시 해당 행 상태 chip 갱신',
  },
  {
    trigger: 'handoff_complete',
    scope: 'downstream_handoff',
    description: '핸드오프 완료 시 downstream 정보 갱신',
  },
  {
    trigger: 'manual_refresh',
    scope: 'full_page',
    description: '수동 새로고침 시 전체 페이지 refetch',
  },
];

// ===========================================================================
// 6. Stale Warning Rules
// ===========================================================================

export interface StaleWarning {
  level: FreshnessLevel;
  action: 'none' | 'badge' | 'banner' | 'block';
  message?: string;
}

export const STALE_WARNING_RULES: StaleWarning[] = [
  { level: 'fresh', action: 'none' },
  { level: 'recent', action: 'none' },
  {
    level: 'aging',
    action: 'badge',
    message: '데이터가 오래될 수 있습니다. 새로고침을 권장합니다.',
  },
  {
    level: 'stale',
    action: 'banner',
    message: '표시된 데이터가 오래되었습니다. 새로고침하세요.',
  },
  {
    level: 'unknown',
    action: 'badge',
    message: '갱신 시각을 확인할 수 없습니다.',
  },
];
