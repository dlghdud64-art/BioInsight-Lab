fix(sourcing) §11.367-1 #mobile-detail-dead-button — 모바일 "상세 보기" dead button 해소 (호영님 P-라이브 2026-06-05, §11.312 소싱 묶음)

호영님 spec: 모바일 소싱 결과 카드 "상세 보기" 무반응.

root cause: "상세 보기" onClick→onSelect→setActiveResultId 는 wiring 있으나, 상세
surface(우측 rail QuoteCartPanel/SourcingContextRail)가 search/page.tsx `hidden lg:flex`
= ≥1024px 전용 → 모바일에선 state 만 세팅, 화면 반응 0 = dead.

Fix(search/page.tsx):
- isLgUp 브레이크포인트 게이트(matchMedia min-width:1024px, SSR-safe)
- 상세 rail 노드(SourcingContextRail)를 sourcingRail 로 추출 → detailSlot(데스크탑)·
  모바일 Sheet 공유(이중 정의 0)
- 모바일 bottom Sheet 추가: open={!isLgUp && !!activeResultId} → <lg 에서 동일
  SourcingContextRail(full ProductDetailSummary + 비교/견적 액션 + nextAction) 노출.
  lg:hidden + open 게이트로 데스크탑 이중 렌더 방지.

canonical truth/상세 콘텐츠 불변(ProductDetailSummary 재사용). dead button 제거(no-op 0).

production effect: 모바일에서 상세 보기 → bottom Sheet 로 제품 상세 표시. 데스크탑 rail 불변.

Out of scope: §11.363 소싱 잔여 / 상세 콘텐츠 변경 / 데스크탑 rail 레이아웃.

Rollback: search/page.tsx Sheet 블록 + isLgUp + sourcingRail revert.
