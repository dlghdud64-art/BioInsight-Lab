# Implementation Plan: Inventory Reorder Surface Unify (P3b-2)

- **Status:** ⏳ Pending
- **Started:** 2026-06-24
- **Last Updated:** 2026-06-24
- **Estimated Completion:** TBD
- **Predecessor:** PLAN_inventory-panel-unify.md (P1/P2/P3a land, P3b-1 land @ `4cca90bf`)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands (operator: vitest + `npm run build`)
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
- 2026-06-24 세션 코드 정찰 (HEAD `4cca90bf`, production READY):
  - `apps/web/src/app/dashboard/inventory/inventory-content.tsx` — preparePanel 잔여 6 site: L1431(모바일 리스트 onReorder)·L1981·L2265·L2674(모바일 브리프시트 primaryCta)·L2731(데스크탑 패널 onReorder)·L3234(상세 Sheet "재발주 검토" 버튼)
  - `apps/web/src/components/inventory/inventory-context-panel.tsx` — `onReorder` prop = 패널 내부 4 CTA 공통 핸들러: 상태배너 재주문(L613)/우선소진(L622), 재발주안 검토(L672), 권장액션 실행(L1117). `mode='reorder'`는 헤더 eyebrow(L505) + 재발주 우선순위 섹션 강조(L654·L658)만 소비.
  - `apps/web/src/components/operational-brief/mobile-bottom-sheet.tsx` — `MobileOperationalBriefSheet`는 `md:hidden`(L105), `mode` prop 미보유/미소비. primaryCta(L197)만 노출.

**Secondary References:**
- 핸드오프 메모(2026-06-24) #2 — "8 인라인 preparePanel reroute → openContextPanel(inv,'reorder')" + "AiAssistantPanel 렌더 retire".
- PLAN_inventory-panel-unify.md — P2가 `reorderQty`(canonical: /api/inventory/reorder-recommendations) 흡수, P3a가 mode plumbing land.
- `__tests__/regression/inventory-panel-unify.test.ts`, `inventory-issue-alert-action-menu-297e.test.ts`.

**Conflicts Found:**
- C1 — 핸드오프 #2는 "6 site 일괄 reroute + retire"를 **안전 전제**로 기술. 정찰 결과 모바일/종단 경로에 대체 표면이 없어 retire 시 no-op 발생 → 전제 무효.
- C2 — 핸드오프는 모바일 컨텍스트 패널이 `mode`를 소비한다고 암묵 가정. 실제 `MobileOperationalBriefSheet`는 `md:hidden` + `mode` 미소비.
- C3 — AiAssistant 캡(벤더 비교: `onViewVendors`→검색, lot 상세, 권장액션)을 컨텍스트 패널이 미흡수(P2는 `recommendedQty` 숫자·사유만 흡수).

**Chosen Source of Truth:**
- **코드 정찰 사실 우선** (핸드오프 가정보다). 핸드오프 #2의 "일괄 reroute+retire"는 폐기, 본 PLAN으로 대체.

**Environment Reality Check:**
- [ ] repo / branch context: `C:\Users\young\ai-biocompare`, web=`apps/web`, HEAD `4cca90bf`
- [ ] runnable commands: operator(클로드코드) — vitest + `npm run build`. sandbox는 편집·정찰만.
- [ ] execution blockers: sandbox mount §11.237 stale 가능 → 무결성은 Read/Grep 도구 기준.

---

## 1. Priority Fit

**Current Priority Category:**
- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release
- [ ] P2 / Deferred (partial — 종단 실발주는 ENABLE_PURCHASING 복귀 의존, defer)

**Why This Priority:**
- 현 production은 AiAssistant 존치로 안전 (release blocker 아님).
- 본 작업은 inventory 재발주 진입 표면 통합(UX 일관성) + 모바일 갭 봉합.
- 종단 "재발주안 검토"의 실발주 연결은 `ENABLE_PURCHASING` OFF(§purchasing-hide)에 막혀 있어 그 부분만 defer. 검토 단계까지는 본 PLAN에서 완결.

---

## 2. Work Type

- [ ] Feature
- [ ] Bugfix
- [ ] API Slimming
- [x] Workflow / Ontology Wiring
- [ ] Migration / Rollout
- [ ] Billing / Entitlement
- [x] Mobile
- [x] Web
- [x] Design Consistency

---

## 3. Overview

**Feature Description:**
inventory 재발주 진입을 단일 통합 패널(ContextPanel `mode='reorder'`) 흐름으로 정리한다. 데스크탑은 기존 패널 reorder mode, 모바일은 `MobileOperationalBriefSheet`에 reorder mode 표면을 신설한다. 패널 내부 `onReorder` 공통 핸들러를 **진입-emphasis**(mode 전환)와 **종단-proceed**(실 재발주 의도)로 분리해, AiAssistant retire 후에도 no-op/dead button이 생기지 않게 한다. 종단-proceed는 purchasing OFF 동안 "검토까지 + 발주 버튼 disabled(정직 사유)"로 처리한다.

**Success Criteria:**
- [ ] **ReorderReviewSheet 추출** — AiAssistant 내부 state 의존 제거, content-level state로 승격해 ContextPanel·모바일이 직접 `openReorderReviewSheet(item)` 호출 가능
- [ ] 모바일 재발주 진입(리스트 onReorder, 브리프시트 primaryCta)이 reorder 검토를 실제로 보여줌 (재오픈/loop 0)
- [ ] 데스크탑 패널 진입 CTA(재주문/우선소진) = mode 전환(실 상태 변화), 종단 CTA(재발주안 검토) = ReorderReviewSheet 오픈
- [ ] 종단 = ReorderReviewSheet(실 검토: 추천벤더·예상금액·견적요청 live) 노출. **"바로 발주"(PO)만** purchasing-off `disabled` + 정직 사유 — dead button/no-op 0. 견적요청/검토는 작동
- [ ] AiAssistant **분석 래퍼** inventory 트리거 제거(파일 보존), `?ai_panel=` deep-link 정리, `aiPanel` orphan/unused 0 — **단 ReorderReviewSheet는 보존·승격**
- [ ] 만료 lot dispose 우선 원칙 보존 (reorder가 expired-lot dispose보다 먼저 뜨지 않음)

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] ENABLE_PURCHASING 되살리기 / 실 PO 발주 생성 흐름 (별도 트랙) — 본 PLAN은 "바로 발주" disabled 게이팅만
- [ ] **ReorderReviewSheet 삭제/기능 축소** (§11.310 sentinel 보존, 견적요청/벤더비교 유지)
- [ ] AiAssistant 컴포넌트 파일 삭제 (retire = inventory 트리거 제거만, 파일 보존 = rollback)
- [ ] quotes/purchases page-per-feature 분절
- [ ] 신규 AI/chatbot UI 제안

**User-Facing Outcome:**
- 모바일/데스크탑 어디서 재발주를 눌러도 동일한 통합 검토 표면이 뜸. "검토는 되는데 발주는 아직"임이 정직하게 보임(준비중 사유). 죽은 버튼 없음.

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock
- [x] same-canvas (신규 페이지 0)
- [x] canonical truth (`reorderQty` = /api/inventory/reorder-recommendations, item 파생만)
- [x] invalidation discipline (`invalidateBriefNarrative` 보존)

**Must Not Introduce:**
- [x] page-per-feature
- [x] chatbot/assistant reinterpretation of ontology
- [x] dead button / no-op / placeholder success
- [x] fake billing/auth shortcut
- [x] preview overriding actual truth

**Canonical Truth Boundary:**
- Source of Truth: `/api/inventory/reorder-recommendations` (recommendedQty), `ProductInventory`(currentQuantity/safetyStock/expiryDate/location)
- Derived Projection: 패널/시트 reorder 섹션 표시값 (전부 위 canonical 파생)
- Snapshot / Preview: 없음 (가짜 추천/수량 0 금지)
- Persistence Path: 본 PLAN에서 신규 쓰기 없음 (위치지정 PATCH 등 기존 경로 불변)

**UI Surface Plan:**
- [x] Bottom sheet (모바일 reorder mode 신설)
- [x] Split panel (데스크탑 ContextPanel reorder mode — 기존)
- [ ] New page (⚠️ 금지)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 패널 `onReorder` → `onReorderEmphasis` + `onReorderProceed` 2-prop 분리 | 진입(강조 전환)과 종단(실 의도)이 의미가 달라 공통 핸들러로 두면 retire 시 종단 no-op | prop 표면 증가 (sentinel로 회귀 보호) |
| 모바일 시트에 `mode` 소비 + reorder 섹션 신설 | 모바일 유일 표면이 `md:hidden`이라 데스크탑 패널 재사용 불가 | 모바일/데스크탑 reorder 렌더 2벌 (canonical 동일 소스로 drift 방지) |
| 종단 proceed = 검토 + 발주 disabled 정직 사유 (purchasing OFF) | 실발주 목적지 부재 시 dead button 금지 원칙 | 발주 미완 — ENABLE_PURCHASING 복귀 시 활성화(주석·flag 연동) |
| ReorderReviewSheet를 content-level로 추출(독립 오픈) | 종단 검토가 실 기능(벤더비교)인데 AiAssistant 내부 state에 갇혀 패널/모바일이 못 엶 | useReorderRecommendation 호출처 이전 — 중복 방지 위해 단일 소스 유지 |
| AiAssistant **분석 래퍼**만 inventory 트리거 retire, ReorderReviewSheet 보존 | rollback 용이 + 실 검토 캡 보존 | 래퍼 파일 dead-ish (import 0 확인 필요) |

**Dependencies:**
- Required Before Starting: P3b-1 land(완료 @`4cca90bf`), mode plumbing(P3a, 완료)
- External Packages: 없음 (sandbox 패키지 설치 금지 — CLAUDE.md)
- Existing Routes / Models / Services Touched: inventory-content.tsx, inventory-context-panel.tsx, mobile-bottom-sheet.tsx (+ sentinel)

**Integration Points:**
- `useInventoryAiPanel` 훅 (retire 후 inventory 미사용 검증)
- `reorderRecommendationsData` (recommendedQty forward)
- `openContextPanel`/`openReorderReview` (진입 라우팅)

---

## 6. Global Test Strategy

All phases must strictly follow Red-Green-Refactor. Sentinel = readFileSync + regex (CLAUDE.md 패턴).

**Test Strategy by Work Type:**
- UI wiring / CTA split → sentinel(source-level) + 회귀 0 describe 필수
- 모바일 reorder 표면 → mode 소비 + 재발주 섹션 렌더 sentinel
- AiAssistant retire → inventory 트리거 부재 + 파일 보존 + orphan(import/사용) 0 sentinel

**Execution Notes:**
- vitest/build는 operator 전담. sandbox는 "실행 불가" 표기, 무결성은 Grep 도구로 선검증.
- missed-sweep 방지: 구조/식별자 치환(onReorder→2-prop, preparePanel 제거) 시 그 구체 패턴을 `__tests__`에 직접 grep해 영향 sentinel 선식별.

---

## 7. Implementation Phases

#### Phase 0: Context & Truth Lock ✅ COMPLETE (2026-06-24)
**Goal:** 6 site × CTA 트리거 × 모바일/데스크탑 분기 전수 매핑 고정 + 종단 목적지 확정 + AiAssistant 사용처 전수 grep.
- Status: [x] Complete

**6-site 매핑 (확정):**
| # | L | 변수 | 표면 | 뷰포트 | 유형 | 목표 |
|---|---|---|---|---|---|---|
| 1 | 1431 | inventory | MobileInventoryView.onReorder | 모바일 | 진입 | openReorderReview(inventory) |
| 2 | 1981 | inventory | InventoryTable.onReorder | 데스크탑 | 진입 | openReorderReview(inventory) |
| 3 | 2265 | inv | 이슈얼럿 인라인 재발주 btn | 양쪽 | 진입 | openReorderReview(inv) |
| 4 | 2674 | match | MobileOperationalBriefSheet.primaryCta | 모바일 | 종단(mode 의존) | reorder mode→openReorderReviewSheet(match) |
| 5 | 2731 | match | InventoryContextPanel.onReorder | 데스크탑 | 공통(split) | 진입=mode전환 / 종단=openReorderReviewSheet(match) |
| 6 | 3234 | selectedItem | 상세 Sheet 재발주 검토 btn | 모바일/태블릿 | 진입 | openReorderReview(selectedItem) |

**Truth-lock 발견 (PLAN 방향 수정):**
- `InventoryAiAssistantPanel` = ⑴ 이슈분석 래퍼 + ⑵ **ReorderReviewSheet(§11.310)** = 실 재발주 검토(추천벤더 비교·예상금액·[견적 요청]quotes-live·[바로 발주]PO). API: `useReorderRecommendation`(§11.310b, PurchaseRecord 집계).
- ReorderReviewSheet는 AiAssistant 내부 state(`isReorderSheetOpen`)로만 열림 → ContextPanel/모바일 직접 오픈 불가 = **추출 필요**.
- Live render: inventory-content L4003. Legacy: inventory-main L3258(미라우트).
- 핀 sentinel: reorder-review-sheet-310, reorder-recommendation-api-310b, inventory-ai-panel-amber-removed-302d6a4a, 297e(prepareCount=MAIN/legacy 읽음→content 무관).
- 종단 목적지 = **ReorderReviewSheet(실재)**. 호영님 결정(2026-06-24): 추출 + ContextPanel/모바일 직접 오픈, "바로 발주"만 purchasing-off disabled+사유.

**✋ Quality Gate:** ✅ 6 site 매핑 미결 0, ✅ AiAssistant 사용처 확정(content live + main legacy), ✅ 종단 목적지·게이팅 확정
**Rollback:** planning-only; no code change

#### Phase 1: Contract & Failing Tests ✅ COMPLETE (2026-06-24)
**Goal:** 의도 동작을 sentinel로 고정(RED).
- Status: [x] Complete

**집행 방식 정정 (repo delta-0 규율):** 큰 RED 묶음을 여러 phase에 걸쳐 두면 baseline-delta>0가 누적됨 → repo 규율(누적 RED 0) 위반. 따라서 각 sentinel을 **자기 phase가 GREEN으로 동반**하도록 분산. Phase 1은 최소 실 계약 증분만 land:
- `MobileOperationalBriefSheet`에 `mode?: "detail"|"reorder"` prop + 헤더 eyebrow 분기(default detail = 회귀 0). 공유 컴포넌트 4 surface 거동 불변.
- sentinel: `__tests__/regression/inventory-reorder-surface-unify-p1.test.ts` (mode 계약 + 회귀 0: 운영 브리핑/aria-label/md:hidden/primaryCta/4 chips).
- ⓐ(ReorderReviewSheet 승격)·ⓒⓓⓔ(패널 split·6 site·발주 게이팅)·ⓕ(래퍼 retire)는 각 owning phase(P2/P3/P4)에서 sentinel+impl 동반.

**Files:**
- `src/components/operational-brief/mobile-bottom-sheet.tsx` — mode prop + eyebrow 분기
- `src/__tests__/regression/inventory-reorder-surface-unify-p1.test.ts` — 신규 sentinel

**✋ Quality Gate:** 기존 mobile-bottom-sheet sentinel 2개(`operational-brief-mobile-bottom-sheet`, `mobile-tab-switch-264a`)는 `/운영 브리핑/`·`aria-label="운영 브리핑"` 매칭 → 보존 확인(회귀 0). operator: vitest + build.
**Rollback:** mode prop 3-edit + sentinel revert

#### Phase 1 (원안 — 참고용): Contract & Failing Tests
**Goal:** 의도 동작을 sentinel로 고정(RED). [위 정정안으로 분산 집행]
- Status: [x] (재구성됨)

**🔴 RED:** sentinel 작성 — ⓐ content-level `ReorderReviewSheet` 승격(독립 state `reorderReviewItem`/`openReorderReviewSheet` + content render, AiAssistant 내부 state 비의존), ⓑ `MobileOperationalBriefSheet` `mode?: "detail"|"reorder"` prop + reorder 섹션, ⓒ `InventoryContextPanel` `onReorderEmphasis`/`onReorderProceed` 분리 prop (종단=ReorderReviewSheet 오픈), ⓓ content 6 site가 preparePanel 미호출 + 매핑표 핸들러 호출, ⓔ ReorderReviewSheet "바로 발주" purchasing-off disabled+사유 prop, ⓕ AiAssistant **분석 래퍼** inventory 트리거 부재. + 회귀 0(§11.310 reorder-review/api sentinel·라벨·dispose 우선·mode eyebrow 보존).
**🟢 GREEN:** prop/시그니처 스캐폴딩만(빈 구현).
**🔵 REFACTOR:** sentinel 네이밍·핀값 정리.

**✋ Quality Gate:** RED 실 실패 확인(operator), 기존 sentinel(panel-unify/297e/310/310b) baseline-delta 0, 297e prepareCount=MAIN(legacy) 무관 재확인
**Rollback:** sentinel/스캐폴딩 revert

#### Phase 2: Extract ReorderReviewSheet + Mobile Reorder Surface ✅ COMPLETE (2026-06-24)
**Goal:** ReorderReviewSheet를 content-level로 승격(독립 오픈 가능) + 모바일 시트 reorder 진입.
- Status: [x] Complete

**Land 내용:**
- `components/inventory/inventory-reorder-review-sheet.tsx` (신규) — `InventoryReorderReviewSheet` 래퍼: AiAssistant 비의존, `useReorderRecommendation`(벤더·최근구매) + `ReorderReviewSheet` 렌더. recommendedQty null/0 → data null(가짜 0 금지).
- `inventory-content.tsx` — `reorderReviewItem` state + `openReorderReviewSheet(item)` + `reorderRecommendedQtyFor`(canonical `/reorder-recommendations`, 데스크탑 L2708과 동일 소스) + 래퍼 content-level 렌더.
- `inventory-content.tsx` 모바일 브리프시트(L2632) — `mode={contextPanelMode}` 전달 + primaryCta를 canonical 기반 reorder 진입으로 교체(추천 있으면 `재발주안 검토 (N단위)` → openReorderReviewSheet, 없으면 disabled "재발주 권장 없음"). **preparePanel(AiAssistant) 제거 = site 4(모바일) 조기 rewire.**
- `__tests__/regression/inventory-reorder-surface-unify-p2.test.ts` (신규 sentinel).

**Phase 경계 정정:** PLAN 원안의 6-site rewire는 P3였으나, **site 4(모바일 primaryCta)는 "모바일 reorder 섹션"의 본체**라 P2로 이동. 잔여 5 site(1·2·3·5·6) + 패널 split + 발주 게이팅 = P3.

**✋ Quality Gate:** ReorderReviewSheet content 직접 오픈 작동(§11.310 sentinel 보존), 모바일 canonical 수량(가짜 0 금지)·dead button 0(추천 없으면 disabled), 297e prepareCount=MAIN(legacy) 무관, build EXIT 0
**Rollback:** 래퍼 파일 + content state/render/모바일 primaryCta revert (preparePanel 복원)

#### Phase 2 (원안 — 참고): Extract + Mobile
- Status: [x] (위로 집행)

**🔴 RED:** Phase 1 ⓐⓑ sentinel.
**🟢 GREEN:**
- content에 `reorderReviewItem` state + `openReorderReviewSheet(item)` 헬퍼 + `<ReorderReviewSheet>` 렌더. `useReorderRecommendation`(productName) 호출을 content/소형 래퍼로 이전(벤더·최근구매 주입). AiAssistant 내부 ReorderReviewSheet 경로와 공존(P4에서 래퍼 트리거만 정리).
- `MobileOperationalBriefSheet`에 `mode` prop + reorder 섹션(recommendedQty/사유, canonical 파생). content L2632 호출부 `mode={contextPanelMode}` + reorderQty forward. dispose 우선: 만료 lot이면 폐기 우선(재발주 보조).
**🔵 REFACTOR:** 데스크탑/모바일 reorder 표시 로직 공유분 추출(canonical 동일 소스, drift 0).

**✋ Quality Gate:** ReorderReviewSheet content 직접 오픈 작동(§11.310 sentinel GREEN 유지), 모바일 reorder 노출(loop 0), dispose 우선 보존, 빈/로딩 상태, build EXIT 0
**Rollback:** content state/render + 시트 mode revert

#### Phase 3: Panel CTA + Site Rewire + 발주 게이팅
**Goal:** 잔여 site rewire + ReorderReviewSheet "바로 발주" purchasing-off disabled+사유.
- Status: 🔄 P3a 완료(2026-06-24) / P3b 잔여

**설계 정정(P3a):** PLAN 원안의 패널 `onReorderEmphasis`/`onReorderProceed` prop split은 **불필요** — 패널 `onReorder` 단일 prop 유지하고 **content-side guard**로 no-op 차단. → `InventoryContextPanel` 무수정(restructure-320·panel-unify·rail-inventory sentinel 전부 보존).

**P3a Land (2026-06-24):**
- inventory-content.tsx 잔여 5 site rewire(`aiPanel.preparePanel` → 0건):
  - 진입 4: 모바일 리스트(L1442)·테이블 행(L1992)·이슈얼럿(L2245)·상세 Sheet(L3174) → `openReorderReview`(통합 패널 reorder mode, 항상 열림 = no-op 0).
  - 패널 proceed(site 5, onReorder): canonical qty 있으면 `openReorderReviewSheet`(승격 시트), 없으면 `setContextPanelMode("reorder")` flip(빈 시트/no-op 방지). §11.158 cache-bust 보존.
- sentinel: `inventory-reorder-surface-unify-p3a.test.ts`(preparePanel 0건 + 사이트별 라우팅 + guard).

**P3b Land (2026-06-24):** `ReorderReviewSheet` "바로 발주"(PO)에 `getFlag("ENABLE_PURCHASING")` 게이팅 — off 시 `disabled={!hasVendor || !purchasingOn}` + 정직 사유(`data-testid="reorder-review-purchasing-off"`, "발주 기능은 준비 중입니다…"). handleDirectPurchase 가드도 purchasing-off 포함. [견적 요청]·PO draft wiring·vendor-0 disable·amber 0 전부 불변(§11.310 보존). sentinel: `inventory-reorder-surface-unify-p3b.test.ts` 신규 + `reorder-review-sheet-310` L69 진화(`disabled={!hasVendor( || !purchasingOn)?}` — vendor-0 의도 보존).

**✋ Quality Gate (P3a):** preparePanel 0건, dead button/no-op 0(진입은 패널 항상 열림, proceed는 guard), §11.310 무손, build EXIT 0
**Rollback:** 5 site rewire revert (preparePanel 복원)

**🔴 RED:** Phase 1 ⓒⓓⓔ sentinel.
**🟢 GREEN:**
- `InventoryContextPanel`: `onReorder` → 진입 CTA(상태배너 재주문/우선소진 L613/622)=`onReorderEmphasis`(mode 전환), 종단 CTA(재발주안 검토 L672, 권장액션 reorder 실행 L1117)=`onReorderProceed`(=openReorderReviewSheet).
- content 6 site rewire(매핑표대로): 진입 1·2·3·6→openReorderReview; 종단 4(모바일 reorder mode primaryCta)·5(패널 proceed)→openReorderReviewSheet. preparePanel 전부 제거.
- `ReorderReviewSheet`: "바로 발주"(PO)에 purchasing-off 게이팅 prop(예: `purchasingEnabled=false` → disabled + "발주 기능 준비중" 사유). [견적 요청]·검토는 불변(live). §11.310 dead-button-0 규칙(벤더 0건 disabled)과 공존.
**🔵 REFACTOR:** same-canvas 유지, 중복 payload 제거.

**✋ Quality Gate:** dead button/no-op 0(바로발주 disabled=사유 있는 정직 상태), 견적요청 live 유지, front-only success 0, loading/error/empty/disabled 상태, mode eyebrow·dispose 우선 보존, §11.310/310b sentinel GREEN
**Rollback:** 패널 prop + 6 site wiring + 발주 게이팅 revert (preparePanel 복원)

#### Phase 4: AiAssistant Wrapper Retire + Smoke/Rollback ✅ COMPLETE (2026-06-24)
**Goal:** 대체 표면(P2·P3) 확인 후 inventory AiAssistant **분석 래퍼** 트리거 제거. ReorderReviewSheet는 보존(이미 content 승격).
- Status: [x] Complete

**Land (2026-06-24):** inventory-content.tsx에서 6 클러스터 retire — `useInventoryAiPanel` import, `InventoryAiAssistantPanel` dynamic import, `aiPanelParam`, `const aiPanel`, `?ai_panel` deep-link useEffect, `<InventoryAiAssistantPanel>` 렌더. **orphan 0**(content 내 aiPanel/useInventoryAiPanel/<InventoryAiAssistantPanel 참조 0, grep 확인). 보존: ReorderReviewSheet·InventoryReorderReviewSheet 래퍼·AiAssistant 컴포넌트 파일(rollback, inventory-main legacy가 여전히 import). sentinel: `inventory-reorder-surface-unify-p4.test.ts`(retire 4 + 보존 4). 297e prepareCount=MAIN(legacy) 무관.

**★ 회귀 봉합(baseline-delta 1건 — §11.381c):** P4 1차안이 `<InventoryAiAssistantPanel>`를 통째 retire하며 `onViewVendors`의 **소싱 검색 진입점(`/app/search?q=`)** 까지 inventory-content에서 소실 → §11.381c "inventory 소싱 진입점 유지" 위반(실 회귀, sentinel 정당). **(A) 재배치**로 봉합: 소싱 검색을 생존 표면 ReorderReviewSheet "추천 벤더" 섹션의 **공급사 검색** 액션(`data-testid="reorder-review-search-vendors"`)으로 옮김. `onSearchVendors` prop을 ReorderReviewSheet→래퍼→content로 통과, `/app/search?q=` URL 리터럴은 inventory-content에 유지(§11.381c 정합). retire ≠ 진입점 삭제 원칙 준수. (교훈: retire 시 클러스터 내 canonical 진입점을 grep으로 선식별해 동반 제거 방지 — Phase 0 risk에 적었으나 실행 누락, baseline-delta가 봉합.)

**🔴 RED:** Phase 1 ⓕ sentinel + `aiPanel`/preparePanel inventory 미사용 grep 기대.
**🟢 GREEN:** `<InventoryAiAssistantPanel>` 렌더(content L4003) 제거, `?ai_panel=` deep-link useEffect(L360) 제거, `useInventoryAiPanel` import/호출 제거(타 사용 0 확인). InventoryAiAssistantPanel·ReorderReviewSheet 컴포넌트 파일은 보존.
**🔵 REFACTOR:** 미사용 import/state 정리(unused 0).

**✋ Quality Gate:** `aiPanel`/preparePanel inventory 잔존 0, ReorderReviewSheet 정상(content 경로), unused/orphan 0, build EXIT 0, baseline-delta 0, 모바일+데스크탑 재발주 검토 smoke 통과
**Rollback:** 렌더/deep-link/import 복원 (파일 보존이라 즉시)

---

## 8. Optional Addenda

### A. Workflow / Ontology Addendum (적용)
touching: inventory reorder / dispose 우선순위.

**Resolver Input:** item(currentQuantity/safetyStock/expiryDate) + reorderRecommendations
**Expected Output:** 만료 lot+qty>0 → dispose 최우선(reorder 보조); 그 외 below-safety/소진 → reorder 검토

**Surface Rules:**
- same-canvas overlay/dock/sheet only, chatbot/terminal 금지
- expired-lot dispose가 generic reorder보다 먼저

**Validation:**
- [ ] 만료 lot 진입 시 폐기 우선 노출, reorder 보조
- [ ] below-safety/소진 진입 시 reorder 검토 노출
- [ ] 모바일/데스크탑 row CTA 정확
- [ ] 종단 proceed disabled 사유 정확

### D. Mobile Addendum (적용)
`MobileOperationalBriefSheet` (Expo 아님, 웹 모바일 시트지만 모바일 UX 원칙 적용).

**Must Include:** md:hidden 분기 유지 / reorder mode 표면 / 종단 disabled 사유 / 빈·로딩 상태

**Validation:**
- [ ] 모바일 재발주 진입 시 blank/loop 0
- [ ] reorder 섹션 canonical 수량 표기
- [ ] 종단 버튼 정직 상태(준비중 사유)

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 종단 proceed가 dead button처럼 보임 | Med | High | disabled + 명시 사유("발주 기능 준비중") = 정직 상태, no-op 아님. sentinel ⓓ로 강제 |
| 모바일/데스크탑 reorder 렌더 drift | Med | Med | canonical 동일 소스(reorderQty) + 표시 로직 공유 추출(P2 refactor) |
| AiAssistant retire 후 orphan/unused 빌드 경고 | Med | Med | P4 grep 선검증 + unused import 정리, 파일 보존 |
| dispose 우선 원칙 침범(reorder 먼저) | Low | High | Addendum A validation + 회귀 sentinel |
| 297e prepareCount sentinel 오해 | Low | Med | MAIN(inventory-main.tsx) 읽음 — content 무관, Phase1에서 재확인 |
| 핸드오프 가정과의 충돌 재발 | Low | Low | 본 PLAN이 #2 가정 대체 명시 |

---

## 10. Rollback Strategy

- If Phase 1 Fails: sentinel/스캐폴딩 revert (코드 영향 0)
- If Phase 2 Fails: 모바일 시트 mode 소비 + content forward revert
- If Phase 3 Fails: 패널 2-prop + 6 site wiring revert (preparePanel 복원 = P3b-1 직후 상태)
- If Phase 4 Fails: 렌더/deep-link/import 복원 (AiAssistant 파일 보존이라 즉시)

**Special Cases:** ENABLE_PURCHASING 복귀 시 종단 proceed disabled 해제 = flag 연동(별도 트랙). 각 phase는 독립 rollback.

---

## 11. Progress Tracking

- Overall completion: 100% (Phase 0~4 완료, operator 게이트 대기)
- Current phase: 완료 — operator P4 게이트 후 PLAN 종료
- Current blocker: 없음
- Next validation step: P4 operator 게이트(orphan 0 build typecheck + baseline-delta 0)

**Phase Checklist:**
- [x] Phase 0 complete
- [x] Phase 1 complete
- [x] Phase 2 complete
- [x] Phase 3 complete (P3a rewire + P3b 발주 게이팅)
- [x] Phase 4 complete (AiAssistant 분석 래퍼 retire, orphan 0)
- [ ] Phase 4 complete

---

## 12. Notes & Learnings

**Decisions (2026-06-24, 호영님 승인):**
- PLAN 생성 승인 완료.
- (초기) 종단 CTA = 검토까지 + 발주 disabled 정직 사유.
- **(Phase 0 후 수정) 종단 "재발주안 검토"의 실 목적지 = ReorderReviewSheet(§11.310 실재 기능: 벤더비교·견적요청 live). → ReorderReviewSheet 추출해 ContextPanel·모바일 직접 오픈, "바로 발주"(PO)만 purchasing-off disabled+사유.** 검토·견적요청은 작동(캡 손실 0).

**Blockers Encountered:**
- (없음)

**Implementation Notes:**
- 핸드오프 #2의 "8 site 일괄 reroute + retire" 가정은 모바일/종단 갭으로 무효 → 본 PLAN으로 대체.
- **Phase 0 핵심**: "AiAssistant"는 막연한 챗봇이 아니라 ReorderReviewSheet(실 재발주 검토 엔진)를 품은 래퍼. retire 대상은 분석 래퍼 트리거뿐, ReorderReviewSheet는 보존·승격.
- 종단 실 PO 발주 연결은 Out of Scope(ENABLE_PURCHASING 트랙). 본 PLAN은 "바로 발주" disabled 게이팅까지.
