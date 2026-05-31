fix(purchases): §11.331-a #quote-detail-rail — 견적 상세 페이지 점프 → same-canvas Rail (호영님 P1, 2026-06-01)

호영님 P1 §11.331-a (GREEN) — 구매 운영 "견적 상세" 클릭 시 견적 관리로
페이지 이탈하던 버그를 same-canvas Rail 열기로 정정.

배경 / 호영님 spec:
- 스크린샷 1780242756055: 구매 운영 → 견적 카드 "견적 상세" 클릭 →
  /dashboard/quotes 로 페이지 점프 = 구매 운영 컨텍스트 이탈.
- §11.330 상세 패널(same-canvas) 패턴 위반.

Truth Reconciliation (AUDIT_11.331):
- 구매 운영(purchases/page.tsx)에는 이미 Rail 인프라 존재(selectedId/selectedItem/
  closeRail + Rail 렌더 922-). 카드 클릭 → setSelectedId 로 Rail 열림.
- 버그 = 큐 카드 "견적 상세" 버튼만 <Link href=/dashboard/quotes/${item.id}> 하드 점프.
- → 화면 신설 불필요. Link → Rail 열기 국소 교체.

Fix (purchases/page.tsx):
- 큐 카드 "견적 상세" <Link> 제거 → <Button onClick={setSelectedId(item.id)}>
  (data-testid="purchases-quote-detail-rail"). e.stopPropagation 유지.
- Rail 내부 deep-dive Link(selectedItem)는 보존하되 라벨 "견적 상세 페이지 열기"
  → "전체 견적 페이지 열기" 로 명확화(Rail 안에서 전체 페이지로의 의도적 secondary).

canonical truth / 제약:
- same-canvas 복원(workbench/queue/rail 유지). page-per-feature 회귀 0.
- dead button 0 — 버튼이 real Rail open handler 에 wiring.
- Rail/탭/preference 인프라 무변경.

production effect:
- 구매 운영에서 견적 상세 클릭 → 같은 화면 우측 Rail 에 견적 컨텍스트(브리핑/
  blocker/nextAction) 표시. 페이지 이탈 0.
- Rail 안 "전체 견적 페이지 열기"로 필요 시 deep-dive(견적 관리 화면) 가능.

검증 (sandbox):
- sentinel 8/8 PASS (purchases-quote-detail-rail-331a.test.ts): rail testid +
  onClick setSelectedId + 큐카드 Link 점프 제거 + Rail deep-dive Link 보존 + closeRail 보존.
- 파일 무결 brace/paren/eof balanced (1663줄, HEAD 복원 후 Python 원자 치환).
- 빌드/타입체크 = 호영님 env.

Out of Scope:
- §11.331-b: 견적 관리 + 발주 관리 → 구매 운영 탭 흡수(메뉴 통합). §11.55 발주
  dead-end 정리 이력 역전 충돌 검토 필요 = 별도 큰 batch.

Rollback path: git revert <SHA>
- 큐 카드 Button → 원래 <Link href=/dashboard/quotes/${item.id}> 복원, 라벨 환원.

## Push
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build
cd ..\..
git add apps/web/src/app/dashboard/purchases/page.tsx `
  apps/web/src/__tests__/regression/purchases-quote-detail-rail-331a.test.ts `
  docs/plans/AUDIT_11.331-purchase-ops-unify.md `
  docs/commit-drafts/COMMIT_11.331a-quote-detail-rail.md
git commit -F docs/commit-drafts/COMMIT_11.331a-quote-detail-rail.md
git push origin main
```

## Production smoke (호영님 env)
1. 구매 운영 진입 → 견적 카드 "견적 상세" 클릭.
2. 페이지 이동 없이 우측 Rail 열림 + 견적 컨텍스트 표시 확인.
3. Rail "전체 견적 페이지 열기" → 견적 관리 화면 정상 이동(deep-dive 보존).
4. (회귀) 카드 클릭/다음단계 chip → Rail 열림 정상, 발주 전환 동작 보존.

## Next
- §11.331-b 메뉴 통합(견적·발주 흡수) — §11.55 충돌 결론 후 별도 batch.
- §11.332 dead 항목 정리 — 호영님 방향 결정 후.
