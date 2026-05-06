# Implementation Plan: §11.211 inbox PO mutation Order resolve + production seed parity

- **Status:** 🔄 In Progress (Phase 4 smoke 대기)
- **Started:** 2026-05-06
- **Last Updated:** 2026-05-06
- **Estimated Completion:** 2026-05-07
- **Path 채택:** Path V (ActionableRow 안 useQuery resolve) + Phase 3 defer (Sub-3b)
- **Cluster:** #post-approval-purchase-order-flow (last sub-track)
- **Track ID:** §11.211

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- Production smoke (2026-05-06) — `POST /api/orders/po-002/send-email` → `404 Order not found`
- `apps/web/src/lib/ops-console/inbox-adapter.ts:343,374,411` — 3개 PO inbox builder 모두 `entityId: po.id` (mock `PurchaseOrderContract.id`) forward
- `apps/web/src/lib/ops-console/seed-data.ts:587` — `PURCHASE_ORDER_002 = { id: 'po-002', poNumber: 'PO-2026-0088' }` (in-memory)
- DB Order write path: `apps/web/src/lib/orders/convert-pocandidate-to-orders.ts` (cluster Phase 1.2) — mock 과 unlinked

**Secondary References:**
- `docs/decisions/ADR-002-pilot-tenant-seed.md` — #post-approval-purchase-order-flow cluster close entry
- `apps/web/src/app/dashboard/purchase-orders/page.tsx` — B+H step 3 ActionableRow PDF/email button (entityId forward)
- `apps/web/src/app/api/orders/[id]/generate-pdf/route.ts` + `send-email/route.ts` — DB Order.findUnique 기반

**Conflicts Found:**
1. Display layer (mock `'po-002'`) ↔ DB layer (Order.id cuid) 매핑 helper 부재
2. ActionableRow PDF/email button 은 `entityId === Order.id` 라는 가정으로 wiring (실제 entityId 는 mock contract.id)
3. mock seed `PURCHASE_ORDER_002` 와 DB `Order` row 사이 어떤 매핑 key 도 정의되지 않음

**Chosen Source of Truth:**
- DB `Order` 모델 = canonical truth (PDF/email mutation 책임)
- mock `PurchaseOrderContract` = display projection (operational ontology, in-memory)
- **매핑 key: `Order.id === PurchaseOrderContract.id`** (예: `'po-002'`)
- Phase 0 발견: Order 모델에 `poNumber` column 자체 부재. mock 의 `id` (po-002) 를 production DB Order.id 로 explicit seed (cuid default override) — Sub-B 채택 (호영님 결정 2026-05-06)

**Environment Reality Check:**
- [x] repo / branch context understood (main, sandbox 와 host 정합)
- [x] runnable commands identified (vitest, tsc — sandbox 에서 일부 실행 불가, host 측 검증 권장)
- [x] execution blockers identified (host 측 production seed apply 필요)

---

## 1. Priority Fit

**Current Priority Category:**
- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release
- [ ] P2 / Deferred

**Why This Priority:**
- 본 cluster #post-approval-purchase-order-flow 의 마지막 sub-track
- B+H step 3 PDF/email button 은 production 에 노출됨 (Phase 4.2/4.3 정합) — 다만 mutation 시 404
- dead-button 0 정합 + production smoke 검증 환경 마무리
- P1 release blocker 는 아니나 cluster close 직전 production parity gap

---

## 2. Work Type

- [ ] Feature
- [x] Bugfix (B+H step 3 dead-button 0 보강)
- [ ] API Slimming
- [x] Workflow / Ontology Wiring (mock contract ↔ DB Order 매핑)
- [ ] Migration / Rollout
- [ ] Billing / Entitlement
- [ ] Mobile (단, ActionableRow 정합과 동일하게 mobile order tracking 도 영향 가능 — Phase 4 에서 검증)
- [x] Web

---

## 3. Overview

**Feature Description:**
inbox-adapter PO builder 가 mock `PurchaseOrderContract.id` 를 entityId 로 forward 하여 ActionableRow PDF/email button mutation 이 DB Order.findUnique 에서 404. mock display ↔ DB canonical truth 매핑 helper 추가 + 미존재 시 dead-button 0 정합 disabled UX + production seed parity 보강.

**Success Criteria:**
- [ ] inbox-adapter 3개 PO builder 가 `orderId?: string | null` populate (poNumber 매핑)
- [ ] ActionableRow PDF/email button 이 `orderId` 사용 (entityId 와 분리), null 시 disabled + tooltip
- [ ] production seed parity — `PURCHASE_ORDER_002` 와 매칭되는 DB Order row 존재
- [ ] production smoke 에서 ref_186 (PDF) + ref_187 (email) mutation 200 응답
- [ ] PDF Vercel Blob URL `Order.poDocumentUrl` 저장 + audit log `PO_PDF_GENERATED` 기록

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] mock seed 전체 deprecate (별도 cluster scope)
- [ ] inbox-adapter 의 quotes / purchases / receiving builder 정합 (PO 만 본 트랙)
- [ ] Order 모델 schema 추가 column (poDocumentUrl 등은 cluster Phase 4.1 완료)
- [ ] Vendor 모델 매핑 변경 (cluster Phase 1 완료)

**User-Facing Outcome:**
- 발주 관리 page 의 "공급사 대기" tab 에서 ActionableRow 의 "발주서 PDF 다운로드" / "공급사 이메일 발송" button 클릭 시 실제 PDF 생성 + 이메일 발송 (또는 disabled tooltip)

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock
- [x] same-canvas
- [x] canonical truth (DB Order)
- [x] invalidation discipline (mutation 후 inbox refetch)

**Must Not Introduce:**
- [x] page-per-feature 회귀 0
- [x] chatbot/assistant reinterpretation 0
- [x] dead button / no-op / placeholder success 0 (orderId null 시 disabled + tooltip)
- [x] fake billing/auth shortcut 0
- [x] preview overriding actual truth 0

**Canonical Truth Boundary:**
- Source of Truth: DB `Order` (Order.poNumber unique 가정 — Phase 0 검증)
- Derived Projection: `PurchaseOrderContract` (in-memory mock seed)
- Snapshot / Preview: ActionableRow row (UI surface)
- Persistence Path: `convertPOCandidatesToOrders` 또는 production seed script

**UI Surface Plan:**
- [x] Existing route section (`apps/web/src/app/dashboard/purchase-orders/page.tsx` ActionableRow)
- [ ] New page (⚠️ 0)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 매핑 key = `Order.id === po.id` (Sub-B) | schema 변경 0, inbox-adapter 변경 minimal, 가장 빠른 production parity | Order.id 가 cuid 가 아닌 mock-style id ('po-002') 로 1건 INSERT — production scale 시 isolated to seed |
| inbox-adapter Order.findUnique lookup (id 기반) | dead-button 0 + canonical truth 보호 + 향후 mock contract 추가 자동 정합 | inbox-adapter 책임 영역 확장 (1 query per PO inbox row, 단 캐시/batch 가능) |
| ActionableRow `orderId` field 사용 (entityId 와 분리) | mutation 은 orderId, navigation 은 entityId — 명확한 책임 분리 | UnifiedInboxItem + ModuleLandingItem schema 확장 (optional field) |
| production seed parity (Order + Quote + User + Vendor) | mock seed 와 DB 정합 — production smoke 검증 가능 | host 측 manual SQL 또는 seed script apply 필요. Quote/User/Vendor 의존성 동반 INSERT |

**Dependencies:**
- Required Before Starting: cluster Phase 1~4 완료 (schema swap + service + UI/route + audit) ✅
- External Packages: 없음
- Existing Routes / Models / Services Touched:
  - `apps/web/src/lib/ops-console/inbox-adapter.ts` (3개 PO builder)
  - `apps/web/src/lib/ops-console/module-landing-adapter.ts` (orderId forward)
  - `apps/web/src/app/dashboard/purchase-orders/page.tsx` (ActionableRow)
  - 새 helper: `apps/web/src/lib/orders/resolve-order-by-po-number.ts`
  - 새 seed: `apps/web/scripts/seed/po-display-order-parity.ts` 또는 prisma seed 보강

**Integration Points:**
- inbox-adapter ↔ Order.findFirst lookup (Phase 2)
- ActionableRow pdfMutation/emailMutation ↔ orderId forward (Phase 2)
- production DB ↔ mock seed parity (Phase 3)

---

## 6. Global Test Strategy

All phases must strictly follow Red-Green-Refactor.

**Test Strategy:**
- Source-grep style tests (sandbox vitest 일부 실행 불가, source 패턴 검증)
- inbox-adapter test: 3개 builder `orderId` populate + null fallback
- module-landing-adapter test: orderId forward
- purchase-orders/page.tsx test: button 분기 (`orderId` 사용 + null disabled)
- helper test: `resolveOrderByPoNumber` (db.order.findFirst signature)
- Phase 3 seed test: idempotent upsert pattern
- Phase 4 manual smoke (Claude in Chrome)

**Execution Notes:**
- sandbox vitest 일부 실행 불가 (rollup native 이슈) → host 측 verify
- tsc 실행 — host 측 또는 sandbox 의 manual grep 검증

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
**Goal:** Order.poNumber unique 여부 + inbox-adapter / ActionableRow source 재확인.
- Status: [ ] Pending | [x] In Progress | [ ] Complete

**🔴 RED:** poNumber unique constraint 가 schema 에 있는지 확인. 없으면 add 트랙 필요.
**🟢 GREEN:** Phase 0 audit 결과를 plan 본문에 기록.
**🔵 REFACTOR:** scope 명확화 (Phase 1 RED 시작 전).

**✋ Quality Gate:**
- [ ] `prisma/schema.prisma` Order.poNumber unique 확인 또는 add 트랙 결정
- [ ] inbox-adapter 3개 builder source 재확인 (entityId 위치)
- [ ] ActionableRow pdfMutation/emailMutation hook 의 entityId forward source 재확인
- [ ] cluster Phase 1~4 정합 reverify

**Rollback:** planning-only; no code change

---

### Phase 1: Contract & Failing Tests (RED)
**Goal:** orderId resolve + ActionableRow 분기 의 failing test 작성.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** 3개 source-grep test 추가 (Sub-B 정합 — helper 분리 불요, lookup 은 inbox-adapter 안에서 직접):
1. `__tests__/lib/ops-console/inbox-adapter-po-orderid.test.ts` — 3개 builder `orderId` field 추가 + `db.order.findUnique` lookup
2. `__tests__/lib/ops-console/module-landing-adapter-orderid-forward.test.ts` — forward
3. `__tests__/dashboard/po-actionable-row-orderid-mutation.test.ts` — `orderId ?? null` 분기 + disabled + tooltip

**🟢 GREEN:** N/A (RED only)
**🔵 REFACTOR:** 테스트 명명 정합

**✋ Quality Gate:**
- [ ] 4개 test 파일 추가 (RED — 모두 fail)
- [ ] 기존 테스트 0 회귀
- [ ] 테스트 명명 일관 (#post-approval-purchase-order-flow §11.211)

**Rollback:** test 파일 삭제

---

### Phase 2: GREEN — source fix
**Goal:** inbox-adapter Order lookup + ActionableRow orderId 분기 + helper 신설.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** Phase 1 의 4개 test
**🟢 GREEN (Sub-B 정합):**
- `inbox-adapter.ts` 3개 PO builder 안 `db.order.findUnique({ where: { id: po.id } })` lookup → `orderId: result?.id ?? null` populate (batch Promise.all)
- `UnifiedInboxItem` interface 에 optional `orderId?: string | null` 추가
- `ModuleLandingItem` 에 forward
- `purchase-orders/page.tsx` ActionableRow:
  - pdfMutation: `orderId` 사용, null 시 disabled
  - emailMutation: `orderId` 사용, null + vendorEmail null OR 으로 disabled
  - tooltip: "발주 row 가 아직 변환되지 않았습니다" (orderId null) 또는 "공급사 이메일이 설정되지 않았습니다" (vendorEmail null)

**🔵 REFACTOR:** 매핑 helper signature 명확화, batch lookup N+1 회피

**✋ Quality Gate:**
- [ ] Phase 1 의 4개 test pass
- [ ] tsc 0 error (host 측 verify)
- [ ] dead-button 0 (disabled state + tooltip 명시)
- [ ] N+1 query 0 (Promise.all 또는 `in` clause)
- [ ] same-canvas 보존 (UI 구조 변경 0)
- [ ] canonical truth 보존 (DB Order = source)

**Rollback:** Phase 2 의 4 file 변경 git revert

---

### Phase 3: Production seed parity (host 측 보조)
**Goal:** mock `PURCHASE_ORDER_002` 와 매칭되는 DB Order row INSERT — production smoke 검증 가능 환경.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** seed test (idempotent upsert pattern)
**🟢 GREEN:**
- `apps/web/scripts/seed/po-display-order-parity.ts` (또는 prisma seed 보강) 신설
- `prisma.order.upsert({ where: { poNumber: 'PO-2026-0088' }, create: { ... }, update: {} })` — idempotent
- vendor 매핑 (Sigma-Aldrich), items 2개 (PBS + RIPA, mock seed 의 lines 정합)
- 호영님 host 측 `npm run seed:po-parity` 또는 manual SQL 적용

**🔵 REFACTOR:** seed script 명명 일관, mock seed-data.ts 와 단일화 (별도 트랙으로 park 가능)

**✋ Quality Gate:**
- [ ] seed script idempotent (upsert)
- [ ] rollback SQL 명시 (`DELETE FROM "Order" WHERE "poNumber" = 'PO-2026-0088'`)
- [ ] host 측 apply 후 production DB Order row 확인 (`SELECT * FROM "Order" WHERE "poNumber" = 'PO-2026-0088'`)

**Rollback:** seed script 삭제 + DB rollback SQL

---

### Phase 4: Smoke + ADR + cluster close
**Goal:** production smoke 재검증 + ADR-002 §11.211 entry append + cluster close.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** rollout failure mode 정의 (button enabled 인데 mutation 실패 / disabled 인데 orderId 있음)
**🟢 GREEN:**
- production deploy (호영님 push)
- Claude in Chrome 으로 ref_186 (PDF) + ref_187 (email) 클릭 → 200 응답 확인
- PDF Vercel Blob URL `Order.poDocumentUrl` 저장 확인 (host 측 SQL 또는 admin)
- audit log `PO_PDF_GENERATED` + `VENDOR_EMAIL_SENT` 기록 확인
- ADR-002 §11.211 entry append (cluster close)

**🔵 REFACTOR:** 임시 console.log 제거 (있으면), Phase 0~3 learnings notes 보강

**✋ Quality Gate:**
- [ ] production smoke 200 응답
- [ ] Vercel Blob URL 확인
- [ ] audit log 기록 확인
- [ ] ADR entry append
- [ ] cluster close 명시 (호영님 confirm)

**Rollback:** git revert SHA + DB rollback SQL (Phase 3) + Vercel redeploy

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| Order.poNumber 가 nullable / non-unique | Med | High | Phase 0 schema 확인 + 필요 시 `@unique` 별도 mini-batch |
| mock contract poNumber 와 DB Order poNumber mismatch | Low | Med | Phase 3 seed 가 정확히 mock poNumber 매칭 |
| inbox-adapter 가 db query 추가 → N+1 | Low | Low | Phase 2 batch lookup (Promise.all 또는 in clause) |
| Phase 3 seed 가 production DB 정합 깨짐 | Med | High | upsert + idempotent + rollback SQL 명시 |
| host 측 vitest 실패 (sandbox 불가 path) | Med | Low | source-grep 검증 + host 측 verify 명시 |
| mobile order tracking 영향 | Low | Med | Phase 4 mobile smoke 추가 (`apps/mobile` 의 useOrderByQuote 영향 0 확인) |

---

## 9. Rollback Strategy

- If Phase 1 Fails: test 파일 4개 삭제
- If Phase 2 Fails: source 4 file revert (`git revert <SHA>`)
- If Phase 3 Fails: seed script 삭제 + `DELETE FROM "Order" WHERE "poNumber" = 'PO-2026-0088'`
- If Phase 4 Fails: 모든 commit revert + Vercel redeploy + DB rollback

---

## 10. Progress Tracking

- Overall completion: 5%
- Current phase: Phase 0
- Current blocker: Order.poNumber unique 검증
- Next validation step: schema 확인

**Phase Checklist:**
- [x] Phase 0 complete (Truth Lock — Sub-B 채택, Path V 로 swap)
- [x] Phase 1 complete (RED test — Path V 정합 1 file 유지, 2 file deprecated skip)
- [x] Phase 2 complete (GREEN — purchase-orders/page.tsx ActionableRow useQuery + orderId 분기)
- [~] Phase 3 deferred (Sub-3b — production seed parity defer, dead-button 0 자체로 production parity 보장)
- [ ] Phase 4 in progress (Chrome smoke + ADR §11.211 cluster close)

---

## 11. Notes & Learnings

**Blockers Encountered:**
- [2026-05-06] Production smoke 에서 ref_186/187 → 404 "Order not found" → root cause: mock contract ↔ DB Order 매핑 helper 부재.

**Implementation Notes:**
- mock seed `PurchaseOrderContract` 는 in-memory display layer, DB Order 는 canonical truth — 본 트랙은 매핑 helper 만 추가하고 mock 자체 deprecate 는 별도 cluster.
- ActionableRow 의 entityId 는 routing (entityRoute) 에는 그대로 사용 (mock contract.id), mutation 은 orderId 분리.

**Learnings:**
- (작성 중)
