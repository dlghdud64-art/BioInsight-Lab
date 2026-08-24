# §money-path-behavior-suite-red — 돈길 behavior 스위트가 4개월 RED (백로그)

**등재 2026-08-23** · §cancel-restores-quote 게이트 범위 확장 중 발견 · 이번 커밋과 **무관**

🛑 `orders-budget-deduction.behavior.test.ts` 4건이 구조 이관 이후 계속 RED 였다.
프로덕션에 이미 배포된 **돈길 코드**를 검증하던 스위트다.

## 증상

```
src/__tests__/api/orders/orders-budget-deduction.behavior.test.ts   4 failed
  M1  차감 대칭 · M2a legacy · M2b vendor-split · M3 장부 정합
  TypeError: Cannot read properties of undefined (reading 'findFirst')
  라우트는 tx.budget.findFirst 를 부르는데 테스트 목에는 userBudget 만 있다
```

## 이분 탐색 (로컬 세션 · 2026-08-23)

```
bb51922c  4 passed
376fe14a  4 failed   ← ⑪ P3 "Budget 재배선 · UserBudget 쓰기 소거"
38a5e97e  4 failed
3fa2990a  4 failed   ← §cancel-restores-quote **직전**
5f3a4e43  4 failed   ← 이번 커밋 (무관 확정)
```

🔑 **R1 과 같은 계열이다.** 구조 이관(UserBudget → Budget) 시 옛 값에 핀된 검사를
sweep 하지 않았다. 다만 sentinel 이 아니라 behavior 테스트라 더 무겁다 —
sentinel 은 "어떻게 쓰였나" 를 보지만 이 스위트는 "무엇이 벌어지나" 를 본다.

## 겹 2 — 게이트 스코프가 그것을 못 봤다 (더 값진 절반)

```
오늘 게이트 스코프  budget · lib/budget · regression · dashboard/quotes
빠진 것            src/__tests__/api/orders
```

돈길 라우트를 고치는 커밋을 게이트하면서 그 라우트의 돈길 behavior 스위트를
스코프에서 빠뜨렸다. 결함이 4개월 살아남은 것은 결함 자체보다 **게이트 설계**의 문제다.

📌 **규칙 후보** — 라우트 파일을 건드리는 커밋은 그 라우트의 `__tests__/api/<경로>` 를
게이트 스코프에 포함한다. (로컬 세션 자발 제안 2026-08-23 · 규칙 승격 대기)

## 착수 전 판정 필요 — 승계인가 은퇴인가

🛑 **목을 고쳐서 GREEN 을 만드는 것이 답이라고 단정하지 말 것.**
목이 `userBudget` 을 그대로 들고 있다는 것은 그 스위트가 **지금 무엇을 검증하는지**
자체가 흐려졌다는 뜻이다. 옛 축(UserBudget 직접 차감)이 검증 대상에서 사라졌다면
"차감 대칭" 이라는 명제부터 다시 써야 한다 — ⑪ 이후 canonical 은 차감이 아니라
`amount − PurchaseRecord − 활성예약` 파생이다.

```
승계  M1~M3 의 명제를 Budget · BudgetEvent 축으로 다시 쓰고 목을 그 축으로 교체
은퇴  ⑪ 원장 계약 테스트(order-reservation · order-confirm-wiring)가 이미 덮는
      명제는 중복이므로 잠금과 함께 은퇴
```
어느 쪽이든 **역방향 잠금**을 남겨야 한다. 지금 형태로 복구하면 다음 이관에서 같은 자리가
다시 조용히 RED 가 된다.

## 측정 항목 (착수 시)

```
1  M1~M3 각 명제가 ⑪ 원장 계약 테스트와 겹치는 범위 (명제 단위 대조 · 추정 0)
2  그 스위트가 잠그던 프로덕션 동작 중 지금 **아무도 안 잠그는** 것이 무엇인가
3  ✅ 선실측 완료 (2026-08-23 · 사무국) — 모집단 1건이다
   __tests__ 전역 `userBudget` grep = 2 파일
     api/orders/orders-budget-deduction.behavior.test.ts   ← 옛 모델에 핀된 목 (본건)
     regression/order-no-budget-message-p12.test.ts        ← **부정** 단언
                                                              (tx.userBudget 이 없음을 잠금) · 정상
   🔑 확산은 없다. 고칠 자리는 한 파일이다.
4  project_money_path_coverage_restore 축2 의 원래 커버리지 명세와 현 상태의 차
```

## 관련

- `PLAN_order-budget-reservation.md` — 376fe14a(⑪ P3)가 이관 시점
- `CARD_cancel-does-not-restore-quote.md` — 이 카드가 나온 게이트의 대상 커밋
- §sentinel-old-value-sweep — 같은 계열의 규율 (그쪽은 sentinel, 이쪽은 behavior)
