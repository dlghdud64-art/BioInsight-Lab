# §cancel-does-not-restore-quote — 주문 취소가 견적을 되돌리지 않는다 (백로그)

**등재 2026-08-23** · §order-entry-rewire P4 프로덕션 실측 중 발견 · P4 를 막은 결함

🛑 **취소 후 재발주 경로가 0 이다.** 예약은 정상 해제되는데 견적이 `PURCHASED` 로 남아
그 견적은 다시 발주할 수 없다. 행에 "발주 준비" CTA 가 아예 뜨지 않는다.

## 증상

```
주문 취소 → releaseOrderReservation 이 예약을 해제 (원장 정상)
          → quote.status 는 PURCHASED 로 유지
          → deriveRailState 는 COMPLETED 만 ready_for_po_conversion 으로 본다
          → 그 견적은 영영 발주 CTA 가 안 뜬다
```

## 실측 (2026-08-23 · prod `xhid…dhsw` · read-only)

```
견적    cmsyl787500016v667uzt6qrg   status PURCHASED
주문    ORD-20260822-C3PN           status CANCELLED · 850,000
원장    order_reserved   850,000   pre 0       → post 850,000
        order_released   850,000   pre 850,000 → post 0
        🔑 예약은 완전히 되돌아갔다. 되돌아가지 않은 것은 견적 상태뿐이다.

같은 조직 견적 상태 분포
  PENDING 3 · SENT 1 · PURCHASED 1
  🛑 COMPLETED 0건 — 발주 가능한 견적이 하나도 없어 P4 실측 자체가 막혔다
```

⚠️ 사무국 API 실측은 같은 조직을 **8건**으로 셌는데 DB 는 5건이다. 목록 API 의 스코프가
organizationId 축이 아닐 수 있다 — 별건이지만 계수 대조 시 주의.

## 겹 2 — 서버 가드도 취소분을 센다 (2026-08-23 P4 2상 실측 추가)

카드 등재 시점의 범위가 실제로는 **두 겹**이었다. 견적 상태 복귀만으로는 재발주가
성립하지 않는다.

```
겹 1  quote.status 가 PURCHASED 로 굳음      → UI 진입 차단   (최초 등재분)
겹 2  ALREADY_ORDERED 가 CANCELLED 도 셈     → 서버 차단      (2상 실측)
```

증상: 견적을 COMPLETED 로 되돌린 뒤 접수해도 `"이미 주문된 견적입니다."` 로 400.

### 형제 슬롯 전수 (파일:줄 · 추정 0)

```
src/app/api/orders/route.ts:117        include { orders: true }      ← 상태 필터 없음
src/app/api/orders/route.ts:136-138    if (quote.orders.length > 0) throw ALREADY_ORDERED
src/app/api/admin/orders/route.ts:153  include { orders: true }      ← 상태 필터 없음
src/app/api/admin/orders/route.ts:177  if (quote.orders.length > 0) throw ALREADY_ORDERED
```

🛑 **두 곳이다.** 사무국 실측은 owner 경로(`/api/orders`)에서 막혔지만 admin 경로
(`/api/admin/orders`)에 같은 판정이 복붙돼 있다. 한쪽만 고치면 admin 이 남는다 —
§order-entry-rewire P3-3 이 봉합한 것과 정확히 같은 형태(두 진입점 · 복붙 · 한쪽만 수정).

UI 파생은 없다: `quote.orders` 를 include 해 판정에 쓰는 지점은 이 2곳뿐이고,
견적 관리 화면은 `deriveRailState`(status 축)로만 판단한다 — 즉 **겹 1 과 겹 2 는
서로 다른 축이라 둘 다 고쳐야 한다.**

### 주석이 남긴 단서

`admin/orders/route.ts:147` 이 유래를 적고 있다 — `§11.211 Order.id Sub-B 채택 후
relation cardinality 변경(1:1 → 1:N). ALREADY_ORDERED 는 orders.length > 0 으로 derive.`
1:1 시절에는 "주문이 있다 = 발주됨" 이 참이었다. 1:N 으로 바뀌고 취소가 생기면서
**그 등식이 깨졌는데 판정식은 그대로 남았다.**

## 위치

```
owner   PATCH /api/orders/[id]                    quote 상태 미복귀
admin   PATCH /api/admin/orders/[id]/status       quote 상태 미복귀
공통    releaseOrderReservation(order-reservation-service.ts) 은 예약만 되돌린다
        — 설계상 정확하다. 서비스의 책임은 원장이고, 상위 도메인 전이는 그 밖이다.
        공백은 서비스가 아니라 **두 라우트 쪽**에 있다.
```

## 판정 (호영님 2026-08-22)

**되돌린다.** 취소는 발주를 무르는 행위이므로 견적도 `COMPLETED` 로 복귀시켜 재발주를 연다.
별도 슬라이스로 배선.

## 배선 시 주의 — P0 인벤토리 대상

```
🛑 PURCHASED 로 만든 주체가 그 주문인지 확인해야 한다.
   다른 주문이 이미 확정한 견적을 되돌리면 안 된다.
   → "이 견적의 다른 활성 주문이 없을 때만 복귀" 가 조건이 될 가능성이 높지만,
     조건 자체가 측정 대상이다(추정 금지).

배치   예약 해제와 **같은 트랜잭션 · 같은 조건**에 넣는다.
       따로 넣으면 예약만 풀리고 견적은 안 풀리는 지금 상태가 부분적으로 재발한다.
진입점 두 곳(owner·admin) 모두. §order-entry-rewire P3-3 이 봉합한 것과 같은 형태 —
       한쪽만 고치면 다시 갈라진다. 해제 서비스처럼 단일점으로 두는 편이 낫다.
```

## 측정 항목 (착수 시)

```
1  PURCHASED 로 전이시키는 지점 전수 (파일:줄 · 추정 0)
   — markQuoteAsPurchased 말고 다른 경로가 있는지
2  COMPLETED 의 의미 — 발주 전 상태인가, 다른 뜻도 겸하는가
   (deriveRailState 가 COMPLETED 를 ready_for_po_conversion 으로 보는 것 외 용례)
3  한 견적에 주문이 여러 건일 수 있는지 — 스키마상 가능한지, 실제로 있는지
4  취소 외 경로(주문 실패·반품 등)도 같은 복귀가 필요한지
```

## 관련

- `PLAN_order-entry-rewire.md` — P4 가 이 결함으로 막혔다
- `PLAN_order-budget-reservation.md` — 예약/해제 원장 (정상 동작 확인됨)
- `CARD_path-c-order-draft.md` — "발주" 라는 말이 두 객체를 가리키는 문제 (별건)

---

## 구현 (2026-08-23 · 호영님 판정 "지금 고치고 재실측")

두 겹을 한 슬라이스로 봉합했다. 착수 전 카드의 측정 항목 4개를 먼저 실측했다.

### 측정 결과 (파일:줄 · 추정 0)

```
1  quote.status = PURCHASED 쓰기 지점 — 3곳
     api/orders/route.ts:336            주문 접수 (tx 내)
     api/admin/orders/route.ts:303      admin 주문 생성
     api/quotes/[id]/route.ts:302       범용 PATCH (클라이언트가 status 를 보냄)
   🔑 markQuoteAsPurchased 는 PurchaseRecord 만 만든다 — 견적 상태는 안 건드린다.

2  COMPLETED 의 의미
     deriveRailState   COMPLETED → ready_for_po_conversion (발주 가능)
     state-machine     ALLOWED_QUOTE_TRANSITIONS.COMPLETED = ["PURCHASED"]
                       PURCHASED = [] (terminal) → PURCHASED→COMPLETED 는 맵상 금지
     소비자는 /api/quotes/[id]/status 와 operational-brief/popup.tsx 둘뿐.

3  한 견적에 주문 다건 — 가능하다
     @@unique([quoteId, vendorId]) · legacy 주문은 vendorId NULL (NULL-distinct)
     → 취소 후 재발주가 unique 로 막히지는 않는다 (겹 3 없음).

4  취소 외 되돌림 경로 — 없다
     ALLOWED_ORDER_TRANSITIONS 상 DELIVERED·CANCELLED 는 terminal. 반품 경로 0.
```

### 판정 지점 — 전이맵은 넓히지 않았다

취소 복귀는 forward 전이가 아니라 **보상 전이(compensating)** 로 본다. canonical
`ALLOWED_QUOTE_TRANSITIONS.PURCHASED` 는 `[]` 로 남겼다 — 맵에 `["COMPLETED"]` 를
넣으면 `/api/quotes/[id]/status` 의 **수동** 경로까지 함께 열려, 주문은 살아 있는데
견적만 되돌리는 조작이 가능해진다. 서비스 주석에 이 결정을 명기했다.
🛑 호영님이 "맵으로 옮긴다" 로 재판정하면 한 줄 변경 + sentinel 이동으로 끝난다.

### 배선 (4 슬롯)

```
겹 1  lib/orders/cancel-restore-quote.ts   restoreQuoteOnOrderCancel — 신규 단일점
      api/orders/[id]/route.ts             release 직후 · 같은 if · 같은 tx
      api/admin/orders/[id]/status:3-a     release 직후 · 같은 if · 같은 tx
겹 2  api/orders/route.ts                  activeOrders = orders.filter(비CANCELLED)
      api/admin/orders/route.ts            동일 (형제 슬롯 복붙 방지)
```

복귀 조건 3축 — ① quote.status === PURCHASED ② 이 주문 외 활성 주문 0건
③ PurchaseRecord 0건. ②가 "다른 주문이 세운 PURCHASED 를 무르지 않는다" 를,
③이 "구매까지 확정된 견적은 발주 되감기 대상이 아니다" 를 이행한다.

### sentinel

`src/__tests__/orders/cancel-restore-quote.test.ts` — 코어 8 + 배선 8.
목은 `where` 를 **실제로 적용**한다 (quoteId·id.not·status.not 3축) — 목이 필터
회귀를 흡수하던 2026-08-22 학습 반영. 역방향 잠금 포함: 라우트가 견적 복귀를
재인라인하면 RED.

---

## 교정 (2026-08-24 · P4 재실측 중 발견 · 호영님 판정 "order_confirmed 부재로 교체")

### 2상 PASS — 겹 2 봉합이 프로덕션에서 실증됐다

```
주문   ORD-20260824-SKSQ  ₩850,000  ORDERED  신규 생성
공존   ORD-20260822-C3PN  CANCELLED — 취소분과 나란히 존재
       🔑 취소된 주문이 남아 있어도 재발주가 된다. 겹 2 가 닫혔다.
       @@unique([quoteId, vendorId]) 가 vendorId NULL 로 NULL-distinct 라는 스키마 판독도 실증.
예산   total 5,000,000 · used 850,000 · reserved 850,000 · remaining 3,300,000
견적   6QRG status PURCHASED
```

### 🛑 조건 ③ 이 틀렸다 — 사무국 설계 오류

초안의 ③ 은 `PurchaseRecord 0건` 이었다. **원리상 주체를 식별할 수 없다.**

```
model PurchaseRecord
  quoteId  String?     ← 유일한 연결
  🛑 orderId 컬럼이 없다
```

②가 피한 함정("다른 주문이 세운 것을 무르지 마라")의 거울상을 ③에서 그대로 만들었다.
프로덕션 데이터가 그것을 그대로 보여준다:

```
PurchaseRecord  2026-08-18 13:21:30 · 850,000 · source "quote"
주문 C3PN       2026-08-22 11:20:30   ← 4일 뒤
주문 SKSQ       2026-08-24 04:21:40   ← 6일 뒤
🛑 두 주문 어느 쪽도 그 레코드를 만들 수 없다. 그런데 ③ 은 둘 다 막았다.
```

### 대안 `release > 0` 도 틀렸다 (로컬 세션 반박 · 채택 안 함)

`releaseOrderReservation` 이 0 을 반환하는 경우가 둘이라 파생량으로는 구분이 안 된다.

```
(a) confirm 이 예약을 이미 소멸시켰다   → 확정됨 · 되돌리면 안 됨
(b) 애초에 예약이 없었다 (레거시)        → 미확정 · 되돌려야 함
```
추가로 restore 가 release 의 반환값을 받아야 해 두 서비스가 묶이고 호출 순서에 의존한다.

### ✅ 채택 — `이 주문의 ORDER_CONFIRMED 부재`

P2 가 만든 그 이벤트는 `sourceEntityId = orderId` 로 **주체가 박힌 사건**이고,
"이 주문의 구매가 확정됐다" 는 명제 그 자체다. ③ 이 손을 뻗던 사실을 원장이 이미
주체 식별자와 함께 기록하고 있었다.

```
주체 식별    sourceEntityId — 주문 단위 · quoteId 축 오염 0
순서 무관    release 전후 어느 쪽이든 confirm 유무는 안 바뀐다 (반환값 결합 0)
(a)/(b) 구분  confirm 있음 → 복귀 안 함 · confirm 없음 → 복귀함
```

### ⚠️ 알고 남긴 구멍 — 레거시 주문

```
예약 없는 주문(2026-08-22 이전)  원장에 흔적이 없어 확정 여부를 원장으로 판정 불가
                                 → 취소 시 "확정 안 됨" 으로 보고 견적을 복귀시킨다
신규 주문                        해당 없음 — owner·admin 두 접수 경로 모두 NO_BUDGET 으로
                                 막으므로 예약 없는 주문이 새로 생기지 않는다
완전 봉합                        PurchaseRecord.orderId (additive DDL) — 별도 슬라이스·별도 승인
```
계약 테스트가 이 케이스를 **명시로** 잠근다 — 우연이 아니라 알고 남긴 것임을 못 박기 위해서다.
그 단언을 지우려면 DDL 슬라이스와 함께 지운다.

## 별건 — 3상은 6QRG 로 성립하지 않는다

`markQuoteAsPurchased` 가 `alreadyPurchased` 로 no-op 한다. ③ 을 고쳐도 마찬가지다.
3상(구매 확정) 실측은 PurchaseRecord 0 인 다른 견적을 **정상 흐름으로** COMPLETED 까지
올려서 해야 한다 — DB 로 상태를 밀면 3상이 검증하려는 그 경로를 건너뛴다.

```
후보 (PurchaseRecord 0 + 품목 있음 · 7건)
  PENDING  cmsg9zzut0009uupv7hu7ds3y · cmsg9vqk50001uupvcokccdlh
           cmqrnil470003nptxnhqj8ebg · cmqj9raak000559au0ziv21cu
  SENT     cmqtqoebr000bht96nnefj5y7 · cmqnj71gb000dheu49grk70dk
           cmqjfi5ef00035bidiqcaa698
```

## 종결 — /api/quotes 스코프 축 (이월 항목이었다)

```
/api/quotes 응답 8건 = DB 전체 견적 8건 (양측 실측 일치)
organizationId 필터 시 5건
🔑 이 API 는 userId 축이다. 2026-08-23 의 "8 대 5" 불일치는 여기서 왔다.
```
카드 상단의 ⚠️ 계수 주의 항목은 이로써 닫힌다.
