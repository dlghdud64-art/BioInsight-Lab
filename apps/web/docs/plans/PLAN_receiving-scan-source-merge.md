# Implementation Plan: 입고 리스트 스캔 입고 합류 (§receiving-scan-source-merge)

- **Status:** ⏳ Pending (승인 2026-09-01 · operator 세션 착수 대기)
- **Started:** 2026-09-01
- **Last Updated:** 2026-09-01
- **선행:** §receiving-list-redesign(5d9fcbb7) · §scan-recognition-upgrade(1a3f73aa)
- **분담:** operator = 구현·게이트·push / sandbox = 계획서·프로브·계약 대조

**CRITICAL:** phase 완료마다 체크박스 갱신 → quality gate 통과 → Last Updated 갱신 → 다음 phase.
⛔ dead button/no-op/placeholder success 금지 · 중복 행 금지 · 스캔 행에서 재고 mutation 0.

## 0. Truth Reconciliation

**발단 (2026-09-01 prod 실측, Claude in Chrome):**
- 호영님 실사용 범위 = **견적 관리 + 입고 관리만**. 발주 관리 미사용.
- prod `/dashboard/receiving` 렌더 성공(장애 종료 실증)이나 **0건**.
- 원인: `ReceivingDraft` 를 만드는 유일 경로가 `orders/[id]/send-email`(발주서 발송 시 공급사 회신 링크).
  발주를 쓰지 않으면 draft 가 생기지 않고, §receiving-list-redesign 이 리스트를 draft canonical 로
  전환했으므로 **리스트가 구조적으로 영구 0건**.
- 스캔 입고(`/api/inventory/smart-receiving`)는 `receivingDraft` 를 만들지 않는다(실측 0회) →
  Product/ProductInventory/InventoryRestock 만 생성 → 재고 관리엔 반영되지만 입고 리스트엔 안 뜬다.
- 즉 실사용 주경로(스캔)가 리스트에서 비가시. **정찰 실패**: canonical 전환 시 "그 canonical 이 어떤
  경로로 생기는지 · 사용자가 그 경로를 쓰는지"를 확인하지 않았다(2026-09-01 sandbox 자인).

**부수 실측 (별건):** 발주 관리(`purchase-orders/page.tsx:90`)가 `useOpsStore()` 데모 그래프를 읽어
  prod 에 `PO-2026-0087/0088`·`user-proc-001`(seed-data.ts) 가짜 운영 지표를 표시 중.
  호영님 미사용 표면이라 이번 배치 밖 — **별건 후보**로만 기록(조치안: 데모 배지 / prod 시드 차단 / canonical 전환).

**재사용 가능 축 (InventoryRestock 실측 — DDL 0):**
`lotNumber` · `expiryDate` · `quantity` · `unit` · `expectedQuantity` · `restockedAt` ·
`orderId`(nullable) · `ocrJobId`(스캔 lineage) · `extractedData`(확인된 OCR 결과 = 공급사명 파생원) ·
`receivingDocuments[]`(회차별 증빙, COA 포함) · `sdsDocuments[]`(lot-scoped COA) · `receivingStatus`.
조회 선례: `/api/inventory/[id]/restock`.

**Chosen Source of Truth:** 리스트 행은 두 canonical 의 union —
`ReceivingDraft`(발주 회신 경로) + `InventoryRestock`(스캔·수동 입고 경로). 신규 truth 저장 0.

## 1. Priority Fit
- [x] **P1 즉시** — 실사용 주경로가 리스트에서 비가시. 선행 배치의 사용자 가치가 현재 0.

## 2. Work Type
- [x] Feature + [x] Bugfix(설계 정합) + [x] Web · Migration 0 · prod DDL 0

## 3. 핵심 계약 (P0 고정 대상)

**C1 중복 배제** — draft 가 approve 되면 `InventoryRestock` 이 생기므로 같은 입고가 두 행이 될 수 있다.
  규칙: **`orderId != null` 인 restock 은 draft 행에 흡수(독립 행 0)** · **`orderId == null` 인 restock 만 독립 행**.
  (draft 는 항상 orderId 를 가진다 — `ReceivingDraft.orderId` 필수)

**C2 스캔 행의 상태** — 스캔 입고는 이미 재고 반영 완료 → 항상 `완료` 행. 검수 판정 개념 없음(판정 축 부재).
  **단 COA 미첨부는 조치로 표시**(문서 보강). 이 조치는 수량·재고를 바꾸지 않는다.

**C3 공급사명** — `InventoryRestock` 에 vendor 축 없음 → `extractedData` 의 파싱 결과에서 파생.
  없으면 `공급사 미지정`(정직 표기 · 지어내지 않는다).

**C4 재고 mutation 0** — 스캔 행에서 반영 CTA 를 만들지 않는다(이미 반영됨). 이중 반영 경로 신설 금지.

## 4. Product Constraints
- Source of Truth: 위 §0. 파생은 순수함수 단일 소스(`receiving-desktop-view-model`).
- UI Surface: 기존 리스트 안(same-canvas). 새 페이지·새 탭 0.
- 색: §11.302 — 완료 emerald · 조치 yellow · 보류 red · amber/orange 0. em dash 0.
- CTA 문구: `caseCtaLabel()` 단일 계약 유지(스캔 행은 CTA null 또는 COA 조치 문구).

## 5. Architecture

| Decision | Rationale |
| :--- | :--- |
| 뷰모델 시그니처를 `buildReceivingCaseList(drafts, restocks)` 로 확장 | 파생 단일 소스 유지, 표면 무접촉 |
| 행 타입에 `source: 'draft' \| 'restock'` 추가 | 렌더·CTA 분기의 명시 축(암묵 추론 금지) |
| API 는 기존 `/api/receiving-drafts` 에 `restocks` 동봉(additive) | 호출부 1곳, 라운드트립 1회. 신규 라우트 0 |
| restock 조회는 orgId/userId 스코프 + `orderId: null` 필터 + `take` 상한 | C1 을 서버에서도 강제, 이력 비대 방지 |
| COA 인식(P4)은 `coa-recognize` 에 `restockId` 수용 추가(additive) | P1 인식 경로를 실사용 경로에서 재사용, 신규 파이프라인 0 |

**Touched(예정):** `src/lib/ops-console/receiving-desktop-view-model.ts` · `src/app/api/receiving-drafts/route.ts` ·
`src/components/receiving/receiving-case-list.tsx` · `src/app/dashboard/receiving/page.tsx` ·
`src/app/api/receiving-drafts/[id]/coa-recognize/route.ts`(P4) · 각 sentinel

## 6. Test Strategy
- 순수함수(union·중복 배제·스캔 행 파생·정렬) → vitest unit, RED 먼저 + 주입 프로브
- API 계약(스코프·`orderId: null` 필터·N+1 0·additive 무회귀) → route sentinel
- UI → readFileSync sentinel(stripComments 로 주석 축 분리 · 정규식 4원칙 · 주입 프로브 필수)
- 러너 정본 = 프로젝트 러너(operator). 격리 러너 결과는 기준 명시.

## 7. Phases

### Phase 0: Truth Lock
- [ ] C1~C4 확정 + 공급사명 파생 규칙(`extractedData` 키 실측)
- [ ] 구 sentinel supersede 표: `buildReceivingCaseList` 시그니처 변경으로 RED 되는 앵커 grep
- ✋ Gate: 계약·supersede 목록 확정 · Rollback: 문서만

### Phase 1: 뷰모델 union (RED → GREEN)
- [ ] 🔴 unit: ① `orderId != null` restock 은 행 생성 0(C1) ② `orderId == null` restock = 완료 행
  ③ COA 미첨부 스캔 행 = `COA 확보` 조치 1건, 수량 조치 0 ④ 공급사명 없으면 `공급사 미지정`
  ⑤ 정렬(조치 필요 → 반영 가능 → 완료, 완료는 최신순) ⑥ `source` 축 존재
- [ ] 🟢 `buildReceivingCaseList(drafts, restocks)` 확장 + `ReceivingRestockDto` 계약
- [ ] 🔵 draft/restock 공통 파생 추출(중복 제거)
- ✋ Gate: 신규 unit GREEN · 기존 unit 무회귀 · 프로브(중복 배제 제거 → RED)
- Rollback: 시그니처 revert(2번째 인자 optional 로 두면 호출부 무회귀)

### Phase 2: API 합류
- [ ] 🔴 sentinel: `orderId: null` 필터 · org/user 스코프 · `take` 상한 · documents in 1쿼리(N+1 0) · 기존 응답 필드 무회귀
- [ ] 🟢 `/api/receiving-drafts` 에 `restocks` 동봉
- ✋ Gate: 프로브(필터 제거 → RED · 스코프 제거 → RED) · 기존 호출부 무영향
- Rollback: 필드 제거(additive 라 구 소비자 무영향)

### Phase 3: 리스트 UI
- [ ] 🔴 sentinel: 스캔 행 출처 배지 리터럴 · 스캔 행에 반영 CTA 0(C4) · COA 드롭존 재사용 · amber 0 · em dash 0
- [ ] 🟢 `source === 'restock'` 렌더 분기(펼침 = 라인 1건 + Lot·수량·문서) + COA 첨부 배선
- [ ] 🔵 빈 상태 문구 갱신(발주·스캔 양쪽 안내)
- ✋ Gate: dead button 0 · 프로브(반영 CTA 주입 → RED)
- Rollback: 컴포넌트 revert

### Phase 4: COA 인식 확장 (스캔 입고)
- [ ] 🔴 unit/sentinel: `coa-recognize` 가 `restockId` 수용 · draft 경로 무회귀 · 저장 0 유지 ·
  확정은 별도(문서 첨부 + `SDSDocument`/`InventoryRestock.lotNumber` 갱신 경로 명시) · 자동 확정 0
- [ ] 🟢 라우트 additive 확장 + 확정 핸들러(스캔 행) 배선
- ✋ Gate: 자동 확정 0 프로브 · 재고 수량 불변 실측
- Rollback: `restockId` 분기 제거

### Phase 5: Smoke / Rollback
- [ ] 프로젝트 러너 GREEN(수치·러너 기준 명시) + build
- [ ] prod smoke: 스캔 입고 1건 → 리스트에 스캔 행 노출 → COA 첨부 → 배지 → 재고 수량 불변
- ✋ Gate: 중복 행 0 · 회귀 0 · rollback 경로 문서화

## 8. Risks

| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| C1 배제 규칙 누락 시 같은 입고가 2행 | Med | High | 서버 필터 + 뷰모델 단언 이중, 프로브로 검출력 확인 |
| 스캔 이력 누적으로 리스트 비대 | High | Med | `take` 상한 + 완료 필터 기본 숨김(기간 필터는 후속 후보) |
| `extractedData` 스키마가 스캔 경로마다 다름 | Med | Med | 키 실측 후 파서 1곳 · 없으면 `공급사 미지정` |
| 선행 배치 sentinel 이 시그니처 변경으로 RED | High | Low | P0 supersede 표 → 승계 재앵커 |
| 발주 관리 데모 시드 노출(별건) | High | Med | 이번 배치 밖. 별도 승인 후 조치(배지/차단/전환 3택) |

## 9. Rollback
- P1: 2번째 인자 optional → 구 동작 · P2: 응답 필드 제거 · P3: 컴포넌트 revert · P4: `restockId` 분기 제거
- prod DDL 0 → DB 롤백 불요. push 는 게이트 GREEN 후.

## 10. Progress
- Overall 0% · Current: Phase 0 · Next: operator 착수 → P0 supersede 표 회신

## 11. Notes
- 2026-09-01: prod smoke 시도 중 발견 → 계획 승인(P4 포함). DDL 0.
- 선행 배치(§receiving-list-redesign)의 canonical 전환 자체는 유효 — 소스가 하나 부족했을 뿐이다.
