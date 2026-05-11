# Implementation Plan: §11.226 quote-management-v2 Phase A (P0 CRITICAL 6항목)

- **Status:** 🔄 In Progress
- **Started:** 2026-05-11
- **Last Updated:** 2026-05-11
- **Estimated Completion:** 2026-05-11 (5~6시간 1 세션)

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
- 호영님 v2 spec sheet (2026-05-11 21:00 KST 메시지) — 23 항목 중 P0 CRITICAL 6항목
- Cluster lineage 직전: §11.225 P0 hot fix (organizationVendorProducts 인자) — production deploy `01f80cdf` 완료, Chrome smoke GREEN

**Secondary References:**
- ADR-002 §11.217 → §11.225 cluster lineage (quotes page 누적 변경 25 cluster)
- §11.220d popup overlay model (full-height + 모든 viewport + 토글) — Phase A #3 충돌 해결 기반

**Conflicts Found:**
- #3 호영님 v2 spec "테이블 뷰에서는 브리핑 패널 기본 닫힘" ↔ §11.220d popup model "사용자 토글 만 open" — 해결: 테이블 뷰 진입 시 useEffect 으로 popup-context setIsOpen(false) 자동 호출
- #1 #2 production 마찰 1366/1280 시각 재현 불가 — 회귀 차단 spec 으로 처리 (nowrap + min-width 강제 lock)
- #5 호영님 v2 spec "테이블 제목 열 품목명 직접 노출" ↔ 현재 `{quote.title}` 단순 — §11.217 firstItemName helper 이미 카드 뷰에 land, 테이블에 reuse

**Chosen Source of Truth:**
- v2 spec sheet (가장 최근 호영님 운영 시점)
- §11.220d popup model (canonical overlay 모델)
- §11.217 firstItemName helper (canonical 제목 압축 helper)

**Environment Reality Check:**
- [x] repo / branch: ai-biocompare main, §11.225 production READY
- [x] vitest runnable (sandbox)
- [x] Chrome smoke runnable (labaxis.co.kr)
- [x] tsc 변경 file 한정 runnable (full run = Node OOM, heap bump 필요)

---

## 1. Priority Fit

**Current Priority Category:**
- [x] P1 immediate
- [ ] Release blocker
- [ ] Post-release
- [ ] P2 / Deferred

**Why This Priority:**
호영님 v2 spec sheet P0 CRITICAL 6 항목은 운영자 시점에서 (a) 페이지 깨짐 (세로 깨짐, 잘림, 가로 스크롤), (b) 정보 식별 불가 (테이블 행 구분 불가), (c) CTA 의도 파악 불가 (텍스트 잘림) 가 동시 발생 위험. 호영님 production 운영 사이클 직접 마찰 + 향후 회귀 차단 lock. §11.225 P0 hot fix 직후 자연 후속 cluster.

---

## 2. Work Type

- [x] Bugfix (P0 CRITICAL UX 깨짐 차단)
- [x] Design Consistency (#5 helper reuse + #8 CTA min-width 일관성)
- [ ] Feature
- [ ] API Slimming
- [ ] Workflow / Ontology Wiring
- [ ] Migration / Rollout
- [ ] Billing / Entitlement
- [ ] Mobile
- [x] Web (테이블 뷰 + 카드 뷰 + popup overlay)

---

## 3. Overview

**Feature Description:**
호영님 v2 spec sheet 의 P0 CRITICAL 6 항목을 한 batch 에 land — 테이블 뷰의 텍스트 깨짐 / 버튼 잘림 / 가로 스크롤 / 빈 컬럼 낭비 / 제목 모호 / CTA 식별 불가를 동시 해소. §11.220d popup overlay model + §11.217 helper 위에 minimal-diff 로 추가.

**Success Criteria:**
- [ ] 테이블 상태 뱃지 nowrap + min-width 72px 강제 (좁은 viewport 회귀 차단)
- [ ] 액션 버튼 nowrap + 텍스트 축약 + min-width 80px 강제
- [ ] 테이블 뷰 진입 시 popup auto-close (가로 스크롤 차단)
- [ ] 가격/납기 컬럼 데이터 0 시 thead/tbody 자동 hide
- [ ] 테이블 제목 열 = firstItemName + 외 N건 (카드 뷰 §11.217 정합)
- [ ] 카드 CTA min-width 140px / 테이블 CTA min-width 80px

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] Phase B (§11.227): #9 #10 #13 #14 (테이블 default + 카드 AI 요약 + AI 중복 + context-aware)
- [ ] Phase C (§11.228+): #20 #21 #23 (일괄 처리 강화 / 공급사 DB UI / 테이블 고도화)
- [ ] #1 sticky right (호영님 spec 의 옵션) — viewport 별 sticky 동작 검증 필요, Phase B 로 park
- [ ] 모달 전환 (#3 호영님 spec "행 클릭 시 오버레이 드로어로 열림") — popup 자동 open 까지 진행 시 §11.220d 회귀 위험, Phase B park

**User-Facing Outcome:**
- 호영님 좁은 viewport / popup 동시 노출 시 테이블 글자 깨짐 0
- 빈 컬럼 자동 hide 로 main 영역 폭 ↑
- 테이블 행마다 품목명 직접 노출 → 4건 연속 "견적 요청 — 1개 품목" 모호함 해소
- 카드/테이블 CTA 텍스트 잘림 0

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock
- [x] same-canvas (테이블/카드/popup 모두 dashboard/quotes 한 page)
- [x] canonical truth (quote.responses / quote.items / popup-context isOpen)
- [x] invalidation discipline (mutation 0)

**Must Not Introduce:**
- [x] page-per-feature 회귀 (모든 변경 page.tsx 내부)
- [x] chatbot/assistant reinterpretation (popup overlay model 보존)
- [x] dead button / no-op / placeholder success (모든 CTA actionable)
- [x] fake billing/auth shortcut (해당 없음)
- [x] preview overriding actual truth (UI presentation only)

**Canonical Truth Boundary:**
- Source of Truth: quote.responses[].totalPrice, quote.deliveryDate, quote.items[0].name, popup-context.isOpen
- Derived Projection: displayTitle (firstItemName + 외 N건), columnVisibility (allEmpty 분기), shortenedLabel
- Snapshot / Preview: 없음 (모두 row-level derive)
- Persistence Path: 없음 (UI only)

**UI Surface Plan:**
- [x] Existing route section (dashboard/quotes page.tsx)
- [ ] Inline expand
- [ ] Right dock
- [ ] Bottom sheet
- [ ] Split panel
- [ ] Settings panel
- [ ] New page

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 테이블 진입 시 popup auto-close (useEffect) | 호영님 v2 #3 spec + §11.220d 회귀 0 | 카드 뷰에서 popup open + 테이블 토글 시 popup 사라짐 (예상 동작) |
| 빈 컬럼 hide useMemo (전체 row scan) | §11.142 lock 정합 (canonical truth 보존, 표시만 hide) | useMemo recalc 비용 (filteredQuotes 변경 시) |
| 텍스트 축약 함수 (shortenStatusLabel/shortenActionLabel) | 호영님 v2 #1 #2 spec — 명시 매핑 | label 매핑 sweep 필요 (RAIL_STATE_MAP) |
| firstItemName helper reuse (§11.217) | canonical 압축 helper 이미 land, 테이블 reuse | 카드/테이블 displayTitle 동일성 ↑ |
| min-width Tailwind class 강제 | nowrap 보장 + drift sentinel test | className 분기 보다 utility 직접 적용 |

**Dependencies:**
- Required Before Starting: §11.225 P0 hot fix production deploy ✅ 완료
- External Packages: 없음
- Existing Routes / Models / Services Touched: `app/dashboard/quotes/page.tsx` 단일 (helper file 추가 없음 — inline)

**Integration Points:**
- popup-context (useEffect setIsOpen 호출)
- §11.217 firstItemName helper (line 220 근처 derive)
- §11.221 긴급 뱃지 invariant 보존
- §11.223 RelativeDeliveryText invariant 보존
- §11.224 가격/납기 컬럼 spec 보존 (단 빈 컬럼 hide 추가)

---

## 6. Global Test Strategy

**Test Strategy:**
- Source-level grep sentinel (vitest pattern) — Phase A 의 모든 변경이 page.tsx 단일 file
- nowrap / min-width / 축약 매핑 / popup-context useEffect / displayTitle / column hide 6 spec 모두 source pattern 으로 검증
- 기존 §11.217 / §11.221 / §11.223 / §11.224 / §11.225 invariant 보존 sentinel 추가
- Chrome smoke 3 viewport (1366 / 1280 / 390) + popup 동시 노출 시각 검증

**Execution Notes:**
- sandbox vitest runnable
- Chrome smoke runnable (Vercel deploy 후)
- tsc 변경 file 한정 runnable

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock (30분)
**Goal:** §11.225 production 확인 + v2 spec 6항목 precise lock + popup-context API audit
- Status: [ ] Pending | [x] In Progress | [ ] Complete

**🔴 RED:** §11.225 deploy READY 확인 → "전체 선택" crash 해소 검증 ✅ (이미 완료)
**🟢 GREEN:** popup-context.tsx 의 export setIsOpen / setIsOpen alias 확인
**🔵 REFACTOR:** scope 정리 — #1 sticky right + #3 modal 전환 Phase B park 확정

**✋ Quality Gate:** popup-context API 확인, source of truth conflict 0, scope lock
**Rollback:** planning-only

### Phase 1: Contract & Failing Tests (1.5시간)
**Goal:** v2 spec 6항목의 source-level sentinel test 작성 (RED)
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** NEW `__tests__/dashboard/quotes/quote-table-v2-phase-a.test.ts`
- 6 describe block (각 항목 별)
- ~25 tests 예상
- 모든 spec 실패 → RED 확정

**🟢 GREEN:** 모든 새 test 가 FAIL (예상)
**🔵 REFACTOR:** test naming 일관성, regex 적정성

**✋ Quality Gate:** 25 RED + 기존 §11.217~§11.225 invariant test 모두 PASS (backward compat)
**Rollback:** test file 단일 삭제

### Phase 2: Core / UI Implementation (2시간)
**Goal:** page.tsx 6 spec 동시 GREEN
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** Phase 1 의 25 test 가 RED 상태 시작
**🟢 GREEN:**
- (a) **#1 상태 뱃지** — thead `<th className="px-3 py-2 min-w-[100px]">상태</th>` + tbody status badge `whitespace-nowrap min-w-[72px]` + 축약 함수 `shortenStatusLabel`
- (b) **#2 액션 버튼** — thead `<th min-w-[120px]>액션</th>` + tbody Button `whitespace-nowrap min-w-[80px]` + 축약 함수 `shortenActionLabel`
- (c) **#3 popup auto-close** — useEffect `[viewMode]` dependency, viewMode === "table" 시 popup-context setIsOpen(false) 호출
- (d) **#4 빈 컬럼 hide** — useMemo `priceColumnHasData` + `deliveryColumnHasData` (filteredQuotes scan), thead/tbody 조건 render
- (e) **#5 테이블 제목 열** — `{displayTitle}` swap (firstItemName + 외 N건, 카드 분기와 동일 derive)
- (f) **#8 CTA min-width** — 카드 분기 Button `min-w-[140px]`, 테이블 분기 Button `min-w-[80px]`
**🔵 REFACTOR:** className 일관성, helper 함수 file scope vs row scope 결정

**✋ Quality Gate:** vitest 25/25 PASS, quotes cluster 전체 backward compat (98 → 123), tsc clean
**Rollback:** page.tsx 부분 git revert

### Phase 3: Verification (30분)
**Goal:** vitest + tsc + sandbox smoke
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** Phase 2 후 vitest 25/25 GREEN 확인
**🟢 GREEN:** quotes cluster 전체 + tsc 변경 file 한정 GREEN
**🔵 REFACTOR:** test 의 false-positive 제거 (있다면)

**✋ Quality Gate:** vitest cluster 123/123, tsc clean, no console.warn
**Rollback:** Phase 2 revert

### Phase 4: ADR + Commit + Chrome Smoke (1시간)
**Goal:** production deploy + 3 viewport Chrome 시각 검증
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** ADR §11.226 entry append (호영님 production effect + behavior matrix + lessons)
**🟢 GREEN:**
- Commit message draft → 호영님 host push
- Vercel deploy READY 대기
- Chrome smoke 3 viewport (1366 / 1280 / 390) + popup 동시 노출
- console error 0 / hydration error 0 확인
**🔵 REFACTOR:** ADR entry 의 lesson 정리, out-of-scope 명확화

**✋ Quality Gate:** production Chrome smoke 3 viewport 모두 GREEN
**Rollback:** `git revert <SHA>` — UI only, schema/migration/mutation 0

---

## 8. Optional Addenda

### A. Workflow / Ontology Addendum
N/A — UI only, ontology/resolver 변경 0

### B. Billing / Entitlement Addendum
N/A

### C. API Slimming Addendum
N/A

### D. Mobile Addendum
**Mobile 영향 검증:**
- 테이블 뷰 자체가 desktop only (mobile 은 카드 뷰 그대로)
- 카드 뷰 CTA min-w-[140px] 가 mobile 좁은 viewport (390px) 에서 overflow 위험 → sm: 분기 추가 또는 max-content 적용 검토 Phase 2 에서

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| #3 popup auto-close 가 카드 뷰에서 popup open 사용자에게 불편 | Med | Low | 카드 뷰일 때는 close 안 함 (viewMode === "table" 분기) |
| #4 빈 컬럼 hide useMemo recalc 비용 | Low | Low | filteredQuotes 의 useMemo deps 적정성 + 100건 기준 negligible |
| #5 displayTitle helper reuse — 카드/테이블 derive 동일성 | Low | Med | 같은 함수 호출, 동일 입력 = 동일 출력 보장 |
| #8 카드 CTA min-w-[140px] 모바일 overflow | Med | Med | sm: 분기 또는 max-w 추가 (Phase 2 audit) |
| 텍스트 축약 함수가 RAIL_STATE_MAP label 변경 시 drift | Med | Low | drift sentinel test (Phase 1 에 포함) |
| §11.220d popup model 회귀 (popup-context.tsx 변경 0 보장) | Low | High | popup-context.tsx 미수정 — page.tsx 에서 setIsOpen 호출만 |

---

## 10. Rollback Strategy

- If Phase 1 Fails: test file `quote-table-v2-phase-a.test.ts` 단일 삭제
- If Phase 2 Fails: page.tsx git revert (변경 line 별 cherry-pick 가능)
- If Phase 3 Fails: Phase 2 revert + RED test 재진입
- If Phase 4 Fails: `git revert <SHA>` — UI only, schema/migration/mutation 0

**Special Cases:**
- DB migration: 없음
- Billing: 영향 없음
- soft_enforce/full_enforce: 영향 없음
- UI disabled fallback: 없음

---

## 11. Progress Tracking

- Overall completion: 0% (Phase 0 in_progress)
- Current phase: Phase 0
- Current blocker: 없음
- Next validation step: popup-context API audit

**Phase Checklist:**
- [ ] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete

---

## 12. Notes & Learnings

**Blockers Encountered:**
- (none yet)

**Implementation Notes:**
- v2 #1/#2 의 production 재현 못함 — 회귀 차단 lock 우선
- v2 #3 호영님 spec "행 클릭 시 오버레이 드로어" 는 Phase B park (auto-close 만 Phase A)
- v2 #5 의 helper reuse 가 가장 작은 minimal-diff (이미 §11.217 land)

**Cluster lineage 정합:**
- §11.217 (firstItemName + viewMode toggle)
- §11.220d (popup overlay model)
- §11.221 (긴급 뱃지 + progress bar)
- §11.223 (가격 범위 + 회신 수 + 납기 상대 일수)
- §11.224 (테이블 뷰 가격/납기 parity)
- §11.225 (organizationVendorProducts 인자 P0 hot fix)
- **§11.226 (Phase A — 본 cluster)**
