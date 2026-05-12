# Implementation Plan: §11.230b Phase C3b — 테이블 컬럼 리사이즈 + 커스텀 (#23 a+b)

- **Status:** 🔄 In Progress
- **Started:** 2026-05-12
- **Last Updated:** 2026-05-12

⛔ quality gate skip 0 / canonical truth 충돌 보류 시 진입 0 / dead button·no-op 도입 0

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `apps/web/src/app/dashboard/quotes/page.tsx` (§11.230a land 후)
- 현재 thead 9 컬럼: 제목 / 상태 / 품목 / 회신 / 가격 / 납기 / 우선순위 / 등록 / 액션
- §11.226 #4: 가격/납기 컬럼 자동 hide (priceColumnHasData / deliveryColumnHasData)
- §11.227 sortState: 5 컬럼 sortable (제목/상태/품목/회신/등록)
- §11.230a focusedRowIndex + tabIndex/onKeyDown

**§11.230b 신규 작업 (호영님 v2 #23 a+b):**
- (a) **컬럼 리사이즈** — th 우측 drag handle + width state + localStorage persist
- (b) **컬럼 커스텀** —
  - (b1) 보임/숨김 toggle — settings popover/modal + checkbox
  - (b2) 순서 재정렬 — HTML5 native drag-and-drop (외부 라이브러리 0)

**Chosen Source of Truth:**
- `localStorage["labaxis-quote-column-prefs"]` 단일 객체:
  ```ts
  {
    widths: Record<ColumnKey, number>;     // px, default 컬럼별
    visibility: Record<ColumnKey, boolean>; // 기본 true (단, 가격/납기 는 §11.226 #4 hasData 우선)
    order: ColumnKey[];                     // default 정의 순서
  }
  ```
- `ColumnKey` enum 도입 (9 컬럼 식별자): `"title" | "status" | "itemCount" | "responseCount" | "price" | "delivery" | "priority" | "createdAt" | "actions"`
- canonical sortState / focusedRowIndex / sortedQuotes 변경 0

**Environment Reality Check:**
- [x] §11.230a deploy 진행중 (BUILDING)
- [x] vitest 271/271 GREEN baseline

## 1. Priority Fit

**Current Priority Category:**
- [x] P2 / Deferred (호영님 §11.230b 일괄 진입 명시 승인)

**Why This Priority:**
- 호영님 v2 #23 4 sub-spec 완결 — (c)(d) §11.230a 후속, (a)(b) §11.230b
- 호영님 "가자" — 일괄 land 결정

## 2. Work Type

- [x] Feature
- [x] Design Consistency
- [x] Web

## 3. Overview

**Feature Description:**
테이블 9 컬럼 사용자 선호 persist (폭 / 보임 / 순서). localStorage 단일 객체. canonical truth 보호 + §11.226~§11.230a invariant 모두 보존.

**Success Criteria:**
- [ ] ColumnKey enum 정의 (9 컬럼)
- [ ] columnPrefs useState ({ widths, visibility, order }) + localStorage persist
- [ ] th 우측 drag handle — mousedown/move/up + widths state mutation + localStorage write
- [ ] 컬럼 설정 popover — checkbox visibility toggle + drag-and-drop order (HTML5 native)
- [ ] thead 5 sortable 컬럼 sortState 보존 (§11.227 invariant)
- [ ] §11.226 #4 priceColumnHasData / deliveryColumnHasData 우선 (visibility 보다 우위)
- [ ] §11.230a focusedRowIndex / tabIndex / onKeyDown 보존
- [ ] vitest / tsc no new errors

**Out of Scope:**
- [x] 외부 라이브러리 (dnd-kit / react-resizable) — HTML5 native 만
- [x] 컬럼 폭 최소/최대 guard (소프트 한도만 — min: 60px, max: 500px)
- [x] 카드 뷰 컬럼 prefs — 테이블 only (호영님 spec)
- [x] 모바일 분기 — desktop 한정 (mobile 테이블 미사용)
- [x] 컬럼 prefs server-side persist (현재 localStorage only)

**User-Facing Outcome:**
- 운영자가 9 컬럼 중 본인 우선순위 컬럼만 표시 (예: "가격/납기 hide → 6 컬럼")
- 컬럼 폭 조정 후 새로고침해도 유지
- 컬럼 순서 재정렬 (예: 액션 컬럼을 두 번째로 이동)

## 4. Product Constraints

**Must Preserve:**
- [ ] workbench / queue / rail / dock
- [ ] same-canvas (settings popover 안 → main page 안)
- [ ] canonical truth (sortedQuotes / sortState / selectedQuoteId / focusedRowIndex)
- [ ] §11.226 #4 hasData 우선 (visibility 무시할 수 없음)
- [ ] §11.227 sortState 보존
- [ ] §11.230a keyboard nav 보존

**Must Not Introduce:**
- [ ] page-per-feature
- [ ] dead button / no-op
- [ ] preview overriding actual truth
- [ ] chatbot reinterpretation
- [ ] localStorage drift (canonical schema 위반)

**Canonical Truth Boundary:**
- Source of Truth: `sortedQuotes` (canonical data) + `sortState` (canonical sort)
- Derived Projection: `columnPrefs` (UI preference only, localStorage persist)
- Persistence Path: localStorage write on mutation
- Constraint: visibility false 라도 가격/납기 컬럼은 `hasData === true` 시 노출 (§11.226 #4 우선)

**UI Surface Plan:**
- [x] Existing route section (popover trigger button + thead drag handles)
- [x] Inline expand (settings popover, same-canvas)
- [ ] New page

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| localStorage 단일 객체 (`labaxis-quote-column-prefs`) | state migration 단순 + JSON 한 번 parse | partial update 시 객체 전체 write |
| ColumnKey enum (9 컬럼) | type-safe state shape + drift sentinel | enum 1개 추가 |
| HTML5 native drag-and-drop | 외부 라이브러리 0, minimal-diff | drop animation 없음 (UX 약간 단조) |
| 컬럼 폭 최소/최대 guard (60~500px) | 컬럼 깨짐 차단 | hardcoded — 호영님 spec 외 수정 시 별도 cluster |
| §11.226 #4 hasData 우선 (visibility 무시) | canonical truth 보호 — 데이터 있는 컬럼 사용자 hide 시 운영 마찰 | 사용자가 명시적으로 hide 해도 자동 show — 의도된 동작 |

**Dependencies:**
- Required Before Starting: §11.230a (land 진행중)
- External Packages: 없음
- Existing Routes / Models / Services Touched: `apps/web/src/app/dashboard/quotes/page.tsx`

**Integration Points:**
- thead 9 th — width style + drag handle + visibility 조건 render
- tbody 9 td — width style 동기화 (style.width 명시 또는 colgroup 사용)
- 새 popover/dropdown — 컬럼 설정 UI (settings icon button trigger)

## 6. Global Test Strategy

- Source-level grep sentinel
- ColumnKey enum / columnPrefs useState / localStorage key / 9 컬럼 visibility 분기 / drag handle / popover trigger
- invariant 보존 (sortedQuotes / sortState / §11.226 hasData / §11.230a keyboard)

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [x] Complete

### Phase 1: Failing Tests
- Status: [ ] In Progress

**🔴 RED:** `quote-table-column-prefs.test.ts` 신설
- (a) ColumnKey enum / type 정의 grep
- (b) columnPrefs useState + localStorage persist key
- (c) drag handle (mousedown/move/up) 핸들러
- (d) popover trigger 버튼 + checkbox 9 컬럼
- (e) HTML5 drag-and-drop (draggable / onDragStart / onDrop)
- (f) §11.226 hasData 우선 (visibility false 라도 가격/납기 hasData true 시 render)
- (g) invariant 보존 (§11.227 sortState / §11.230a keyboard / sortedQuotes / openQuoteContextRail)

### Phase 2: Core Implementation
- Status: [ ] Pending

**🟢 GREEN:**
- ColumnKey enum + DEFAULT_COLUMN_PREFS 상수
- columnPrefs useState + useEffect (localStorage hydrate + write)
- 컬럼별 width style → th + td (colgroup 또는 inline style)
- thead 우측 drag handle (mousedown 시 ref 활성화, mousemove 시 width 계산, mouseup 종료)
- "컬럼 설정" button — Settings icon, popover open
- popover 안 9 컬럼 row — checkbox (visibility) + drag handle (order)
- visibility filter (단, hasData 우선)

### Phase 3: Verify + ADR + Commit
- Status: [ ] Pending

## 9. Risk Assessment

| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| drag handle mouse event 누락 (mouseleave 시 좀비 mousedown) | Med | Med | useEffect cleanup + document-level mouseup listener |
| §11.226 #4 hasData 우선 정합 깨짐 | Med | High | RED test 명시 — hasData true + visibility false 시 render |
| §11.227 sortState 깨짐 (thead th wrap 변경) | Low | Med | invariant 보존 test |
| §11.230a tabIndex/onKeyDown 깨짐 | Low | Med | tbody tr 변경 0, td/colgroup 만 변경 |
| localStorage drift (schema 변경 시) | Low | Low | JSON.parse try/catch + DEFAULT_COLUMN_PREFS fallback |
| 9 컬럼 width 합산 > viewport 시 overflow | Med | Low | table 자체 overflow-x-auto (기존 그대로) |

## 10. Rollback Strategy

- Phase 1 fail: test file revert
- Phase 2 fail: page.tsx diff revert
- Phase 3 fail: git revert SHA

## 11. Progress Tracking

- Overall completion: 10%
- Phase 0: Complete
- Phase 1: In Progress

**Phase Checklist:**
- [x] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete

## 12. Notes & Learnings

- 호영님 §11.230 일괄 land 결정 (분할 거부) — risk 인정
- localStorage 통합 default (분리 시 호영님 swap)
- HTML5 native drag-and-drop (외부 라이브러리 0)
- §11.226 #4 hasData 우선 — 가격/납기 컬럼은 사용자 visibility 무시
- 9 컬럼 ColumnKey enum: title / status / itemCount / responseCount / price / delivery / priority / createdAt / actions

---

**Cluster:** §11.230b (Phase C3b / quote-management v2 / #23 a+b)
**Lineage:** §11.217 → §11.225 → §11.226 → §11.227 → §11.228 → §11.229 → §11.230a → §11.230b (현재)
