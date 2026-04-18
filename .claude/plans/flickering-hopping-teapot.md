# Ops Console Enterprise UX Refactor

## Context

Ops Console의 운영 모델(queue semantics, assignment, accountability, daily review, SLA governance, remediation)은 모두 잠겨 있다. 하지만 UI는 consumer SaaS card 느낌이다 — 둥근 컬러 카드, 흩어진 metadata, 약한 CTA, decorative stat widgets. 이 리팩터링은 기능 변경 없이 시각 문법과 운영 surface를 enterprise operational console 수준으로 승격시킨다.

**Baseline**: `b96eff9` (V1 pilot observation + build fix)

**절대 금지**: 새 기능/workflow 추가, semantics/logic 변경, dark mode only, gradient/glow cosmetic, 페이지 수 증가

---

## Phase 1: Visual Grammar Freeze

**파일**: `apps/web/src/lib/work-queue/console-visual-grammar.ts` (NEW)
**테스트**: `apps/web/src/__tests__/lib/work-queue/console-visual-grammar.test.ts` (NEW)

순수 정의 파일. 모든 console surface가 참조하는 canonical design token.

### 1A. Typography Scale

```ts
export const TYPOGRAPHY = {
  pageTitle:    "text-lg font-semibold tracking-tight",    // 페이지 제목
  sectionTitle: "text-sm font-semibold uppercase tracking-wide text-muted-foreground", // 섹션 헤더
  rowTitle:     "text-sm font-medium",                     // 행 제목
  metadata:     "text-xs text-muted-foreground",           // 메타데이터
  timestamp:    "text-xs tabular-nums text-muted-foreground", // 시간/숫자
  badge:        "text-[10px] font-medium",                 // 배지 텍스트
  cta:          "text-xs font-medium",                     // CTA 버튼
} as const;
```

### 1B. Spacing Scale

```ts
export const SPACING = {
  sectionGap:     "space-y-6",     // 섹션 간
  groupGap:       "space-y-1",     // 그룹 내 행 간 (tight)
  rowPadding:     "px-3 py-2",     // 행 내부
  panelPadding:   "p-4",           // 패널 내부
  metadataGap:    "gap-3",         // 메타데이터 항목 간
  ctaCluster:     "gap-2",         // CTA 버튼 간
  stickyHeader:   "py-2 px-3",    // 고정 헤더
  stripPadding:   "px-3 py-1.5",  // summary strip
} as const;
```

### 1C. Surface Hierarchy (3단 이내)

```ts
export const SURFACE = {
  page:       "bg-background",                                    // 페이지 배경
  primary:    "bg-card border rounded-md",                        // 주 작업 영역
  secondary:  "bg-muted/30",                                      // 보조 패널
  alertStrip: "border-l-[3px] bg-muted/20 px-3 py-2 rounded-sm", // 경고 스트립
  summaryStrip: "border-b bg-muted/10 px-3 py-2",                // 요약 스트립
  sectionHeader: "border-b pb-2",                                  // 섹션 구분
  row:        "border-b border-border/50 hover:bg-muted/30 transition-colors", // 행
  rowSelected: "bg-muted/50 border-b border-border/50",           // 선택된 행
} as const;
```

규칙: box-shadow 금지. border/divider 중심. radius 최소(rounded-sm or rounded-md만).

### 1D. Severity Indicator Mapping

PriorityTier → 시각 토큰. 배경색이 아닌 **왼쪽 3px 보더 + dot**로 severity 표현.

```ts
export const SEVERITY_INDICATORS: Record<PriorityTier, SeverityIndicator> = {
  urgent_blocker:  { borderColor: "border-l-red-500",    dotColor: "red",    dotPulse: true,  textColor: "text-red-700" },
  approval_needed: { borderColor: "border-l-orange-400", dotColor: "amber",  dotPulse: false, textColor: "text-orange-700" },
  action_needed:   { borderColor: "border-l-yellow-400", dotColor: "yellow", dotPulse: false, textColor: "text-yellow-700" },
  monitoring:      { borderColor: "border-l-blue-300",   dotColor: "blue",   dotPulse: false, textColor: "text-blue-600" },
  informational:   { borderColor: "border-l-gray-200",   dotColor: "slate",  dotPulse: false, textColor: "text-muted-foreground" },
} as const;
```

규칙: `bg-red-50`, `bg-orange-50` 등 행/카드 배경색 완전 제거. severity는 오직 left border + dot + text color.

### 1E. CTA Hierarchy

```ts
export const CTA_RULES = {
  primary:     { variant: "default", size: "sm", maxPerRow: 1 },
  secondary:   { variant: "outline", size: "sm", maxPerRow: 2 },
  destructive: { variant: "destructive", size: "sm", maxPerRow: 1 },
  overflow:    { variant: "ghost", size: "sm", inDetailOnly: true },
} as const;
```

규칙: 행에 primary 1개 + secondary 최대 2개. 나머지는 detail panel의 overflow로.

### 1F. Queue Column Definitions

```ts
export const QUEUE_COLUMNS = [
  { id: "severity",   label: "",     width: "w-1",     align: "left"  },
  { id: "title",      label: "항목",  width: "flex-1 min-w-0", align: "left" },
  { id: "state",      label: "상태",  width: "w-20",    align: "center" },
  { id: "owner",      label: "담당",  width: "w-16",    align: "center" },
  { id: "whyHere",    label: "사유",  width: "w-32",    align: "left"  },
  { id: "age",        label: "경과",  width: "w-16",    align: "right" },
  { id: "cta",        label: "",     width: "w-24",    align: "right" },
] as const;
```

### 1G. Metadata Placement Order (canonical)

모든 surface에서 동일 순서:
1. current state / substatus
2. owner / assignee
3. latest action
4. last updated / relative time
5. SLA / stale / breach
6. linked entity / upstream-downstream
7. remediation or handoff note

### 1H. Tests (~12 tests)

- 모든 PriorityTier에 severity indicator 매핑 존재
- severity indicator에 `bg-` 토큰 미사용 (anti-pattern gate)
- column ID 고유성
- CTA variant가 유효한 Button variant만 참조
- typography scale 3-tier 완성도
- metadata order 7단계 완성도

---

## Phase 2: Work Queue Console Surface Refactor (1순위)

**대상**: `apps/web/src/components/dashboard/work-queue-console.tsx` (1137 lines → ~300 lines orchestrator)

### 2A. 추출: `console-empty-state.tsx` (NEW)

**경로**: `apps/web/src/components/dashboard/console/console-empty-state.tsx`

기존 `EDGE_STATE_MESSAGES` (11개) + `EmptyState` UI 컴포넌트 활용. 운영 언어로 empty state 통일.

```ts
interface ConsoleEmptyStateProps {
  stateId: EdgeStateId;
  className?: string;
}
```

empty 메시지 예시 (기존 EDGE_STATE_MESSAGES 활용):
- `empty_queue`: "현재 처리할 큐 항목이 없습니다"
- `no_daily_review_items`: "오늘 검토할 항목이 없습니다"
- `no_governance_issues`: "거버넌스 이슈가 감지되지 않았습니다"

### 2B. 추출: `queue-row.tsx` (NEW — Pattern B 구현)

**경로**: `apps/web/src/components/dashboard/console/queue-row.tsx`

현재 `ConsoleQueueCard` (lines 377-523, card 레이아웃) → table row로 변환.

```ts
interface QueueRowProps {
  item: GroupedItem;
  onSelect: (item: GroupedItem) => void;
  isSelected?: boolean;
}
```

행 구조 (shadcn Table 사용):
| 열 | 내용 | 스타일 |
|---|---|---|
| severity | 3px left border (SEVERITY_INDICATORS) | `w-1 p-0` |
| title | 제목 + entity type micro label | `flex-1 min-w-0 truncate` |
| state | assignment state Badge (dot variant) | `w-20 text-center` |
| owner | OWNER_ROLE_LABELS text | `w-16 text-center micro` |
| whyHere | urgencyReason ∥ tier description | `w-32 micro` |
| age | formatRelativeTime(updatedAt) | `w-16 text-right tabular-nums` |
| cta | primaryCtaLabel Button (1개만) | `w-24 text-right` |

**제거 대상**:
- tier 배경색 (bg-red-50 등)
- 다중 CTA 버튼 (secondary → detail panel로 이동)
- 6+ inline badge 나열 → 고정 column 배치
- handoff info box (detail panel로 이동)

**보존 대상**:
- useExecuteOpsAction() / useAssignmentAction() 훅 연결
- navigateToEntity() 로직
- isPending 상태 CTA disable

### 2C. 추출: `queue-detail-panel.tsx` (NEW — Pattern D 구현)

**경로**: `apps/web/src/components/dashboard/console/queue-detail-panel.tsx`

shadcn `Sheet` (slide-out right panel) 사용.

```ts
interface QueueDetailPanelProps {
  item: GroupedItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

패널 섹션 (위→아래):
1. **Context Strip (Pattern C)**: title + tier badge + entity type + score
2. **State/Owner Row**: assignmentState + owner + shouldActorAct indicator
3. **Why Here**: urgencyReason + priorityTier description
4. **SLA/Age**: latest action + age + SLA breach indicator
5. **Action Zone**: primary CTA (large) + secondary CTAs (claim, mark_in_progress, etc.)
6. **Evidence Zone**: handoff history, blocked reason, assignment history (payload fields)
7. **Navigation**: entity detail link via navigateToEntity()

### 2D. Summary Strip 리팩터 (Pattern A 적용)

현재 `ConsoleSummaryBar` (lines 255-319) — 컬러 칩 나열 → compact operational strip.

변경:
- 컬러 배경 칩 → neutral surface + count + severity text color only
- label + count + last updated 통일
- 순서: urgent → overdue → approval → action → monitoring

### 2E. Group Section 리팩터

현재 `ConsoleGroupSection` (lines 331-364) — card 컨테이너 → section header + Table.

변경:
- 컬러 배경 제거
- 아이템은 `<Table>` + `<QueueRow>` 렌더링
- section header: `TYPOGRAPHY.sectionTitle` + count badge + collapse chevron
- `SURFACE.sectionHeader` 스타일 적용

### 2F. Orchestrator 리팩터

`work-queue-console.tsx`가 ~300 lines orchestrator로 축소:
- 제거: ConsoleQueueCard, SummaryChip, TIER_STYLES, OWNER_BADGE_STYLES, ASSIGNMENT_STATE_STYLES 등 15개 inline component
- 유지: WorkQueueConsole (export), mode toggle, ConsoleViewTabs, navigateToEntity
- 추가: `useState<GroupedItem | null>` for selected item + Sheet state
- mode toggle → `CONSOLE_MODE_DEFS` + `CONSOLE_MODE_ORDER` 참조 (현재 하드코딩)

### 2G. Daily Review → Row 변환

**경로**: `apps/web/src/components/dashboard/console/daily-review-row.tsx` (NEW)

현재 `DailyReviewCard` (lines 664-761) → table row.

행 구조:
| severity dot | title | category label | carry-over badge | escalation count | primary CTA |

DailyReviewView에서 category를 section header + Table로 렌더링. CATEGORY_STYLES 컬러 배경 제거.

### 2H. Governance → Table 변환

**경로**: `apps/web/src/components/dashboard/console/governance-table.tsx` (NEW)

현재 GovernanceView + 4개 card component (lines 939-1116) → 3개 Table:
1. **Cadence Table**: step name | description | pending count | status
2. **SLA Table**: category | compliance % | within | warning | breached | total
3. **Intervention Table**: case | detail | affected items/users

컬러 배경 제거. severity는 text color + left border only.

### 2I. Remediation → Table 변환

**경로**: `apps/web/src/components/dashboard/console/remediation-table.tsx` (NEW)

현재 RemediationView + RemediationItemCard (lines 765-935) → Table layout:
1. **Summary Stats**: 4-stat strip (neutral bg, bold count, text-color severity)
2. **Bottleneck Table**: type | severity badge | detail | linked remediation
3. **Remediation Table**: summary | bottleneck type | owner | status | CTA
4. **Report Signals**: compact strip

---

## Phase 3: Dashboard Surface Refactor (3순위 — Phase 2 완료 후)

**대상**: `apps/web/src/app/dashboard/page.tsx` (808 lines)

### 현재 문제
- KPI 카드 (lines 340-392): decorative stat display, 약한 시각 계층
- 액션 카드 (lines 187-335): metadata 흩어짐, 10px micro text에 urgency 숨김
- compare stats (lines 284-324): multi-line micro text, 스캔 어려움

### 리팩터링 방향

첫 화면 순서 재배치:
1. **Urgent Blockers Strip** — Pattern A (operational summary strip)
2. **Overdue/Stale Strip** — 오늘 조치 필요 항목
3. **Today's Action Queue** — 상위 3-5 items preview (Pattern B rows)
4. **Recent Resolved** — compact strip
5. **Supporting Metrics** — 현재 KPI를 축소, actionable context 추가

변경:
- 큰 stat card → compact summary strip (count + why it matters + who should act + where it goes)
- compare/ops/remediation 요약을 통합 언어로
- alert성 항목 → strong strip 또는 queue preview row
- decorative chart 금지

### 파일별 diff

| 요소 | 줄일 것 | 올릴 것 | 통합할 것 |
|------|---------|---------|-----------|
| KPI 카드 | 4칸 grid → 1-line strip | urgent count, overdue count | 모든 domain stat을 한 strip에 |
| 액션 카드 | 4칸 wide card → compact row list | blocker/stale items | quote/inventory/compare alert |
| compare 요약 | multi-line text → 1-line summary | funnel bottleneck | ops context에 통합 |

---

## Phase 4: Detail Surface Refactor (4순위)

**대상**: quote/order/inventory detail pages, compare panels

### 필수 패턴 적용

모든 detail page 상단에 **Context Strip (Pattern C)**:
- origin → current phase → upstream/downstream links
- owner → latest action → timestamp
- SLA/stale indicator

### 파일별 계획

| 파일 | 줄일 것 | 올릴 것 | side panel로 뺄 것 |
|------|---------|---------|-------------------|
| `quotes/[id]/page.tsx` | decorative whitespace, context 없는 헤더 | state+owner+SLA row, linked chain | audit trail, handoff history |
| `orders/page.tsx` | pulsing animation, 큰 card | status+owner+action row | order detail evidence |
| `inventory/page.tsx` | hidden leadTime/usage fields | safety stock alert, expiry warning | full field detail |

---

## Phase 5: Canonical Component Patterns

추출된 component가 재사용 가능한 5개 패턴:

| Pattern | 파일 | 용도 |
|---------|------|------|
| A. Operational Summary Strip | console-empty-state.tsx 내 | dashboard/console 상단 |
| B. Queue Row | queue-row.tsx | 모든 list surface |
| C. Context Strip | queue-detail-panel.tsx 상단 | detail page 상단 |
| D. Detail Side Panel | queue-detail-panel.tsx | evidence/provenance |
| E. Severity Badge Set | visual-grammar severity indicators | 모든 surface |

---

## Phase 6: Index Exports

`apps/web/src/lib/work-queue/index.ts`에 추가:
```ts
export { TYPOGRAPHY, SPACING, SURFACE, SEVERITY_INDICATORS, CTA_RULES, QUEUE_COLUMNS, METADATA_ORDER } from "./console-visual-grammar";
export type { SeverityIndicator } from "./console-visual-grammar";
```

---

## Anti-Pattern 제거 체크리스트

| Anti-Pattern | 현재 위치 | 제거 방법 |
|---|---|---|
| tier 배경색 (bg-red-50 등) | TIER_STYLES, CATEGORY_STYLES | left border + dot으로 대체 |
| 다중 CTA per card | ConsoleQueueCard, DailyReviewCard | 행에 1 primary, 나머지 detail panel |
| 컬러 summary chips | ConsoleSummaryBar | neutral strip + count |
| 6+ inline badges | ConsoleQueueCard meta row | 고정 column 정렬 |
| category 컬러 배경 | DailyReviewView | section header + divider |
| decorative KPI card | dashboard page | compact summary strip |
| hover-only critical info | work-queue-inbox aging | 항상 visible |
| context 없는 stat tile | dashboard KPI grid | count + why + who + where |
| generic "검토"/"보기" 버튼 | 곳곳 | specific action label |
| status만 있고 owner 없는 row | inbox cards | 항상 owner + latest action 표시 |

---

## 구현 순서

```
Phase 1 (visual grammar)
  └─ console-visual-grammar.ts + test
Phase 2 (console surface — 1순위)
  ├─ console-empty-state.tsx
  ├─ queue-row.tsx
  ├─ queue-detail-panel.tsx
  ├─ daily-review-row.tsx
  ├─ governance-table.tsx
  ├─ remediation-table.tsx
  └─ work-queue-console.tsx refactor + index.ts exports
Phase 3 (dashboard — 추후)
  └─ dashboard/page.tsx refactor
Phase 4 (detail — 추후)
  └─ quote/order/inventory detail context strip
```

Phase 1-2를 이번에 구현. Phase 3-4는 Phase 2 검증 후 후속 작업.

---

## 파일 요약

| # | 파일 | Action | 예상 Lines |
|---|------|--------|-----------|
| 1 | `src/lib/work-queue/console-visual-grammar.ts` | NEW | ~120 |
| 2 | `src/__tests__/lib/work-queue/console-visual-grammar.test.ts` | NEW | ~80 |
| 3 | `src/components/dashboard/console/console-empty-state.tsx` | NEW | ~40 |
| 4 | `src/components/dashboard/console/queue-row.tsx` | NEW | ~120 |
| 5 | `src/components/dashboard/console/queue-detail-panel.tsx` | NEW | ~180 |
| 6 | `src/components/dashboard/console/daily-review-row.tsx` | NEW | ~80 |
| 7 | `src/components/dashboard/console/governance-table.tsx` | NEW | ~150 |
| 8 | `src/components/dashboard/console/remediation-table.tsx` | NEW | ~150 |
| 9 | `src/components/dashboard/work-queue-console.tsx` | MODIFY | 1137→~300 |
| 10 | `src/lib/work-queue/index.ts` | MODIFY | +exports |

---

## Verification

1. `cd apps/web && npx tsc --noEmit` — 타입 에러 없음
2. `cd apps/web && npx jest --testPathPattern="console-visual-grammar"` — visual grammar 테스트 통과
3. `cd apps/web && npx jest` — 기존 67+ 테스트 모두 통과
4. Console 4개 mode 모두 렌더링 확인 (queue, daily_review, governance, remediation)
5. Queue row 클릭 → detail panel Sheet 열림
6. Primary CTA 동작 보존
7. Anti-pattern 체크: bg-red-50/bg-orange-50 등 tier 배경색 미사용

---

## Acceptance Criteria

- [ ] consumer SaaS card feel 감소 — card → row+panel 전환
- [ ] state/severity/SLA/owner/latest action이 더 강하게 읽힘 — 고정 column 정렬
- [ ] primary action 즉시 보임 — 행당 1개 CTA
- [ ] metadata 배치 규칙 통일 — METADATA_ORDER 7단계
- [ ] provenance/context/handoff/remediation 숨지 않음 — detail panel evidence zone
- [ ] console이 운영 surface처럼 느껴짐 — dense row layout + severity indicators
- [ ] 기존 semantics/logic 미변경 — pure visual refactor
