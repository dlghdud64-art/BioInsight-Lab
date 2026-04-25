# PLAN — `#P02` Phase B-α: PO Conversion Queue (composer layer)

- Status: **DRAFT — awaiting GO** (created 2026-04-25 by Phase B-α audit)
- Owner: 호영 (총괄관리자)
- Parent: `#P02 Phase B-β` closeout (commit `b214386a` + verification `62703ac0`),
  ADR-002 §11.10 follow-up tracks
- Deliverable: bring back the "AI 발주 전환 큐" UX on `/dashboard/purchases`,
  this time backed by canonical truth (no mock).

---

## 0. Truth reconciliation (read-only audit, completed 2026-04-25)

The Phase B-β rewrite removed a 950-line mock UI because none of the UI's
ontology fields had a server source. The Phase B-α audit (this section) shows
that **every source actually exists** — they were just never wired together.

### 0.1 What's already built

| Surface | Location | Notes |
|---|---|---|
| Unified AI work queue | `apps/web/src/app/api/work-queue/route.ts` | `queryWorkQueue` returns `{ items, accountability, escalations }` keyed by `TaskStatus` (ACTION_NEEDED / REVIEW_NEEDED / WAITING_RESPONSE / IN_PROGRESS / BLOCKED / FAILED). |
| AI action inbox | `apps/web/src/app/api/ai-actions/route.ts` | `AiActionItem` model. Has `type`, `priority`, `status`, `userId` scope. `/generate` endpoint creates new actions. |
| AI ops control | `apps/web/src/app/api/ai-ops/{auto-verify,hold,kill-switch,promote,rollback,status}` | Admin surface for AI operational lifecycle. |
| Deterministic next-action resolver | `apps/web/src/lib/ontology/contextual-action/ontology-next-action-resolver.ts` | **Rule-based**, not LLM. `AppRoute` enum already includes `"dashboard_purchases"`. Reads canonical truth, never writes. |
| Quote model with all RFQ fields | `apps/web/prisma/schema.prisma` `model Quote` | Has `vendors`, `vendorRequests`, `replies`, `responses`, `confidence`, `vendor`, `purchaseRequests[]`, `order?`, `purchaseRecords[]`. |
| Existing β surface | `apps/web/src/app/dashboard/purchases/page.tsx` | Phase B-β rewrite. Renders Quote inbox via `/api/quotes/my`. The α layer adds the conversion queue ontology back on top. |

### 0.2 UI field → existing source mapping

UI's old `PurchaseExecutionItem` → realistic mapping after audit:

| UI field (old mock) | Real source | Composition cost |
|---|---|---|
| `id`, `requestTitle` (= title), `totalBudget` (= totalAmount), `itemSummary`, `createdDaysAgo`, `currency`, `quoteNumber`, `validUntil`, `isExpired` | `Quote` direct | Already in `/api/quotes/my` |
| `supplierReplies` | `count(Quote.replies where status RESPONDED)` or `count(QuoteVendorRequest where responded_at IS NOT NULL)` | 1 join, server-side aggregate |
| `totalSuppliers` | `count(Quote.vendors)` or `count(QuoteVendorRequest)` | 1 join, server-side aggregate |
| `conversionStatus` (review_required / ready_for_po / hold / confirmed) | Decode of `Quote.status` + presence of `Order` + presence of `PurchaseRecord` | Pure function, server-side |
| `blockerType` (price_gap / lead_time / partial_reply / approval_unknown / moq_issue / none) | Derived from {`supplierReplies < totalSuppliers`, vendor reply price spread, ai-actions WAITING_RESPONSE, etc.} | **Rule-based**, deterministic. Implement once in `lib/ontology/purchase-conversion-resolver.ts` |
| `nextAction` (review_selection / prepare_po / wait_reply / check_external_approval) | `ontology-next-action-resolver.ts` already exists; extend for `dashboard_purchases` route stage if missing | Reuse existing resolver, ~1-day delta |
| `aiOptions[]` (with `recommendationLevel: primary / alternate / conservative`, `supplierName`, `price`, `leadDays`, `moq`, `rationale[]`) | Composed from `Quote.replies` + `Quote.vendors` + scoring rule. Optional: AI-generated rationale via `/api/ai-actions/generate`. | **Rule-based scoring v0**, then optional AI rationale |
| `aiRecommendationStatus` (recommended / review_needed / hold) | Function of {has reply count, has price spread, has moq issue} | Pure function |
| `externalApprovalStatus` (approved / pending / unknown) | TBD — currently no `Approval` model. Either (a) hardcode "unknown" until model exists, (b) reuse `PurchaseRequest.approverId` as a proxy. | **Smallest scope**: option (a), park real model under `#P02 Phase B-α-2` |
| `selectedOptionId` / `currentPreferredOption` | Use `PurchaseRequest.quoteId` (existing) or new `Quote.selectedReplyId` field. | New nullable column on `Quote` (or stay client-only state) |
| `nextStage` / `blockerReason` (display strings) | Computed labels for `nextAction` / `blockerType` enums | Pure label maps |

**Net assessment:** ~80% of the conversion-queue ontology is composable from
existing models with rule-based functions. The remaining 20% (external
approval, selected-option persistence) has clean fallbacks that don't block
v0.

---

## 1. Architecture options (Phase B-α has 3 viable shapes)

### Option α-1 — Server-side composer endpoint (recommended)

A single new endpoint, e.g. `GET /api/work-queue/purchase-conversion`, that:
- Joins `Quote` + `Quote.replies` + `Quote.vendors` + `Quote.order` + AI actions
- Applies the rule-based blocker / nextAction / scoring logic on the server
- Returns a flat `PurchaseConversionItem[]` matching the (revived) UI type

**Pros:**
- UI is identical to Phase B-β shape — one `useQuery`, one fetch.
- Single source of truth for the conversion ontology (one resolver function).
- All N+1 / aggregate concerns handled at the server with proper Prisma includes.
- Cacheable per-user with React Query default behaviour.

**Cons:**
- One new route to test, version, migrate.
- Server-side resolver is the load-bearing piece — needs unit-test coverage.

### Option α-2 — Client-side composition

UI fetches `/api/quotes/my` + `/api/work-queue` + `/api/ai-actions` in parallel
and composes `PurchaseConversionItem` in the React component.

**Pros:**
- No new endpoint.
- Lower risk of stale-cache divergence (client refetches each piece on demand).

**Cons:**
- Triple round-trip cost.
- Composition logic lives in the UI — harder to test, gets duplicated if any
  other surface (mobile, admin) needs the same view.
- Empty-state / loading UX is harder when 3 hooks resolve at different times.

### Option α-3 — Hybrid (keep `/api/quotes/my` + add minimal supplement endpoint)

Lightweight endpoint `/api/quotes/conversion-supplement?ids=Q1,Q2,...` that
returns only the missing fields (replies count, AI actions, blockerType,
nextAction) for a known list of quote IDs. UI calls quotes/my then supplement.

**Pros:**
- `/api/quotes/my` stays untouched — Phase B-β rollback path remains clean.
- Supplement endpoint is small and focused.

**Cons:**
- Two round trips.
- IDs-list-in-querystring has URL length limits (>50 quotes problematic).

### Recommendation: **α-1** (server-side composer endpoint)

Reason: Phase B-β proved the UI shape works with a single useQuery + flat
PurchaseConversionItem list. α-1 keeps that contract. Composer logic lives
server-side, gets full unit-test coverage, and matches the existing
`/api/work-queue` pattern. Phase B-β can stay rolled back to as a fallback
if α-1 ever needs surgery.

---

## 2. Implementation phases

Each phase is an independent commit. TDD where the surface is testable.

### Phase α-A — `purchase-conversion-resolver` (pure function, fully tested)

`apps/web/src/lib/ontology/purchase-conversion-resolver.ts` (new):

```ts
export interface PurchaseConversionInput {
  quote: Quote;
  vendors: QuoteVendor[];
  vendorRequests: QuoteVendorRequest[];
  replies: QuoteReply[];
  order: Order | null;
  aiActions: AiActionItem[];
}

export interface PurchaseConversionItem {
  id: string;
  requestTitle: string;
  itemSummary: string;
  totalBudget: number | null;
  currency: string;
  createdDaysAgo: number;
  conversionStatus: "review_required" | "ready_for_po" | "hold" | "confirmed";
  blockerType: "price_gap" | "lead_time" | "partial_reply" | "approval_unknown" | "moq_issue" | "none";
  blockerReason: string;
  nextAction: "review_selection" | "prepare_po" | "wait_reply" | "check_external_approval";
  nextStage: string;
  supplierReplies: number;
  totalSuppliers: number;
  aiRecommendationStatus: "recommended" | "review_needed" | "hold";
  aiOptions: AiOption[];
  selectedOptionId: string | null;
  externalApprovalStatus: "approved" | "pending" | "unknown";
}

export function resolvePurchaseConversion(input: PurchaseConversionInput): PurchaseConversionItem;
```

**Tests** (vitest, full table-driven coverage):
- All conversionStatus branches × all blockerType branches
- supplierReplies = 0 / partial / full
- AI actions empty / one recommended / multiple
- Order null / present
- PurchaseRecord present (= confirmed PURCHASED)
- Edge: expired quote, zero-vendor quote, multi-currency

Quality gate: 100% function coverage, ≥ 25 test cases.

### Phase α-B — `/api/work-queue/purchase-conversion` endpoint

New route handler that:
1. Auth check (existing pattern from `/api/quotes/my`)
2. Fetch user's Quotes with appropriate includes (vendors, vendorRequests, replies, order)
3. Fetch related AiActionItems (one batched query by quote IDs)
4. For each quote, call `resolvePurchaseConversion(...)` from Phase α-A
5. Return `{ success: true, data: { items: PurchaseConversionItem[], stats } }`

**Tests** (vitest with mocked Prisma, nodejs runtime test):
- Empty inbox → empty items, stats all zero
- Single quote each conversionStatus → stats counters correct
- Auth missing → 401 (existing pattern)
- DB throws → 500 with logged error
- Pagination if needed (defer to v0 single page if total < 100)

Quality gate: ≥ 8 integration tests, no N+1 in Prisma query log.

### Phase α-C — UI rewire on `/dashboard/purchases`

Switch the page from `/api/quotes/my` → `/api/work-queue/purchase-conversion`.

UI changes:
- `PurchaseConversionItem` type imported from server response (or shared lib)
- Restore the conversion-queue tab structure (review / ready / check / hold)
  using the new `conversionStatus` + `nextAction` decode
- Bring back rail content: blocker, nextAction, AI options list (each a real
  Link to `/dashboard/quotes/[id]?option=<replyId>`)
- Restore "일괄 발주 전환" header CTA — wired to a new POST endpoint
  in Phase α-D. Until α-D, the button is **hidden** (not dead-button).
- Empty state copy stays as Phase B-β ("보유한 견적이 없습니다 / 장바구니
  열기")
- Keep the Phase B-β KPI cards (status counts) as one tab, add the new
  conversion-queue cards as another tab — same canvas, two views.

Quality gate: tsc clean, vitest smoke clean, Chrome probe on
`/dashboard/purchases` shows non-zero queue when test quote with replies
exists in pilot tenant.

### Phase α-D — Selected option persistence + bulk PO conversion (optional v0+1)

Adds:
- Migration for `Quote.selectedReplyId` (nullable FK to QuoteReply.id)
- POST `/api/quotes/[id]/select-option` mutation
- POST `/api/work-queue/purchase-conversion/bulk-convert-po` for the header
  CTA (creates PurchaseRequest rows from a list of quote IDs)
- UI rail "선택안 확정" + header "일괄 발주 전환" both wired

Can be deferred to v0+1 — α-C is shippable without α-D as a read-only
conversion queue.

### Phase α-E — Closeout doc

ADR-002 §11.14 (or §11.15 depending on §11.12 numbering) entry:
- "Phase B-α landed: PO conversion queue restored on canonical truth"
- Resolver coverage stats
- Probe URL + screenshot
- Migration fence (Phase α-D requires schema migration → use new
  `DEV_RUNBOOK §9` operator-shell migrate procedure from §11.13)

---

## 3. Rollout safety

- **Rollback path:** revert Phase α-C alone (UI swap) restores Phase B-β
  state. The `/api/work-queue/purchase-conversion` endpoint can stay even
  if the UI doesn't use it.
- **Data safety:** read-only at v0 (no schema migration in α-A through α-C).
  α-D adds a nullable column — additive, safe to land any time.
- **Feature flag:** not strictly needed because α-C swap is atomic per
  deploy. If desired, use a Vercel env var `PURCHASE_CONVERSION_QUEUE=1`
  to toggle the new view in `page.tsx`.
- **Pilot tenant verification:** create one Quote with 2-3 vendor replies
  (different prices) in pilot tenant, then probe `/dashboard/purchases`.
  Should see real conversion status + AI options instead of empty state.

## 4. Out of scope

- LLM-generated AI recommendation rationale strings — v0 uses rule-based
  scoring with static rationale ("최저가", "최단납기", "주거래처"). LLM
  rationale is a Phase α-F if pursued, gated behind `/api/ai-actions/generate`.
- Multi-supplier RFQ outbound (sending new vendor request emails from this
  surface). Already handled by `Quote.vendorRequests` workflow elsewhere.
- Mobile / admin views of the conversion queue — same composer endpoint
  can serve them, but UI is per-surface.
- External approval system integration (`Approval` model). Defer to a
  separate ADR if it becomes load-bearing.
- Analytics / aging / SLA on the conversion queue — separate surface.

## 5. LabAxis principle alignment

- **canonical truth protection** ✓ — every UI field traces to a DB query
  result, no mock fallback. Resolver reads only.
- **same-canvas** ✓ — single `/dashboard/purchases` route, no new page.
- **page-per-feature ban** ✓ — same surface as Phase B-β, additive view.
- **dead button ban** ✓ — "일괄 발주 전환" button is **hidden** until
  α-D wires it; no dead state.
- **chatbot/assistant 재해석 금지** ✓ — resolver is rule-based, not LLM.

## 6. GO request

When Phase B-α is ready to start (next session or later):

- **GO Phase α-A** — write `purchase-conversion-resolver.ts` + tests first.
  Single TDD commit. ~2-3 hour scope. Closes when ≥ 25 test cases pass.
- **GO Phase α-A + α-B together** — slightly bigger commit (resolver +
  endpoint), still one PR. Adds integration tests. ~3-4 hour scope.
- **GO incremental (α-A, α-B, α-C, α-D each separate)** — safest, multi-
  session. Resolver lands and gets used by other surfaces independently
  before UI rewires.

## 7. Decisions deferred to GO time

| Decision | Default | Alternative |
|---|---|---|
| Endpoint path | `/api/work-queue/purchase-conversion` | `/api/quotes/conversion-queue` |
| Selected option persistence (α-D) | New nullable column on `Quote` | Separate `QuoteSelectedOption` table |
| External approval | Hardcode "unknown" v0 | New `Approval` model immediately |
| AI rationale | Rule-based static strings | LLM via `/api/ai-actions/generate` |
| Header CTA (bulk PO) | Hidden until α-D | Visible-disabled with tooltip explaining |

---

## 8. Related

- `docs/decisions/ADR-002-pilot-tenant-seed.md` §11.10 (Phase B-β closeout
  + α park), §11.13 (γ-shell migrate procedure — relevant for α-D
  schema change)
- `apps/web/src/app/dashboard/purchases/page.tsx` (commit `b214386a`,
  Phase B-β current implementation)
- `apps/web/src/lib/ontology/contextual-action/ontology-next-action-resolver.ts`
  (existing resolver to extend)
- `apps/web/src/app/api/work-queue/route.ts` (sibling pattern)
- `apps/web/prisma/schema.prisma` `model Quote` / `QuoteReply` / `QuoteVendor`
  / `QuoteVendorRequest` / `Order` / `PurchaseRequest`

## 9. Changelog

- 2026-04-25 — Plan opened. Audit completed; 80% of the conversion-queue
  ontology is composable from existing models. Recommended path: Option
  α-1 (server-side composer endpoint). Phases A→B→C→D→E proposed.
  Awaiting GO from 호영.
