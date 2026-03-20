/**
 * baseline-manifest.ts
 *
 * 현재 복구된 AIPCON 홈 대시보드 baseline 기록.
 * 이 파일에 기록된 파일/commit은 계약 작업이 직접 덮지 않는다.
 *
 * 계약 작업이 baseline을 수정하려면:
 * 1) preview route에서 먼저 검증
 * 2) section 단위로만 부분 병합
 * 3) 전체 교체 금지
 *
 * @module baseline-manifest
 */

// ===========================================================================
// Baseline Files (직접 overwrite 금지)
// ===========================================================================

export const BASELINE_FILES = {
  /** 홈 대시보드 페이지 — KPI + 우선처리 + 추천작업 + 최근구매 */
  dashboardPage: {
    path: 'apps/web/src/app/dashboard/page.tsx',
    frozenAt: 'c713ed0d',
    description: 'AIPCON 홈 대시보드 (WorkQueueInbox lazy load + stats retry)',
  },

  /** 대시보드 shell wrapper */
  dashboardShell: {
    path: 'apps/web/src/app/dashboard/_components/dashboard-shell.tsx',
    frozenAt: 'current',
    description: 'OpsStoreProvider wrapper (sidebar badge용 유지)',
    note: '계약 shell 교체 금지. OpsStoreProvider는 sidebar badge 전용.',
  },

  /** 사이드바 — 계약 버전(운영 메뉴) 사용 중 */
  sidebar: {
    path: 'apps/web/src/app/_components/dashboard-sidebar.tsx',
    frozenAt: 'ff0a08b8',
    description: '운영 내비게이션 (오늘/작업함/검색/견적/발주/입고/재고위험/설정)',
    note: '전역 교체 금지. 메뉴 항목 추가만 허용.',
  },

  /** 하단 네비게이션 */
  bottomNav: {
    path: 'apps/web/src/components/layout/bottom-nav.tsx',
    frozenAt: 'ff0a08b8',
    description: '모바일 하단탭 (오늘/작업함/검색/견적/더보기)',
    note: '전역 교체 금지.',
  },

  /** 헤더 */
  header: {
    path: 'apps/web/src/components/dashboard/Header.tsx',
    frozenAt: 'b01819a7',
    description: '대시보드 헤더 (검색 + 알림 + 프로필)',
  },
} as const;

// ===========================================================================
// Contract Outputs (격리 유지 대상)
// ===========================================================================

export const CONTRACT_ISOLATED = {
  todayOperatingHub: {
    description: 'Today Operating Hub 전체 페이지 교체',
    commits: ['b01819a7', '4d62af65'],
    status: 'isolated' as const,
    reintroduction: 'compact strip만 section 단위 후보',
  },
  inboxOrchestration: {
    description: 'P1-03 Inbox/Dashboard Orchestration',
    commits: ['4d62af65'],
    status: 'isolated' as const,
    reintroduction: 'inbox route 전용, dashboard 미반영',
  },
  moduleLanding: {
    description: 'Module landing surfaces (quotes/PO/receiving/stock-risk)',
    commits: ['e82d59a6', 'd8934ba3'],
    status: 'isolated' as const,
    reintroduction: 'preview route에서 검증 후 개별 반영',
  },
  executionConsole: {
    description: 'Operational detail shells (command bar, blocker, ownership)',
    commits: ['84c1d2da', 'cfbb3fd4', 'fbf2041f'],
    status: 'isolated' as const,
    reintroduction: 'detail page 전용, dashboard 미반영',
  },
  contractShell: {
    description: '계약형 sidebar/nav 전역 교체',
    commits: ['42dc842c', 'ff0a08b8'],
    status: 'blocked' as const,
    reintroduction: '전역 반영 금지. opt-in preview만 허용.',
  },
} as const;

// ===========================================================================
// Reintroduction Candidates (section 단위 재도입 후보)
// ===========================================================================

export const REINTRODUCTION_CANDIDATES = [
  {
    id: 'today-hub-strip',
    section: 'TodayHubStrip compact summary',
    source: 'apps/web/src/app/dashboard/_components/today-hub-strip.tsx',
    target: 'dashboard page 상단',
    standalone: true,
    requiresFlag: 'ENABLE_TODAY_HUB_STRIP' as const,
    risk: 'low',
  },
  {
    id: 'sourcing-flow-strip',
    section: 'Sourcing flow progress strip',
    source: 'apps/web/src/app/dashboard/_components/sourcing-flow-strip.tsx',
    target: 'dashboard page 중단',
    standalone: true,
    requiresFlag: 'ENABLE_SOURCING_FLOW_STRIP' as const,
    risk: 'low',
  },
  {
    id: 'priority-block-widget',
    section: 'Priority queue compact widget (top 3)',
    source: 'dashboard-adapter buildTopPriorityQueue',
    target: 'dashboard page 우선처리 영역 보강',
    standalone: true,
    requiresFlag: 'ENABLE_TODAY_HUB_STRIP' as const,
    risk: 'medium',
  },
  {
    id: 'owner-summary-widget',
    section: 'Owner workload mini summary',
    source: 'dashboard-adapter buildOwnerWorkloads',
    target: 'dashboard 하단 위젯',
    standalone: true,
    requiresFlag: 'ENABLE_CONTRACT_DASHBOARD' as const,
    risk: 'medium',
  },
] as const;
