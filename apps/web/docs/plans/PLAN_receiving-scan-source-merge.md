# Implementation Plan: 입고 리스트 스캔 입고 합류 (§receiving-scan-source-merge)

- **Status:** 🟡 In Progress (Phase 0 재실측으로 게이트 통과 2026-09-05 · P1 진입)
- **Started:** 2026-09-01
- **Last Updated:** 2026-09-05
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

⚠️ **2026-09-02 P0 실측으로 아래 "재사용 가능 축" 중 2개가 정정됨** — `ocrJobId`·`extractedData` 는
**컬럼은 존재하나 쓰는 코드가 없어 전 행 null**이다(Phase 0 참조). 스키마 실재를 값 실재로 읽은
정찰 오류 — [[필드 존재 ≠ 값 존재]]. 나머지 축(`lotNumber`·`expiryDate`·`quantity`·`orderId`·
`receivingDocuments`)은 유효.

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

**C3 공급사명** — `InventoryRestock` 에 vendor 축 없음 → `extractedData` 의 `brand` 에서 파생.
  없으면 `공급사 미지정`(정직 표기 · 지어내지 않는다).

  🛑 **정정 (2026-09-05 실측)** — 원 문안은 "`extractedData` 의 파싱 결과에서 파생" 이었고,
  그 안에 brand 가 있다고 **가정**했다. 실제로는 같은 컬럼에 생산자마다 다른 스키마가 들어간다:
  단품은 `confirmedData`(brand 있음) · 다품목은 `line`(brand **없음**).
  prod 스캔 3건의 키 = `["unit","category","quantity","productName","catalogNumber"]`.
  ⇒ C3 는 그 상태에서 100% `공급사 미지정` 이었다. [필드명 ≠ 내용] 의 재발.
  **조치(§receiving-extracted-shape, 2026-09-05):** brand 를 `items[]` 에 실었고,
  네 쓰기 지점 전부 `buildExtractedData(shape, raw)` 로 정규화해
  `shape`(SINGLE|MULTI) + 공통 보장 필드 집합을 함께 남긴다. 읽는 쪽이 스키마를 추측하지 않는다.
  🛑 기존 3행은 소급 불가(brand null 영구) — 이 시점 이전 행은 `공급사 미지정` 이 정답이다.

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

### Phase 0: Truth Lock — ✅ **게이트 통과 (2026-09-05 재실측)**

> 🛑 아래 2026-09-02 실측 기록은 **지우지 않는다.** 결론이 왜 바뀌었는지 추적이 끊기기 때문이다
> (호영님 2026-09-05 · §11-b 원칙). 각 항목에 재실측 결과를 병기한다.

**재실측 (2026-09-05, prod `xhidynwpkqeaojuudhsw`, read-only):**

| 09-02 근거 | 09-05 재실측 | 판정 |
| :--- | :--- | :--- |
| lineage 전 행 null | `InventoryRestock` 5행 중 **3행에 `ocrJobId`+`extractedData`** | ✅ 해소 (선행 (가) 완료) |
| `OcrJob` 0행 = 스캔 실사용 0회 | `OcrJob` 1행(QUOTE) · 스캔 등록 3건 실증 | ✅ 해소 |
| 대상이 데모 시드 2행 | 시드 2행 잔존하나 **스코프로 완전 분리** | ✅ 해소 (아래) |

**③ 시드 분리 — org 단일 스코프로 확정 (호영님 2026-09-05):**
```
시드 2행    user-bioinsight-researcher · ProductInventory.organizationId = null · ocrJobId 없음
실데이터 3행 dlghdud64@gmail.com        · organizationId = T1(cmqp6tp920001p58egl43nd8j)
```
- restock 조회는 **org 단일 스코프**로 고정하고 `organizationId IS NULL` 행은 제외한다.
- 🛑 `userId` 를 OR 로 넣으면 시드가 다시 샌다(시드의 `userId` 도 유효한 User 다).
  스코프 조건이 하나 빠지면 경계가 사라진다 — 같은 날 `findCachedOcrJob` 에서 본 형태.
- sentinel 로 잠근다(Phase 2).

**아래는 2026-09-02 당시 기록 — 보존용:**
- [x] supersede 표: **0건**. `buildReceivingCaseList` 호출부 = `page.tsx:78` + unit 4곳(L74·142·157·163),
  `buildReceivingCaseRow` 8곳(draft 전용 유지 시 무접촉), `receiving-list-redesign.test.ts:32` 는 이름
  문자열 매칭이라 시그니처 무관. **2번째 인자를 optional 로 두면 승계 0** (DTO 확장 시 fixture 필드
  추가는 발생 가능 — `lotSource` 선례).
- [x] **C3 파생원이 실재하지 않는다**: `smart-receiving/route.ts` 가 `ocrJobId`·`extractedData` 를
  **한 번도 쓰지 않는다** — 분기 A(L436-437)·분기 B(L590-591) 모두 `// ocrJobId,` `// extractedData:`
  주석 처리(2026-05 "migration pending" 주석이 컬럼 적용 후에도 그대로 남음). P2 다품목 경로도 미기입.
  L272/L328/L459/L612 의 `ocrJobId` 는 `createAuditLog` 의 `newData`(감사 로그 JSON)이지 restock 행이 아니다.
  **prod 실측: InventoryRestock 2행 중 `ocrJobId` 0 · `extractedData` 0.**
  ⇒ C3 는 현 상태에서 **100% `공급사 미지정`**. 살리려면 주석 해제(쓰기 활성)가 선행돼야 하고,
  기존 행은 소급 불가(null 영구).
- [x] **스캔 실사용 0회**: prod `OcrJob` **0행**(LABEL 0 · QUOTE 0). 계획 §0 의 "실사용 주경로(스캔)"
  전제가 prod 에서 성립하지 않는다 — 스캔 입고가 리스트에 안 뜨는 것은 사실이나, 스캔 자체가 아직 0회다.
- [x] **대상 데이터가 데모 시드**: prod `InventoryRestock` 2행 = `prisma/seed.ts:869` 의
  `restock-hero-pbs-lot1/2`(product `Sigma-Tech PBS 1X (Sterile)` · notes "…per-lot COA 등록 대상").
  `ReceivingDocument` 0 · `ReceivingDraft` 0 · `ProductInventory` 10.
  ⇒ 이 배치를 그대로 구현하면 **시드 2행이 `스캔 입고` 로 승격 노출**된다 — §0 부수 실측(발주 관리
  데모 시드)과 **동형 문제를 입고 리스트에 새로 만드는 것**이다.
- ✋ Gate(09-02): **미통과.** 선행 3택 중 (가) 를 호영님이 채택 → 2026-09-04 완료.
  - (가) **lineage 쓰기 활성 먼저** ✅ **완료** — `ocrJobId`·`extractedData` 를 네 생성 지점 전부에 배선
    (`§scan-recognition-upgrade` 승계 · prod 3/3 실측).
  - (나) prod 시드 정리 — 불요로 판명(org 스코프로 분리됨). 별건 유지.
  - (다) 비권장 — 미채택.
- ✋ Gate(09-05 재실측): **통과.** P1 진입.
- Rollback: 문서만

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

## 10-b. 실측으로 얻은 것 (2026-09-05)

**① 스키마에 자리가 있다고 데이터가 흐르는 게 아니다** — 오늘만 세 번 같은 자리였다.

| 컬럼 | 상태 | 발견 |
| :--- | :--- | :--- |
| `InventoryRestock.ocrJobId`·`extractedData` | 컬럼 실재, 쓰는 코드 0 | 09-02 Phase 0 |
| `Product.specification` | 컬럼 실재, 전달 경로 0 → 등록 시 영구 소실 | 09-05 §scan-spec-carry |
| `InventoryRestock.lotNumber`·`expiryDate` | 컬럼·라우트 실재, **인식값이 안 옴**(자리가 없어 notes 로) | 09-05 §scan-lot-slot |

  ⇒ 정찰에서 "컬럼이 있다" 를 "값이 있다" 로 읽지 않는다. **쓰기 지점과 전달 경로를
  같이 확인**한다. `lotSource`·`categorySource` 를 새로 만들 때와 정확히 같은 자리다.

**② 잘림은 경계선상의 확률 현상이다** (①의 처방이 "상향" 이 아니라 "감지" 여야 하는 근거)

```
2026-09-05 05:42  7열 4품목 → 1094자에서 잘림(닫는 } 없음) → 파싱 실패 → "0 품목"
2026-09-05 07:50  같은 구조 7열 4품목 → 잘리지 않음 → 4/4 인식 성공
```

  **같은 문서가 한 번은 잘리고 한 번은 안 잘렸다.** `maxOutputTokens` 상향은 확률을
  낮출 뿐 경계를 없애지 못한다 — 20품목 명세서가 오면 또 잘린다.
  진짜 결함은 API 가 `finishReason` 으로 말해주는데 코드가 안 읽는 것이다
  (호영님 정정 2026-09-05 · §ocr-parse-failure 에서 감지 우선으로 구현).

**③ 화면은 파생물이고 원문이 실측이다**

  `6 EA` 를 보고 호영님·operator 둘 다 "단위 오인식" 으로 읽었고, operator 는 원인 가설을
  셋(스키마 부재·표 폭·렌더링) 세워 **전부 틀렸다.** rawText 를 열자 모델은
  `specification:"4 L" · quantity:6 · unit:"EA"` 로 정확했다. `6 EA` 는 정답이었다.
  ⇒ OCR 결함 판정은 **OcrResult.rawText 부터** 읽는다. 화면에서 추론하지 않는다.

## 11. Notes
- 2026-09-01: prod smoke 시도 중 발견 → 계획 승인(P4 포함). DDL 0.
- 선행 배치(§receiving-list-redesign)의 canonical 전환 자체는 유효 — 소스가 하나 부족했을 뿐이다.
