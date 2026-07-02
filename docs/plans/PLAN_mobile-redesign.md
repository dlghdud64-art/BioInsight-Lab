# Implementation Plan: 모바일 리디자인 (대시보드 · 견적 · 재고)

- **Status:** ⏸ Deferred (prototype-first — 목업본 우선, 라이브 통합 보류. 호영님 2026-07-02)
- **Started:** 2026-07-02
- **Last Updated:** 2026-07-02
- **Estimated Completion:** TBD (large, 6 phase)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT introduce dead button / no-op / placeholder success
⛔ DO NOT let 정적 목업 마크업이 canonical 데이터 wiring 을 덮게 하지 말 것

---

## 0. Truth Reconciliation

**Latest Truth Source:** 호영님 업로드 목업 4종 (01 대시보드 / 02 견적 / 03 재고 / 04 입고) + 2026-07-02 세션 결정 "목업이 정본, 구조까지 교체" + "hard 제품원칙 충돌은 재해석(원칙 유지)".

**Secondary References:** 실 repo — bottom-nav.tsx, dashboard/page.tsx, dashboard-shell.tsx, quotes/inventory/receiving routes, §purchasing-hide, §11.271(scan→header inline).

**Conflicts Found (목업 vs 실·제품원칙):**
1. 목업 02 "AI 추천 액션"(pulse+AI eyebrow) ↔ 제품원칙 "AI/chatbot badge 금지". → **재해석**: contextual 우선 액션 배너로, AI 라벨·pulse 제거.
2. 목업 03 재발주 배너 최상단 + 부족 먼저 ↔ "expired lot(qty>0) dispose > generic reorder". → **재해석**: 만료·폐기 우선 보존.
3. BottomNav 목업 6탭(+분석)+스캔 FAB 라이트 ↔ 실 5탭 다크+§purchasing-hide. 스캔 FAB ↔ §11.271 헤더 inline 중복. → **정리**: 탭셋/테마 목업 채택하되 스캔 단일화, §purchasing-hide 회귀 보호.
4. 목업=정적 HTML/CSS ↔ 실=Next.js server component+feature flag+ontology store. → **경계**: 시각 구조만 채택, 데이터 바인딩 보존.

**Chosen Source of Truth:** 시각 구조=목업 / 데이터·wiring·제품원칙=실 repo. 충돌 시 제품원칙 우선(호영님 2026-07-02 승인).

**Environment Reality Check:**
- [x] repo/branch context (apps/web, Next.js)
- [x] runnable: sentinel 격리 Node 검증(공유 node_modules vitest rollup native 이슈 → 격리 검증 대체), build 게이트는 클로드코드 환경
- [ ] quotes/inventory 페이지 내부 모바일 구조 — **P0에서 lock**

## 1. Priority Fit

- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release (추정 P2 UI 폴리시)
- [ ] P2 / Deferred

**Why:** 기능 신규 아님. 기존 3 surface 모바일 시각/밀도 정렬 + BottomNav 재구성. P1/blocker 직접 충돌 미확인 — P0에서 최신 truth 재확인.

## 2. Work Type
- [x] Mobile / Web / Design Consistency (+ 부분 Workflow/Ontology surface: 견적 우선 액션·재고 우선순위)

## 3. Overview

**Feature Description:** 업로드 목업(대시보드·견적·재고)을 정본으로 3개 모바일 surface 시각 구조 교체 + BottomNav 재구성. 데이터 wiring·제품원칙 보존.

**Success Criteria:**
- [ ] BottomNav 목업 탭셋/테마 반영, §purchasing-hide 회귀 0, 스캔 단일화
- [ ] 대시보드 모바일 목업 밀도/섹션 정렬(데이터 바인딩 보존)
- [ ] 견적 모바일 summary·칩·staged queue, 우선 액션 배너(AI 라벨 제거)
- [ ] 재고 모바일 summary·칩·lot 카드, 만료·폐기 우선 보존
- [ ] 각 surface sentinel + build GREEN

**Out of Scope (⚠️ 절대 구현 금지):**
- [ ] 04 입고 (외부 assets/inbound-mobile.jsx·css 미첨부 — 별도 보류)
- [ ] AI/chatbot badge·pulse·fake reasoning
- [ ] 모바일 전용 신규 route(page-per-feature)
- [ ] 데스크탑 레이아웃 변경(모바일 max-lg 한정)

**User-Facing Outcome:** 모바일에서 대시보드·견적·재고가 목업 수준의 밀도·계층·하단 탭 네비게이션으로 개선.

## 4. Product Constraints

**Must Preserve:** workbench/queue/rail/dock · same-canvas · canonical truth · §purchasing-hide · §11.271
**Must Not Introduce:** page-per-feature · AI/chatbot 재해석 · dead button/no-op/fake success · preview가 truth 덮기
**Canonical Truth Boundary:** Source=DB/server(quotes·inventory·orders) / Projection=페이지 쿼리 / Snapshot=목업은 시각 참조일 뿐 / Persistence=기존 mutation 유지.
**UI Surface Plan:** [x] Existing route section (반응형) · [x] Bottom sheet(더보기) — [ ] New page 금지.

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 목업 시각구조 채택 + 데이터 바인딩 보존 | 정본 시각 + canonical 보호 | 픽셀 100% 일치 아닐 수 있음 |
| BottomNav 탭셋 override(§purchasing-hide 위) | 호영님 승인 | 회귀 위험 → sentinel 강제 |
| AI 배너 재해석 | 제품원칙 hard rule | 목업과 라벨 차이 |

**Existing Touched:** bottom-nav.tsx, bottom-nav-more-sheet, dashboard/page.tsx, quotes/page.tsx, inventory/*, globals.css.

## 6. Global Test Strategy
- UI 구조/회귀 → sentinel(readFileSync+regex, 회귀 0 블록 필수)
- 정적 렌더 육안 → 격리 chromium harness 스크린샷(가능 시)
- build 게이트 → 클로드코드 환경 `npm run build`
- 실행 불가 항목은 "실행 불가" 명시

## 7. Implementation Phases

### Phase 0: Truth & Nav Lock
- Status: [ ] Pending | [ ] In Progress | [ ] Complete
**🔴 RED:** quotes/inventory 실 모바일 구조 미확정. BottomNav 최종 탭셋 미확정.
**🟢 GREEN:** 실 구조 read·기록, 4충돌 해소 결정 확정, 탭셋 확정.
**🔵 REFACTOR:** 범위 축소, stale 가정 제거.
**✋ Gate:** 충돌 0, priority 재확인, 탭셋 확정. **Rollback:** planning-only.

### Phase 1: BottomNav 재구성
- Status: [ ] Pending | [ ] In Progress | [ ] Complete
**🔴 RED:** 목표 탭셋/테마/스캔단일화 sentinel(회귀: §purchasing-hide 스왑·더보기 시트).
**🟢 GREEN:** bottom-nav.tsx 반영.
**🔵 REFACTOR:** 중복 스캔 제거.
**✋ Gate:** dead button 0, §purchasing-hide 회귀 0. **Rollback:** revert bottom-nav.tsx.

### Phase 2: 대시보드 모바일
- Status: [ ] Pending | [ ] In Progress | [ ] Complete
**🔴 RED:** 섹션 밀도/정렬 sentinel(데이터 바인딩 보존 회귀).
**🟢 GREEN:** dashboard/page.tsx 모바일 클래스/구조 정렬.
**🔵 REFACTOR:** same-canvas 유지.
**✋ Gate:** 데이터 wiring 보존, empty/loading 유지. **Rollback:** revert page.tsx.

### Phase 3: 견적 모바일
- Status: [ ] Pending | [ ] In Progress | [ ] Complete
**🔴 RED:** summary·칩·staged queue·우선배너(AI 라벨 없음) sentinel.
**🟢 GREEN:** quotes 모바일 구조 반영.
**🔵 REFACTOR:** 온톨로지=contextual action 형태 확인.
**✋ Gate:** AI badge 0, no-op 0. **Rollback:** revert quotes.

### Phase 4: 재고 모바일
- Status: [ ] Pending | [ ] In Progress | [ ] Complete
**🔴 RED:** summary·칩·lot 카드·만료폐기 우선 sentinel.
**🟢 GREEN:** inventory 모바일 구조 반영.
**🔵 REFACTOR:** expired>reorder 우선 확인.
**✋ Gate:** 만료·폐기 우선 보존, dispose CTA object-scoped. **Rollback:** revert inventory.

### Phase 5: Smoke / Rollback
- Status: [ ] Pending | [ ] In Progress | [ ] Complete
**🔴 RED:** rollout 실패모드·smoke path 정의.
**🟢 GREEN:** build·sentinel·정적 렌더 육안, surface별 rollback 문서화.
**🔵 REFACTOR:** 임시 계측 제거.
**✋ Gate:** build EXIT 0, 전 sentinel GREEN. **Rollback:** surface별 revert 표.

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 정적 마크업이 canonical wiring 덮음 | Med | High | P0 경계 고정, 최소 diff, 데이터 바인딩 회귀 sentinel |
| §purchasing-hide / §11.271 회귀 | Med | High | 각 sentinel 회귀 블록 |
| page-per-feature 회귀 | Low | High | same-canvas 반응형만 |
| AI 배지 원칙 위반 | Low | Med | 재해석 확정(원칙 유지) |

## 10. Rollback Strategy
- P1 실패: revert bottom-nav.tsx
- P2 실패: revert dashboard/page.tsx
- P3 실패: revert quotes
- P4 실패: revert inventory
- 전역: surface별 독립 commit → 개별 revert 가능

## 11. Progress Tracking
- Overall: 0%
- Current phase: P0
- Blocker: 없음
- Next: quotes/inventory 실 구조 read

**Phase Checklist:**
- [ ] Phase 0 · [ ] Phase 1 · [ ] Phase 2 · [ ] Phase 3 · [ ] Phase 4 · [ ] Phase 5

## 12. Notes & Learnings
- 2026-07-02 승인: 목업 정본·구조 교체, 충돌 2건 재해석(원칙 유지). 04 보류(assets 미첨부).


## 13. Pivot (2026-07-02)
호영님 결정: 라이브 route 직접 수정 중단 → **정적 목업본 세트**(docs/mockups/)로 따로 산출·리뷰. 02/03 재해석 반영 완료. 본 PLAN(P1~P5 라이브 통합)은 통합 착수 시 재개.
