# §unvalidated-create — 임의 바디가 행을 만든다 (클래스)

- **Status:** 등재 (2026-08-14) · **클래스** (카드 1건 아님) · **수정 금지** — A트랙 종료 후 재상정
- **개명:** 첫 사례()에 묶인 이름을 클래스 이름으로 교체 — §drift-masks-isolation 때와 같은 이유.
  **이름이 첫 사례에 묶이면 다음 사례가 안 붙는다.**
- **발견 경위:** §tenant-isolation A트랙 4-3 1단계(잘못된 바디 프로브) 부수 발견
- **축:** **테넌트 축 아님.** 생성 행은 호출자에게 귀속된다 — 격리 결함이 아니라 **입력 검증 부재**다

---

## 1. 실측

```
POST /api/quote-lists
body: {"__invalid_probe__": true}          → 201 Created
생성: Quote { title: "제목 없음", guestKey: <신규 발급>, userId: null }

POST /api/products/{productId}/inspection
body: {"__invalid_probe__": true}          → 201 Created
생성: Inspection { productId, userId: <호출자>, inventoryId: null }
```

둘 다 **의미 있는 필드가 하나도 없는 요청**으로 행이 만들어졌다.

## 2. 왜 문제인가

- 인증만 통과하면 **무제한 생성**이 가능하다. rate limit 도 스키마 검증도 없다
- `quote-lists` 는 `userId: null` 로 생성된다 — **소유자 추적이 guestKey 뿐**이고,
  guestKey 는 쿠키라 요청마다 새로 발급받으면 귀속이 흩어진다
- 운영 데이터에 "제목 없음" 유령 행이 쌓이면 §placeholder-success 계열 조사에서
  **실제 사용과 프로브를 구분할 수 없게 된다**

## 3. 이 카드가 A트랙 뒤인 이유

테넌트 축이 아니므로 출시 차단선에 올리지 않는다. 다만 A트랙 프로브가 계속 도는
동안 **프로브가 만든 행이 실제 데이터로 오인될 수 있어**, 프로브 절차에
스냅샷·복원을 고정한 것으로 우선 방어한다(§tenant-isolation 4-3 절차).

## 4. 처리 방향 (착수 금지, 참고용)

- zod 스키마로 필수 필드 강제 → 미충족 시 400
- `quote-lists` 는 세션이 있으면 `userId` 를 채운다(현재 null 고정이 정상인지 재확인 필요)

## 5. 관계

- §tenant-isolation-placeholder — 발견 경위. A트랙 종료가 선결
- §placeholder-success-audit — "저장 없이 성공" 의 **반대 형태**다. 이쪽은 **의미 없이 저장**한다

---

## 편입 — `quote-lists/[id]/items` PUT 비트랜잭션 삭제 (2026-08-15, 호영님 등급 상향)

```ts
await db.quoteListItem.deleteMany({ where: { quoteId: id } });   // 먼저 실행, 성공
await db.quoteListItem.createMany({ data: items.map(...) });     // 드리프트로 실패 → 500
```

트랜잭션이 아니다. 항목이 있는 리스트에 PUT 하면 **기존 항목이 지워진 채 500** 이 난다.

🛑 **드리프트 수정이 이 위험을 활성화한다.**
D1b 프로브에서 실손실이 0이었던 것은 **픽스처가 0건이었기 때문**이고,
현재 이 경로가 항상 500 이라 사용자가 도달하지 못하기 때문이다.
D1c 가 `vendor`·`snapshot` 을 고치면 **이 경로는 살아나고, 그때 손실이 실제로 발생한다.**

→ 드리프트가 아니라 별건이지만 **§unvalidated-create 계열과 같은 등급**으로 다룬다.
→ D1c 착수 시 이 항목을 **같은 배치 안에서** 처리할지 판단이 필요하다
  (고치고 나서 트랜잭션화하면, 그 사이 창에서 손실이 가능하다).
