# Implementation Plan: #post-approval-purchase-order-flow Phase 1+2+3 — Vendor PO Flow

- **Status:** 🔄 In Progress (Phase 1.3 + bulk-po wiring 완성)
- **Started:** 2026-05-06
- **Last Updated:** 2026-05-06 02:21
- **Estimated Completion:** 2026-05-13 (working days, 18~22 시간)
- **Cluster:** #post-approval-purchase-order-flow (4.x Order tracking 닫힌 상태에서 1+2+3 통합 진행)

**CRITICAL INSTRUCTIONS (host execution rules):**

1. ✅ Check off completed task checkboxes after each phase
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success
⛔ DO NOT collapse Order ↔ POCandidate canonical truth boundary

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `apps/web/prisma/schema.prisma`
  - `Order` (line 1580): `quoteId @unique` — 1 quote 1 order 강제 (multi-vendor 미지원, **option A 에서 제거 대상**)
  - `OrderItem` (line 1612): vendor 정보 없음 — option A 는 Order 자체에 vendor 추가 (vendor 별 Order 분리)
  - `POCandidate` (line 2596): `vendor: String` — 단일 vendor 단위, 결재 전 후보. **vendor 별로 1개씩 생성됨**
  - `Vendor` (line 301): canonical vendor master (id / name / email / phone)
- `lib/ai/approval-workbench-engine.ts`: `po_conversion_entry → po_conversion_handoff_gate → po_conversion_completed` ontology 단계 존재 — Order 는 이 handoff_gate 통과 후 생성됨
- `lib/ai/dispatch-invalidation-engine.ts`: `po_conversion_completed / po_conversion_reopened` invalidation event

**Secondary References:**
- §11.209b cluster — POCandidate 결재 흐름 wiring 완료 (createPoCandidate caller, Tier 분기, 결재 대기 시각화)
- §11.99b — POCandidate.approvalStatus enum 통일
- Phase 4.x (commit `664ae3c8` + Phase 4.3 mobile) — Order tracking UI 닫힘

**Conflicts Found:**
- **C1.** `Order.quoteId @unique` 제약 vs vendor 별 Order 분리 의도 — option A 채택 시 제거 필요. 영향: §11.209d 결재 흐름은 1 Quote 1 결재 유지 (PurchaseRequest 1:1 quote) 하지만 Order 는 multi (1 quote → N order vendor 별).
- **C2.** POCandidate ↔ Order 매핑이 명시적이지 않음 — 현재 POCandidate 가 결재 통과 후 Order 가 생성되는 wiring 이 컨버터 함수에 있음 (확인 필요). option A 에서는 POCandidate 1개 → Order 1개 매핑 (POCandidate.vendor → Order.vendorId).
- **C3.** `Quote.itemCount` 와 vendor 별 Order grouping — vendor 별로 quote items 가 분배되는 기준 확인 필요 (POCandidateItem 이 candidate 별로 격리되어 있으므로 candidate 단위 grouping = vendor 단위 grouping).

**Chosen Source of Truth (Option A — vendor 별 결재/발송/Order 분리):**
- canonical truth = **Quote (RFQ)** → **multi POCandidate (vendor 별 결재 후보)** → **결재 통과 시 vendor 별 Order 1개 생성** → **Order 별 PDF + email 송부**
- `Order.quoteId @unique` **제거**
- `Order.vendorId` (Vendor relation) + `Order.poCandidateId` (POCandidate 1:1 매핑) 추가
- Order 의 status 분기는 vendor 별로 독립
- 기존 1 quote 1 order legacy data 는 backward compat (`Order.vendorId nullable` 으로 처리, UI 가 null vendor 를 "지정 없음" 표기)

**Environment Reality Check:**
- [ ] repo / branch context 확인 (main branch, latest commit `664ae3c8` Phase 4.1+4.2 / Phase 4.3 mobile 직전 push)
- [ ] vitest runnable 확인 (apps/web 안 npx vitest)
- [ ] prisma generate 호스트 의존 (sandbox flake 가능성, host 측에서 generate)
- [ ] migration 적용 = 호영님 host 측 (prisma migrate deploy)

---

## 1. Priority Fit

**Current Priority Category:**
- [ ] P1 immediate
- [x] Release blocker 인접 (multi-vendor RFQ 가 결재 후 발주 단계에서 막혀 있음)
- [ ] Post-release
- [ ] P2 / Deferred

**Why This Priority:**
- multi-vendor 발주는 LabAxis 운영 OS 의 핵심 가치 (1 RFQ = 다수 vendor 응답 → vendor 별 PO 생성). 현재 schema 가 이를 막고 있어 release 후 즉시 운영 시 회피 패턴이 발생.
- P1 (vitest install / prisma generate / @ts-nocheck / enum drift / RFQ handoff smoke) 와 충돌 없음. prisma generate 가 P1 에서 먼저 닫혀야 본 cluster Phase 1.2 GREEN migration 적용 가능 (dependency 명시).
- Batch 10 soft_enforce → full_enforce 와 병렬 진행 가능 (다른 트랙 surface).

---

## 2. Work Type

- [x] Feature (vendor 별 PO 신설 + PDF + email)
- [x] Migration / Rollout (`Order.quoteId @unique` 제거 + 새 column 추가)
- [x] Workflow / Ontology Wiring (POCandidate → Order vendor-aware conversion)
- [ ] Web (Phase 4.x 에서 닫힘)
- [x] Mobile (Phase 5 sub-phase 에서 vendor grouping 표시 정합)

---

## 3. Overview

**Feature Description:**
1 RFQ (Quote) 가 vendor 여러 곳으로 송신 → vendor 별 응답 (QuoteResponse) → 결재 후보 (POCandidate, vendor 별 1개) → 결재 통과 → **vendor 별 Order 1개씩 생성** → vendor 별 **PO PDF 자동 생성** → vendor 별 **email 송부**.

**Success Criteria:**
- [ ] `Order.quoteId @unique` 제거, `Order.vendorId` + `Order.poCandidateId` 추가
- [ ] POCandidate 결재 통과 시 vendor 별 Order 1개 생성하는 service 함수 존재
- [ ] vendor 별 PO PDF 생성 route + Korean 한글 PDF 템플릿
- [ ] vendor 별 email 송부 mutation route + audit log
- [ ] mobile + web order tracking surface 가 vendor 표시 (Phase 4.x 회귀 0)

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] vendor 별 결재 분리 (1 quote 1 결재 유지, vendor 별 결재는 별도 cluster)
- [ ] vendor portal / vendor login (별도 cluster)
- [ ] PO 수정 / 취소 신청 (Order PATCH 의 status CANCELLED 만 사용)
- [ ] vendor email 회신 자동 파싱 (수동 followUp)

**User-Facing Outcome:**
- 결재 승인 후 vendor 별로 PO 가 자동 생성됨 → 사용자는 vendor 별 Order tracking section 에서 각 PO 의 상태 / PDF / email 송부 이력 확인 가능
- 모바일에서도 같은 정보가 quote detail 안에서 vendor 별로 분리 표시됨

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock — 기존 dashboard surface 유지
- [x] same-canvas — quote detail 안 inline section 유지 (Phase 4.x 정합)
- [x] canonical truth — Order = 결재 후 vendor 별 발주서 (단일 source)
- [x] invalidation discipline — `po_conversion_completed` / `po_conversion_reopened` event 정합

**Must Not Introduce:**
- [ ] page-per-feature — 새 vendor PO 페이지 신설 금지, quote detail 안 같은 canvas
- [ ] chatbot/assistant reinterpretation of ontology
- [ ] dead button / no-op / placeholder success — PDF 생성 button 은 실제 PDF 또는 disabled
- [ ] fake email send — 실제 SMTP / SES / Resend 등 정합 또는 disabled
- [ ] preview overriding actual truth — 미리보기 PDF 가 actual Order 에 저장되지 않게 분리

**Canonical Truth Boundary:**
- **Source of Truth:** `Order` (DB) — vendor 별 발주서
- **Derived Projection:** OrderItem grouping by vendor (legacy backward compat)
- **Snapshot / Preview:** PDF 미리보기 = ephemeral, actual PDF 는 storage 저장 후 Order.poDocumentUrl 등 nullable column 또는 별도 OrderDocument 테이블
- **Persistence Path:** Order.id 기준 PDF storage key + email send audit log (createAuditLog)

**UI Surface Plan:**
- [x] Inline expand — quote detail 안 vendor 별 Order tracking section 추가 (web + mobile)
- [x] Existing route section — `/api/orders/[id]` 확장 (vendorId / poDocumentUrl 등 추가)
- [ ] New page (⚠️ 금지)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
|---|---|---|
| `Order.quoteId @unique` 제거 + `(quoteId, vendorId)` composite unique | vendor 별 multi-Order per quote 허용 | legacy data 의 vendorId NULL 처리 필요 (마이그레이션 안 backfill 정책) |
| `Order.vendorId` Vendor relation (nullable) | 신규 row 는 vendor 매핑 강제, legacy 는 NULL | 마이그레이션 시 기존 row 에 NULL 허용 (즉시 데이터 무결성 강제 안 함) |
| `Order.poCandidateId` POCandidate 1:1 매핑 | conversion 이력 추적 | POCandidate 삭제 시 SetNull (Order 보존) |
| PDF 생성 = synchronous 우선, async queue 는 차후 | MVP 빠른 출시 + caller 단순 | 긴 PDF 는 latency 위험 (>2s) — 차후 queue 분리 |
| Email 송부 = Resend / SES / SMTP 중 1개 선택 (host 측 결정) | 호영님 운영 환경 따라 선택 | host config 의존 — sandbox 에서 mock / disabled fallback |

**Dependencies:**
- Required Before Starting: P1 의 prisma generate 닫힘 (Phase 1.2 migration GREEN 전)
- External Packages: PDF 생성 = `pdfkit` 또는 `@react-pdf/renderer` (sandbox 안 install 후 결정), Email = `resend` 또는 `nodemailer`
- Existing Routes / Models / Services Touched: `Order`, `OrderItem`, `POCandidate`, `Vendor`, `/api/orders/[id]`, `/api/orders/by-quote/[quoteId]`, `lib/ai/approval-workbench-engine.ts`, `apps/mobile/app/quotes/[id].tsx`

**Integration Points:**
- API route: `/api/orders/[id]` (확장 — vendor / pdf / email field), 신규 `/api/orders/[id]/generate-pdf`, 신규 `/api/orders/[id]/send-email`
- Service: `convertPOCandidateToOrders(quoteId)` (POCandidate → vendor 별 Order N개)
- Event: `po_conversion_completed` invalidation 정합 (multi-Order 반환)
- Mobile: `useOrderByQuote` → multi-order 반환으로 hook 시그니처 변경 (`OrderDetail | null` → `OrderDetail[]`)

---

## 6. Global Test Strategy

All phases must strictly follow Red-Green-Refactor.

**Test Strategy by Work Type:**
- Schema migration → migration grep test + caller 정합 grep test
- Service layer (POCandidate → Order conversion) → unit test (vendor 매핑 / multi-Order / legacy NULL)
- API route (PDF 생성 / email 송부) → integration test (mock storage / mock email)
- UI wiring (web + mobile) → grep / snapshot test
- Audit log → createAuditLog wiring test

**Execution Notes:**
- Sandbox vitest runnable 가정 (직전 cluster 와 동일)
- prisma generate 가 sandbox 에서 flake 시 호영님 host migrate 후 진행
- Email 송부 test 는 mock fetch / mock provider 로 처리 (실제 송부 0)

---

## 7. Implementation Phases

### Phase 1.0: Truth Lock (Read-only Audit)
**Goal:** Order ↔ POCandidate ↔ Vendor 관계 정합 + caller 매핑 0 누락 확인.
- Status: [ ] Pending

**🔴 RED:** schema audit + caller grep — `Order.quoteId @unique` 의존 caller 식별
**🟢 GREEN:** caller 정합 매핑 표 작성 (Phase 1.2 swap 대상)
**🔵 REFACTOR:** scope 범위 확정 (legacy 데이터 backfill 정책)

**✋ Quality Gate:** unresolved conflict 0, caller 정합 매핑 0 누락
**Rollback:** planning-only (코드 변경 0)

---

### Phase 1.1: Schema RED — Failing Tests
**Goal:** option A 의 schema 변경을 강제하는 failing test 작성.
- Status: [ ] Pending

**🔴 RED:**
- `Order.quoteId @unique` 제거 + `(quoteId, vendorId)` composite unique grep test
- `Order.vendorId` + `Order.poCandidateId` field grep test
- migration directory 신규 생성 grep test
**🟢 GREEN:** scaffolding only (migration 미적용 — Phase 1.2 에서 GREEN)
**🔵 REFACTOR:** test name / regex 정합

**✋ Quality Gate:** 3~5 failing test (vitest fail 명시), 기존 test 회귀 0
**Rollback:** test file revert

---

### Phase 1.2: Schema GREEN — Migration + Prisma Swap
**Goal:** Order schema option A 적용.
- Status: [ ] Pending

**🔴 RED:** Phase 1.1 failing test (그대로)
**🟢 GREEN:**
- `apps/web/prisma/migrations/20260506_xxxxxx_order_vendor_grouping/migration.sql` 신규 생성
  - `ALTER TABLE "Order" DROP CONSTRAINT "Order_quoteId_key"`
  - `ALTER TABLE "Order" ADD COLUMN "vendorId" TEXT NULL`
  - `ALTER TABLE "Order" ADD COLUMN "poCandidateId" TEXT NULL`
  - `ALTER TABLE "Order" ADD CONSTRAINT "Order_quoteId_vendorId_key" UNIQUE ("quoteId", "vendorId")`
  - `ALTER TABLE "Order" ADD CONSTRAINT "Order_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL`
  - `ALTER TABLE "Order" ADD CONSTRAINT "Order_poCandidateId_fkey" FOREIGN KEY ("poCandidateId") REFERENCES "POCandidate"("id") ON DELETE SET NULL`
  - `CREATE INDEX "Order_vendorId_idx" ON "Order"("vendorId")`
  - `CREATE INDEX "Order_poCandidateId_idx" ON "Order"("poCandidateId")`
- `prisma/schema.prisma` Order 모델 업데이트
- caller 정합 (Phase 1.0 매핑 표 기준) 0 누락
**🔵 REFACTOR:** index / FK 정합

**✋ Quality Gate:** vitest 11/11 PASS (Phase 1.1 failing → green), tsc 회귀 0, 기존 Order caller 회귀 0 (mobile order tracking, web order tracking section)
**Rollback:** migration `down.sql` (호영님 host 측 rollback) + git revert

---

### Phase 1.3: POCandidate → Order Vendor-Aware Conversion Service
**Goal:** 결재 통과 시 POCandidate 가 vendor 별 Order N개로 변환.
- Status: [ ] Pending

**🔴 RED:**
- `lib/orders/convert-pocandidate-to-orders.ts` (NEW) 의 unit test 4~6개
  - input: quoteId + 결재 통과한 POCandidate[]
  - output: vendor 별 Order 1개씩 생성
  - vendor NULL 인 candidate 는 기본 Order (legacy 호환)
  - duplicate prevention (이미 생성된 vendor 는 skip)
  - audit log createAuditLog wiring
**🟢 GREEN:**
- service 함수 implement
- caller wiring (POCandidate 결재 mutation route 안에서 호출)
- audit eventType: `PURCHASE_REQUEST_APPROVED` 또는 신규 `ORDER_CREATED_FROM_POCANDIDATE`
**🔵 REFACTOR:** 함수 분리 (createOrder + linkToPOCandidate)

**✋ Quality Gate:** unit test 4~6 PASS, integration test (POCandidate approve → Order N 생성) PASS, no-op 0
**Rollback:** service file revert + caller 분리

---

### Phase 2.1: PO PDF Generation RED
**Goal:** vendor 별 PO PDF 생성 route 의 failing test.
- Status: [ ] Pending

**🔴 RED:**
- `/api/orders/[id]/generate-pdf` route grep test
- PDF generator helper (`lib/orders/po-pdf-generator.ts`) export grep test
- Korean 한글 폰트 / Order detail / vendor / item 표 / 합계 grep test
**🟢 GREEN:** scaffold only
**🔵 REFACTOR:** test name 정합

**✋ Quality Gate:** 3~4 failing test
**Rollback:** test file revert

---

### Phase 2.2: PO PDF Generation GREEN
**Goal:** PDF 실제 생성 + storage 저장 + Order.poDocumentUrl 매핑.
- Status: [ ] Pending

**🔴 RED:** Phase 2.1 failing test
**🟢 GREEN:**
- `lib/orders/po-pdf-generator.ts` (`pdfkit` 또는 `@react-pdf/renderer` — host install 후 결정)
- `/api/orders/[id]/generate-pdf` POST route (auth + ownership + PDF 생성 + storage upload + Order.poDocumentUrl 업데이트)
- `Order.poDocumentUrl` schema 추가 (별도 small migration 또는 Phase 1.2 와 합침)
- audit log `ORDER_PDF_GENERATED`
**🔵 REFACTOR:** 폰트 / 레이아웃 정합

**✋ Quality Gate:** PDF byte 0 체크, Korean 한글 깨짐 0, vitest GREEN, 한글 폰트 license 정합
**Rollback:** route + helper revert + Order.poDocumentUrl NULL

---

### Phase 3.1: Vendor Email RED
**Goal:** vendor 별 email 송부 mutation 의 failing test.
- Status: [ ] Pending

**🔴 RED:**
- `/api/orders/[id]/send-email` route grep test
- email helper (`lib/orders/po-email-sender.ts`) export grep test
- Korean 본문 + 제목 + PDF 첨부 grep test
- audit log `ORDER_EMAIL_SENT` grep test
**🟢 GREEN:** scaffold only
**🔵 REFACTOR:** test name 정합

**✋ Quality Gate:** 3~4 failing test
**Rollback:** test file revert

---

### Phase 3.2: Vendor Email GREEN
**Goal:** vendor 별 email 실제 송부.
- Status: [ ] Pending

**🔴 RED:** Phase 3.1 failing test
**🟢 GREEN:**
- `lib/orders/po-email-sender.ts` (host 환경에 따라 Resend / Nodemailer 선택)
- `/api/orders/[id]/send-email` POST route (auth + ownership + Order.vendorId.email 검증 + PDF 첨부 + email 송부 + audit log)
- 송부 이력 = `Order.emailSentAt` (DateTime nullable) + audit log
- vendor email 미설정 시 disabled (dead button 0)
**🔵 REFACTOR:** template 분리 / i18n 정합

**✋ Quality Gate:** vitest GREEN, mock email 송부 OK, 실제 송부 sandbox 차단 (host 측 toggle), audit log 0 누락
**Rollback:** route + helper revert + Order.emailSentAt NULL

---

### Phase 5: Smoke + Rollout + ADR + Cluster Close
**Goal:** mobile + web 동시 회귀 0 + ADR + cluster close.
- Status: [ ] Pending

**🔴 RED:** rollout failure mode 식별 (legacy data NULL / vendor email 미설정 / PDF 생성 latency)
**🟢 GREEN:**
- mobile `useOrderByQuote` 시그니처 변경 (`OrderDetail | null` → `OrderDetail[]`) caller 정합
- web `OrderTrackingSection` vendor 별 sub-list 분기 (Phase 4.2 회귀 0)
- mobile `apps/mobile/app/quotes/[id].tsx` vendor 별 Order section 분기 (Phase 4.3 회귀 0)
- ADR append (`docs/decisions/ADR-002-pilot-tenant-seed.md` 또는 신규 ADR 파일)
- cluster commit + push 안내
**🔵 REFACTOR:** 임시 instrumentation 정리

**✋ Quality Gate:** mobile + web order tracking 회귀 0, vendor 별 표시 정합, ADR 명시, rollback path 명시
**Rollback:** feature flag (예: `VENDOR_PO_GROUPING_ENABLED`) 또는 git revert + DB rollback (Phase 1.2)

---

## 8. Optional Addenda

### A. Workflow / Ontology Addendum
**Resolver Input:** quote.id, POCandidate[] (vendor 별), 결재 통과 status, vendor master
**Expected Output:** Order N개 생성 + status `ORDERED`, audit log `ORDER_CREATED_FROM_POCANDIDATE`

**Surface Rules:**
- quote detail 안 vendor 별 Order section (same-canvas)
- mobile = 같은 quote detail 안 vendor 별 sub-list
- chatbot / terminal / 자유 채팅 0

**Validation:**
- [ ] vendor 별 Order 표시 정합
- [ ] PDF 생성 / email 송부 button 의 disabled state (no-op 방지)
- [ ] audit log 0 누락

### D. Mobile Addendum
**Must Include:**
- `useOrderByQuote` 시그니처 변경 (`OrderDetail[]` 반환) — caller 1곳 (`apps/mobile/app/quotes/[id].tsx`) 정합
- vendor 별 Order list 표시 (FlatList 또는 ScrollView 분기)
- vendor email / PDF button 의 disabled state (vendor email 미설정 시)
- offline / pending sync state — vendor 별 Order 미생성 시 "결재 승인 대기 중" 표시

**Validation:**
- [ ] expired token 차단 (auth preflight)
- [ ] 빈 vendor Order list 시 fallback 표시
- [ ] pending sync — vendor 별 Order 생성 중 spinner

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `Order.quoteId @unique` 제거 시 §11.209d 결재 흐름 회귀 | Med | High | option A 는 1 quote 1 결재 유지, Order 만 vendor 별 분리 (Phase 1.0 audit) |
| OrderItem 가 legacy 1 Order 에 묶여 있던 경우 vendor 별 분배 누락 | Med | High | Phase 1.3 service 가 POCandidate (이미 vendor 별) 기반으로 분배 — OrderItem 재배치 0 |
| PDF 생성 latency >2s | High | Med | MVP 는 synchronous, 차후 queue 분리. UI 가 spinner + timeout 분기 |
| email 송부 vendor email 미설정 → no-op 위험 | High | Med | dead button 차단 — vendor.email 없으면 button disabled + tooltip "vendor 이메일 미설정" |
| Korean 한글 PDF 폰트 깨짐 | Med | Med | Pretendard / NotoSansKR 폰트 임베드 + Phase 2.2 quality gate 에서 byte 검증 |
| host email provider config drift | Med | High | env var (`EMAIL_PROVIDER`, `EMAIL_API_KEY`) 미설정 시 graceful disabled + ADR 명시 |
| migration apply 시 기존 Order row 에 vendorId NULL → UI null 처리 누락 | Med | Med | UI 가 null vendor 를 "지정 없음" 표기 (Phase 5 회귀 검증) |

---

## 10. Rollback Strategy

| Phase | Rollback Path |
|---|---|
| Phase 1.0 | planning-only — revert 0 |
| Phase 1.1 | test file revert (git checkout) |
| Phase 1.2 | down migration SQL (`ALTER TABLE "Order" DROP COLUMN ...` + `ADD CONSTRAINT "Order_quoteId_key" UNIQUE`) + git revert + prisma generate |
| Phase 1.3 | service file revert + caller 분리 |
| Phase 2.1 / 2.2 | route + helper revert + Order.poDocumentUrl NULL backfill |
| Phase 3.1 / 3.2 | route + helper revert + Order.emailSentAt NULL backfill |
| Phase 5 | feature flag toggle 또는 git revert + DB rollback (Phase 1.2 동일) |

**Special Cases:**
- DB migration rollback = 호영님 host 측 prisma migrate resolve + down.sql 적용
- Email 송부 후 회수 불가 — 본 cluster 는 mock / disabled state 우선, 실제 송부는 호영님 host config 적용 후 1차 smoke

---

## 11. Progress Tracking

- Overall completion: ~44% (4 of 9 phases)
- Current phase: Phase 1.3 closed → Phase 2.1 ready
- Current blocker: 호영님 host 측 prisma migrate deploy 필요 (Phase 2.1 RED 전 정합 안정)
- Next validation step: Phase 2.1 RED — PO PDF 생성 route + helper grep test

**Phase Checklist:**
- [x] Phase 1.0 — Truth Lock (read-only audit) — caller 매핑 표 + canonical truth 확정 (option A)
- [x] Phase 1.1 — Schema RED — 11 failing test
- [x] Phase 1.2 — Schema GREEN — schema swap + migration + caller 정합 (1곳) + 22/22 PASS
- [x] Phase 1.3 — POCandidate → Order conversion service — `convertPOCandidatesToOrders` 9/9 PASS
- [x] Phase 1.3-wiring — bulk-po route 의 vendor-aware swap (schema 1:N 정합 + service 호출 + legacy fallback) — 6/6 PASS, cluster 37/37
- [x] Phase 1.3-wiring-D — request approve route vendor-aware (결재 통과 자동 vendor PO) — 5/5 PASS, cluster 42/42
- [x] Phase 2.1 — PO PDF RED — 10 failing test
- [x] Phase 2.2 — PO PDF GREEN — pdfkit + 한글 Pretendard 임베드 + audit log + Content-Type application/pdf — 10/10 PASS, cluster 52/52
- [ ] Phase 3.1 — Vendor email RED
- [ ] Phase 3.2 — Vendor email GREEN
- [ ] Phase 5 — Smoke + Rollout + ADR + cluster close

---

## 12. Notes & Learnings

**Blockers Encountered:**
- (none yet)

**Implementation Notes:**
- (none yet)

**Source:**
- §11.209b cluster — POCandidate 결재 흐름 wiring
- §11.209d cluster — 결재 통과 mutation
- #post-approval-purchase-order-flow Phase 4.x — Order tracking UI (`664ae3c8` + Phase 4.3 mobile pending push)
