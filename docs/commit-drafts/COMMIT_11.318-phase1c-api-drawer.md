feat(compare): §11.318 Phase 1c #api-drawer — 대체품/벤더 추천 API + same-canvas 드로어 wiring (호영님 P1, 2026-05-30)

호영님 P1 §11.318 Phase 1c (GREEN) — 신규 추천 API + sourcing 드로어 + compare page CTA wiring.

배경:
- Phase 1a/1b: 추천 코어(순수 함수 buildSourcingRecommendation) 완료
- Phase 1c: API 라우트 + same-canvas 드로어 + 제품 행 CTA wiring (dead button 0)
- 환각 차단: 데이터 없으면 hasData=false, 빈 상태 + 견적 유도. 추정 전략 미생성.

Fix (Phase 1c — 신규 4파일):

- apps/web/src/app/api/sourcing/recommend/route.ts (NEW):
  · GET /api/sourcing/recommend?productId=<id>
  · auth() + getAuthUser() 인증 (§11.309c 패턴)
  · Product 조회 → RecommendTarget (catalogNumber/itemName/category)
  · PurchaseRecord findMany (scopeKey=user.id, OR: itemName/catalogNumber/category)
  · QuoteListItem findMany → parseLeadTimeDays → LeadTimeIndex 구성
  · buildSourcingRecommendation(records, target, leadTimeIndex) 호출
  · sourceLabel: "과거 구매 기록 기반" 응답 포함
  · 환각 차단: buildLocalAnalysis/추정 전략/estimatedPrice 코드 0

- apps/web/src/app/compare/_components/sourcing-recommendation-drawer.tsx (NEW):
  · SourcingRecommendationDrawer export (Sheet same-canvas, 신규 page 0)
  · useQuery → GET /api/sourcing/recommend?productId=...
  · hasData=true: VendorRow(최저가/최단납기 뱃지) + SubstituteRow(reason 표시)
  · hasData=false: EmptyState + "견적 요청하기" CTA (/compare/quote)
  · loading / error 상태 testid (sourcing-loading / sourcing-error)
  · "과거 구매 기록 기반" 뱃지 (sourcing-source-badge)
  · 납기 미확인 — leadTimeSource=unknown 시 "(미확인)" 표시 (지어내기 0)
  · dead button 0: 모든 CTA real wiring (Link /compare/quote)

- apps/web/src/app/compare/page.tsx (wiring):
  · SourcingRecommendationDrawer import
  · showSourcingDrawer / sourcingProductId / sourcingProductName state 추가
  · 제품 행 "대체품/벤더 찾기" button (data-testid="sourcing-find-btn") + onClick wiring
  · <SourcingRecommendationDrawer> render (productId / productName / onOpenChange)
  · 기존 CompareAnalysisDrawer 보존

- apps/web/src/__tests__/regression/sourcing-recommendation-api-drawer-318c.test.ts (NEW):
  · 4 describe / 20 it sentinel
  · A: API 파일 9 단언 (GET/auth/PurchaseRecord/QuoteListItem/buildSourcingRecommendation/sourceLabel/환각0)
  · B: 드로어 14 단언 (export/Sheet/뱃지/hasData/EmptyState/CTA/loading/error/미확인/no-page)
  · C: page.tsx 8 단언 (import/state/btn/props/CompareAnalysisDrawer 보존)
  · D: canonical 보존 3 단언 (코어 strategy 0/no-page/Sheet패턴)

canonical 보존 (회귀 0):
- sourcing-recommendation.ts 코어 변경 0 (환각 경계 유지)
- compare/page.tsx 기존 CompareAnalysisDrawer + showAnalysisDrawer 보존
- compare-analysis-drawer.tsx 변경 0
- 신규 page route 0 (same-canvas Sheet만)

호영님 production effect:
1. 제품 비교 화면 각 제품 행 "대체품/벤더 찾기" 버튼 노출
2. 클릭 → 우측 Sheet: 과거 구매 이력 있는 경우 벤더별 단가/납기 비교
3. 구매 이력 없는 경우 → 빈 상태 + "견적 요청하기" CTA (실 wiring)
4. "과거 구매 기록 기반" 뱃지 — 출처 투명성 확보

Out of Scope (Phase 1d~1e):
- 직접 비교 카테고리 가드 block 전환 (Phase 1d)
- buildLocalAnalysis 억제 (Phase 1d)
- 모바일 smoke + 최종 closeout (Phase 1e)

검증 (sandbox 정적 grep):
- 31/31 패턴 통과 ✓

Rollback path: git revert <SHA>
- 4파일 revert (API/드로어/page wiring/sentinel) — Phase 1a/1b 영향 0
