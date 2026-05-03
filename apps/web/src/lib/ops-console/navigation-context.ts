/**
 * ops-console/navigation-context.ts
 *
 * Workspace Navigation / IA Hardening — Navigation Context Model.
 * breadcrumb, orientation strip, return action, header가 공유하는
 * 내비게이션 문맥 모델, 모듈 정의, 경로 해석 헬퍼.
 *
 * Pure data/config — React import 없음.
 *
 * @module ops-console/navigation-context
 */

// ---------------------------------------------------------------------------
// 1. Top-Level Modules & Screen Role
// ---------------------------------------------------------------------------

export type TopLevelModule =
  | 'today'
  | 'inbox'
  | 'search'
  | 'quotes'
  | 'purchase_orders'
  | 'receiving'
  | 'stock_risk'
  | 'settings'
  | 'admin';

export type ScreenRole =
  | 'hub'
  | 'queue'
  | 'detail'
  | 'action'
  | 'reentry'
  | 'list'
  | 'settings';

// ---------------------------------------------------------------------------
// 2. Navigation Context
// ---------------------------------------------------------------------------

export interface NavigationContext {
  topLevelModule: TopLevelModule;
  screenRole: ScreenRole;
  entityId?: string;
  entityLabel?: string;
  originType?: 'inbox' | 'dashboard' | 'reentry' | 'list' | 'direct';
  originRoute?: string;
  originSummary?: string;
  returnRoute?: string;
  returnLabel?: string;
  activeQueueFilter?: string;
  nextSuggestedRoute?: string;
}

// ---------------------------------------------------------------------------
// 3. Module Config
// ---------------------------------------------------------------------------

export interface ModuleConfig {
  module: TopLevelModule;
  label: string;
  shortLabel: string;
  icon: string; // lucide icon name
  href: string;
  landingRole: ScreenRole;
  badgeType?: 'actionable_count' | 'blocked_count' | 'critical_count';
  description: string;
}

export const MODULE_CONFIGS: ModuleConfig[] = [
  {
    module: 'today',
    label: '오늘',
    shortLabel: '오늘',
    icon: 'LayoutDashboard',
    href: '/dashboard',
    landingRole: 'hub',
    description: '오늘 운영 시작점',
  },
  {
    module: 'inbox',
    label: '작업함',
    shortLabel: '작업함',
    icon: 'Inbox',
    href: '/dashboard/inbox',
    landingRole: 'queue',
    badgeType: 'actionable_count',
    description: '전체 open work triage',
  },
  {
    module: 'search',
    label: '검색',
    shortLabel: '검색',
    icon: 'Search',
    href: '/search',
    landingRole: 'reentry',
    description: 'sourcing / re-entry 입구',
  },
  {
    module: 'quotes',
    label: '견적',
    shortLabel: '견적',
    icon: 'FileText',
    href: '/dashboard/quotes',
    landingRole: 'list',
    badgeType: 'actionable_count',
    description: 'RFQ / 응답 / 비교 / 선정',
  },
  {
    module: 'purchase_orders',
    label: '발주',
    shortLabel: '발주',
    icon: 'ClipboardList',
    href: '/dashboard/purchase-orders',
    landingRole: 'list',
    description: '승인 / 발행 / 확인 / 입고 인계',
  },
  {
    module: 'receiving',
    label: '입고',
    shortLabel: '입고',
    icon: 'Package',
    href: '/dashboard/receiving',
    landingRole: 'list',
    badgeType: 'blocked_count',
    description: '도착 / 검수 / lot / 문서 / 반영',
  },
  {
    module: 'stock_risk',
    label: '재고 위험',
    shortLabel: '재고',
    icon: 'AlertTriangle',
    href: '/dashboard/stock-risk',
    landingRole: 'list',
    badgeType: 'critical_count',
    description: '부족 / 만료 / 재주문 / 복구',
  },
];

export const SETTINGS_MODULE: ModuleConfig = {
  module: 'settings',
  label: '설정',
  shortLabel: '설정',
  icon: 'Settings',
  href: '/dashboard/settings',
  landingRole: 'settings',
  description: '시스템 설정',
};

// ---------------------------------------------------------------------------
// 4. Route Resolution
// ---------------------------------------------------------------------------

export function resolveTopLevelModule(pathname: string): TopLevelModule {
  if (pathname === '/dashboard') return 'today';
  if (pathname.startsWith('/dashboard/inbox')) return 'inbox';
  if (
    pathname.startsWith('/search') ||
    pathname.startsWith('/search')
  )
    return 'search';
  if (pathname.startsWith('/dashboard/quotes')) return 'quotes';
  if (pathname.startsWith('/dashboard/purchase-orders'))
    return 'purchase_orders';
  if (pathname.startsWith('/dashboard/receiving')) return 'receiving';
  if (pathname.startsWith('/dashboard/stock-risk')) return 'stock_risk';
  if (pathname.startsWith('/dashboard/settings')) return 'settings';
  return 'today'; // fallback
}

export function resolveScreenRole(pathname: string): ScreenRole {
  if (pathname === '/dashboard') return 'hub';
  if (pathname === '/dashboard/inbox') return 'queue';
  if (pathname.startsWith('/dashboard/settings')) return 'settings';

  // Detail pages have dynamic segments
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length >= 3) {
    const lastSegment = segments[segments.length - 1];
    // Check if last segment looks like an ID
    if (isEntityId(lastSegment)) return 'detail';
  }

  // Check for re-entry
  if (
    pathname.startsWith('/search') ||
    pathname.startsWith('/search')
  )
    return 'reentry';

  return 'list';
}

function isEntityId(segment: string): boolean {
  // numeric ID (10+ digits)
  if (/^\d{10,}$/.test(segment)) return true;
  // UUID prefix
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(segment)) return true;
  // cuid-like (15+ chars, starts with letter, contains digit)
  if (segment.length >= 15 && /^[a-z]/.test(segment) && /\d/.test(segment))
    return true;
  // domain prefixed IDs
  if (
    segment.startsWith('qr-') ||
    segment.startsWith('po-') ||
    segment.startsWith('rb-')
  )
    return true;
  return false;
}

// ---------------------------------------------------------------------------
// 5. Breadcrumb Builder
// ---------------------------------------------------------------------------

export interface BreadcrumbItem {
  label: string;
  href: string;
  isActive: boolean;
}

const MODULE_LABEL_MAP: Record<string, string> = {
  dashboard: '오늘',
  inbox: '작업함',
  quotes: '견적',
  'purchase-orders': '발주',
  receiving: '입고',
  'stock-risk': '재고 위험',
  settings: '설정',
  test: '검색',
  search: '검색',
  compare: '비교',
};

export function buildBreadcrumbs(
  pathname: string,
  entityLabel?: string,
): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: BreadcrumbItem[] = [];

  let currentPath = '';
  for (let i = 0; i < segments.length; i++) {
    currentPath += '/' + segments[i];
    const isLast = i === segments.length - 1;
    const seg = segments[i];

    if (seg === 'dashboard' && i === 0) {
      crumbs.push({ label: '오늘', href: '/dashboard', isActive: isLast });
      continue;
    }

    if (isEntityId(seg)) {
      crumbs.push({
        label: entityLabel || '상세',
        href: currentPath,
        isActive: isLast,
      });
      continue;
    }

    const label = MODULE_LABEL_MAP[seg] || seg;
    crumbs.push({ label, href: currentPath, isActive: isLast });
  }

  return crumbs;
}

// ---------------------------------------------------------------------------
// 6. Navigation Context Builder
// ---------------------------------------------------------------------------

export function buildNavigationContext(
  pathname: string,
  options?: {
    entityId?: string;
    entityLabel?: string;
    originType?: NavigationContext['originType'];
    originRoute?: string;
    originSummary?: string;
    returnRoute?: string;
    returnLabel?: string;
    activeQueueFilter?: string;
  },
): NavigationContext {
  return {
    topLevelModule: resolveTopLevelModule(pathname),
    screenRole: resolveScreenRole(pathname),
    entityId: options?.entityId,
    entityLabel: options?.entityLabel,
    originType: options?.originType,
    originRoute: options?.originRoute,
    originSummary: options?.originSummary,
    returnRoute: options?.returnRoute,
    returnLabel: options?.returnLabel,
    activeQueueFilter: options?.activeQueueFilter,
  };
}

// ---------------------------------------------------------------------------
// 7. Module Badge Aggregator (pure data, no React)
// ---------------------------------------------------------------------------

export interface ModuleBadge {
  module: TopLevelModule;
  count: number;
  severity: 'normal' | 'warning' | 'critical';
}

/**
 * Inbox 통계를 기반으로 모듈별 뱃지를 생성합니다.
 * InboxSourceModule('quote' | 'po' | 'receiving' | 'stock_risk') 키를 사용합니다.
 */
export function buildModuleBadges(inboxStats: {
  totalActionable: number;
  blockedCount: number;
  overdueCount: number;
  byModule: Record<string, number>;
  blockedByModule: Record<string, number>;
}): ModuleBadge[] {
  const badges: ModuleBadge[] = [];

  const inboxCount = inboxStats.totalActionable;
  if (inboxCount > 0) {
    badges.push({
      module: 'inbox',
      count: inboxCount,
      severity:
        inboxStats.overdueCount > 0
          ? 'critical'
          : inboxStats.blockedCount > 0
            ? 'warning'
            : 'normal',
    });
  }

  const receivingBlocked = inboxStats.blockedByModule['receiving'] ?? 0;
  if (receivingBlocked > 0) {
    badges.push({
      module: 'receiving',
      count: receivingBlocked,
      severity: 'warning',
    });
  }

  const stockCritical = inboxStats.blockedByModule['stock_risk'] ?? 0;
  if (stockCritical > 0) {
    badges.push({
      module: 'stock_risk',
      count: stockCritical,
      severity: 'critical',
    });
  }

  const quoteActionable = inboxStats.byModule['quote'] ?? 0;
  if (quoteActionable > 0) {
    badges.push({
      module: 'quotes',
      count: quoteActionable,
      severity: 'normal',
    });
  }

  return badges;
}

// ---------------------------------------------------------------------------
// 8. Orientation Labels
// ---------------------------------------------------------------------------

export const SCREEN_ROLE_LABELS: Record<ScreenRole, string> = {
  hub: '허브',
  queue: '작업 큐',
  detail: '상세',
  action: '실행',
  reentry: '재진입',
  list: '목록',
  settings: '설정',
};

// ---------------------------------------------------------------------------
// 9. Return Path Helper
// ---------------------------------------------------------------------------

export function buildReturnPath(
  currentModule: TopLevelModule,
  originType?: NavigationContext['originType'],
  originRoute?: string,
): { href: string; label: string } {
  // If coming from inbox, return to inbox
  if (originType === 'inbox' && originRoute) {
    return { href: originRoute, label: '작업함으로' };
  }
  // If coming from dashboard, return to dashboard
  if (originType === 'dashboard') {
    return { href: '/dashboard', label: '오늘로' };
  }
  // If coming from re-entry, return to source
  if (originType === 'reentry' && originRoute) {
    return { href: originRoute, label: '원래 화면으로' };
  }
  // Default: return to module landing
  const config = MODULE_CONFIGS.find((m) => m.module === currentModule);
  if (config) {
    return { href: config.href, label: `${config.label} 목록으로` };
  }
  return { href: '/dashboard', label: '오늘로' };
}

// ---------------------------------------------------------------------------
// 10. URL SearchParams ↔ Navigation Context
// ---------------------------------------------------------------------------

/**
 * URL searchParams에서 navigation context 관련 파라미터를 읽는다.
 * React hook이 아닌 pure function — useSearchParams() 결과를 전달.
 */
export function readNavigationParams(searchParams: URLSearchParams): {
  originType?: NavigationContext['originType'];
  originRoute?: string;
  originSummary?: string;
  returnRoute?: string;
  returnLabel?: string;
  activeQueueFilter?: string;
} {
  return {
    originType: (searchParams.get('nav_origin') as NavigationContext['originType']) || undefined,
    originRoute: searchParams.get('nav_origin_route') || undefined,
    originSummary: searchParams.get('nav_origin_summary') || undefined,
    returnRoute: searchParams.get('nav_return') || undefined,
    returnLabel: searchParams.get('nav_return_label') || undefined,
    activeQueueFilter: searchParams.get('nav_filter') || undefined,
  };
}

/**
 * Navigation context를 URL searchParams 문자열로 변환한다.
 * Link href에 append하여 사용.
 */
export function buildNavigationSearchParams(ctx: {
  originType?: NavigationContext['originType'];
  originRoute?: string;
  originSummary?: string;
  returnRoute?: string;
  returnLabel?: string;
  activeQueueFilter?: string;
}): string {
  const params = new URLSearchParams();
  if (ctx.originType) params.set('nav_origin', ctx.originType);
  if (ctx.originRoute) params.set('nav_origin_route', ctx.originRoute);
  if (ctx.originSummary) params.set('nav_origin_summary', ctx.originSummary);
  if (ctx.returnRoute) params.set('nav_return', ctx.returnRoute);
  if (ctx.returnLabel) params.set('nav_return_label', ctx.returnLabel);
  if (ctx.activeQueueFilter) params.set('nav_filter', ctx.activeQueueFilter);
  const str = params.toString();
  return str ? `?${str}` : '';
}

/**
 * 대상 entity route에 navigation context를 붙인 full URL을 생성한다.
 * inbox/dashboard/landing에서 detail로 이동할 때 사용.
 */
export function buildDetailHref(
  entityRoute: string,
  origin: {
    type: NavigationContext['originType'];
    route: string;
    summary?: string;
    returnLabel?: string;
    filter?: string;
  },
): string {
  const navParams = buildNavigationSearchParams({
    originType: origin.type,
    originRoute: origin.route,
    originSummary: origin.summary,
    returnRoute: origin.route,
    returnLabel: origin.returnLabel,
    activeQueueFilter: origin.filter,
  });
  // If entityRoute already has query params, merge
  if (entityRoute.includes('?')) {
    return `${entityRoute}&${navParams.slice(1)}`;
  }
  return `${entityRoute}${navParams}`;
}

// ---------------------------------------------------------------------------
// 11. Orientation Data Builder
// ---------------------------------------------------------------------------

export interface OrientationData {
  /** 현재 top-level 모듈 라벨 */
  moduleLabel: string;
  /** 현재 화면 역할 */
  roleLabel: string;
  /** entity context (있으면) */
  entityLabel?: string;
  /** origin context (있으면) */
  originSummary?: string;
  /** return action */
  returnAction: { href: string; label: string } | null;
  /** breadcrumbs */
  breadcrumbs: BreadcrumbItem[];
}

/**
 * NavigationContext에서 OrientationStrip이 필요로 하는 데이터를 빌드한다.
 */
export function buildOrientationData(ctx: NavigationContext, pathname: string): OrientationData {
  const moduleConfig = MODULE_CONFIGS.find((m) => m.module === ctx.topLevelModule);
  const returnPath = buildReturnPath(ctx.topLevelModule, ctx.originType, ctx.returnRoute || ctx.originRoute);

  return {
    moduleLabel: moduleConfig?.label || '오늘',
    roleLabel: SCREEN_ROLE_LABELS[ctx.screenRole],
    entityLabel: ctx.entityLabel,
    originSummary: ctx.originSummary,
    returnAction: ctx.screenRole !== 'hub' ? returnPath : null,
    breadcrumbs: buildBreadcrumbs(pathname, ctx.entityLabel),
  };
}
