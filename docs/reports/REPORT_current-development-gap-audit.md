# LabAxis Current Development & Gap Audit

> **Mode:** C-audit-report-only — 구현 0, 코드 수정 0, 본 문서 1개 외 어떤 파일도 변경하지 않음.
> **Verifier:** CEO 사업 파트너 / 운영 총괄 / 제품 구조 감사자.
> **Date:** 2026-04-29.
> **Scope:** 로컬 main brunch HEAD `5f83b26d` 기준. push 여부 unverified (sandbox credential 부재).

---

## 0. Executive Verdict

### 작동 중 (Working)

- **Phase B-α α-A / α-B / α-C / α-D 모두 land + 테스트 통과**. 호영님 known context의 "Phase B-α plan opened" 단계는 이미 추월되어 implementation closed 상태.
  - α-A `apps/web/src/lib/ontology/purchase-conversion-resolver.ts` (508 lines, `PurchaseConversionItem` interface + 30 entity refs).
  - α-B `apps/web/src/app/api/work-queue/purchase-conversion/route.ts` + `bulk-po/route.ts`.
  - α-C `/dashboard/purchases/page.tsx` 가 `useQuery` + `fetch("/api/work-queue/purchase-conversion")` 로 canonical 연결 (line 117–120).
  - 테스트 58/58 PASS — 본 audit에서 직접 확인 (`purchase-conversion-resolver.test.ts` 48, `purchase-conversion.test.ts` 10).
- **Operational Brief Ecosystem (§11.142–§11.156) 100% feature-complete** — 5 desktop rail + Sheet + 모바일 bottom sheet + cache + KV adapter + metrics + Anthropic narrative + invalidate. ADR-002 §11.142–156 entry 모두 기재.
- **P0 RFQ Handoff + Ontology Workflow Resolver closed** — known commit `1fe49f7b` repo에서 verified.
- **`PLAN_phase-b-alpha-purchase-conversion.md` 실재**, plan opened 시점 commit `d45e57b4` repo에서 verified.

### 만들어졌지만 미연결 (Built but Unwired)

- **§11.156 `invalidateBriefNarrative()` helper** export만 land. 5 surface의 핵심 mutation `onSuccess`에서 실제 호출 wiring 0 — `selectReplyMutation` / `executeOpsAction` / `onReorder` 어디에도 호출 없음. cache stale 위험 잔존.
- **§11.150/§11.154 KV adapter** — `VercelKvBackend` class + dynamic import 패턴 land 했지만 `@vercel/kv` 패키지 미설치 + `OPERATIONAL_BRIEF_KV_URL` env 미설정. multi-instance 진입 시 별도 트랙 필요.

### 누락 (Missing)

- **운영자 self-service Settings governance 분리**: `operatorRole` Input(line 633)이 free-text editable. RBAC 정합과 충돌. (Identity Governance violation — §11.74 read-only 영역과 같은 페이지에 공존하지만 line 633 input은 통제되지 않음.)
- **`workspaceName` / `currencyUnit` canonical source 부재**: line 217/220의 useState 초기값이 hardcoded 한국어 ("제1 바이오 R&D 센터" / "KRW (₩)") — 실제 canonical org/workspace 데이터 fetch 0. Mock 으로서 read-only 표시되지만 prod 운영 시 `<UnverifiedDataAsCanonical>` risk.
- **dashboard mock 페이지 cleanup**: `dashboard/orders/page.tsx`, `dashboard/smart-sourcing/page.tsx` — TODO comment 명시되어 다음 release 시 삭제 예정. 5개 `.bak*` 파일 (`dashboard/budget/[id]/`) + 4개 `.fuse_hidden*` artifacts.

### 위험 (Risky)

- **operatorRole input free-text** = RBAC payload mutation 가능성 (만약 form submit이 백엔드와 연결되어 있다면). 본 감사는 form submit 행동까지는 확인 안 함 → §9 추가 audit 필요.
- **§11.156 cache-bust unwired** — narrative가 운영자 mutation 후 즉시 stale → 운영 브리핑 정보 vs canonical state 분기.
- **5개 `.bak*` 파일** — git 추적되지 않은 작업본 잔존 가능성. 본 sandbox에서는 stale 작업 결과로 추정. 별도 cleanup 권장.

### 다음 (What should happen next)

1. **Settings governance cleanup** — `operatorRole` Input → read-only Badge로 전환, `workspaceName` / `currencyUnit` → canonical source fetch 또는 명시적 mock fallback indicator 표시.
2. **§11.156 cache-bust call-site wiring** — `selectReplyMutation` / `executeOpsAction` / `onReorder` `onSuccess`에서 `invalidateBriefNarrative()` 호출.
3. **dashboard/orders + dashboard/smart-sourcing 삭제** — TODO 명시된 redirect-only page 정리.
4. **`.bak*` + `.fuse_hidden*` cleanup** — repo hygiene.
5. **(Optional)** Operational Brief LLM prompt tuning + integration evidence 별도 audit.

**Implementation 즉시 안전:** Phase B-α 진입 트랙은 이미 closed 상태이므로 새로 시작할 필요 없음. 다음 안전한 트랙 = **Settings governance cleanup** (`operatorRole` free-text 제거). Phase B-α 후속이 아닌 governance 정리 영역.

---

## 1. Audit Scope & Method

### 1.1 실행한 read-only commands

| 명령 | 용도 |
|---|---|
| `git log --oneline -n 30` | recent commit history |
| `git log --oneline 1fe49f7b -1` / `d45e57b4 -1` | known reference verification |
| `find apps/web/src/lib/work-queue -type f` | work-queue surface inventory |
| `find apps/web/src/lib/ontology -type f` | ontology surface inventory |
| `ls apps/web/src/app/api/work-queue/` | API endpoint inventory |
| `ls apps/web/src/app/api/ai-actions/` | AI surface inventory |
| `grep -n "model X" prisma/schema.prisma` | Prisma model headlines |
| `grep "TODO\|FIXME\|placeholder"` | 미완료 markers |
| `grep "<textarea\|Ask AI\|AI 견적"` | chatbot UI drift |
| `wc -l <files>` | 규모 스케치 |
| `npx vitest run <focused>` | Phase B-α 테스트 fitness |

### 1.2 검사한 핵심 파일

- `apps/web/prisma/schema.prisma` (모델 headlines line 56/121/284/373/811/1508/2011 등)
- `apps/web/src/lib/ontology/purchase-conversion-resolver.ts` (508 lines)
- `apps/web/src/lib/ontology/contextual-action/ontology-next-action-resolver.ts`
- `apps/web/src/app/api/work-queue/purchase-conversion/route.ts`
- `apps/web/src/app/api/work-queue/purchase-conversion/bulk-po/route.ts`
- `apps/web/src/app/api/ai-actions/{route.ts, generate/{order-followup,quote-draft,quote-rationale,reorder-suggestions,vendor-email-draft},[id]/{approve,route.ts}}`
- `apps/web/src/app/dashboard/purchases/page.tsx` (982 lines)
- `apps/web/src/app/dashboard/quotes/page.tsx` (1576 lines)
- `apps/web/src/app/dashboard/inbox/page.tsx`
- `apps/web/src/app/dashboard/inventory/inventory-content.tsx` (4445 lines, +context-panel 826 lines)
- `apps/web/src/app/dashboard/receiving/page.tsx` + `[receivingId]/page.tsx` (986 lines)
- `apps/web/src/app/dashboard/work-queue/page.tsx` (10 lines wrapper) + `components/dashboard/work-queue-console.tsx` (413 lines)
- `apps/web/src/app/dashboard/settings/page.tsx` (1443 lines)
- `apps/web/src/app/dashboard/_components/operational-detail-shell.tsx`
- `apps/web/src/lib/ai/operational-brief-{cache,cache-adapter,cache-metrics,narrative}.ts`
- `apps/web/src/lib/hooks/use-operational-brief.ts`
- `apps/web/src/components/operational-brief/mobile-bottom-sheet.tsx`
- `apps/web/src/__tests__/lib/ontology/purchase-conversion-resolver.test.ts` (55 case markers)
- `apps/web/src/__tests__/api/work-queue/purchase-conversion.test.ts` (12 case markers)
- `docs/plans/PLAN_phase-b-alpha-purchase-conversion.md` (Phase B-α plan)
- `docs/decisions/ADR-002-pilot-tenant-seed.md` (1947 lines, §11.0–§11.156)

### 1.3 작업 거부

본 모드는 read-only audit only. 어떤 코드도 수정/생성하지 않음. 본 보고서 1 개 (`docs/reports/REPORT_current-development-gap-audit.md`) 만 작성.

---

## 2. Current Repo / Commit / Build Status

### 2.1 Recent commits (top 12)

```
5f83b26d  §11.153-156 운영 브리핑 ecosystem feature-complete
59a55eb1  §11.148-152 운영 브리핑 ecosystem batch
cfa7fea0  §11.144-147 운영 브리핑 4 surface 확장 + AI narrative cache
556417dd  §11.143 #operational-brief-rail-work-queue
6d691ed1  §11.142-impl #operational-brief-rail-purchase-conversion
40a2f150  §11.142 OPENED — #operational-brief-rail-direction-lock
e3a63bd7  §11.141 #admin-user-purge-cron-soft-fail-alert
ef87de85  §11.140 #contrast-audit (audit-only)
ff1c3c58  §11.139 #dashboard-kpi-mobile-collapsible
d5240b8b  §11.138 #admin-user-soft-delete-purge-cron
3ea3bd8e  §11.137 #admin-user-bulk-action-toast
25ccd705  §11.136 #admin-user-row-checkbox
```

### 2.2 Known reference verification

- `1fe49f7b feat(rfq-handoff): P0 — cross-page handoff + 견적관리 banner + ontology URL 결선` ✅ exists.
- `d45e57b4 docs(plan): #P02 Phase B-α plan opened — PO conversion queue (composer layer)` ✅ exists.

### 2.3 Working tree

- `git status` 가 sandbox FUSE 환경에서 "fatal: index file corrupt" 발생. 본 감사 동안 해당 사항은 evidence 수집에 영향 없음 (`git log` / `git show` 정상 동작).
- `.git/refs/heads/main` 직접 읽기로 HEAD = `5f83b26d` 확인.
- **Push 여부 unverified** — 호영님이 직전 메세지에서 "푸시했고" 라고 보고했으므로 origin/main = `5f83b26d` 가정.

### 2.4 Test / build health

| 명령 | 결과 | 비고 |
|---|---|---|
| `npx vitest run` (전체) | TIMEOUT (143) | 92 test files — 60s 한도 안에 종료 안됨. CI 실행은 적정. 본 sandbox에선 dev resource 한계. |
| `npx vitest run src/__tests__/lib/ontology/purchase-conversion-resolver.test.ts src/__tests__/api/work-queue/purchase-conversion.test.ts` | 58/58 PASS (9.98s) | α-A + α-B fitness. |
| `npx vitest run src/__tests__/api/admin/operational-brief* src/__tests__/lib/ai/operational-brief*` | TIMEOUT (143) | 15 test files — sandbox 한계. ADR §11.156에 95/95 PASS 기록 있음. |
| `npx tsc --noEmit` | unverified in this run | 이전 세션에서 §11.153-156 commit 직전 clean confirmed except 선재 `purchases/page.tsx:836 selectedItem.title` 1건 (이전 commit 시점 기록). |
| `npx run lint` | not run | scope 외. |

**audit 판정:** 테스트 자체는 통과한 흔적이 있으나, sandbox CI sandbox 제약으로 full sweep 재실행 불가. CI / local에서 재확인 권장.

---

## 3. Operating Chain Coverage Map

LabAxis Core operating chain 단계별 매핑:

| 단계 | UI route/component | API endpoint | Prisma/source | Status | Missing link | Evidence |
|---|---|---|---|---|---|---|
| **검색 (Research sourcing)** | `/dashboard/smart-sourcing` (redirect) → 견적 워크큐 내부 capability로 흡수 | `/api/products/list/route.ts` (§11.104) | `Product`, `Vendor` | **PARTIAL** | 독립 검색 surface 없음. legacy redirect로 흡수됨 (§11.55). | `apps/web/src/app/dashboard/smart-sourcing/page.tsx` redirect-only |
| **비교 (Compare)** | `/dashboard/compare/page.tsx` | `/api/compare-sessions/*` | `CompareSession`, `Quote` | **CLOSED** | — | §11.13 fake success 정정 closed |
| **요청 생성 (Quote create)** | `/dashboard/quotes/page.tsx` | `/api/quotes/*` (POST `/api/quotes`) | `Quote`, `QuoteItem`, `QuoteResponse` | **CLOSED** | — | §11.19 quoteNumber utility |
| **승인 (Approval)** | `/dashboard/quotes` rail "외부 승인 prep" CTA + Settings tier (line 230–232) | `/api/quotes/[id]/respond/*`, RBAC tier check | `Quote.status`, `OrganizationMember.role`, `User.role` | **PARTIAL** | UI 표시는 하지만 line 1086–1087 "승인 정책 없음 / 외부 승인 불필요" hardcoded text — fallback default. canonical approval workflow not yet routed to rail. | `dashboard/quotes/page.tsx:1086-1090` |
| **PO 전환** | `/dashboard/purchases/page.tsx` → `?focus=` quote handoff | `/api/work-queue/purchase-conversion`, `/api/work-queue/purchase-conversion/bulk-po` | `PurchaseConversionItem` (composer), `Quote.order` | **CLOSED** | — | §11.142-impl land + 58/58 PASS |
| **PO Created** | `/dashboard/purchase-orders/page.tsx` (module landing) + `/dashboard/inbox?module=po` (detail) | `/api/orders` / `/api/admin/orders/*` (§11.102 bulk status) | `Order`, `OrderItem` | **CLOSED** | — | §11.61 ready_for_po inline button |
| **Dispatch Prep** | `/dashboard/inbox/page.tsx` ContextPanel (§11.145) — cross-module unified | `/api/work-queue/route.ts` queryWorkQueue + `quickAction` | `Order`, `Quote`, `WorkQueueTask` (TaskStatus enum) | **CLOSED** | — | §11.145 운영 브리핑 적용 |
| **발송/공급사 확인** | `/dashboard/quotes/page.tsx` VendorRequestModal (§11.54) | `/api/quotes/[id]/respond/{vendor-tokens,...}` | `QuoteVendorRequest`, `QuoteRfqToken`, `QuoteReply` | **CLOSED** | — | §11.54 색상 정정 closed |
| **입고 (Receiving)** | `/dashboard/receiving/page.tsx` (landing) + `/dashboard/receiving/[receivingId]/page.tsx` (detail via `OperationalDetailShell`) | `/api/order-queue/*`, `/api/inventory/*` | `Order` deliveredAt + `ProductInventory` | **CLOSED** | — | §11.149 OperationalDetailShell brief banner |
| **재고** | `/dashboard/inventory/inventory-content.tsx` (4445 lines) + `InventoryContextPanel` (826 lines) | `/api/inventory/*`, `/api/inventory/reorder-recommendations` | `ProductInventory` | **CLOSED** | — | §11.146 운영 브리핑 + §11.155 mobile sheet |
| **재주문 (Reorder)** | InventoryContextPanel `onReorder` → AI reorder suggestion | `/api/ai-actions/generate/reorder-suggestions/route.ts` | `AiActionItem` (type=`reorder_suggestion`) | **CLOSED** | — | ai-actions/generate 5종 active |

**Summary**: Chain 11 단계 중 **9 CLOSED, 2 PARTIAL** (검색 분리 surface 없음, 승인 외부 wiring 미완).

---

## 4. Canonical Truth Reconciliation Matrix

| Field / Concept | Canonical Source | Current Consumer Surface | Current Risk | Required Fix | Evidence |
|---|---|---|---|---|---|
| `supplierReplies` | `Quote.replies[]` count → α-A resolver | purchases rail `selectedItem.supplierReplies` | none | — | `purchase-conversion-resolver.ts:79`, `dashboard/purchases/page.tsx:925` (§11.155 mobile wire fix `responseCount → supplierReplies`) |
| `totalSuppliers` | `Quote.vendors[]` / `Quote.vendorRequests[]` count → α-A | purchases rail | none | — | `resolver.ts:80,246` |
| `aiRecommendationStatus` | α-F `quote-rationale` → resolver (`AiActionItem.confidence`) | purchases rail "AI 추천 상태" | none | — | `resolver.ts:81`, ADR §11.25 |
| `nextAction` | `ontology-next-action-resolver.ts` (deterministic, no LLM) | rail CTA + brief `다음 조치` | none | — | `resolver.ts:77` |
| `blockerType` | α-A composer (escalation + WAITING_RESPONSE) | rail blocker strip | none | — | `resolver.ts:75` |
| `conversionStatus` | α-A composer 5분기 (`review_required/ready_for_po/hold/confirmed/expired`) | purchases page tabs + rail | none | — | `resolver.ts:74`, §11.40 한국어 매핑 |
| `Quote.status` | Prisma `Quote.status` enum (`PENDING/SENT/RESPONDED/COMPLETED/PURCHASED/CANCELLED`) | quotes rail badge | none | — | `prisma/schema.prisma:373` |
| `Order existence` | `Quote.order` 1:1 relation | purchases conversion ready_for_po 분기 | none | — | `resolver.ts:84` |
| `work queue blocked/escalation` | `WorkQueueTask.status` (`BLOCKED`) + `escalations[]` | inbox `차단 사유` strip + work-queue console | none | — | `console-grouping.ts`, ADR §11.21 |
| **`workspace identity` (workspaceName)** | **canonical source unverified** — `Workspace` model 존재하나 Settings page 가 hardcoded mock 사용 | settings/page.tsx:795 read-only 표시 | **MEDIUM RISK** — mock 값을 canonical 표시하면서 운영자가 실 데이터로 오인 | (a) 실 fetch + mock fallback indicator 표시 (`<UnverifiedDataAsCanonical>` 라벨) **또는** (b) section 자체 hide until backend wires up | `settings/page.tsx:217,791-797`; `prisma/schema.prisma:928 model Workspace` |
| **`user role/permission`** | Real: `User.role` (UserRole enum) + `OrganizationMember.role` + `WorkspaceMember.role`. UI에 `roleLabel` (line 488)은 real session.user.role 매핑. | `settings/page.tsx:632-633` `직책 / 역할` Input 은 free-text editable | **HIGH RISK** — operatorRole free-text Input 이 RBAC 정합 위반. line 660 SectionCard 는 read-only 정합인데 line 633은 자유 편집 허용. | line 633 Input → read-only Badge or Display. `setOperatorRole` setter 제거. | `settings/page.tsx:216,632-634` |
| **`currency`** | hardcoded "KRW (₩)" (line 220) | settings read-only display | **LOW-MEDIUM RISK** — workspace canonical에 currency 필드가 있을 수 있으나 fetch 0 | workspace.currency fetch + fallback indicator | `settings/page.tsx:220` |
| `unit system / Metric` | **§11.74에서 의도적으로 제거** (정규화 로직 부재로 운영자 결정 항목 아님) | n/a | **none** — 의도적 미노출 | — | `settings/page.tsx:218-219 주석` |
| `operational brief facts` | resolver-derived `BriefSourceTrace` + `facts: {status, blocker, nextAction}` | 5 surface rail/sheet/banner | none | — | `lib/ai/operational-brief-narrative.ts`, ADR §11.142 lock |

**핵심 위험 2건:**
1. **`operatorRole` free-text** — Identity Governance 위반 (HIGH).
2. **`workspaceName` mock as canonical** — UnverifiedDataAsCanonical (MEDIUM).

---

## 5. API & Endpoint Inventory

### 5.1 `/api/work-queue/*`

| Endpoint | Purpose | Canonical source | Wired? | Risk |
|---|---|---|---|---|
| `/api/work-queue/route.ts` | unified inbox queryWorkQueue (TaskStatus + escalations) | `WorkQueueTask` aggregation | YES — `dashboard/inbox/page.tsx`, `work-queue-console.tsx` | none |
| `/api/work-queue/purchase-conversion/route.ts` | α-B composer endpoint | α-A resolver | YES — `dashboard/purchases/page.tsx:120` | none |
| `/api/work-queue/purchase-conversion/bulk-po/route.ts` | bulk PO 발주 전환 | α-A + Order create | YES — α-D §11.21 | none |
| `/api/work-queue/assignment/*` | claim / handoff / mark_in_progress | `WorkQueueTask.assignmentState` | YES — `work-queue-console.tsx` `useAssignmentAction` | none |
| `/api/work-queue/compare-sync/route.ts` | compare 결과 sync | `CompareSession` | YES | none |
| `/api/work-queue/ops-execute/route.ts` | primary CTA mutation 실행 | resolver `primaryCtaActionId` | YES — `useExecuteOpsAction` | none |
| `/api/work-queue/ops-sync/route.ts` | inbox 자동 동기화 | useSyncOpsQueue | YES | none |
| `/api/work-queue/daily-review/*` | 일일 검토 (operator/lead view) | resolver | YES — `useDailyReview` | none |
| `/api/work-queue/cadence-governance/*` | governance flow | — | YES (§11.83 surface integration) | none |
| `/api/work-queue/bottleneck-remediation/*` | bottleneck aggregation | — | YES (RemediationView component) | none |

### 5.2 `/api/ai-actions/*`

| Endpoint | Purpose | Wired? |
|---|---|---|
| `/api/ai-actions/route.ts` (67 lines) | list AiActionItem | YES |
| `/api/ai-actions/[id]/route.ts` (169 lines) | individual action | YES |
| `/api/ai-actions/[id]/approve/route.ts` | approve action | YES — §SEC04 rename closed |
| `/api/ai-actions/generate/order-followup` | LLM gen | YES — §11.26 Anthropic |
| `/api/ai-actions/generate/quote-draft` | LLM gen | YES |
| `/api/ai-actions/generate/quote-rationale` | α-F rationale (§11.25) | YES |
| `/api/ai-actions/generate/reorder-suggestions` | inventory reorder | YES |
| `/api/ai-actions/generate/vendor-email-draft` | RFQ email draft | YES |

### 5.3 Operational Brief endpoints (§11.142–156)

| Endpoint | Purpose | Wired? |
|---|---|---|
| `/api/operational-brief/narrative/route.ts` (POST + DELETE) | narrative generation + cache invalidate | **PARTIAL** — endpoint live, but no UI surface yet calls `useOperationalBriefNarrative` hook (helper exists, 0 callers in 5 surface) |
| `/api/admin/operational-brief-cache-stats/route.ts` (GET) | admin metric observability | **PARTIAL** — admin endpoint live but no admin/audit page consumer |

### 5.4 Quote / PO / Order

- `/api/quotes/*`, `/api/quotes/[id]/respond/*` (RFQ token + reply + bulk-PO) — closed.
- `/api/orders/*` + `/api/admin/orders/*` (bulk status §11.102) — closed.

### 5.5 Settings / workspace / user

- `/api/me`, `/api/settings/*` — partially audited. workspaceName + currency canonical fetch endpoint **unverified**.
- `/api/admin/users/*` (§11.114–§11.137) — closed (full lifecycle: invite/approve/reject/soft-delete/restore/bulk/toast/purge cron).

### 5.6 Dead / suspect endpoints

- 본 감사에서 별도 dead endpoint 미검출. `dashboard/orders` + `dashboard/smart-sourcing` page.tsx redirect-only — TODO comment에 명시되어 다음 release 정리 예정.

---

## 6. Prisma / Data Model Relationship Audit

### 6.1 Quote-centered relationships (all verified in `prisma/schema.prisma`)

| Relation | Line | Phase B-α 사용 가능 |
|---|---|---|
| `Quote` model | 373 | ✅ |
| `Quote.replies` (`QuoteReply[]`) | 1362 | ✅ — supplierReplies 카운트 source |
| `Quote.vendors` (`QuoteVendor[]`) | 1401 | ✅ — totalSuppliers 카운트 |
| `Quote.vendorRequests` (`QuoteVendorRequest[]`) | 1444 | ✅ — RFQ outbound tracking |
| `Quote.order` (1:1 `Order?`) | 1508 | ✅ — Order 존재 여부 = ready_for_po → confirmed 분기 |
| `Quote.purchaseRecords` (`PurchaseRecord[]`) | 811 | ✅ — historical PO records |
| `QuoteRfqToken` | 1311 | ✅ — vendor portal token |
| `QuoteReplyAttachment` | 1384 | ✅ — vendor reply 첨부 |

### 6.2 Order / Vendor / AiActionItem

- `Order` (line 1508) + `OrderItem` (line 1540) — verified.
- `Vendor` (line 284) — verified.
- `AiActionItem` (line 2011) — α-F 사용.

### 6.3 Work queue / blocker

- `WorkQueueTask` 모델 자체는 별도 검색 안 함. `lib/work-queue/console-grouping.ts`의 `WorkQueueItem` interface가 task aggregation을 처리. `TaskStatus` enum은 ADR §11.21 + α-D 작업에서 검증됨.

### 6.4 User / Workspace / Membership

| Model | Line | Edit governance |
|---|---|---|
| `User` (`UserRole` enum default RESEARCHER) | 121 | role NOT user-editable (system assigned). Settings free-text Input 위반 risk. |
| `Organization` (`OrganizationRole` default VIEWER) | 56 | OK |
| `OrganizationMember` | 104 | OK |
| `Workspace` | 928 | workspaceName **NOT** user-editable. Settings page는 read-only 정합이나 hardcoded mock. |
| `WorkspaceMember` (`WorkspaceMemberRole` default MEMBER) | 964 | OK |
| `WorkspaceInvite` / `OrganizationInvite` | 981 / 1000 | OK |

### 6.5 Phase B-α readiness

**모든 관계 Phase B-α 처리 가능.** 신규 모델 0 — 기존 source의 composer 합성으로 해결됨. ADR-002 §11.10–§11.21 + §11.142-impl에서 입증.

---

## 7. Frontend Surface Audit

### 7.1 Workbench / queue / rail / dock 통합

| Surface | Layout | Brief 패턴 | 상태 |
|---|---|---|---|
| Dashboard | DashboardShell + executive-summary-section + KPI cards | n/a | CLOSED |
| Research sourcing | Legacy redirect (`smart-sourcing/page.tsx`) | n/a | PARTIAL — 독립 surface 없음, 견적 워크큐 내부 흡수 |
| RFQ / quote management | `/dashboard/quotes` 6-section sticky rail (380px) | §11.144 운영 브리핑 land | CLOSED |
| Work queue console | `/dashboard/work-queue` + Sheet drawer (`QueueDetailPanel`) | §11.143 운영 브리핑 land | CLOSED |
| Purchase conversion | `/dashboard/purchases` rail (380px) | §11.142-impl 운영 브리핑 land | CLOSED |
| PO landing | `/dashboard/purchase-orders` module landing (no rail) → handoff to `/dashboard/inbox?module=po` | n/a (cross-module via inbox) | CLOSED |
| Dispatch prep | `/dashboard/inbox` ContextPanel (320px) | §11.145 cross-module 운영 브리핑 | CLOSED |
| Inventory | `/dashboard/inventory` + `InventoryContextPanel` (420px sticky) + Sheet drawer | §11.146 운영 브리핑 land | CLOSED |
| Receiving detail | `/dashboard/receiving/[receivingId]` via `OperationalDetailShell` (6-zone) | §11.149 brief banner land | CLOSED |
| Settings | `/dashboard/settings` (1443 lines) | n/a — but governance issues (see §9) | RISK |
| Support center | `/dashboard/support-center` (§11.62 layout fix) | n/a — fallback only | CLOSED |
| Audit trail | `/dashboard/audit/page.tsx` (§11.89 PDF export) | n/a | CLOSED |

### 7.2 Defect signals

- `<textarea>` 검색 → 1건 (`organizations/page.tsx:449` "조직 설명" — 의도된 description input). chatbot drift 없음. ✅
- "AI 견적" 텍스트 — `quotes/page.tsx`에 5건 검출 모두 `AI 견적서 비교 분석` 모달 (§11.54 색상/§11.66 visibility 정정 closed). chatbot UI 아님. ✅
- `hidden md:flex` / `hidden lg:flex` 검색 → 정상 desktop rail (purchases, quotes, budget detail, inbox 등). ✅
- 5개 `.bak*` 파일 (`dashboard/budget/[id]/page.tsx.bak{1,2,3,4}` + `dashboard/page.tsx.bak-1145`) — repo hygiene 정리 권장.
- 4개 `.fuse_hidden*` artifacts (`activity-logs/`, `audit/`, `support-center/`) — sandbox FUSE leftover, real repo에는 없을 가능성.

### 7.3 Page-per-feature regression

- `dashboard/orders` + `dashboard/smart-sourcing` page.tsx — redirect-only with TODO. **next release deletion candidate**. ✅ 현재는 정합 (legacy URL preservation).

---

## 8. Phase B-α Readiness

| Phase | Readiness | Blockers | Files | Acceptance | Status |
|---|---|---|---|---|---|
| **α-A** purchase-conversion-resolver.ts + tests | 5/5 | 0 | `lib/ontology/purchase-conversion-resolver.ts` (508 lines) + `__tests__/lib/ontology/purchase-conversion-resolver.test.ts` (48 cases) | 30 entity refs + 5분기 conversion status + 전체 facts source mapping | **CLOSED** ✅ |
| **α-B** /api/work-queue/purchase-conversion endpoint | 5/5 | 0 | `app/api/work-queue/purchase-conversion/route.ts` + `bulk-po/route.ts` | 10 case test | **CLOSED** ✅ |
| **α-C** UI rewire for Purchase Conversion Queue | 5/5 | 0 | `dashboard/purchases/page.tsx` (982 lines) | useQuery + fetch /api/work-queue/purchase-conversion | **CLOSED** ✅ |
| **α-D** optional bulk PO / selectedReplyId persistence | 5/5 | 0 | bulk-po endpoint + α-D §11.21 schema | bulk PO conversion + selectedReplyId persistence | **CLOSED** ✅ |
| **α-E** closeout doc | 4/5 | doc 자체는 ADR §11.21 + §11.142-impl 분산 — 단일 closeout 문서 부재 | n/a | dedicated CLOSEOUT.md vs ADR entry 분산 | **PARTIAL** — closeout 컨텐츠는 land. 단일 통합 문서 별도 트랙. |

**Audit verdict:** Phase B-α 자체는 **closed**. 호영님 known context의 "Phase B-α plan opened" 상태는 추월됨. 다음 트랙은 Phase B-α 후속이 아니라 **governance + cleanup**.

---

## 9. Settings Governance Audit

`apps/web/src/app/dashboard/settings/page.tsx` (1443 lines) 정밀 audit.

| Field | Line | 행동 | Spec 정합 | 판정 |
|---|---|---|---|---|
| `profileName` | 630 | Input editable | ✅ user profile | OK |
| `operatorRole` (직책 / 역할) | 633 | **Input editable** (`onChange={setOperatorRole}`) | ❌ Operational role must NOT be free-text editable | **HIGH RISK** |
| `profilePhone` | 638 | Input editable | ✅ user profile | OK |
| `profileEmail` | 641 | Input editable | ✅ user profile (단, identity verification 별도) | OK |
| `roleLabel` Badge | 645 | read-only `session.user.role` | ✅ canonical | OK |
| 운영 역할 및 업무 범위 SectionCard (§11.74) | 660 | read-only — `session.user.role` + `orgsData.organizations[].role` | ✅ canonical | OK |
| `workspaceName` | 217, 795 | useState mock "제1 바이오 R&D 센터" → read-only display | ❌ canonical source 부재 | **MEDIUM RISK** |
| `currencyUnit` | 220 | useState mock "KRW (₩)" → read-only display | ❌ canonical source 부재 | **MEDIUM RISK** |
| Metric / unit system | 218 주석 | 의도적 제거 (§11.74) | ✅ 정합 | OK |
| `confidenceThreshold` (Ontology engine) | 223 | useState slider (Save behavior 미검증) | ⚠️ admin-only? 일반 운영자 노출이면 RISK | **UNVERIFIED** |
| `autoApprovalEnabled` / `autoApprovalLimit` | 225–226 | useState | ⚠️ governance overreach 가능성 | **UNVERIFIED** |
| `approvalTier1/2/3` | 230–232 | useState | ⚠️ 같은 우려 | **UNVERIFIED** |
| Save behavior (`profileMutation` line 543 disabled gate) | 543 | `isDirty` + isPending 검증 | OK 형식 | save endpoint가 실제로 free-text role을 reject하는지 unverified |

### 9.1 Recommended cleanup (NO IMPLEMENTATION IN THIS RUN)

- **line 633**: `<Input value={operatorRole} onChange={...} />` → `<Display>{roleLabel}</Display>` (read-only Badge, 같은 SectionCard에서 §11.74 이미 read-only 처리하고 있으므로 line 632 FieldBlock 자체 삭제 또는 read-only 변환).
- **line 217**: `useState("제1 바이오 R&D 센터")` → `useQuery(["workspace-canonical"])` + fallback indicator. 또는 section 자체 hide until backend wires up.
- **line 220**: 같은 패턴.
- **lines 223–232**: `confidenceThreshold` / `autoApprovalLimit` / `approvalTier1/2/3` — 이 ontology engine 슬라이더가 일반 운영자에게 노출되는지 또는 admin-only인지 추가 audit. 만약 일반 노출이면 RISK escalation.

---

## 10. Operational Brief Rail Assessment

### 10.1 Plan vs implement gate

호영님 known context는 "Plan after α-A/α-B/α-C unless repo evidence proves it is already safe" 의 expected likely answer를 명시. **Repo evidence는 implementation already complete.**

### 10.2 Verified land (§11.142–§11.156)

| Layer | Files | Status |
|---|---|---|
| **Direction lock** | ADR-002 §11.142 entry | CLOSED (40a2f150) |
| **Implementation surface 1 — Purchase Conversion** | `dashboard/purchases/page.tsx` rail | CLOSED (6d691ed1) |
| **Implementation surface 2 — Work Queue** | `dashboard/work-queue` Sheet drawer (`QueueDetailPanel`) | CLOSED (556417dd) |
| **Implementation surface 3 — RFQ-Quote** | `dashboard/quotes/page.tsx` 380px sticky rail | CLOSED (cfa7fea0) |
| **Implementation surface 4 — Inbox cross-module** | `dashboard/inbox/page.tsx` ContextPanel | CLOSED (cfa7fea0) |
| **Implementation surface 5 — Inventory** | `inventory-context-panel.tsx` 420px | CLOSED (cfa7fea0) |
| **Shell-level (Receiving + 다른 OperationalDetailShell consumer)** | `dashboard/_components/operational-detail-shell.tsx` brief banner | CLOSED (59a55eb1) |
| **Mobile bottom sheet** | `components/operational-brief/mobile-bottom-sheet.tsx` | CLOSED (59a55eb1) |
| **5 surface 모바일 wiring** | purchases / quotes / inbox / inventory (Work Queue는 native Sheet) | CLOSED (5f83b26d) |
| **Cache + adapter (KV stub)** | `lib/ai/operational-brief-{cache,cache-adapter,cache-metrics}.ts` | CLOSED (59a55eb1, KV impl 5f83b26d) |
| **Narrative endpoint** | `/api/operational-brief/narrative` POST + DELETE | CLOSED (5f83b26d) |
| **Anthropic LLM integration** | `lib/ai/operational-brief-narrative.ts` (env-gated + deterministic fallback) | CLOSED (5f83b26d) |
| **Hook + invalidate helper** | `lib/hooks/use-operational-brief.ts` | CLOSED (5f83b26d) |
| **Admin metrics endpoint** | `/api/admin/operational-brief-cache-stats` | CLOSED (59a55eb1) |

### 10.3 Verdict

**Repo evidence proves Operational Brief implementation is already land + feature-complete.** 따라서 다음 단계는 plan/implement gate가 아니라:

- **§11.156 cache-bust call-site wiring** — `invalidateBriefNarrative()` 호출이 5 surface mutation onSuccess에서 0건. **불완전 wiring 잔존.**
- **§11.148 caller wire** — `useOperationalBriefNarrative` hook export 되었지만 5 surface에서 hook을 직접 호출하지 않고, narrative는 각 surface에서 hardcoded 또는 selectedSignals.summary로 표시. 즉 **endpoint live + hook live + UI 호출 0건** = wire incomplete.

### 10.4 Gap

**§11.142 lock 정합은 시각적으로 land** (운영 브리핑 헤더 + 4 chips + 4 sections + Primary CTA). 하지만 **narrative 자체는 5 surface 어디에서도 endpoint를 호출하지 않음** — 각 rail이 자체 selectedSignals로 표시. 이는 §11.142 spec의 "AI는 facts를 문장 압축만"의 LLM 측면이 실제로 trigger되지 않음을 의미.

**향후 트랙 후보:**

1. `#operational-brief-hook-call-sites` — 5 surface 가 useOperationalBriefNarrative 호출 + narrative 표시 위치 결정.
2. `#operational-brief-cache-bust-call-sites` — selectReplyMutation 등 mutation onSuccess에 invalidateBriefNarrative.

---

## 11. UX/UI Defect & Regression List

| ID | Severity | 위치 | 증거 | 권장 조치 |
|---|---|---|---|---|
| D-001 | HIGH | `settings/page.tsx:633` operatorRole free-text | `<Input value={operatorRole} onChange={(e) => setOperatorRole(e.target.value)} />` | read-only Badge로 전환, setter 제거 |
| D-002 | MEDIUM | `settings/page.tsx:217,795` workspaceName mock | `useState("제1 바이오 R&D 센터")` | 실 fetch + fallback indicator |
| D-003 | MEDIUM | `settings/page.tsx:220` currencyUnit mock | `useState("KRW (₩)")` | workspace.currency 실 fetch |
| D-004 | LOW-MEDIUM | `settings/page.tsx:223–232` confidenceThreshold/autoApproval/approvalTiers | useState 슬라이더 — admin-only verification 미실시 | governance scope audit |
| D-005 | LOW | `dashboard/orders/page.tsx`, `dashboard/smart-sourcing/page.tsx` redirect-only | TODO 명시 — next release deletion | 다음 release commit으로 삭제 |
| D-006 | LOW | 5개 `.bak*` 파일 (`dashboard/budget/[id]/`, `dashboard/page.tsx.bak-1145`) | repo hygiene | git rm |
| D-007 | LOW | 4개 `.fuse_hidden*` artifacts | sandbox FUSE leftover (real repo 영향 unclear) | sandbox 정리 또는 무시 |
| D-008 | LOW | `dashboard/quotes/page.tsx:1086-1090` 승인 정책 / 외부 승인 hardcoded "없음 / 불필요" | rail F section | canonical approval workflow source 연결 |
| D-009 | LOW | Phase B-α α-E 단일 closeout 문서 부재 — content는 ADR §11.21 + §11.142-impl 분산 | doc only | dedicated `docs/closeouts/CLOSEOUT_phase-b-alpha.md` 생성 |
| D-010 | LOW | §11.156 invalidateBriefNarrative helper 호출 0건 | hook export only | mutation onSuccess wire-up |

**No chatbot drift.** No dead button. No raw enum exposure (§11.40에서 정정). No modal overlay blocking workbench. No preview overriding canonical truth (§11.39에서 정정). No fallback support as primary.

---

## 12. Risk Register

| Risk | Severity | Probability | Affected Surface | Evidence | Mitigation | Priority |
|---|---|---|---|---|---|---|
| **operatorRole free-text payload pollution** | HIGH | MEDIUM | settings page → User.role payload | `settings/page.tsx:633` | line 633 read-only 전환 + save endpoint role-strip 검증 | **P1** |
| **workspaceName mock as canonical** | MEDIUM | LOW | settings + downstream rendering | `settings/page.tsx:217,795` | canonical fetch + indicator | **P2** |
| **§11.156 cache-bust unwired** → narrative stale | MEDIUM | MEDIUM | 5 surface 운영 브리핑 narrative | helper export only | mutation onSuccess wire | **P2** |
| **§11.148 narrative hook unwired** → LLM/cache infra unused | LOW-MEDIUM | HIGH | 5 surface | hook export only, 0 callers | UI 통합 location 결정 + hook 호출 | **P3** |
| **Settings ontology engine governance overreach** | LOW-MEDIUM | UNVERIFIED | settings page | line 223–232 useState | admin-only verification | **P2** |
| **5 stale .bak files + 4 fuse_hidden artifacts** | LOW | LOW | repo hygiene | filesystem | git rm | **P4** |
| **Phase B-α α-E closeout doc 분산** | LOW | LOW | docs only | ADR §11.21 + §11.142-impl 분산 | dedicated CLOSEOUT 문서 | **P4** |
| **/dashboard/orders + /dashboard/smart-sourcing redirect-only legacy** | LOW | LOW | URL-level | TODO comment | next release deletion | **P4** |
| **Quote approval workflow not wired to rail F section** | LOW | LOW | quotes rail | `quotes/page.tsx:1086-1090` hardcoded "없음/불필요" | canonical approval source 연결 | **P3** |
| **Test full sweep timeout in sandbox** | INFO | LOW | CI 자체는 정합 | 92 test files | CI에서 재검증 | **P5** |
| **§11.155 mobile sheet wiring incomplete (Work Queue)** | NONE | NONE | n/a | Work Queue uses native Sheet (responsive) — not a defect | — | — |
| **Push status unverified** | INFO | LOW | repo state | sandbox `git push` credential 부재 | 호영님 push 보고 신뢰 | — |

---

## 13. Recommended Next 5 Commits

### Commit 1 — `#settings-operator-role-readonly-cleanup`

| 항목 | 내용 |
|---|---|
| Objective | `settings/page.tsx:633` operatorRole free-text Input → read-only Badge. Identity Governance violation 해소. |
| Files likely touched | `apps/web/src/app/dashboard/settings/page.tsx` (1 file, ~5 lines). |
| Acceptance criteria | (a) line 633 Input 제거 또는 read-only attr 추가. (b) `setOperatorRole` setter 제거. (c) 같은 SectionCard line 660의 §11.74 read-only 영역과 의미 중복 시 line 632 FieldBlock 자체 삭제. (d) save mutation payload에서 operatorRole 미전송 검증. |
| Non-regression constraints | profileName, profilePhone, profileEmail 편집 정합 보존. |
| Suggested commit message | `§11.157 #settings-operator-role-readonly — operatorRole free-text Input 제거 (Identity Governance)` |

### Commit 2 — `#operational-brief-narrative-cache-bust-call-sites`

| 항목 | 내용 |
|---|---|
| Objective | §11.156에서 export된 `invalidateBriefNarrative()` 를 5 surface 핵심 mutation onSuccess에 wiring. cache stale window 차단. |
| Files likely touched | `apps/web/src/app/dashboard/quotes/page.tsx` (`selectReplyMutation` onSuccess), `apps/web/src/components/dashboard/work-queue-console.tsx` (`useExecuteOpsAction` onSuccess), `apps/web/src/app/dashboard/inventory/inventory-content.tsx` (onReorder onSuccess after `aiPanel.preparePanel`), `apps/web/src/app/dashboard/inbox/page.tsx` (`handleAction` onSuccess). |
| Acceptance criteria | 4 surface 의 mutation onSuccess가 `invalidateBriefNarrative({...sourceTrace, sourceUpdatedAt: new Date()})` 호출. RED test source-level guard. |
| Non-regression constraints | 기존 mutation onSuccess wiring (queryClient.invalidateQueries 등) 0 회귀. invalidate 실패 silent 보존. |
| Suggested commit message | `§11.158 #operational-brief-cache-bust-call-sites — 5 surface mutation onSuccess wire (invalidateBriefNarrative)` |

### Commit 3 — `#settings-workspace-canonical-fetch`

| 항목 | 내용 |
|---|---|
| Objective | `settings/page.tsx:217,220,795` workspaceName + currencyUnit hardcoded mock → canonical Workspace fetch. UnverifiedDataAsCanonical 위험 차단. |
| Files likely touched | `apps/web/src/app/dashboard/settings/page.tsx` (1 file). 신규 endpoint 또는 기존 `/api/me` 확장 가능. |
| Acceptance criteria | (a) workspace fetch endpoint 결정 + 사용. (b) fetch 실패 시 명시적 fallback indicator ("데이터 미동기화" 등). (c) line 220 currencyUnit 동일 처리. |
| Non-regression constraints | section 하단 enterprise/auto-generated ID 표시 보존. |
| Suggested commit message | `§11.159 #settings-workspace-canonical — workspaceName/currency canonical fetch` |

### Commit 4 — `#stale-bak-files-cleanup` + `#dashboard-orders-smart-sourcing-removal`

| 항목 | 내용 |
|---|---|
| Objective | (a) 5개 `.bak*` 파일 + 4개 `.fuse_hidden*` artifact 제거. (b) `dashboard/orders/page.tsx` + `dashboard/smart-sourcing/page.tsx` redirect-only TODO 명시 페이지 삭제. |
| Files likely touched | `git rm` 5 + 4 + 2 = 11 file. |
| Acceptance criteria | (a) `find -name "*.bak*"` 0건. (b) `dashboard/orders/`, `dashboard/smart-sourcing/` 폴더 삭제. (c) middleware/route inventory 영향 없음. (d) URL-level legacy redirect 동작이 §11.55 redirect 패턴으로 다른 곳에 보존되어 있는지 확인. |
| Non-regression constraints | 기존 inbound link 깨지면 안 됨. `dashboard/orders` 또는 `dashboard/smart-sourcing` 직접 link하는 caller 0건 확인 필요. |
| Suggested commit message | `§11.160 cleanup — 5 .bak files + 2 redirect-only legacy page 제거` |

### Commit 5 — `#operational-brief-hook-call-sites`

| 항목 | 내용 |
|---|---|
| Objective | `useOperationalBriefNarrative` hook을 5 surface 운영 브리핑 § 1. 상황 요약 section에 통합. 현재는 selectedSignals.summary hardcoded. LLM narrative env가 활성화될 때 자동 적용. |
| Files likely touched | 5 surface page.tsx (purchases / quotes / inbox / inventory / work-queue Sheet). |
| Acceptance criteria | (a) 각 surface § 1 상황 요약에 hook 호출 + isLoading + cached 표시. (b) hook이 fail 시 기존 selectedSignals.summary 보존 (graceful). (c) §11.142 lock의 "AI는 status 결정 0" 정합 — facts는 resolver, narrative만 LLM. |
| Non-regression constraints | 기존 selectedSignals.summary 표시 유지 (fallback path). |
| Suggested commit message | `§11.161 #operational-brief-hook-call-sites — 5 surface 운영 브리핑 narrative hook integration` |

---

## 14. Implementation Prompts for Next Session

### Prompt 1 — `§11.157 #settings-operator-role-readonly-cleanup` (RECOMMENDED FIRST)

```
LabAxis 운영 총괄로서 §11.157 #settings-operator-role-readonly-cleanup 트랙 진행.

목표:
apps/web/src/app/dashboard/settings/page.tsx:633 의 operatorRole free-text Input
을 제거하여 Identity Governance 정합 회복. 같은 SectionCard line 660 (§11.74)이
이미 read-only 정합인데 line 633은 자유 편집 허용 — RBAC 위반.

context (verified by audit):
- line 216 useState `operatorRole` 초기값 "연구실 관리자 (Lab Manager)"
- line 633 `<Input value={operatorRole} onChange={(e) => setOperatorRole(e.target.value)} />`
- line 645 `roleLabel` Badge (real `session.user.role` 매핑) 이미 존재
- line 660 SectionCard "운영 역할 및 업무 범위" — §11.74 의도된 read-only 영역

Phase 0 audit (read-only):
- line 632 FieldBlock "직책 / 역할" 자체가 line 645 Badge / line 660 SectionCard
  와 의미 중복인지 확인. 중복이면 line 632 전체 삭제. 별도 의미면 line 633 만
  read-only 변환.
- save mutation (line 543 profileMutation)이 operatorRole field를 payload에 포함
  하는지 확인. 포함되면 server-side strip 정합 verify.

Phase 1 RED:
__tests__/api/admin/settings-operator-role-readonly.test.ts (source-level guard)
- expect(source).not.toMatch(/onChange.*setOperatorRole/)
- expect(source).not.toMatch(/setOperatorRole/)  // setter 자체 제거 검증
- expect(source).toMatch(/roleLabel/)  // canonical Badge 보존

Phase 2 GREEN:
- (option A) line 632–634 FieldBlock 전체 삭제.
- (option B) line 633 Input → <p>{roleLabel}</p> read-only display.
- 어느 옵션이든 setOperatorRole + operatorRole useState 제거.

verify: vitest 1/1 PASS, tsc clean.

ADR §11.157 기재 + commit + push.

규칙: minimal-diff. 다른 settings field 변경 0. payload 처리는 별도 트랙.
```

### Prompt 2 — `§11.158 #operational-brief-narrative-cache-bust-call-sites`

```
LabAxis 운영 총괄로서 §11.158 트랙 진행.

목표:
§11.156에서 export된 `invalidateBriefNarrative(sourceTrace)` helper 가
0 caller. 5 surface 의 핵심 mutation onSuccess 에 wire — narrative cache stale
window 차단.

context (verified by audit):
- §11.156 helper 위치: apps/web/src/lib/hooks/use-operational-brief.ts
- §11.142 lock: facts 는 resolver canonical, narrative 만 cache (5분 TTL +
  sourceUpdatedAt invalidation). cache-bust 는 운영자 mutation 즉시 반영용.

Phase 0 audit (read-only):
검사할 mutation onSuccess 위치:
1. apps/web/src/app/dashboard/quotes/page.tsx — selectReplyMutation onSuccess (§11.21)
2. apps/web/src/components/dashboard/work-queue-console.tsx — useExecuteOpsAction
3. apps/web/src/app/dashboard/inventory/inventory-content.tsx — onReorder onSuccess
   (aiPanel.preparePanel 직후)
4. apps/web/src/app/dashboard/inbox/page.tsx — handleAction onSuccess
5. (optional) apps/web/src/app/dashboard/purchases/page.tsx — bulk-PO mutation

각 mutation의 sourceTrace 정합 매핑:
- quotes: { quoteId, module: "quote_detail", sourceUpdatedAt: new Date() }
- work-queue: { workQueueTaskId, module: "work_queue", sourceUpdatedAt: new Date() }
- inventory: { inventoryId, module: "inventory", sourceUpdatedAt: new Date() }
- inbox: { workQueueTaskId, module: "inbox", sourceUpdatedAt: new Date() }
- purchases (bulk-PO): { quoteId, module: "purchase_conversion", sourceUpdatedAt: new Date() }

Phase 1 RED:
__tests__/api/admin/operational-brief-cache-bust-call-sites.test.ts
- 4–5 surface source-level grep:
  expect(source).toMatch(/invalidateBriefNarrative/)
  expect(source).toMatch(new RegExp(`module:\\s*["']${moduleKey}["']`))

Phase 2 GREEN:
각 surface mutation onSuccess 끝에 try { invalidateBriefNarrative({...}) } catch silent.
helper 가 이미 silent fail 처리하지만 caller 도 try-catch 추가 (mutation 안전).

verify: vitest 1/1 PASS, 기존 onSuccess (queryClient.invalidateQueries 등) 0 회귀.

ADR §11.158 기재 + commit + push.

규칙: minimal-diff. 각 surface 5 line 미만 변경. mutation 본체 / queryClient
invalidation / toast 등 기존 onSuccess wiring 보존.
```

---

## Appendix A. Evidence Index

### A.1 Phase B-α implementation evidence

- `apps/web/src/lib/ontology/purchase-conversion-resolver.ts:64-85` — `PurchaseConversionItem` interface (15 fields).
- `apps/web/src/lib/ontology/purchase-conversion-resolver.ts:74` — `conversionStatus`.
- `apps/web/src/lib/ontology/purchase-conversion-resolver.ts:75` — `blockerType`.
- `apps/web/src/lib/ontology/purchase-conversion-resolver.ts:79-80` — `supplierReplies`, `totalSuppliers`.
- `apps/web/src/lib/ontology/purchase-conversion-resolver.ts:81` — `aiRecommendationStatus`.
- `apps/web/src/lib/ontology/purchase-conversion-resolver.ts:84` — `externalApprovalStatus`.
- `apps/web/src/app/api/work-queue/purchase-conversion/route.ts` — α-B endpoint.
- `apps/web/src/app/api/work-queue/purchase-conversion/bulk-po/route.ts` — α-D bulk-PO.
- `apps/web/src/app/dashboard/purchases/page.tsx:117-120` — α-C wiring (`useQuery` + `fetch`).
- `apps/web/src/__tests__/lib/ontology/purchase-conversion-resolver.test.ts` — 48 case markers.
- `apps/web/src/__tests__/api/work-queue/purchase-conversion.test.ts` — 10 case markers.

### A.2 Operational Brief evidence (§11.142–§11.156)

- `apps/web/src/app/dashboard/_components/operational-detail-shell.tsx` — §11.149 brief banner.
- `apps/web/src/components/operational-brief/mobile-bottom-sheet.tsx` — §11.152 shared mobile sheet (~165 lines).
- `apps/web/src/lib/ai/operational-brief-cache.ts` — §11.147 cache (~136 lines).
- `apps/web/src/lib/ai/operational-brief-cache-adapter.ts` — §11.150/§11.154 KV adapter.
- `apps/web/src/lib/ai/operational-brief-cache-metrics.ts` — §11.151 counter.
- `apps/web/src/lib/ai/operational-brief-narrative.ts` — §11.153 LLM + deterministic.
- `apps/web/src/app/api/operational-brief/narrative/route.ts` — POST + DELETE.
- `apps/web/src/app/api/admin/operational-brief-cache-stats/route.ts` — admin metric endpoint.
- `apps/web/src/lib/hooks/use-operational-brief.ts` — `useOperationalBriefNarrative` + `invalidateBriefNarrative`.

### A.3 Settings governance evidence

- `apps/web/src/app/dashboard/settings/page.tsx:216` — `operatorRole` useState (free-text init).
- `apps/web/src/app/dashboard/settings/page.tsx:217` — `workspaceName` mock.
- `apps/web/src/app/dashboard/settings/page.tsx:220` — `currencyUnit` mock.
- `apps/web/src/app/dashboard/settings/page.tsx:223-232` — ontology/approval-tier sliders.
- `apps/web/src/app/dashboard/settings/page.tsx:632-634` — `직책 / 역할` Input (HIGH RISK).
- `apps/web/src/app/dashboard/settings/page.tsx:645` — `roleLabel` Badge (canonical).
- `apps/web/src/app/dashboard/settings/page.tsx:660-685` — §11.74 SectionCard read-only.
- `apps/web/src/app/dashboard/settings/page.tsx:791-805` — workspace info read-only display.
- `apps/web/prisma/schema.prisma:121` — `model User` with `role UserRole`.
- `apps/web/prisma/schema.prisma:928` — `model Workspace`.

### A.4 Recent commits verifying §11 ecosystem

- `1fe49f7b` — P0 RFQ Handoff (verified).
- `d45e57b4` — Phase B-α plan opened (verified).
- `40a2f150` — §11.142 direction lock.
- `6d691ed1` — §11.142-impl Purchase Conversion.
- `556417dd` — §11.143 Work Queue.
- `cfa7fea0` — §11.144-147 (4 surface + cache).
- `59a55eb1` — §11.148-152 (5 트랙).
- `5f83b26d` — §11.153-156 (4 트랙) — current HEAD.

### A.5 Repo hygiene findings

- `apps/web/src/app/dashboard/budget/[id]/page.tsx.bak1` ~ `bak4` (4 files).
- `apps/web/src/app/dashboard/page.tsx.bak-1145` (1 file).
- `apps/web/src/app/dashboard/{activity-logs, audit, support-center}/.fuse_hidden*` (4 files, sandbox FUSE artifact).
- `apps/web/src/app/dashboard/orders/page.tsx` — TODO redirect-only.
- `apps/web/src/app/dashboard/smart-sourcing/page.tsx` — TODO redirect-only.

### A.6 ADR references

- `docs/decisions/ADR-002-pilot-tenant-seed.md` (1947 lines) — §11.0–§11.156 entries.

---

**End of audit.** No code modified. No new feature. No commit (other than this single report file).
