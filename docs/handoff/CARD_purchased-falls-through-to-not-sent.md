# §purchased-falls-through-to-not-sent — 발주된 견적이 "발송 대기" 로 떨어진다

**등재 2026-08-24** · P4 2상 직후 프로덕션 실측 · 이번 슬라이스가 만든 것이 **아니다**

🛑 `PURCHASED` 견적이 UI 파생에서 `request_not_sent` 로 fallthrough 한다.
발주가 끝난 건에 **"발송"** CTA 가 붙는다. dead button 이 아니라 **위험한 button** 이다.

## 실측 (2026-08-24 · prod · 전체 새로고침 · 캐시 아님)

```
DB      quote 6QRG  status PURCHASED   (주문 SKSQ ORDERED · 예약 850,000 활성)
화면    단계 "발송 대기" · 회신 "회신 전" · 다음단계 [발송]
KPI     현재 집중 "4 발송 대기"  ← 발주 완료건이 섞여 있다
```

취소 후 `COMPLETED` 였을 때는 "전환 가능 / 발주 준비" 로 정상이었다. 주문 접수가
**성공**해서 `PURCHASED` 가 된 순간 표시가 뒤로 돌아간다.

## 원인 — 분기 부재로 인한 fallthrough

```ts
// app/dashboard/quotes/page.tsx:178
function deriveRailState(q: Quote): RailState {
  if (q.status === "COMPLETED")  return "ready_for_po_conversion";
  if (q.status === "RESPONDED")  ...
  if (q.status === "SENT")       ...
  return "request_not_sent";      // 🛑 PURCHASED · CANCELLED 가 여기로 떨어진다
}
```

`deriveStage`(lib/quote-management/derive.ts:44)는 `PURCHASED → s5`, `CANCELLED → null`
로 제대로 갖고 있다. **두 파생이 갈라져 있다.**

### 형제 슬롯 (파일:줄 · 추정 0)

```
app/dashboard/quotes/page.tsx:178    deriveRailState   ← 화면이 실제로 쓰는 것
lib/quote-case-contract.ts:117       deriveUiState     ← 같은 로직 복붙 · 같은 결함
```

🛑 **또 그 모양이다** — 같은 판정이 두 곳에 복붙돼 있고 한쪽만 고치면 갈라진다.
오늘 이 저장소에서 네 번째다(P3-3 예약 해제 · ALREADY_ORDERED · 취소 복귀 · 이것).
⚠️ 단 `deriveUiState` 는 현재 외부 소비자 0 (grep 결과 quote-case-contract.ts 내부 전용).
   그래서 화면 증상은 page.tsx 것만 낸다. 그래도 둘 다 고쳐야 다음에 안 갈라진다.

## 파급 — CTA 오표시로 끝나지 않는다

```
1  잘못된 CTA        발주 완료 건에 [발송] — 누르면 공급사 재전송이 실행된다
2  일괄 선택 오염     isSelectable = deriveRailState === "request_not_sent" (:3546·:3558·:3573)
                     → 발주 완료 견적이 일괄 발송 체크박스로 선택 가능
3  일괄 집계 오염     :2208 전체선택 · :2253 · :2697 selectablePending
4  KPI 오염          "발송 대기" 카운트에 발주 완료건 포함
5  CANCELLED 동일     취소된 견적도 "발송 대기" 로 뜬다 (같은 fallthrough)
```

## 왜 지금까지 안 보였나

발주 접수가 프로덕션에서 성공한 적이 거의 없었다. ⑪ 이전 구 UserBudget 경로는 완주
0회였고(P2028 카드), 이후에도 §cancel-restores-quote 두 겹이 막고 있었다.
**결함이 아니라 결함을 볼 기회가 없었던 것이다** — 오늘 발주가 처음으로 정상 완주하면서
드러났다.

## 착수 시 측정 항목

```
1  RailState 에 PURCHASED 를 넣을지, 퍼널 밖으로 뺄지 — 화면 문법 판정 필요
   (deriveStage 는 s5 로 넣는다 · deriveRailState 는 "작업이 남은 케이스" 축일 수 있다)
2  CANCELLED 도 같은 처리인가 — deriveStage 는 null(퍼널 밖)로 다르게 본다
3  isSelectable / 일괄 집계 3곳이 새 상태에서 무엇을 세야 하는가
4  RAIL_STATE_MAP 에 새 키를 넣으면 badge·CTA·workWindow 까지 정의해야 한다 — 전 필드 필요
5  "발송 대기" 필터·KPI 의 모집단 정의가 어디에 또 있는지 전수
```

## 관련

- `CARD_cancel-does-not-restore-quote.md` — 이 결함이 드러나게 만든 슬라이스
- `PLAN_order-entry-rewire.md` — P4 실측 중 발견
