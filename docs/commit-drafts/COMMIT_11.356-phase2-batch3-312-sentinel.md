# COMMIT — §11.356 Phase2 batch3: §11.312 sentinel을 §11.339 v2 동작으로 갱신 (코드 0)

```
test(regression) §11.356 #sourcing-sentinel-realign — §11.312 sourcing-bar sentinel 을 §11.339 v2(sheet→탭전환) 동작에 맞게 갱신 (stale 단언 정정, 코드 변경 0)
```

## 분류 정정: (a)dead button → (b)stale 테스트
- batch2에서 §11.312를 "confirm된 dead button(P-라이브)"로 분류 = **오판**(render=0만 보고 단정).
- 코드 정독: bar(비교/견적/검토)는 살아있음. §11.339 v2가 SourcingCandidatesSheet 드로어를 **의도적 제거 → QuoteCartPanel 탭전환 일원화**. bar onClick = `setCompareFocusKey`/`setQuoteFocusKey`/`setReviewFocusKey` → forceQuoteKey/forceCompareKey 탭 전환. testid(compare-open/quote-open/review-count) 존재.
- 즉 §11.312 sentinel(옛 sheet 설계 단언) = **stale**.

## Fix (테스트만, 코드 0)
- `__tests__/regression/sourcing-bar-ux-312.test.ts` — search/page wiring 단언 4건 갱신:
  - `setCandidatesSheetMode("compare")` → `setCompareFocusKey`
  - `setCandidatesSheetMode("quote")` → `setQuoteFocusKey`
  - `sourcing-bar-review-open` + `setCandidatesSheetMode("review")` → `sourcing-bar-review-count` + `setReviewFocusKey`
  - "Sheet 렌더" it → "QuoteCartPanel forceKey 탭전환" it (`<QuoteCartPanel`/`forceQuoteKey=`/`forceCompareKey=`)
  - 헤더에 §11.339 v2 supersede 노트.
- 컴포넌트(SourcingCandidatesSheet) 단언·회귀 단언·import·state·color·trash·preview = 보존(PASS 유지).

## 검증 (vitest)
- sourcing-bar-ux-312 → **22/22 passed**. python 패치(Edit truncation 회피).

## Canonical truth
- production 코드 변경 0. SourcingCandidatesSheet 컴포넌트 파일 보존(타 사용처 가능). 테스트를 최신 설계(§11.339 v2)에 정합.

## 확장 — §11.312-b · §11.339-v2-4 동일 갱신 (같은 커밋)
- §11.312-b: sheet 보존 가드 → QuoteCartPanel/FocusKey 정합.
- §11.339-v2-4: forceQuoteKey 합산식 `{(reviewFocusKey + quoteFocusKey)` 정합.
- 3종(312+312b+339v2-4) 합산 **34/34 green. 코드 0.**

## 확장 2 — §11.314-b · §11.339-1 도 stale (P-라이브 후보 전멸, 같은 커밋)
- §11.314-b: Pretendard 한글폰트 임베드 정상 + §11.326 Helvetica fallback 제거 → 테스트 `doc.font("Helvetica")` 단언을 `.not.toMatch` 로 갱신.
- §11.339-1: 수량조절(updateQuoteItem) 생존 + 가격판정 cart priceText 이동 → unit/price 호출부 단언을 코드현실로 갱신.
- **P-라이브 후보 4건 전부 stale 확정. 라이브 결함(a)=0.** 5종 sentinel 갱신, 코드 0, 합산 green.

## Rollback
- 테스트 4 단언 revert. 독립.
```
footer 없음
```
