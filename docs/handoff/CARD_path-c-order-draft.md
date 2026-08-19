# §path-c-order-draft — 경로 C "발주 생성" 화면의 정체 (백로그)

**등재 2026-08-19** · ⑪ 측정 과정에서 발견 · ⑪과 분리

🛑 **(가) 입고=확정 착수의 선행 조건이다.** C 의 정체에 따라 (가)가 이중 계상을 만든다.

## 실측 (2026-08-19)

```
화면    /dashboard/purchase-orders/new
호출    POST /api/orders/draft
생성    PurchaseRecord 1건
        scopeKey = user.id · source = "manual" | "reorder-recommendation"
        quoteId 없음 · followUpStatus null
🛑 Order 를 만들지 않는다.  화면 이름은 "발주 생성" 인데 발주가 안 생긴다.
소스 주석  "followUpStatus null = pending (정식 발주 결재 대기 — §11.310d-2 후속)"
```

경로 3개 중 C 만 `PurchaseRecord`(확정 원장)를 만든다. 예약도 통제도 거치지 않는다.

## 두 가설 — 어느 쪽이냐에 따라 (가)의 안전성이 갈린다

```
(a) 사후 등록    이미 밖에서 산 것을 장부에 올리는 화면
                 → 입고를 안 거치므로 (가)와 **이중 계상 아님**. 무해.
(b) 미완성 발주   §11.310d-2 가 완성되면 Order 를 만들 예정인 중간 상태
                 → (가) 적용 시 같은 물건이 C 로 한 번, DELIVERED 로 한 번 잡힌다.
                    🛑 PurchaseRecord 에 @@unique 없음 · quoteId 없음 · orderId 없음
                       → 대조할 키가 없어 중복을 **탐지조차 못 한다**
```

주석의 "정식 발주 결재 대기" 는 (b) 를 시사하지만 **문구는 근거가 아니다**(§7).

## 측정 항목 (착수 시)

```
1  §11.310d-2 의 현재 상태 — 후속이 어디까지 왔나. 계획 문서 · 커밋 이력
2  C 의 실사용 — prod 에 source="manual"|"reorder-recommendation" PurchaseRecord 가 있는가
   🛑 read-only SELECT. 호영님 실행 (sandbox/operator 는 prod 조회 안 함)
3  ⑩(구매 처리 폼 2벌)과 동일건인지 대조 — 같은 화면 계열일 가능성
4  화면 이름 정정 or dead path 처분 — 1·2 결과 후
```

## 의존 관계

```
⑪ (가) 입고=확정 착수   ←  이 카드의 가설 판정이 **선행**
                            (b) 로 판명되면 (가) 착수 전에 C 를 먼저 정리해야 한다
§purchase-record-dual-path  같은 뿌리 — @@unique 부재 + 연결 키 부재
```

## 관련

- 측정 시점 HEAD `a8f92a25`
- `HANDOFF_2026-08-18-pipeline-blocks.md` ⑪ 카드 §경로 3개
