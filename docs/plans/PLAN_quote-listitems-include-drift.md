# §quote-listitems-include-drift — 존재하지 않는 관계를 include 해서 항상 500

- **Status:** 등재 (2026-08-14) · 🛑 **수정 순서 잠금 — §tenant-isolation-placeholder 해소 뒤**
- **발견 경위:** §tenant-isolation-placeholder 교차조직 쓰기 실측 중 부수 발견

---

## 0. 🛑 먼저 읽을 것 — 이 카드는 **먼저 고치면 안 된다**

이 두 경로는 지금 "막혀 있는" 것이 아니라 **깨져 있어서 안 써지는** 것이다.

교차조직 쓰기 실측에서 확인된 순서:

1. `enforceAction` 의 **조직 게이트를 통과했다** (로그 `org_gate_result: true`)
2. 라우트 내부에 소유권·멤버십 검사가 **없다**
3. 그 다음 줄의 `findUnique` 가 Prisma 오류로 던져서 500

즉 **500 이 유일한 정지선**이다. 이 500 을 고치는 순간 타 조직 쓰기가 그대로 착지한다.
→ **§tenant-isolation-placeholder 의 격리 해소(soft→full 전환 완료) 이후에만 수정한다.**

수정 순서를 뒤집으면 결함 하나를 고쳐서 **유출을 여는 것**이 된다.

## 1. 결함

`Quote` 모델에 `listItems` 관계가 **없다**. 스키마에 있는 것은 `items`(QuoteListItem[])
와 `quoteItems`(QuoteItem[]) 다.

```ts
// ❌ Unknown field `listItems` for include statement on model `Quote`
const quote = await db.quote.findUnique({
  where: { id },
  include: { user: {...}, items: true, listItems: true },
});
```

영향 경로:

| 경로 | 메서드 | 결과 |
|---|---|---|
| `src/app/api/quotes/[id]/status/route.ts:73` | PATCH | 상시 500 (상태 변경 **불능**) |
| `src/app/api/admin/quotes/[id]/items/route.ts` | PATCH | 상시 500 (품목·총액 수정 **불능**) |
| `src/app/api/admin/quotes/[id]/route.ts:31` | GET | 상시 500 (관리자 견적 상세 **불능**) |

## 2. 환경 아티팩트가 아니다

생성 클라이언트 `node_modules/.prisma/client` 의 mtime 이 `prisma/schema.prisma` 와
동일 — **stale client 아님**. 스키마 자체에 `listItems` 가 없으므로 **운영에서도 동일하게
500** 이다. 즉 이 세 경로는 **현재 프로덕션에서 죽어 있다**.

## 2.5 해소 조건 — 동일조직 PATCH **착지** 확인이 포함된다

§tenant-isolation A3 배치 1 에서 교차조직 PATCH 가 403 으로 막히는 것은 확인했다.
그러나 **동일조직 PATCH 가 실제로 착지하는지는 이 드리프트에 가려 확인되지 않았다**
(대조군이 500 이라 통과 여부를 잴 수 없었다).

> **드리프트 해소 시 반드시 함께 잰다 — 동일조직 PATCH → 200 + row 실제 변경.**
> 교차조직 403 만 재고 끝내면 **과차단이 조용히 남는다**(스코프가 정상 요청까지
> 막고 있어도 아무도 모른다).

해소 판정 = ① 교차조직 403 + row 증감 0, ② **동일조직 200 + status/updatedAt 실제 변경**.
①만으로는 해소 아님.

## 3. 수정 방향 (착수 금지, 참고용)

`listItems` → `items` 치환이 자연스러우나, 소비 코드가 `quote.listItems.find(...)` 로
읽는 지점이 있어 **필드명 치환만으로 끝나지 않는다**. 치환 후 `lineTotal`·`raw` 접근이
`QuoteListItem` 스키마와 맞는지 대조 필요.

## 4. 관계

- §tenant-isolation-placeholder — **선결**. 그 트랙이 닫히기 전에는 이 카드를 열지 않는다
- §placeholder-success-audit — 형태가 다르다. 이쪽은 조용한 통과가 아니라 **명시적 500**
