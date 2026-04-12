# Compare Ops Review & Definition Lock

## Context

Operator Reporting & SLA Escalation (`52f9d15`) established scoring, escalation, and resolution path tracking. However:

- Metric definitions lack formal documentation (inclusion/exclusion criteria, time boundaries, source of truth)
- Dashboard shows only SLA breach count + undecided count — no substatus breakdown, conversion rate, or resolution path distribution
- Inquiry draft labels (`GENERATED`/`COPIED`/`SENT`) are defined in `decision-constants.ts` without canonical backing from `compare-queue-semantics.ts`
- Inquiry aging (draft created but not acted on) is not surfaced
- Resolution path label on completed cards is broken — stored in ActivityLog.metadata but read from `payload` which is never updated
- `computeCompareStats` returns 5 metrics but doesn't include substatus breakdown or conversion rate

**Baseline**: `52f9d15` (Operator Reporting & SLA Escalation)

---

## Step 1: Canonical Metric Definitions + Inquiry Labels

### File: `apps/web/src/lib/work-queue/compare-queue-semantics.ts`

### 1A: `CompareMetricDefinition` interface + `COMPARE_METRIC_DEFINITIONS`

Add after `COMPARE_REPORT_LABELS` (~line 236):

```ts
export interface CompareMetricDefinition {
  key: keyof typeof COMPARE_REPORT_LABELS;
  label: string;
  businessMeaning: string;
  inclusionCriteria: string;
  exclusionCriteria: string;
  timeBoundary: string;
  sourceOfTruth: string;
  displayLocations: string[];
}

export const COMPARE_METRIC_DEFINITIONS: CompareMetricDefinition[] = [
  {
    key: "undecidedCount",
    label: COMPARE_REPORT_LABELS.undecidedCount,
    businessMeaning: "UNDECIDED 상태 비교 세션 수 — 사용자 판정이 필요한 항목",
    inclusionCriteria: "compareSession.decisionState = UNDECIDED 또는 null",
    exclusionCriteria: "APPROVED, HELD, REJECTED, 삭제된 세션",
    timeBoundary: "전체 기간 (시간 제한 없음)",
    sourceOfTruth: "CompareSession.decisionState",
    displayLocations: ["dashboard notification", "dashboard priority card"],
  },
  {
    key: "slaBreachedCount",
    label: COMPARE_REPORT_LABELS.slaBreachedCount,
    businessMeaning: "SLA 경고 임계일 초과 활성 큐 아이템 수",
    inclusionCriteria: "AiActionItem: type=COMPARE_DECISION, taskStatus not COMPLETED/FAILED, ageDays >= slaWarningDays",
    exclusionCriteria: "터미널 substatus (compare_decided), COMPLETED/FAILED 아이템",
    timeBoundary: "substatus별 slaWarningDays (7/5/10/3일)",
    sourceOfTruth: "AiActionItem.createdAt + COMPARE_SUBSTATUS_DEFS.slaWarningDays",
    displayLocations: ["dashboard notification", "dashboard priority card"],
  },
  {
    key: "inquiryFollowupCount",
    label: COMPARE_REPORT_LABELS.inquiryFollowupCount,
    businessMeaning: "문의 후속 조치가 필요한 활성 큐 아이템 수",
    inclusionCriteria: "AiActionItem: substatus=compare_inquiry_followup, taskStatus not COMPLETED/FAILED",
    exclusionCriteria: "다른 substatus, 완료/실패 아이템",
    timeBoundary: "전체 기간",
    sourceOfTruth: "AiActionItem.substatus",
    displayLocations: ["dashboard notification"],
  },
  {
    key: "linkedQuoteCount",
    label: COMPARE_REPORT_LABELS.linkedQuoteCount,
    businessMeaning: "견적이 연결된 비교 세션 수 (distinct)",
    inclusionCriteria: "Quote.comparisonId IS NOT NULL, 사용자 소유",
    exclusionCriteria: "comparisonId가 null인 견적",
    timeBoundary: "전체 기간",
    sourceOfTruth: "Quote.comparisonId (distinct)",
    displayLocations: ["dashboard priority card"],
  },
  {
    key: "avgTurnaroundDays",
    label: COMPARE_REPORT_LABELS.avgTurnaroundDays,
    businessMeaning: "최근 판정 완료 세션의 평균 판정 소요일 (createdAt → decidedAt)",
    inclusionCriteria: "CompareSession: decisionState IN (APPROVED, HELD, REJECTED), decidedAt IS NOT NULL",
    exclusionCriteria: "UNDECIDED, decidedAt가 null인 세션",
    timeBoundary: "최근 100건 (decidedAt DESC)",
    sourceOfTruth: "CompareSession.createdAt, CompareSession.decidedAt",
    displayLocations: ["dashboard priority card"],
  },
];
```

### 1B: `INQUIRY_DRAFT_STATUS_LABELS` (canonical inquiry labels)

```ts
export const INQUIRY_DRAFT_STATUS_LABELS = {
  GENERATED: "생성됨",
  COPIED: "복사됨",
  SENT: "발송됨",
} as const;

export type InquiryDraftStatus = keyof typeof INQUIRY_DRAFT_STATUS_LABELS;
```

### 1C: `computeInquiryAgingDays()` (pure function)

```ts
export const INQUIRY_AGING_THRESHOLD_DAYS = 3;

export function computeInquiryAgingDays(input: {
  inquiryDrafts: { status: string; createdAt: Date | string }[];
}): number | null {
  const now = Date.now();
  const MS_PER_DAY = 86400000;
  let maxAgingDays: number | null = null;

  for (const d of input.inquiryDrafts) {
    if (d.status !== "GENERATED") continue;
    const ageDays = Math.floor((now - new Date(d.createdAt).getTime()) / MS_PER_DAY);
    if (ageDays >= INQUIRY_AGING_THRESHOLD_DAYS) {
      maxAgingDays = Math.max(maxAgingDays ?? 0, ageDays);
    }
  }
  return maxAgingDays;
}
```

---

## Step 2: Resolution Path Fix + Stats Extension

### 2A: Fix resolution path storage in `apps/web/src/app/api/compare-sessions/[id]/decision/route.ts`

**Bug**: `resolutionPath` is stored in ActivityLog metadata but completed cards read from `AiActionItem.payload`. Fix by merging into payload before transition.

After computing `resolutionPath` (line 94-98), before `transitionWorkItem`:
```ts
// Merge resolutionPath into payload for completed card display
await db.aiActionItem.update({
  where: { id: activeItem.id },
  data: {
    payload: {
      ...(await db.aiActionItem.findUnique({ where: { id: activeItem.id }, select: { payload: true } }))?.payload as Record<string, unknown>,
      resolutionPath,
      decisionState,
    },
  },
});
```

Actually cleaner: use `transitionWorkItem`'s `result` param which sets `AiActionItem.result`. But `queryWorkQueue` doesn't select `result`. Simplest fix: update payload directly in the transaction. But `transitionWorkItem` uses its own transaction.

**Best approach**: Before calling `transitionWorkItem`, update the item's payload to include resolutionPath:
```ts
await db.aiActionItem.update({
  where: { id: activeItem.id },
  data: {
    payload: db.$raw`payload || '{"resolutionPath":"${resolutionPath}","decisionState":"${decisionState}"}'::jsonb`,
  },
});
```

Actually, just use a plain Prisma JSON merge:
```ts
const currentItem = await db.aiActionItem.findUnique({
  where: { id: activeItem.id },
  select: { payload: true },
});
await db.aiActionItem.update({
  where: { id: activeItem.id },
  data: {
    payload: {
      ...((currentItem?.payload as Record<string, unknown>) ?? {}),
      resolutionPath,
      decisionState,
    },
  },
});
```

This runs before `transitionWorkItem` and ensures the payload has resolution path for the completed card to read.

### 2B: Extend `computeCompareStats` in `apps/web/src/app/api/dashboard/stats/route.ts`

Add to return object:
```ts
substatusBreakdown: Record<string, number>  // substatus → count
conversionRate: number                       // % of decided sessions with linked quote
resolutionPathDistribution: Record<string, number>  // path → count
```

**substatusBreakdown**: Computed from existing `activeItems` loop:
```ts
const substatusBreakdown: Record<string, number> = {};
for (const item of activeItems) {
  const key = item.substatus || "unknown";
  substatusBreakdown[key] = (substatusBreakdown[key] || 0) + 1;
}
```

**conversionRate**: `decidedSessions.length > 0 ? Math.round((linkedQuoteSessions.length / decidedSessions.length) * 1000) / 10 : 0`

**resolutionPathDistribution**: Need new query. Add to Phase 2 Promise.all:
```ts
// Completed compare items with resolution path in payload
db.aiActionItem.findMany({
  where: {
    userId,
    type: "COMPARE_DECISION" as any,
    taskStatus: "COMPLETED" as any,
  },
  select: { payload: true },
  take: 100,
  orderBy: { completedAt: "desc" },
}).catch(() => []),
```

Then compute distribution:
```ts
const resolutionPathDistribution: Record<string, number> = {};
for (const item of completedCompareItems) {
  const path = (item.payload as any)?.resolutionPath || "unknown";
  resolutionPathDistribution[path] = (resolutionPathDistribution[path] || 0) + 1;
}
```

---

## Step 3: Inquiry Aging in compare-sync Payload

### File: `apps/web/src/app/api/work-queue/compare-sync/route.ts`

### 3A: Extend inquiry draft select (line 47)

```ts
inquiryDrafts: {
  select: { status: true, createdAt: true },
},
```

### 3B: Include inquiry drafts in payload (line 172 area)

Add to createWorkItem payload:
```ts
inquiryDrafts: cs.inquiryDrafts.map((d: { status: string; createdAt: Date }) => ({
  status: d.status,
  createdAt: d.createdAt.toISOString(),
})),
```

---

## Step 4: Dashboard UI — Ops Review Additions

### File: `apps/web/src/app/dashboard/page.tsx`

### 4A: Extend stats destructuring (~line 74)

```ts
compareStats: {
  slaBreachedCount: rawStats.compareStats?.slaBreachedCount ?? 0,
  inquiryFollowupCount: rawStats.compareStats?.inquiryFollowupCount ?? 0,
  substatusBreakdown: (rawStats.compareStats?.substatusBreakdown ?? {}) as Record<string, number>,
  conversionRate: rawStats.compareStats?.conversionRate ?? 0,
  avgTurnaroundDays: rawStats.compareStats?.avgTurnaroundDays ?? 0,
},
```

### 4B: Enhance compare priority card (~line 259)

After existing SLA breach display, add compact info lines:
```tsx
{/* Substatus breakdown — only when there are items */}
{stats.undecidedCompareCount > 0 && Object.keys(stats.compareStats.substatusBreakdown).length > 0 && (
  <p className="text-[10px] text-slate-400 mt-0.5">
    {Object.entries(stats.compareStats.substatusBreakdown)
      .filter(([_, count]) => count > 0)
      .map(([key, count]) => `${COMPARE_SUBSTATUS_DEFS[key]?.label ?? key} ${count}`)
      .join(" · ")}
  </p>
)}
{/* Turnaround + conversion */}
{(stats.compareStats.avgTurnaroundDays > 0 || stats.compareStats.conversionRate > 0) && (
  <p className="text-[10px] text-slate-400 mt-0.5">
    {stats.compareStats.avgTurnaroundDays > 0 && `평균 ${stats.compareStats.avgTurnaroundDays}일`}
    {stats.compareStats.avgTurnaroundDays > 0 && stats.compareStats.conversionRate > 0 && " · "}
    {stats.compareStats.conversionRate > 0 && `견적 전환 ${stats.compareStats.conversionRate}%`}
  </p>
)}
```

---

## Step 5: Inquiry Aging Indicator in Work Queue

### File: `apps/web/src/components/dashboard/work-queue-inbox.tsx`

### 5A: Import `computeInquiryAgingDays` from compare-queue-semantics

### 5B: After existing inquiry count display (~line 315)

```tsx
{item.substatus === "compare_inquiry_followup" && (() => {
  const drafts = item.metadata?.inquiryDrafts as { status: string; createdAt: string }[] | undefined;
  if (!drafts) return null;
  const agingDays = computeInquiryAgingDays({ inquiryDrafts: drafts });
  if (agingDays === null) return null;
  return (
    <span className="text-[10px] text-red-500 font-medium mt-0.5">
      문의 미발송 {agingDays}일
    </span>
  );
})()}
```

---

## Step 6: Tests

### File: `apps/web/src/__tests__/lib/work-queue/compare-queue-semantics.test.ts`

Add 4 new describe blocks (~12 tests):

1. **COMPARE_METRIC_DEFINITIONS** (4 tests): count=5, keys match COMPARE_REPORT_LABELS, all fields non-empty, labels match
2. **INQUIRY_DRAFT_STATUS_LABELS** (2 tests): count=3, covers GENERATED/COPIED/SENT
3. **computeInquiryAgingDays** (4 tests): no GENERATED → null, under threshold → null, 3+ days → returns days, max across multiple
4. **Resolution path distribution helper** (if extracted as pure function, 2 tests)

---

## Implementation Order

```
Step 1 (canonical defs in compare-queue-semantics.ts) ← no deps
  ↓
Step 2A (resolution path fix in decision/route.ts) ← depends on Step 1
Step 2B (stats extension in stats/route.ts) ← depends on Step 1
Step 3 (compare-sync payload enrichment) ← depends on Step 1
  ↓
Step 4 (dashboard UI) ← depends on Step 2B
Step 5 (inquiry aging indicator) ← depends on Steps 1 + 3
Step 6 (tests) ← after Steps 1-3
```

---

## File Summary

| # | File | Action |
|---|------|--------|
| 1 | `src/lib/work-queue/compare-queue-semantics.ts` | +MetricDefinition, +InquiryLabels, +computeInquiryAgingDays |
| 2 | `src/app/api/compare-sessions/[id]/decision/route.ts` | Fix: merge resolutionPath into payload before transition |
| 3 | `src/app/api/dashboard/stats/route.ts` | +substatusBreakdown, +conversionRate, +resolutionPathDistribution |
| 4 | `src/app/api/work-queue/compare-sync/route.ts` | +createdAt in inquiry select, +inquiryDrafts in payload |
| 5 | `src/app/dashboard/page.tsx` | Consume new stats: breakdown, turnaround, conversion |
| 6 | `src/components/dashboard/work-queue-inbox.tsx` | +inquiry aging indicator |
| 7 | `src/__tests__/lib/work-queue/compare-queue-semantics.test.ts` | +12 tests |

---

## Scope Boundary

Per directive §5, this plan does NOT add:
- Notification automation (no email/push)
- Export builder (no CSV/PDF)
- Analytics suite (no chart components)
- Advanced compare features (no diff changes)
- Major redesign (all UI changes are additive to existing cards)

---

## Verification

1. `npx tsc --noEmit` — no new TS errors
2. `npx jest --testPathPattern="compare-queue-semantics|scoring-compare"` — all tests pass (existing 72 + new 12 = 84)
3. Manual: dashboard priority card shows substatus breakdown, turnaround, conversion rate
4. Manual: work queue inquiry items show aging indicator when GENERATED draft is 3+ days old
5. Manual: completed compare cards show resolution path label
