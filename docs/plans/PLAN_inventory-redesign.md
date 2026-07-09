# Implementation Plan: 재고 관리 데스크탑 2단 리디자인

- **Status:** 🔄 In Progress
- **Started:** 2026-07-09
- **Last Updated:** 2026-07-09
- **Estimated Completion:** 2026-07-XX

**CRITICAL** — phase 완료마다: 체크박스 → 게이트(빌드+sentinel, 클로드코드) → Last Updated → Notes → 다음 phase.
⛔ 게이트 실패/미검증 진행 금지. ⛔ dead button/no-op/placeholder success 금지. ⛔ §11.302 dispose>reorder 역전 금지. ⛔ 신규 AI/chatbot UI 금지.

---

## 0. Truth Reconciliation
**Latest Truth Source:** `재고관리_구현_핸드오프.md` + `재고 관리 리디자인.html` + `inventory.css` + `inventory-app.jsx` = **데스크탑 2단(테이블 + 품목 브리핑 패널) 리디자인 시안**.
**Secondary:** 모바일 재고 상세 시트 스크린샷(BCP) — **별개 트랙, out of scope**.
**Live:** 초대형 성숙 표면(~22k줄) — `inventory-content.tsx`(4516)·`inventory-main.tsx`(3897)·`InventoryTable.tsx`(1111)·`inventory-context-panel.tsx`(1255) + 모달 ~20.
**Conflicts:**
- 핸드오프 KPI 순서: 안전재고미달(reorder) > 만료임박·격리(dispose) → **§11.302 역전**. → P1에서 dispose 우선 재배치(호영님 2026-07-09 확정).
- 핸드오프 미배선 지점(발주초안·CSV·위치저장·다건출고)은 데모 토스트 → **정직-disabled(비활성+사유 툴팁)**, 가짜 성공 금지(호영님 확정).
**Chosen truth:** 핸드오프 = 비주얼/UX 시안. 데이터·mutation(재고 truth·발주 draft·lot 상태) = 라이브 canonical 유지.
**Env:** main / 게이트=클로드코드(`npm run build` + vitest), sandbox 실행 불가.

## 1. Priority Fit
- [x] Post-release / Design Consistency. LARGE. release blocker 아님.

## 2. Work Type
- [x] Design Consistency [x] Web [x] Workflow/Ontology(inventory §11.302 순서)

## 3. Overview
**설명:** 데스크탑 재고 화면을 핸드오프 시안(KPI 통합·품목 브리핑 패널·접이식 Sec·de-red·추천벤더/구매이력 모달·Lot 추적 overlay)으로 정합. 라이브 canonical·실 wiring 보존.

**Success Criteria:**
- [ ] KPI 4종 + 경고 3중 중복→배너 1곳, 0값 ✓정상, 안전재고미달 클릭→재발주 패널, **dispose>reorder 순서**
- [ ] 품목 브리핑 패널: 단일 배너(de-red), 접이식 Sec, 이슈 순서 dispose>reorder, rename
- [ ] 재고 테이블: Lot 펼침·inline 위치지정
- [ ] 추천벤더·구매이력(스파크라인) 모달
- [ ] Lot 추적 풀스크린 **overlay**(새 route 아님)

**Out of Scope (⚠️):**
- [ ] 모바일 재고 상세 시트(별 트랙)
- [ ] 발주초안 생성·CSV·위치저장·다건출고 **실 배선**(미배선=정직-disabled, 실배선은 별건)
- [ ] 신규 AI/chatbot UI (현 "AI 재발주"→"재발주안 검토하기" AI 라벨 제거는 O)

**User-Facing:** 데스크탑 재고 화면이 경고 1곳·de-red·접이식 브리핑·추천벤더/이력·Lot 추적으로 정리.

## 4. Product Constraints
**Must Preserve:** same-canvas(패널/overlay), canonical 재고 truth, workbench 구조, 실 mutation(출고·이동·폐기·재발주 draft) wiring.
**Must Not Introduce:** page-per-feature(Lot 추적=overlay), AI/chatbot UI, dead button/fake success, **reorder>dispose 역전**.
**Canonical Truth Boundary:** Source=재고/lot/발주 draft(store·API). Projection=KPI 집계·briefing 파생. Persistence=기존 mutation 경로. 미배선(초안/CSV/위치/다건출고)=정직-disabled.
**UI Surface:** [x] Right dock(품목 브리핑) [x] Inline expand(Lot 행·Sec) [x] Full overlay(Lot 추적) — 신규 route 없음.

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-off |
|---|---|---|
| 라이브 컴포넌트 재사용/정합 | 22k줄 표면 재작성 금지(회귀 위험) | 시안과 100% 픽셀 일치 아닐 수 있음 |
| 미배선=정직-disabled | 가짜 성공 금지 | 시안 데모 토스트 미재현 |
| dispose>reorder 강제 | §11.302 | 핸드오프 KPI 순서 이탈 |

**Touched(예상):** `inventory-content.tsx`/`inventory-main.tsx`(2단 호스트·KPI), `InventoryTable.tsx`, `inventory-context-panel.tsx`(품목 브리핑), reorder/lot 모달, 신규 벤더/이력 모달·Lot overlay, sentinel 다수.
(정확 매핑 = P0 산출.)

## 6. Test Strategy
Sentinel(readFileSync+regex): phase별 신규 패턴 + 금지 패턴(reorder>dispose·AI badge·fake success) + 회귀 보존. 게이트=클로드코드 build+vitest.

## 7. Phases
### Phase 0 — Context & Truth Lock
- Status: [ ] Pending
- 라이브 desktop 재고 호스트/KPI/테이블/context-panel 정독 → 핸드오프 각 섹션↔라이브 컴포넌트 정밀 매핑. §11.302 현재 순서·"AI 재발주" 위치·미배선 지점 실체 확인. 편집 앵커·phase 확정.
- ✋ Gate: 매핑표 완성, 오해 0. Rollback: planning-only.

### Phase 1 — KPI 재설계 (경고 통합 + dispose>reorder)
- Status: [ ] Pending
- 🔴 sentinel: KPI 4종, 배너 1곳(3중 중복 제거), 0값 ✓정상, 안전재고미달 클릭→재발주, **KPI/이슈 순서 dispose>reorder**.
- 🟢 구현. ✋ Gate: dead button 0, 순서 정합. Rollback: 커밋 revert.

### Phase 2 — 품목 브리핑 패널
- Status: [ ] Pending
- 단일 배너 de-red(::before 제거), 접이식 Sec, 이슈 dispose>reorder, rename. 실 wiring 보존.

### Phase 3 — 재고 테이블 (Lot 펼침·inline 위치지정)
- Status: [x] Done (게이트 대기) — 2026-07-10
- 위치지정 = 실 저장 있으면 배선, 없으면 정직-disabled.
- **매핑 결론:** Lot 펼침(expandedProducts/toggleExpand)·inline 위치 UI(onMoveLocation→"위치 이동"/"보관 위치 변경") 라이브 이미 정합. 유일 이슈 = onMoveLocation fake toast("곧 제공").
- **델타:** 실 mutation(PATCH /api/inventory/[id] location 저장) 존재 → 편집 모달(setEditingInventory+setIsDialogOpen, location Input) 재사용 배선. fake toast 2곳(content L2040·main L1503) 제거. 신규 컴포넌트/mutation 0.
- sentinel: `inventory-move-location-wire-p3.test.ts` (fake toast 부재 + 편집 배선 + PATCH location truth + 회귀 0).

### Phase 4 — 추천 벤더 + 구매 이력(스파크라인) 모달
- Status: [ ] Pending
- 발주 초안/PO 이동 = 실배선 or 정직-disabled/토스트(실 대상 확인 후).

### Phase 5 — Lot 추적 풀스크린 overlay
- Status: [ ] Pending
- 필터·FEFO·타임라인·다건출고(다건출고 미배선 시 정직-disabled). same-canvas overlay(새 route 금지).

### Phase 6 — Smoke/Rollback + 색상 토큰 정합
- Status: [ ] Pending
- 전체 sentinel + build, 색상 토큰(de-red·accent/emerald/rose/warn) 정합, rollback 확인.

## 9. Risk
| Risk | P | I | Mitigation |
|---|---|---|---|
| 4.5k줄 파일 회귀 | High | High | phase별 최소 diff·sentinel 회귀 가드·클로드코드 build |
| §11.302 순서 역전 | Med | High | P1 sentinel로 dispose>reorder 강제 |
| 미배선 fake success | Med | High | 정직-disabled 강제, sentinel not.toMatch fake toast |
| Lot 추적이 새 route 됨 | Low | Med | overlay 강제(page-per-feature 금지) |

## 10. Rollback
- phase별 단독 커밋 revert. 서버/스키마 변경 없음(UI/정합).

## 11. Progress
- Overall: ~45% · Current: P3(게이트 대기) · Blocker: 없음 · Next: P4 추천벤더/이력 모달
- [x] P0(매핑) [x] P1(KPI — a11ae05a) [x] P2(품목 브리핑 rename+de-red) [x] P3(위치이동 실배선 — 게이트 대기) [ ] P4 [ ] P5 [ ] P6

**P2 매핑:** 패널 이미 대부분 정합 — 접이식 Sec(§11.320 Phase 3 기구현)·이슈 dispose>reorder(온톨로지 L287)·no-AI(재발주안 검토)·위치 인라인 지정 존재. P2 델타 = rename "운영→품목 브리핑" + de-red 배너(흰 카드+rose). §11.320 배너 bg-red-50 채움 supersede(sentinel 갱신).

**P0 매핑 요약:** 라이브 이미 대부분 정합(§11.317 KPI 통합·InventoryContextPanel=품목브리핑·만료임박=yellow). 신규=추천벤더/이력 모달·Lot 추적 overlay. §11.302 KPI 순서만 역전이었음(P1에서 정정).
**P1 델타:** dispose>reorder 순서·de-red·0값✓정상·안전재고미달 클릭→low 필터. §11.317 testid/배너 보존.

## 12. Notes & Learnings
- [2026-07-09] 승인(호영님): 데스크탑 2단부터. §11.302 dispose>reorder 재배치. 미배선=정직-disabled. 나머지 핸드오프대로.
