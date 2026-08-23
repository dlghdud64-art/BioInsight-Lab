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
