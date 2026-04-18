/**
 * work-window-system.ts
 *
 * Center Work Window 공통 구조 + Launch / Return / Refresh 규칙.
 *
 * Work window는 "작업 완료"가 목적이다.
 * 읽기 전용 상세 복사본이면 안 된다.
 * 닫고 나왔을 때 부모 큐가 stale 하면 안 된다.
 *
 * @module layout-system/work-window-system
 */

import type { InteractionSurface } from './interaction-surfaces';

// ===========================================================================
// 1. Work Window Slot 구조
// ===========================================================================

export interface WorkWindowSlots {
  /** 타이틀 + 엔티티 요약 (항상) */
  titleBar: true;
  /** 현재 상태 / blocker / owner (항상) */
  contextHeader: true;
  /** 주 작업 영역 (항상) */
  taskBody: true;
  /** 연결된 엔티티 요약 (선택) */
  linkedSummary: boolean;
  /** primary CTA (항상) */
  primaryAction: true;
  /** secondary CTA (선택) */
  secondaryAction: boolean;
  /** close / return 버튼 (항상) */
  closeReturn: true;
  /** refresh hint or auto refresh (항상) */
  refreshHint: true;
}

export const DEFAULT_WORK_WINDOW_SLOTS: WorkWindowSlots = {
  titleBar: true,
  contextHeader: true,
  taskBody: true,
  linkedSummary: true,
  primaryAction: true,
  secondaryAction: true,
  closeReturn: true,
  refreshHint: true,
};

// ===========================================================================
// 2. Work Window State Model
// ===========================================================================

export type WorkWindowPhase =
  | 'idle'           // 열려 있지 않음
  | 'loading'        // 데이터 로딩
  | 'ready'          // 작업 준비 완료
  | 'executing'      // 액션 실행 중
  | 'success'        // 성공 → 닫기 대기
  | 'error'          // 실패 → 재시도/닫기
  | 'conflict';      // stale conflict → recovery

export interface WorkWindowState {
  phase: WorkWindowPhase;
  /** 열린 대상 entity */
  entityType: string | null;
  entityId: string | null;
  /** 실행할 작업 유형 */
  taskType: string | null;
  /** 부모 큐 context */
  parentContext: ParentContext | null;
  /** 성공 후 자동 닫기 딜레이 (ms) */
  autoCloseDelay: number;
}

export interface ParentContext {
  /** 부모 큐 route */
  route: string;
  /** 필터 상태 (URL searchParams) */
  filterState: string;
  /** 스크롤 위치 */
  scrollPosition: number;
  /** 선택된 행 id */
  selectedRowId: string | null;
}

export const INITIAL_WORK_WINDOW_STATE: WorkWindowState = {
  phase: 'idle',
  entityType: null,
  entityId: null,
  taskType: null,
  parentContext: null,
  autoCloseDelay: 1500,
};

// ===========================================================================
// 3. Launch Rules — 어떤 상호작용이 어떤 surface를 여는가
// ===========================================================================

export type LaunchTrigger =
  | 'row_click'
  | 'row_primary_cta'
  | 'row_quick_action'
  | 'header_cta'
  | 'rail_escalate'
  | 'rail_deep_link';

export interface LaunchRule {
  trigger: LaunchTrigger;
  description: string;
  /** 어떤 surface를 여는가 */
  targetSurface: InteractionSurface;
  /** 예외 조건 */
  exception?: string;
}

export const LAUNCH_RULES: LaunchRule[] = [
  // Row click → Right Rail (quick inspect)
  {
    trigger: 'row_click',
    description: '큐 행 클릭 → 우측 rail에 요약/상태 표시',
    targetSurface: 'right_rail',
  },

  // Row primary CTA → Work Window (focused action)
  {
    trigger: 'row_primary_cta',
    description: '행의 주요 CTA 클릭 → 중앙 작업창에서 focused 작업',
    targetSurface: 'center_work_window',
    exception: 'linked deep context 필요 시 → full detail',
  },

  // Row quick action → Inline or Rail
  {
    trigger: 'row_quick_action',
    description: '행의 빠른 액션 (상태 변경, 담당자 지정) → inline 또는 rail',
    targetSurface: 'right_rail',
  },

  // Header CTA → Work Window
  {
    trigger: 'header_cta',
    description: '페이지 상단 주요 CTA → 중앙 작업창',
    targetSurface: 'center_work_window',
  },

  // Rail escalate → Work Window
  {
    trigger: 'rail_escalate',
    description: 'rail에서 "상세 작업" 또는 high-risk action → 중앙 작업창 승격',
    targetSurface: 'center_work_window',
  },

  // Rail deep link → Full Detail
  {
    trigger: 'rail_deep_link',
    description: 'rail에서 "전체 보기" 또는 deep context → full detail 이동',
    targetSurface: 'full_detail_console',
  },
];

// ===========================================================================
// 4. Complexity → Surface 매핑
// ===========================================================================

export type ActionComplexity =
  | 'trivial'        // 1-click (상태 변경, 확인)
  | 'low'            // 단순 입력 1-2개
  | 'medium'         // 검토 + 판단 + 실행
  | 'high'           // multi-step, multi-entity
  | 'deep';          // 긴 문맥, 감사, 분석

export const COMPLEXITY_SURFACE_MAP: Record<ActionComplexity, InteractionSurface> = {
  trivial: 'right_rail',
  low: 'right_rail',
  medium: 'center_work_window',
  high: 'center_work_window',
  deep: 'full_detail_console',
};

// ===========================================================================
// 5. 작업별 Surface 매핑표
// ===========================================================================

export interface TaskSurfaceMapping {
  task: string;
  surface: InteractionSurface;
  complexity: ActionComplexity;
  reason: string;
}

export const TASK_SURFACE_MAPPINGS: TaskSurfaceMapping[] = [
  // ── 견적 ──
  {
    task: '견적 비교/공급사 선택',
    surface: 'center_work_window',
    complexity: 'medium',
    reason: '비교 데이터 확인 + 선택 판단 + 승인',
  },

  // ── 발주 ──
  {
    task: 'PO 발행 확인',
    surface: 'center_work_window',
    complexity: 'medium',
    reason: '발행 전 최종 검토 + 승인 실행',
  },
  {
    task: '공급사 ack review',
    surface: 'center_work_window',
    complexity: 'medium',
    reason: '응답 확인 + 수락/거절 판단',
  },

  // ── 입고 ──
  {
    task: '입고 검수 완료',
    surface: 'center_work_window',
    complexity: 'medium',
    reason: '검수 결과 입력 + 합격/불합격 판정',
  },
  {
    task: 'lot/expiry/doc 입력',
    surface: 'center_work_window',
    complexity: 'low',
    reason: '구조화된 데이터 입력 (3-5 필드)',
  },
  {
    task: 'partial posting 확인',
    surface: 'center_work_window',
    complexity: 'medium',
    reason: '부분 반영 검토 + 실행',
  },

  // ── 재고 ──
  {
    task: 'reorder quote create review',
    surface: 'center_work_window',
    complexity: 'medium',
    reason: '재주문 조건 검토 + 견적 생성 실행',
  },

  // ── 안전 ──
  {
    task: 'safety issue quick action',
    surface: 'right_rail',
    complexity: 'low',
    reason: '단순 조치 확인 + 상태 변경',
  },

  // ── 공통 ──
  {
    task: 'owner reassignment',
    surface: 'right_rail',
    complexity: 'trivial',
    reason: '드롭다운 선택 1개',
  },
  {
    task: 'escalation 실행',
    surface: 'center_work_window',
    complexity: 'medium',
    reason: '에스컬레이션 사유 + 대상 선택 + 실행',
  },
  {
    task: 'blocker resolve (단일)',
    surface: 'center_work_window',
    complexity: 'medium',
    reason: '차단 해소 방법 선택 + 실행',
  },
  {
    task: 'blocker resolve (복합)',
    surface: 'full_detail_console',
    complexity: 'deep',
    reason: '다수 차단 요소 + linked entity 참조 필요',
  },
  {
    task: '감사 이력 전체 조회',
    surface: 'full_detail_console',
    complexity: 'deep',
    reason: '긴 타임라인 + 상세 diff 필요',
  },
];

// ===========================================================================
// 6. Return / Refresh Rules
// ===========================================================================

export interface ReturnRule {
  surface: InteractionSurface;
  rule: string;
}

export const RETURN_RULES: ReturnRule[] = [
  // Right Rail
  {
    surface: 'right_rail',
    rule: '닫기 → 큐 행 선택 해제. filter/scroll 유지. 행 상태만 즉시 갱신.',
  },

  // Center Work Window
  {
    surface: 'center_work_window',
    rule: '성공 → 1.5초 후 자동 닫기 → 부모 큐의 해당 행 optimistic 갱신 → 서버 확인 후 반영. filter/scroll/context 유지.',
  },
  {
    surface: 'center_work_window',
    rule: '실패 → 에러 표시 + 재시도 버튼. 닫기 시 부모 큐 변경 없음.',
  },
  {
    surface: 'center_work_window',
    rule: 'stale conflict → 최신 상태 표시 + "최신 상태로 갱신" 버튼 → 부모 큐도 갱신.',
  },
  {
    surface: 'center_work_window',
    rule: '취소/닫기 → 부모 큐 그대로 유지. 변경 사항 없음.',
  },

  // Full Detail Console
  {
    surface: 'full_detail_console',
    rule: 'navigate back → 부모 큐로 복귀 + staleTime 초과 시 자동 refetch. URL searchParams에서 filter/scroll 복원.',
  },
];

export interface RefreshRule {
  trigger: string;
  scope: string;
  description: string;
}

export const REFRESH_RULES: RefreshRule[] = [
  {
    trigger: 'work_window_action_success',
    scope: 'parent_row + summary_strip',
    description: '작업창 액션 성공 → 해당 행 + 상단 summary 즉시 갱신',
  },
  {
    trigger: 'work_window_close',
    scope: 'filter + scroll + context',
    description: '작업창 닫기 → 필터/스크롤/context 유지',
  },
  {
    trigger: 'full_detail_navigate_back',
    scope: 'queue_list (if stale)',
    description: 'full detail 복귀 → staleTime 초과 시만 큐 refetch',
  },
  {
    trigger: 'stale_conflict_detected',
    scope: 'entity + parent_row',
    description: 'conflict 발견 → 최신 상태로 entity + 부모 행 갱신',
  },
  {
    trigger: 'rail_action_success',
    scope: 'selected_row',
    description: 'rail 액션 성공 → 선택된 행만 즉시 갱신',
  },
];

// ===========================================================================
// 7. Work Window CSS / Layout 기본값
// ===========================================================================

export const WORK_WINDOW_LAYOUT = {
  /** overlay backdrop */
  backdrop: 'fixed inset-0 z-50 bg-black/60 flex items-center justify-center',
  /** window container */
  container: 'bg-pn border border-bd rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col',
  /** title bar */
  titleBar: 'flex items-center justify-between px-5 py-3 border-b border-bd bg-el',
  /** context header */
  contextHeader: 'px-5 py-3 bg-pn border-b border-bd/50',
  /** task body */
  taskBody: 'flex-1 overflow-y-auto px-5 py-4',
  /** linked summary */
  linkedSummary: 'px-5 py-2 bg-el/50 border-t border-bd/50 text-xs text-slate-400',
  /** action footer */
  actionFooter: 'flex items-center justify-end gap-2 px-5 py-3 border-t border-bd bg-el',
  /** success overlay */
  successOverlay: 'absolute inset-0 flex items-center justify-center bg-pn/95',
} as const;

// ===========================================================================
// 8. Priority Deployment — 우선 적용 대상 5개
// ===========================================================================

export interface PriorityTarget {
  id: string;
  task: string;
  surface: InteractionSurface;
  parentScreen: string;
  reason: string;
  priority: 1 | 2 | 3 | 4 | 5;
}

export const PRIORITY_TARGETS: PriorityTarget[] = [
  {
    id: 'quote-vendor-select',
    task: '견적 비교/공급사 선택',
    surface: 'center_work_window',
    parentScreen: '/dashboard/quotes',
    reason: '가장 빈번한 의사결정 + 현재 full page 이동 필요',
    priority: 1,
  },
  {
    id: 'po-issue-confirm',
    task: 'PO 발행 확인',
    surface: 'center_work_window',
    parentScreen: '/dashboard/purchase-orders',
    reason: 'high-value 액션 + 발행 전 최종 검토 필수',
    priority: 2,
  },
  {
    id: 'receiving-inspection',
    task: '입고 검수 완료 + lot 입력',
    surface: 'center_work_window',
    parentScreen: '/dashboard/receiving',
    reason: '입고 큐에서 바로 처리 가능해야 함',
    priority: 3,
  },
  {
    id: 'owner-reassign',
    task: 'owner reassignment',
    surface: 'right_rail',
    parentScreen: '모든 큐 화면',
    reason: '가장 단순하고 빈번한 관리 액션',
    priority: 4,
  },
  {
    id: 'blocker-resolve',
    task: 'blocker resolve (단일)',
    surface: 'center_work_window',
    parentScreen: '모든 큐 화면',
    reason: '차단 해소가 운영 흐름 복구의 핵심',
    priority: 5,
  },
];
