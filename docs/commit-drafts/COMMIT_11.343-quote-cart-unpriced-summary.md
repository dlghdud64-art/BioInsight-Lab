# COMMIT — §11.343 견적함 미견적 1줄 요약 + dead button 제거

```
fix(quote-cart) §11.343 #quote-cart-unpriced-summary — 미견적 카드별 반복 경고 → 상단 1줄 요약, 의미 안 맞던 [재고확인][그래도유지] dead button 제거 (호영님 P1)
```

## 호영님 spec
- 견적함 카드마다 ⚠"단가 0원" + [재고확인][그래도유지]가 똑같이 반복되는 평면 구조 → 미견적은 상단 1줄 요약으로.

## 진단
- §11.339-v2 cart 패널은 이미 배포(라이브 빈 상태 문구 verbatim 일치). 색(전체 노랑→보더)은 고쳐졌으나 **반복의 원인은 미수정**.
- 범인 = `request-readiness.ts` line 83-89: `unitPrice<=0`인 **모든 항목**에 `review_required`("단가가 0원") 부여 → page.tsx가 전부 `resolvable:true`로 전달 → 미견적 카드마다 동일 ⚠+버튼.
- `onResolveReview`(재고확인)·`onKeepReview`(유지) 둘 다 "비교에서 제거"만 수행 → 미견적(비교 미포함) 항목엔 **무동작 dead button**.
- "단가 0원"은 경고가 아니라 미견적 정상 상태(아직 견적 요청 전) → 항목별 경고가 의미 오류(§11.337 Part B 안티패턴과 동일).

## Fix (file 별)
- `_workbench/_components/quote-cart-panel.tsx`: `unpricedCount?` prop + 견적함 상단 중립 1줄 요약 "N건은 견적 요청 후 가격이 확정됩니다"(§11.302 중립 톤).
- `_workbench/search/page.tsx`: `reviewFlags`에서 "가격 미확인" 플래그 제외(남는 review만, `resolvable:false`) + `unpricedCount={priceUnknownCount}` 전달. dead button 미렌더. (※ 본 파일은 §11.337-v3 커밋과 다른 hunk — `git add -p`로 분리.)

## Canonical truth 보존
- `request-readiness.ts` 판정 로직 무변경(overall readiness/요약·하단 바 영향 0). cart 패널 표시 단계에서만 가격 플래그 필터 + 요약. quoteItems 원본 무변경.

## Production effect
- 미견적 카드들의 반복 ⚠+버튼 제거. 상단 1줄 요약으로 통합. 카드별 ⚠는 실제로 다른 이슈(비교 진행 중 등)에만, 버튼 없는 사유 텍스트.

## Out of Scope
- `request-readiness.ts` 자체 플래그 의미 재정의(하단 바/readiness level 영향) — 별도 검토.
- 남은 review 플래그("비교 진행 중")용 전용 액션 — 차후.

## Rollback path
- page.tsx reviewFlags hunk를 이전(전체 review_required, resolvable:true)으로 revert + cart 패널 unpricedCount prop/요약 제거. 독립 rollback.

## 검증
- vitest·tsc 미설치 → 자동 **실행 불가**. 정적 검증 완료. 배포 후 견적함 담아 카드 반복 사라짐 + 상단 1줄 Chrome 재검증 예정.
```
footer 없음 (Co-Authored-By 미사용)
```
