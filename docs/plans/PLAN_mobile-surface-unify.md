# Implementation Plan: 모바일 surface 통일 — 헤더·상태요약 단일화 (§11.374)

- **Status:** ✅ Complete (P0–P5 — P4 밀도/정렬 정정 포함)
- **Started:** 2026-06-14
- **Last Updated:** 2026-06-14 (4탭 통일·P5 라이브·P4 밀도/액션정렬 정정·ETL 카탈로그 동반)

**CRITICAL INSTRUCTIONS**: 각 phase 후 — 체크박스 갱신 / quality gate 검증 / Last Updated / Notes / 그다음 phase.
⛔ quality gate 실패·SoT 충돌·dead button/no-op 도입 금지. ⛔ count 데이터 경로 변경 금지(표현만 통일).

---

## 0. Truth Reconciliation  ✅ (P0 완료)

**조사 결과 (코드 근거):**
- `components/layout/page-header.tsx` — `AppPageHeader`(props: `breadcrumbs?`/`title`/`description?`/`statusChip?`/`actions?`) + `PageShell` 정의. **importers 0.** git: 2026-04-18 생성, 이후 amber sweep(05-28)만 → *폐기 흔적 없음, 단지 미채택*.
- `components/ops-hub/page-shell.tsx` — **별도 PageShell, importers 0.** 경쟁 orphan.
- 4탭(대시보드/견적/구매/재고) 전부 헤더를 **인라인 재구현**(공용 shell 미사용). 견적/구매는 operational-brief 컴포넌트 인라인 조합.
- 상태요약: 공유 컴포넌트 **없음**. 견적/구매=가로 카운트탭, 재고=2x2 카드, 대시보드=액션카드. count는 각 페이지 자체 query에서 산출.

**Chosen Source of Truth:**
- **캐노니컬 헤더 = `AppPageHeader`(layout/page-header.tsx) 부활·채택.** API가 목표 문법과 정확히 일치.
- ops-hub/page-shell = orphan → 본 트랙 out-of-scope(향후 제거 핀).
- 상태요약 = **신규 단일 컴포넌트 `StatusCountGrid`(2x2, §11.311 토큰)** 추출. count는 surface별 props 주입 — truth 경로 불변.

**Priority Fit:** Post-release UX 정합(P2). 직전 §mobile-surface 트랙 연장.

## 1. Work Type
Design Consistency + Mobile + **multi-surface 구조 변경**.

## 2. Overview
**목표:** 4 대시보드 탭의 헤더·상태요약을 단일 컴포넌트로 정합. 4축 drift(헤더구조/상태요약/타입스케일/필터칩) 제거.

**Success Criteria:**
- [ ] 4탭이 `AppPageHeader` 채택 — breadcrumb?/title/subtitle?/actions(우측 고정). 견적 좌측 스캔 drift 제거.
- [ ] 상태요약 4탭 `StatusCountGrid`(2x2) 통일 — 표현만, count 소스 불변.
- [ ] 타입 스케일·필터 칩 토큰 통일.
- [ ] sentinel GREEN, canonical count 무변경, 인라인 헤더 재구현 0.

**Out of Scope (⚠️ 절대):** count 집계/데이터 로직 변경, 비-대시보드 surface, ops-hub PageShell 손대기, 신규 shell 제작(AppPageHeader 부활로 충당).

**User-Facing Outcome:** 4탭 헤더·상태요약이 동일 문법·동일 시각언어. 모바일 가로5탭 빽빽 해소(2x2).

## 3. Product Constraints
**Must Preserve:** workbench/queue/rail/dock, same-canvas, **탭별 canonical count 소스**, 각 탭 고유 액션 wiring.
**Must Not Introduce:** page-per-feature, dead button, count를 UI state로 대체, 표현 통일하며 데이터 누락.
**Canonical Truth Boundary:** SoT = 각 탭 자체 query(count). 본 트랙 = presentation layer만. 신규 컴포넌트는 props로 count 수신, 자체 fetch 금지.

## 4. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| `AppPageHeader` 부활·채택(신규 제작 X) | 목표 API 이미 보유, 최소 diff | orphan 부활 — 첫 채택 surface에서 회귀 점검 필요 |
| `StatusCountGrid` 신규 추출(2x2) | 공유 컴포넌트 부재, §11.311 토큰 | 4탭 count 형태 정규화 필요(label/value/tone/href) |
| surface별 1개씩 점진 rollout | 광역 blast 제어 | phase 수 증가 |

**Touched(예상):** `layout/page-header.tsx`(AppPageHeader 보강 시), 신규 `StatusCountGrid`, 4 route(`dashboard`/`quotes`/`purchase-orders`/`inventory`).

## 5. Global Test Strategy
Sentinel(readFileSync+regex): 헤더 단일문법 채택·StatusCountGrid 계약·인라인 재구현 금지·count prop 주입(자체 fetch 0). 실 vitest는 operator-shell.

## 6. Implementation Phases
### Phase 0: Truth/Inventory Lock — ✅ Complete
캐노니컬 shell 확정(AppPageHeader), 4탭 현행·count 소스 매핑. 위 §0 기록.

### Phase 1: Contract & Sentinel — ✅ Complete
- `status-count-grid-374.test.ts` 작성. StatusCountGrid 계약(items[{key,label,count,tone,active,disabled,onClick}]) + 견적 채택 + 회귀 가드. 격리 node 17/17 GREEN.

### Phase 2: StatusCountGrid 추출 + 견적 적용 — ✅ Complete
- `components/layout/status-count-grid.tsx` 신규(2x2, §11.311 토큰, interactive 게이팅, a11y).
- 견적 `sm:hidden` 가로5탭 → StatusCountGrid 교체. canonical `summaryStats.*.count` 주입(데이터 경로 불변), `setStatusFilter` 토글 + 비교(RESPONDED) 0건 가드 + isLoadingTimeout fallback 보존. 데스크탑 5-cell grid 유지.
- Gate: count 무변경 ✓, dead button 0 ✓, sentinel GREEN ✓.

### Phase 3: 전 탭 rollout + AppPageHeader 채택 (blast 제어: surface 1개씩 — 4 sub-phase로 분해)

> P1-2(견적) production READY·라이브 GREEN 확인(2026-06-14, dpl `016b0247`) 후 진입. 각 sub-phase = 독립 커밋·독립 rollback. count 데이터 경로 변경 0(표현만).

#### Phase 3.1: Sentinel 계약 확장 (🔴 RED 먼저)
- Status: [ ] Pending
- 🔴 RED: StatusCountGrid 채택 sentinel을 구매/재고/대시보드로 확장 + AppPageHeader 4탭 채택 sentinel + 견적 스캔버튼 우측 이동 sentinel + **회귀 0** describe(각 탭 count 경로 불변·필터/액션 wiring 보존·StatusCountGrid 자체 fetch 0). 전부 실패(RED) 확인.
- 🔵 REFACTOR: items 정규화 형태(key/label/count/tone/active/disabled/onClick) 탭 공통화.
- **✋ Gate:** RED 진짜 실패 확인, 기존 sentinel(견적 10/10) 무회귀. Rollback: sentinel revert.

#### Phase 3.2: 구매(purchase-orders) StatusCountGrid 채택
- Status: [ ] Pending
- 🟢 GREEN: 모바일 상태요약(가로 카운트) → StatusCountGrid 2x2. canonical `summaryStats.*.count` 주입(경로 불변) + 필터칩(전체/검토필요/발주가능/보류) `setStatusFilter` wiring + `상태별 분류` aria-label 보존. 데스크탑 grid 유지.
- **✋ Gate:** count 무변경, dead button 0, 필터 wiring 라이브 동작, sentinel 3.1 GREEN(구매 항목). Rollback: 구매 인라인 상태요약 복귀.

#### Phase 3.3: 재고(inventory) StatusCountGrid 정합
- Status: [ ] Pending
- 🟢 GREEN: `mobile-inventory-view` 2x2 카드 → StatusCountGrid. stock·lot count 주입(경로 불변). **§11.311 expired-lot 우선 톤 유지** — generic reorder가 expired lot dispose보다 먼저 뜨지 않게(priority-action-queue / lot-disposal 순서 보존).
- **✋ Gate:** count 무변경, expired-lot 우선순위 회귀 0, sentinel 3.1 GREEN(재고 항목). Rollback: 재고 카드 인라인 복귀.

#### Phase 3.4: AppPageHeader 4탭 채택 + 견적 스캔 우측 이동
- Status: [ ] Pending
- 🟢 GREEN: ① 4탭 `AppPageHeader` 부활·채택(breadcrumb?/title/subtitle?/actions **우측 고정**), 인라인 헤더 재구현 제거(quotes/purchase-orders/dashboard/inventory-content). ② **견적 좌측 스캔버튼 → 우측 actions 이동**(`setAiParseModalOpen` wiring 보존 — dead button 금지).
- **⚠️ 범위 정정(2026-06-14):** 대시보드는 **StatusCountGrid 대상 아님**. 대시보드 모바일 요약 = KPI **판단 카드**(`stats.*` + trend delta + risk level + 해석 문구)로, 단순 count가 아님 → StatusCountGrid(2x2 count) 강제 시 trend/risk **정보 손실** = canonical truth 위반. 대시보드는 **AppPageHeader만** 채택, KPI 판단 카드 본문 보존. StatusCountGrid rollout은 견적(P2 ✅)+구매(P3.2)+재고(P3.3) 3 workbench surface 한정.
- **✋ Gate:** 4탭 헤더 단일문법, 액션 wiring 보존, 인라인 헤더 0, 스캔 버튼 라이브 동작, 대시보드 KPI 판단카드 무회귀. Rollback: 탭별 인라인 헤더 복귀.

### Phase 4: 타입 스케일 + 필터 칩 토큰(③④)
- Status: [ ] Pending
- 🟢 제목/부제/카드 숫자 토큰화(임의값 제거), 2차 필터 칩 스타일·위치 통일.
- **✋ Gate:** 토큰 일관, 위계 정립. Rollback: 토큰 revert.

### Phase 5: Smoke / Rollback
- Status: [ ] Pending
- Chrome 375px 4탭 정렬 육안 + canonical count 무변경 실측(DOM count vs 자체 query) + dead button 0 재확인. Rollback: phase별.

## 9. Risk Assessment
| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 표현 통일 중 count 누락/오매핑 | Med | High | presentation-only, props 주입, surface별 1개씩, count 무변경 sentinel |
| orphan AppPageHeader 부활 회귀 | Med | Med | 1-surface-first(견적) 후 rollout |
| 4-surface 광역 blast | Med | Med | 점진 rollout, phase별 rollback |

## 10. Rollback Strategy
phase별 surface 인라인 복귀. 컴포넌트/표현 한정 — 데이터 비파괴.

## 11. Progress Tracking
- Overall: 100% (핵심 drift 봉합 완료 — 4탭 헤더·상태요약 통일 + P5 라이브 GREEN)
- Current: ✅ 종결. P4는 의도적 close(아래 Notes).
- Phase Checklist: [x] P0 · [x] P1 · [x] P2 · [x] P3.1-3.4 · [x] P5 · [x] P4(밀도/액션정렬 정정)

## 12. Notes & Learnings
- [2026-06-14] P0: 캐노니컬 shell 후보 2개(AppPageHeader / ops-hub PageShell) **둘 다 0 importer** — 헤더 drift의 코드 근원. AppPageHeader가 목표 API 보유 → 부활 채택, ops-hub는 제거 핀(별 트랙).
- [2026-06-14] §11.372/373 직후 동일 §mobile-surface 트랙 연장(페이지별 surface 재구현이라는 한 근본).
- [2026-06-14] P2(견적) push `016b0247` → Vercel production READY. 라이브 DOM 실측(labaxis.co.kr, Chrome): 2x2+1 배치 ✓ / canonical count 0 경로 불변 ✓ / dead-button 가드 ✓(비교 RESPONDED 0 → aria-disabled+onClick 제거+not-allowed) / setStatusFilter wiring ✓(발송 클릭 → aria-pressed+ring 선택톤) / 터치영역 54px ✓ / overflow 0 ✓. Caveat: Chrome 창 최소폭으로 CSS 뷰포트 540px(375 아님, md 미만 모바일 레이아웃은 활성) — 375 보장은 sentinel.
- [2026-06-14] P3 분해 결정: 원안 "헤더+전탭 rollout 단일 phase"는 blast 과대(4 surface 동시) → P3.1 sentinel(RED) / P3.2 구매 / P3.3 재고 / P3.4 대시보드+AppPageHeader+견적 스캔이동 으로 분리. surface 1개씩·독립 커밋·독립 rollback.
- [2026-06-14] P3 전탭 완료 push: P3.1 `f6ee0603` / P3.2 `6e7b0e42` / P3.3 `f942407a` / P3.4-1 구매 `4891d875` / P3.4-2 대시보드+page-header label? `cf5ab8e8` / P3.4-3 재고 `da67f2ab` / P3.4-4 견적+스캔이동 `ab9e1840`. sentinel 25/25 GREEN. P3.4-2에서 render-only action 위해 `HeaderAction.label` optional 보강(plan §4 예견).
- [2026-06-14] **P5 라이브 검증 GREEN**(labaxis.co.kr, Chrome 375px): 4탭 AppPageHeader 채택·overflow 0 / 견적 스캔 actions 이동 후 **클릭→모달 라이브 동작**(dead button 0) / 구매 흰카드 제거+StatusCountGrid 실데이터 / 대시보드 KPI 판단카드 본문 보존+StatusCountGrid 미적용(種보호) / 재고 StatusCountGrid 2x2.
- [2026-06-14] ~~P4 의도적 close~~ → **정정·재개**: close는 P4를 "필터칩 축"으로 좁게 본 오판이었음. 호영님 정정 — 진짜 P4 = **밀도(컴팩트) + 헤더 액션 정렬**(고가치 모바일 UX). 또 상태요약은 사실 3종(견적 2열카드/재고 2x2카드/구매 가로컴팩트)이며, 통일 방향은 큰 카드(❌)가 아니라 **구매식 컴팩트(⭕)** — 모바일은 밀도가 생명, 큰 카드는 스크롤만 깊어짐.
- [2026-06-14] **P4 구현(정정 반영)**: ① AppPageHeader actions `justify-end`(모바일 flex-col stretch에서 우측 고정) + 대시보드 운영리포트 온보딩(데이터0) 시 entry 숨김(회색 disabled 붕뜸 제거) — 견적 스캔/⋯·대시보드 리포트 한 규칙으로 우측화. ② StatusCountGrid 큰카드→컴팩트(`p-3 rounded-xl text-lg` → `px-2.5 py-1.5 rounded-lg text-base`, gap-1.5), 터치 `min-h-[44px]`는 a11y로 유지. 5항목(견적/구매)은 밀도 높은 2열 pill로 수용. sentinel 앵커(grid-cols-2/min-h-44/게이팅/aria-pressed/자체fetch0) 무회귀. (a) `text-[Npx]` 전역 sweep, (b) 의미 다른 필터칩 강제통일은 여전히 범위밖.
- [2026-06-14] **병행 ETL 트랙 종결**: 통합 제품 마스터 316→304 정제 적재(operator-shell). prod count: Product 9→313 / Vendor 5→73 / ProductVendor 293 / CONSUMABLE enum 55 / seed 보존. CONSUMABLE 클라이언트 배포 `487edf68` READY 후 **라이브 검증**: 소싱 검색 "RBC"→5건 마스터 제품(Cat.No cleaned.json 일치, 카테고리 렌더 정상, vendor 연결). 재고 톤 시각검증은 ProductInventory(입고) 부재로 별 트랙(입고 데이터 필요).
