chore(lib): §11.302d-6c-2 #lib-amber-removed — lib 23 file amber/orange → yellow (design-tokens warning / safety high red 격상) (호영님 P2 sweep 옵션 A, 2026-05-27)

호영님 P2 sweep 옵션 A — 6c-2 = lib (상수/디자인토큰/adapter, file별 의미 분석).

Fix (lib 23 file sed + design-tokens/safety 개별 + 1 NEW sentinel):

- apps/web/src/lib/design-tokens.ts:
  · severity.warning: border-l-amber-500 → border-l-yellow-500
  · TEXT.warning: text-amber-400 → text-yellow-400
  · critical(red) / info(blue) / success(emerald) 보존

- apps/web/src/lib/utils/safety-visualization.ts (호영님 옵션 A — high red 격상):
  · high("위험") block (2곳) + ternary: orange → red
    (critical border-red-300 / high border-red-200 미세 구분)
  · 안전 위험도 과소표시 방지 (바이오/제약 안전 우선). soft_limit→red 선례 정합.
  · critical(매우 위험)=red / medium·low=yellow 보존

- apps/web/src/lib/**/*.ts (나머지 21 file, ~34 occ):
  · sed amber/orange → yellow
  · 우선순위(high/P1) / 중요(SIGNIFICANT) / 만료(EXPIRING) / 진행(receiving) /
    정리(normalization) status = yellow (긴급/주의, 위험/destructive 아님)

- apps/web/src/__tests__/regression/lib-amber-removed-302d6c2.test.ts (NEW, ~8 it):
  · lib 디렉토리 recursive 스캔 amber/orange 0
  · design-tokens warning yellow + critical/success 보존
  · safety high red 격상 + 미세 구분 + amber/orange 0

⚠️ commit 제외 (line-ending only): sed -i 가 .ts 재작성한 file 중 amber swap
   0 인 것 (CRLF→LF) 은 git add 제외.

canonical truth 보존 (회귀 0):
- design-tokens critical/info/success 토큰
- safety critical(매우 위험)=red / medium·low=yellow
- lib adapter view-model 구조 / caller 영향 0 (색상 토큰만)

호영님 production effect:
1. design-tokens warning 사용처 전역: amber → yellow
2. safety 위험도 high("위험"): orange → red (위험 강조, critical 과 통일)
3. work-queue/compare/ops-console adapter status: yellow

⚠️ §11.302d-6 추가 발견 (정직 보고):
application-wide grep 결과 6a/6b/6c 외 추가 ~96 file ~507 occ 잔존
(dashboard sub-pages / admin / ontology / ops-hub / console / vendor-portal /
compare-analysis-drawer / safety page 등). §11.302d-6 초기 audit 가
head_limit 100 으로 잘려 누락. → §11.302d-6d (영역별 분할) 후속 필요.
6c-2 (lib) 자체는 완결.

Rollback path: git revert <SHA>
- lib amber/orange 복원 + sentinel 삭제
- safety high red → orange 회귀 (위험 표시 약화)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

# lib 디렉토리 정규식 치환 (단 safety high 는 red 수동 — 아래 참조) 또는 카드 복사
git add apps/web/src/lib/ `
  apps/web/src/__tests__/regression/lib-amber-removed-302d6c2.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6c-2-lib.md

git status
git commit -F docs/commit-drafts/COMMIT_11.302d-6c-2-lib.md
git push origin main
```

> 호영님 환경 정규식 치환: lib 디렉토리
> `(bg|text|border|border-l|from|to|ring)-(amber|orange)-([0-9]+)` → `$1-yellow-$3`
> 후 safety-visualization.ts 의 high 분기만 yellow → red 수동 (color/bg/border).

## Production smoke

1. Vercel READY 확인
2. 안전(화학물질) 위험도 표시: high("위험") = red (critical 과 통일, 위험 강조)
3. design-tokens warning 사용처 = yellow
4. work-queue/compare priority status = yellow
