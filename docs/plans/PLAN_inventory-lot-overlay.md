# Implementation Plan: #inventory-lot-overlay — Lot 추적 same-canvas overlay (P5)

- **Status:** ⏳ Pending
- **Started:** 2026-07-10
- **Last Updated:** 2026-07-10
- **Estimated Completion:** TBD (Large, 5 phases)
- **Tracker:** inventory-redesign P5 (`docs/plans/PLAN_inventory-redesign.md`)

**CRITICAL INSTRUCTIONS** — 각 phase 완료 시:
1. ✅ 체크박스  2. 🧪 quality gate  3. ⚠️ gate 통과  4. 📅 Last Updated  5. 📝 Notes  6. ➡️ 다음 phase

⛔ quality gate 실패 / SoT 충돌 미해결 / dead button·no-op·placeholder success 도입 시 진행 금지.
⛔ same-canvas 유지 — **새 route 금지**. page-per-feature 회귀 금지.
⛔ 다건출고 실행 버튼 = **정직-disabled**. 원자성 없는 N회 반복 호출로 가짜 일괄출고 금지(GMP truth 위반).

---

## 0. Truth Reconciliation

**Latest Truth Source (실측 2026-07-10):**
- `apps/web/src/app/dashboard/inventory/inventory-content.tsx` — **Lot 추적 탭 이미 존재**(L2334~2560, 인라인). 요약카드 필터(all/active/expiring_soon/expired+depleted)·FEFO(`sortLots`)·상태색·검색·모바일카드/데스크탑표 완비.
- `apps/web/src/lib/inventory/lot-tracking-engine.ts` — 엔진 완성: `LotRecord`·`LotEvent`(receive/use/move/adjust/dispose)·`LotSummary`·`computeLotStatus`·`sortLots`(FEFO)·`computeLotSummary`·`filterLotsByStatus`·`searchLots`·`getLotStatusLabel`·`getLotStatusColor`.
- `apps/web/src/components/inventory/lot-disposal-panel.tsx` — 객체 스코프 폐기 dock 라이브. `disposeLotMutation` 배선(content L617).
- 실 lot truth = `InventoryRestock`(입고 lot·`restockedAt`·`lotNumber`·`expiryDate`·`quantity`), `InventoryUsage`(사용 차감·`lotNumber`). `/api/inventory/route.ts`·`scan/route.ts`에 `restockRecords` 노출. `/api/inventory/[id]/use/route.ts` = 단건 출고(use) 배선됨.
- `generateMockLots` — context-panel에서 **이미 제거됨**(regression `inventory-lot-coa.test.ts` L54 강제).

**Conflicts Found:**
- ⚠️ **E1 — 가짜 타임스탬프:** 현 Lot 탭 `allLots` 합성 시 `receivedAt: Math.random()*90일`(L2408), `lastEventAt: Math.random()*14일`(L2412) = **랜덤 생성값**. canonical truth 위반(preview가 truth 덮음).
- ⚠️ **E2 — 합성 lot:** `allLots` = `displayInventories` 1행=1 lot 합성 → **실 `InventoryRestock` 아님**. 한 품목 다중 입고 lot 미반영.
- ⚠️ **E3 — 타임라인 이벤트 소스 없음:** `LotEvent` 타입만 존재, 실 배선 0.

**Chosen Source of Truth:**
- Lot 목록·잔량·유효기간·입고일 = `InventoryRestock`(품목당 다중 lot).
- 타임라인 이벤트 = receive(`InventoryRestock.restockedAt`) + use(`InventoryUsage`, 이미 배선) + dispose(disposal note/mutation). move/adjust는 실소스 없으면 미표시(가짜 이벤트 금지).
- Math.random 산출값 = 전량 제거. 실 timestamp 없으면 "—" 표기(허위 날짜 금지).
- **근거:** 실코드 확인 완료. E1/E2/E3는 P0에서 restockRecords 클라 유입 shape 재확인 후 최종 확정.

**Environment Reality Check:**
- [x] repo/branch: main
- [x] runnable: sandbox = 편집 + node 정규식 사전검증만. build/vitest/push = 클로드코드 operator 단독.
- [x] execution blockers: prod DB·공유 node_modules 설치 금지(DEV_RUNBOOK §9.9).

## 1. Priority Fit

**Current Priority Category:**
- [x] Post-release (inventory-redesign P5, ~60% done의 다음 항목)
- [ ] P1 immediate  [ ] Release blocker  [ ] P2/Deferred

**Why This Priority:**
호영님 2026-07-10 세션 확정 착수 항목. 상위 P1 충돌 없음(핸드오프 §3). P0~P4 완료 후 잔여 표면. 단 E1(Math.random) = 라이브 가짜 데이터이므로 truth remediation 성격 병행.

## 2. Work Type

- [x] Feature (same-canvas overlay 승격)
- [x] Bugfix / Truth remediation (Math.random 제거·실 배선)
- [ ] API Slimming / Workflow-Ontology / Migration / Billing / Mobile-only / Web-only / Design

## 3. Overview

**Feature Description:**
기존 인라인 Lot 추적 탭을 same-canvas 풀스크린 overlay로 승격하고, 그 기반 데이터를 Math.random 합성 → 실 `InventoryRestock`/`InventoryUsage`로 배선한다. lot 선택 시 실 `LotEvent` 타임라인(receive/use/dispose)을 노출. 다건출고 선택 UI는 그리되 실행은 정직-disabled(배치 API 별트랙).

**Success Criteria:**
- [ ] Lot 탭에서 `Math.random` 기반 `receivedAt`/`lastEventAt` 제거(sentinel 강제)
- [ ] lot 목록이 실 `restockRecords` 소비(품목당 다중 lot 반영)
- [ ] 필터·FEFO·검색이 실데이터 위에서 동작
- [ ] same-canvas 풀스크린 overlay(새 route 없음)에서 Lot 추적 노출
- [ ] lot 선택 시 실 이벤트 타임라인(receive+use 최소, dispose 있으면 포함)
- [ ] 다건 선택 UI 존재 + 일괄출고 실행 버튼 disabled + 사유 툴팁("일괄 출고는 배치 API 배선 후 제공")

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 다건 배치 출고 서버 mutation (별트랙)
- [ ] move/adjust 이벤트 소스 신설
- [ ] `quarantine_status` 스키마 신설(현 0 fallback 유지)
- [ ] 새 route/페이지

**User-Facing Outcome:**
Lot 추적을 넓은 캔버스에서 실데이터로 보고, lot별 실 이력 타임라인을 확인. 일괄출고는 "준비중"으로 정직 표기(가짜 성공 없음).

## 4. Product Constraints

**Must Preserve:**
- [ ] workbench/queue/rail/dock  [ ] same-canvas  [ ] canonical truth  [ ] invalidation discipline(disposeLot/use 후 재조회)

**Must Not Introduce:**
- [ ] page-per-feature  [ ] chatbot/assistant 재해석  [ ] dead button/no-op/placeholder success  [ ] fake billing/auth  [ ] preview가 truth 덮기(=Math.random 재발)

**Canonical Truth Boundary:**
- Source of Truth: `InventoryRestock`·`InventoryUsage`(+disposal note)
- Derived Projection: `LotRecord[]`·`LotSummary`(엔진 산출)
- Snapshot/Preview: overlay 표시 상태(선택·필터) — truth 아님
- Persistence Path: use=`/api/inventory/[id]/use`, dispose=`disposeLotMutation`. 다건출고=미배선(disabled).

**UI Surface Plan:**
- [x] 풀스크린 same-canvas overlay(기존 Dialog/overlay 패턴 재사용, 새 route X)
- [ ] New page (금지)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 인라인 탭 → 풀스크린 overlay 승격 | 넓은 캔버스·타임라인 병치, same-canvas 유지 | overlay open/close 상태 관리 추가 |
| lot 소스 = restockRecords | 실 truth·다중 lot 반영, Math.random 제거 | restockRecords 클라 유입 shape 의존(P0 확인) |
| 다건출고 disabled + 별트랙 | 원자성 없는 반복 호출 = 부분출고 위반(GMP) | 일괄출고 UX는 후속 |

**Dependencies:**
- Required Before Starting: P0 restockRecords 클라 shape 확인
- External Packages: 없음(설치 금지)
- Touched: `inventory-content.tsx`(주), `lot-tracking-engine.ts`(필요시 event 매핑 헬퍼), sentinel 신규

**Integration Points:**
- `/api/inventory`(restockRecords) · `/api/inventory/[id]/use`(use 이벤트·단건출고) · `disposeLotMutation`(dispose)

## 6. Global Test Strategy

Red-Green-Refactor 준수. 실행 = 클로드코드 operator(sandbox는 정규식 사전검증).
- Truth remediation → sentinel(readFileSync+regex): `Math.random` 금지·`restockRecords` 소비·타임라인 실이벤트·다건출고 disabled 강제
- User-visible flow → smoke path 문서화(operator)
- 회귀 0 describe 필수(기존 필터/검색/FEFO/폐기 배선 보존)

## 7. Implementation Phases

### Phase 0: Context & Truth Lock ✅
**Goal:** restockRecords 클라 유입 shape·LotEvent 실소스 매핑 확정. 코드 0.
- Status: [x] Complete (2026-07-10)

**실측 확정:**
- **Lot 소스** = 메인 `GET /api/inventory` findMany(route.ts L131) include `restockRecords`(L147 select: id/lotNumber/expiryDate/quantity/restockedAt, orderBy restockedAt desc). `inventories[].restockRecords` **런타임 유입 확인** — 클라 `ProductInventory` 타입(content L104) **미선언 → 타입 필드 추가 필요**. 별도 per-item fetch 불필요(N+1 없음). 품목당 다중 lot 반영 O.
- **receivedAt** = `restockRecord.restockedAt`(실). → content L2408 `Math.random()*90일` 제거 대상.
- **lastEventAt** = max(해당 item restockedAt들, 해당 item usageDate들)(실). → content L2412 `Math.random()*14일` 제거 대상.
- **use 이벤트** = 글로벌 `GET /api/inventory/usage?limit=100` → `usageData.records`(usageDate·quantity·inventory.id·user). content L689~ 이미 로드.
- **usage lotNumber:** 정본 스키마 `InventoryUsage`에 `lotNumber String?` **존재**(+`type` "DISPATCH"|"USAGE"·destination·operator). usage route(`/api/inventory/usage`)는 top-level `select` 없이 `include`만 사용 → **lotNumber 포함 전 scalar 이미 payload 반환 중**. ∴ **API 변경 불필요, 클라 `usageData` record 타입에 `lotNumber`(+ `type`) 노출만**(P2). 마이그레이션·조인 없음. (worktree 스키마엔 lotNumber 없었으나 stale — 정본 apps/web/prisma 기준.)
- **dispose** = persisted list 쿼리 없음 → 타임라인 receive+use 중심. 폐기는 현 `lot-disposal-panel`(disposeLotMutation) 유지.
- **move/adjust** = 실소스 0 → 타임라인 미표시(가짜 이벤트 금지).

**결정(호영님 2026-07-10):** (a) usage select `lotNumber` 추가로 per-lot use 타임라인 정밀. **가드: lotNumber=null 과거 usage 레코드는 lot 귀속 불가 → item 스코프 "이 품목 사용"으로 정직 표기, 특정 lot 타임라인엔 미포함.** (a 정밀도 + b 정직성 동시 확보).
- ✋ Quality Gate: 충돌 미해결 0·가짜 소스 가정 0. ✅ 통과.
- Rollback: planning-only.

### Phase 1: Contract & Failing Tests ✅
**Goal:** sentinel로 실패 가시화.
- Status: [x] Complete (2026-07-10)
- 🔴 RED: sentinel 작성 완료 — `apps/web/src/__tests__/regression/inventory-lot-overlay-p5.test.ts`. 앵커: (1) receivedAt/lastEventAt Math.random 제거 (2) `restockRecords?` 타입 + `.restockRecords` 소비 (3) usage 타입 `lotNumber` + testid `lot-event-timeline` (4) testid `lot-tracking-overlay` + 신규route 금지 (5) `data-lot-bulk-dispatch-disabled` + 사유문구.
- 🟢 GREEN: 회귀 describe(필터/FEFO/검색/요약/4분류/폐기배선) 작성.
- 🔵 REFACTOR: 앵커 토큰 확정(구현이 맞출 정확 문자열).
- ✋ Quality Gate: sandbox 정규식 사전검증 = 미구현 9 RED FAIL, 신규route가드+회귀 7 GREEN PASS. ✅ (build/vitest 실행 = operator 게이트.)
- Rollback: sentinel revert.

**⚠️ operator 주의:** 이 sentinel은 Phase 2/3 구현 전 RED 상태가 정상. Phase 3 완료 전 baseline 게이트에 넣지 말 것(구현 완료 후 GREEN 전환 시 add).

### Phase 2: 실 lot 데이터 배선 ✅
**Goal:** allLots 합성(Math.random) → restockRecords 기반 LotRecord[].
- Status: [x] Complete (2026-07-10)

**결정(호영님 2026-07-10) — (A) 하드 truth만:** lot 카드 = 입고량(restock.quantity)·입고일(restockedAt)·유효기간. **lot별 잔량 미표기**(정밀 추적 전까지 가짜 재고 truth 방지). 만료 판정=expiry. 품목 총 현재고=품목관리 canonical. 소진=타임라인 use 이벤트로만. 향후 usage.lotNumber 충분 축적 시 (B) "입고량−귀속usage" 정밀 잔량 승격(현재 미구현).

**구현:**
- `lot-tracking-engine.ts` LotRecord에 `receivedQty?: number|null` 추가(표시용 입고량, null="—"). qtyOnHand=status 구동용.
- content ProductInventory에 `restockRecords?`, usageData record에 `lotNumber`/`type` 타입 추가(API 무변경).
- lot 빌드: `displayInventories.flatMap` — restockRecords 있으면 입고건당 1 lot(receivedQty=r.quantity, receivedAt=r.restockedAt, expiry=r.expiryDate??inv.expiryDate). 없고 lotNumber만 있으면 fallback lot(receivedQty=null→"—", 커버리지·pilot 보존).
- lastEventAt = max(receivedAt, 해당 lot 귀속 usage 최신). usage.lotNumber 정확매칭만(null 미귀속 제외).
- 표시: 데스크탑 헤더 잔량→입고량, qty 셀·모바일 카드 receivedQty guard("—"), lastEventAt "" guard("—").
- ✋ Quality Gate: sandbox 검증 — Phase2 5항목 PASS, Phase3 4항목 RED 유지, 회귀 6항목 PASS. 실사용 Math.random 0. ✅ (build/vitest=operator.)
- Rollback: 합성 로직 복원.

**⚠️ 커버리지 노트(호영님 확인 요망):** restockRecords·lotNumber 둘 다 없는 품목은 Lot 추적 미노출(정직 — 입고 lot 없음). 입고 이력 없이 lotNumber만 있는 품목은 입고량 "—" fallback으로 노출.
- 🔴 RED: LotRecord 매핑 유닛(restockRecord → LotRecord).
- 🟢 GREEN: displayInventories 합성 제거 → restockRecords 매핑. receivedAt=restockedAt, lastEventAt=실 최신 이벤트(없으면 null→"—"). **`ProductInventory` 타입에 `restockRecords?` 추가. `usageData` record 타입에 `lotNumber`(+`type`) 추가(API 무변경, include로 이미 반환 중).** FEFO·필터·검색 실데이터 재검증.
- 🔵 REFACTOR: 매핑 헬퍼 lot-tracking-engine 이전 검토.
- ✋ Quality Gate: Math.random 0·truth boundary 위반 0·overfetch/N+1 0.
- Rollback: 합성 로직 복원(Phase1 상태).

### Phase 3: 풀스크린 overlay + 실 타임라인 + 다건출고 disabled ✅
**Goal:** 인라인 탭 → same-canvas 풀스크린 overlay, lot 선택 시 실 타임라인, 다건 선택 UI + 정직-disabled.
- Status: [x] Complete (2026-07-10)

**구현:**
- lot 계산 `lotView` useMemo 승격(탭·overlay 공유). `buildLotTimeline(lot)` 헬퍼 = receive(restockRecords by lotCode) + use(usageRecords by inventory.id + lotNumber 정확귀속만). state `isLotOverlayOpen`·`lotMultiSelect`.
- 탭: "전체 화면" 버튼(Maximize2) → overlay open. 안전장치 힌트 줄(uncoveredCount>0 시 "입고 lot 기록 없어 추적 안 되는 품목 N개(현재고 있음)").
- overlay(`data-testid="lot-tracking-overlay"`, `fixed inset-0 z-50`, 새 route X): 헤더+닫기, 필터칩, 검색, lot 리스트(체크박스 다건선택), 우측 타임라인(`data-testid="lot-event-timeline"`) receive/use 실이벤트 + "과거 미귀속 사용은 품목 단위" 안내.
- 다건선택 시 하단바: 일괄출고 버튼 `disabled` + `data-lot-bulk-dispatch-disabled` + title "일괄 출고는 배치 API 배선 후 제공" + "(준비중)".
- ✋ Quality Gate: sandbox TS 파서 구문 0 에러, sentinel 9 GREEN, 회귀 6 보존. ✅ (build/vitest=operator.)
- Rollback: overlay/타임라인/state revert(인라인 탭 복원).

**🛑 사고·복구 기록(operator 필독):** Phase 3 편집 중 `inventory-content.tsx`가 InventoryCard 중간(구 L4481)에서 **절단되어 꼬리 ~383줄 소실**(파일 truncation, Edit 도구 이상 추정). TS 파서 `parseDiagnostics`로 감지(CardContent/Card/motion.div 미close). HEAD 기준 꼬리를 스티칭 복원(내 편집분은 전부 절단 지점 이전이라 온전). 복원 후 4864줄·구문 0. **operator는 push 전 `npm run build` + 전체 vitest로 재확인 필수**(sandbox는 파서 구문검증까지만).
- 🔴 RED: overlay open/close·타임라인 렌더·다건출고 disabled 통합/렌더 테스트.
- 🟢 GREEN: overlay 승격(새 route X). lot 선택 → LotEvent 타임라인(receive=restockRecords by lotNumber, use=usageRecords by inventory.id+lotNumber). **use 레코드 lotNumber=null이면 특정 lot 타임라인 제외, item 스코프 "이 품목 사용"으로만 표기.** 다건 체크박스 선택 UI + 일괄출고 버튼 disabled + 툴팁.
- 🔵 REFACTOR: same-canvas 정합·중복 제거·loading/error/empty/disabled 상태.
- ✋ Quality Gate: dead button/no-op 0·front-only success 0·상태 4종 존재·same-canvas 보존.
- Rollback: overlay 승격 revert(인라인 탭 복원).

### Phase 4: Rollout / Smoke / Rollback ✅ (sandbox 완료 — operator 게이트 대기)
**Goal:** 안전 릴리스 확인.
- Status: [x] sandbox 준비 완료 (operator build+vitest+push 대기)

**Phase 4b — build-fix 라운드(operator 게이트 1차 실패→해소, 2026-07-10):**
- 1차 build FAIL: `inventory-content.tsx` `restocks.map((r)=>)` implicit any(strict). → `displayInventories.flatMap((inv: ProductInventory)=>)` 타입 명시(operator 적용).
- 2차 build FAIL(진짜 원인): `InventoryTable.tsx` L55 `ProductInventory.restockRecords` 에 `restockedAt` 누락 → `setEditingInventory` 타입 불일치. → InventoryTable 타입에 `restockedAt: string` 추가(두 선언 정합). 데이터 truth: `/api/inventory` L147 select `restockedAt: true` 실반환 확인(가짜 아님).
- 🛑 **truncation 재발 3건 누적**(content·engine·InventoryTable) — **Edit 계열 도구가 이 대형/멀티바이트 파일 편집 시 꼬리를 절단함**(operator 도구도 동일: 주석 1줄 편집이 content 꼬리 절단). sandbox는 bash writeFileSync 스티칭으로 복구(신뢰). **operator 필독: 이 파일들은 Edit 패치 대신 전체 재기록 또는 편집 직후 tail+build 재확인 필수.**
- 변경 파일 확정(5): inventory-content.tsx · InventoryTable.tsx · lot-tracking-engine.ts · inventory-lot-overlay-p5.test.ts · PLAN. (usage/route.ts 무변경 — add 제외.)

**변경 파일(4):**
- `apps/web/src/lib/inventory/lot-tracking-engine.ts` — LotRecord `receivedQty?` 추가(+truncation 복구).
- `apps/web/src/app/dashboard/inventory/inventory-content.tsx` — 실 배선·overlay·타임라인·다건disabled·힌트(+truncation 복구).
- `apps/web/src/__tests__/regression/inventory-lot-overlay-p5.test.ts` — 신규 sentinel(구현 후 GREEN).
- `docs/plans/PLAN_inventory-lot-overlay.md` — 본 계획.

**Smoke path(호영님 배포 후 눈으로):**
1. 재고 → Lot 추적 탭: 실 lot 표시(입고량·입고일·유효기간), 잔량 숫자 없음.
2. "전체 화면" → overlay 열림, 필터칩·검색 동작.
3. lot 선택 → 우측 타임라인 receive(입고)+use(사용) 실이벤트.
4. 다건 체크 → 하단 "일괄 출고" disabled + "(준비중)"·툴팁.
5. 입고 lot 없는 현재고 품목 있으면 상단 힌트 줄 노출.
6. 폐기 dock(disposeLotMutation) 정상.

- ✋ Quality Gate: sandbox = TS 파서 구문 0(4파일)·sentinel 9 GREEN·회귀 6 보존. **operator = `npm run build` + 전체 vitest 필수**(truncation 사고 있었음).
- Rollback: 단일 커밋 revert. overlay만 문제면 "전체 화면" 버튼 제거로 부분 무력화 가능(탭은 유지).

**🛑 truncation 사고 2건(operator 필독):** `inventory-content.tsx`(꼬리 383줄)·`lot-tracking-engine.ts`(꼬리 mid-line) 편집 중 절단 발생 → HEAD 스티칭 복구. 편집분은 절단점 이전이라 전부 보존. 복구 후 구문 0. **operator는 두 파일 diff를 육안 확인 + build로 재검증.**
- 🔴 RED: 실패 모드·smoke path 정의(lot 있는 품목·다중 lot·이벤트 0 lot·다건선택).
- 🟢 GREEN: operator smoke 실행·invalidation(use/dispose 후 재조회) 확인.
- 🔵 REFACTOR: 임시 계측 제거·notes 확정.
- ✋ Quality Gate: 회귀 0·rollback 문서·잔여 blocker 격리(다건 배치 별트랙 명시).
- Rollback: overlay/데이터배선 phase별 revert.

## 8. Optional Addenda

### A. Workflow/Ontology Addendum
- dispose > reorder