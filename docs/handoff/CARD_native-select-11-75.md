# §11.75 native `<select>` 위반 9건 — 제품 트랙 (착수 안 함)

**등재 2026-08-19** · 게이트 정제 후 목록 확정 · **다음 세션 착수**

🛑 **오늘 안 한다.** UI 변경 9곳이고 회귀 위험이 있다. 세션 끝자락에 몰아 할 일이 아니다.

## 목록 (정제 후 · 오탐 0)

```
app/_workbench/search/page.tsx:1109
app/dashboard/settings/suppliers/page.tsx:752
app/legal/page.tsx:263
app/pricing/page.tsx:455
app/protocol/bom/page.tsx:890
components/quotes/dispatch/batch-dispatch-sheet.tsx:368
components/quotes/dispatch/batch-reminder-sheet.tsx:375
components/receiving/receiving-desktop-list.tsx:216
components/safety/MsdsBulkRegisterModal.tsx:157
```

근거: `baselines/native-select-after.txt` · 오탐 제거 근거는 `native-select-filter-refinement.md`.

## 왜 금지인가 (§11.71 / §11.75)

```
(a) hover/animation 약함   (b) 한국어·dark theme 잔재 invisible 위험
(c) Radix accessibility 미지원
→ shadcn <Select> (Radix) 로 통일
```

## ⏱ 기한 — 시한부 조건 (호영님 2026-08-19)

```
착수    다음 세션
미달 시  그 세션에서 못 닫으면 **그때 재판정**한다(연장 · 축소 · 게이트 완화 중 택일)
```

🛑 시한부의 의미는 **무기한 방치 금지**이지 "오늘 안"이 아니다.
   서둘러 UI 9곳을 고치는 쪽이 더 위험하다:

```
배포      Vercel 독립 · 안 막힘
PR 체크   빨감 — 그러나 CI 가 (A)라면 이미 4주간 빨갰다(하루 더는 새 손해가 아니다)
```

## 착수 시 규율

```
1  한 곳씩. 9곳을 한 배치로 묶지 않는다
2  각 <select> 의 value/onChange → shadcn value/onValueChange 매핑 확인
   🛑 빈 option(value="") 은 shadcn 이 금지 — sentinel 값("none") + 호출부 변환 필요
3  변경 후 해당 화면 sentinel 전수 + tsc
4  게이트는 9 → 8 → … 로 줄어야 한다. 안 줄면 필터가 아니라 수정이 틀린 것
```

## 관련

- `baselines/native-select-filter-refinement.md` — 13 → 9 정제 근거
- `CARD_gate-script-silent-fail.md` — 이 위반들이 왜 안 잡혀 왔나
- ADR-002 §11.71 · §11.73
