# §vendor-add-by-email — 이메일로 공급사 추가 (기능 신설 트랙)

**등재 2026-08-16** · 축 C(§reorder-handoff) 1c 실측 중 발견 · 대기열

> **원인: 시안이 데이터 없이 그려졌고 fixture 도출이 그걸 안 걸렀다** (2026-08-16 발견, 4슬롯)

## 막고 있는 슬롯 — 1건

```
1c.vendor.add_email   quote-prepare-panel   md §1c line 31 — `이메일로 추가`
```

## 🛑 문안 추가가 아니다 — 기능 전체가 없다

```
패널 prop(on*)   onClose · onProceedToDispatch · onSearchSourcing?
                 → 이메일 추가 핸들러 **0**
소스 문안        `이메일로 추가`  **0건**
API              없음      모달/시트  없음      상태  없음
```

선례와 대조하면 부재가 분명하다 — `소싱에서 찾기` 는 배선돼 있다:

```tsx
<Button type="button" variant="outline" onClick={onSearchSourcing} …>
  <Search … /> 소싱에서 찾기
</Button>
```

🛑 **버튼만 만들면 dead button 이다.** CLAUDE.md 절대 원칙
`dead button / no-op / placeholder success 금지` 위반이고, 축 C 는 문자열만 보므로
**GREEN 을 낸다** — 게이트가 통과시키는 쪽이라 조용하다.

## md 인용

> 공급사 지정 패널(블루 보더 활성): 검색 input + `소싱에서 찾기` / `이메일로 추가`
> + **이전 거래 공급사 추천 1줄**(품목 카테고리 매칭) + `지정`

## 범위 — 기능 신설

```
1  설계 판정   이메일로 "추가" 의 의미부터 — 공급사 레코드 생성인가, 초대 발송인가
              🛑 견적 발송 대상에 이메일만 있는 공급사를 넣는다면 그건
                 Vendor 레코드 없는 발송이다. 기존 발송 인텐트(2-step)와 정합 확인 필요
2  API         공급사 생성/조회 엔드포인트 · 중복 판정(같은 이메일)
3  UI          모달 또는 인라인 입력 + 검증(이메일 형식) + 실패 표기
4  배선        onAddByEmail prop → 패널 버튼
5  sentinel    dead button 0 역계약 — 핸들러 없이 버튼이 생기면 RED
```

1번이 설계 판정이라 이 트랙은 **UI 작업으로 착수하면 안 된다.**

## 🛑 되살림 경로

축 C 에서 `1c.vendor.add_email` 을 미이행 목록에서 내렸다. 기능이 들어오면:

```
1  UNIMPLEMENTED 에 1c.vendor.add_email 재등재 → 길이 잠금 +1
2  대기열 카운트 -1 · 회계 갱신
3  🛑 dead button 역계약 sentinel 동반 — 문안만 들어오고 핸들러가 없으면 RED
```

**자기무효화 앵커**: 축 C 가 패널에 `이메일로 추가` 문자열 부재를 단언한다.
문안이 들어오면 RED 로 알리고, 그때 **핸들러 유무를 함께 재는 것**이 되살림 조건이다.

## 관련

- 축 C 배선 `38c5aed9` · 게이팅 해제 `741abf15`
- 같은 원인의 형제 카드: `CARD_quote-source-field.md`(Quote 출처 필드) ·
  `CARD_quote-item-inventory-snapshot.md`(QuoteItem 재고 스냅샷)
- 🛑 세 카드를 묶지 않는다 — Quote 필드 / QuoteItem 필드 / **기능**은
  구현 단위도 롤백 단위도 다르다.
