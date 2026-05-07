# Implementation Plan: §11.217 Phase 3 — 견적 일괄 발송 (batch dispatch)

- **Status:** 🔄 In Progress
- **Started:** 2026-05-07
- **Last Updated:** 2026-05-07
- **Estimated Completion:** 2026-05-09 (4 phases, ~8-12h)

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
⛔ DO NOT introduce server-side batch endpoint (canonical truth boundary 보호)
⛔ DO NOT introduce page-per-feature (별도 `/dashboard/quotes/batch-dispatch` 페이지 신설 금지)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `apps/web/src/components/quotes/dispatch/vendor-dispatch-workbench.tsx` — `VendorRequestModal` 가 single quote 단위로 `csrfFetch('/api/quotes/${quoteId}/vendor-requests')` POST. 결과 `{summary: {emailsSent, emailsFailed}, createdRequests}`.
- `apps/web/src/app/api/quotes/[id]/vendor-requests/route.ts` — quote ownership check + vendor email 발송 + activity log + security enforcement. POST schema: `{ vendors: [{email, name}], message, expiresInDays }`.
- `apps/web/src/components/quotes/dispatch/resolve-suppliers.ts` — `resolveSuppliers({quote})` 가 quote 별 auto-resolved supplier list 반환 (supplier_book / recent_rfq / ai_recommended / manual).
- `apps/web/src/app/dashboard/quotes/page.tsx` 의 `getQuoteDispatchPreflight(q)` — quote 별 hard-block 여부 (email 없는 supplier / supplier 0건) 사전 검사. 이미 single dispatch 에서 사용 중.

**Secondary References:**
- §11.217 Phase 1 (commit ffc9c72d) — 카드 정보 밀도 (displayTitle).
- §11.217 Phase 1B + Phase 2 (현 cluster 직전 커밋, host commit/push 대기) — AI 추천 page-top banner + KPI "발송 대기" cell 분리.
- §11.211 Path V (mock contract ↔ DB Order id 매핑 패턴 — Order resolver 검증 분기).
- §11.209d 결재 mutation cluster (multi-recipient 알림 dispatch 패턴).

**Conflicts Found:**
- 충돌 0. dispatch endpoint canonical truth 명확 (per-quote `/api/quotes/[id]/vendor-requests`). batch endpoint 부재 확인 (Phase 0 RED grep 결과 0).

**Chosen Source of Truth:**
- per-quote `POST /api/quotes/[id]/vendor-requests` 가 dispatch canonical mutation.
- batch flow 는 **client-side N×fetch 합산** (server endpoint 신설 0) — canonical truth boundary 보호 + ownership/audit/email-send 그대로 재사용.

**Environment Reality Check:**
- [x] repo / branch context: main, working dir.
- [x] runnable commands: vitest run, tsc --noEmit, Chrome smoke 모두 가능.
- [x] execution blockers: `quotes/page.tsx` 1850 line — Edit 시 minimal swap + 즉시 verify 패턴 강화. 큰 file truncation 위험 (이전 §11.217 Phase 1 hot fix lesson).
- [x] sandbox git index.lock 잔재 — 호영님 host 측 commit + push 가 중간 단계 release 패턴 (sandbox 측 commit 불가).

---

## 1. Priority Fit

**Current Priority Category:**
- [ ] P1 immediate
- [ ] Release blocker
- [ ] Post-release
- [x] **P2 / Deferred — operator productivity** (§11.217 cluster 의 마지막 main feature)

**Why This Priority:**
- §11.217 cluster 는 견적 관리 surface UI redesign 트랙. Phase 1 / 1B / 2 가 정보 밀도 + KPI 의미 분리 (사용자 식별 회복) 핵심.
- Phase 3 (batch send) 는 multi-quote 처리 효율화 — operator productivity 향상이지, 데이터 정합성 / billing / security 와 무관.
- P1 release-prep (vitest install / prisma generate / Batch 10) 와 충돌 0 — 모두 close.
- 호영님 명시적 우선순위 ("권장안대로") 정합으로 본 트랙 진입.

---

## 2. Work Type

- [x] **Feature** (operator productivity + same-canvas 정합)
- [x] **Web** (mobile 분기는 §11.217 Phase 3-mobile 별도 트랙)

---

## 3. Overview

**Feature Description:**
견적 관리 surface 의 PENDING quote (request_not_sent) row 에 checkbox 추가 → selection 1+ 시 sticky action bar (`<BatchActionBar>`) 노출 → "검토 시작" CTA → review sheet 안 N quote summary + auto-resolved supplier 표시 + 공통 message field → "전체 발송" → `Promise.allSettled` 로 N×`/api/quotes/[id]/vendor-requests` parallel fetch → 결과 합산 toast (성공 N / 실패 M / 제외 K) + refetch.

**server endpoint 신설 0**, **canonical truth path 재사용**, **page-per-feature 회귀 0**.

**Success Criteria:**
- [ ] PENDING (request_not_sent) state quote 만 row checkbox 표시 — non-PENDING checkbox 0.
- [ ] selection 1+ 시 sticky action bar 노출 — selectedCount === 0 시 action bar 0.
- [ ] action bar 가 dispatchable / hard-block 분리 표시 (preflight 합산).
- [ ] 검토 sheet 안 N quote summary + auto-resolved supplier list (read-only) + 공통 message Textarea.
- [ ] "전체 발송" 버튼 — dispatchable === 0 시 disabled + tooltip.
- [ ] 발송 시 `Promise.allSettled` parallel + per-quote 성공/실패 표시 + refetch + sheet close.
- [ ] partial failure 시 toast: "N건 발송 완료 / M건 실패 / K건 제외".
- [ ] KPI "발송 대기" → "회신 추적" 즉시 반영 (refetch 정합).

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] server-side batch endpoint (`/api/quotes/batch-dispatch`) — canonical truth boundary 보호, client-side 합산만.
- [ ] sheet 안 per-quote supplier 편집 — 단일 dispatch (VendorRequestModal) 으로 분기 안내.
- [ ] per-quote 다른 message — 공통 message 만, vendor-messages map 은 별도 트랙.
- [ ] mobile (Expo) 일괄 발송 — §11.217 Phase 3-mobile 별도 트랙.
- [ ] PENDING 외 다른 state quote batch action (예: SENT 일괄 재요청) — 별도 트랙.
- [ ] all-or-nothing transaction — `Promise.allSettled` partial failure 수용.

**User-Facing Outcome:**
PENDING quote 5건 (예: AI 추천 = "현재는 비교나 검토보다 견적 요청 발송이 우선입니다") 선택 → 검토 sheet → 모두 supplier auto-resolve 된 것 확인 → 공통 message 입력 → "전체 발송" → 5초 안 5/5 완료 toast → KPI "발송 대기 0 / 회신 추적 5" 반영.

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock — 4-zone 그대로, action bar 는 queue 위 sticky 추가만.
- [x] same-canvas — sheet 는 검토 단계만, dispatch 후 자동 close + 같은 견적 관리 page 에서 결과 반영.
- [x] canonical truth — Quote.status 전이 (PENDING → SENT) 는 server endpoint, client 는 refetch 만.
- [x] invalidation discipline — `refetch()` + `invalidateBriefNarrative` (있으면) + cache invalidate.

**Must Not Introduce:**
- [x] page-per-feature — 별도 페이지 신설 0, sheet 만.
- [x] chatbot/assistant reinterpretation — sheet 는 selectable work object summary + read-only supplier, 자유 input 0.
- [x] dead button / no-op — "전체 발송" 버튼은 dispatchable count 0 일 때 disabled + tooltip.
- [x] fake billing/auth shortcut — 모든 dispatch 가 기존 ownership + enforcement path.
- [x] preview overriding actual truth — sheet 는 preview, 실제 변경은 server response 후 refetch.

**Canonical Truth Boundary:**
- **Source of Truth:** Quote.status (DB enum: PENDING / SENT / RESPONDED / COMPLETED / CANCELLED), VendorRequest 테이블 (per-quote vendor list + email send log).
- **Derived Projection:** `deriveRailState`, `getOpStatus`, `getQuoteDispatchPreflight` (hardBlocked / blockers).
- **Snapshot / Preview:** sheet 안 supplier list (`resolveSuppliers` 결과) + 공통 message — local state, server 변경 0.
- **Persistence Path:** "전체 발송" 시 N×`POST /api/quotes/[id]/vendor-requests` → server 가 VendorRequest INSERT + sendEmail + Quote.status PATCH (PENDING → SENT) + activity log + audit log.

**UI Surface Plan:**
- [x] **Inline (queue 위 sticky action bar)** — selectedCount > 0 일 때만 노출.
- [x] **Bottom sheet** — 검토 sheet (Dialog 또는 Sheet 컴포넌트, 모바일은 full-screen).
- [ ] Right dock (X — sheet 가 multi-quote 검토에 더 적절).
- [ ] Split panel (X).
- [ ] New page (⛔ 금지).
- [ ] Settings panel (X).

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| **client-side N×fetch (server batch endpoint 0)** | canonical truth path 그대로, server 변경 0, ownership/audit/email-send 재사용. partial failure UX 가 명확 (per-quote 결과 합산). | network hop N개 → server load 증가. dispatch 는 light I/O, N=10 정도까지 안전. 향후 monitoring 필요시 chunked dispatch (5개씩) 별도 트랙. |
| **PENDING (request_not_sent) state quote 만 selectable** | 발송 대기가 batch action 의 정확한 의미. SENT 재요청 / RESPONDED 비교 등 다른 batch 는 별도 의미라 분리. | 일부 케이스 (SENT 재요청 batch) 별도 트랙 필요. trade-off 수용. |
| **auto-resolved supplier (read-only)** | per-quote supplier 편집은 단일 dispatch 의 VendorRequestModal 에서. batch 는 빠른 처리 우선. | supplier 편집이 필요한 quote 는 batch 에서 제외 → user 가 단일 dispatch 로 처리. UX 분기 명확. |
| **공통 message (per-quote message 0)** | 가장 자주 쓰는 use case (마감일 / 메모 일괄 적용). per-quote 다른 message 는 별도 vendor-messages map 트랙. | per-quote 다른 메모가 필요하면 단일 dispatch 로 분기. |
| **`Promise.allSettled` (rollback 0, partial failure 수용)** | dispatch 는 idempotent. all-or-nothing transaction 0. | partial failure 시 user 가 실패 quote 만 재발송. UX 명확. |

**Dependencies:**
- **Required Before Starting:** §11.217 Phase 1B + Phase 2 host commit + push + Vercel deploy 확인.
- **External Packages:** 0 (lucide-react, @/components/ui/dialog or sheet 모두 기존).
- **Existing Routes / Models / Services Touched:**
  - `POST /api/quotes/[id]/vendor-requests` (read-only — schema 변경 0, caller 추가만).
  - `apps/web/src/app/dashboard/quotes/page.tsx` (selection state + action bar + sheet 추가).
  - `apps/web/src/components/quotes/dispatch/vendor-dispatch-workbench.tsx` (단일 dispatch 그대로, batch sheet 는 별도 컴포넌트).

**Integration Points:**
- new component: `apps/web/src/components/quotes/dispatch/batch-dispatch-sheet.tsx` (~250-350 line).
- new component: `apps/web/src/components/quotes/dispatch/batch-action-bar.tsx` (~80-120 line).
- `quotes/page.tsx` 의 `selectedQuoteIds: Set<string>` state + setter + handler.
- existing `resolveSuppliers` / `buildDraftMessage` / `getQuoteDispatchPreflight` 재사용.

---

## 6. Global Test Strategy

All phases must strictly follow Red-Green-Refactor.

- **Phase 1 (selection state + checkbox UI):** source-level guard test (regression test 패턴) + state 동작 unit test.
- **Phase 2 (action bar + preflight):** action bar conditional render + preflight 합산 로직 test.
- **Phase 3 (batch sheet + parallel fetch):** sheet 컴포넌트 source guard + mocked fetch integration test (Promise.allSettled 결과 합산 검증).
- **Phase 4 (smoke + rollback):** Chrome smoke (3 PENDING quote 선택 → 발송 → KPI 반영 확인) + sandbox vitest sweep + tsc.

**Execution Notes:**
- vitest install A-1 정합 (rollup native 정상) — sandbox 측 즉시 RED-GREEN cycle 가능.
- tsc — pre-existing inventory-content / InventoryTable / lot-disposal-panel truncation 은 본 cluster 와 무관, 별도 트랙.

---

## 7. Implementation Phases

### Phase 0 — Context & Truth Lock
**Goal:** §11.217 Phase 1B + Phase 2 host commit 확인 + batch endpoint 부재 검증 + plan document 생성.
- Status: [x] Complete

**🔴 RED:**
- [x] §11.217 Phase 1B + Phase 2 sandbox 측 변경 + vitest 21/21 PASS 확인 (이 chat 직전).
- [x] batch endpoint 부재 grep 검증 (`grep -l "batch-dispatch" apps/web/src/app/api/quotes -r` → 0 result).
- [ ] **호영님 host 측 commit + push + Vercel deploy 정합 확인** (이 phase quality gate).

**🟢 GREEN:**
- [x] plan document 생성 (`docs/plans/PLAN_11.217-Phase3-batch-dispatch.md`).

**🔵 REFACTOR:**
- [x] scope 단순화 (per-quote message / mobile / SENT 재요청 batch 모두 out-of-scope 명시).

**✋ Quality Gate:**
- [x] §11.217 Phase 1B + Phase 2 sandbox 변경 정합 (test 21/21 PASS).
- [ ] §11.217 Phase 1B + Phase 2 production 반영 (호영님 host commit + push + Vercel deploy 정합) — Phase 1 진입 전 필수.
- [x] plan document 생성 + 호영님 승인.
- [x] scope out-of-scope 명시.

**Rollback:** planning-only — 코드 변경 0.

---

### Phase 1 — Selection state + checkbox UI (RED→GREEN)
**Goal:** PENDING quote row 에 checkbox 추가 + `selectedQuoteIds: Set<string>` state.
- Status: [ ] Pending

**🔴 RED:**
- [ ] vitest source-level test — `quotes-page-217-phase3-selection.test.ts` 생성.
- [ ] 검증: QuoteCard 가 `isSelectable` prop + checkbox 조건 (`railState === "request_not_sent"`) + `onToggleSelect` handler + page-level `selectedQuoteIds` Set state.

**🟢 GREEN:**
- [ ] QuoteCard 에 conditional checkbox 추가 — only PENDING quote.
- [ ] page-level `selectedQuoteIds: Set<string>` state + `toggleQuoteSelection(id)` handler + `clearSelection()` handler.
- [ ] selection 시 row 시각적 highlight (border + bg).

**🔵 REFACTOR:**
- [ ] click 영역 분리 — checkbox click ≠ row click (quote 선택 vs detail 열기).
- [ ] checkbox 시각적 정합 (Tailwind, rounded, focus-visible).

**✋ Quality Gate:**
- [ ] PENDING quote 만 checkbox 노출 (source-level test PASS).
- [ ] non-PENDING (SENT/RESPONDED 등) checkbox 0.
- [ ] selection state 토글 정상.
- [ ] dead-button 0 (checkbox click 이 실제 state 변경).
- [ ] 한국어 정합 (aria-label "${quote.title} 선택" 등).
- [ ] vitest 새 test PASS + 기존 test 0 fail.
- [ ] tsc — quotes/page.tsx 0 new error.

**Rollback:** `git revert <Phase 1 SHA>` — quote queue 기존 동작 그대로.

---

### Phase 2 — Batch action bar + preflight summary (RED→GREEN)
**Goal:** sticky action bar (`<BatchActionBar>`) — selectedCount > 0 시 노출 + dispatchable / hard-block 분류 + "검토 시작" CTA.
- Status: [ ] Pending

**🔴 RED:**
- [ ] BatchActionBar component test — `quotes-page-217-phase3-action-bar.test.ts`.
- [ ] 검증: selectedCount > 0 시 sticky render + dispatchable / hardBlock count + 검토 CTA disabled when dispatchable === 0.

**🟢 GREEN:**
- [ ] `apps/web/src/components/quotes/dispatch/batch-action-bar.tsx` 신설 (~80-120 line).
- [ ] 선택 quote 들의 `getQuoteDispatchPreflight` 결과 합산 (dispatchable / hardBlock).
- [ ] queue list 위 sticky positioning (`sticky top-0 z-40`).
- [ ] CTA: "선택 N건 — 발송 가능 M건 / 보류 K건" + "검토 시작" primary + "선택 해제" secondary.
- [ ] page-level state: `batchSheetOpen` (boolean).

**🔵 REFACTOR:**
- [ ] 한국어 정합 (visible label / sr-only / placeholder).
- [ ] hard-block tooltip ("연락 가능한 공급사가 없습니다" 등).

**✋ Quality Gate:**
- [ ] selectedCount === 0 시 action bar 0.
- [ ] dispatchable 0 시 검토 CTA disabled + tooltip 정합.
- [ ] raw enum 노출 0 (한국어 라벨만).
- [ ] vitest 새 test PASS + 기존 test 0 fail.
- [ ] tsc 0 new error.

**Rollback:** `git revert <Phase 2 SHA>` — selection state 만 남고 batch entry 0.

---

### Phase 3 — Batch dispatch sheet + parallel fetch (RED→GREEN)
**Goal:** review sheet 안 N quote summary + 공통 message + "전체 발송" → `Promise.allSettled` → 결과 합산 toast.
- Status: [ ] Pending

**🔴 RED:**
- [ ] BatchDispatchSheet source-level test — `quotes-page-217-phase3-sheet.test.ts`.
- [ ] 검증: component 존재 + auto-resolved supplier rendering + 공통 message field + "전체 발송" 버튼 disabled when dispatchable 0.
- [ ] mocked fetch integration test — 3 quote 중 2 성공 + 1 실패 시 toast 합산 정합.

**🟢 GREEN:**
- [ ] `apps/web/src/components/quotes/dispatch/batch-dispatch-sheet.tsx` 신설 (~250-350 line).
- [ ] Sheet/Dialog 컴포넌트, N quote header (제목 + auto-supplier badge), 공통 message Textarea, "전체 발송" 버튼.
- [ ] 발송 시: N×`csrfFetch('/api/quotes/${id}/vendor-requests')` parallel + `Promise.allSettled` + 결과 합산 + per-quote 성공/실패 표시.
- [ ] onSuccess: refetch + clearSelection + sheet close.
- [ ] hard-block quote 별도 표시 (제외 N건 + 사유) + supplier 편집은 단일 dispatch 안내.

**🔵 REFACTOR:**
- [ ] 발송 progress UI (N/M completed) loading state.
- [ ] partial failure 시 retry CTA per failed quote (단일 dispatch 로 분기).

**✋ Quality Gate:**
- [ ] N×fetch parallel 정상 (Promise.allSettled).
- [ ] partial failure 시 toast 정합 ("N건 발송 완료 / M건 실패 / K건 제외").
- [ ] refetch 후 KPI "발송 대기" → "회신 추적" 반영.
- [ ] canonical truth (Quote.status) 보호 — UI optimistic update 0.
- [ ] dead-button 0 (모든 button wired).
- [ ] vitest 새 test PASS + 기존 test 0 fail.
- [ ] tsc 0 new error.

**Rollback:** `git revert <Phase 3 SHA>` — batch action bar 만 남고 actual batch dispatch 0 (단일 dispatch 정합).

---

### Phase 4 — Smoke + Rollback + ADR (RED→GREEN)
**Goal:** Chrome smoke 검증 + ADR § 11.217 Phase 3 entry + sandbox vitest sweep.
- Status: [ ] Pending

**🔴 RED:**
- [ ] Chrome smoke 시나리오 정의 (3 PENDING quote 선택 → action bar → sheet → 발송 → KPI 반영 → status SENT 확인).
- [ ] rollback 시나리오 (failed dispatch 시 UI graceful — toast partial failure + retry CTA).

**🟢 GREEN:**
- [ ] Chrome smoke 실행 + console error 0 + Vercel runtime logs 정상 확인.
- [ ] ADR `docs/decisions/ADR-002-pilot-tenant-seed.md` § 11.217 Phase 3 entry append.
- [ ] sandbox vitest sweep (모든 새 + 기존 quote test PASS).
- [ ] tsc 정합.

**🔵 REFACTOR:**
- [ ] ADR 의 Out of Scope (per-quote message / mobile / SENT 재요청 batch / server-side batch endpoint) 명시.
- [ ] Lessons learned (큰 file edit + Promise.allSettled UX + same-canvas batch flow).

**✋ Quality Gate:**
- [ ] Chrome smoke 100% 통과 (3 PENDING → 발송 → KPI 반영).
- [ ] vitest sweep 0 fail.
- [ ] tsc 0 new error (pre-existing 무관).
- [ ] canonical truth 보존.
- [ ] page-per-feature 회귀 0.
- [ ] ADR 명시 + rollback path 명시.

**Rollback:** `git revert <Phase 4 SHA>` — env / schema 변경 0.

---

## 8. Optional Addenda

### A. Workflow / Ontology Addendum

**Resolver Input:** quote selection (PENDING only) / common message / dispatchable preflight.
**Expected Output:** N×VendorRequest INSERT + sendEmail + Quote.status PATCH.

**Surface Rules:**
- 견적 관리 (`/dashboard/quotes`) 안에서 batch flow 처리 — 별도 페이지 신설 0.
- action bar 는 queue 위 sticky (workbench 안).
- review sheet 는 bottom sheet (mobile 분기 시 full-screen).
- chatbot / terminal 0 — selectable work object summary + read-only supplier만.

**Validation:**
- [ ] PENDING quote selection 정합.
- [ ] action bar dispatchable / hard-block 분리 정합.
- [ ] sheet 안 auto-supplier 정합 (`resolveSuppliers` 결과).
- [ ] 발송 후 status SENT + refetch 정합.

### C. API Slimming Addendum

**Waste Type:** N×fetch parallel — 본 phase 의 의도 (server endpoint 신설 0). 향후 server load 증가 시 chunked dispatch (5개씩) 별도 트랙.

**Minimal Diff Fix:** server 변경 0, client component 추가만.

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| **Promise.allSettled partial failure UX 복잡** | Med | Med | per-quote 성공/실패 명시 + retry 시 단일 dispatch 안내. all-or-nothing 회피. |
| **server load spike (N×parallel fetch)** | Low | Low | dispatch light I/O, N=10 까지 안전. 향후 chunked dispatch 별도 트랙. |
| **selectedQuoteIds Set state stale (refetch 후)** | Med | Low | refetch 시 `clearSelection()` reset + sheet close 후에도 reset. |
| **PENDING 외 selectable 회귀 (UI bug)** | Low | High | source-level test 강제 (`railState === "request_not_sent"` 외 checkbox 0) + Chrome smoke. |
| **canonical truth (Quote.status) 덮어쓰기** | Low | High | server endpoint 가 처리, client 는 refetch 만. UI optimistic update 0. |
| **§11.217 Phase 1B + 2 host commit 미완** | High | High | Phase 0 quality gate 에 dependency 명시 — 호영님 host commit + Vercel deploy 확인 후 Phase 1 진입. |
| **큰 file (quotes/page.tsx 1850 line) Edit 잘림** | Med | High | minimal swap + 즉시 wc -l + tail 검증. 새 component 별도 file 분리. |

---

## 10. Rollback Strategy

- **If Phase 1 Fails:** revert checkbox + selection state — quote queue 기존 동작 그대로.
- **If Phase 2 Fails:** revert action bar — selection state 만 남고 batch entry 0.
- **If Phase 3 Fails:** revert sheet + parallel fetch — batch action bar 만 남고 actual batch dispatch 0.
- **If Phase 4 Fails:** revert ADR + Chrome smoke skip — 기능 land 됐지만 documentation 보강 필요.

**Special:** server endpoint 변경 0 → DB migration 0 → rollback 단순 (`git revert` 만).

---

## 11. Progress Tracking

- **Overall completion:** 25% (Phase 0 GREEN done; Phase 0 quality gate 의 host deploy 정합 대기)
- **Current phase:** Phase 0 (host deploy 대기)
- **Current blocker:** §11.217 Phase 1B + Phase 2 host commit + push + Vercel deploy 정합 확인 (호영님 직접 행동 필요).
- **Next validation step:** 호영님이 §11.217 Phase 1B+2 push + deploy 완료 후 → Phase 1 RED test 작성.

**Phase Checklist:**
- [x] Phase 0 partially complete (sandbox 변경 + plan 생성 + 승인 / host deploy 대기)
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete

---

## 12. Notes & Learnings

**Blockers Encountered:**
- [2026-05-07] §11.217 Phase 1B + Phase 2 sandbox commit 불가 (git index.lock) → 호영님 host commit + push 대기. 본 plan Phase 0 quality gate 에 명시.

**Implementation Notes:**
- (TBD — Phase 진행 시 update)

**Architectural Decisions (from approval round):**
- (a) **client-side N×fetch** 권장 (server batch endpoint 0) — 호영님 승인.
- (b) **PENDING quote 만 selectable** — SENT 재요청 batch 별도 트랙 — 호영님 승인.
- (c) **공통 message 만** — vendor-messages map 별도 트랙 — 호영님 승인.
