# §scopekey-axis-unmeasured — 축이 바뀐 것이지 사라진 것이 아니다

- **Status:** 등재 (2026-08-14) · **미측정** · A트랙 종료 조건에 명시됨
- **발견 경위:** §tenant-isolation 4-3 에서 쓰기 15건의 org 축 대상 여부를 판정하다가,
  4건이 **org 축이 아닌 다른 축**으로 갈라져 나왔다

---

## 0. 왜 별도 등재인가

> **org 축 대상이 아니라는 판정은 "격리가 필요 없다"가 아니다.
> 그 리소스에도 격리 축은 있고, 그 축은 이번 세션에서 한 번도 안 쟀다.**

이걸 안 적으면 다음 사람이 **A트랙 GREEN 을 격리 완료로 읽는다.**

## 1. 대상 — `scopeKey` 축 (3건 + 모델 2종)

| 모델 | organizationId | scopeKey | 비고 |
|---|---|---|---|
| `PurchaseRecord` | ❌ | ✅ | 구매 이력 — 금액·벤더·품목 |
| `ImportJob` | ❌ | ✅ | 임포트 작업 |

`scopeKey` 는 `user.id` 또는 guest key 다(§11.310b 패턴). 즉 **사용자 축 격리**이며
org 축과 **독립**이다.

라우트:

| 라우트 | 쓰기 모델 |
|---|---|
| `POST /api/orders/draft` | `PurchaseRecord` |
| `POST /api/purchases/import` | `PurchaseRecord` · `ImportJob` |
| `POST /api/purchases/import-file` | 동일 |

읽기 쪽에서도 같은 축이 미실증으로 남아 있다 —
`inventory/reorder-recommendation` · `sourcing/recommend`(§tenant §9.8).

## 2. 미측정 상태 (정확히)

- **구조적으로는** `where: { scopeKey }` 로 스코프된다(코드 확인)
- **런타임 실증 0** — 사용자 A 의 세션으로 사용자 B 의 `scopeKey` 리소스에 접근하는
  교차 요청을 **한 번도 넣지 않았다**
- 읽기 3건은 대조 데이터 공백으로 미실증, 쓰기 3건은 org 축이 아니라는 이유로 제외됐다

## 3. A트랙 종료 조건에 붙는 문장

> **A트랙이 닫는 것은 org 축이다. `scopeKey` 축은 미측정으로 남는다.**
> A트랙 GREEN 은 "테넌트 격리 완료"가 아니라 "org 축 격리 회귀 차단 + org 축 실측분 통과"다.

## 4. 측정 설계 (착수 전)

org 축 픽스처와 **다른 픽스처가 필요하다** — 같은 조직 안의 **서로 다른 사용자** 2명.
현재 픽스처(orgA/orgB 각 1명)는 조직이 다르므로 scopeKey 축 교차를 만들지 못한다.

## 5. 관계

- §tenant-isolation-placeholder — 발원지. §9.12 org 축 대상 판정에서 갈라져 나왔다
- §measurement-layer-blindness — "대상 아님"을 "문제 없음"으로 읽지 않기

---

## D1b 실측 — quote-lists/[id]/items PUT 귀속 (2026-08-15)

소유 검사가 **guestKey 단독**이다:

```ts
const existing = await dbTyped.quote.findFirst({
  where: { id, OR: [ { guestKey } ] },   // ← userId·organizationId 축 없음
});
```

| 프로브 | 응답 | 델타 | 해석 |
|---|---|---|---|
| P1 교차(세션 A + guest A 쿠키 → guest B 리스트) | 404 | 0 | 소유 검사에서 걸림 |
| P2 대조(guest A 리스트) | 500 | 0 | 소유 검사는 **통과**, 그 뒤 드리프트로 실패 |

**교차/대조가 소유 검사 층에서 갈렸다** — 검사가 실재한다는 것까지는 확인됐다.

🛑 **그러나 완전한 차단형 판정은 아니다.** §2.5 차단형은 *교차 차단 AND 대조군 통과* 인데
대조군이 500 이라 **착지가 미확인**이다 → `판정 불가` 유지.

🛑 **org 축 분모에 넣지 않는다.** 차단 요인은 guestKey 이고 org 는 검사에 등장조차 않는다.
이 카드로 귀속한다. (정정 6회가 전부 모집단 혼선이었다 — 축이 다른 결과를 같은 분모에
넣으면 7회차가 된다.)
