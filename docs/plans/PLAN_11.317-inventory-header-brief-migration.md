# Implementation Plan: §11.317 — 재고 관리 헤더 폐기/처분 정보 운영 브리핑 이관

- **Status:** ✅ Closed (Phase 0~5 Complete, 2026-05-29 종결)
- **Started:** 2026-05-29
- **Last Updated:** 2026-05-29 (Phase 5 종결)
- **Estimated Completion:** 2026-05-29 (실제 1일 내 완료)
- **Scope:** 5 phases / medium-large
- **Approval:** 호영님 spec(§11.313 → 번호 충돌로 §11.317 매핑) + 5 phase 계획 + plan 문서 생성 승인 완료
- **호영님 모델 권장:** Opus 4.7로 충분 (UI 정리 + 데이터 이동, 신규 설계 없음)

---

## 🔒 통제 구조 (호영님 원칙)

| 구분 | 담당 | 책임 |
|---|---|---|
| 기술 evidence 수집 | Claude | sandbox 직접 grep/inspect |
| Scope 의사결정 | 호영님 | phase breakdown / 위험 감수 |
| Production push | 호영님 | sandbox commit 금지, claude-code 환경 push |

⛔ Claude가 "호영님 환경에서 X 확인해주세요" 요청 금지 — sandbox = 작업 환경.

---

## ⚠️ CRITICAL INSTRUCTIONS

각 phase 완료 후:
1. ✅ 해당 phase task 체크박스
2. 🧪 quality gate 검증 (sandbox 정적 grep/Edit, tsc/vitest는 시도 가능 시)
3. 📅 Last Updated 갱신
4. 📝 Notes 섹션에 learnings 기록
5. ➡️ commit draft + present_files → 호영님 push 회신 후 다음 phase

⛔ DO NOT introduce dead button / no-op / fake action / chatbot 재해석
⛔ DO NOT canonical truth(lotIssue count, InventoryItem stats) mutation 추가
⛔ DO NOT 폐기 검토 탭 자체 제거 (작업 surface 보존)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 호영님 spec §11.313 (번호는 §11.317로 매핑 — task #92와 충돌)
- 스크린샷 1780021387554_image.png
- Sandbox `inventory-content.tsx` line 1565-1612 (메인 이관 source)
- Sandbox `components/operational-brief/popup.tsx` line 78-90 (CATEGORIES + stock_risk 기존)

**Secondary References:**
- §11.302d-6c-1 (운영 브리핑 amber→yellow swept 상태)
- §11.308a-v2 (Header 글로벌 진입 — 본 plan 무관)
- §11.311 Mobile Patterns (KPI 압축, full-width 배너)
- §11.304 KPI 4개 grid 패턴

**Conflicts Found:**
- 호영님 spec "운영 브리핑 재고 섹션 신설" — 실제로는 stock_risk 카테고리 이미 존재 → "강화" 가 정확
- spec 의 "운영 브리핑 카드 내부 액션 (폐기 처리 →)" — 운영 브리핑은 요약+알림이라 실제 mutation 두면 canonical truth 위반 위험 → 폐기 검토 탭 deep link 가 정합 (호영님 spec 3-4 "운영 브리핑은 요약+알림 / 폐기 검토 탭은 작업 실행" 동의)

**Chosen Source of Truth:**
- 헤더 영역 source = `inventory-content.tsx:1565-1612` (이 라인 영역 제거 → 운영 브리핑으로 이관)
- 운영 브리핑 stock_risk 카테고리 = `popup.tsx` (enrich)
- 폐기 처리 actual mutation = 폐기 검토 탭 (이미 존재, 보존)
- 운영 브리핑의 액션 = deep link 만 (브리핑 안에 mutation 없음)

**Environment Reality Check:**
- [x] inventory-content.tsx 영역 확정
- [x] popup.tsx stock_risk CATEGORY 확정
- [ ] 우측 "Lot ID 확인 필요" 카드 컴포넌트 식별 (Phase 1 RED)
- [ ] popup.tsx selectedCategory state 외부 setter 노출 가능 여부 (Phase 4)
- [ ] sandbox vitest 실행 가능 여부 (node_modules 일부 corrupted — 정적 grep 위주)

---

## 1. Priority Fit

- [x] **P1 immediate** (UI 우선순위 역전 + 정보 밀도 과다)
- [ ] Release blocker
- [ ] Post-release
- [ ] P2 / Deferred

**Why:** 재고 0건 empty state인데 헤더가 화면 ~40% 점유 → 사용자가 "재고 관리" 본 목적(품목 조회/등록) 파악 불가. UX critical하지만 release blocker 는 아님.

---

## 2. Work Type

- [ ] Feature
- [x] **UX 구조 정리** (헤더 simplification + 정보 이관)
- [ ] API Slimming
- [ ] Workflow / Ontology Wiring
- [ ] Migration / Rollout
- [ ] Billing / Entitlement
- [ ] Mobile
- [x] **Web** (재고 헤더 + 운영 브리핑)
- [x] **Design Consistency** (정보 역할 분리)

---

## 3. Overview

**Feature Description:**
재고 관리 메인 헤더가 폐기/처분/격리/승인 메타로 과적재 → "재고 관리" 본 목적(조회/등록/수량)이 묻힘. 폐기 관련 정보는 운영 브리핑(stock_risk 카테고리)의 책임 영역. 헤더 simplification + 정보 이관 + 진입 동선 wiring.

**Success Criteria:**
- [ ] 헤더: 폐기/처분/승인 칩 0, KPI 4개(전체품목/안전재고미달/만료임박/격리Lot), 1줄 배너(운영 조치 N건 + 운영 브리핑 진입 link)
- [ ] 우측 "Lot ID 확인 필요" 카드 제거
- [ ] 운영 브리핑 stock_risk 카테고리에 5개 카드(폐기 처분/만료 Lot/폐기 영향 분석/처리 우선순위/Lot 점검 필요) 강화 또는 추가
- [ ] 각 카드 액션 = 폐기 검토 탭 deep link (dead button 0, real route)
- [ ] 운영 조치 0건 시 배너 hide
- [ ] 모바일 grid-cols-2 + full-width 배너
- [ ] 폐기 검토 탭 보존 (작업 surface)
- [ ] 데이터 source 보존 (mutation 0)

**Out of Scope:**
- 폐기 검토 탭 자체 UX 개편
- backend API 변경
- 다른 운영 브리핑 카테고리(견적/발주/입고) 변경
- §11.310 입고 1-flow 영향 (별개)

**User-Facing Outcome:**
- 재고 관리 진입 시 KPI 4개 + 1줄 배너만 노출 → 재고 본 목적 즉시 인지
- 폐기 액션 필요 시 배너 클릭 → 운영 브리핑 stock_risk 섹션 자동 진입
- 폐기 실제 작업은 "폐기 검토" 탭에서 (기존 동선 유지)

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock (운영 브리핑 = dock 유지)
- [x] same-canvas (새 page 만들지 않음)
- [x] canonical truth (lotIssue count + InventoryItem stats, mutation 0)
- [x] 폐기 검토 탭 = 작업 surface

**Must Not Introduce:**
- [x] page-per-feature
- [x] dead button / no-op (브리핑 카드 액션은 real route)
- [x] chatbot/assistant 재해석
- [x] truth 흉내 (브리핑 = 알림, 탭 = 실행 — 역할 분리)
- [x] preview overriding actual truth

**Canonical Truth Boundary:**
- Source of Truth: lotIssueDisposalReviewCount / ApprovalPendingCount / ExecutableCount / InventoryItem stats
- Derived Projection: 헤더 KPI / 배너 합산 / 브리핑 카드 노출
- Snapshot / Preview: 없음
- Persistence Path: 기존 inventory API (변경 0)

**UI Surface Plan:**
- [x] Existing surface refinement (재고 메인 + 운영 브리핑 popup)
- [ ] 새 page (✗)
- [ ] 새 modal (✗)
- [x] 기존 dock(운영 브리핑) 강화

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
|---|---|---|
| 헤더 칩 → 운영 브리핑 이관 (data source 동일) | 정보 역할 분리 + canonical truth 보존 | 카드 추가/enrich 코드 증가 |
| 브리핑 카드 액션 = 폐기 검토 탭 deep link | 운영 브리핑 = 요약/알림 원칙 + dead button 0 | "한 화면 처리" 욕구는 탭 진입으로 충족 |
| 진입 동선 = banner onClick → openBrief + setSelectedCategory("stock_risk") | 기존 popup state 활용 | popup context API export 추가 |
| KPI 4개 = 전체품목/안전재고미달/만료임박/격리Lot | spec §4-2 정확 | 기존 KPI 3개(재주문/만료/폐기검토) 와 다름 → 회귀 가드 |

**Dependencies:**
- Required Before Starting: §11.316 (signin 3D 즉시) push 후 (현재 작업 큐 정합)
- External Packages: 없음 (lucide-react / Tailwind 기존)
- Existing Routes / Models Touched:
  - `inventory-content.tsx` (헤더 영역 1565-1612)
  - `components/operational-brief/popup.tsx` + `popup-context.tsx`
  - 우측 카드 컴포넌트 (Phase 1 식별)

**Integration Points:**
- inventory page → operational-brief popup open trigger
- operational-brief popup → stock_risk 카테고리 scroll
- stock_risk 카드 → 폐기 검토 탭 (`/dashboard/inventory?tab=disposal-review` 또는 유사 deep link)

---

## 6. Global Test Strategy

All phases follow Red-Green-Refactor.

**Test Strategy by Phase:**
- Phase 0: 정적 grep evidence
- Phase 1: failing sentinel (새 헤더 구조 + 폐기 칩 0 + 브리핑 stock_risk 강화)
- Phase 2: 헤더 simplification sentinel pass + 폐기 검토 탭 보존 가드
- Phase 3: 브리핑 stock_risk 카드 sentinel + deep link real route
- Phase 4: banner onClick + setSelectedCategory + 운영 조치 합산 sentinel
- Phase 5: 모바일 patterns + 회귀 통합

**Execution Notes:**
- sandbox vitest 실행 불가 시 (node_modules corrupted) 정적 grep/Edit 기반 검증 + 호영님 vitest 위임 (Phase 5 패턴)

---

## 7. Implementation Phases

### Phase 0: Truth Lock + 우측 카드 식별 ✅ COMPLETE
- Status: [x] Complete (2026-05-29)

**Evidence 수집 결과:**

| Evidence | 결과 |
|---|---|
| 폐기 strip 컨테이너 | `inventory-content.tsx:1559~1640+` (`showLotIssueDecisionStrip && (...)`) |
| 우측 "Lot ID 확인" 카드 | 같은 strip의 `labaxis-inventory-lot-issue-action-stack > visible-audit-summary` (별도 file 아님, 동일 컨테이너) |
| 표시 조건 | `isBrowserPilotInventoryDisposal \|\| statusFilter === "lot_issue" \|\| activeInventoryTab === "overview"` (line 1046) |
| count 변수 (line 1040-1045) | DisposalReview/ApprovalPending/Executable/Hold/Immediate — **Phase 2 보존**(운영 브리핑 카드 source 로 forward) |
| popup-context API | `{ open, close, isOpen, selectedItemId, setSelectedItemId, isMinimized, toggleMinimize }` — **selectedCategory 미노출**, Phase 4 에서 context 확장 필요 |
| 폐기 검토 탭 deep link | `/dashboard/inventory?filter=lot_issue&tab=overview` (이미 §11.308e SmartReceivingStatusCard.tsx 에서 정합 사용 중) |
| 기존 sentinel 회귀 (8 test file) | inventory-lot-issue-badge-273c / expired-lot-disposal / inventory-disposal-order / lot-issue-handoff-strip-280 / lot-issue-priority-strip-270 / lot-disposal-panel-approval-summary-266d / lot-issue-strip-color-273c / inventory-content-traffic-light-302d3 — **Phase 2 sweep + Phase 5 정합 처리** |

**Phase 4 wiring 디테일 보강:**
- popup-context.tsx 에 `selectedCategory: ModuleKey \| null` + `setSelectedCategory(cat)` 추가
- `open()` 확장: `open(opts?: { category?: ModuleKey })` — 1회성 카테고리 hint
- popup.tsx 의 internal selectedCategory state 가 context value 를 initial seed 로 채택

**🔴 RED:**
- inventory-content.tsx 1565-1612 폐기 영역 정확 라인 범위 확정
- 우측 "Lot ID 확인 필요" 카드 source 파일 식별 (`Lot ID:`/`수량:`/`만료일:`/`사유:`/`재고 영향:`/`승인 필요:` 키워드)
- popup.tsx + popup-context.tsx 의 stock_risk 카테고리 데이터 source / setSelectedCategory 외부 노출 여부
- 폐기 검토 탭 anchor / query string 식별 (deep link 가능 여부)

**🟢 GREEN:**
- evidence 3건 plan 문서에 추가
- Phase 1~5 조정 (식별 결과에 따라 미세 변경)

**🔵 REFACTOR:** plan Notes 갱신

**✋ Quality Gate:**
- ✅ 4 source 위치 확정
- ✅ deep link 가능 여부 결론
- ✅ popup context API export 가능 여부 결론

**Rollback:** 없음 (read-only)

---

### Phase 1: Failing sentinel (RED) — 새 구조 + 폐기 칩 0
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- `__tests__/regression/inventory-header-simplification-317.test.ts` (NEW)
- 단언: 헤더 4 KPI (전체품목/안전재고미달/만료임박/격리Lot) / 폐기·처분·승인 칩 키워드 0 / 1줄 배너 + "[운영 브리핑 열기 →]" / 우측 Lot ID 카드 0
- 단언: popup.tsx stock_risk 카테고리에 폐기 영역 enrich 키워드 노출
- 현재 source 와 충돌 → 진짜 RED

**🟢 GREEN:** (없음, RED만)
**🔵 REFACTOR:** (없음)

**✋ Quality Gate:**
- ✅ failing test 실제 fail 함을 grep 으로 확인 (sandbox vitest 실행 가능 시 1회)

**Rollback:** sentinel file 삭제

---

### Phase 2: Header simplification (GREEN)
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** Phase 1 sentinel 활성
**🟢 GREEN:**
- inventory-content.tsx line 1565-1612 폐기 칩 영역 제거
- KPI 4개로 재구성 (전체품목/안전재고미달/만료임박/격리Lot)
- 1줄 배너: `⚠ N건의 운영 조치가 필요합니다 · [운영 브리핑 열기 →]`
- 운영 조치 N건 = lotIssueDisposalReviewCount + ApprovalPending + Executable + Lot점검필요 (Phase 0 정의)
- N = 0 시 배너 hide
- 우측 "Lot ID 확인" 카드 제거

**🔵 REFACTOR:**
- KPI 4개 props/계산 정합
- §11.302 신호등 + §11.311 mobile 패턴 적용

**✋ Quality Gate:**
- ✅ Phase 1 헤더 sentinel pass (폐기 칩 0)
- ✅ 폐기 검토 탭 자체 보존 가드 (별도 it)
- ✅ 데이터 source mutation 0 (lotIssueDisposalReviewCount 등 변수 보존)

**Rollback:** inventory-content.tsx revert (단일 file)

---

### Phase 3: 운영 브리핑 stock_risk 카드 강화 (GREEN)
- Status: [ ] Pending | [ ] In Packs | [ ] Complete

**🔴 RED:** Phase 1 sentinel 의 stock_risk 강화 부분 활성
**🟢 GREEN:**
- popup.tsx stock_risk 카테고리 카드 추가 또는 enrich:
  - 폐기 처분 카드 (처분 검토/승인 대기/실행 가능 합산)
  - 만료 Lot 카드 (1순위 폐기 처리, 만료 lot N건)
  - 폐기 영향 분석 카드 (재고 영향 / 안전재고 확인)
  - 처리 우선순위 카드 (폐기 처리 우선/보류/즉시 확인/폐기 검토)
  - Lot 점검 필요 카드 (이관된 우측 카드 내용)
- 각 카드 액션 button = 폐기 검토 탭 deep link

**🔵 REFACTOR:**
- 카드 시각 일관성 (기존 quote/po/receiving 카드와 정합)
- §11.302 신호등 정합 (위험=red, 주의=yellow, 정상=emerald)

**✋ Quality Gate:**
- ✅ 5 카드 노출 sentinel
- ✅ 폐기 검토 deep link real route (dead button 0)
- ✅ stock_risk total/urgent count 정합 (Phase 0 logic)

**Rollback:** popup.tsx revert

---

### Phase 4: 진입 동선 wiring (GREEN)
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** banner onClick 동작 단언
**🟢 GREEN:**
- popup-context.tsx (또는 store) 에 setSelectedCategory + open API 노출
- inventory-content.tsx 배너 button onClick → openBrief({ category: "stock_risk", scroll: true })
- popup.tsx 카테고리 진입 시 해당 섹션 scroll/highlight
- 운영 조치 합산 logic = Phase 2 정의

**🔵 REFACTOR:**
- API 명명 정합
- 외부 trigger 가능 export

**✋ Quality Gate:**
- ✅ banner onClick → popup open + stock_risk 선택 + scroll
- ✅ 0건 시 배너 hide
- ✅ context API export 정합

**Rollback:** popup-context + inventory-content banner wiring revert

---

### Phase 5: 모바일 + 회귀 통합
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:** mobile patterns + 회귀 통합 sentinel
**🟢 GREEN:**
- KPI 4개 모바일 grid-cols-2 × 2행 (§11.304/§11.311 패턴)
- 배너 모바일 full-width 1줄
- mobile-bottom-sheet anchor jump 정합 (stock_risk preset chip)
- 폐기 검토 탭 보존 가드 + 데이터 source 보존 가드

**🔵 REFACTOR:**
- 모바일 KPI font/icon 컴팩트
- 호영님 mobile patterns 정합

**✋ Quality Gate:**
- ✅ 375px 모바일 헤더 깔끔 (잘림 0)
- ✅ §11.302 신호등 정합 (amber 0)
- ✅ 폐기 검토 탭 라벨/wiring 보존
- ✅ canonical truth mutation 0

**Rollback:** 모바일 grid + sheet wiring revert

---

## 9. Risk Assessment

| Risk | 확률 | Impact | Mitigation |
|---|---|---|---|
| inventory-content 1565-1612 외 영역에 잠재 의존 (다른 컴포넌트가 같은 영역 expect) | Med | Med | Phase 0 추가 grep + sentinel 회귀 가드 |
| 우측 카드 컴포넌트 식별 실패 → 잘못 제거 | Low | High | Phase 0 정확 식별, 식별 실패 시 Phase 2 보류 |
| popup.tsx 외부 setSelectedCategory 호출 패턴 부재 → context API 추가 필요 | Med | Med | Phase 0 확인, 필요시 context patch 포함 |
| 폐기 검토 탭 deep link query string 형식 미존재 | Low | Med | Phase 0 deep link 가능 여부 확인 |
| 모바일 KPI 4개 잘림 (375px) | Low | Med | grid-cols-2 × 2행 + line-clamp |
| Vercel build 회귀 | Low | High | 각 phase 후 정적 grep + 호영님 push 후 Vercel READY 확인 |

---

## 10. Rollback Strategy

- **Phase 1 fail:** sentinel file 삭제
- **Phase 2 fail:** inventory-content.tsx revert (단일 file)
- **Phase 3 fail:** popup.tsx revert
- **Phase 4 fail:** popup-context + banner wiring revert (2 file)
- **Phase 5 fail:** 모바일 grid 변경 revert
- **부분 push 가능:** Phase 2 까지만 push 해도 헤더 정리 자체는 즉시 효과 (배너는 임시로 disabled)

---

## 11. Progress Tracking

- Overall completion: 0%
- Current phase: Phase 0
- Current blocker: 없음
- Next validation step: inventory-content.tsx 1565-1612 + 우측 카드 컴포넌트 식별

**Phase Checklist:**
- [x] Phase 0 complete (Truth Lock + 우측 카드 식별 + popup API 확인)
- [x] Phase 1 complete (Failing sentinel) — inventory-header-brief-migration-317.test.ts
- [x] Phase 2 complete (Header simplification) — 폐기 strip 90 lines 제거 + KPI 4 + 1줄 배너
- [x] Phase 3 complete (Brief stock_risk 카드 강화) — 5 카드 deep link
- [x] Phase 4 complete (진입 동선 wiring) — popup-context selectedCategory 확장 + 배너 onClick
- [x] Phase 5 complete (모바일 + 회귀 통합) — 4 sentinel obsolete + describe.skip + 모바일 grid 정합

---

## 12. Notes & Learnings

**Blockers Encountered:**
- (실행 시점 기록)

**Implementation Notes:**
- §11.302d-6c-1 학습 적용 (운영 브리핑 amber→yellow swept 상태 보존)
- §11.311 Mobile Patterns 정합 (KPI 컴팩트, full-width 배너)
- 호영님 spec 의 "운영 브리핑 카드 내부 액션" 해석: deep link 만 두고 실제 mutation 은 폐기 검토 탭 (canonical truth 정합)

**Closeout Summary:** (Phase 5 완료 시 작성)
