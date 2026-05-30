test(workbench): §11.325b Phase 0+1 #detail-entry-red — Truth Lock + RED sentinel (워크벤치 검색 카드 상세 진입 wiring) (호영님 P1, 2026-05-30)

호영님 P1 §11.325b Phase 0+1 (RED) — 워크벤치 검색 카드 → 제품 상세 wiring 보강.

배경 (§11.325 Truth Reconciliation 결론):
- /products/[id]/page.tsx = 1293 lines 풀 구현 ✓
- 비로그인 ProductCard = 카드 본체 Link wrap (정상 배선) ✓
- 워크벤치 sourcing-result-row.tsx = onSelect → activeResultId state → rail ProductDetailSummary render (동작 정상)
- 핵심 문제 = 시각 affordance 부재:
  · ChevronRight (line 319) onClick 0 = dead UI (시각만, 동작 0)
  · 명시적 "상세 보기" 라벨 0 — onSelect 의미 모호
  · 사용자가 click → rail trigger 인지 못함

호영님 4 결정:
1. 옵션 A — 명시적 "상세 보기" button 추가
2. ChevronRight wiring 추가 (제거 X) + cursor-pointer + hover + button 동일 동작
3. 상세 진입 표면 = product-detail-summary.tsx 패널 (same-canvas) / /products/[id] = 비로그인 진입로만
4. P1 즉시, §11.318-CORRECTION 과 병행 가능

번호 매핑:
- 호영님 spec 번호: §11.321 (제품 상세 진입 동선 Truth Reconciliation + 배선)
- 충돌: §11.321 = 재고 탭 세그먼트 컨트롤 (사용 완료)
- 새 매핑: §11.325 (Truth Reconciliation) + §11.325b (배선)

Fix (Phase 0+1 — Truth audit 결과 plan 갱신 + RED sentinel):

- docs/plans/PLAN_11.325-product-detail-entry-truth-reconciliation.md:
  · Status: ✅ Truth Complete → 🔄 In Progress (§11.325b 진입)
  · §12 추가 audit 결과 (product-detail-summary.tsx 정체 + rail render 위치 + page wiring chain)
  · §13 §11.325b 진입 계획 (호영님 4 결정 반영 + 4 phase 구조 + canonical 보존 + Risk + Rollback)

- apps/web/src/__tests__/regression/
  sourcing-result-row-detail-entry-325b.test.ts (NEW):
  · 4 describe / 8 it 단언
  · §11.325b 명시적 button: testid + onSelect wiring + "상세 보기" 라벨
  · §11.325b ChevronRight: <button> wrap + onClick={onSelect} + cursor-pointer/hover affordance
  · canonical 보존: 카드 본체 onSelect / isSelected / onToggleCompare / onToggleRequest
  · sourcing-context-rail same-canvas: ProductDetailSummary import + render + showDetailLink={true} 보존

canonical 보존 (Phase 3 가드):
- sourcing-result-row.tsx props 시그니처 변경 0 (caller page.tsx 영향 0)
- onSelect={() => setActiveResultId(product.id)} page state 갱신 보존
- isSelected / 비교 추가 / 견적 담기 wiring 보존
- sourcing-context-rail.tsx ProductDetailSummary render 보존 (same-canvas 패턴)
- product-detail-summary.tsx showDetailLink={true} 보존 (/products/[id] 보조 link)
- /products/[id] 라우트 자체 보존 (비로그인 ProductCard 진입로)

Phase 1 RED 상태 예상:
- 8 it 중 canonical 보존 it (3 it = onSelect / isSelected / 비교 견적) 통과
- canonical it (2 it = rail ProductDetailSummary + showDetailLink) 통과
- §11.325b GREEN target it (3 it = 명시적 button + ChevronRight wiring) RED → Phase 2 작업

호영님 production effect (Phase 0+1):
- production 변화 0 (plan + sentinel 만)
- §11.325b 작업 가드 확보 — Phase 2~3 작업이 호영님 4 결정 정합 검증

Out of Scope (Phase 2~3):
- Phase 2: sourcing-result-row.tsx "상세 보기" button 추가 + ChevronRight wiring (단일 file)
- Phase 3: 회귀 통합 + 모바일 + closeout

검증 (sandbox 정적 grep):
- PLAN file 갱신 (§12 audit 결과 + §13 §11.325b 계획) ✓
- sentinel file 4 describe / 8 it ✓
- production code 변경 0 ✓

Rollback path: git revert <SHA>
- sentinel + PLAN 갱신 삭제 (production 영향 0)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add docs/plans/PLAN_11.325-product-detail-entry-truth-reconciliation.md `
  apps/web/src/__tests__/regression/sourcing-result-row-detail-entry-325b.test.ts `
  docs/commit-drafts/COMMIT_11.325b-phase0-1.md
git status
git commit -F docs/commit-drafts/COMMIT_11.325b-phase0-1.md
git push origin main
```

## Production smoke
- N/A (sentinel + plan 만, production 변화 0)

## Next (호영님 push 회신 후)
- Phase 2: sourcing-result-row.tsx 명시적 "상세 보기" button + ChevronRight wiring + cursor-pointer/hover
