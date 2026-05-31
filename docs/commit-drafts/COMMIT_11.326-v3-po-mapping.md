feat(inventory): §11.326 v3 #po-mapping — 라벨→미입고 발주(Order) 매핑 입고 동선 (호영님 P0, 2026-06-01)

호영님 P0 §11.326 v3 (Phase 0~3 GREEN) — 스마트 입고에서 라벨/거래명세서로
식별한 품목을 기존 미입고 발주와 매칭해 한 번에 입고. ocrJobId dead-end 우회.

배경 / 호영님 spec:
- 통합 동선 핵심 = 라벨 스캔 → 품목 식별 → 기존 발주 자동 검색·매핑 → 발주 수량
  자동 채움 → 매핑 입고 / 미매칭 시 신규등록 fallback.
- 호영님 지시: 매핑분리(데이터 무결성)를 PO 매핑 회귀에 묶지 말 것 → Phase 0 분리.

Truth Reconciliation:
- 미입고 발주 = Order(status ORDERED/CONFIRMED/SHIPPING). po-candidates(견적→발주
  전환 후보)는 매칭소스 아님 → 기각.
- canonical 입고 경로 = orders/[id] PATCH(status→DELIVERED 시 InventoryRestock
  자동 생성, idempotent) 재사용 → ocrJobId 불필요(§11.290 Phase 5 의존 없이 dead-end 우회).

Fix (file 별):

- src/lib/inventory/match-label-to-order.ts (신규):
  · matchLabelToOrders 순수 함수 — catalogNumber 정확일치(정규화) 우선, productName
    부분포함 보조. catalog 매칭을 name 매칭보다 앞에 정렬. 미매칭 시 빈 배열.
  · PENDING_ORDER_STATUSES = [ORDERED, CONFIRMED, SHIPPING] (DELIVERED/CANCELLED 제외).
  · canonical truth=Order, 어떤 발주도 자동 변경 안 함(사용자 확인 필수).

- src/app/api/inventory/po-candidates-for-label/route.ts (신규, 읽기 전용):
  · GET ?catalogNumber=&productName=&organizationId= → 미입고 발주 후보 반환.
  · overfetch 가드: status in PENDING + items select 최소 + take MAX_SCAN(100).
  · 매칭은 순수 함수 위임. POST/PATCH/DELETE 없음(read-only).

- src/components/inventory/SmartReceivingScannerModal.tsx:
  · PoCandidate type + poCandidates/selectedOrderId/candidatesLoading state.
  · review 진입 시 fetchPoCandidates(라벨 catalog/name) 자동 조회.
  · 매칭 카드(srm-po-candidates / -item / -none) + 선택 시 받은 통 개수 prefill.
  · handleSubmit 분기: 발주 선택 → orders/[id] PATCH DELIVERED(ocrJobId 불요) /
    미매칭 → 현행 smart-receiving 신규등록 fallback 보존.
  · 제출 버튼 라벨 동적("발주 입고 처리" / "입고 등록").
  · U+FFFC 76개 보존(Python 원자 치환), brace/paren/eof 무결.

- sentinel (신규):
  · src/lib/inventory/__tests__/match-label-to-order.test.ts (매칭 단위 6)
  · src/components/inventory/__tests__/smart-receiving-data-model.test.ts (§11.326 회귀 고정)
  · src/__tests__/regression/po-mapping-label-to-order-326v3.test.ts (동선 회귀)

canonical truth 보존:
- Order = source of truth. 라벨 추출값 = projection(덮어쓰기 0).
- 입고 영속 = orders PATCH(기존). UI state 가 truth 대신 들지 않음.
- §11.326 데이터모델(packSize=규격 / receivedQuantity=받은 통) 회귀 0.

production effect:
- 발주한 시약 라벨 스캔 → "매칭된 발주 N건" 카드 → 선택 → 한 번에 입고(발주 DELIVERED).
- ocrJobId 없어 막히던 입고가 매핑 경로로 해소.
- 미매칭은 기존 신규등록 그대로.

검증 (sandbox):
- 매칭 단위 6/6 PASS (node strip-types harness, vitest 실행 불가 환경).
- 데이터모델 회귀 sentinel 13/13 PASS.
- 동선 wiring 정규식 단언 22/22 PASS.
- orders/[id] PATCH 계약 확인: status DELIVERED + actualDelivery datetime accept, restock 자동.
- FFFC 76→76 불변, brace/paren/eof 무결.
- 빌드/타입체크 = 호영님 env (sandbox isolated tsc = @/ alias 미해결로 실행 불가).

Out of Scope:
- 매핑 입고에 라벨 LOT/유효기한 부착(orders restock 계약 확장 = 별도 batch). 현재 매핑
  입고는 발주 item 수량 기준 restock(데이터 손실 아님). 신규등록 fallback은 LOT/유효기한 정상.
- 부분 입고(전량 DELIVERED 기준).
- 거래명세서 다수품목 일괄입고(§11.309e), STORAGE_PROVIDER 영속(§11.290 Phase 5).
- §11.331 구매 운영 메뉴 통합(별도 batch).

Rollback path: git revert <SHA>
- 신규 파일 삭제(match-label-to-order.ts / po-candidates-for-label / sentinel 3종).
- SmartReceivingScannerModal 7개 edit revert(매핑분리 데이터모델은 v2에서 land, 영향 0).

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build   # 빌드 성공 확인
cd ..\..
git add apps/web/src/lib/inventory/match-label-to-order.ts `
  apps/web/src/lib/inventory/__tests__/match-label-to-order.test.ts `
  apps/web/src/app/api/inventory/po-candidates-for-label/route.ts `
  apps/web/src/components/inventory/SmartReceivingScannerModal.tsx `
  apps/web/src/components/inventory/__tests__/smart-receiving-data-model.test.ts `
  apps/web/src/__tests__/regression/po-mapping-label-to-order-326v3.test.ts `
  docs/plans/PLAN_11.326-phaseB-v3-po-mapping.md `
  docs/commit-drafts/COMMIT_11.326-v3-po-mapping.md
git status
git commit -F docs/commit-drafts/COMMIT_11.326-v3-po-mapping.md
git push origin main
```

## Production smoke (호영님 env)
1. 발주 1건(ORDERED) 있는 상태에서 스마트 입고 → 그 품목 라벨/거래명세서 스캔.
2. review 상단 "매칭된 발주 · N건" 카드 노출 확인.
3. 발주 카드 선택 → 받은 통 개수 자동 prefill + 버튼이 "발주 입고 처리" 로 변경.
4. 입고 처리 → 발주 DELIVERED + 재고 입고(restock) 생성 확인.
5. 매칭 안 되는 라벨 → 카드 미노출 or "매칭되는 발주 없음" → 신규등록(현행) 동작 확인.
6. (회귀) 기존 거래명세서 신규등록 입고 정상 + packSize/받은 통 개수 분리 유지.

## Next
- 매핑 입고 LOT/유효기한 부착(orders restock 계약 확장) — 호영님 우선순위 결정.
- §11.331 구매 운영 메뉴 통합(견적·발주 흡수) = 별도 큰 batch.
