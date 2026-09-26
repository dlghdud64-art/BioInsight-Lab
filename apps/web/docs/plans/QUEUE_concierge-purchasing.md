# QUEUE · 컨시어지 구매 대행

- **등재** 2026-09-25 (호영님 판정)
- **상태** 대기 — 착수 지시 없음
- **왜 큐에 있나** 구매 대행을 나중 일로 보고 **관리자 주문 생성 UI 를 지웠다**(`§admin-order-create-removed`).
  지운 것은 **화면뿐**이다. `POST /api/admin/orders` · `Order` 테이블 · `lib/orders/cancel-restore-quote.ts`
  는 그대로 있다 — 구매 대행을 시작할 때 다시 쓸 자리다.

---

## 지금 상태 (실측 2026-09-25)

```
견적을 PURCHASED 로 옮기는 UI 경로   0곳
  일반 사용자   §order-entry-removed 에서 이미 0 (POST /api/orders 호출자 0)
  관리자        §admin-order-create-removed 로 0

prod 데이터 (operator-shell → Supabase xhid… Session Pooler · SELECT 만)
  PURCHASED 견적   0건
  Order            2건 · **둘 다 CANCELLED** · 같은 견적(RFQ-2608-6QRG)에서 생성
                   cancel-restore-quote 가 그 견적을 COMPLETED 로 되돌렸다
  → 되살릴 과거 데이터도 없다
```

살아 있는 서버 축(지우지 않았다):

| 것 | 경로 | 상태 |
|---|---|---|
| 관리자 주문 생성 API | `app/api/admin/orders/route.ts` | 존치 · 호출자 0 |
| 사용자 주문 생성 API | `app/api/orders/route.ts` | 존치 · 호출자 0 |
| 주문 테이블 | `Order` | 존치 · 2행(전부 CANCELLED) |
| 취소 복원 | `lib/orders/cancel-restore-quote.ts` | 존치 · PURCHASED → COMPLETED |
| 주문 추적 UI | `components/orders/order-tracking-section.tsx` | 존치 |

---

## 다시 켤 때 필요한 것 — 셋 (호영님)

### 1. 관리자 주문 생성 버튼 복원
- 지운 커밋: **이 문서와 같은 커밋** (`§admin-order-create-removed`)
- 지운 것 3곳 — 형제 슬롯이라 셋을 같이 되살린다:
  - 표 행 「전환」 버튼
  - 상세 시트 「주문 전환」 버튼
  - 「주문으로 전환」 확인 다이얼로그 + `convertToOrderMutation`
- 되살리면 역계약 `regression/purchasing-residue-removed.test.ts` ① 이 RED 가 된다 —
  **그 센티넬을 함께 은퇴시킨다**(명제를 이력에 복원한 뒤에).

### 2. 고객이 대행 주문을 볼 화면 — **지금 없다**
- 🛑 이게 없으면 대행 주문이 **알림으로만 남는다.** 고객은 자기 주문이 어떻게 됐는지 볼 곳이 없다.
- 지운 화면: `/dashboard/orders`(§po-ui-removed) · `/dashboard/purchases`(§purchases-ui-removed) ·
  `/my/orders` 는 살아 있으나 대행 맥락이 없다.
- 판정이 필요한 것: 대행 주문을 **어느 화면의 어느 축**으로 보여줄지.
  후보는 견적 상세(그 견적에서 나온 주문) · 입고 관리(입고 대기 축) 둘이다.

### 3. 퍼널 s5 「입고 대기」 복원
- 지운 커밋: 이 문서와 같은 커밋 (`§funnel-s5-removed`)
- 1번이 들어오면 생산자가 생기므로 **그때는 참이다.**
- 라벨은 이미 정해져 있다: `{ key: "s5", label: "입고 대기", sub: "구매 완료 · 입고 등록 전" }`
  (`§funnel-s5-producer` 에서 정한 것 — 「발주 전환 · 발주서 준비」 는 지운 기능 이름이라 쓰지 않는다)
- 모바일 뷰의 s5(`STAGE_META`)는 **지우지 않았다** — 데이터 표시이지 약속이 아니라서다.
  PURCHASED 행이 생기면 목록에 정직하게 뜬다.

---

## 같이 볼 것

- **`ENABLE_PURCHASING` 은 은퇴했다** (§purchasing-flag-retired · 2026-09-25 호영님 판정).
  「flag flip 으로 되살린다」 는 경로가 없어졌으므로 **되살리기는 이 문서가 유일한 근거**다.
  함께 지운 on 가지 4곳: 대시보드 파이프라인 `po` 단계 · 재무 KPI 「확정 발주액」(UI 만 · 데이터 축 존치) ·
  재고 「바로 발주」 버튼·사유 · 대시보드 파이프라인 라벨의 발주 단계.
  관리자 「주문 전환」 칩(뱃지·KPI·필터)도 같이 지웠다 — 상태값은 DB 에 남고 라벨만 「구매 완료」 로 중립화했다.
- CLAUDE.md §유료 결제 오픈 전 게이트 — 결제가 열려야 되살아나는 것들과는 **다른 축**이다.
  이쪽은 결제가 아니라 **운영 인력(대행)** 이 있어야 켜진다.

- 🛑 **복원 시 함께 되살릴 소비 측 — `PurchaseRequest` 의 생성 경로가 0 이 됐다**
  (2026-09-26 §inventory-dead-tabs-removed · 호영님 판정).
  `api/inventory/[id]/restock-request`(재입고 요청 = 유일한 `PurchaseRequest` 생성 지점)를 삭제했다.
  호출자가 0 이었고 그 버튼은 `{false && (…)}` 안에 있어 누를 수 있는 사용자가 없었다(prod 행 0).
  → **남긴 소비 측 3개는 지금 영구히 빈 화면이다**: `/admin/requests` ·
    `POST /api/request/[id]/approve` · `POST /api/request/[id]/reject`.
  🔑 나중에 컨시어지를 열 때 **입구가 이 두 라우트**다. 대행 주문이 승인 흐름을 타야 하면
  생성 지점을 새로 만들지 말고 이 소비 측에 맞춰 붙인다 — 지우지 않은 이유가 그것이다.
  ⚠️ 그때 같이 정해야 할 것: 생성 주체가 **사용자(재입고 요청)** 인지 **운영자(대행 접수)** 인지.
  전자면 지운 라우트의 org-scope 계약을 되살려야 한다(명제는 §inventory-dead-tabs-removed 헤더에 복원해 뒀다).
