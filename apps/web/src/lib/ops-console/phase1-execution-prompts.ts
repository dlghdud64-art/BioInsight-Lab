/**
 * phase1-execution-prompts.ts
 *
 * Phase 1 Execution Prompt Pack.
 *
 * 이전 단계에서 합의된 engineering work packages(WP-01~WP-05)를
 * Claude Code가 바로 실행 가능한 구현 프롬프트 세트로 분해한다.
 *
 * 이 파일은 런타임 코드가 아니라 구현 참조용 프롬프트 모음.
 * 새로운 설계를 추가하지 않으며, 이미 합의된 구조를 구현 지시문 단위로 재구성한다.
 *
 * @module ops-console/phase1-execution-prompts
 */

// ===========================================================================
// A. Phase 1 Master Sequence
// ===========================================================================

export const PHASE1_MASTER_SEQUENCE = {
  description: 'Phase 1 프롬프트 실행 순서 및 선행 관계',

  sequence: [
    {
      order: 1,
      packageId: 'P1-01',
      name: 'Shared Operational Semantics Baseline',
      precedence: [],
      parallelWith: [],
      reason: '모든 화면이 같은 상태 의미를 쓰려면 공통 normalization이 먼저 확정되어야 한다. 이 단계 없이 나머지 진행 금지.',
      handoffTo: ['P1-02', 'P1-03', 'P1-04', 'P1-05'],
      checkpoint: 'CP-1A',
    },
    {
      order: 2,
      packageId: 'P1-02',
      name: 'App Shell / Navigation / Orientation Baseline',
      precedence: ['P1-01'],
      parallelWith: [],
      reason: 'shell/navigation 기반이 고정되어야 P1-03~05가 navigation context, return path, orientation strip을 재사용할 수 있다.',
      handoffTo: ['P1-03', 'P1-04', 'P1-05'],
      checkpoint: 'CP-1B',
    },
    {
      order: 3,
      packageId: 'P1-03',
      name: 'Inbox / Dashboard Orchestration',
      precedence: ['P1-01', 'P1-02'],
      parallelWith: ['P1-04'],
      reason: 'P1-01의 shared semantics + P1-02의 shell 위에 cross-module 운영 허브를 구축한다. P1-04와 병렬 가능하지만 둘 다 P1-01/02 완료 후에만.',
      handoffTo: ['P1-05'],
      checkpoint: 'CP-1C',
    },
    {
      order: 3,
      packageId: 'P1-04',
      name: 'Module Landing Surfaces',
      precedence: ['P1-01', 'P1-02'],
      parallelWith: ['P1-03'],
      reason: 'P1-03과 같은 선행 조건. module landing bucket은 inbox semantics와 같은 readiness/blocker 의미를 써야 하므로 P1-01 필수.',
      handoffTo: ['P1-05'],
      checkpoint: 'CP-1C',
    },
    {
      order: 4,
      packageId: 'P1-05',
      name: 'Sourcing Flow Screen Tree',
      precedence: ['P1-01', 'P1-02'],
      parallelWith: [],
      reason: 'sourcing flow는 quotes landing(P1-04) + re-entry context를 재사용하므로 P1-04 후 진행이 가장 안전하다. P1-01/02만 있으면 기술적으로 가능하지만, quotes semantics 확정 후가 이상적.',
      handoffTo: [],
      checkpoint: 'CP-1D',
    },
  ],

  parallelizationNotes: [
    'P1-03과 P1-04는 P1-01/02 완료 후 병렬 실행 가능',
    'P1-05는 P1-04의 quotes landing semantics를 참조하므로 P1-04 완료 후 시작이 안전',
    'P1-01 완료 전에는 어떤 프롬프트도 실행하지 않는다',
  ],
} as const;

// ===========================================================================
// B. Prompt Unit Spec Table
// ===========================================================================

export interface PromptUnitSpec {
  id: string;
  name: string;
  purpose: string;
  targetFiles: string[];
  scope: string[];
  prerequisites: string[];
  completionCriteria: string[];
  prohibitions: string[];
  outputFormat: string;
}

export const PROMPT_UNIT_SPECS: PromptUnitSpec[] = [

  // ─── P1-01 ────────────────────────────────────────────────────────
  {
    id: 'P1-01',
    name: 'Shared Operational Semantics Baseline',
    purpose: '전 화면에서 같은 entity가 같은 readiness/blocker/due/priority를 갖게 하는 공통 normalization 레이어 검증 및 보강',
    targetFiles: [
      'apps/web/src/lib/ops-console/entity-operational-state.ts',
      'apps/web/src/lib/ops-console/consistency-verifier.ts',
    ],
    scope: [
      'EntityOperationalState 인터페이스 완전성 검증',
      'OperationalReadiness 6종 (ready/blocked/needs_review/waiting_external/handoff_ready/terminal) 의미 고정',
      'BlockerClass 4종 (hard_block/review_gate/external_wait/soft_warning) taxonomy 완전성',
      'DueSemantic 5종 (on_track/due_soon/overdue_internal/overdue_external/escalation_required) 계산 로직 검증',
      '4대 도메인 resolver (quote/po/receiving/stock-risk) 출력 일관성 검증',
      'resolveSharedPriority / resolveDueSemantic 공유 함수 완전성',
      'READINESS_LABELS / READINESS_TONES / BLOCKER_CLASS_LABELS 상수 완전성',
      'consistency-verifier의 7종 InconsistencyType 검출 커버리지',
    ],
    prerequisites: [],
    completionCriteria: [
      'TSC 0 error (npx tsc --noEmit)',
      'entity-operational-state.ts 내 4개 domain resolver가 모든 도메인 phase를 빠짐없이 매핑',
      'resolveSharedPriority가 blocker/due/readiness 3가지를 조합하여 p0~p3 산출',
      'READINESS_LABELS에 6개 readiness 모두 라벨 존재',
      'consistency-verifier의 runFullConsistencyCheck가 entity-inbox/handoff/stale 3영역 검증',
      'dashboard-adapter, inbox-adapter, module-landing-adapter가 이 레이어의 resolver를 직접 호출하거나 같은 의미를 사용하는지 확인 가능',
    ],
    prohibitions: [
      '새 domain contract 추가 금지',
      'UI 컴포넌트 수정 금지',
      'dashboard/inbox/landing 페이지 코드 변경 금지',
      '기존 contract 인터페이스 변경 금지',
    ],
    outputFormat: '변경 파일 목록 + 변경 핵심 포인트 + TSC 검증 결과',
  },

  // ─── P1-02 ────────────────────────────────────────────────────────
  {
    id: 'P1-02',
    name: 'App Shell / Navigation / Orientation Baseline',
    purpose: 'app shell, sidebar, bottom nav, detail shell, navigation context 기반 고정',
    targetFiles: [
      'apps/web/src/app/dashboard/_components/dashboard-shell.tsx',
      'apps/web/src/app/_components/dashboard-sidebar.tsx',
      'apps/web/src/app/_components/dashboard-bottom-nav.tsx',
      'apps/web/src/app/dashboard/_components/operational-detail-shell.tsx',
      'apps/web/src/lib/ops-console/navigation-context.ts',
    ],
    scope: [
      'DashboardShell + OpsStoreProvider 구조 확인 및 dark operational tone 적용',
      'DashboardSidebar: Today/Inbox/Search/Quotes/PO/Receiving/Stock-Risk IA 반영, badge count useOpsStoreSafe 기반',
      'DashboardBottomNav: 모바일 반응형 하단 탭, 같은 IA 반영',
      'OperationalDetailShell 6-zone 레이아웃 (context strip, header, ownership, blockers, work area, meta rail) 완전성',
      'navigation-context.ts: 현재 모듈, origin context, return path 상태 모델 확정',
      'orientation strip: 현재 위치 + 돌아갈 경로 표시',
      'settings를 utility/admin cluster로 분리 (sidebar IA 재정렬)',
    ],
    prerequisites: ['P1-01 완료'],
    completionCriteria: [
      'TSC 0 error',
      'sidebar에 Today/Inbox/Search/Quotes/PO/Receiving/Stock-Risk 순서로 IA 반영',
      'settings 관련 항목이 하단 utility cluster로 분리',
      'useOpsStoreSafe 기반으로 provider 외부 페이지 빌드 오류 없음',
      'bottom nav에 동일 IA 반영',
      'OperationalDetailShell에 6개 zone 모두 존재',
      'navigation-context.ts에 currentModule / originEntityId / returnPath 필드 존재',
      '375px viewport에서 sidebar 접힘, bottom nav 표시',
    ],
    prohibitions: [
      'module landing 내부 triage 로직 변경 금지',
      'detail execution console 본문 구조 변경 금지',
      'settings 페이지 전체 구현 금지',
      'inbox/dashboard adapter 로직 변경 금지',
    ],
    outputFormat: '변경 파일 목록 + IA 변경 요약 + navigation-context 필드 목록 + TSC 검증 결과',
  },

  // ─── P1-03 ────────────────────────────────────────────────────────
  {
    id: 'P1-03',
    name: 'Inbox / Dashboard Orchestration',
    purpose: 'Today Hub + 통합 작업함을 cross-module 운영 허브로 고정',
    targetFiles: [
      'apps/web/src/app/dashboard/page.tsx',
      'apps/web/src/app/dashboard/inbox/page.tsx',
      'apps/web/src/lib/ops-console/inbox-adapter.ts',
      'apps/web/src/lib/ops-console/dashboard-adapter.ts',
    ],
    scope: [
      'Today Hub (dashboard/page.tsx): context bar + 우선 작업 큐 + KPI strip + blocker section + ready actions + recovery entries',
      'Inbox Queue (dashboard/inbox/page.tsx): priority/owner/blocker/ready/recovery grouping, filter/sort/group',
      'inbox-adapter: buildFullInbox가 EntityOperationalState의 readiness/blocker를 사용하여 triage group 산출',
      'dashboard-adapter: buildDashboardItems가 같은 semantics로 priority queue, stats, blockers 산출',
      'owner workload summary',
      'filter/search/grouping URL state sync (searchParams 기반)',
      'queue → detail deep-link: 각 inbox item에서 detail route로 직접 이동',
      'dashboard stat → filtered queue handoff: KPI 클릭 시 inbox에 해당 필터 적용',
    ],
    prerequisites: ['P1-01 완료', 'P1-02 완료'],
    completionCriteria: [
      'TSC 0 error',
      'dashboard priority queue 항목 순서가 inbox "now" group 순서와 일치',
      'blocked/review/waiting/ready grouping이 inbox와 dashboard에서 같은 entity에 같은 group 부여',
      'inbox filter 조합 시 0-result 상태에 운영형 empty 메시지 표시',
      'URL state (mode/filter/sort) refresh 후 유지',
      'KPI stat 클릭 → inbox로 이동 시 해당 module/status 필터 적용',
      'deep-link: inbox item 클릭 → 해당 entity detail 페이지 이동',
    ],
    prohibitions: [
      'module landing 전체 구현 금지',
      'detail execution console 리빌드 금지',
      'search/compare flow 확장 금지',
      'backend provider 연동 금지',
      'inbox-adapter/dashboard-adapter의 기존 semantics 변경 금지 (보강만 허용)',
    ],
    outputFormat: '변경 파일 목록 + dashboard 구조 변경 요약 + inbox grouping 규칙 확인 + URL state 필드 목록 + TSC 검증 결과',
  },

  // ─── P1-04 ────────────────────────────────────────────────────────
  {
    id: 'P1-04',
    name: 'Module Landing Surfaces',
    purpose: 'Quotes/PO/Receiving/Stock-Risk landing을 module hub로 고정',
    targetFiles: [
      'apps/web/src/lib/ops-console/module-landing-adapter.ts',
      'apps/web/src/lib/ops-console/sourcing-flow-adapter.ts',
      'apps/web/src/app/dashboard/quotes/page.tsx',
      'apps/web/src/app/dashboard/purchase-orders/page.tsx',
      'apps/web/src/app/dashboard/receiving/page.tsx',
      'apps/web/src/app/dashboard/stock-risk/page.tsx',
    ],
    scope: [
      'module-landing-adapter: 각 모듈별 header stats, priority queue, state-split buckets, downstream surface 빌더',
      'Quotes landing: module operating header + priority queue + state-split tabs (draft/pending_response/compare_ready/selected/converted) + downstream handoff',
      'PO landing: header stats + priority queue + state-split tabs (pending_approval/approved/issued/acknowledged/receiving_handoff) + downstream',
      'Receiving landing: header stats + priority queue + state-split tabs (pending_arrival/in_inspection/ready_to_post/posted/stock_risk_handoff)',
      'Stock-Risk landing: header stats + priority queue + category tabs (shortage/expiry/quarantine) + reorder/recovery entries',
      '각 landing의 bucket count가 inbox module filter count와 일치',
      'priority queue 항목이 dashboard 우선 작업 큐의 해당 모듈 subset과 일치',
      'empty state에 guided navigation (다른 모듈 또는 검색으로 안내)',
    ],
    prerequisites: ['P1-01 완료', 'P1-02 완료'],
    completionCriteria: [
      'TSC 0 error',
      '4개 module landing 모두에 header stats + priority queue + state-split surface 존재',
      'landing bucket counts가 inbox triageGroup module filter와 동일 의미',
      'priority queue items가 dashboard priority subset과 일치',
      '0-item bucket에 운영형 empty 메시지',
      'landing → detail 이동 시 navigation context 유지',
    ],
    prohibitions: [
      'detail execution console deep rewrite 금지',
      'backend/provider integration 금지',
      'dashboard/inbox 핵심 구조 재정의 금지',
      'sourcing-flow-adapter의 기존 contract 변경 금지 (보강만)',
    ],
    outputFormat: '변경 파일 목록 + 각 landing 구조 요약 + bucket/inbox 일치 확인 + TSC 검증 결과',
  },

  // ─── P1-05 ────────────────────────────────────────────────────────
  {
    id: 'P1-05',
    name: 'Sourcing Flow Screen Tree',
    purpose: 'search→results→compare→quote draft→quote detail handoff를 하나의 sourcing flow로 고정',
    targetFiles: [
      'apps/web/src/app/search/**',
      'apps/web/src/app/search/**',
      'apps/web/src/lib/ops-console/reentry-context.ts',
      'apps/web/src/lib/ops-console/sourcing-flow-adapter.ts',
    ],
    scope: [
      're-entry context strip: stock-risk/receiving/expiry에서 검색 진입 시 원본 entity 정보 표시',
      'search intent prefill: re-entry context의 vendor/item/urgency hint를 검색 조건에 반영',
      'candidate narrowing: 검색 결과에서 비교 큐 추가/제거',
      'compare gate: 비교 대상 2개 이상 시 비교 화면 진입 가능',
      'quick create: 비교 없이 바로 견적 초안 생성 경로',
      'compare first: 비교 완료 후 견적 초안 생성 경로',
      'review first: 기존 비교 결과 재검토 후 진행 경로',
      'quote draft bootstrap: 비교 결과 + 선정 정보를 견적 초안에 prefill',
      'quote detail handoff: 초안 완성 → quotes/[quoteId] detail로 이동',
      'return path: 각 단계에서 이전 단계 또는 원본 entity로 복귀 경로',
    ],
    prerequisites: ['P1-01 완료', 'P1-02 완료'],
    completionCriteria: [
      'TSC 0 error',
      're-entry context에서 search로 진입 시 source entity 정보가 context strip에 표시',
      'search 결과에서 compare queue에 추가한 항목이 compare 화면에서 유지',
      'compare → quote draft handoff 시 선정 정보 prefill',
      'quote draft → quote detail handoff 시 route 이동 + navigation context 유지',
      'quick/compare/review 3가지 경로 모두 quote detail까지 도달 가능',
      'return path가 각 단계에서 작동 (search→source entity, compare→search, draft→compare)',
    ],
    prohibitions: [
      'RFQ execution console 전체 리빌드 금지',
      'PO/Receiving/Stock Risk detail 작업 금지',
      'runtime provider/API 연동 금지',
      'AI summary 기능 자체 구현 금지 (placeholder만)',
      'search API 실제 연동 금지 (demo data 기반)',
    ],
    outputFormat: '변경 파일 목록 + flow 단계별 구현 요약 + 3 entry path 검증 + TSC 검증 결과',
  },
];

// ===========================================================================
// C. Claude Code-Ready Execution Prompts
// ===========================================================================

/**
 * 실제 Claude Code에 복붙하여 실행할 수 있는 프롬프트 본문.
 * 각 프롬프트는 단일 구현 목적만 갖는다.
 */
export const EXECUTION_PROMPTS: Record<string, string> = {

  // ═══════════════════════════════════════════════════════════════════
  // P1-01: Shared Operational Semantics Baseline
  // ═══════════════════════════════════════════════════════════════════

  'P1-01': `
## 작업: Shared Operational Semantics Baseline 검증 및 보강

### 목표
entity-operational-state.ts와 consistency-verifier.ts의 완전성을 검증하고,
dashboard/inbox/landing adapter가 같은 normalization 경로를 사용하는지 확인한다.
누락된 도메인 phase 매핑이나 불완전한 resolver가 있으면 보강한다.

### 수정 대상
- apps/web/src/lib/ops-console/entity-operational-state.ts
- apps/web/src/lib/ops-console/consistency-verifier.ts

### 반드시 구현할 것

1. entity-operational-state.ts의 4개 domain resolver 검증:
   - resolveQuoteOperationalState: quote contract의 모든 status를 readiness로 매핑하는지 확인
   - resolvePOOperationalState: PO contract의 모든 status를 readiness로 매핑하는지 확인
   - resolveReceivingOperationalState: receiving contract의 모든 phase를 readiness로 매핑하는지 확인
   - resolveStockRiskOperationalState: stock-risk의 모든 상태를 readiness로 매핑하는지 확인
   - 매핑되지 않은 status/phase가 있으면 추가

2. resolveSharedPriority 함수 검증:
   - blocker class + due semantic + readiness 3가지 조합으로 p0~p3 산출하는지 확인
   - hard_block + overdue → p0
   - review_gate + due_soon → p1
   - ready + on_track → p2
   - waiting_external + on_track → p3
   - 누락된 조합이 있으면 보강

3. resolveDueSemantic 함수 검증:
   - 날짜 기반 계산이 정확한지 확인
   - on_track / due_soon / overdue_internal / overdue_external / escalation_required 5가지 모두 도달 가능한지 확인

4. 상수 완전성 검증:
   - READINESS_LABELS: 6개 readiness 모두 라벨 존재
   - READINESS_TONES: 6개 readiness 모두 tone 존재
   - BLOCKER_CLASS_LABELS: 4개 blocker class 모두 라벨 존재

5. consistency-verifier.ts 검증:
   - verifyEntityInboxConsistency: ready/blocked/waiting mismatch 검출
   - verifyHandoffIntegrity: handoff_ready without targetRoute 검출
   - verifyStaleStates: terminal/handoff entities still actionable 검출
   - 7종 InconsistencyType 모두 최소 1개 경로에서 검출 가능한지 확인

### 하지 말 것
- 새 domain contract 추가하지 마라
- UI 컴포넌트를 수정하지 마라
- dashboard/inbox/landing 페이지 코드를 변경하지 마라
- 기존 contract 인터페이스(quote-rfq-contract, po-approval-contract 등)를 변경하지 마라

### 검증 기준
- npx tsc --noEmit 0 error
- 모든 domain resolver가 fallback 없이 명시적 status 매핑 보유
- resolveSharedPriority가 모든 readiness x blocker 조합에 대해 결정적 우선순위 산출
- READINESS_LABELS 키 수 === OperationalReadiness 유니온 멤버 수

### 출력 방식
전체 파일 재출력 금지.
변경 파일 목록 → 변경 핵심 포인트 → TSC 검증 결과 순서로 보고.
`,

  // ═══════════════════════════════════════════════════════════════════
  // P1-02: App Shell / Navigation / Orientation Baseline
  // ═══════════════════════════════════════════════════════════════════

  'P1-02': `
## 작업: App Shell / Navigation / Orientation Baseline 고정

### 목표
대시보드 app shell, sidebar, bottom nav, detail shell의 IA와 navigation context를 고정한다.
Today/Inbox/Search/Quotes/PO/Receiving/Stock-Risk 순서로 top-level IA를 반영하고,
navigation-context.ts에 현재 모듈/origin/return path 상태 모델을 확정한다.

### 수정 대상
- apps/web/src/app/dashboard/_components/dashboard-shell.tsx
- apps/web/src/app/_components/dashboard-sidebar.tsx
- apps/web/src/app/_components/dashboard-bottom-nav.tsx
- apps/web/src/app/dashboard/_components/operational-detail-shell.tsx
- apps/web/src/lib/ops-console/navigation-context.ts (신규 또는 보강)

### 반드시 구현할 것

1. DashboardSidebar IA 재정렬:
   - 상단 primary cluster: Today(dashboard) → Inbox → Search
   - 중단 module cluster: Quotes → Purchase Orders → Receiving → Stock Risk
   - 하단 utility cluster: Settings / Admin / Team / Billing
   - 각 항목에 적절한 아이콘 + 라벨
   - badge count: useOpsStoreSafe() 기반, inbox unread count + module별 actionable count

2. DashboardBottomNav:
   - 모바일(md 이하)에서만 표시
   - Today / Inbox / Quotes / PO / Receiving 5개 탭 (Stock-Risk는 PO 또는 메뉴에서 접근)
   - active tab 표시

3. DashboardShell:
   - dark operational tone (bg-slate-950 배경)
   - sidebar + main content 영역 분리
   - OpsStoreProvider가 sidebar + content + bottom nav 모두 감싸는 구조 확인

4. OperationalDetailShell:
   - 6-zone 레이아웃 완전성 확인:
     Zone 1: ContextStrip (upstream lineage)
     Zone 2: EntityHeader (status + title + key metadata)
     Zone 3: OwnershipSurface (담당자 + 에스컬레이션)
     Zone 4: BlockerSurface (blocker list + resolution)
     Zone 5: WorkArea + CommandBar (본문 + 하단 CTA)
     Zone 6: MetaRail (타임라인 + audit trail)

5. navigation-context.ts:
   - NavigationContext 타입: { currentModule, originEntityType?, originEntityId?, returnPath, breadcrumbs }
   - useNavigationContext() hook: URL searchParams에서 origin/return 읽기
   - setNavigationContext(): 화면 이동 시 searchParams에 origin/return 쓰기
   - OrientationStrip 컴포넌트용 데이터 빌더: 현재 위치 + 돌아갈 경로

### 하지 말 것
- module landing 내부 triage 로직을 변경하지 마라
- detail execution console 본문(work area zone 내부)을 변경하지 마라
- settings 페이지 전체를 구현하지 마라
- inbox-adapter/dashboard-adapter의 로직을 변경하지 마라

### 검증 기준
- npx tsc --noEmit 0 error
- sidebar에 Today/Inbox/Search/Quotes/PO/Receiving/Stock-Risk 순서로 7개 primary + module 항목 존재
- settings 관련 항목이 하단 utility cluster에 위치
- useOpsStoreSafe 사용하여 provider 외부 페이지에서 빌드 오류 없음
- navigation-context.ts에 currentModule / originEntityId / returnPath 필드 존재
- 375px viewport에서 sidebar 접힘 + bottom nav 표시 확인

### 출력 방식
전체 파일 재출력 금지.
변경 파일 목록 → IA 변경 요약 → navigation-context 필드 목록 → TSC 검증 결과 순서로 보고.
`,

  // ═══════════════════════════════════════════════════════════════════
  // P1-03: Inbox / Dashboard Orchestration
  // ═══════════════════════════════════════════════════════════════════

  'P1-03': `
## 작업: Inbox / Dashboard Orchestration — Cross-Module 운영 허브 고정

### 목표
Today Hub와 통합 작업함(Inbox)을 cross-module 운영 허브로 고정한다.
dashboard-adapter와 inbox-adapter가 P1-01의 shared semantics를 통해
같은 entity에 같은 priority/readiness/blocker를 부여하는지 확인하고,
URL state sync + queue→detail deep-link + stat→filtered queue handoff를 구현한다.

### 수정 대상
- apps/web/src/app/dashboard/page.tsx
- apps/web/src/app/dashboard/inbox/page.tsx
- apps/web/src/lib/ops-console/inbox-adapter.ts (보강만)
- apps/web/src/lib/ops-console/dashboard-adapter.ts (보강만)

### 반드시 구현할 것

1. Today Hub (dashboard/page.tsx) 구조 확정:
   - Context Bar: 오늘 날짜, 사용자명, 처리 필요 N건 badge
   - Priority Queue: 가장 긴급한 작업 목록 (p0→p1 순서), 각 항목에 module/status/owner/다음액션 표시
   - KPI Strip: 이번 주 핵심 운영 수치 (견적 수, 응답 지연, 구매 전환율, 재주문 후보, 폐기 예정)
     - 각 KPI 클릭 → inbox로 이동 + 해당 module/status 필터 적용
   - Blocker Section: hard_block + review_gate 항목만 별도 표시
   - Ready Actions: ready 상태 항목에서 바로 실행 가능한 CTA
   - Recovery Entries: 재진입/재주문/대체 소싱 후보

2. Inbox Queue (dashboard/inbox/page.tsx) 구조 확정:
   - Triage Groups: now / soon / waiting / blocked 4그룹 탭
   - 각 그룹 내 priority 정렬 (p0→p3)
   - 필터: module (quote/po/receiving/stock_risk), readiness, owner, due semantic
   - 정렬: priority / due date / last updated
   - 그룹핑: by module / by owner / by readiness
   - 각 item에 entity summary + readiness badge + blocker reason (있으면) + 다음 액션 링크
   - 0-result 상태: "조건에 맞는 항목이 없습니다. 필터를 조정하거나 다른 그룹을 확인하세요." 운영형 메시지

3. URL State Sync:
   - searchParams: mode (triage group), filter_module, filter_readiness, filter_owner, sort, group_by
   - 페이지 refresh 후 모든 필터/정렬/그룹핑 유지
   - 뒤로가기 시 이전 필터 상태 복원

4. Queue→Detail Deep-link:
   - inbox item 클릭 → /dashboard/quotes/[id], /dashboard/purchase-orders/[id], /dashboard/receiving/[id], /dashboard/stock-risk 등으로 이동
   - 이동 시 navigation-context에 origin=inbox, returnPath=/dashboard/inbox?현재필터 설정

5. Dashboard Stat→Filtered Queue Handoff:
   - KPI stat 클릭 시 inbox로 이동하면서 해당 조건을 searchParams에 설정
   - 예: "응답 지연 3건" 클릭 → /dashboard/inbox?filter_module=quote&filter_readiness=waiting_external

6. inbox-adapter 보강 (기존 semantics 유지):
   - buildFullInbox 결과의 triageGroup이 EntityOperationalState의 readiness와 일치하는지 확인
   - 불일치 발견 시 triageGroup 산출 로직 보강

7. dashboard-adapter 보강 (기존 semantics 유지):
   - buildDashboardItems의 priority queue가 inbox "now" group의 subset인지 확인
   - stats 항목에 drillDownRoute 필드 추가 (없으면)

### 하지 말 것
- module landing 전체를 구현하지 마라
- detail execution console을 리빌드하지 마라
- search/compare flow를 확장하지 마라
- backend provider를 연동하지 마라
- inbox-adapter/dashboard-adapter의 기존 buildFullInbox/buildDashboardItems semantics를 바꾸지 마라 (보강만)

### 검증 기준
- npx tsc --noEmit 0 error
- dashboard priority queue의 entity 순서가 inbox "now" group의 같은 module entity 순서와 일치
- blocked 항목이 inbox "blocked" group에, waiting 항목이 inbox "waiting" group에 일관 배치
- 0-result filter 조합 시 운영형 empty 메시지 표시
- URL searchParams refresh 후 filter/sort/group 유지
- KPI 클릭 → inbox 이동 시 해당 필터 적용 확인
- inbox item 클릭 → detail 이동 시 navigation context 설정 확인

### 출력 방식
전체 파일 재출력 금지.
변경 파일 목록 → dashboard 구조 변경 요약 → inbox grouping 규칙 확인 → URL state 필드 목록 → TSC 검증 결과 순서로 보고.
`,

  // ═══════════════════════════════════════════════════════════════════
  // P1-04: Module Landing Surfaces
  // ═══════════════════════════════════════════════════════════════════

  'P1-04': `
## 작업: Module Landing Surfaces — 4개 모듈 허브 고정

### 목표
Quotes/PO/Receiving/Stock-Risk 4개 module landing 페이지를
단순 리스트가 아닌 module hub(operating header + priority queue + state-split surface + downstream)로 고정한다.
각 landing의 bucket semantics가 inbox triageGroup과 일치하도록 한다.

### 수정 대상
- apps/web/src/lib/ops-console/module-landing-adapter.ts
- apps/web/src/lib/ops-console/sourcing-flow-adapter.ts
- apps/web/src/app/dashboard/quotes/page.tsx
- apps/web/src/app/dashboard/purchase-orders/page.tsx
- apps/web/src/app/dashboard/receiving/page.tsx
- apps/web/src/app/dashboard/stock-risk/page.tsx

### 반드시 구현할 것

1. module-landing-adapter 보강:
   - buildModuleLandingData(module) 함수가 아래를 반환:
     a. headerStats: { total, actionable, blocked, waiting, completed }
     b. priorityQueue: 해당 모듈의 p0~p1 항목 (dashboard priority subset)
     c. stateBuckets: 모듈별 상태 탭 배열 (각 bucket에 count + items)
     d. downstreamSurface: handoff_ready 항목 (다음 모듈로 인계 가능)
   - bucket key가 inbox triageGroup의 module filter와 같은 의미

2. Quotes Landing (quotes/page.tsx):
   - Module Operating Header: 견적 총 N건, 처리 필요 N건, 응답 대기 N건, 비교 가능 N건
   - Priority Queue: p0~p1 견적 목록 (응답 지연/비교 미완료/미전환 등)
   - State-Split Tabs: draft → pending_response → compare_ready → selected → converted_to_po
   - 각 tab 내 항목: 견적번호, 요청자, 공급사 수, 응답률, SLA, readiness badge, 다음 액션
   - Downstream: converted_to_po 항목에서 PO detail 링크

3. PO Landing (purchase-orders/page.tsx):
   - Header: PO 총건, 승인 대기, 발행 대기, 확인 대기, 입고 인계
   - Priority Queue: p0~p1 PO 목록
   - State-Split Tabs: pending_approval → approved → issued → acknowledged → receiving_handoff
   - Downstream: receiving_handoff 항목에서 receiving detail 링크

4. Receiving Landing (receiving/page.tsx):
   - Header: 입고 총건, 도착 대기, 검수 중, 반영 가능, 반영 완료
   - Priority Queue: p0~p1 입고 목록
   - State-Split Tabs: pending_arrival → in_inspection → ready_to_post → posted → stock_risk_handoff
   - Downstream: stock_risk_handoff 항목에서 stock-risk 링크

5. Stock-Risk Landing (stock-risk/page.tsx):
   - Header: 리스크 총건, 부족, 만료 임박, 격리, 재주문 후보
   - Priority Queue: p0~p1 리스크 목록
   - Category Tabs: shortage → expiry → quarantine → reorder_candidate
   - Recovery: 재주문 CTA → sourcing flow 진입 (re-entry context 설정)

6. Empty State:
   - 각 bucket에 0건일 때: "[상태명] 항목이 없습니다." + 다른 탭 안내 또는 검색 CTA

7. Landing→Detail Navigation:
   - 각 항목 클릭 → detail route 이동 + navigation-context에 origin=module_landing, returnPath 설정

### 하지 말 것
- detail execution console을 deep rewrite하지 마라
- backend/provider를 연동하지 마라
- dashboard/inbox 핵심 구조를 재정의하지 마라
- sourcing-flow-adapter의 기존 contract를 변경하지 마라 (보강만)
- 기존 module-landing-adapter의 shared semantics를 깨지 마라

### 검증 기준
- npx tsc --noEmit 0 error
- 4개 module landing 모두에 header stats + priority queue + state-split surface 존재
- Quotes landing의 "pending_response" bucket count === inbox의 quote + waiting_external filter count
- PO landing의 "pending_approval" bucket count === inbox의 po + needs_review filter count
- 각 landing의 priority queue items ⊆ dashboard priority queue items (해당 모듈)
- 0-item bucket에 운영형 empty 메시지 존재
- landing item 클릭 → detail 이동 + navigation context 유지

### 출력 방식
전체 파일 재출력 금지.
변경 파일 목록 → 각 landing 구조 요약 → bucket/inbox 일치 확인 → TSC 검증 결과 순서로 보고.
`,

  // ═══════════════════════════════════════════════════════════════════
  // P1-05: Sourcing Flow Screen Tree
  // ═══════════════════════════════════════════════════════════════════

  'P1-05': `
## 작업: Sourcing Flow Screen Tree — 소싱 흐름 화면 트리 고정

### 목표
search→results→compare→quote draft→quote detail handoff를
하나의 sourcing flow screen tree로 고정한다.
재진입 context 유지, 3가지 entry path(quick/compare/review) 분기를 명확히 한다.

### 수정 대상
- apps/web/src/app/search/ 하위 파일들
- apps/web/src/app/search/ 하위 파일들
- apps/web/src/lib/ops-console/reentry-context.ts
- apps/web/src/lib/ops-console/sourcing-flow-adapter.ts

### 반드시 구현할 것

1. ReentryContext (reentry-context.ts) 확정:
   - ReentryContext 타입: {
       sourceEntityType: 'stock_risk' | 'receiving' | 'expiry' | 'manual',
       sourceEntityId?: string,
       sourceRoute: string,
       vendorHints: string[],
       itemHints: string[],
       urgency: 'normal' | 'urgent' | 'critical',
       reason: string,
     }
   - useReentryContext() hook: URL searchParams에서 re-entry 정보 읽기
   - buildReentrySearchParams(): stock-risk/receiving/expiry에서 search로 이동할 때 searchParams 생성

2. Search 화면 보강:
   - Re-entry Context Strip: sourceEntityType이 있으면 화면 상단에 원본 entity 정보 표시
     "재고 부족 [품목명]에서 대체 소싱 진입 — 원본으로 돌아가기"
   - Search Intent Prefill: re-entry context의 itemHints를 검색어에, vendorHints를 공급사 필터에 반영
   - 검색 결과에서 Compare Queue 추가/제거: 각 결과 행에 "비교 추가" 버튼, 추가된 항목 count badge
   - Compare Gate: 비교 큐 2개 이상 → "비교하기" CTA 활성화

3. Compare 화면 보강:
   - 비교 대상 2개 이상 표시, 핵심 차이 요약
   - 선정/제외 토글
   - Quick Create Path: 비교 없이 바로 견적 초안 → "비교 건너뛰고 견적 요청" CTA (1개 선택 시)
   - Compare First Path: 비교 완료 후 → "선정 제품으로 견적 요청" CTA
   - Review First Path: 이전 비교 결과 존재 시 → "이전 비교 재검토" → 선정 확인 → 견적 요청

4. Quote Draft Bootstrap:
   - 비교 결과 + 선정 정보를 견적 초안 양식에 prefill
   - sourcing-flow-adapter의 buildQuoteDraftFromComparison() 함수 확인/보강
   - 초안 완성 후 → quotes/[quoteId] detail로 이동

5. Quote Detail Handoff:
   - 초안 생성 완료 → /dashboard/quotes/[quoteId]로 이동
   - navigation-context에 origin=sourcing_flow, returnPath=/search?현재조건 설정

6. Return Path 전체:
   - search → source entity (re-entry context의 sourceRoute)
   - compare → search (현재 검색 조건 유지)
   - quote draft → compare (현재 비교 상태 유지)
   - quote detail → source entity 또는 quotes landing

### 하지 말 것
- RFQ execution console 전체를 리빌드하지 마라
- PO/Receiving/Stock Risk detail을 이 프롬프트에서 작업하지 마라
- runtime provider/API를 연동하지 마라
- AI summary 기능을 실제 구현하지 마라 (placeholder/mock만)
- search API를 실제 연동하지 마라 (demo data 기반)

### 검증 기준
- npx tsc --noEmit 0 error
- stock-risk에서 "재주문 검토" 클릭 → search 진입 시 re-entry context strip 표시
- search 결과에서 compare queue에 2개 추가 → compare 화면 진입 가능
- compare에서 1개 선정 → quote draft에 해당 제품 정보 prefill
- quote draft 완성 → quotes/[id] detail 이동 + navigation context 설정
- quick/compare/review 3가지 경로 모두 quote detail까지 도달 가능
- 각 단계에서 return path 클릭 → 이전 화면으로 복귀 + 상태 유지

### 출력 방식
전체 파일 재출력 금지.
변경 파일 목록 → flow 단계별 구현 요약 → 3 entry path 검증 → return path 검증 → TSC 검증 결과 순서로 보고.
`,
};

// ===========================================================================
// D. Phase 1 Integration Checkpoints
// ===========================================================================

export const PHASE1_CHECKPOINTS = {

  'CP-1A': {
    name: 'Shared Semantics Fixed',
    afterPackage: 'P1-01',
    completionCriteria: [
      'entity-operational-state.ts 내 4개 domain resolver가 모든 domain phase를 빠짐없이 readiness로 매핑',
      'resolveSharedPriority가 readiness x blocker 조합에서 결정적 p0~p3 산출',
      'READINESS_LABELS, READINESS_TONES, BLOCKER_CLASS_LABELS 상수 완전 (각각 6/6/4개)',
      'consistency-verifier runFullConsistencyCheck가 entity-inbox/handoff/stale 3영역 검증',
      'dashboard-adapter, inbox-adapter가 같은 normalization 의미를 사용하는 것이 확인됨',
    ],
    verificationCommand: 'npx tsc --noEmit',
    blockedIf: [
      '어떤 domain resolver에 unmapped status가 존재',
      'resolveSharedPriority에 unreachable priority tier가 존재',
    ],
  },

  'CP-1B': {
    name: 'Navigation Shell Fixed',
    afterPackage: 'P1-02',
    completionCriteria: [
      'sidebar에 Today/Inbox/Search/Quotes/PO/Receiving/Stock-Risk IA 순서 반영',
      'settings 관련 항목이 하단 utility cluster에 위치',
      'bottom nav에 모바일용 5개 탭 반영',
      'navigation-context.ts에 currentModule / originEntityId / returnPath 필드 존재',
      'OperationalDetailShell에 6개 zone 모두 존재',
      'useOpsStoreSafe 기반으로 provider 외부 빌드 오류 없음',
    ],
    verificationCommand: 'npx tsc --noEmit',
    blockedIf: [
      'sidebar IA가 기존 순서와 동일 (변경 미적용)',
      'navigation-context.ts가 존재하지 않거나 핵심 필드 누락',
    ],
  },

  'CP-1C': {
    name: 'Cross-Module Work Hubs Usable',
    afterPackage: 'P1-03 + P1-04',
    completionCriteria: [
      'dashboard priority queue entity 순서 === inbox "now" group 순서 (같은 모듈)',
      '4개 module landing 모두에 header stats + priority queue + state-split surface 존재',
      'landing bucket semantics === inbox triageGroup module filter semantics',
      'inbox filter 조합 0-result → 운영형 empty 메시지',
      'URL searchParams refresh 후 filter/sort/group 유지',
      'KPI stat 클릭 → inbox 필터 적용 이동',
      'landing item 클릭 → detail + navigation context',
      'inbox item 클릭 → detail + navigation context',
    ],
    verificationCommand: 'npx tsc --noEmit',
    blockedIf: [
      'dashboard priority 순서와 inbox "now" 순서가 불일치',
      'landing bucket count와 inbox filter count가 다른 의미',
      'URL state가 refresh 시 유실',
    ],
  },

  'CP-1D': {
    name: 'Sourcing Tree Usable',
    afterPackage: 'P1-05',
    completionCriteria: [
      'stock-risk → search 진입 시 re-entry context strip 표시',
      'search → compare → quote draft → quote detail handoff 연속 이동 가능',
      'quick/compare/review 3가지 경로 모두 quote detail 도달',
      're-entry context strip에서 "원본으로 돌아가기" 클릭 → source entity 이동',
      'return path가 각 단계에서 이전 화면으로 복귀',
      'compare queue 항목이 화면 이동 후에도 유지',
    ],
    verificationCommand: 'npx tsc --noEmit',
    blockedIf: [
      're-entry context가 search 진입 시 유실',
      'compare → quote draft handoff에서 선정 정보 유실',
      '3개 entry path 중 하나라도 quote detail에 도달 불가',
    ],
  },
} as const;

// ===========================================================================
// E. Phase 1 Integration Checklist
// ===========================================================================

export const PHASE1_INTEGRATION_CHECKLIST = {

  semanticsConsistency: [
    {
      id: 'IC-01',
      check: 'dashboard와 inbox의 상태 의미가 같은가',
      how: 'dashboard priority queue의 entity readiness와 inbox triageGroup 매핑이 같은 EntityOperationalState resolver를 경유하는지 코드 확인',
      failSignal: '같은 entity가 dashboard에서는 ready인데 inbox에서는 blocked',
    },
    {
      id: 'IC-02',
      check: 'module landing bucket이 inbox semantics와 충돌하지 않는가',
      how: 'landing의 stateBuckets key와 inbox triageGroup의 module filter가 같은 readiness 의미인지 대조',
      failSignal: 'landing "pending_response" bucket과 inbox "waiting" group에 다른 entity가 포함',
    },
    {
      id: 'IC-03',
      check: 'ready/blocked/review/waiting_external/handoff_ready가 screen마다 같은 뜻인가',
      how: 'dashboard, inbox, 4개 landing, 4개 detail에서 각 readiness 라벨/색상/배치 대조',
      failSignal: '어떤 화면에서 "blocked"가 다른 화면에서는 "needs_review"로 분류',
    },
  ],

  navigationIntegrity: [
    {
      id: 'IC-04',
      check: 'navigation context와 return path가 screen tree 전반에서 유지되는가',
      how: 'inbox→detail→back, landing→detail→back, search→compare→draft→quote→back 각 경로에서 returnPath 유지 확인',
      failSignal: 'detail에서 뒤로가기 시 inbox/landing이 아닌 다른 페이지로 이동',
    },
    {
      id: 'IC-05',
      check: 'search re-entry source context가 compare/draft/quote handoff까지 살아 있는가',
      how: 'stock-risk → search → compare → draft → quote 전체 flow에서 sourceEntityId 유지 확인',
      failSignal: 'compare 화면에서 source entity 정보가 사라짐',
    },
  ],

  deadElementCheck: [
    {
      id: 'IC-06',
      check: 'dead route가 없는가',
      how: '모든 navigation link의 target route가 실제 존재하는 페이지인지 확인',
      failSignal: '클릭 시 404 또는 blank page',
    },
    {
      id: 'IC-07',
      check: 'dead filter가 없는가',
      how: '모든 filter option이 실제 데이터에서 유효한 값을 필터하는지 확인',
      failSignal: '필터 선택 후 항상 0 결과이고 해당 조건의 entity가 존재함',
    },
    {
      id: 'IC-08',
      check: 'decorative stat이 없는가',
      how: '모든 KPI/stat에 drill-down route가 있고 클릭 시 해당 필터 적용 inbox/landing으로 이동하는지 확인',
      failSignal: 'stat 클릭 시 아무 반응 없거나 drill-down 불가',
    },
    {
      id: 'IC-09',
      check: 'decorative tab이 없는가',
      how: '모든 tab이 실제 다른 데이터 세트를 보여주는지 확인',
      failSignal: '두 탭이 같은 데이터를 표시하거나 탭 전환 시 변화 없음',
    },
  ],

  crossModuleHandoff: [
    {
      id: 'IC-10',
      check: 'handoff_ready entity가 downstream module에서 수신 가능한가',
      how: 'quote handoff_ready → PO landing에 인계 항목 표시되는지, PO handoff_ready → receiving landing에 표시되는지',
      failSignal: 'handoff_ready이지만 downstream module에서 해당 entity를 볼 수 없음',
    },
    {
      id: 'IC-11',
      check: 'terminal entity가 inbox에서 제거되었는가',
      how: 'terminal 상태의 entity가 inbox now/soon group에 남아있지 않은지 확인',
      failSignal: 'terminal entity가 inbox actionable group에 표시',
    },
  ],
} as const;
