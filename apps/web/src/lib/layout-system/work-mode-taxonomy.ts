/**
 * work-mode-taxonomy.ts
 *
 * 작업 방식 기반 레이아웃 분류 체계.
 *
 * page-per-feature 방식 대신, 사용자의 작업 모드(work mode)에 따라
 * 레이아웃을 선택한다. 동일한 작업 모드를 쓰는 화면은 동일한
 * 레이아웃 문법/밀도/pane 구조를 공유한다.
 *
 * @module layout-system/work-mode-taxonomy
 */

// ===========================================================================
// 1. Work Mode 정의
// ===========================================================================

export type WorkMode =
  | 'hub'
  | 'queue_workbench'
  | 'split_ops'
  | 'analysis_console'
  | 'record_policy';

export interface WorkModeDefinition {
  mode: WorkMode;
  label: string;
  description: string;
  /** 적합한 화면 목록 */
  targetScreens: string[];
  /** 정보 밀도 */
  density: 'compact' | 'standard' | 'dense';
  /** 주 작업 방식 */
  primaryAction: string;
  /** pane 구조 */
  paneStructure: PaneStructure;
  /** right rail 필요 여부 */
  rightRail: boolean;
  /** live status indicator 필요 여부 */
  liveStatus: boolean;
}

export interface PaneStructure {
  /** 주요 영역 수 */
  paneCount: 1 | 2 | 3;
  /** 레이아웃 방향 */
  direction: 'vertical' | 'horizontal' | 'hybrid';
  /** 각 pane 역할 */
  panes: PaneRole[];
}

export type PaneRole =
  | 'summary_strip'
  | 'filter_bar'
  | 'main_queue'
  | 'main_table'
  | 'main_content'
  | 'detail_rail'
  | 'action_rail'
  | 'metric_panel'
  | 'chart_area'
  | 'record_form'
  | 'audit_area';

// ===========================================================================
// 2. 5가지 Work Mode Layout 정의
// ===========================================================================

export const WORK_MODE_DEFINITIONS: Record<WorkMode, WorkModeDefinition> = {

  // -------------------------------------------------------------------------
  // A. Hub Layout — 운영 허브, 진입점, 전체 현황 조망
  // -------------------------------------------------------------------------
  hub: {
    mode: 'hub',
    label: 'Hub Layout',
    description: '운영 전체 현황 조망 + 긴급 항목 진입 + KPI 해석 + 빠른 실행',
    targetScreens: [
      '/dashboard',                    // 홈 대시보드
    ],
    density: 'standard',
    primaryAction: '현황 파악 → 긴급 항목 drill-down → 빠른 실행',
    paneStructure: {
      paneCount: 1,
      direction: 'vertical',
      panes: ['summary_strip', 'main_content'],
    },
    rightRail: false,
    liveStatus: true,
  },

  // -------------------------------------------------------------------------
  // B. Queue Workbench Layout — 처리 큐 중심 작업
  // -------------------------------------------------------------------------
  queue_workbench: {
    mode: 'queue_workbench',
    label: 'Queue Workbench',
    description: '처리 대기 항목 큐 + 필터/정렬 + 행 선택 → 우측 상세/액션',
    targetScreens: [
      '/dashboard/quotes',             // 견적 운영 큐
      '/dashboard/purchases',          // 구매 운영
      '/dashboard/purchase-orders',    // 발주 관리
      '/dashboard/receiving',          // 입고 처리 큐
      '/dashboard/safety',             // 안전 이슈 처리 큐
    ],
    density: 'dense',
    primaryAction: '큐 항목 선택 → 상세 확인 → 즉시 조치 → 다음 항목',
    paneStructure: {
      paneCount: 2,
      direction: 'horizontal',
      panes: ['summary_strip', 'filter_bar', 'main_queue', 'detail_rail'],
    },
    rightRail: true,
    liveStatus: true,
  },

  // -------------------------------------------------------------------------
  // C. Split Ops Layout — 목록 + 선택 상세 동시 작업
  // -------------------------------------------------------------------------
  split_ops: {
    mode: 'split_ops',
    label: 'Split Ops Layout',
    description: '좌측 목록/테이블 + 우측 선택 항목 상세 + context action',
    targetScreens: [
      '/dashboard/inventory',          // 재고 관리
      '/dashboard/stock-risk',         // 재고 위험
      '/search',                 // 견적 비교
    ],
    density: 'dense',
    primaryAction: '목록 탐색 → 항목 선택 → 상세 확인 → 조치 실행',
    paneStructure: {
      paneCount: 2,
      direction: 'horizontal',
      panes: ['main_table', 'detail_rail', 'action_rail'],
    },
    rightRail: true,
    liveStatus: true,
  },

  // -------------------------------------------------------------------------
  // D. Analysis Console Layout — 데이터 분석 + 인사이트 + 조치 연결
  // -------------------------------------------------------------------------
  analysis_console: {
    mode: 'analysis_console',
    label: 'Analysis Console',
    description: '필터 + 핵심 지표 + 해석 블록 + 예외/리스크 + 원본 테이블',
    targetScreens: [
      '/dashboard/analytics',          // 지출 분석
      '/dashboard/reports',            // 구매 리포트
      '/dashboard/budget',             // 예산 관리
    ],
    density: 'standard',
    primaryAction: '조건 설정 → 지표 확인 → 해석 읽기 → 예외 drill-down → 조치',
    paneStructure: {
      paneCount: 1,
      direction: 'vertical',
      panes: ['filter_bar', 'metric_panel', 'chart_area', 'main_table'],
    },
    rightRail: false,
    liveStatus: false,
  },

  // -------------------------------------------------------------------------
  // E. Record / Policy Layout — 설정/정책/기록 관리
  // -------------------------------------------------------------------------
  record_policy: {
    mode: 'record_policy',
    label: 'Record / Policy Layout',
    description: '기록 상세 + 변경 액션 + 감사/메타 + 정책 효과 요약',
    targetScreens: [
      '/dashboard/settings',           // 설정
      '/dashboard/organizations',      // 조직 관리
      '/dashboard/activity-logs',      // 활동 로그
      '/dashboard/audit',              // 감사 증적
    ],
    density: 'compact',
    primaryAction: '기록 확인 → 변경 실행 → 감사 이력 확인',
    paneStructure: {
      paneCount: 1,
      direction: 'vertical',
      panes: ['record_form', 'audit_area'],
    },
    rightRail: false,
    liveStatus: false,
  },
};

// ===========================================================================
// 3. 현재 화면 → Work Mode 매핑
// ===========================================================================

export interface ScreenMapping {
  route: string;
  label: string;
  workMode: WorkMode;
  currentPattern: string;
  gap: string;
}

export const SCREEN_MAPPINGS: ScreenMapping[] = [
  // Hub
  {
    route: '/dashboard',
    label: '홈 대시보드',
    workMode: 'hub',
    currentPattern: 'KPI 카드 + 우선 처리 strip + 추천 작업 + 최근 구매',
    gap: 'live freshness 미반영, drill-down 경로 약함',
  },

  // Queue Workbench
  {
    route: '/dashboard/quotes',
    label: '견적 관리',
    workMode: 'queue_workbench',
    currentPattern: 'summary strip + 상태별 카드 그룹 + 카드 액션',
    gap: 'detail rail 없음, 카드→테이블 전환 필요',
  },
  {
    route: '/dashboard/purchases',
    label: '구매 운영',
    workMode: 'queue_workbench',
    currentPattern: 'summary KPI + 탭 필터 + 카드 리스트',
    gap: 'detail rail 없음, 행 수준 quick action 약함',
  },
  {
    route: '/dashboard/purchase-orders',
    label: '발주 관리',
    workMode: 'queue_workbench',
    currentPattern: 'module hub + priority grid + state tabs + actionable queue',
    gap: 'detail rail 없음 (hub 패턴 강함)',
  },
  {
    route: '/dashboard/receiving',
    label: '입고 처리',
    workMode: 'queue_workbench',
    currentPattern: 'module hub + priority grid + state tabs + actionable queue',
    gap: 'detail rail 없음',
  },

  // Split Ops
  {
    route: '/dashboard/inventory',
    label: '재고 관리',
    workMode: 'split_ops',
    currentPattern: 'dynamic component (split pane 추정)',
    gap: '확인 필요',
  },
  {
    route: '/dashboard/stock-risk',
    label: '재고 위험',
    workMode: 'split_ops',
    currentPattern: 'hub + multi-tab detail + sticky command bar sidebar',
    gap: 'split pane 구조로 정리 필요',
  },
  {
    route: '/search',
    label: '제품 비교',
    workMode: 'split_ops',
    currentPattern: '비교 workspace',
    gap: 'ops layout 문법 미적용',
  },

  // Analysis Console
  {
    route: '/dashboard/analytics',
    label: '지출 분석',
    workMode: 'analysis_console',
    currentPattern: '2-col grid: chart + detail list',
    gap: 'filter bar 약함, exception insight 없음',
  },
  {
    route: '/dashboard/reports',
    label: '구매 리포트',
    workMode: 'analysis_console',
    currentPattern: '리포트 화면',
    gap: 'analysis console 문법 미적용',
  },
  {
    route: '/dashboard/budget',
    label: '예산 관리',
    workMode: 'analysis_console',
    currentPattern: '카드 그리드 + 다이얼로그 폼',
    gap: 'analysis/record 하이브리드 필요',
  },

  // Record / Policy
  {
    route: '/dashboard/settings',
    label: '설정',
    workMode: 'record_policy',
    currentPattern: '탭 기반 폼 + 테이블 + 다이얼로그',
    gap: 'audit/meta area 약함',
  },
  {
    route: '/dashboard/organizations',
    label: '조직 관리',
    workMode: 'record_policy',
    currentPattern: '조직 관리 폼',
    gap: 'policy effect summary 없음',
  },
];

// ===========================================================================
// 4. Route → WorkMode 해석
// ===========================================================================

export function resolveWorkMode(pathname: string): WorkMode {
  // 정확 매치 우선
  const exact = SCREEN_MAPPINGS.find((m) => m.route === pathname);
  if (exact) return exact.workMode;

  // prefix 매치
  const prefix = SCREEN_MAPPINGS
    .filter((m) => pathname.startsWith(m.route + '/'))
    .sort((a, b) => b.route.length - a.route.length)[0];
  if (prefix) return prefix.workMode;

  return 'hub';
}
