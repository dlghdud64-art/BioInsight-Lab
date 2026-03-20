/**
 * runtime-read-provider.ts
 *
 * Runtime Read Baseline — Provider / Repository / Normalization 경계 정의.
 *
 * demo/runtime 구분 없이 동일한 normalization path를 거치도록
 * 공통 provider interface + repository interface + source classification을 정의한다.
 *
 * 이 파일은 Phase 2에서 runtime read 연동 준비를 위한 baseline.
 * Screen은 repository를 통해 읽고, provider를 직접 호출하지 않는다.
 *
 * @module ops-console/runtime-read-provider
 */

import type { EntityType } from './production-readiness-plan';

// ===========================================================================
// 1. Source Classification
// ===========================================================================

/**
 * 현재 데이터 소스 분류 (내부 diagnostics용, user-facing 아님).
 */
export type DataSourceClassification =
  | 'demo'           // seed/demo data 기반
  | 'runtime'        // runtime API 기반 완전한 데이터
  | 'runtime_partial' // runtime API 기반이지만 일부 누락
  | 'no_data';        // 데이터 없음

// ===========================================================================
// 2. Read Result
// ===========================================================================

/**
 * 모든 read 연산의 공통 결과 래퍼.
 * provider가 다르더라도 UI layer는 동일한 ReadResult를 받는다.
 */
export interface ReadResult<T> {
  data: T | null;
  source: DataSourceClassification;
  status: 'ok' | 'not_found' | 'partial' | 'stale' | 'error';
  /** 누락된 필드/링크 목록 (partial일 때) */
  missingFields?: string[];
  /** 마지막 로드 시각 */
  lastLoadedAt: string;
  /** stale 판단용 version (있으면) */
  version?: string;
  /** 에러 코드 (error일 때) */
  errorCode?: string;
  /** 에러 메시지 (error일 때) */
  errorMessage?: string;
}

/**
 * 리스트 read의 공통 결과.
 */
export interface ListReadResult<T> {
  items: T[];
  total: number;
  source: DataSourceClassification;
  status: 'ok' | 'partial' | 'error';
  lastLoadedAt: string;
}

// ===========================================================================
// 3. Read Provider Interface
// ===========================================================================

/**
 * 공통 read provider 인터페이스.
 * demo/runtime 모두 이 인터페이스를 구현한다.
 * Screen은 이 provider를 직접 호출하지 않고 Repository를 통해 접근한다.
 */
export interface ReadProvider {
  readonly sourceType: 'demo' | 'runtime';

  /** 단일 entity 읽기 */
  fetchEntity<T>(type: EntityType, id: string): Promise<ReadResult<T>>;

  /** 리스트 읽기 */
  fetchList<T>(type: EntityType, filter: ReadFilter): Promise<ListReadResult<T>>;

  /** linked entity 읽기 */
  fetchLinked<T>(sourceType: EntityType, sourceId: string, linkType: string): Promise<ReadResult<T>>;

  /** stale 여부 확인 */
  checkStale(type: EntityType, id: string, knownVersion?: string): Promise<{
    isStale: boolean;
    currentVersion?: string;
  }>;

  /** 특정 scope 새로고침 */
  refresh(scope: RefreshScope): Promise<void>;
}

export interface ReadFilter {
  module?: string;
  readiness?: string;
  owner?: string;
  dueSemantic?: string;
  limit?: number;
  offset?: number;
}

export interface RefreshScope {
  entities?: { type: EntityType; id: string }[];
  modules?: string[];
  all?: boolean;
}

// ===========================================================================
// 4. Repository Interfaces
// ===========================================================================

/**
 * Dashboard Repository — Today Hub 데이터 읽기.
 */
export interface DashboardRepository {
  /** 전체 dashboard 데이터 한 번에 로드 */
  loadDashboard(): Promise<DashboardReadResult>;
  /** scope 기반 새로고침 */
  refresh(scope?: RefreshScope): Promise<void>;
}

export interface DashboardReadResult {
  source: DataSourceClassification;
  headerStats: Record<string, number> | null;
  priorityQueue: unknown[] | null;
  ownerWorkloads: unknown[] | null;
  blockerSection: unknown | null;
  readyActions: unknown[] | null;
  recoveryEntries: unknown[] | null;
  lastLoadedAt: string;
}

/**
 * Inbox Repository — 통합 작업함 데이터 읽기.
 */
export interface InboxRepository {
  /** 전체 inbox 로드 */
  loadInbox(filter?: ReadFilter): Promise<InboxReadResult>;
  /** scope 기반 새로고침 */
  refresh(scope?: RefreshScope): Promise<void>;
}

export interface InboxReadResult {
  source: DataSourceClassification;
  items: unknown[];
  summaryStats: Record<string, number> | null;
  lastLoadedAt: string;
}

/**
 * Module Landing Repository — 모듈별 landing 데이터 읽기.
 */
export interface ModuleLandingRepository {
  /** 모듈 landing 데이터 로드 */
  loadLanding(module: string, filter?: ReadFilter): Promise<ModuleLandingReadResult>;
  /** scope 기반 새로고침 */
  refresh(scope?: RefreshScope): Promise<void>;
}

export interface ModuleLandingReadResult {
  source: DataSourceClassification;
  headerStats: Record<string, number> | null;
  priorityQueue: unknown[] | null;
  buckets: Record<string, unknown[]> | null;
  downstream: unknown[] | null;
  lastLoadedAt: string;
}

/**
 * Detail Repository — 상세 entity 데이터 읽기.
 */
export interface DetailRepository {
  /** entity 상세 로드 */
  loadDetail(type: EntityType, id: string): Promise<DetailReadResult>;
  /** linked entity 로드 */
  loadLinked(type: EntityType, id: string, linkType: string): Promise<ReadResult<unknown>>;
  /** scope 기반 새로고침 */
  refresh(scope?: RefreshScope): Promise<void>;
}

export interface DetailReadResult {
  source: DataSourceClassification;
  entity: unknown | null;
  linkedEntities: Record<string, unknown | null>;
  missingLinks: string[];
  lastLoadedAt: string;
}

/**
 * Search/Reentry Repository — 소싱 플로우 데이터 읽기.
 */
export interface SearchReentryRepository {
  /** re-entry context 기반 검색 결과 로드 */
  loadSearchResults(query: string, filter?: ReadFilter): Promise<ListReadResult<unknown>>;
  /** compare 데이터 로드 */
  loadCompareData(ids: string[]): Promise<ReadResult<unknown[]>>;
  /** draft bootstrap 데이터 로드 */
  loadDraftBootstrap(selectedIds: string[], reentrySourceId?: string): Promise<ReadResult<unknown>>;
}

// ===========================================================================
// 5. Demo Provider (현재 OpsStore 기반)
// ===========================================================================

/**
 * Demo read provider factory.
 * 현재 OpsStore의 seed data를 ReadResult 형태로 래핑한다.
 */
export function createDemoReadResult<T>(data: T | null): ReadResult<T> {
  return {
    data,
    source: 'demo',
    status: data ? 'ok' : 'not_found',
    lastLoadedAt: new Date().toISOString(),
  };
}

export function createDemoListResult<T>(items: T[]): ListReadResult<T> {
  return {
    items,
    total: items.length,
    source: 'demo',
    status: 'ok',
    lastLoadedAt: new Date().toISOString(),
  };
}

// ===========================================================================
// 6. No-Data / Partial-Data Helpers
// ===========================================================================

/**
 * ReadResult가 사용 가능한지 판별.
 */
export function isReadUsable<T>(result: ReadResult<T>): boolean {
  return result.status === 'ok' || result.status === 'partial' || result.status === 'stale';
}

/**
 * ReadResult가 부분 데이터인지 판별.
 */
export function isPartialData<T>(result: ReadResult<T>): boolean {
  return result.status === 'partial' || (result.missingFields?.length ?? 0) > 0;
}

/**
 * ReadResult가 새로고침이 필요한지 판별.
 */
export function needsRefresh<T>(result: ReadResult<T>, maxAge: number = 5 * 60 * 1000): boolean {
  if (result.status === 'stale') return true;
  if (!result.lastLoadedAt) return true;
  const age = Date.now() - new Date(result.lastLoadedAt).getTime();
  return age > maxAge;
}

// ===========================================================================
// 7. Empty State Guidance
// ===========================================================================

/**
 * 각 화면의 no-data 상태에서 보여줄 운영형 안내.
 */
export const EMPTY_STATE_GUIDANCE: Record<string, {
  title: string;
  description: string;
  suggestions: { label: string; route: string }[];
}> = {
  dashboard: {
    title: '아직 처리할 운영 항목이 없습니다',
    description: '시약 검색으로 소싱을 시작하거나, 기존 견적/발주 상태를 확인하세요.',
    suggestions: [
      { label: '시약 검색 시작', route: '/test/search' },
      { label: '견적 현황 확인', route: '/dashboard/quotes' },
    ],
  },
  inbox: {
    title: '현재 처리 대기 작업이 없습니다',
    description: '모든 작업이 처리되었거나, 아직 운영 항목이 생성되지 않았습니다.',
    suggestions: [
      { label: '오늘 현황 보기', route: '/dashboard' },
      { label: '시약 검색 시작', route: '/test/search' },
    ],
  },
  quotes: {
    title: '견적 요청 내역이 없습니다',
    description: '시약 검색 후 비교/견적 요청을 시작하세요.',
    suggestions: [
      { label: '시약 검색 시작', route: '/test/search' },
      { label: '재고 위험 확인', route: '/dashboard/stock-risk' },
    ],
  },
  purchase_orders: {
    title: '발주 내역이 없습니다',
    description: '견적 비교 후 공급사를 선정하면 발주가 생성됩니다.',
    suggestions: [
      { label: '견적 현황 확인', route: '/dashboard/quotes' },
    ],
  },
  receiving: {
    title: '입고 예정 내역이 없습니다',
    description: '발주가 발행되면 입고 예정 항목이 생성됩니다.',
    suggestions: [
      { label: '발주 현황 확인', route: '/dashboard/purchase-orders' },
    ],
  },
  stock_risk: {
    title: '재고 위험 항목이 없습니다',
    description: '재고가 등록되면 부족/만료 위험이 자동으로 감지됩니다.',
    suggestions: [
      { label: '입고 현황 확인', route: '/dashboard/receiving' },
    ],
  },
  detail_not_found: {
    title: '항목을 찾을 수 없습니다',
    description: '요청한 항목이 삭제되었거나 접근 권한이 없습니다.',
    suggestions: [
      { label: '작업함으로', route: '/dashboard/inbox' },
      { label: '오늘로', route: '/dashboard' },
    ],
  },
};

// ===========================================================================
// 8. Partial Data Indicator Labels
// ===========================================================================

export const PARTIAL_DATA_LABELS: Record<string, string> = {
  comparison_missing: '비교 데이터를 불러오는 중입니다',
  approval_pending_load: '승인 정보를 불러오는 중입니다',
  ack_pending_load: '공급사 확인 정보를 불러오는 중입니다',
  lot_metadata_missing: 'Lot/유효기한 정보 일부가 누락되어 있습니다',
  doc_metadata_missing: '문서 정보 일부가 누락되어 있습니다',
  linked_po_stale: '연결된 발주 정보가 최신이 아닐 수 있습니다',
  linked_quote_stale: '연결된 견적 정보가 최신이 아닐 수 있습니다',
  stock_position_stale: '재고 수량 정보가 최신이 아닐 수 있습니다',
  reentry_source_stale: '원본 엔티티 정보가 변경되었을 수 있습니다',
};
