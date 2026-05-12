# Implementation Plan: §11.230a Phase C3a — 테이블 키보드 navigation + 셀 툴팁 (#23 c+d)

- **Status:** 🔄 In Progress
- **Started:** 2026-05-12
- **Last Updated:** 2026-05-12

⛔ quality gate skip 0 / canonical truth 충돌 보류 시 진입 0 / dead button·no-op 도입 0

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `apps/web/src/app/dashboard/quotes/page.tsx` (§11.229 land 후)
- 현재 tbody row (line 1632) — `onClick={() => openQuoteContextRail(...)}` 만 + 키보드 navigation 0
- 제목 td (line 1641) — `max-w-[280px] truncate` 적용, hover 시 full text 노출 없음

**§11.230a 신규 작업 (호영님 v2 #23 의 c+d):**
- (c) 셀 툴팁 — 제목 td truncate 시 full text 노출 (native `title` attribute)
- (d) 키보드 navigation — Arrow Up/Down row 이동 + Enter row 진입 + Esc rail close

**Chosen Source of Truth:**
- sortedQuotes (canonical) — focus index 가 derived projection
- openQuoteContextRail / closeQuoteContextRail (canonical mutation) 재사용

**Environment Reality Check:**
- [x] §11.229 land 완료 (HEAD = 473743ce)
- [x] vitest 252/252 GREEN baseline

## 1. Priority Fit

**Current Priority Category:**
- [x] P2 / Deferred (호영님 §11.230a 진입 명시 승인)

**Why This Priority:**
- 호영님 v2 #23 4 sub-spec 중 분할 권장안 (a11y + tooltip 먼저, resize + customize 다음)
- §11.230a = state shape 변경 0, low risk

## 2. Work Type

- [x] Feature (a11y)
- [x] Web

## 3. Overview

**Feature Description:**
sortedQuotes 테이블에 키보드 navigation 추가 + 제목 셀 truncate 시 full text tooltip. 운영자 마우스 의존도 ↓ + accessibility 강화.

**Success Criteria:**
- [ ] 제목 td 에 `title={tableDisplayTitle}` 추가 (truncate 시 native browser tooltip)
- [ ] tbody tr 에 `tabIndex={0}` + `role="button"` + `aria-label` 추가
- [ ] tr `onKeyDown` 핸들러: ArrowUp / ArrowDown / Enter / Escape
- [ ] focusedRowIndex useState — 현재 키보드 focus row
- [ ] focus 이동 시 tr DOM focus() 호출 (native browser focus ring 시각화)
- [ ] vitest / tsc no new errors
- [ ] Chrome smoke (테이블 진입 → Tab → focus → Arrow → Enter → rail open → Esc → close)

**Out of Scope:**
- [x] dedicated Tooltip component (Radix/shadcn) — native `title` 으로 충분
- [x] Home/End/PageUp/PageDown — Arrow + Enter + Esc 4 key 만
- [x] (a) 컬럼 리사이즈 — §11.230b
- [x] (b) 컬럼 커스텀 — §11.230b
- [x] 카드 뷰 키보드 navigation — 테이블 뷰만 (호영님 spec)

**User-Facing Outcome:**
- 운영자가 테이블 뷰에서 마우스 없이 Arrow + Enter 만으로 quote 탐색
- 제목 잘린 경우 hover 시 full text 노출

## 4. Product Constraints

**Must Preserve:**
- [ ] workbench / queue / rail / dock
- [ ] same-canvas (rail open 은 기존 흐름 그대로)
- [ ] canonical truth (sortedQuotes / openQuoteContextRail)
- [ ] §11.227 sortable thead invariant
- [ ] §11.226 shortenActionLabel + 9 컬럼

**Must Not Introduce:**
- [ ] page-per-feature
- [ ] dead button / no-op
- [ ] preview overriding actual truth
- [ ] chatbot/assistant reinterpretation

**Canonical Truth Boundary:**
- Source of Truth: `sortedQuotes` (canonical) + `selectedQuoteId` (canonical state)
- Derived Projection: `focusedRowIndex` (UI focus only, mutation 0)
- Persistence Path: openQuoteContextRail/closeQuoteContextRail 기존 그대로

**UI Surface Plan:**
- [x] Existing route section (table tbody row enhancement)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| Native `title` attribute (Tooltip component 거부) | minimal-diff + browser native 지원 + a11y 정합 | hover delay 300ms (브라우저 default) — 운영 흐름 적합 |
| `focusedRowIndex` useState (component scope) | sortedQuotes 변경 시 focus reset 정합 | useState 1개 추가, persist 0 |
| DOM focus() 호출 (ref-based 또는 querySelector) | native focus ring 자동 시각화 + a11y free | DOM 의존 — sortedQuotes change 시 row 재마운트 처리 필요 |

**Dependencies:**
- Required Before Starting: §11.229 (land ✅)
- External Packages: 없음

**Integration Points:**
- `page.tsx` tbody tr — onKeyDown + tabIndex + title + role + aria-label

## 6. Global Test Strategy

- Source-level grep sentinel
- tabIndex / onKeyDown / title attribute / focusedRowIndex 검증
- invariant 보존 (§11.227 sortable + §11.228 BatchActionBar + §11.226 shortenActionLabel)

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [x] Complete

### Phase 1: Failing Tests
- Status: [ ] In Progress

**🔴 RED:** `quote-table-keyboard-tooltip.test.ts` 신설
- (a) 제목 td title attribute grep
- (b) tabIndex / role / aria-label grep
- (c) onKeyDown grep + 4 key 분기 (ArrowUp / ArrowDown / Enter / Escape)
- (d) focusedRowIndex useState grep
- (e) invariant 보존 (sortedQuotes / openQuoteContextRail / §11.226~§11.229)

### Phase 2: Core Implementation
- Status: [ ] Pending

**🟢 GREEN:**
- `focusedRowIndex` useState 추가
- tr 에 `tabIndex={0}` + `role="button"` + `aria-label` + `onKeyDown`
- 제목 td 에 `title={tableDisplayTitle}` 추가
- onKeyDown body — 4 key 분기 + DOM focus 이동

### Phase 3: Verify + ADR + Commit
- Status: [ ] Pending

**🟢 GREEN:**
- vitest cluster GREEN
- tsc clean
- ADR-002 §11.230a entry append
- commit + push

## 9. Risk Assessment

| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| Tab focus order 회귀 (BatchActionBar / KPI 카드 / 검색 input 등) | Low | Med | tabIndex={0} 만 (자동 Tab order 자연 정합) |
| sortedQuotes change 시 focus stale | Low | Low | useEffect 로 sortedQuotes.length 변경 시 focusedRowIndex 조정 |
| native title 의 hover delay 300ms 부담 | Low | Low | 운영 흐름 적합 — dedicated Tooltip 은 §11.230c 백로그 |

## 10. Rollback Strategy

- Phase 1 fail: test file revert
- Phase 2 fail: page.tsx diff revert
- Phase 3 fail: git revert SHA

## 11. Progress Tracking

- Overall completion: 30%
- Phase 0: Complete
- Phase 1: In Progress

**Phase Checklist:**
- [x] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete

## 12. Notes & Learnings

- 호영님 §11.230 4 sub-spec 분할 (§11.230a + §11.230b) 결정
- §11.230a = a11y + tooltip (low risk) → §11.230b = resize + customize (higher risk)

---

**Cluster:** §11.230a (Phase C3a / quote-management v2 / #23 c+d)
**Lineage:** §11.217 → §11.225 → §11.226 → §11.227 → §11.228 → §11.229 → §11.230a (현재)
