# Implementation Plan: §11.228 Phase C1 — 견적 관리 일괄 처리 강화 (#20)

- **Status:** 🔄 In Progress
- **Started:** 2026-05-12
- **Last Updated:** 2026-05-12
- **Estimated Completion:** 2026-05-12

**CRITICAL INSTRUCTIONS** — phase 완료 시:
1. ✅ 체크박스 갱신
2. 🧪 quality gate 명령 실행
3. ⚠️ 모든 quality gate 항목 통과 확인
4. 📅 Last Updated 갱신
5. 📝 Notes 섹션에 learnings 기록
6. ➡️ 그 이후에만 다음 phase 진입

⛔ quality gate skip 0 / canonical truth 충돌 보류 시 진입 0 / dead button·no-op 도입 0

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 현재 `apps/web/src/app/dashboard/quotes/page.tsx` (§11.227 land 후)
- 현재 `apps/web/src/components/quotes/dispatch/batch-action-bar.tsx` (§11.217 Phase 3)
- 현재 `apps/web/src/components/quotes/dispatch/batch-dispatch-sheet.tsx` (§11.225 organizationVendorProducts forward)
- 현재 `apps/web/src/app/api/quotes/[id]/status/route.ts` — QuoteStatus PATCH endpoint 완비
- 현재 `apps/web/src/app/api/quotes/[id]/vendor-requests/route.ts` — 발송/재발송 endpoint

**Secondary References:**
- 호영님 v2 spec sheet (2026-05-11) — #20 일괄 처리 강화
- ADR-002 §11.217 Phase 3 (BatchActionBar / BatchDispatchSheet 도입)
- ADR-002 §11.225 (organizationVendorProducts 3 caller forward)
- ADR-002 §11.227 (viewMode default table + sort + 미니 타임라인)

**Conflicts Found:**
- 없음 — 기존 endpoint (PATCH status / POST vendor-requests) 재사용. API contract drift 0.

**Chosen Source of Truth:**
- `quote.status` (DB) — 일괄 상태 변경 시 UI state 가 덮어쓰지 않음
- `responseCount > 0` (server-side resolve) — 리마인더 filter 는 client view 만, server 가 actual recipient resolve

**Environment Reality Check:**
- [x] repo / branch context 파악 (HEAD = §11.227 land)
- [x] runnable commands 확인 (`pnpm --filter web test`, `pnpm --filter web typecheck`)
- [x] execution blocker 0

## 1. Priority Fit

**Current Priority Category:**
- [ ] P1 immediate
- [ ] Release blocker
- [ ] Post-release
- [x] P2 / Deferred

**Why This Priority:**
- 호영님 v2 spec sheet (23 항목) 중 Phase C #20 — 발송 후 운영 마무리 단계 강화. Phase A/B 가 P0 CRITICAL / P1 (테이블·카드·sort) 였고 Phase C 는 후속 운영 강화. 일괄 처리 자체가 발송 후 follow-up 시나리오 — release blocker 아님.

## 2. Work Type

- [x] Feature
- [ ] Bugfix
- [ ] API Slimming
- [x] Workflow / Ontology Wiring
- [ ] Migration / Rollout
- [ ] Billing / Entitlement
- [ ] Mobile
- [x] Web
- [ ] Design Consistency

## 3. Overview

**Feature Description:**
견적 관리 surface 에서 selected quote N건에 대해 (a) 일괄 발송 (기존, §11.217 Phase 3) / (b) **일괄 리마인더** (신규, responseCount === 0 filter → vendor-requests 재호출) / (c) **일괄 상태 변경** (신규, PATCH status N회 Promise.allSettled). 발송 후 follow-up 운영을 same-canvas 안에서 완결.

**Success Criteria:**
- [ ] BatchActionBar 에 "리마인더" / "상태 변경" CTA 2 추가 (기존 "검토 시작" 유지)
- [ ] BatchReminderSheet — responseCount === 0 filter + vendor-requests POST 재사용 + Promise.allSettled
- [ ] BatchStatusChangeSheet — RadioGroup 으로 새 status 선택 + PATCH `/api/quotes/[id]/status` N회 + invalid transition 통계
- [ ] 발송 후 page.tsx onSuccess → refetch + clearSelection (기존 pattern 재사용)
- [ ] tsc / vitest no new errors
- [ ] Chrome smoke 3 viewport (1366 / 1154 / mobile 393)
- [ ] ADR-002 §11.228 entry append

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [x] 공급사별 개별 리마인더 message (per-quote message)
- [x] 상태 변경 사유 input UI (reason 옵션만 forward, 별도 UI 0)
- [x] 리마인더 rate-limit / duplicate guard (§11.228b 백로그)
- [x] 모바일 RN 분기 (§11.228c 백로그 — 웹 먼저 land)
- [x] BatchDispatchSheet mode prop 통합 (호영님 (a) 분리 결정)

**User-Facing Outcome:**
- 호영님이 일괄 선택 후 violet bar 우측에 mutation CTA 3개 노출
- "리마인더" 클릭 → 새 sheet 안 responseCount === 0 quote N건 미리보기 + 일괄 발송
- "상태 변경" 클릭 → 새 sheet 안 RadioGroup → 적용 + 결과 통계 toast

## 4. Product Constraints

**Must Preserve:**
- [ ] workbench / queue / rail / dock — BatchActionBar same-canvas sticky 유지
- [ ] same-canvas — sheet pattern (Dialog) 으로 inline 처리, 별도 page navigation 0
- [ ] canonical truth — quote.status DB / responseCount server resolve
- [ ] invalidation discipline — onSuccess → refetch + clearSelection

**Must Not Introduce:**
- [ ] page-per-feature — 신규 page 0, 기존 dashboard/quotes 안 sheet
- [ ] chatbot/assistant reinterpretation — RadioGroup 등 selectable work object 만
- [ ] dead button / no-op / placeholder success — 모든 CTA → 실제 mutation
- [ ] fake billing/auth shortcut — quote_status_change enforceAction 기존 그대로
- [ ] preview overriding actual truth — invalid transition 시 server 가 reject, UI 가 덮지 않음

**Canonical Truth Boundary:**
- Source of Truth: `quote.status` (DB) + `quote.responses[]` (DB)
- Derived Projection: `responseCount === 0` filter (client side, 미리보기만)
- Snapshot / Preview: sheet 안 미리보기 list (mutation 전)
- Persistence Path: PATCH `/api/quotes/[id]/status` + POST `/api/quotes/[id]/vendor-requests`

**UI Surface Plan:**
- [x] Bottom sheet (BatchReminderSheet / BatchStatusChangeSheet — Dialog 모달)
- [x] Existing route section (BatchActionBar 안 CTA 추가)
- [ ] New page

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 2 sheet 분리 (BatchReminderSheet / BatchStatusChangeSheet) | mode prop 통합 시 vendor list/message UI 분기 비용 ↑ — sheet UI 자체가 다름 (status 변경은 RadioGroup) | file 2개 추가 — Dialog/Promise.allSettled pattern 일부 중복 |
| 기존 endpoint 재사용 (PATCH status / POST vendor-requests) | API contract drift 0 + server enforceAction / activity log / state machine 기존 그대로 | bulk endpoint 별도 신설 0 (N 호출) — N 작으면 성능 OK, N 큰 경우 §11.228b 에서 bulk route 검토 |
| Promise.allSettled (BatchDispatchSheet pattern 재사용) | partial failure 수용 + 통계 표시 — all-or-nothing 위험 회피 | 일부 quote 실패 시 사용자가 retry 책임 |

**Dependencies:**
- Required Before Starting: §11.225 (organizationVendorProducts forward) — 이미 land ✅
- External Packages: 없음 (기존 lucide-react / @/components/ui/dialog 재사용)
- Existing Routes / Models / Services Touched:
  - `apps/web/src/components/quotes/dispatch/batch-action-bar.tsx` (확장)
  - `apps/web/src/components/quotes/dispatch/batch-dispatch-sheet.tsx` (변경 0, pattern 참조)
  - `apps/web/src/components/quotes/dispatch/batch-reminder-sheet.tsx` (NEW)
  - `apps/web/src/components/quotes/dispatch/batch-status-change-sheet.tsx` (NEW)
  - `apps/web/src/app/dashboard/quotes/page.tsx` (sheet state + handler 추가)
  - `apps/web/src/app/api/quotes/[id]/status/route.ts` (재사용)
  - `apps/web/src/app/api/quotes/[id]/vendor-requests/route.ts` (재사용)

**Integration Points:**
- BatchActionBar onReminderStart / onStatusChangeStart props
- page.tsx batchReminderOpen / batchStatusChangeOpen state
- onSuccess → refetch + clearSelection (기존 BatchDispatchSheet pattern 재사용)

## 6. Global Test Strategy

All phases strict Red-Green-Refactor.

**Test Strategy:**
- Source-level grep sentinel (vitest readFileSync pattern §11.224 lineage 재사용)
- BatchActionBar — 3 CTA props 시그니처 + 라벨 grep
- BatchReminderSheet — responseCount === 0 filter + vendor-requests POST + Promise.allSettled
- BatchStatusChangeSheet — RadioGroup + PATCH status + invalid transition handling

**Execution Notes:**
- vitest cluster: `pnpm --filter web test apps/web/src/__tests__/dashboard/quotes/`
- tsc: `pnpm --filter web typecheck`

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
**Goal:** endpoint 재사용 확정 + UI surface (BatchActionBar / 2 new sheet) 잠금.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** truth source 확인 — PATCH status / POST vendor-requests endpoint 존재 + ALLOWED_STATUS_TRANSITIONS 매트릭스 확인
**🟢 GREEN:** §11.225 organizationVendorProducts dependency 확인 (이미 land), partial failure 정책 결정 (Promise.allSettled)
**🔵 REFACTOR:** out-of-scope 명시 (rate-limit / mobile / per-quote message defer)

**✋ Quality Gate:**
- canonical truth 충돌 0
- runnable commands 확인 (vitest / tsc)
- 의존 cluster (§11.225) 확인

**Rollback:** planning-only, code change 0

### Phase 1: Failing Tests
**Goal:** 정확한 의도 source-level test 로 표면화.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** `quote-batch-actions-c1.test.ts` 신설 — 4 describe block:
1. BatchActionBar — 3 CTA props (`onReminderStart` / `onStatusChangeStart`) + 라벨 grep
2. BatchReminderSheet — responseCount === 0 filter + dispatchSingleQuote 재사용 grep
3. BatchStatusChangeSheet — RadioGroup + PATCH status + status options
4. page.tsx — sheet state + handler wiring + invariant 보존 (§11.225/§11.227 lineage)

**🟢 GREEN:** 기존 file source 가 RED 충족하지 못함 확인 (test fail 명확화)
**🔵 REFACTOR:** test description 한국어 + cluster trace marker (§11.228)

**✋ Quality Gate:**
- RED test 가 실제 fail (재현 가능)
- 기존 test cluster (§11.221 / §11.222 / §11.223 / §11.224 / §11.225 / §11.226 / §11.227) 통과 유지
- lint/typecheck 영향 없음

**Rollback:** test file revert

### Phase 2: Core Implementation
**Goal:** 3 component 최소 구현.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** Phase 1 test 가 cover 하는 영역만 구현
**🟢 GREEN:**
- BatchActionBar 확장 — 3 CTA + 분리 라벨 갱신 ("발송 가능 M / 회신 대기 K / 보류 L")
- BatchReminderSheet 신설 — BatchDispatchSheet dispatchSingleQuote 재사용 + responseCount === 0 filter + Promise.allSettled
- BatchStatusChangeSheet 신설 — RadioGroup (4 status 옵션) + Promise.allSettled PATCH + invalid transition 통계

**🔵 REFACTOR:** DRY (dispatchSingleQuote helper share), naming 정합

**✋ Quality Gate:**
- Phase 1 test 통과
- 기존 BatchDispatchSheet test 통과 유지
- truth-boundary 위반 0 (UI state 가 quote.status 덮지 않음)
- N+1 / overfetch 0

**Rollback:** 신규 file 2개 + BatchActionBar diff revert

### Phase 3: Page Wiring + Invalidate
**Goal:** page.tsx 안 sheet state / handler / invalidate 연결.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** page.tsx integration test — sheet open/close + onSuccess 콜백 + clearSelection
**🟢 GREEN:**
- batchReminderOpen / batchStatusChangeOpen useState
- BatchActionBar onReminderStart / onStatusChangeStart → setBatchReminderOpen(true) / setBatchStatusChangeOpen(true)
- onSuccess → refetch + clearSelection (기존 BatchDispatchSheet pattern 재사용)
- §11.227 sortState / viewMode 보존 검증

**🔵 REFACTOR:** sheet 3개 state 통합 가능성 검토 (단일 `batchSheet: "none"|"dispatch"|"reminder"|"status"` enum)

**✋ Quality Gate:**
- dead button 0 / no-op 0 / front-only success 0
- loading / error / empty / disabled state 모두 존재
- 기존 batchSheetOpen state 보존

**Rollback:** page.tsx diff revert

### Phase 4: Verify + ADR + Smoke
**Goal:** vitest / tsc / ADR / Chrome smoke 완결.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** Chrome smoke 실패 모드 정의 — sheet open 실패 / mutation 실패 / refetch 미동작
**🟢 GREEN:**
- vitest cluster GREEN — `pnpm --filter web test apps/web/src/__tests__/dashboard/quotes/quote-batch-actions-c1.test.ts`
- tsc no new errors — `pnpm --filter web typecheck`
- ADR-002 §11.228 entry append
- Chrome smoke — 3 viewport (1366 / 1154 / 393) 에서 3 CTA → sheet 흐름 검증
- commit + push + Vercel deploy

**🔵 REFACTOR:** Chrome smoke note + 모니터링 메모

**✋ Quality Gate:**
- vitest cluster GREEN
- tsc no new errors
- ADR append
- Vercel deploy READY
- Chrome smoke 3 viewport 통과

**Rollback:** git revert SHA — 모든 변경 single batch land 으로 안전

## 8. Optional Addenda

### A. Workflow / Ontology Addendum

**Resolver Input:** selected quote N건 + responseCount per quote + current status
**Expected Output:** dispatchable / reminderEligible / statusChangeAllowed 분리

**Surface Rules:**
- dashboard: BatchActionBar same-canvas sticky
- BatchActionBar: dispatchable / hardBlock / reminderEligible 통계 분리 라벨
- BatchReminderSheet: responseCount === 0 미리보기 + 발송 가능 N건 ALA
- BatchStatusChangeSheet: invalid transition quote 별도 표시 (회색 + 사유)
- chatbot / terminal / sci-fi AI 0

**Validation:**
- [ ] BatchActionBar 3 CTA 정확
- [ ] BatchReminderSheet filter 정확
- [ ] BatchStatusChangeSheet invalid transition 처리 정확
- [ ] onSuccess refetch + clearSelection 정합

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 같은 공급사 spam (다중 리마인더) | Med | Med | sheet 안 미리보기 + 사용자 확정 / rate-limit 은 §11.228b 후속 |
| invalid transition partial failure | Med | Low | Promise.allSettled + UI 통계 ("성공 N / 실패 M / 차단 L") |
| sheet 3개 surface 분산 위험 | Low | Med | sticky bar 안 3 CTA same-canvas 유지 / 분리는 sheet 안에서만 |
| §11.225 organizationVendorProducts forward 누락 | Low | High | BatchReminderSheet test 가 organizationVendors prop 강제 |
| §11.227 sortState 회귀 | Low | Med | invariant 보존 test (§11.227 sortState marker) 포함 |

## 10. Rollback Strategy

- Phase 1 fail: test file revert (RED 만 작성된 상태)
- Phase 2 fail: 신규 file 2개 + BatchActionBar diff revert
- Phase 3 fail: page.tsx diff revert (sheet 신규 파일 보존, page wiring 만 revert)
- Phase 4 fail: git revert SHA (single commit batch land 으로 안전)

**Special Cases:**
- DB migration 0 (재사용 endpoint)
- Billing / entitlement 0
- soft_enforce / full_enforce 0
- webhook 0

## 11. Progress Tracking

- Overall completion: 80%
- Current phase: Phase 4 (ADR + commit + push)
- Current blocker: 없음
- Next validation step: ADR append + commit + push + Chrome smoke

**Phase Checklist:**
- [x] Phase 0 complete (Truth Lock — endpoint 재사용 확정)
- [x] Phase 1 complete (RED test 39 fail + 5 invariant pass)
- [x] Phase 2 complete (BatchActionBar 확장 + 2 sheet 신설 + page wiring — 44/44 GREEN)
- [x] Phase 3 complete (page.tsx wiring — Phase 2 와 같은 batch 안 land)
- [ ] Phase 4 complete (ADR + commit + push + Chrome smoke)

## 12. Notes & Learnings

**Blockers Encountered:**
- [TBD]

**Implementation Notes:**
- 호영님 (a) 분리 결정 — BatchDispatchSheet mode prop 통합 거부
- 3 mutation CTA = "검토 시작" / "리마인더" / "상태 변경" (선택 해제는 utility 제외)
- out-of-scope: per-quote message / rate-limit / mobile RN — §11.228b/c 백로그

---

**Cluster:** §11.228 (Phase C1 / quote-management v2 / #20 일괄 처리 강화)
**Lineage:** §11.217 Phase 3 (BatchActionBar) → §11.225 (organizationVendorProducts) → §11.227 (viewMode default table) → §11.228 (현재)
