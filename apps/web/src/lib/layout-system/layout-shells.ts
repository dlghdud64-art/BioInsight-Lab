/**
 * layout-shells.ts
 *
 * Work Mode별 레이아웃 shell 정의 — CSS grid/flex 구조 + slot 배치.
 *
 * 각 shell은 slot 기반 구성이며, 페이지는 slot에 컨텐츠를 넣는다.
 * shell 자체는 데이터를 모르고, 구조만 제공한다.
 *
 * @module layout-system/layout-shells
 */

import type { WorkMode } from './work-mode-taxonomy';

// ===========================================================================
// 1. Shell Slot 정의
// ===========================================================================

export type ShellSlot =
  | 'header'          // 페이지 타이틀 + 액션 버튼
  | 'summary'         // summary strip / KPI pills
  | 'filter'          // 필터/검색 바
  | 'tabs'            // 상태별 탭
  | 'main'            // 메인 컨텐츠 (큐/테이블/카드)
  | 'rail'            // 우측 rail (detail/action/risk)
  | 'footer'          // 하단 (페이지네이션/bulk action)
  | 'empty'           // empty state
  | 'metric'          // 지표 패널
  | 'chart'           // 차트 영역
  | 'record'          // 기록/폼 영역
  | 'audit';          // 감사/메타 영역

// ===========================================================================
// 2. Shell Template 정의
// ===========================================================================

export interface ShellTemplate {
  mode: WorkMode;
  /** CSS grid template (tailwind class) */
  gridClass: string;
  /** 모바일 fallback (단일 컬럼) */
  mobileClass: string;
  /** slot 배치 순서 */
  slotOrder: ShellSlot[];
  /** rail 포함 여부 */
  hasRail: boolean;
  /** 최소 viewport */
  minViewport: 'mobile' | 'tablet' | 'desktop';
}

// ===========================================================================
// 3. 5가지 Shell Template
// ===========================================================================

export const SHELL_TEMPLATES: Record<WorkMode, ShellTemplate> = {

  // -------------------------------------------------------------------------
  // A. Hub Shell — 세로 스택, 단일 컬럼
  // -------------------------------------------------------------------------
  hub: {
    mode: 'hub',
    gridClass: 'flex flex-col gap-3 md:gap-4 max-w-7xl mx-auto',
    mobileClass: 'flex flex-col gap-3 px-4',
    slotOrder: ['header', 'summary', 'main', 'empty'],
    hasRail: false,
    minViewport: 'mobile',
  },

  // -------------------------------------------------------------------------
  // B. Queue Workbench Shell — 좌측 큐 + 우측 rail
  // -------------------------------------------------------------------------
  queue_workbench: {
    mode: 'queue_workbench',
    gridClass: [
      'flex flex-col gap-3',
      // 데스크톱: main + rail split
      'lg:grid lg:grid-cols-[1fr_380px] lg:gap-4',
    ].join(' '),
    mobileClass: 'flex flex-col gap-3',
    slotOrder: ['header', 'summary', 'filter', 'tabs', 'main', 'rail', 'footer', 'empty'],
    hasRail: true,
    minViewport: 'mobile',
  },

  // -------------------------------------------------------------------------
  // C. Split Ops Shell — 좌측 테이블 + 우측 상세
  // -------------------------------------------------------------------------
  split_ops: {
    mode: 'split_ops',
    gridClass: [
      'flex flex-col gap-3',
      'lg:grid lg:grid-cols-[1fr_360px] lg:gap-4',
    ].join(' '),
    mobileClass: 'flex flex-col gap-3',
    slotOrder: ['header', 'summary', 'filter', 'main', 'rail', 'empty'],
    hasRail: true,
    minViewport: 'mobile',
  },

  // -------------------------------------------------------------------------
  // D. Analysis Console Shell — 세로 스택 (지표 → 차트 → 테이블)
  // -------------------------------------------------------------------------
  analysis_console: {
    mode: 'analysis_console',
    gridClass: 'flex flex-col gap-4 max-w-7xl mx-auto',
    mobileClass: 'flex flex-col gap-3 px-4',
    slotOrder: ['header', 'filter', 'metric', 'chart', 'main', 'empty'],
    hasRail: false,
    minViewport: 'mobile',
  },

  // -------------------------------------------------------------------------
  // E. Record / Policy Shell — 세로 스택 (기록 → 감사)
  // -------------------------------------------------------------------------
  record_policy: {
    mode: 'record_policy',
    gridClass: 'flex flex-col gap-4 max-w-4xl mx-auto',
    mobileClass: 'flex flex-col gap-3 px-4',
    slotOrder: ['header', 'record', 'audit', 'empty'],
    hasRail: false,
    minViewport: 'mobile',
  },
};

// ===========================================================================
// 4. Shell Slot CSS 기본값
// ===========================================================================

export const SLOT_BASE_CLASSES: Record<ShellSlot, string> = {
  header: 'flex items-center justify-between gap-2 min-w-0',
  summary: 'grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3',
  filter: 'flex items-center gap-2 flex-wrap',
  tabs: 'flex items-center gap-1 overflow-x-auto',
  main: 'min-h-0 flex-1',
  rail: 'bg-pn border border-bd rounded-lg overflow-y-auto max-h-[calc(100vh-12rem)] lg:sticky lg:top-4',
  footer: 'flex items-center justify-between gap-2 py-2 border-t border-bd',
  empty: 'rounded-xl bg-el border border-bd border-dashed p-6 text-center',
  metric: 'grid grid-cols-2 md:grid-cols-4 gap-3',
  chart: 'bg-pn border border-bd rounded-lg p-4',
  record: 'bg-pn border border-bd rounded-lg p-4 md:p-6',
  audit: 'bg-el border border-bd rounded-lg p-4 text-xs text-slate-400',
};

// ===========================================================================
// 5. Queue Row 공통 구조
// ===========================================================================

export interface QueueRowSlots {
  /** 우선순위 표시 (dot/badge) */
  priority: boolean;
  /** 상태 chip */
  statusChip: boolean;
  /** 제목 (truncated) */
  title: boolean;
  /** 담당자 */
  owner: boolean;
  /** 차단 요소 */
  blocker: boolean;
  /** 기한/SLA */
  dueState: boolean;
  /** 다음 액션 */
  nextAction: boolean;
  /** 빠른 실행 버튼 */
  quickAction: boolean;
}

export const DEFAULT_QUEUE_ROW_SLOTS: QueueRowSlots = {
  priority: true,
  statusChip: true,
  title: true,
  owner: true,
  blocker: true,
  dueState: true,
  nextAction: true,
  quickAction: true,
};

// ===========================================================================
// 6. Summary Pill 공통 구조
// ===========================================================================

export interface SummaryPillSlots {
  /** 아이콘 */
  icon: boolean;
  /** 라벨 */
  label: boolean;
  /** 수치 */
  value: boolean;
  /** 해석 문구 */
  insight: boolean;
  /** 클릭 시 이동 경로 */
  href: boolean;
  /** 리스크 수준 표시 */
  riskLevel: boolean;
}

export const DEFAULT_SUMMARY_PILL_SLOTS: SummaryPillSlots = {
  icon: true,
  label: true,
  value: true,
  insight: true,
  href: true,
  riskLevel: true,
};
