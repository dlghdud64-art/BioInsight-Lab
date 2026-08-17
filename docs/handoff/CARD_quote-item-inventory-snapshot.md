# §quote-item-inventory-snapshot — `QuoteItem` 재고 스냅샷 부재 (스키마 트랙)

**등재 2026-08-16** · 축 C(§reorder-handoff) 1c 실측 중 발견 · 대기열

> **원인: 시안이 데이터 없이 그려졌고 fixture 도출이 그걸 안 걸렀다** (2026-08-16 발견, 4슬롯)

## 막고 있는 슬롯 — 1건

```
1c.item.evidence   quote-prepare-panel   md `근거(현재/안전)` 수치 표시 요구
```

## 🛑 UI 미이행이 아니다 — 데이터 부재다

```
md 명세    재발주 견적 핸드오프 §1c line 30
           `품목 카드: 품목×수량 + 재고관리에서 연동 배지 + 근거(현재/안전)`
패널 prop  items: Array<{ name: string; quantity: number }>
page 조립  items: { id, product: { id, name }, quantity }
실측       safetyStock · currentQuantity  → **0건**
```

`현재 N / 안전 M` 을 렌더할 데이터가 견적 품목에 없다. 재고 스냅샷을 붙여야 한다.

⚠️ 시안(`1c.item.evidence`)의 seed 는 `현재 1 / 안전 10` 이고 fixed 는 `근거 자동 첨부` 다.
**fixed 문안은 md 에 없다** — md 는 값을 요구하고 시안은 첨부 사실을 알린다.
축 C 에서 `근거 자동 첨부` 는 **제외 목록 + 축 B 병기**로 처리했다(fixture 는 정본이라 무수정).

## 범위

```
1  스키마 판정   QuoteItem 에 재고 스냅샷을 둘지, 생성 시점 값만 복사할지
                🛑 라이브 재고를 조회하면 "생성 시점 근거" 가 아니게 된다 —
                   근거는 스냅샷이어야 한다(시점 고정). 이게 설계 판정이다
2  migration     4스텝 (push → 배포 → operator migrate deploy → health) · ADR-002 자동적용 차단
3  생성 경로     ReorderReviewSheet 견적 초안 생성 시 현재/안전 재고를 QuoteItem 에 기입
4  패널 렌더     items prop 확장 + `현재 N / 안전 M` 렌더
```

## 🛑 되살림 경로

축 C 에서 `1c.item.evidence` 를 미이행 목록에서 내렸다. 스키마가 들어오면:

```
1  UNIMPLEMENTED 에 1c.item.evidence 재등재 → 길이 잠금 +1
2  대기열 카운트 -1 · 회계 갱신
3  제외 목록의 `근거 자동 첨부` 는 그대로 — md 미명세 문안이므로 축 B 몫이다
```

**자기무효화 앵커**: 축 C 가 `QuoteItem` 모델에 재고 필드 부재를 단언한다.
스키마가 들어오면 RED 로 "되살릴 때다" 를 알린다.

## 관련

- 축 C 배선 `38c5aed9` · 게이팅 해제 `741abf15` · 도달불가 축 `9db7b6fa`
- 같은 원인의 형제 카드: `CARD_quote-source-field.md`(Quote 출처 필드) ·
  `CARD_vendor-add-by-email.md`(기능 전체)
- 🛑 세 카드를 묶지 않는다 — Quote 필드 / QuoteItem 필드 / 기능은
  구현 단위도 롤백 단위도 다르다. 묶으면 스키마 한 건 들어올 때 셋 다 되살려야 하는 걸로 읽힌다.
