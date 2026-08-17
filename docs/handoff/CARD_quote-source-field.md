# §quote-source-field — `Quote` 출처 축 부재 (스키마 트랙)

**등재 2026-08-16** · 축 C(§reorder-handoff) 배선 중 발견 · 대기열

## 🛑 이건 "origin 표기 추가" 가 아니다 — 모델 간 축 불일치다

제목을 UI 로 읽으면 카드 렌더만 고치러 간다. 실제 문제는 스키마다.

```
CartItem   sourceType  String @default("MANUAL")   // MANUAL | REORDER | SEARCH
           sourceId    String?                     // 원본 ID (재주문 시 inventoryId 등)
Quote      출처 축 0건                              ← schema.prisma:595-667 실측
```

장바구니 경로는 출처를 **canonical 로** 들고 있는데 견적 경로는 안 들고 있다.
재발주 시트가 만드는 것은 `Quote` 이므로 `CartItem.sourceType` 이 닿지 않는다.

## 우회 흔적과 그 폐쇄

`ReorderReviewSheet` 이 문자열을 조립해 넣은 것이 그 부재를 우회한 흔적이다:

```ts
specialNotes: `재고관리 재발주안에서 생성 · ${reason}`
```

🛑 **역파싱 금지가 md 에 박혔다**(`1bb18679`). 우회로는 닫혔다 —
출처를 알아야 표기할 수 있고, 알려면 필드가 있어야 한다.

## 근거 — md 전문 (`docs/specs/재발주 견적 핸드오프 흐름.md` §1d line 38)

> 카드: RFQ 번호(IBM Plex Mono) + 품목×수량 + `재고관리 재발주안에서 생성 · 2026. 8. 1.`
> (**연도 포함 표기 통일**).
>   - 🛑 **출처가 확정된 경우에 한한다. 미상이면 표기를 생략한다**(날짜 행만 남긴다).
>     근거: 상위 제약 `가짜 출처 표기 금지 — 출처를 모르면 적지 않는다`. canonical truth 를
>     UI 로 지어내지 않는 것이 이 문서보다 위다.
>     ⚠️ `specialNotes` 문자열 역파싱은 출처 확정 근거로 쓰지 않는다 — canonical 이 아니다.

조건절은 이 카드가 열릴 때까지 **표기 생략이 정합**임을 뜻한다. 지금 RED 가 아닌 이유다.

## 범위 — 4단계

```
1  schema      Quote.sourceType (MANUAL|REORDER|SEARCH…) + sourceId   ← CartItem 선례 승계
2  migration   🛑 push ≠ 적용. 이 repo 는 ADR-002 로 자동 적용 차단(vercel-migrate.js NO-OP)
               4스텝: push → 배포 → operator `migrate deploy` → health
               DDL 선행 순서 · DIRECT_URL(5432) 필수
3  생성 경로    ReorderReviewSheet 의 견적 초안 생성 시 sourceType='REORDER' 기입
               `sourceMeta` 파생을 그 필드에서 (문자열 조립 아님)
4  카드 렌더    mobile-quotes-view 의 `생성` 행에 출처 문구 결합
               quote-prepare-panel:142 이 이미 `[sourceMeta, createdLabel].join(" · ")` 로
               md 형식을 조립한다 — 같은 파생을 카드에 재사용
```

## 이 카드가 막고 있는 슬롯 — **3건** (2026-08-16 확정)

```
1d.card.origin     mobile-quotes-view   렌더 배선 없음 · 출처 필드 0   → 대기열
1c.header.origin   quote-prepare-panel  렌더 배선 **있음** · 값이 null → 대기열
1c.item.badge      quote-prepare-panel  `재고관리에서 연동` 배지        → 🆕 도달 불가
```

셋 다 같은 축이다 — 같은 `quotes` 배열 · 같은 `Quote` 레코드 · 같은 출처 필드 부재.
차이는 렌더 배선 유무뿐이다.

🔴 `1c.item.badge` 는 성격이 하나 더 다르다. **소스에 문자열이 있는데 렌더되지 않는다**:

```tsx
{quote.sourceMeta && (          // ← page.tsx:4419 가 항상 null 을 넘긴다
  <span …>재고관리에서 연동</span>
)}
```

축 C 는 **존재는 보지만 도달은 못 본다** — 이 배지는 축 C 에서 GREEN 이었다(2026-08-16 발견).
`Render-Reachability`(dead file)의 **분기 단위 버전**이다. 스키마가 들어오면 배지도 함께 살아난다.

## 🛑 되살림 경로 (안 적으면 영구히 안 돌아온다)

축 C 에서 위 3건을 미이행 목록에서 내렸다. 스키마가 들어오면:

```
1  UNIMPLEMENTED 에 1d.card.origin + 1c.header.origin 재등재 → 길이 잠금 5 → 7
2  UNREACHABLE 의 1c.item.badge 를 **실 대조로 승격**(도달 가능해지므로) → 길이 잠금 1 → 0
3  "origin 2슬롯 — 대기열 이관 · 되살림 앵커" it 을 실 대조로 교체
4  커버리지 회계 갱신: 대조 45 → 48 · 미이행 5 → 7 · 대기열 2 → 0 · 도달불가 1 → 0
```

**자기무효화 앵커가 이미 두 개 배선돼 있다** — 화이트리스트가 아니라 3층이다:

```
스키마 앵커   Quote 모델에 source(Type|Kind|Id) 부재를 단언
              → 스키마가 들어오면 RED 로 "되살릴 때다" 를 알린다
게이트 앵커   page.tsx 가 `sourceMeta: null` 임을 단언
              → 값이 채워지면 RED 로 "도달 가능해졌으니 승격하라" 를 알린다
```

⚠️ 둘 다 **무효 단언 방어**를 포함한다(모델 슬라이스 길이 · 파일 길이 검사).
`not.toMatch` 는 대상이 빈 문자열이면 공집합에 통과한다.

## 관련

- 축 C 배선 `38c5aed9` · 게이팅 해제 `741abf15` · md 조건절 `1bb18679`
- `sourceMeta: null` 결정 `acb71541` (2026-08-06 · 지시문 2026-08-05)
- 선례: `CartItem.sourceType` (schema.prisma:2141)
