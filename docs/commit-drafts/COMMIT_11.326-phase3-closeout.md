test(pdf): §11.326 Phase 3 #closeout — sentinel 추가 + PLAN cluster 갱신 (호영님 P0 PDF 폰트 fix, 2026-05-30)

호영님 P0 §11.326 Phase 3 (GREEN, closeout) — sentinel 회귀 가드 + PLAN 갱신.

배경:
- §11.326 Phase 0+1+2 모두 호영님 push 완료 (commit 9abc1f07 = Phase 2)
- 시나리오 1 (성공) 가정 하 Phase 3 closeout sandbox 작성
- 시나리오 2/3 시: D-1 (폰트 lib/ 이동) 또는 추가 audit 별도 batch
- §11.327 Phase 2 sandbox audit 결과 PLAN 에 추가 (가설 D CSRF 강화)

Fix (Phase 3 — sentinel 신설 + PLAN 갱신):

- apps/web/src/__tests__/regression/pdf-font-bundling-326.test.ts (NEW):
  · 6 describe / 14 it 회귀 가드:
    · Pretendard 폰트 파일 (canonical) 존재 — apps/web/public/fonts/PretendardVariable.ttf existsSync
    · Phase 2 next.config.js outputFileTracingIncludes — quote + order endpoint 폰트 포함 + §11.326 trace marker
    · Phase 2 quote-request-pdf-generator — resolvePretendardPath 헬퍼 + existsSync import + 후보 3개 (process.cwd + monorepo + __dirname) + throw [§11.326] + 옛 Helvetica fallback 잔존 0 + registerFont Korean 보존
    · Phase 2 po-pdf-generator — 동일 패턴
    · Phase 1 vendor-dispatch-workbench — 토스트 actionable + console.error 로깅 + errorTag 분기 (403/404/5xx)

- docs/plans/PLAN_11.326-327-quote-pdf-preferences-403-cluster.md:
  · Status 갱신: §11.326 Phase 3 sandbox closeout 작성 / §11.327 Phase 2 audit 완료
  · 진행 요약 표 추가 (6 batch state)
  · §11.327 Phase 2 audit 결과 추가 — middleware CSRF gate evidence + csrfFetch race-condition + 가설 D/F 강화

canonical 보존 (회귀 가드):
- Pretendard 폰트 파일 보존 단언
- generator 함수 시그니처 + PDF options 보존 (registerFont Korean / font Korean)
- §11.314-b mailto + Quote status SENT 영향 0
- caller 8 file try/catch 시그니처 영향 0 (Phase 1 mitigation 보존)

호영님 production effect (Phase 3 단독):
- production 변화 0 (sentinel + PLAN 갱신만)
- §11.326 회귀 가드 — Phase 2 fix 가 향후 다른 batch 에서 revert 되면 sentinel fail → 조기 감지
- §11.327 root cause 정리 — 호영님 4 info 회신 시 Phase 2 즉시 진입 가능

Out of Scope:
- §11.326 시나리오 2/3 fallback (호영님 Vercel 결과 회신 후 진입)
- §11.327 Phase 2 root cause 수정 (호영님 4 info 회신 후 진입)
- §11.328 (입고 데이터 모델) SPEC sync + 진입

검증 (sandbox 정적 grep):
- sentinel file 6 describe / 14 it ✓
- PLAN 진행 요약 표 + §11.327 audit 결과 갱신 ✓
- production code 변경 0 ✓

Rollback path: git revert <SHA>
- sentinel file 삭제 + PLAN 갱신 revert

## Push (호영님 Vercel 결과 시나리오 1 시 진행)

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/__tests__/regression/pdf-font-bundling-326.test.ts `
  docs/plans/PLAN_11.326-327-quote-pdf-preferences-403-cluster.md `
  docs/commit-drafts/COMMIT_11.326-phase3-closeout.md
git status
git commit -F docs/commit-drafts/COMMIT_11.326-phase3-closeout.md
git push origin main
```

## Production smoke
- N/A (sentinel + PLAN closeout only, production 변화 0)
- vitest run 시 14 it sentinel pass 예상 (production code 가 Phase 2 정합 상태)

## Next
- §11.327 Phase 2: 호영님 production info 4 회신 후 root cause 분기
- §11.328: SPEC sync 후 PLAN 작성 + 진입
- §11.326 시나리오 2/3: D-1 또는 추가 audit 분기
