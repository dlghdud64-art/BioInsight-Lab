feat(sourcing): §11.339 v2 1단계 #quote-cart-panel — 우측 패널 탭 카트 + 노랑 제거 + 검토 인라인 (호영님 P1, 2026-06-01)

호영님 P1 §11.339 v2 1단계(GREEN) — 하단 드로어 난립 + 빈 우측 패널 + 노란 하이라이트
피로를 우측 탭 카트(견적함/비교함/상세)로 재설계. §11.337 Part C(상세) 통합.

배경 / 현상 (스크린샷 1780304188788 등):
- 우측 패널 방치("제품 선택해 비교" 빈 안내). 견적 후보/검토필요 하단 드로어 2종 경합.
- 견적함·검토 카드 전체 노란 배경(§11.302 위반 — 전항목 노랑=의미상실+피로).

호영님 결정: 신규 컴포넌트 분리 + 단계적. (1단계=탭+견적함+노랑제거+검토인라인 / 2단계=하단드로어 제거+상세탭 완성)

Fix (file 별):

- src/app/_workbench/_components/quote-cart-panel.tsx (신규, 304줄):
  · QuoteCartPanel — 탭(견적함/비교함/상세) + badge 건수. forceDetailKey 변경 시 상세 탭 전환.
  · 견적함: quoteItems + 수량(−/input/+, 단위) + 제거. 카드 배경 중립(bg-white).
    검토필요 = 항목 아래 인라인 경고(좌측 보더 border-l-yellow-400 + ⚠ 배지만, 전체 노랑 X) +
    [재고 확인]/[그래도 유지] 액션. + "견적 요청서 만들기" CTA.
  · 비교함: compareIds 제품 목록(중립 카드) + 제거.
  · 상세: detailSlot(부모 SourcingContextRail 주입 §11.337 Part C) / 빈 안내.
  · §11.338 가격: 미견적 unitPrice<=0 → "견적 후 확정"(₩0 표시 X).

- src/app/_workbench/search/page.tsx:
  · 우측 패널(빈 안내 + railProduct 직접 렌더) → <QuoteCartPanel> 교체.
  · quoteItems/compareItems(compareIds→products) 매핑, reviewFlags = requestReadiness review_required.
  · detailSlot=railProduct ? <SourcingContextRail/> : null, forceDetailKey=activeResultId.
  · 핸들러 wiring: onQuantityChange=updateQuoteItem, onRemove*, onResolve/KeepReview=toggleCompare,
    onQuoteRequest=request-assembly/wizard.

canonical truth / 제약:
- quoteItems/compareIds 단일 소스(updateQuoteItem/toggleCompare). 우측 카트는 그 투영.
- §11.302 색상(노랑=실제 주의 배지/보더만, 전체 배경 X). §11.337 Part C(상세) 우측 통합.
- §11.338 가격(견적 후 확정). dead button 0. same-canvas(우측 패널, 새 페이지 X).

production effect:
- 담은 견적/비교가 우측 탭에 상시 표시(하단 클릭 불필요). "상세 보기" → 상세 탭 자동 전환.
- 검토 필요가 별도 드로어 아닌 해당 항목 아래 인라인 경고. 카드 노란 배경 제거(눈 피로 ↓).

검증 (sandbox):
- sentinel quote-cart-panel-339v2.test.ts: 탭 구조/forceDetail + 견적함 수량/중립카드/검토인라인 +
  §11.338 가격 + search 연결(import/detailSlot/forceDetailKey/reviewFlags/wiring). 전체 PASS.
- 2파일 brace/paren 무결. truncation 0(search +28 = panel 교체 순증).
- 빌드 = 호영님 env.

Out of Scope (2단계 = 별도):
- 하단 드로어(SourcingCandidatesSheet quote/review) 제거 — 1단계는 병존(같은 quoteItems 소스라 모순 0).
  2단계에서 하단 바 = 요약+CTA로 정리 + 드로어 제거.
- 상세 탭 ↔ 견적함 깜빡임 정밀 튜닝(현재 forceDetailKey 전환).

Rollback path: git revert <SHA>
- QuoteCartPanel import/렌더 제거 → 기존 railProduct/빈안내 블록 복원, quote-cart-panel.tsx 삭제.

## Push
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build
cd ..\..
git add apps/web/src/app/_workbench/_components/quote-cart-panel.tsx `
  apps/web/src/app/_workbench/search/page.tsx `
  apps/web/src/__tests__/regression/quote-cart-panel-339v2.test.ts `
  docs/commit-drafts/COMMIT_11.339-v2-quote-cart-panel.md
git commit -F docs/commit-drafts/COMMIT_11.339-v2-quote-cart-panel.md
git push origin main
```

## Production smoke (호영님 env)
1. 검색 → 견적 담기 → 우측 견적함 탭 즉시 누적(수량 −/+ 동작).
2. 검토 필요 항목 = 카드 아래 인라인 경고(노란 배경 아님, 좌측 보더+⚠).
3. "상세 보기" → 상세 탭 자동 전환(SourcingContextRail).
4. 비교 담기 → 비교함 탭.
5. 미견적 가격 "견적 후 확정".

## Next
- 2단계: 하단 드로어 제거 + 하단 바 요약/CTA 일원화 + 상세↔견적함 전환 정밀화. Opus 4.8.
