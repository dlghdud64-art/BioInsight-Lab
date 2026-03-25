/**
 * engineering-work-packages.ts
 *
 * Implementation Sequencing / Engineering Work Package Plan.
 *
 * architecture baseline → dependency mapping → work package split
 * → sequencing → integration checkpoints → demo/prod readiness milestones
 *
 * 이 파일은 런타임 코드가 아니라 실행 계획 참조 문서.
 * 팀이 "지금 뭘 만들고, 끝나면 뭘 붙이고, 어디서 검증하는지" 바로 이해 가능해야 한다.
 *
 * @module ops-console/engineering-work-packages
 */

// ===========================================================================
// 1. Work Package Definitions
// ===========================================================================

export interface WorkPackage {
  id: string;
  name: string;
  category: 'foundation' | 'experience' | 'runtime_data' | 'backend' | 'persistence' | 'ops_tooling' | 'verification';
  purpose: string;
  scope: string[];
  files: string[];
  dependencies: string[];
  parallelWith: string[];
  outputs: string[];
  verificationCriteria: string[];
  risks: string[];
  handoffTo: string[];
  primaryOwner: string;
  collaborators: string[];
  demoScope: string;
  runtimeFollowUp: string;
  estimatedEffort: string;
}

export const WORK_PACKAGES: WorkPackage[] = [

  // ═══════════════════════════════════════════════════════════════
  // TRACK A — Experience Core
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'WP-01',
    name: 'Shared Operational Semantics Baseline',
    category: 'foundation',
    purpose: '전 화면에서 같은 entity가 같은 상태 의미를 갖게 하는 공통 정규화 레이어 확정',
    scope: [
      'EntityOperationalState 모델 확정',
      'readiness/blocker/review/wait/handoff 5대 semantics 고정',
      'BlockerClass taxonomy (hard_block/review_gate/external_wait/soft_warning)',
      'DueSemantic 통합 (on_track/due_soon/overdue_internal/overdue_external/escalation_required)',
      '공통 priority engine',
      '도메인별 resolver (quote/po/receiving/stock-risk)',
      'extractReceivingTruth 등 공유 selector',
      'consistency-verifier 개발용 도구',
    ],
    files: [
      'lib/ops-console/entity-operational-state.ts',
      'lib/ops-console/consistency-verifier.ts',
    ],
    dependencies: [],
    parallelWith: ['WP-02'],
    outputs: [
      'EntityOperationalState interface + 4 domain resolvers',
      'shared resolveDueSemantic / resolveSharedPriority',
      'consistency verification helper',
      'READINESS_LABELS / BLOCKER_CLASS_LABELS constants',
    ],
    verificationCriteria: [
      'TSC 0 error',
      '7+ canonical scenarios에서 dashboard/inbox/landing/detail 상태 일관성 확인',
      'runFullConsistencyCheck() 0 errors',
    ],
    risks: ['semantics drift — 새 도메인 추가 시 resolver 누락'],
    handoffTo: ['WP-03', 'WP-04', 'WP-05', 'WP-06', 'WP-07', 'WP-08', 'WP-09'],
    primaryOwner: 'Frontend Platform',
    collaborators: ['Product UX'],
    demoScope: '완료 — entity-operational-state.ts, consistency-verifier.ts 구현됨',
    runtimeFollowUp: 'Runtime provider가 같은 normalization path 통과하는지 확인',
    estimatedEffort: '완료됨',
  },

  {
    id: 'WP-02',
    name: 'App Shell / Navigation / Orientation Baseline',
    category: 'foundation',
    purpose: '대시보드 레이아웃, 사이드바, 하단 탭, 네비게이션 문맥 보존 기반 확정',
    scope: [
      'DashboardShell + OpsStoreProvider 구조',
      'DashboardSidebar badge count (useOpsStoreSafe)',
      'DashboardBottomNav 반응형',
      'OperationalDetailShell 6-zone 레이아웃',
      'navigation-context 상태 보존',
      'return path / breadcrumb',
    ],
    files: [
      'app/dashboard/_components/dashboard-shell.tsx',
      'app/_components/dashboard-sidebar.tsx',
      'app/_components/dashboard-bottom-nav.tsx',
      'app/dashboard/_components/operational-detail-shell.tsx',
      'lib/ops-console/navigation-context.ts',
    ],
    dependencies: [],
    parallelWith: ['WP-01'],
    outputs: [
      'App shell dark operational tone',
      'Sidebar/bottom nav with badge counts',
      'Detail shell with 6 zones',
      'Navigation context persistence',
    ],
    verificationCriteria: [
      '375px mobile viewport 작동',
      'Provider 외부 페이지 빌드 오류 없음',
      'back navigation 상태 유지',
    ],
    risks: ['navigation context loss on hard refresh'],
    handoffTo: ['WP-03', 'WP-04', 'WP-05', 'WP-06', 'WP-07', 'WP-08', 'WP-09'],
    primaryOwner: 'Product UX/Frontend',
    collaborators: ['Frontend Platform'],
    demoScope: '완료 — shell/sidebar/bottom-nav/detail-shell 구현됨',
    runtimeFollowUp: 'URL searchParams 기반 context persistence 강화',
    estimatedEffort: '완료됨',
  },

  {
    id: 'WP-03',
    name: 'Inbox / Dashboard Orchestration',
    category: 'experience',
    purpose: 'Today Hub + 통합 작업함 — 로그인 직후 지금 처리할 일이 명확히 보이게',
    scope: [
      'Today Operating Hub (dashboard/page.tsx)',
      'Unified Inbox Queue (dashboard/inbox/page.tsx)',
      'inbox-adapter: buildFullInbox + priority/triage calculation',
      'dashboard-adapter: buildDashboardItems + stats + priority queue + blockers + ready actions + recovery',
      'owner workload summary',
      'filter/search/grouping URL state sync',
    ],
    files: [
      'app/dashboard/page.tsx',
      'app/dashboard/inbox/page.tsx',
      'lib/ops-console/inbox-adapter.ts',
      'lib/ops-console/dashboard-adapter.ts',
    ],
    dependencies: ['WP-01', 'WP-02'],
    parallelWith: ['WP-04'],
    outputs: [
      'Today Hub: context bar + priority queue + KPI strip + blocker section + ready actions + recovery entries',
      'Inbox: cross-module triage queue with filter/sort/group',
      'Header stats with drill-down routes',
    ],
    verificationCriteria: [
      '7+ scenarios에서 올바른 priority 순서',
      'blocked/review/waiting/ready grouping 일관성',
      'filter 조합 시 0-result 상태 운영형 표시',
      'URL state persistence on refresh',
    ],
    risks: ['priority scoring drift between dashboard and inbox'],
    handoffTo: ['WP-10', 'WP-15'],
    primaryOwner: 'Product UX/Frontend',
    collaborators: ['Frontend Platform'],
    demoScope: '완료 — dashboard/inbox 페이지 구현됨',
    runtimeFollowUp: 'Runtime provider에서 같은 inbox builder 사용 확인',
    estimatedEffort: '완료됨',
  },

  {
    id: 'WP-04',
    name: 'Module Landing Surfaces',
    category: 'experience',
    purpose: 'Quotes/PO/Receiving/Stock-Risk 각 모듈 허브 — 상태별 분류 + 우선 처리 + 다운스트림',
    scope: [
      'module-landing-adapter: header stats, priority queue, buckets, downstream',
      'quotes/page.tsx landing',
      'purchase-orders/page.tsx landing',
      'receiving/page.tsx landing',
      'stock-risk/page.tsx landing',
      'sourcing-flow-adapter for quotes module',
    ],
    files: [
      'lib/ops-console/module-landing-adapter.ts',
      'lib/ops-console/sourcing-flow-adapter.ts',
      'app/dashboard/quotes/page.tsx',
      'app/dashboard/purchase-orders/page.tsx',
      'app/dashboard/receiving/page.tsx',
      'app/dashboard/stock-risk/page.tsx',
    ],
    dependencies: ['WP-01', 'WP-02'],
    parallelWith: ['WP-03'],
    outputs: [
      '4 module landing pages with header stats + priority queue + state-split tabs + downstream handoff',
      'Bucket counting consistent with inbox triage groups',
    ],
    verificationCriteria: [
      'Landing bucket counts == inbox module filter counts',
      'Priority queue items match dashboard top priority subset',
      'Empty state with guided navigation',
    ],
    risks: ['bucket key mismatch with inbox triageGroup'],
    handoffTo: ['WP-06', 'WP-07', 'WP-08', 'WP-09', 'WP-15'],
    primaryOwner: 'Product UX/Frontend',
    collaborators: ['Frontend Platform'],
    demoScope: '완료',
    runtimeFollowUp: 'Runtime provider summary API 연동',
    estimatedEffort: '완료됨',
  },

  {
    id: 'WP-05',
    name: 'Sourcing Flow Screen Tree',
    category: 'experience',
    purpose: '검색→비교→견적초안→견적핸드오프 + 재진입 컨텍스트 흐름',
    scope: [
      'Search workspace (test/search)',
      'Compare workspace (test/compare)',
      'Quote draft flow',
      'ReentryContext from stock-risk/receiving/expiry',
      'Quick/compare/review entry paths',
      'AI inline summary layer (보조)',
    ],
    files: [
      'app/search/**',
      'app/search/**',
      'lib/ops-console/reentry-context.ts',
      'lib/ops-console/sourcing-flow-adapter.ts',
    ],
    dependencies: ['WP-01', 'WP-02'],
    parallelWith: ['WP-03', 'WP-04'],
    outputs: [
      'Search→Compare→Draft→Quote handoff flow',
      'ReentryContext with vendor/item/doc/urgency hints',
      '3 entry paths: quick search, compare workspace, review re-entry',
    ],
    verificationCriteria: [
      'Re-entry context from stock-risk correctly populates search hints',
      'Compare-to-quote draft handoff preserves selected items',
      'Return path navigates back to source entity',
    ],
    risks: ['re-entry context stale if source entity changes during flow'],
    handoffTo: ['WP-06', 'WP-10'],
    primaryOwner: 'Product UX/Frontend',
    collaborators: ['Frontend Platform'],
    demoScope: '완료 — search/compare/reentry 구현됨',
    runtimeFollowUp: 'Search API 실제 연동, AI summary API 연동',
    estimatedEffort: '완료됨',
  },

  {
    id: 'WP-06',
    name: 'Quote Execution Console',
    category: 'experience',
    purpose: '견적 상세 — 응답 진행 + 비교 게이트 + 선정 준비 + PO 인계 실행 화면',
    scope: [
      'quotes/[quoteId]/page.tsx 실행 콘솔',
      'Response progress surface',
      'Compare gate + selection readiness',
      'PO handoff command',
      'Command/ownership/blocker surfaces',
    ],
    files: [
      'app/dashboard/quotes/[quoteId]/page.tsx',
      'lib/ops-console/command-adapters.ts (quote section)',
      'lib/ops-console/ownership-adapter.ts (quote section)',
      'lib/ops-console/blocker-adapter.ts (quote section)',
    ],
    dependencies: ['WP-01', 'WP-02', 'WP-05'],
    parallelWith: ['WP-07', 'WP-08', 'WP-09'],
    outputs: [
      'Quote execution console with response/compare/selection/handoff zones',
      'Command surface with vendor select + PO create CTAs',
    ],
    verificationCriteria: [
      'Quote operational state matches inbox/landing readiness',
      'Vendor selection → handoff_ready state propagation',
      'PO create → converted_to_po terminal state',
    ],
    risks: ['compare_ready vs ready_to_select confusion'],
    handoffTo: ['WP-07', 'WP-11', 'WP-15'],
    primaryOwner: 'Product UX/Frontend',
    collaborators: ['Frontend Platform'],
    demoScope: '완료 — sourcing-flow-adapter 기반 구현됨',
    runtimeFollowUp: 'Quote detail read API + vendor select / create PO mutation 연동',
    estimatedEffort: '완료됨',
  },

  {
    id: 'WP-07',
    name: 'PO Execution Console',
    category: 'experience',
    purpose: '발주 상세 — 승인→발행→확인→입고인계 실행 콘솔',
    scope: [
      'purchase-orders/[poId]/page.tsx 8-zone 실행 콘솔',
      'po-detail-adapter: POExecutionModel 빌더',
      'Approval execution surface',
      'Issue readiness strip + line execution table',
      'Acknowledgement surface',
      'Receiving handoff panel',
    ],
    files: [
      'app/dashboard/purchase-orders/[poId]/page.tsx',
      'lib/ops-console/po-detail-adapter.ts',
    ],
    dependencies: ['WP-01', 'WP-02'],
    parallelWith: ['WP-06', 'WP-08', 'WP-09'],
    outputs: [
      'PO execution console: approval→issue→ack→handoff 5-step visual',
      'Approval step table with SLA/escalation',
      'Line execution grid (8 columns)',
      'Ack surface with line confirmation table',
      'Receiving handoff with downstream impact',
    ],
    verificationCriteria: [
      'Approval pending → blocked in inbox/landing',
      'Approved → ready in inbox/landing',
      'Issued + ack pending → waiting_external everywhere',
      'Acknowledged → handoff_ready everywhere',
    ],
    risks: ['approved vs issuable confusion; ack partial confirm mixed state'],
    handoffTo: ['WP-08', 'WP-11', 'WP-15'],
    primaryOwner: 'Product UX/Frontend',
    collaborators: ['Frontend Platform'],
    demoScope: '완료 — po-detail-adapter + page 구현됨',
    runtimeFollowUp: 'PO detail read + issue/ack mutation 연동',
    estimatedEffort: '완료됨',
  },

  {
    id: 'WP-08',
    name: 'Receiving Execution Console',
    category: 'experience',
    purpose: '입고 상세 — 검수/문서/Lot/격리/반영/재고위험인계 실행 콘솔',
    scope: [
      'receiving/[receivingId]/page.tsx 8-zone 실행 콘솔',
      'receiving-detail-adapter: ReceivingExecutionModel 빌더',
      'Receipt + inspection summary',
      'Document summary',
      'Line execution table (9 columns)',
      'Lot detail grid (10 columns, collapsible)',
      'Posting readiness strip',
      'Inventory release + stock-risk handoff',
    ],
    files: [
      'app/dashboard/receiving/[receivingId]/page.tsx',
      'lib/ops-console/receiving-detail-adapter.ts',
    ],
    dependencies: ['WP-01', 'WP-02'],
    parallelWith: ['WP-06', 'WP-07', 'WP-09'],
    outputs: [
      'Receiving execution console: arrival→inspection→lot→posting→handoff',
      'Upstream context strip (PO/tracking/vendor)',
      'Posting readiness gate (ready/partial/blocked)',
      'Stock risk handoff with follow-up reasons',
    ],
    verificationCriteria: [
      'Doc missing → blocked or waiting_external in inbox/landing',
      'Quarantine → blocked in inbox/landing',
      'Inspection pending → needs_review in inbox/landing',
      'Can post → ready in inbox/landing',
      'Posted → handoff_ready everywhere',
    ],
    risks: ['received vs postable confusion; partial posting available vs fully blocked'],
    handoffTo: ['WP-09', 'WP-11', 'WP-15'],
    primaryOwner: 'Product UX/Frontend',
    collaborators: ['Frontend Platform'],
    demoScope: '완료 — receiving-detail-adapter + page 구현됨',
    runtimeFollowUp: 'Receiving detail read + inspection/lot/posting mutation 연동',
    estimatedEffort: '완료됨',
  },

  {
    id: 'WP-09',
    name: 'Stock Risk Execution Console',
    category: 'experience',
    purpose: '재고 위험 상세 — 부족/만료/격리 분석 + 재주문 준비 + 복구/재진입',
    scope: [
      'Stock risk detail surface (stock-risk landing 내 또는 별도 route)',
      'Shortage/expiry/quarantine analysis panels',
      'Reorder readiness gate',
      'Recovery/re-entry handoff (→ sourcing flow)',
      'Duplicate flow blocker detection',
    ],
    files: [
      'app/dashboard/stock-risk/page.tsx (detail portion)',
      'lib/ops-console/reentry-context.ts',
    ],
    dependencies: ['WP-01', 'WP-02', 'WP-05'],
    parallelWith: ['WP-06', 'WP-07', 'WP-08'],
    outputs: [
      'Stock risk execution surface with shortage/expiry/reorder panels',
      'Re-entry CTA linking to sourcing flow with context',
      'Duplicate blocker detection and resolution path',
    ],
    verificationCriteria: [
      'Recommendation exists ≠ ready_for_reorder (blocked check required)',
      'Duplicate open flow → blocked everywhere',
      'Converted reorder → handoff_ready, not still "open ready"',
      'Budget near threshold → needs_review',
    ],
    risks: ['recommendation exists vs reorder executable confusion; duplicate flow stale detection'],
    handoffTo: ['WP-11', 'WP-15'],
    primaryOwner: 'Product UX/Frontend',
    collaborators: ['Frontend Platform'],
    demoScope: '부분 완료 — landing 구현됨, detail execution surface 일부 보강 필요',
    runtimeFollowUp: 'Stock risk detail read + reorder→quote create mutation 연동',
    estimatedEffort: '2-3일',
  },

  // ═══════════════════════════════════════════════════════════════
  // TRACK B — Runtime / Data Core
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'WP-10',
    name: 'Runtime Provider / Repository Integration',
    category: 'runtime_data',
    purpose: 'Demo provider에서 runtime API provider로 전환 가능한 공통 인터페이스 구현',
    scope: [
      'OpsDataProvider 인터페이스 구현',
      'DemoProvider (현재 ops-store 래핑)',
      'RuntimeProvider scaffold (API fetch 기반)',
      'HybridProvider (demo fallback + runtime partial)',
      'Repository interfaces: Dashboard/Inbox/Quote/PO/Receiving/StockRisk',
      'Normalization path 공유 확인',
    ],
    files: [
      'lib/ops-console/providers/ops-data-provider.ts (NEW)',
      'lib/ops-console/providers/demo-provider.ts (NEW)',
      'lib/ops-console/providers/runtime-provider.ts (NEW)',
      'lib/ops-console/repositories/*.ts (NEW)',
    ],
    dependencies: ['WP-01', 'WP-03'],
    parallelWith: ['WP-06', 'WP-07', 'WP-08', 'WP-09'],
    outputs: [
      'OpsDataProvider interface + 3 provider implementations',
      'Repository interfaces for 6 domains',
      'Provider swap mechanism (context-based)',
    ],
    verificationCriteria: [
      'Demo provider produces identical output to current ops-store',
      'Runtime provider handles no-data gracefully',
      'Hybrid provider falls back to demo for missing data',
      'All screens work with provider swap',
    ],
    risks: ['provider interface too broad or too narrow; normalization path divergence'],
    handoffTo: ['WP-11', 'WP-12'],
    primaryOwner: 'Frontend Platform',
    collaborators: ['Backend API'],
    demoScope: 'DemoProvider 구현',
    runtimeFollowUp: 'RuntimeProvider + API fetch 구현',
    estimatedEffort: '5-7일',
  },

  {
    id: 'WP-11',
    name: 'Core Mutation Safety Layer',
    category: 'runtime_data',
    purpose: '주요 액션의 pending/success/failure/conflict/retry 처리 계층',
    scope: [
      'Mutation handler with pending/success/error states',
      'Idempotency key generation',
      'Stale precondition detection',
      'Optimistic update with rollback',
      'Invalidation/refetch scope management',
      'Toast/inline feedback integration',
      'Downstream handoff route resolution',
    ],
    files: [
      'lib/ops-console/mutation-handler.ts (NEW)',
      'lib/ops-console/invalidation-manager.ts (NEW)',
      'hooks/use-ops-mutation.ts (NEW)',
    ],
    dependencies: ['WP-01', 'WP-10'],
    parallelWith: ['WP-12'],
    outputs: [
      'useOpsMutation hook with safety guarantees',
      'MUTATION_SAFETY_RULES enforcement',
      'Invalidation scope management per command',
      'Stale conflict UI recovery',
    ],
    verificationCriteria: [
      'Double-click prevention on idempotent commands',
      'Stale conflict shows refresh + redirect',
      'Optimistic update rolls back on failure',
      'Downstream handoff route uses confirmed entity id',
      'Toast feedback for all mutation outcomes',
    ],
    risks: ['optimistic rollback race conditions; invalidation scope too broad or too narrow'],
    handoffTo: ['WP-12', 'WP-15'],
    primaryOwner: 'Frontend Platform',
    collaborators: ['Backend API'],
    demoScope: 'Demo-mode mutation handler (client-side only)',
    runtimeFollowUp: 'Server-backed mutation with real idempotency/conflict handling',
    estimatedEffort: '5-7일',
  },

  {
    id: 'WP-12',
    name: 'Backend API Alignment Pack',
    category: 'backend',
    purpose: 'Read/Write API 계약 확정 + endpoint 구현 + permission/policy boundary',
    scope: [
      'Read Endpoint Matrix 구현 (9 endpoints)',
      'Mutation Command Matrix 구현 (7 commands)',
      'Status mapping layer (backend raw → frontend operational semantics)',
      'Permission/policy preflight + server enforcement',
      'Error taxonomy handling (10 error codes)',
      'API payload validation',
    ],
    files: [
      'app/api/ops/** (NEW)',
      'lib/ops-console/backend-contract-alignment.ts (reference)',
    ],
    dependencies: ['WP-10', 'WP-11'],
    parallelWith: ['WP-13'],
    outputs: [
      '9 read endpoints',
      '7 mutation command endpoints',
      'Permission check middleware',
      'Error response standardization',
    ],
    verificationCriteria: [
      'Read endpoints return data matching frontend contract shape',
      'Mutation endpoints handle idempotency/conflict/permission',
      'Error codes map to ERROR_TAXONOMY',
      'Permission denied returns reason + next path',
    ],
    risks: ['API payload mismatch with frontend contract; permission ambiguity'],
    handoffTo: ['WP-13', 'WP-14', 'WP-15'],
    primaryOwner: 'Backend API',
    collaborators: ['Frontend Platform'],
    demoScope: 'N/A — backend 전용',
    runtimeFollowUp: 'Full API implementation',
    estimatedEffort: '10-14일',
  },

  {
    id: 'WP-13',
    name: 'DB / Event / Audit Pack',
    category: 'persistence',
    purpose: 'Entity 저장 구조 + lineage/linkage + event dispatch + audit trail',
    scope: [
      'Prisma schema 확장 (25 tables)',
      'Lineage/linkage foreign keys',
      'domain_events table + transactional outbox',
      'audit_entries table',
      'Projection tables (inbox/dashboard/module summaries)',
      'Event→Projection refresh handlers',
      'Correlation/trace id propagation',
    ],
    files: [
      'prisma/schema.prisma (extensions)',
      'lib/events/** (NEW)',
      'lib/audit/** (NEW)',
      'lib/ops-console/db-event-audit-plan.ts (reference)',
    ],
    dependencies: ['WP-12'],
    parallelWith: ['WP-14'],
    outputs: [
      'Extended Prisma schema with all entity tables',
      'Event dispatch on command success',
      'Audit trail for 10 sensitive actions',
      'Projection refresh strategy',
    ],
    verificationCriteria: [
      'Prisma migrate succeeds',
      'Command → event → audit trail traceable by correlationId',
      'Lineage: quote→PO→receiving→stock traversable in DB',
      'Projection rebuild from events matches fresh calculation',
    ],
    risks: ['schema migration complexity; event/audit write performance; stale projection'],
    handoffTo: ['WP-14', 'WP-15'],
    primaryOwner: 'Data/Infra',
    collaborators: ['Backend API'],
    demoScope: 'N/A — persistence 전용',
    runtimeFollowUp: 'Production migration + index optimization',
    estimatedEffort: '7-10일',
  },

  // ═══════════════════════════════════════════════════════════════
  // TRACK C — Ops / Reliability
  // ═══════════════════════════════════════════════════════════════

  {
    id: 'WP-14',
    name: 'Ops Internal Tooling Pack',
    category: 'ops_tooling',
    purpose: '운영 진단, 엔티티 추적, 복구/재조정, 권한 디버그 도구',
    scope: [
      'Entity trace viewer (correlationId 기반)',
      'Projection freshness monitor',
      'Stale linkage detector',
      'Duplicate entity detector',
      'Stock position reconciliation tool',
      'Permission debug surface',
      'Repair/rebuild triggers',
    ],
    files: [
      'app/admin/ops-diagnostics/** (NEW)',
      'lib/ops-console/reconciliation/** (NEW)',
    ],
    dependencies: ['WP-12', 'WP-13'],
    parallelWith: ['WP-15'],
    outputs: [
      'Entity trace viewer',
      'Projection health dashboard',
      'Reconciliation trigger tools',
      'Permission debug surface',
    ],
    verificationCriteria: [
      'Trace viewer shows command→event→audit chain',
      'Stale linkage detector finds known test cases',
      'Stock reconciliation rebuilds position from postings',
      'Permission debug shows effective permissions per entity',
    ],
    risks: ['under-scoped — tooling always gets deprioritized'],
    handoffTo: ['WP-15'],
    primaryOwner: 'Ops Tooling',
    collaborators: ['Data/Infra', 'Backend API'],
    demoScope: 'consistency-verifier 개발용 검증',
    runtimeFollowUp: 'Full admin diagnostics UI',
    estimatedEffort: '5-7일',
  },

  {
    id: 'WP-15',
    name: 'Scenario Verification / Release Hardening',
    category: 'verification',
    purpose: 'Canonical scenarios 검증 + cross-screen 일관성 + failure/partial-data 테스트 + release gate 충족',
    scope: [
      'Canonical demo scenarios 7+개 검증',
      'Cross-module state consistency automated checks',
      'Mutation conflict/retry/stale test cases',
      'No-data / partial-data / missing-link test cases',
      'Permission denied test cases',
      'Readiness classification update',
      'Release gate evidence collection',
    ],
    files: [
      'lib/ops-console/consistency-verifier.ts',
      'lib/ops-console/production-readiness-plan.ts',
      '__tests__/** (NEW)',
    ],
    dependencies: ['WP-01'],
    parallelWith: ['WP-03', 'WP-04', 'WP-05', 'WP-06', 'WP-07', 'WP-08', 'WP-09', 'WP-10', 'WP-11', 'WP-12', 'WP-13', 'WP-14'],
    outputs: [
      'Scenario verification report (per checkpoint)',
      'Consistency check results',
      'Readiness classification per screen/feature',
      'Release gate evidence',
    ],
    verificationCriteria: [
      'All canonical scenarios pass without state inconsistency',
      'No dead flow / dead badge / stale aggregate',
      'Partial-data screens show degraded but operational UI',
      'Permission denial shows reason + next path',
    ],
    risks: ['verification drift as features evolve; false confidence from demo-only checks'],
    handoffTo: [],
    primaryOwner: 'QA/Verification',
    collaborators: ['Product UX/Frontend', 'Frontend Platform', 'Backend API'],
    demoScope: 'Demo scenario verification (매 checkpoint)',
    runtimeFollowUp: 'Runtime integration + production gate verification',
    estimatedEffort: '지속적 — 매 checkpoint에 2-3일',
  },
];

// ===========================================================================
// 2. Dependency Matrix
// ===========================================================================

export const DEPENDENCY_MATRIX: {
  upstream: string;
  downstream: string;
  interface: string;
  blockingLevel: 'hard' | 'soft';
}[] = [
  { upstream: 'WP-01', downstream: 'WP-03', interface: 'EntityOperationalState + priority engine', blockingLevel: 'hard' },
  { upstream: 'WP-01', downstream: 'WP-04', interface: 'EntityOperationalState for bucket consistency', blockingLevel: 'hard' },
  { upstream: 'WP-01', downstream: 'WP-06', interface: 'Quote resolver for detail readiness', blockingLevel: 'soft' },
  { upstream: 'WP-01', downstream: 'WP-07', interface: 'PO resolver for detail readiness', blockingLevel: 'soft' },
  { upstream: 'WP-01', downstream: 'WP-08', interface: 'Receiving resolver + extractReceivingTruth', blockingLevel: 'soft' },
  { upstream: 'WP-01', downstream: 'WP-09', interface: 'StockRisk resolver for reorder readiness', blockingLevel: 'soft' },
  { upstream: 'WP-02', downstream: 'WP-03', interface: 'App shell + detail shell', blockingLevel: 'hard' },
  { upstream: 'WP-02', downstream: 'WP-04', interface: 'App shell + navigation', blockingLevel: 'hard' },
  { upstream: 'WP-03', downstream: 'WP-10', interface: 'Inbox data contract for provider', blockingLevel: 'soft' },
  { upstream: 'WP-10', downstream: 'WP-11', interface: 'Provider mutation interface', blockingLevel: 'hard' },
  { upstream: 'WP-10', downstream: 'WP-12', interface: 'Repository interfaces for API alignment', blockingLevel: 'soft' },
  { upstream: 'WP-11', downstream: 'WP-12', interface: 'Mutation safety requirements for API design', blockingLevel: 'soft' },
  { upstream: 'WP-12', downstream: 'WP-13', interface: 'API contract → DB schema alignment', blockingLevel: 'hard' },
  { upstream: 'WP-12', downstream: 'WP-14', interface: 'API error codes → diagnostics mapping', blockingLevel: 'soft' },
  { upstream: 'WP-13', downstream: 'WP-14', interface: 'Event/audit tables → trace viewer', blockingLevel: 'hard' },
];

// ===========================================================================
// 3. Integration Checkpoints
// ===========================================================================

export interface Checkpoint {
  id: string;
  name: string;
  requiredPackages: string[];
  validation: string[];
  exitCriteria: string[];
}

export const CHECKPOINTS: Checkpoint[] = [
  {
    id: 'CP-1',
    name: 'Demo-Stable P0 Console',
    requiredPackages: ['WP-01', 'WP-02', 'WP-03', 'WP-04', 'WP-05', 'WP-06', 'WP-07', 'WP-08', 'WP-09'],
    validation: [
      'All canonical demo scenarios render correctly',
      'Cross-module state consistency: 0 errors in verifier',
      'Dashboard → Inbox → Landing → Detail → Re-entry flow unbroken',
      'No dead button / fake chart / debug text / raw label',
    ],
    exitCriteria: [
      'SCREEN_READINESS: all experience screens = demo_stable',
      'runFullConsistencyCheck() = 0 errors, 0 warnings',
      'Mobile 375px viewport functional',
    ],
  },
  {
    id: 'CP-2',
    name: 'Runtime Read Baseline',
    requiredPackages: ['WP-10', 'WP-12 (read portion)'],
    validation: [
      'RuntimeProvider fetches from API endpoints',
      'No-data state shows guided empty',
      'Partial-data state shows degraded but functional UI',
      'Provider swap does not change operational semantics',
    ],
    exitCriteria: [
      'All read endpoints return matching contract shape',
      'Dashboard/inbox/landing render with real data',
      'Detail pages render with partial linked entities',
    ],
  },
  {
    id: 'CP-3',
    name: 'Core Mutation Baseline',
    requiredPackages: ['WP-11', 'WP-12 (mutation portion)'],
    validation: [
      'Vendor select → quote state change → inbox/dashboard update',
      'Create PO → new entity + route handoff',
      'PO issue → ack pending state',
      'Posting → stock risk recalculation',
      'Reorder quote create → linked entity + recovery update',
      'Double-click prevention works',
      'Stale conflict shows recovery UI',
    ],
    exitCriteria: [
      'All 7 core mutations handle success/failure/conflict/retry',
      'Downstream handoff uses confirmed entity id',
      'No duplicate entities on retry',
    ],
  },
  {
    id: 'CP-4',
    name: 'Backend Persistence Integrity',
    requiredPackages: ['WP-13'],
    validation: [
      'Prisma schema migrated successfully',
      'Command → entity write → event emit → audit entry traceable',
      'Lineage: quote→PO→receiving→stock traversable',
      'Projection refresh from events matches fresh calculation',
    ],
    exitCriteria: [
      'All entity tables created with correct foreign keys',
      'Event outbox dispatches without loss',
      'Audit trail covers 10 sensitive actions',
    ],
  },
  {
    id: 'CP-5',
    name: 'Ops Recoverability Baseline',
    requiredPackages: ['WP-14'],
    validation: [
      'Entity trace viewer shows command chain',
      'Stale linkage detector finds planted stale links',
      'Stock position reconciliation matches postings',
    ],
    exitCriteria: [
      'Trace viewer functional',
      'At least 3 reconciliation tools operational',
      'Permission debug shows effective role per entity',
    ],
  },
  {
    id: 'CP-6',
    name: 'Production Candidate P0',
    requiredPackages: ['WP-01', 'WP-02', 'WP-03', 'WP-04', 'WP-05', 'WP-06', 'WP-07', 'WP-08', 'WP-09', 'WP-10', 'WP-11', 'WP-12', 'WP-13', 'WP-14', 'WP-15'],
    validation: [
      'All CP-1 through CP-5 criteria met',
      'Role/policy/permission enforcement on all mutations',
      'Recoverable failure UX on all error scenarios',
      'No critical stale inconsistency across screens',
      'Internal tooling minimum viable set operational',
    ],
    exitCriteria: [
      'SCREEN_READINESS: all screens = production_candidate',
      'All release gates passed',
      'Readiness classification has no demo_only items',
    ],
  },
];

// ===========================================================================
// 4. Milestones
// ===========================================================================

export interface Milestone {
  id: string;
  name: string;
  includedPackages: string[];
  readinessLevel: string;
  gateRequired: string;
  risks: string[];
}

export const MILESTONES: Milestone[] = [
  {
    id: 'M1',
    name: 'P0 UX Stable',
    includedPackages: ['WP-01', 'WP-02', 'WP-03', 'WP-04', 'WP-05', 'WP-06', 'WP-07', 'WP-08', 'WP-09'],
    readinessLevel: 'demo_stable',
    gateRequired: 'Gate 1 (Demo Gate)',
    risks: ['WP-09 stock-risk detail 일부 보강 필요'],
  },
  {
    id: 'M2',
    name: 'State Consistency Stable',
    includedPackages: ['WP-01', 'WP-15 (partial)'],
    readinessLevel: 'demo_stable',
    gateRequired: 'Gate 1 (Demo Gate)',
    risks: ['새 기능 추가 시 consistency drift'],
  },
  {
    id: 'M3',
    name: 'Runtime Read Ready',
    includedPackages: ['WP-10', 'WP-12 (read)'],
    readinessLevel: 'runtime_partial_ready',
    gateRequired: 'Gate 2 (Runtime Gate)',
    risks: ['API payload mismatch; partial-data edge cases'],
  },
  {
    id: 'M4',
    name: 'Core Execution Ready',
    includedPackages: ['WP-11', 'WP-12 (mutation)'],
    readinessLevel: 'runtime_partial_ready',
    gateRequired: 'Gate 3 (Execution Gate)',
    risks: ['mutation conflict complexity; downstream handoff instability'],
  },
  {
    id: 'M5',
    name: 'Persistence / Audit Ready',
    includedPackages: ['WP-13'],
    readinessLevel: 'production_candidate',
    gateRequired: 'Gate 4 (Persistence Gate)',
    risks: ['schema migration; event/audit performance'],
  },
  {
    id: 'M6',
    name: 'Ops Recoverable',
    includedPackages: ['WP-14'],
    readinessLevel: 'production_candidate',
    gateRequired: 'Gate 5 (Ops Gate)',
    risks: ['tooling deprioritization; under-scoped diagnostics'],
  },
  {
    id: 'M7',
    name: 'Production Candidate',
    includedPackages: ['WP-01', 'WP-02', 'WP-03', 'WP-04', 'WP-05', 'WP-06', 'WP-07', 'WP-08', 'WP-09', 'WP-10', 'WP-11', 'WP-12', 'WP-13', 'WP-14', 'WP-15'],
    readinessLevel: 'production_candidate',
    gateRequired: 'Gate 6 (Production Gate)',
    risks: ['integration complexity; stale inconsistency; permission gaps'],
  },
];

// ===========================================================================
// 5. Release Gates
// ===========================================================================

export interface ReleaseGate {
  id: string;
  name: string;
  criteria: string[];
  evidence: string[];
  failCondition: string[];
}

export const RELEASE_GATES: ReleaseGate[] = [
  {
    id: 'Gate-1',
    name: 'Demo Gate',
    criteria: [
      'Canonical scenarios 7+개 시연 가능',
      'Dead flow 없음',
      'State semantics 일관성 확보 (verifier 0 errors)',
      'Mobile 375px functional',
    ],
    evidence: ['runFullConsistencyCheck() report', 'scenario walkthrough recording', 'mobile screenshot'],
    failCondition: ['consistency verifier error > 0', 'dead button found', 'state mismatch between screens'],
  },
  {
    id: 'Gate-2',
    name: 'Runtime Gate',
    criteria: [
      'Read provider stable with real endpoints',
      'No-data / partial-data 견딤',
      'Provider swap = same semantics',
    ],
    evidence: ['API response matching contract', 'no-data screenshot', 'partial-data screenshot'],
    failCondition: ['API payload mismatch', 'screen crash on missing data', 'semantics change on provider swap'],
  },
  {
    id: 'Gate-3',
    name: 'Execution Gate',
    criteria: [
      '7 core mutations: success/failure/conflict/retry',
      'Downstream handoff stable',
      'No duplicate entities on retry',
    ],
    evidence: ['mutation test results', 'idempotency test results', 'handoff route verification'],
    failCondition: ['duplicate entity created', 'handoff route 404', 'stale conflict silent failure'],
  },
  {
    id: 'Gate-4',
    name: 'Persistence Gate',
    criteria: [
      'Schema migrated',
      'Event/audit trail traceable',
      'Projection freshness acceptable',
      'Lineage traversable',
    ],
    evidence: ['migration log', 'correlationId trace sample', 'projection staleness metrics'],
    failCondition: ['migration failure', 'event loss detected', 'audit gap on sensitive action'],
  },
  {
    id: 'Gate-5',
    name: 'Ops Gate',
    criteria: [
      'Diagnostics/trace minimum set operational',
      'Reconciliation tools for 3+ failure types',
      'Permission debug functional',
    ],
    evidence: ['trace viewer screenshot', 'reconciliation test result', 'permission debug output'],
    failCondition: ['trace viewer not functional', 'no reconciliation capability'],
  },
  {
    id: 'Gate-6',
    name: 'Production Gate',
    criteria: [
      'All Gates 1-5 passed',
      'Role/policy/permission enforcement on all mutations',
      'Recoverable failure UX complete',
      'No critical stale inconsistency',
      'SCREEN_READINESS has no demo_only items',
    ],
    evidence: ['all gate evidence combined', 'readiness classification report', 'security/permission audit'],
    failCondition: ['any Gate 1-5 not passed', 'demo_only item remains', 'permission bypass found'],
  },
];

// ===========================================================================
// 6. Risk Register
// ===========================================================================

export const RISK_REGISTER: {
  risk: string;
  impact: 'high' | 'medium' | 'low';
  likelihood: 'high' | 'medium' | 'low';
  earlySignal: string;
  mitigation: string;
  fallbackPlan: string;
  checkpoint: string;
}[] = [
  {
    risk: 'Semantics drift — 새 기능 추가 시 entity-operational-state resolver 누락',
    impact: 'high',
    likelihood: 'medium',
    earlySignal: 'consistency verifier warning count 증가',
    mitigation: 'WP-15 지속적 verification; new feature must update resolver',
    fallbackPlan: 'resolver gap → emergency patch before release',
    checkpoint: 'CP-1, CP-6',
  },
  {
    risk: 'API payload mismatch — backend resource shape ≠ frontend contract',
    impact: 'high',
    likelihood: 'medium',
    earlySignal: 'WP-12 initial endpoint returns incorrect shape',
    mitigation: 'Contract-first development; shared type definitions',
    fallbackPlan: 'Transform layer between API and normalization',
    checkpoint: 'CP-2',
  },
  {
    risk: 'Linked entity instability — downstream handoff route 404 or stale',
    impact: 'high',
    likelihood: 'medium',
    earlySignal: 'Handoff CTA leads to not_found page',
    mitigation: 'Confirmed entity id before route handoff; idempotent creation',
    fallbackPlan: 'Handoff shows "entity creating..." with retry',
    checkpoint: 'CP-3',
  },
  {
    risk: 'Mutation conflict complexity — stale state + concurrent edits',
    impact: 'medium',
    likelihood: 'high',
    earlySignal: 'Multiple users editing same entity in testing',
    mitigation: 'Optimistic lock on version field; clear conflict UI',
    fallbackPlan: 'Force-refresh + redirect to current state',
    checkpoint: 'CP-3',
  },
  {
    risk: 'Stale projection — projection not refreshed after event',
    impact: 'medium',
    likelihood: 'medium',
    earlySignal: 'Dashboard summary doesn\'t reflect recent mutation',
    mitigation: 'Event-driven refresh; projection freshness monitor',
    fallbackPlan: 'On-demand projection rebuild trigger',
    checkpoint: 'CP-4',
  },
  {
    risk: 'Permission ambiguity — preflight says allowed but server denies',
    impact: 'medium',
    likelihood: 'low',
    earlySignal: 'CTA enabled but mutation returns 403',
    mitigation: 'Server-driven eligibility on detail read; preflight + enforcement alignment',
    fallbackPlan: 'Graceful permission denied UI with reason + escalation path',
    checkpoint: 'CP-6',
  },
  {
    risk: 'Partial-data degradation — linked entity missing causes screen crash',
    impact: 'high',
    likelihood: 'medium',
    earlySignal: 'Detail page throws on undefined linked entity',
    mitigation: 'Null-safe access in all adapters; degraded mode per PARTIAL_DATA_RULES',
    fallbackPlan: 'Catch boundary + stale message + retry action',
    checkpoint: 'CP-2',
  },
  {
    risk: 'Duplicate flow creation — idempotency failure on create commands',
    impact: 'high',
    likelihood: 'low',
    earlySignal: 'Same reorder creates two quotes',
    mitigation: 'Idempotency key on all create commands; duplicate detection on server',
    fallbackPlan: 'Dedup merge tool in WP-14; admin cleanup',
    checkpoint: 'CP-3',
  },
  {
    risk: 'Event/audit inconsistency — event emitted but audit not written',
    impact: 'medium',
    likelihood: 'low',
    earlySignal: 'Event exists without matching audit entry',
    mitigation: 'Single transaction for entity + event + audit',
    fallbackPlan: 'Reconciliation job to fill audit gaps from events',
    checkpoint: 'CP-4',
  },
  {
    risk: 'Internal tooling under-scope — diagnostics deprioritized',
    impact: 'medium',
    likelihood: 'high',
    earlySignal: 'WP-14 start date keeps slipping',
    mitigation: 'Baseline diagnostics (trace viewer) started in parallel with WP-13',
    fallbackPlan: 'CLI-only diagnostics if admin UI deprioritized',
    checkpoint: 'CP-5',
  },
];

// ===========================================================================
// 7. Recommended Sequencing
// ===========================================================================

/**
 * 3 parallel tracks converging at integration checkpoints.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Track A — Experience Core                                       │
 * │                                                                 │
 * │ WP-01 ─┬─ WP-03 ─┬─ WP-06 ──┐                                │
 * │         │         │          │                                  │
 * │ WP-02 ─┤  WP-04 ─┤─ WP-07 ──┼── CP-1 (Demo-Stable)           │
 * │         │         │          │                                  │
 * │         └─ WP-05 ─┤─ WP-08 ──┤                                │
 * │                   │          │                                  │
 * │                   └─ WP-09 ──┘                                 │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Track B — Runtime / Data Core                                   │
 * │                                                                 │
 * │ WP-10 ─── WP-11 ─── WP-12 ─── WP-13                          │
 * │   │         │         │          │                              │
 * │   └── CP-2 ─┘   CP-3 ┘    CP-4 ─┘                             │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Track C — Ops / Reliability                                     │
 * │                                                                 │
 * │                     WP-14 ─── WP-15 (continuous)               │
 * │                       │                                         │
 * │                  CP-5 ┘                                         │
 * ├─────────────────────────────────────────────────────────────────┤
 * │ Convergence                                                     │
 * │                                                                 │
 * │ CP-1 + CP-2 + CP-3 + CP-4 + CP-5 ──── CP-6 (Production)      │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Current status:
 *   WP-01 ✅  WP-02 ✅  WP-03 ✅  WP-04 ✅  WP-05 ✅
 *   WP-06 ✅  WP-07 ✅  WP-08 ✅  WP-09 🔶 (detail surface 보강 필요)
 *   WP-10 ⬜  WP-11 ⬜  WP-12 ⬜  WP-13 ⬜
 *   WP-14 ⬜  WP-15 🔶 (demo verification 진행 중)
 *
 * Next immediate:
 *   1. WP-09 완료 (stock-risk detail execution surface)
 *   2. CP-1 검증 (Demo Gate)
 *   3. WP-10 시작 (runtime provider)
 *   4. WP-15 demo scenario verification 병행
 */
export const SEQUENCING_STATUS = {
  trackA: {
    completed: ['WP-01', 'WP-02', 'WP-03', 'WP-04', 'WP-05', 'WP-06', 'WP-07', 'WP-08'],
    inProgress: ['WP-09'],
    next: [],
  },
  trackB: {
    completed: [],
    inProgress: [],
    next: ['WP-10', 'WP-11', 'WP-12', 'WP-13'],
  },
  trackC: {
    completed: [],
    inProgress: ['WP-15'],
    next: ['WP-14'],
  },
  nextCheckpoint: 'CP-1 (Demo Gate)',
  nextMilestone: 'M1 (P0 UX Stable)',
} as const;
