# §11.292c Hotfix — JSX prop 사이 comment 제거 (호영님 즉시 push)

## 🚨 빌드 ERROR 3 commit 연속 — 즉시 push 필요

| Commit | Deploy ID | State |
|---|---|---|
| §11.292 (소싱 TRIAGE 제거) | dpl_GLiZu9EBkDzbUaBHGVW1BWE2f575 | ❌ ERROR |
| §11.293 (공급사 발송 toggle reset) | dpl_GwnzkHbdf8wgaNCHqrAPqaALSHmF | ❌ ERROR |
| §11.292b (비교 drawer Shortlist 제거) | dpl_B619WKow1CVNNDGfnrZ2N7pAzZbt | ❌ ERROR |
| §11.291b (안전 관리 카드 inline expand) | dpl_2vqxsLxrAkN5TNsKUbrwA8uWAgJm | ⏳ BUILDING (동일 fail 가능성 ↑) |

## Root Cause

`apps/web/src/app/_workbench/search/page.tsx` line 1293-1294:

```tsx
                      })}
                      {/* §11.292 triage props 제거 (호영님 P1 1단계). 카드
                          내부 분류 배지 + Shortlist/Hold/Exclude 제거. */}
                      onSelect={() => setActiveResultId(product.id)}
```

`onToggleRequest={() => handleProtectedAction(() => {...})}` 의 closing `})}` 와 다음 prop `onSelect` 사이의 JSX comment block 이 **SWC parser fail** 유발. error 는 line 700 `<div>` 의 'Unexpected token div' 로 잘못 reported 되지만 실제 root cause 는 line 1293-1294.

## Fix (1 file 3 line 제거)

`apps/web/src/app/_workbench/search/page.tsx`: line 1293-1294 의 comment block 자체 삭제. §11.292 trace marker 는 다른 4 위치 (line 728 / 749 / 1229 + sourcing-result-row.tsx line 225) 에 이미 있어서 trace 정합 0 영향.

## Commit message

```
hotfix(workbench): §11.292c JSX prop 사이 comment 제거 — Vercel build ERROR 해소 (§11.292/§11.293/§11.292b 3 commit 연속 fail root cause)

Vercel build ERROR 3 commit 연속:
- dpl_GLiZu9EBkDzbUaBHGVW1BWE2f575 (§11.292)
- dpl_GwnzkHbdf8wgaNCHqrAPqaALSHmF (§11.293)
- dpl_B619WKow1CVNNDGfnrZ2N7pAzZbt (§11.292b)

Root cause:
apps/web/src/app/_workbench/search/page.tsx line 1293-1294 의
SourcingResultRow JSX 안 onToggleRequest closing })} 와 다음
prop onSelect 사이에 §11.292 comment block — SWC parser fail.
Reported error line 700 outer container <div> 의 'Unexpected
token div' 는 misleading; 실제 root cause 는 line 1293-1294.

Fix (1 file 3 line 제거):
- apps/web/src/app/_workbench/search/page.tsx line 1293-1294
  comment block 자체 삭제
- §11.292 trace marker 는 다른 4 위치 (line 728 / 749 / 1229 +
  sourcing-result-row.tsx line 225) 에 이미 land

회귀 0:
- §11.292 1단계 TRIAGE 제거 효과 그대로 (trace marker 4 위치
  보존)
- SourcingResultRow prop 동작 영향 0
- 다른 §11.292/§11.292b/§11.293/§11.291b commit 영향 0

Lessons:
1. JSX prop 사이의 comment block 은 SWC parser 가 다음 prop
   parsing fail 유발 가능 — 안전한 위치 (block element 사이)
   에만 comment 추가
2. SWC error reporting 이 misleading — Reported line 과 실제
   root cause line 이 다를 수 있음. 변경 차이 audit 가 더 정확
3. Vercel build ERROR 시 build_logs grep 으로 정확한 error
   message + reported file 식별. Reported line 은 참고만
```

## Files to stage

```
apps/web/src/app/_workbench/search/page.tsx
docs/commit-drafts/COMMIT_11.292c-hotfix-jsx-comment-syntax.md
```

## Push 절차 (호영님 즉시)

```bash
cd ~/ai-biocompare && git pull --ff-only

git add apps/web/src/app/_workbench/search/page.tsx \
        docs/commit-drafts/COMMIT_11.292c-hotfix-jsx-comment-syntax.md

git commit -F docs/commit-drafts/COMMIT_11.292c-hotfix-jsx-comment-syntax.md
git push origin main
```

## 예상 build 결과

Push 후 새 commit deploy:
- §11.291b 이 BUILDING 중이면 동일 fail 후, hotfix commit 이 land → READY 전환
- 또는 hotfix commit 이 새 BUILDING 시작 → READY

§11.292/§11.293/§11.292b/§11.291b 의 모든 변경이 이 hotfix 위에서 정상 build 됨 (코드 자체 변경은 정상, comment block 만 문제).
