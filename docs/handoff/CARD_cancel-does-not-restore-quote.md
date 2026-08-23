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
