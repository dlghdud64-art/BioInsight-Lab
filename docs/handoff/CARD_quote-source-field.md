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

## 🛑 되살림 경로 (안 적으면 영구히 안 돌아온다)

축 C 에서 `1d.card.origin` 을 미이행 목록에서 내렸다. 스키마가 들어오면:

```
1  reorder-handoff-impl-conformance.test.ts 의 UNIMPLEMENTED 에 1d.card.origin 재등재
2  길이 잠금 6 → 7 로 되돌린다
3  "1d.card.origin — 대기열 이관 · 되살림 앵커" it 을 실 대조로 교체
```

**자기무효화 앵커가 이미 배선돼 있다.** 그 it 이 `Quote` 모델에 `sourceType|sourceKind|sourceId`
가 없음을 단언하므로, 스키마가 들어오는 순간 **RED 로 "되살릴 때다" 를 알린다.**
화이트리스트가 아니라 3층이다 — 해제 조건이 코드로 판별된다.

## 관련

- 축 C 배선 `38c5aed9` · 게이팅 해제 `741abf15` · md 조건절 `1bb18679`
- `sourceMeta: null` 결정 `acb71541` (2026-08-06 · 지시문 2026-08-05)
- 선례: `CartItem.sourceType` (schema.prisma:2141)
