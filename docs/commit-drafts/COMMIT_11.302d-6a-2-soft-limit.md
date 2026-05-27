# §11.302d-6a-2-soft-limit Commit Message Draft (CategorySpending soft_limit orange → red 격상)

```
chore(dashboard): §11.302d-6a-2-soft-limit #category-soft-limit-red — CategorySpendingWidget soft_limit orange → red 격상 (예산 소진 임박 = 위험, §11.302 신호등 3색 정합) (호영님 Q = A, 2026-05-27)

호영님 Q = A (2026-05-27):
§11.302d-6a-2 에서 보류했던 CategorySpendingWidget soft_limit 의 orange
결정. §11.302 신호등은 3색(emerald/yellow/red) 체계인데 예산 단계는
4단계(normal→warning→soft_limit→over_budget). soft_limit = 예산 소진
임박(곧 초과) = 위험 임박 → over_budget(red)과 동일 red 격상. 라벨
("소프트 리밋" vs "예산 초과 위험")로 구분.

이로써 CategorySpendingWidget amber/orange = 0 (§11.302d-6a-2 잔여 종결).

Fix (1 file 1 entry + 1 NEW sentinel):

- apps/web/src/components/dashboard/CategorySpendingWidget.tsx:
  · STATUS_CONFIG.soft_limit:
    - bgColor: bg-orange-50 → bg-red-50
    - textColor: text-orange-700 → text-red-700
    - dotColor: bg-orange-500 → bg-red-500
    - borderColor: border-orange-200 → border-red-200
  · label "소프트 리밋" 보존 (over_budget "예산 초과 위험" 과 라벨 구분)
  · §11.302d-6a-2-soft-limit 주석 (Q = A red 격상 근거)

- apps/web/src/__tests__/regression/
  category-soft-limit-red-302d6a2sl.test.ts (NEW, ~9 it):
  · amber/orange 0 (전체 file 종결) + soft_limit red 4 property + 라벨 보존
  · 회귀 0: STATUS_CONFIG 5 entry / warning yellow / over_budget red /
    normal emerald / UsageBar red 분기

canonical truth 보존 (회귀 0):
- STATUS_CONFIG 5 entry 구조 보존
- warning (yellow, §11.302d-6a-2) 보존
- over_budget (red, "예산 초과 위험") 보존
- normal (emerald) 보존
- UsageBar over_budget/soft_limit red 분기 (이미 red 였음 — bar 일관)
- soft_limit status 값 자체 변경 0 (색상 톤만 swap)

호영님 production effect:
1. labaxis.co.kr/dashboard 카테고리별 예산 widget:
   - "소프트 리밋" status badge: orange → red
   - bar 는 이미 red 였으므로 badge 와 일관성 회복
   - 라벨로 over_budget("예산 초과 위험")과 구분 유지
2. 예산 90%+ 임박 = red 조기 경고 강화 (위험 인지)
3. §11.302d-6a-2 CategorySpending amber/orange 완전 종결

Out of Scope (§11.302d-6b / 6c 후속):
- workbench / approval / sourcing (~30 file) — 6b
- lib + legacy (~30 file) — 6c

Rollback path: git revert <SHA>
- 1 file soft_limit orange 복원 + 1 sentinel 삭제
- 사용자 영향: soft_limit badge red → orange 회귀 (시각만)
- status enum / 집계 로직 변경 0
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/dashboard/CategorySpendingWidget.tsx `
  apps/web/src/__tests__/regression/category-soft-limit-red-302d6a2sl.test.ts `
  docs/commit-drafts/COMMIT_11.302d-6a-2-soft-limit.md

git status   # modified: 1 + untracked: 2
git commit -F docs/commit-drafts/COMMIT_11.302d-6a-2-soft-limit.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. labaxis.co.kr/dashboard 카테고리별 예산 widget:
   - "소프트 리밋" status badge = red (이전 orange)
   - "예산 초과 위험" = red (라벨로 구분)
   - "주의" = yellow / "정상" = emerald (변경 0)
3. UsageBar 색상 (soft_limit/over_budget red) 일관 확인
```
